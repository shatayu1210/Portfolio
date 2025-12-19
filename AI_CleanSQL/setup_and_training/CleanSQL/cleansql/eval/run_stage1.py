"""Stage-1 evaluation runner for multiple prompting techniques."""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, List

import pandas as pd
import sqlglot

from cleansql.eval.spider_metrics import evaluate_query
from cleansql.llm.realization import Realizer
from cleansql.rag.client import HybridRetriever
from cleansql.utils.io import load_jsonl, setup_logging
from cleansql.utils.parsing import DualOutputParseError
from tqdm import tqdm

LOGGER = logging.getLogger(__name__)


def referenced_tables(sql: str) -> List[str]:
    try:
        expr = sqlglot.parse_one(sql, read="sqlite")
        return sorted({tbl.alias_or_name for tbl in expr.find_all(sqlglot.exp.Table)})
    except Exception:
        return []


def load_profiles(profile_dir: Path) -> Dict[str, dict]:
    profiles = {}
    for path in profile_dir.glob("*.json"):
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            profiles[data["db_id"]] = data
    if not profiles:
        LOGGER.warning("No profiles found in %s", profile_dir)
    return profiles


def db_path(db_root: Path, db_id: str) -> Path:
    path = db_root / db_id / f"{db_id}.sqlite"
    if not path.exists():
        raise FileNotFoundError(path)
    return path


def main(args: argparse.Namespace) -> None:
    setup_logging()
    ids = load_jsonl(args.ids)
    profiles = load_profiles(Path(args.profile_dir))
    retriever = HybridRetriever(index_dir=Path(args.index_dir))
    realizer = Realizer(retriever=retriever)
    records: List[dict] = []
    for idx, item in enumerate(tqdm(ids, desc=f"Stage-1 {args.technique}", unit="q")):
        prof = profiles.get(item["db_id"])
        if not prof:
            LOGGER.warning("Missing profile for %s. Skipping", item["db_id"])
            continue
        tables = referenced_tables(item["sql"])
        try:
            result = realizer.realize(
                item["question"],
                schema=prof,
                db_id=item["db_id"],
                technique=args.technique,
                rag_topk=3,
                rerank=False,
                tables=tables,
            )
        except DualOutputParseError as exc:
            LOGGER.warning(
                "Skipping question %s (%s) due to parse failure: %s",
                item.get("question_id"),
                item["db_id"],
                exc,
            )
            continue

        metrics = evaluate_query(
            result.output.basic_sql,
            item["sql"],
            db_path(Path(args.db_root), item["db_id"]),
        )
        records.append(
            {
                "question_id": item["question_id"],
                "db_id": item["db_id"],
                "category": item.get("category"),
                "technique": args.technique,
                "plan_steps": len(result.output.plan),
                "basic_sql": result.output.basic_sql,
                "robust_sql": result.output.robust_sql,
                "notes": " | ".join(result.output.notes),
                "exact_match": metrics.exact_match,
                "exec_match": metrics.exec_match,
                **metrics.components,
            }
        )
    df = pd.DataFrame(records)
    df.to_csv(args.out, index=False)
    LOGGER.info("Wrote %s", args.out)
    print(f"Stage-1 {args.technique}: wrote {args.out} with {len(df)} rows")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Stage-1 technique")
    parser.add_argument("--technique", required=True, choices=["baseline", "fewshot", "cot", "sc", "tot"])
    parser.add_argument("--ids", required=True)
    parser.add_argument("--db-root", required=True)
    parser.add_argument("--index-dir", required=True)
    parser.add_argument("--profile-dir", required=True)
    parser.add_argument("--out", required=True)
    main(parser.parse_args())
