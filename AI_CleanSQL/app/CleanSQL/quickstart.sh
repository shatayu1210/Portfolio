#!/bin/bash
# CleanSQL v2.0 Quick Start Script

set -e

echo "========================================="
echo "CleanSQL v2.0 Quick Start"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  Please edit .env and set VLLM_MODEL_PATH to your fine-tuned Qwen model"
    echo ""
    read -p "Press Enter after updating .env file..."
fi

# Source .env
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if model path is set
if [ -z "$VLLM_MODEL_PATH" ] || [ "$VLLM_MODEL_PATH" = "/path/to/your/qwen-coder-finetuned" ]; then
    echo "❌ Error: VLLM_MODEL_PATH not set in .env"
    echo "Please edit .env and set the path to your fine-tuned Qwen model"
    exit 1
fi

# Check if model path exists
if [ ! -d "$VLLM_MODEL_PATH" ]; then
    echo "❌ Error: Model path not found: $VLLM_MODEL_PATH"
    echo "Please verify the path in .env"
    exit 1
fi

echo "✅ Model path found: $VLLM_MODEL_PATH"
echo ""

# Check if vLLM is installed
if ! python -c "import vllm" 2>/dev/null; then
    echo "⚠️  vLLM not installed. Installing..."
    pip install vllm>=0.5.0
    echo "✅ vLLM installed"
fi

# Check if other dependencies are installed
if ! python -c "import streamlit" 2>/dev/null; then
    echo "⚠️  Dependencies not installed. Installing..."
    pip install -r requirements_new.txt
    echo "✅ Dependencies installed"
fi

echo ""
echo "========================================="
echo "Starting CleanSQL v2.0"
echo "========================================="
echo ""

# Create work directory
mkdir -p work/qdrant_index

# Start vLLM server in background
echo "🚀 Starting vLLM server..."
echo "   Model: $VLLM_MODEL_PATH"
echo "   Host: ${VLLM_HOST:-127.0.0.1}"
echo "   Port: ${VLLM_PORT:-8000}"
echo ""

./scripts/serve_vllm.sh &
VLLM_PID=$!

# Wait for vLLM to start
echo "⏳ Waiting for vLLM server to start (this may take 1-2 minutes)..."
sleep 10

# Check if vLLM is running
if ! ps -p $VLLM_PID > /dev/null; then
    echo "❌ vLLM server failed to start. Check logs above."
    exit 1
fi

# Wait for HTTP endpoint
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s http://${VLLM_HOST:-127.0.0.1}:${VLLM_PORT:-8000}/health > /dev/null 2>&1; then
        echo "✅ vLLM server is ready!"
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo "   Still waiting... ($WAITED/$MAX_WAIT seconds)"
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "❌ vLLM server did not start in time"
    kill $VLLM_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "========================================="
echo "Starting Streamlit App"
echo "========================================="
echo ""

# Start Streamlit
streamlit run app_new.py

# Cleanup on exit
trap "echo ''; echo 'Shutting down...'; kill $VLLM_PID 2>/dev/null || true; exit" INT TERM EXIT
