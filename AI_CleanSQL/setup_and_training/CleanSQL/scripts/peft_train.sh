#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DATA_DIR=${DATA_DIR:-"$ROOT_DIR/data"}
OUTPUT_DIR=${OUTPUT_DIR:-"$ROOT_DIR/work/qwen2.5_cleansql_lora"}
mkdir -p "$OUTPUT_DIR"

python -m cleansql.llm.peft_trainer \
  --train-file "$DATA_DIR/cleansql_sft_train.jsonl" \
  --val-file "$DATA_DIR/cleansql_sft_val.jsonl" \
  --output-dir "$OUTPUT_DIR" \
  --base-model ${MODEL_NAME:-Qwen/Qwen2.5-Coder-7B-Instruct} \
  --lora-r 8 \
  --lora-alpha 16 \
  --lora-dropout 0.05 \
  --learning-rate 5e-5 \
  --num-train-epochs 3 \
  --per-device-train-batch-size 1 \
  --gradient-accumulation-steps 64 \
  --max-length 2048
