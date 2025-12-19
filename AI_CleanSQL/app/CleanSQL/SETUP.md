# CleanSQL Setup Guide

## Choose Your Platform

- **[Option 1: Google Colab Pro](#option-1-google-colab-pro-recommended)** - Recommended for demos (fast, easy)
- **[Option 2: M1/M2/M3 Mac](#option-2-m1m2m3-mac)** - For local development

---

## Option 1: Google Colab Pro (Recommended)

### Quick Reference: Execution Order

```
Cell 1: Install dependencies (2 min)
Cell 2: Mount Drive + set MODEL_PATH ⚠️ UPDATE THIS
Cell 3: Upload CleanSQL.zip
Cell 4: Setup ngrok ⚠️ UPDATE YOUR TOKEN
Cell 5: Start vLLM (60 sec - model loads)
Cell 6: Create ngrok tunnel + write .env with URL
Cell 7: ✅ VERIFY vLLM works (CHECK GPU USAGE!)
Cell 8: Start Streamlit + get public URL
```

**Critical Steps:**
- ⚠️ Update `MODEL_PATH` in Cell 2
- ⚠️ Update `NGROK_TOKEN` in Cell 4
- ✅ Cell 7 MUST show GPU usage >50% before continuing
- 🌐 Click the Streamlit URL from Cell 8 output

---

**Why Colab?**
- ✅ 3x faster than M1 Mac (T4 GPU, or A100 if available)
- ✅ No quantization needed (full FP16 model)
- ✅ Easy setup (15 minutes)
- ✅ Shareable URL for demos
- ✅ Only $10/month (Colab Pro) or $50/month (Colab Pro+ with A100)

**GPU Options:**
- **T4** (Colab Pro) - 16GB VRAM, good for demos
- **A100** (Colab Pro+) - 40GB VRAM, blazing fast (2-3x faster than T4)

### Prerequisites

1. **Google Colab Pro** - Sign up at https://colab.research.google.com/signup
2. **ngrok account** - Sign up at https://ngrok.com/ (free tier is fine)
3. **Your fine-tuned Qwen model** - Already in Google Drive folder with:
   - `*.safetensors` files (3-4 files, ~15GB total)
   - `config.json`
   - `tokenizer.json` or `tokenizer_config.json`
   - `tokenizer.model` (if present)
   - `special_tokens_map.json`
   - `*.jinja` template files

### Step 1: Get ngrok Auth Token

**Why ngrok?** Colab runs on Google's servers. ngrok creates a public URL so you can access the Streamlit UI from your browser.

1. Go to https://dashboard.ngrok.com/
2. Sign up (free)
3. Copy your auth token from the dashboard
4. Save it - you'll need it in Step 4

### Step 2: Note Your Model Path in Google Drive

Your model folder should be in Google Drive, for example:
- `/MyDrive/qwen-coder-finetuned/` (if in root of My Drive)
- `/MyDrive/models/qwen-coder-finetuned/` (if in a subfolder)

**Important:** Remember this path - you'll use it in Step 3.

### Step 3: Zip CleanSQL Folder

**On your computer:**
```bash
# Navigate to parent directory
cd /path/to/Progress1_RAG

# Create zip file (excludes cache and work files)
zip -r CleanSQL.zip CleanSQL/ -x "*.pyc" "*__pycache__*" "*work/*" "*.git*"

# This creates CleanSQL.zip (~2-3MB)
```

**Why zip?** Uploading one zip file is 10x faster than uploading hundreds of individual files.

### Step 4: Create Colab Notebook

1. Go to https://colab.research.google.com/
2. Click **File** → **New notebook**
3. Click **Runtime** → **Change runtime type** → Select **T4 GPU** (or **A100** if available) → **Save**

### Step 5: Copy-Paste This Complete Notebook

**Execution Sequence:**
1. Cell 1: Install dependencies (2 min)
2. Cell 2: Mount Drive + set MODEL_PATH (30 sec)
3. Cell 3: Upload CleanSQL.zip (30 sec)
4. Cell 4: Setup ngrok authentication (5 sec)
5. Cell 5: Start vLLM server (60 sec - model loads here)
6. Cell 6: Create ngrok tunnel + configure .env with URL (5 sec)
7. Cell 7: **VERIFY vLLM is working** (10 sec - CHECK GPU USAGE!)
8. Cell 8: Start Streamlit + get public URL (10 sec)

**Total time: ~4-5 minutes**

```python
# ============================================
# CleanSQL on Google Colab Pro
# ============================================

# Cell 1: Install dependencies (takes ~2 minutes)
print(" Installing dependencies...")
!pip install -q streamlit vllm qdrant-client FlagEmbedding sqlglot \
    pydantic-settings python-dotenv pandas openpyxl requests pyngrok
print("Dependencies installed!")

# Cell 2: Mount Google Drive and set model path
print(" Mounting Google Drive...")
from google.colab import drive
drive.mount('/content/drive')

# CHANGE THIS to your model's path in Google Drive
MODEL_PATH = "/content/drive/MyDrive/CleanSQL/Models/qwen2.5_cleansql_500"

# Verify model exists
import os
if os.path.exists(MODEL_PATH):
    print(f"Model found at: {MODEL_PATH}")
    # List model files
    files = os.listdir(MODEL_PATH)
    safetensors = [f for f in files if f.endswith('.safetensors')]
    print(f"   Found {len(safetensors)} safetensors files")
    if 'config.json' in files:
        print("  config.json found")
    if any('tokenizer' in f for f in files):
        print("  tokenizer files found")
else:
    print(f"ERROR: Model not found at {MODEL_PATH}")
    print(" Please check the path and update MODEL_PATH above")

# Cell 3: Upload CleanSQL (zipped for speed)
print("Uploading CleanSQL...")
from google.colab import files

# Upload CleanSQL.zip (much faster than uploading folder)
print("Please select CleanSQL.zip from your computer...")
uploaded = files.upload()

# Extract
!unzip -q CleanSQL.zip
%cd CleanSQL

print("CleanSQL ready!")

# Note: To create CleanSQL.zip on your computer:
# cd /path/to/Progress1_RAG
# zip -r CleanSQL.zip CleanSQL/ -x "*.pyc" "*__pycache__*" "*work/*"
# Then: %cd /content/CleanSQL

print("CleanSQL ready!")

# Cell 4: Setup ngrok authentication
print("🌐 Setting up ngrok...")
from pyngrok import ngrok

# REPLACE WITH YOUR NGROK TOKEN FROM https://dashboard.ngrok.com/
NGROK_TOKEN = "YOUR_NGROK_TOKEN_HERE"

ngrok.set_auth_token(NGROK_TOKEN)
ngrok.kill()  # Kill any existing tunnels
print("✅ ngrok is configured!")

# Cell 5: Start vLLM server (takes ~30-60 seconds)
print("🚀 Starting vLLM server...")
print("📦 Loading fine-tuned model from Google Drive...")
print("⏳ This will take around 30-60 seconds...")
import subprocess
import time

vllm_process = subprocess.Popen([
    "python", "-m", "vllm.entrypoints.openai.api_server",
    "--model", MODEL_PATH,
    "--host", "0.0.0.0",  # Bind to all interfaces for ngrok
    "--port", "8000",
    "--dtype", "auto",
    "--max-model-len", "4096",
    "--gpu-memory-utilization", "0.9",
    "--served-model-name", "qwen-coder"
], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

# Wait for vLLM to load model
time.sleep(60)
print("✅ vLLM server started on port 8000!")

# Cell 6: Create ngrok tunnel for vLLM and configure environment
print("🌐 Creating public tunnel for vLLM...")
vllm_public_url = ngrok.connect(8000)
vllm_url_str = str(vllm_public_url)

# Extract host from ngrok URL (remove https://)
vllm_host = vllm_url_str.replace("https://", "").replace("http://", "")

print(f"✅ vLLM is accessible at: {vllm_url_str}")
print(f"📋 vLLM Host: {vllm_host}")

# Configure environment with ngrok URL
print("⚙️ Configuring environment with ngrok URL...")
with open('.env', 'w') as f:
    f.write(f"""VLLM_HOST={vllm_host}
VLLM_PORT=443
VLLM_TIMEOUT=120.0
CLEANSQL_RAG_TOPK=3
CLEANSQL_ENABLE_RERANKER=false
CLEANSQL_EMBED_MODEL=BAAI/bge-m3
CLEANSQL_TEMP=0.2
CLEANSQL_SC_SAMPLES=3
""")
print("✅ Environment configured with ngrok URL!")

# Cell 7: Verify vLLM is working (IMPORTANT!)
print("🔍 Verifying vLLM server health...")
import requests
import json

try:
    # Test local health endpoint
    health_response = requests.get("http://localhost:8000/health", timeout=5)
    print(f"✅ Health check: {health_response.status_code}")
    
    # Test models endpoint
    models_response = requests.get("http://localhost:8000/v1/models", timeout=5)
    if models_response.status_code == 200:
        models_data = models_response.json()
        print(f"✅ Models endpoint: {models_data}")
    
    # Test a simple completion
    test_payload = {
        "model": "qwen-coder",
        "messages": [{"role": "user", "content": "Say 'Hello'"}],
        "max_tokens": 10
    }
    completion_response = requests.post(
        "http://localhost:8000/v1/chat/completions",
        json=test_payload,
        timeout=30
    )
    if completion_response.status_code == 200:
        result = completion_response.json()
        content = result['choices'][0]['message']['content']
        print(f"✅ Test completion successful: '{content}'")
    else:
        print(f"⚠️ Completion test failed: {completion_response.status_code}")
        print(f"   Response: {completion_response.text}")
    
    # Check GPU usage
    print("\n📊 GPU Status:")
    !nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv
    
except Exception as e:
    print(f"❌ vLLM verification failed: {e}")
    print("⚠️ vLLM may not be ready yet. Wait 30 more seconds and re-run this cell.")

# Cell 8: Start Streamlit app (takes ~5 seconds)
print("\n🎨 Starting Streamlit app...")
streamlit_process = subprocess.Popen([
    "streamlit", "run", "app_new.py",
    "--server.port", "8501",
    "--server.headless", "true"
], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

time.sleep(5)

# Create public URL for Streamlit
streamlit_public_url = ngrok.connect(8501)
print("\n" + "="*60)
print("🎉 CleanSQL is running!")
print("="*60)
print(f"\n🌐 Access your app here:\n   {streamlit_public_url}\n")
print(f"🔧 vLLM endpoint:\n   {vllm_url_str}\n")
print("="*60)
print("\n📊 Upload a CSV and start asking questions!")
print("⏰ Session will run for up to 12 hours")
print("💡 Keep this tab open to prevent timeout\n")
```

### Step 6: Run the Notebook

1. **Update Cell 2:** Change `MODEL_PATH` to your actual Google Drive path
2. **Update Cell 4:** Replace `YOUR_NGROK_TOKEN_HERE` with your ngrok token from https://dashboard.ngrok.com/
3. **Run Cells 1-6:** Runtime → Run all (or Shift+Enter through each cell)
4. **When Cell 3 runs:** Click "Choose Files" and select CleanSQL.zip
5. **Wait for vLLM to load:** Cell 5 takes 30-60 seconds (model loading from Google Drive)
6. **IMPORTANT - Run Cell 7:** This verifies vLLM is working correctly
   - ✅ Should show: Health check OK, test completion successful, GPU usage >50%
   - ❌ If failed: Wait 30 seconds and re-run Cell 7
   - Check GPU usage - should be high (70-90%)
7. **Run Cell 8:** Starts Streamlit and creates public URLs
   - Streamlit UI: `https://abc123.ngrok-free.app` (click this to use the app)
   - vLLM endpoint: `https://xyz456.ngrok-free.app` (backend, auto-configured in .env)
8. **Click the Streamlit URL:** Opens CleanSQL in new tab
9. **Upload CSV and ask questions!**

**Troubleshooting:**
- If Cell 7 fails, vLLM is not ready yet - wait and re-run
- If GPU usage is 0%, model didn't load - check MODEL_PATH in Cell 2
- If health check fails, restart runtime and try again

---

### Important: How the ngrok Connection Works

**The Setup:**
1. **On Colab:** vLLM runs at `localhost:8000` (inside Colab VM)
2. **Cell 6 creates ngrok tunnel:** `https://xyz456.ngrok-free.app` → `localhost:8000`
3. **Cell 6 writes .env:** Sets `VLLM_HOST=xyz456.ngrok-free.app` and `VLLM_PORT=443`
4. **Cell 8 starts Streamlit:** Reads .env and connects to `https://xyz456.ngrok-free.app`
5. **Your browser:** Accesses Streamlit at another ngrok URL

**The vLLM client auto-detects the connection type:**
- Local setup: `http://127.0.0.1:8000` (for M1 Mac)
- Colab setup: `https://xyz456.ngrok-free.app` (auto-detects from port 443 or "ngrok" in hostname)

**No manual configuration needed!** The .env is automatically written with the correct ngrok URL in Cell 6.

---

### Usage

1. **Upload CSV/Excel** - Click "Choose a CSV or Excel file"
2. **Wait for profiling** - Takes 5-10 seconds
3. **Ask question** - Type natural language query
4. **Get SQL** - See PLAN, BASIC_SQL, ROBUST_SQL, and quality notes
5. **Copy SQL** - Use in your database

### Performance

- CSV profiling: 1-2 seconds
- Single SQL generation: 2-3 seconds
- Self-consistency (3 samples): 6-9 seconds

### Tips

**Keep session alive:**
- Keep browser tab open
- Interact with app every 30 minutes
- Session lasts up to 12 hours

**Share with others:**
- ngrok URL is public
- Anyone can access during your session
- Great for demos!

**Reconnect after timeout:**
- Re-run all cells
- Takes ~2 minutes (model already in Drive)

---

## Option 2: M1/M2/M3 Mac

**Why M1 Mac?**
- ✅ Free (no Colab Pro subscription)
- ✅ Works offline
- ✅ Unlimited session time
- ⚠️ 3x slower than Colab
- ⚠️ Requires quantization (Q4)

### Prerequisites

1. **M1/M2/M3 Mac** with 16GB+ RAM
2. **Homebrew** - Install from https://brew.sh/
3. **Your fine-tuned Qwen model** (15GB safetensors)

### Step 1: Install llama.cpp

**What is llama.cpp?** Runs LLMs on Mac with Metal GPU acceleration.

```bash
# Install llama.cpp via Homebrew
brew install llama.cpp

# Verify installation
llama-server --version
```

### Step 2: Convert Model to GGUF

**What is GGUF?** llama.cpp's model format (like safetensors but for llama.cpp).

```bash
# Clone llama.cpp repo (for conversion script)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Install Python dependencies
pip install -r requirements.txt

# Convert your Qwen model to GGUF
python convert-hf-to-gguf.py \
    /path/to/your/qwen-coder-finetuned \
    --outfile qwen-coder.gguf \
    --outtype f16

# This creates qwen-coder.gguf (~15GB)
```

### Step 3: Quantize Model (15GB → 4GB)

**What is quantization?** Compresses model to fit in 16GB RAM.

```bash
# Quantize to Q4_K_M (recommended for 16GB RAM)
./llama-quantize \
    qwen-coder.gguf \
    qwen-coder-q4.gguf \
    Q4_K_M

# This creates qwen-coder-q4.gguf (~4GB)
# Quality: 97.5% of original (good enough!)
```

**Quantization options:**
- `Q4_K_M` - 4GB, 97.5% quality (recommended)
- `Q5_K_M` - 5GB, 99% quality (if you have RAM to spare)
- `Q6_K` - 6GB, 99.5% quality (tight on 16GB)

### Step 4: Install CleanSQL Dependencies

```bash
cd /path/to/CleanSQL

# Install Python dependencies
pip install -r requirements_new.txt
```

### Step 5: Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit .env (use any text editor)
nano .env
```

Set these values:
```bash
VLLM_HOST=127.0.0.1
VLLM_PORT=8000
CLEANSQL_RAG_TOPK=3
CLEANSQL_SC_SAMPLES=3
```

### Step 6: Start llama.cpp Server

**Terminal 1:**
```bash
# Start llama.cpp server with Metal GPU acceleration
llama-server \
    --model /path/to/qwen-coder-q4.gguf \
    --host 127.0.0.1 \
    --port 8000 \
    --ctx-size 4096 \
    --n-gpu-layers 99 \
    --threads 8 \
    --chat-template chatml

# Server starts at http://127.0.0.1:8000
# Keep this terminal open!
```

**What each flag means:**
- `--model` - Path to your quantized model
- `--host` - Server address (localhost)
- `--port` - Server port (8000)
- `--ctx-size` - Context window (4096 tokens)
- `--n-gpu-layers 99` - Use Metal GPU (M1 Pro)
- `--threads 8` - Use CPU cores
- `--chat-template chatml` - Qwen uses ChatML format

### Step 7: Start Streamlit App

**Terminal 2:**
```bash
cd /path/to/CleanSQL

# Start Streamlit
streamlit run app_new.py

# Opens browser at http://localhost:8501
```

### Usage

1. **Upload CSV/Excel** - Click "Choose a CSV or Excel file"
2. **Wait for profiling** - Takes 5-10 seconds
3. **Ask question** - Type natural language query
4. **Get SQL** - See PLAN, BASIC_SQL, ROBUST_SQL, and quality notes
5. **Copy SQL** - Use in your database

### Performance

- CSV profiling: 1-3 seconds
- Single SQL generation: 5-10 seconds
- Self-consistency (3 samples): 15-30 seconds

### Memory Usage (16GB RAM)

- macOS: ~4GB
- Qwen Q4: ~4GB
- Embeddings: ~1GB
- Qdrant: ~500MB
- Streamlit: ~500MB
- **Total: ~10GB** (6GB buffer)

### Tips

**If running out of memory:**
```bash
# Use smaller quantization
./llama-quantize qwen-coder.gguf qwen-coder-q4-s.gguf Q4_K_S

# Or reduce context window
llama-server --model qwen-coder-q4.gguf --ctx-size 2048
```

**Speed up generation:**
```bash
# Reduce self-consistency samples (in .env)
CLEANSQL_SC_SAMPLES=1  # Single shot instead of 3
```

---

## Troubleshooting

### Colab Issues

**"GPU not available"**
```python
# Check GPU
!nvidia-smi

# If no GPU: Runtime → Change runtime type → T4 GPU
```

**"vLLM server not starting"**
```python
# Check vLLM logs
!tail -f /tmp/vllm.log

# Reduce memory usage
--gpu-memory-utilization 0.8
```

**"ngrok tunnel failed"**
```python
# Verify auth token is correct
# Get new token from https://dashboard.ngrok.com/
ngrok.set_auth_token("NEW_TOKEN")
```

### M1 Mac Issues

**"Metal not found"**
```bash
# Check Metal support
system_profiler SPDisplaysDataType | grep Metal
# Should show: Metal: Supported
```

**"Out of memory"**
```bash
# Use smaller quantization
./llama-quantize qwen-coder.gguf qwen-coder-q4-s.gguf Q4_K_S

# Or reduce context
llama-server --model qwen-coder-q4.gguf --ctx-size 2048
```

**"Server not responding"**
```bash
# Check if server is running
curl http://127.0.0.1:8000/v1/models

# Should return JSON with model info
```

---

## Creating CleanSQL.zip

**On your computer (before running Colab):**

```bash
# Navigate to parent directory
cd /path/to/Progress1_RAG

# Create zip file (excludes cache and work files)
zip -r CleanSQL.zip CleanSQL/ -x "*.pyc" "*__pycache__*" "*work/*" "*.git*"

# Result: CleanSQL.zip (~2-3MB)
```

**Why zip?** Uploading one zip file takes ~10 seconds vs 5+ minutes for individual files.

---

## Summary

### Colab Pro (Recommended for Demos)
```
1. Zip CleanSQL folder on your computer
2. Upload model to Google Drive (one-time)
3. Run Colab notebook (8 cells):
   - Cells 1-6: Setup and start vLLM
   - Cell 7: VERIFY vLLM is working (check GPU!)
   - Cell 8: Start Streamlit
4. Upload CleanSQL.zip when prompted (Cell 3)
5. Click Streamlit ngrok URL from Cell 8
6. Upload CSV and ask questions
Total time: ~4-5 minutes
```

### M1 Mac (For Development)
```
1. Install llama.cpp
2. Convert model to GGUF
3. Quantize to Q4
4. Start llama.cpp server
5. Start Streamlit app
Total time: ~30 minutes
```

**Need help?** Check the troubleshooting section above.
