#!/bin/bash
# Start vLLM server with fine-tuned Qwen model

# Set model path (update this to your fine-tuned model location)
MODEL_PATH="${VLLM_MODEL_PATH:-/path/to/your/qwen-coder-finetuned}"

# Check if model path exists
if [ ! -d "$MODEL_PATH" ]; then
    echo "Error: Model path not found: $MODEL_PATH"
    echo "Please set VLLM_MODEL_PATH environment variable or update this script"
    exit 1
fi

echo "Starting vLLM server with model: $MODEL_PATH"

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL_PATH" \
    --host 127.0.0.1 \
    --port 8000 \
    --dtype auto \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.9 \
    --served-model-name qwen-coder

echo "vLLM server started at http://127.0.0.1:8000"
