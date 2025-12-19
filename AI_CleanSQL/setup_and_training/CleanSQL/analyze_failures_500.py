#!/usr/bin/env python3
"""
Analyze failures from 500-sample fine-tuned model evaluation.

This script:
1. Runs Stage 2 evaluation with the 500-sample fine-tuned model
2. Identifies queries that fail robustness checks (dq_robust_1pct or dq_robust_5pct)
3. Prints input-output pairs for failures
4. Analyzes patterns to suggest training data improvements
"""

import argparse
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd
from tqdm import tqdm

from cleansql.eval.dq_metrics import DQRecord, rel_error, summarize
from cleansql.llm.realization import Realizer
from cleansql.rag.client import HybridRetriever
from cleansql.utils.io import load_jsonl
from cleansql.exec.sqlite_runner import execute_sql
from cleansql.utils.parsing import DualOutputParseError

logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)
LITERAL_PATTERN = re.compile(r"'([^']+)'|\b(\d+(?:\.\d+)?)\b")


def load_profiles(profile_dir: Path) -> Dict[str, dict]:
    """Load database profiles."""
    profiles = {}
    for path in profile_dir.glob("*.json"):
        data = json.loads(path.read_text())
        profiles[data["db_id"]] = data
    return profiles


def clean_db_path(root: Path, db_id: str) -> Path:
    """Get path to clean database."""
    path = root / db_id / f"{db_id}.sqlite"
    if path.exists():
        return path
    alt = root / f"{db_id}.sqlite"
    if alt.exists():
        return alt
    raise FileNotFoundError(path)


def corrupted_db_path(root: Path, db_id: str) -> Path:
    """Get path to corrupted database."""
    base = root / f"{db_id}.sqlite"
    if base.exists():
        return base
    nested = root / db_id / f"{db_id}.sqlite"
    if nested.exists():
        return nested
    raise FileNotFoundError(base)


def literals_stats(basic_sql: str, robust_sql: str) -> Tuple[int, int]:
    """Count matching literals between BASIC_SQL and ROBUST_SQL."""
    base = set(LITERAL_PATTERN.findall(basic_sql))
    flat_base = {item for pair in base for item in pair if item}
    robust = set(LITERAL_PATTERN.findall(robust_sql))
    flat_robust = {item for pair in robust for item in pair if item}
    if not flat_base:
        return (len(flat_robust & flat_base), len(flat_robust) or 1)
    return (len(flat_robust & flat_base), len(flat_base))


def _to_float(value) -> float:
    """Convert value to float, handling commas."""
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        try:
            return float(str(value).replace(",", ""))
        except Exception:
            return 0.0


def rows_to_records(clean_rows: List[dict], pred_rows: List[dict], 
                   literal_stats: Tuple[int, int], notes: List[str]) -> List[DQRecord]:
    """Convert query results to DQRecord objects."""
    from cleansql.eval.dq_metrics import DQRecord
    
    records: List[DQRecord] = []
    if not clean_rows and not pred_rows:
        return [DQRecord(0.0, 0.0, literal_stats[0], literal_stats[1], notes)]
    
    if clean_rows and len(clean_rows[0].keys()) >= 2:
        key, value_key = list(clean_rows[0].keys())[:2]
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


