#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
RESULT_DIR=${RESULT_DIR:-"$ROOT_DIR/results"}
DATA_DIR=${DATA_DIR:-"$ROOT_DIR/data"}
mkdir -p "$RESULT_DIR"

# Optional first argument: run only a single technique (baseline|fewshot|cot|sc|tot).
if [[ "${1:-all}" != "all" ]]; then
  TECHS=("$1")
else
  TECHS=(baseline fewshot cot sc tot)
fi

for TECH in "${TECHS[@]}"; do
  OUT_CSV="$RESULT_DIR/stage1_${TECH}.csv"
  echo "Running Stage-1 technique: $TECH"
  python -m cleansql.eval.run_stage1 \
    --technique "$TECH" \
    --ids "$DATA_DIR/stage1_ids.jsonl" \
    --db-root "$DATA_DIR/spider_databases" \
    --index-dir "$ROOT_DIR/work/qdrant_index" \
    --profile-dir "$DATA_DIR/profiles" \
    --out "$OUT_CSV"
done

# Optionally aggregate Stage-1 only into summary tables
python -m cleansql.eval.aggregate \
  --stage1_glob "$RESULT_DIR/stage1_*.csv" \
  --out_dir "$RESULT_DIR"
