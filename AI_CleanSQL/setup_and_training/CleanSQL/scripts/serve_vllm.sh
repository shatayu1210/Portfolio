#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
MODEL_NAME=${MODEL_NAME:-Qwen/Qwen2.5-Coder-7B-Instruct}
HOST=${VLLM_HOST:-0.0.0.0}
PORT=${VLLM_PORT:-8000}
MAX_LEN=${VLLM_MAX_LEN:-8192}
TP_SIZE=${VLLM_TP_SIZE:-1}
DTYPE=${VLLM_DTYPE:-auto}
TRUST_REMOTE_CODE=${TRUST_REMOTE_CODE:-1}

export HF_HOME=${HF_HOME:-"$ROOT_DIR/.hf_cache"}
mkdir -p "$HF_HOME"

if [[ "${TRUST_REMOTE_CODE:-1}" == "1" || "${TRUST_REMOTE_CODE,,}" == "true" ]]; then
  TRUST_FLAG=(--trust-remote-code)
else
  TRUST_FLAG=(--no-trust-remote-code)
fi

# Use the OpenAI-compatible chat API server so we can call /v1/chat/completions
python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_NAME" \
  --tensor-parallel-size "$TP_SIZE" \
  --dtype "$DTYPE" \
  --swap-space 8 \
  --gpu-memory-utilization 0.92 \
  --max-num-batched-tokens 8192 \
  --max-model-len "$MAX_LEN" \
  --host "$HOST" \
  --port "$PORT" \
  --served-model-name qwen-coder \
  "${TRUST_FLAG[@]}"