def analyze_failures(args: argparse.Namespace) -> None:
    """Run evaluation and analyze failures."""
    
    # Load data
    ids = load_jsonl(args.ids)
    profiles = load_profiles(Path(args.profile_dir))
    retriever = HybridRetriever(index_dir=Path(args.index_dir))
    realizer = Realizer(retriever=retriever)
    
    # Storage for results
    all_records: List[Dict] = []
    failures: List[Dict] = []
    
    print("=" * 80)
    print("RUNNING EVALUATION WITH 500-SAMPLE FINE-TUNED MODEL")
    print("=" * 80)
    print()
    
    # Process each query
    for idx, item in enumerate(tqdm(ids, desc="Evaluating", unit="q")):
        db_id = item["db_id"]
        question = item["question"]
        prof = profiles.get(db_id)
        
        if not prof:
            LOGGER.warning(f"Missing profile for {db_id}. Skipping.")
            continue
        
        # Get RAG context
        tables = set()
        try:
            from cleansql.utils.parsing import referenced_tables
            tables = referenced_tables(item.get("sql", ""))
        except:
            pass
        
        try:
            result = realizer.realize(
                question,
                schema=prof,
                db_id=db_id,
                technique=args.technique,
                rag_topk=args.rag_topk,
                rerank=args.rerank,
                tables=tables if tables else None,
            )
        except DualOutputParseError as exc:
            LOGGER.warning(f"Skipping {item.get('question_id')} due to parse failure: {exc}")
            continue
        except Exception as exc:
            LOGGER.error(f"Error processing {item.get('question_id')}: {exc}")
            continue
        
        # Execute queries
        clean_db = clean_db_path(Path(args.clean_db_root), db_id)
        corrupted_db = corrupted_db_path(Path(args.db_root), db_id)
        
        try:
            clean_rows = execute_sql(clean_db, result.output.basic_sql)
            pred_rows = execute_sql(corrupted_db, result.output.robust_sql)
        except Exception as exc:
            LOGGER.warning(f"SQL execution failed for {item.get('question_id')}: {exc}")
            clean_rows = []
            pred_rows = []
        
        # Calculate metrics
        literal_stats = literals_stats(result.output.basic_sql, result.output.robust_sql)
        notes = result.output.notes or []
        
        records = rows_to_records(clean_rows, pred_rows, literal_stats, notes)
        summary = summarize(records)
        
        # Store result
        record = {
            "question_id": item.get("question_id", f"q_{idx}"),
            "db_id": db_id,
            "question": question,
            "basic_sql": result.output.basic_sql,
            "robust_sql": result.output.robust_sql,
            "notes": " | ".join(notes),
            "raw_output": getattr(result, 'raw_text', ''),
            "rag_chunks": getattr(result, 'rag_chunks', []),
            "schema": prof,
            **summary
        }
        all_records.append(record)
        
        # Check if this is a failure
        is_failure = (
            summary["dq_robust_1pct"] < 1.0 or  # Not within 1% error
            summary["dq_robust_5pct"] < 1.0     # Not within 5% error
        )
        
        if is_failure:
            failures.append(record)
    
    # Save full results
    df = pd.DataFrame(all_records)
    output_file = Path(args.out)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_file, index=False)
    print(f"\n✓ Full results saved to: {output_file}")
    
    # Print failure analysis
    print("\n" + "=" * 80)
    print(f"FAILURE ANALYSIS: {len(failures)}/{len(all_records)} queries failed robustness")
    print("=" * 80)
    print()
    
    if not failures:
        print("✅ No failures! All queries passed robustness checks.")
        return
    
    # Print detailed failure information
    for i, failure in enumerate(failures, 1):
        print(f"\n{'=' * 80}")
        print(f"FAILURE #{i}: {failure['question_id']} (DB: {failure['db_id']})")
        print(f"{'=' * 80}")
        print()
        
        # Input
        print("📥 INPUT:")
        print("-" * 80)
        print(f"Question: {failure['question']}")
        print()
        print("Schema:")
        schema_str = json.dumps(failure['schema'], indent=2)
        print(schema_str[:500] + "..." if len(schema_str) > 500 else schema_str)
        print()
        
        if failure.get('rag_chunks'):
            print("RAG Context (first 500 chars):")
            # Handle both string list and dict list formats
            if failure['rag_chunks'] and isinstance(failure['rag_chunks'][0], str):
                rag_text = "\n".join([chunk[:200] for chunk in failure['rag_chunks'][:3]])
            else:
                rag_text = "\n".join([chunk.get('text', str(chunk))[:200] for chunk in failure['rag_chunks'][:3]])
            print(rag_text[:500] + "..." if len(rag_text) > 500 else rag_text)
            print()
        
        # Output
        print("📤 OUTPUT:")
        print("-" * 80)
        print("BASIC_SQL:")
        print(failure['basic_sql'])
        print()
        print("ROBUST_SQL:")
        print(failure['robust_sql'])
        print()
        print("NOTES:")
        print(failure['notes'])
        print()
        
        # Metrics
        print("📊 METRICS:")
        print("-" * 80)
        print(f"dq_robust_1pct: {failure['dq_robust_1pct']:.4f} ({'✅ PASS' if failure['dq_robust_1pct'] >= 1.0 else '❌ FAIL'})")
        print(f"dq_robust_5pct: {failure['dq_robust_5pct']:.4f} ({'✅ PASS' if failure['dq_robust_5pct'] >= 1.0 else '❌ FAIL'})")
        print(f"MAPE: {failure['mape']:.4f}")
        print(f"MAE: {failure['mae']:.4f}")
        print(f"Literal Acc: {failure['literal_acc']:.4f}")
        print()
    
    # Pattern analysis
    print("\n" + "=" * 80)
    print("PATTERN ANALYSIS")
    print("=" * 80)
    print()
    
    # Analyze failure patterns
    failure_df = pd.DataFrame(failures)
    
    # 1. Database distribution
    print("1. Database Distribution of Failures:")
    db_counts = failure_df['db_id'].value_counts()
    print(db_counts.to_string())
    print()
    
    # 2. Notes analysis (what repairs were attempted)
    print("2. Repair Patterns in Failures:")
    no_repair_count = sum(1 for f in failures if "No quality-repairs required" in f['notes'])
    has_repair_count = len(failures) - no_repair_count
    print(f"  - No repairs attempted: {no_repair_count} ({no_repair_count/len(failures)*100:.1f}%)")
    print(f"  - Repairs attempted: {has_repair_count} ({has_repair_count/len(failures)*100:.1f}%)")
    print()
    
    # 3. Common repair types
    repair_types = {
        "impute": sum(1 for f in failures if "imputed" in f['notes'].lower()),
        "dedup": sum(1 for f in failures if "deduplicated" in f['notes'].lower()),
        "cap": sum(1 for f in failures if "capped" in f['notes'].lower()),
    }
    print("3. Repair Types in Failures:")
    for repair_type, count in repair_types.items():
        print(f"  - {repair_type}: {count} ({count/len(failures)*100:.1f}%)")
    print()
    
    # 4. Error magnitude
    print("4. Error Magnitude:")
    print(f"  - Average MAPE: {failure_df['mape'].mean():.4f}")
    print(f"  - Average MAE: {failure_df['mae'].mean():.4f}")
    print(f"  - Max MAPE: {failure_df['mape'].max():.4f}")
    print(f"  - Max MAE: {failure_df['mae'].max():.4f}")
    print()
    
    # 5. Recommendations
    print("=" * 80)
    print("RECOMMENDATIONS FOR TRAINING DATA")
    print("=" * 80)
    print()
    
    recommendations = []
    
    # Check if specific databases fail more
    if len(db_counts) > 0:
        top_failing_db = db_counts.index[0]
        recommendations.append(f"• Generate more training examples for database: {top_failing_db}")
    
    # Check repair patterns
    if no_repair_count > len(failures) * 0.3:
        recommendations.append("• Add more 'no repairs' examples (model may be over-applying repairs)")
    
    if repair_types.get("impute", 0) > len(failures) * 0.4:
        recommendations.append("• Add more training examples with missing value imputation")
    
    if repair_types.get("dedup", 0) > len(failures) * 0.4:
        recommendations.append("• Add more training examples with deduplication")
    
    if repair_types.get("cap", 0) > len(failures) * 0.4:
        recommendations.append("• Add more training examples with outlier capping")
    
    # Check error patterns
    if failure_df['mape'].mean() > 0.1:
        recommendations.append("• Focus on queries with high percentage errors (MAPE > 10%)")
    
    if failure_df['mae'].mean() > 200:
        recommendations.append("• Focus on queries with large absolute errors (MAE > 200)")
    
    if recommendations:
        for rec in recommendations:
            print(rec)
    else:
        print("• Failures are diverse - consider general improvements to training data quality")
    
    print()
    
    # Save failures to JSON for further analysis
    failures_file = output_file.parent / f"{output_file.stem}_failures.json"
    with failures_file.open('w') as f:
        json.dump(failures, f, indent=2, default=str)
    print(f"✓ Failures saved to: {failures_file}")


def main():
    parser = argparse.ArgumentParser(description="Analyze failures from 500-sample fine-tuned model")
    parser.add_argument("--ids", default="data/stage2_ids.jsonl", help="Stage 2 question IDs")
    parser.add_argument("--db-root", default="work/corrupted_databases", help="Corrupted databases")
    parser.add_argument("--clean-db-root", default="data/spider_databases", help="Clean databases")
    parser.add_argument("--profile-dir", default="data/profiles", help="Profile directory")
    parser.add_argument("--index-dir", default="work/qdrant_index", help="RAG index directory")
    parser.add_argument("--out", default="results/stage2_500_failures.csv", help="Output CSV")
    parser.add_argument("--technique", default="sc", choices=["baseline", "fewshot", "cot", "sc", "tot"])
    parser.add_argument("--rag-topk", type=int, default=5, help="RAG top-k")
    parser.add_argument("--rerank", action="store_true", help="Enable reranking")
    
    args = parser.parse_args()
    analyze_failures(args)


if __name__ == "__main__":
    main()

