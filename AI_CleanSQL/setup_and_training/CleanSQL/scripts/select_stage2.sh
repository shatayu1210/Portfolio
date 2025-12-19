#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DATA_DIR=${DATA_DIR:-"$ROOT_DIR/data"}
WORK_DIR=${WORK_DIR:-"$ROOT_DIR/work"}
mkdir -p "$DATA_DIR" "$WORK_DIR/corrupted_databases"

python -m cleansql.eval.stage2_selector \
  --spider-root "$DATA_DIR/spider_databases" \
  --dev-path "$DATA_DIR/dev_gold.json" \
  --stage1-dbs "$DATA_DIR/stage1_dbs.txt" \
  --out-ids "$DATA_DIR/stage2_ids.jsonl" \
  --out-dbs "$DATA_DIR/stage2_dbs.txt" \
  --corrupted-root "$WORK_DIR/corrupted_databases"
