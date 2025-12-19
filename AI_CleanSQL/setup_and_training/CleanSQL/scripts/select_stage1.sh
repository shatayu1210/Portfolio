#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DATA_DIR=${DATA_DIR:-"$ROOT_DIR/data"}
mkdir -p "$DATA_DIR"

python -m cleansql.eval.stage1_selector \
  --spider-root "$DATA_DIR/spider_databases" \
  --dev-path "$DATA_DIR/dev_gold.json" \
  --out-ids "$DATA_DIR/stage1_ids.jsonl" \
  --out-dbs "$DATA_DIR/stage1_dbs.txt"
