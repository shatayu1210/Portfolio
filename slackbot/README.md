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

### 1A. HuggingFace Hub — Repos
Ensure these repos exist under the `autobot298` org:
- Dataset: `autobot298/autobot-feedback` (**Public** recommended for live Viewer)
- Model: `autobot298/autobot-reasoner-dpo-adapter` (Private)

### 1B. RunPod — Create Serverless Endpoint (No Docker Needed)

> We use the official RunPod image and pull the training script from a GitHub Gist at startup.

**Step 1 — Create a Secret Gist:**
1. Go to [gist.github.com](https://gist.github.com).
2. Paste the contents of `slackbot/rlhf/dpo_train_job.py`.
3. Click **Create secret gist**.
4. Click the **Raw** button and copy the URL (starts with `gist.githubusercontent.com`).

**Step 2 — Configure RunPod Serverless:**
1. Go to [RunPod Console](https://www.runpod.io/console/serverless) → **+ New Endpoint**.
2. Select **Custom Deployment** → **Deploy from Docker registry or a template**.
3. Fill in:
   - **Endpoint name:** `autobot-dpo-retrainer`
   - **GPU Configuration:** **48 GB** (A100 or 4090)
   - **Container image:** `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04`
   - **Container start command:** 
     ```bash
     bash -c "curl -sL <YOUR_GIST_RAW_URL> > /handler.py && python -u /handler.py"
     ```
   - **Container Disk:** **30 GB**
4. Click **Deploy**.

**Step 3 — Add to `.env`:**
1. Copy the **Endpoint ID** (e.g., `abc123xyz`) from the RunPod dashboard.
2. Update your `.env`:
   ```env
   RUNPOD_API_KEY=your_runpod_api_key
   RUNPOD_ENDPOINT_ID=abc123xyz
   ```

---

### 1C. HF Inference Endpoint

Find your exact endpoint name for programmatic redeployment:
1. Go to [huggingface.co/inference-endpoints](https://ui.endpoints.huggingface.co/autobot298/endpoints)
2. Click your Reasoner endpoint.
3. Copy the **name** shown at the top (e.g. `autobot-reasoner-merged-nur`).
4. Update your `.env`:
   ```env
   HF_ENDPOINT_NAME=autobot-reasoner-merged-nur
   HF_ENDPOINT_NAMESPACE=autobot298
   ```

---

## Part 2: Generate Seed Data (One-Time)

> Run these locally to bootstrap the system with initial training/eval data.

**Activate venv first:**
```bash
cd slackbot && source .venv/bin/activate
```

**Step 1 — Generate synthetic "bad" responses:**
```bash
python rlhf/generate_synthetic_feedback.py
```

**Step 2 — Generate "Chosen" responses (Teacher Labeling):**
```bash
python rlhf/labeler.py
```

**Step 3 — Generate 5 gold reference responses (for eval):**
```bash
python rlhf/generate_gold_set.py
```

---

## Part 3: Running the RLHF Pipeline

### 3A. Start RLHF Orchestrator
```bash
uvicorn rlhf.rlhf_orchestrator:app --reload --port 8001
```

### 3B. Trigger Full Pipeline On-Demand
```bash
# Trigger label → train (RunPod) → eval → deploy
curl -X POST http://localhost:8001/rlhf/run
```

### 3C. Monitoring & Logs
Logs are saved per-run to `slackbot/rlhf/logs/`.

*   **List logs:** `curl http://localhost:8001/rlhf/logs`
*   **View log:** `curl http://localhost:8001/rlhf/logs/<run_id>`
*   **Pipeline Status:** `curl http://localhost:8001/rlhf/status`

---

## Part 4: Feedback Loop

When a HIGH severity notification is sent to Slack, use the buttons:
- **✅ Helpful** — positive signal.
- **👎 Not Helpful** — saves to training dataset for the next Wednesday cycle.

The pipeline automatically triggers every **Wednesday at 02:00 UTC**.

---

## Part 5: Production Deployment & Telemetry
If you are transitioning this pipeline to a production cloud environment, please refer to the following guides:
- [Deployment Guide](deployment.md) — Includes instructions for bundling the critical `eval_gold_set.json` file for the LLM Judge.
- [Telemetry Guide](telemetry.md) — How to wire the Slack bot and orchestrators to Loki, Prometheus, Grafana, and LangSmith.
