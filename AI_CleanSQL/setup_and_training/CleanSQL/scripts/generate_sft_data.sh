#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DATA_DIR=${DATA_DIR:-"$ROOT_DIR/data"}
WORK_DIR=${WORK_DIR:-"$ROOT_DIR/work"}

# Generate training data from Stage 2 results
python -m cleansql.llm.generate_sft_data \
  --mode from_results \
  --output "$DATA_DIR/cleansql_sft_train.jsonl" \
  --profile-dir "$DATA_DIR/profiles" \
  --index-dir "$WORK_DIR/qdrant_index" \
  --stage2-results "$ROOT_DIR/results/stage2_rag_k5_sc.csv" \
  --stage2-ids "$DATA_DIR/stage2_ids.jsonl" \
  --max-examples 500

# Split into train/val (80/20)
python -c "
import json
import random
from pathlib import Path

train_file = Path('$DATA_DIR/cleansql_sft_train.jsonl')
val_file = Path('$DATA_DIR/cleansql_sft_val.jsonl')

examples = []
with train_file.open() as f:
    for line in f:
        if line.strip():
            examples.append(json.loads(line))

random.seed(42)
random.shuffle(examples)

split_idx = int(len(examples) * 0.8)
train_examples = examples[:split_idx]
val_examples = examples[split_idx:]

with train_file.open('w') as f:
    for ex in train_examples:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')

with val_file.open('w') as f:
    for ex in val_examples:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')

print(f'Split {len(examples)} examples: {len(train_examples)} train, {len(val_examples)} val')
"

