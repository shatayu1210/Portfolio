# AutoBot Slackbot — Operations Guide

This guide covers the platform setup, data generation, and operational commands for the AutoBot RLHF (Reinforcement Learning from Human Feedback) pipeline.

---

## Services Running

| Service | Command | Port | Purpose |
|---|---|---|---|
| Slack Orchestrator | `uvicorn slack_orchestrator:app --reload --port 8000` | 8000 | Main bot — polling, adhoc, feedback buttons |
| RLHF Orchestrator | `uvicorn rlhf.rlhf_orchestrator:app --reload --port 8001` | 8001 | Retraining pipeline |

---

## Part 1: Platform Setup (First Time Only)

### 1A. HuggingFace Hub — Create Private Repos

You need 2 new private repos under the `autobot298` org. Your `HF_TOKEN` in `.env` already has write access.

**Option A — Via Python (recommended):**
```bash
cd autobot_dev && source slackbot/.venv/bin/activate
python - <<'EOF'
from huggingface_hub import HfApi
api = HfApi()
# Feedback dataset repo
api.create_repo("autobot298/autobot-feedback", repo_type="dataset", private=True, exist_ok=True)
# Adapter model repo
api.create_repo("autobot298/autobot-reasoner-dpo-adapter", repo_type="model", private=True, exist_ok=True)
print("✅ Both repos created")
EOF
```

