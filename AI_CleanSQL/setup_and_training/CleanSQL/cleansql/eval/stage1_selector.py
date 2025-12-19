"""Selector for Stage-1 to be used forprompt-engineering evaluation."""
from __future__ import annotations

import argparse
import json
import random
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

from cleansql.utils.io import ensure_dir, write_jsonl

# Pulling a variety of 150 queries for prompt engg evaluation (CoT, ToT, Self Consistency, Few-Shot)
TARGET_COUNTS = {
    "filter_agg": 35,
    "group_having": 25,
    "join_1hop": 25,
    "join_2hop": 15,
    "order_limit": 15,
    "nested": 20,
    "date_range": 15,
}

# Categorizing queries, the other 3 categories are identified directly from query
CATEGORY_KEYWORDS = {
    "group_having": ["group", "having"],
    "order_limit": ["order", "limit"],
    "nested": [" in ", " exists "],
    "date_range": ["date", " between "],
}


class SchemaStats:
    def __init__(self, db_path: Path) -> None:
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        self.tables = [row[0] for row in cursor]
        self.table_count = len(self.tables)
        self.fk_count = 0
        for table in self.tables:
            self.fk_count += len(conn.execute(f"PRAGMA foreign_key_list('{table}')").fetchall())
        conn.close()


def choose_dbs(spider_root: Path, allowed_dbs: List[str], limit: int = 8) -> List[str]:
    candidates = []
    for db_id in sorted(allowed_dbs):
        db_dir = spider_root / db_id
        if not db_dir.is_dir():
            continue
        sqlite_path = db_dir / f"{db_id}.sqlite"
        if not sqlite_path.exists():
            continue
        stats = SchemaStats(sqlite_path)

        # Using databases with minimum 4 tables and 1 foreign key
        if stats.table_count >= 4 and stats.fk_count >= 1:
            candidates.append((stats.table_count, stats.fk_count, db_id))

    # Sorting dbs by number of tables and then by foreign keys
    candidates.sort(reverse=True)

    return [name for _, _, name in candidates[:limit]]


def categorize(sql: str) -> str:
    # Identifying category of query. Regex for joins, filter_agg and then iterating through our category keywords dict
    lowered = sql.lower()
    if " join " in lowered:
        join_count = lowered.count(" join ")
        return "join_2hop" if join_count >= 2 else "join_1hop"
    for category, tokens in CATEGORY_KEYWORDS.items():
        if all(token in lowered for token in tokens):
            return category
    if " sum(" in lowered or " avg(" in lowered or " count(" in lowered:
        return "filter_agg"
    return "filter_agg"


def load_spider_dev(dev_path: Path) -> List[dict]:
    return json.loads(dev_path.read_text())


def select_queries(dev_examples: List[dict], chosen_dbs: List[str]) -> List[dict]:
    by_category: Dict[str, List[dict]] = defaultdict(list)
    for example in dev_examples:
        # Skipping queries not from our chosen dbs
        if example["db_id"] not in chosen_dbs:
            continue
        # Extracting query category
        cat = categorize(example["query"])

        # Assign category to each query
        example["category"] = cat

        # Add the query to the apt category list
        by_category[cat].append(example)
    
    # Getting random seeded queries from each category until needed count has been fulfilled
    rng = random.Random(7)

    # Initializing list to store our final selected queries
    selected: List[dict] = []

    # Iterating through each category and choosing random queriees upto our target count
    for category, target in TARGET_COUNTS.items():
        pool = by_category.get(category, [])
        rng.shuffle(pool)
        selected.extend(pool[:target])
    return selected


def write_outputs(selected: List[dict], ids_path: Path, dbs_path: Path) -> None:
    rows = []
    seen_dbs = set()
    for idx, item in enumerate(selected):
        seen_dbs.add(item["db_id"])
        rows.append(
            {
                "question_id": item.get("question_id", f"stage1_{idx}"),
                "db_id": item["db_id"],
                "question": item["question"],
                "sql": item["query"],
                "category": item.get("category"),
            }
        )
    # Writing back selected queries to ids_path and list of dbs to dbs_path
    write_jsonl(ids_path, rows)
    dbs_path.write_text("\n".join(sorted(seen_dbs)))


def main(args: argparse.Namespace) -> None:
    # Extracting our args
    spider_root = Path(args.spider_root)
    dev_path = Path(args.dev_path)
    ids_path = Path(args.out_ids)
    dbs_path = Path(args.out_dbs)

    dev_examples = load_spider_dev(dev_path)

    # Limit selection to dbs that actually appear in the dev set
    dev_dbs = sorted({example["db_id"] for example in dev_examples})

    # Capturing sqlite dbs from spider_root directory with atleast 4 tables and 1 foreign key
    chosen_dbs = choose_dbs(spider_root, dev_dbs)

    # Randomly selecting required count of queries from each category
    selected = select_queries(dev_examples, chosen_dbs)
    
    # Preparing to write selected structured JSONL queries to ids_path and list of associated dbs to dbs_path
    ensure_dir(ids_path.parent)
    write_outputs(selected, ids_path, dbs_path)
    print(f"Selected {len(selected)} queries across {len(chosen_dbs)} DBs")

# Running main with our args
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Select Stage-1 eval set")
    parser.add_argument("--spider-root", required=True)
    parser.add_argument("--dev-path", required=True)
    parser.add_argument("--out-ids", required=True)
    parser.add_argument("--out-dbs", required=True)
    main(parser.parse_args())
