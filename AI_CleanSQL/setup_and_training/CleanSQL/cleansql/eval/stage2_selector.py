"""Select DBs and queries for Stage-2 DQ evaluation and generate corruption."""
from __future__ import annotations

import argparse
import json
import random
import sqlite3
from pathlib import Path
from typing import Dict, List, Tuple

from cleansql.profiling.corruption import CorruptionPlan, apply_corruption
from cleansql.utils.io import write_jsonl

# Helper class to help us analyze the schema of each database for column types and keys
class DBAnalyzer:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.tables = self._load_tables()

    def _load_tables(self) -> Dict[str, List[sqlite3.Row]]:
        tables = {}
        rows = self.conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        for row in rows:
            table = row["name"]
            cols = self.conn.execute(f"PRAGMA table_info('{table}')").fetchall()
            tables[table] = cols
        return tables

    def numeric_columns(self) -> List[Tuple[str, str]]:
        numeric = []
        for table, cols in self.tables.items():
            for col in cols:
                ctype = (col["type"] or "").upper()
                if any(tag in ctype for tag in ("INT", "REAL", "NUM", "DEC", "DOUBLE")):
                    numeric.append((table, col["name"]))
        return numeric

    def categorical_columns(self) -> List[Tuple[str, str]]:
        cats = []
        for table, cols in self.tables.items():
            for col in cols:
                ctype = (col["type"] or "").upper()
                if "CHAR" in ctype or "TEXT" in ctype:
                    cats.append((table, col["name"]))
        return cats

    def choose_key(self) -> Tuple[str, str]:
        for table, cols in self.tables.items():
            for col in cols:
                if col["pk"]:
                    return table, col["name"]
        table = next(iter(self.tables))
        column = self.tables[table][0]["name"]
        return table, column

    def close(self) -> None:
        self.conn.close()

# Focusing on databases with more number of numeric cols
def choose_stage2_dbs(stage1_dbs: List[str], spider_root: Path) -> List[str]:
    scores = []
    # Iterating through each db and capturing count of numeric cols in each db
    for db_id in stage1_dbs:
        db_path = spider_root / db_id / f"{db_id}.sqlite"
        analyzer = DBAnalyzer(db_path)
        numeric_count = len(analyzer.numeric_columns())
        scores.append((numeric_count, db_id))
        analyzer.close()
    scores.sort(reverse=True)

    # Returning the top 2 dbs with most numeric cols
    return [db for _, db in scores[:2]]


def create_corruption(db_id: str, spider_root: Path, out_root: Path, rng: random.Random) -> Tuple[CorruptionPlan, Path]:
    analyzer = DBAnalyzer(spider_root / db_id / f"{db_id}.sqlite")
    
    # Segragating numeric, categorical cols
    numeric_cols = analyzer.numeric_columns()
    cats = analyzer.categorical_columns()

    # Choosing random  4 cols minimum for missingness, and 2 minimum for outliers
    missingness = rng.sample(numeric_cols, min(4, len(numeric_cols)))
    outliers = rng.sample(numeric_cols, min(2, len(numeric_cols)))
    # Targeting pk cols for injecting duplicates
    duplicates = analyzer.choose_key()
    cat_targets = rng.sample(cats, min(2, len(cats))) if cats else []
    plan = CorruptionPlan(
        db_id=db_id,
        missingness=missingness,
        outliers=outliers,
        duplicates=duplicates,
        categorical_typos=cat_targets,
        seed=rng.randint(1, 9999),
    )
    analyzer.close()
    out_path = out_root / f"{db_id}.sqlite"
    apply_corruption(plan, spider_root / db_id / f"{db_id}.sqlite", out_path)
    (out_root / f"{db_id}_plan.json").write_text(json.dumps(plan.to_json(), indent=2))
    return plan, out_path


def select_numeric_queries(
    dev_examples: List[dict],
    target_dbs: List[str],
    plans: Dict[str, CorruptionPlan],
    limit: int = 120,
) -> List[dict]:
    """Select numeric queries, biased toward columns we actually corrupt.

    We first build a pool of numeric queries (SUM/AVG/COUNT/MAX/MIN) on the
    target DBs. Within that pool, we *prioritize* queries whose SQL text
    references any of the corrupted columns from the CorruptionPlan
    (missingness/outliers/duplicates). If we don't have enough such queries,
    we backfill from the remaining numeric pool.
    """

    # Base pool: numeric aggregates on target DBs
    agg_tokens = ("sum", "avg", "count", "max", "min")
    base_pool = [
        ex
        for ex in dev_examples
        if ex["db_id"] in target_dbs
        and any(tok in ex["query"].lower() for tok in agg_tokens)
    ]

    # Build lookup: db_id -> set of corrupted column names (lowercased)
    db_to_cols: Dict[str, List[str]] = {}
    for db_id, plan in plans.items():
        cols = set()
        # numeric corruption targets: missingness + outliers
        for table, col in list(plan.missingness) + list(plan.outliers):
            cols.add(col.lower())
        # duplicates are often on PKs that affect counts
        if plan.duplicates:
            _, dup_col = plan.duplicates
            cols.add(dup_col.lower())
        db_to_cols[db_id] = sorted(cols)

    def touches_corrupted(sql: str, db_id: str) -> bool:
        sql_l = sql.lower()
        cols = db_to_cols.get(db_id, [])
        return any(col in sql_l for col in cols)

    # Primary pool: numeric queries that reference at least one corrupted column
    primary = [
        ex
        for ex in base_pool
        if touches_corrupted(ex["query"], ex["db_id"])
    ]

    rng = random.Random(7)
    rng.shuffle(primary)
    selected: List[dict] = primary[:limit]

    # If not enough, backfill with remaining numeric queries on the same DBs
    if len(selected) < limit:
        remaining = [ex for ex in base_pool if ex not in selected]
        rng.shuffle(remaining)
        needed = limit - len(selected)
        selected.extend(remaining[:needed])

    return selected


def main(args: argparse.Namespace) -> None:
    stage1_dbs = Path(args.stage1_dbs).read_text().splitlines()
    spider_root = Path(args.spider_root)
    corrupted_root = Path(args.corrupted_root)
    corrupted_root.mkdir(parents=True, exist_ok=True)
    dev_examples = json.loads(Path(args.dev_path).read_text())
    chosen = choose_stage2_dbs(stage1_dbs, spider_root)
    rng = random.Random(7)
    plans = {}
    for db_id in chosen:
        plan, out_path = create_corruption(db_id, spider_root, corrupted_root, rng)
        plans[db_id] = plan
        print(f"Corrupted {db_id} -> {out_path}")
    selections = select_numeric_queries(dev_examples, chosen, plans)
    rows = []
    for idx, item in enumerate(selections):
        rows.append(
            {
                "question_id": item.get("question_id", f"stage2_{idx}"),
                "db_id": item["db_id"],
                "question": item["question"],
                "sql": item["query"],
                "category": item.get("category", "numeric"),
                "targets": plans[item["db_id"]].missingness,
            }
        )
    # Writing back the selected queries and list of associated dbs
    write_jsonl(args.out_ids, rows)
    Path(args.out_dbs).write_text("\n".join(chosen))
    print(f"Wrote {len(rows)} Stage-2 queries")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Select Stage-2 eval set")
    parser.add_argument("--spider-root", required=True)
    parser.add_argument("--dev-path", required=True)
    parser.add_argument("--stage1-dbs", required=True)
    parser.add_argument("--out-ids", required=True)
    parser.add_argument("--out-dbs", required=True)
    parser.add_argument("--corrupted-root", required=True)
    main(parser.parse_args())
