"""Stage-2 evaluation runner for data quality robustness."""
from __future__ import annotations

import argparse
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd
from tqdm import tqdm

from cleansql.eval.dq_metrics import DQRecord, summarize, rel_error
from cleansql.llm.realization import Realizer
from cleansql.rag.client import HybridRetriever
from cleansql.utils.io import load_jsonl
from cleansql.exec.sqlite_runner import execute_sql
from cleansql.utils.parsing import DualOutputParseError

LOGGER = logging.getLogger(__name__)
LITERAL_PATTERN = re.compile(r"'([^']+)'|\b(\d+(?:\.\d+)?)\b")


CONTEXT_CONFIG = {
    "schema_only": {"rag_topk": 0, "rerank": False},
    "rag_topk3": {"rag_topk": 3, "rerank": False},
    "rag_topk5": {"rag_topk": 5, "rerank": False},
    "rag_topk8_rerank": {"rag_topk": 8, "rerank": True},
}


def load_profiles(profile_dir: Path) -> Dict[str, dict]:
    profiles = {}
    for path in profile_dir.glob("*.json"):
        data = json.loads(path.read_text())
        profiles[data["db_id"]] = data
    return profiles


def clean_db_path(root: Path, db_id: str) -> Path:
    path = root / db_id / f"{db_id}.sqlite"
    if path.exists():
        return path
    alt = root / f"{db_id}.sqlite"
    if alt.exists():
        return alt
    raise FileNotFoundError(path)


def corrupted_db_path(root: Path, db_id: str) -> Path:
    base = root / f"{db_id}.sqlite"
    if base.exists():
        return base
    nested = root / db_id / f"{db_id}.sqlite"
    if nested.exists():
        return nested
    raise FileNotFoundError(base)


def literals_stats(basic_sql: str, robust_sql: str) -> Tuple[int, int]:
    base = set(LITERAL_PATTERN.findall(basic_sql))
    flat_base = {item for pair in base for item in pair if item}
    robust = set(LITERAL_PATTERN.findall(robust_sql))
    flat_robust = {item for pair in robust for item in pair if item}
    if not flat_base:
        return (len(flat_robust & flat_base), len(flat_robust) or 1)
    return (len(flat_robust & flat_base), len(flat_base))


def _to_float(value) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        try:
            return float(str(value).replace(",", ""))
        except Exception:
            return 0.0


def rows_to_records(clean_rows: List[dict], pred_rows: List[dict], literal_stats: Tuple[int, int], notes: List[str]) -> List[DQRecord]:
    records: List[DQRecord] = []
    if not clean_rows and not pred_rows:
        return [DQRecord(0.0, 0.0, literal_stats[0], literal_stats[1], notes)]
    if clean_rows and len(clean_rows[0].keys()) >= 2:
        key, value_key = list(clean_rows[0].keys())[:2]
        # Use .get for robustness in case value_key is missing in some rows
        clean_map = {row.get(key): _to_float(row.get(value_key)) for row in clean_rows if key in row}
        pred_map = {row.get(key): _to_float(row.get(value_key)) for row in pred_rows if key in row}
        all_keys = set(clean_map) | set(pred_map)
        for grp in all_keys:
            clean_val = clean_map.get(grp, 0.0)
            pred_val = pred_map.get(grp, 0.0)
            records.append(DQRecord(clean_val, pred_val, literal_stats[0], literal_stats[1], notes))
    else:
        clean_val = _to_float(clean_rows[0][list(clean_rows[0].keys())[0]]) if clean_rows else 0.0
        pred_val = _to_float(pred_rows[0][list(pred_rows[0].keys())[0]]) if pred_rows else 0.0
        records.append(DQRecord(clean_val, pred_val, literal_stats[0], literal_stats[1], notes))
    return records


def main(args: argparse.Namespace) -> None:
    logging.basicConfig(level=logging.INFO)
    context_cfg = CONTEXT_CONFIG[args.context]
    ids = load_jsonl(args.ids)
    profiles = load_profiles(Path(args.profile_dir))
    retriever = HybridRetriever(index_dir=Path(args.index_dir)) if context_cfg["rag_topk"] > 0 else None
    realizer = Realizer(retriever=retriever)
    dq_records: List[DQRecord] = []
    rows_out = []
    total_queries = len(ids)
    skipped = 0
    for idx, item in enumerate(
        tqdm(ids, desc=f"Stage-2 {args.context} ({args.technique})", unit="q")
    ):
        profile = profiles.get(item["db_id"])
        if not profile:
            LOGGER.warning("Missing profile for %s", item["db_id"])
            skipped += 1
            continue
        try:
            result = realizer.realize(
                item["question"],
                schema=profile,
                db_id=item["db_id"],
                technique=args.technique,
                rag_topk=context_cfg["rag_topk"],
                rerank=context_cfg["rerank"],
            )
        except DualOutputParseError as exc:
            LOGGER.warning(
                "Skipping question %s (%s) due to parse failure: %s",
                item.get("question_id", f"idx_{idx}"),
                item["db_id"],
                exc,
            )
            skipped += 1
            continue
        clean_rows = execute_sql(clean_db_path(Path(args.clean_db_root), item["db_id"]), result.output.basic_sql)
        pred_rows = execute_sql(corrupted_db_path(Path(args.db_root), item["db_id"]), result.output.robust_sql)
        literal_hit = literals_stats(result.output.basic_sql, result.output.robust_sql)
        records = rows_to_records(clean_rows, pred_rows, literal_hit, result.output.notes)
        dq_records.extend(records)
        rel_errors = [rel_error(rec.prediction, rec.clean) for rec in records]
        abs_errors = [abs(rec.prediction - rec.clean) for rec in records]
        summary_record = {
            "question_id": item["question_id"],
            "db_id": item["db_id"],
            "context": args.context,
            "technique": args.technique,
            "basic_sql": result.output.basic_sql,
            "robust_sql": result.output.robust_sql,
            "rel_error_mean": float(sum(rel_errors) / len(rel_errors)) if rel_errors else 0.0,
            "abs_error_mean": float(sum(abs_errors) / len(abs_errors)) if abs_errors else 0.0,
        }
        rows_out.append(summary_record)
    metrics = summarize(dq_records)
    df = pd.DataFrame([{**row, **metrics} for row in rows_out])
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    LOGGER.info(
        "Stage-2 context %s technique %s complete -> %s", args.context, args.technique, args.out
    )
    print(
        f"Stage-2 {args.context} ({args.technique}): wrote {args.out} with "
        f"{len(df)} rows (skipped {skipped}/{total_queries} queries)"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Stage-2 contexts")
    parser.add_argument("--context", choices=list(CONTEXT_CONFIG.keys()), required=True)
    parser.add_argument(
        "--technique",
        choices=["baseline", "fewshot", "cot", "sc", "tot"],
        default="cot",
        help="Prompting technique to use (default: cot)",
    )
    parser.add_argument("--ids", default="data/stage2_ids.jsonl")
    parser.add_argument("--db-root", default="work/corrupted_databases", help="Directory containing corrupted DB copies")
    parser.add_argument("--clean-db-root", default="data/spider_databases")
    parser.add_argument("--index-dir", default="work/qdrant_index")
    parser.add_argument("--profile-dir", default="data/profiles")
    parser.add_argument("--out", required=True)
    main(parser.parse_args())
