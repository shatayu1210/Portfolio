#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
RESULT_DIR=${RESULT_DIR:-"$ROOT_DIR/results"}
DATA_DIR=${DATA_DIR:-"$ROOT_DIR/data"}
mkdir -p "$RESULT_DIR"

# Optional first argument: run only a single technique (baseline|fewshot|cot|sc|tot).
TECHNIQUE="${1:-cot}"

python -m cleansql.eval.run_stage2 \
  --context schema_only \
  --technique "$TECHNIQUE" \
  --ids "$DATA_DIR/stage2_ids.jsonl" \
  --db-root "$ROOT_DIR/work/corrupted_databases" \
  --clean-db-root "$DATA_DIR/spider_databases" \
  --profile-dir "$DATA_DIR/profiles" \
  --out "$RESULT_DIR/stage2_schema_only_${TECHNIQUE}.csv"

python -m cleansql.eval.run_stage2 \
  --context rag_topk3 \
  --technique "$TECHNIQUE" \
  --ids "$DATA_DIR/stage2_ids.jsonl" \
  --db-root "$ROOT_DIR/work/corrupted_databases" \
  --clean-db-root "$DATA_DIR/spider_databases" \
  --index-dir "$ROOT_DIR/work/qdrant_index" \
  --profile-dir "$DATA_DIR/profiles" \
  --out "$RESULT_DIR/stage2_rag_k3_${TECHNIQUE}.csv"

python -m cleansql.eval.run_stage2 \
  --context rag_topk5 \
  --technique "$TECHNIQUE" \
  --ids "$DATA_DIR/stage2_ids.jsonl" \
  --db-root "$ROOT_DIR/work/corrupted_databases" \
  --clean-db-root "$DATA_DIR/spider_databases" \
  --index-dir "$ROOT_DIR/work/qdrant_index" \
  --profile-dir "$DATA_DIR/profiles" \
  --out "$RESULT_DIR/stage2_rag_k5_${TECHNIQUE}.csv"

python -m cleansql.eval.run_stage2 \
  --context rag_topk8_rerank \
  --technique "$TECHNIQUE" \
  --ids "$DATA_DIR/stage2_ids.jsonl" \
  --db-root "$ROOT_DIR/work/corrupted_databases" \
  --clean-db-root "$DATA_DIR/spider_databases" \
  --index-dir "$ROOT_DIR/work/qdrant_index" \
  --profile-dir "$DATA_DIR/profiles" \
  --out "$RESULT_DIR/stage2_rag_k8r_${TECHNIQUE}.csv"

# Optionally aggregate Stage-2 only into summary tables
python -m cleansql.eval.aggregate \
  --stage2_glob "$RESULT_DIR/stage2_*_${TECHNIQUE}.csv" \
  --out_dir "$RESULT_DIR"