**Option B — Via HF Website:**
1. Go to [huggingface.co/new-dataset](https://huggingface.co/new-dataset)
   - Owner: `autobot298`
   - Name: `autobot-feedback`
   - Visibility: Private
   - Click Create
2. Go to [huggingface.co/new](https://huggingface.co/new)
   - Owner: `autobot298`
   - Name: `autobot-reasoner-dpo-adapter`
   - Visibility: Private
   - Click Create

---

### 1B. RunPod — Create Serverless Endpoint

> RunPod serverless runs your training Docker image on a GPU on demand.
> You pay only while training runs (~$0.50–1.20 per run on A100).

**Step 1 — Create account and add credits:**
1. Go to [runpod.io](https://runpod.io) → Sign Up
2. Go to **Billing** → Add **$5** (minimum)

**Step 2 — Build and push the training Docker image:**

First, create the Dockerfile at `slackbot/rlhf/Dockerfile.runpod`:

```dockerfile
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /workspace

# Install dependencies
RUN pip install --no-cache-dir \
    trl>=0.8.6 \
    peft>=0.10.0 \
    bitsandbytes>=0.43.0 \
    transformers>=4.40.0 \
    datasets>=2.18.0 \
    huggingface_hub>=0.22.0 \
    accelerate>=0.29.0 \
    runpod

# Copy training script
COPY dpo_train_job.py /workspace/dpo_train_job.py

CMD ["python", "-u", "/workspace/dpo_train_job.py"]
```

**Step 3 — Push the image to Docker Hub:**
```bash
cd slackbot/rlhf
docker build -f Dockerfile.runpod -t YOUR_DOCKERHUB_USERNAME/autobot-dpo-trainer:latest .
docker push YOUR_DOCKERHUB_USERNAME/autobot-dpo-trainer:latest
```

**Step 4 — Create Serverless Endpoint on RunPod:**
1. Go to [runpod.io/console/serverless](https://runpod.io/console/serverless)
2. Click **+ New Endpoint**
3. Fill in:
   - **Name:** `autobot-dpo-trainer`
   - **Container Image:** `YOUR_DOCKERHUB_USERNAME/autobot-dpo-trainer:latest`
   - **GPU:** A100 SXM (80GB) or RTX 4090 (spot, cheaper)
   - **Max Workers:** 1
   - **Idle Timeout:** 5 seconds (so it shuts off instantly after job)
4. Click **Deploy**
5. Copy the **Endpoint ID** (looks like `abc123xyz`) and your **API Key** from Account Settings

**Step 5 — Add to `.env`:**
```
RUNPOD_API_KEY=your_api_key_here
RUNPOD_ENDPOINT_ID=your_endpoint_id_here
```

---

### 1C. HF Inference Endpoint Name

Find your exact endpoint name:
1. Go to [huggingface.co/inference-endpoints](https://ui.endpoints.huggingface.co/autobot298/endpoints)
2. Click your Reasoner endpoint
3. Copy the **name** shown at the top (e.g. `autobot-reasoner`)
4. Add to `.env`:
```
HF_ENDPOINT_NAME=autobot-reasoner
HF_ENDPOINT_NAMESPACE=autobot298
```

---

## Part 2: Generate Seed Data (One-Time)

> These scripts are gitignored — run them locally only.

**Activate venv first:**
```bash
cd /Users/shatayu/Desktop/FALL24/SPRING26/298B/WB2/autobot_dev
source slackbot/.venv/bin/activate
cd slackbot
```

**Step 1 — Generate 20 synthetic bad responses and push to HF Dataset:**
```bash
python rlhf/generate_synthetic_feedback.py
```
Expected output:
```
Loading demo set...
Generating 20 synthetic bad feedback records...
  [1/20] #66328: Gradle Extension for Java SDK...
  [FeedbackStore] ✅ Pushed feedback for #66328 (negative)
  ...
✅ Done: pushed 20/20 synthetic feedback records.
```

**Step 2 — Generate 5 gold reference responses (for eval):**
```bash
python rlhf/generate_gold_set.py
```
Expected output:
```
Found 5 gold issues: [66374, 66483, 66328, 66511, 65382]
  [1/5] #66374: Race condition...
    Reference: This issue, open for 2 days without any assignee...
✅ Gold set saved to rlhf/gold_set.json (5 items)
```

---

## Part 3: Local Test Run (Validate Everything Before Render)

### 3A. Test Labeling Standalone
```bash
python rlhf/labeler.py
```
Expected: GPT-4o generates chosen responses, marks records labeled in HF Dataset.

### 3B. Test Eval Standalone
```bash
python rlhf/eval_runner.py
```
Expected: Calls your HF Reasoner endpoint, GPT-4o judges, shows score/5.

### 3C. Start RLHF Orchestrator Locally
```bash
uvicorn rlhf.rlhf_orchestrator:app --reload --port 8001
```

### 3D. Trigger Full Pipeline On-Demand
```bash
# Trigger full pipeline
curl -X POST http://localhost:8001/rlhf/run
# {"status": "full RLHF pipeline started", ...}

# Check status (poll this while running)
curl http://localhost:8001/rlhf/status

# List run logs
curl http://localhost:8001/rlhf/logs

# View a specific run log (replace <run_id> with name from /rlhf/logs)
curl http://localhost:8001/rlhf/logs/<run_id>
```

### 3E. Trigger Individual Steps
```bash
# Run labeling only
curl -X POST http://localhost:8001/rlhf/label

# Check dataset stats
curl http://localhost:8001/rlhf/status

# Trigger training only (if labeling already done)
curl -X POST http://localhost:8001/rlhf/train

# Run eval only
curl -X POST http://localhost:8001/rlhf/eval

# Deploy only (if eval already passed)
curl -X POST http://localhost:8001/rlhf/deploy
```

---

## Part 4: Log Files

All run logs are written to `slackbot/rlhf/logs/`.

| File | Contents |
|---|---|
| `20260507-120000-on-demand.log` | Full pipeline run triggered via API |
| `20260507-020000-weekly-wednesday.log` | Weekly scheduled run |
| `20260507-120000-label.log` | Labeling-only run |
| `20260507-120000-eval.log` | Eval-only run |

**View latest log locally:**
```bash
ls -lt slackbot/rlhf/logs/ | head -5
cat slackbot/rlhf/logs/<latest>.log
```

---

## Part 5: Production Deployment & Telemetry
If you are transitioning this pipeline to a production cloud environment, please refer to the following guides:
- [Deployment Guide](deployment.md) — Includes instructions for bundling the critical `eval_gold_set.json` file for the LLM Judge.
- [Telemetry Guide](telemetry.md) — How to wire the Slack bot and orchestrators to Loki, Prometheus, Grafana, and LangSmith.

---

## Part 6: Feedback Loop (Live Demo)

When the Slack bot sends a HIGH severity notification, each message has two buttons:
- **✅ Helpful** — logged to HF Dataset as positive signal
- **👎 Not Helpful** — logged to HF Dataset as a DPO training pair

The pipeline automatically triggers every **Wednesday at 02:00 UTC**.
