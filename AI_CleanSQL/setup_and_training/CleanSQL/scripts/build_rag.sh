#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DATA_DIR=${DATA_DIR:-"$ROOT_DIR/data"}
PROFILE_DIR=${PROFILE_DIR:-"$DATA_DIR/profiles"}
DB_LIST=${DB_LIST:-"$DATA_DIR/stage1_dbs.txt"}
INDEX_DIR=${INDEX_DIR:-"$ROOT_DIR/work/qdrant_index"}

if [[ ! -f "$DB_LIST" ]]; then
  echo "Missing DB list at $DB_LIST. Run scripts/select_stage1.sh first." >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"
mkdir -p "$INDEX_DIR"

# First profiling our spider dbs
python -m cleansql.profiling.spider_profile \
  --db-list "$DB_LIST" \
  --spider-root "$DATA_DIR/spider_databases" \
  --out-dir "$PROFILE_DIR"

# Then building our RAG index using those db profiles
python -m cleansql.rag.build_index \
  --profiles "$PROFILE_DIR" \
  --index-dir "$INDEX_DIR" \
  --collection-prefix cleansql_stage1
