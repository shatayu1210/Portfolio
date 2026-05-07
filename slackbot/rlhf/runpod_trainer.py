"""
runpod_trainer.py — Triggers and polls a RunPod serverless job for DPO training.

The RunPod endpoint runs dpo_train_job.py (deployed as a Docker image on RunPod).
This script:
  1. Submits the job with DPO dataset config
  2. Polls status every 30s
  3. Returns when job is COMPLETED or FAILED
"""
import os
import sys
import time
import json
import requests
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"), override=True)

RUNPOD_API_KEY        = os.getenv("RUNPOD_API_KEY")
RUNPOD_ENDPOINT_ID    = os.getenv("RUNPOD_ENDPOINT_ID")  # Your RunPod serverless endpoint ID
HF_TOKEN              = os.getenv("HF_TOKEN")
DATASET_REPO          = os.getenv("RLHF_DATASET_REPO", "autobot298/autobot-feedback")
PRODUCTION_MODEL_REPO = os.getenv("PRODUCTION_MODEL_REPO")
ADAPTER_REPO          = os.getenv("ADAPTER_REPO", "autobot298/autobot-reasoner-dpo-adapter")

RUNPOD_BASE = "https://api.runpod.ai/v2"


def submit_job(num_epochs: int = 3, max_steps: int = None) -> str | None:
    """Submit the DPO training job to RunPod. Returns job_id or None."""
    url     = f"{RUNPOD_BASE}/{RUNPOD_ENDPOINT_ID}/run"
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type":  "application/json",
    }
    payload = {
        "input": {
            "hf_token":        HF_TOKEN,
            "dataset_repo":    DATASET_REPO,
            "base_model_repo": PRODUCTION_MODEL_REPO,
            "adapter_repo":    ADAPTER_REPO,
            "num_epochs":      num_epochs,
            "max_steps":       max_steps,
        }
    }
    print(f"[RunPod] Submitting DPO training job to endpoint {RUNPOD_ENDPOINT_ID}...")
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    if resp.ok:
        job_id = resp.json().get("id")
        print(f"[RunPod] ✅ Job submitted: {job_id}")
        return job_id
    print(f"[RunPod] ❌ Submission failed: {resp.status_code} {resp.text[:300]}")
    return None


def poll_job(job_id: str, poll_interval: int = 30, timeout_mins: int = 120) -> dict:
    """Poll RunPod job until COMPLETED or FAILED. Returns final status dict."""
    url     = f"{RUNPOD_BASE}/{RUNPOD_ENDPOINT_ID}/status/{job_id}"
    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}

    deadline = time.time() + timeout_mins * 60
    print(f"[RunPod] Polling job {job_id} (timeout: {timeout_mins}min)...")

    while time.time() < deadline:
        resp = requests.get(url, headers=headers, timeout=15)
        if not resp.ok:
            print(f"[RunPod] Poll error: {resp.status_code} — retrying...")
            time.sleep(poll_interval)
            continue

        data   = resp.json()
        status = data.get("status", "UNKNOWN")
        print(f"  [{datetime.now().strftime('%H:%M:%S')}] Job status: {status}")

        if status == "COMPLETED":
            output = data.get("output", {})
            print(f"[RunPod] ✅ Training COMPLETED")
            print(f"  Adapter pushed to: {output.get('adapter_repo', ADAPTER_REPO)}")
            return {"success": True, "status": status, "output": output}

        if status in ("FAILED", "CANCELLED"):
            print(f"[RunPod] ❌ Job {status}: {data.get('error', 'unknown error')}")
            return {"success": False, "status": status, "error": data.get("error")}

        time.sleep(poll_interval)

    return {"success": False, "status": "TIMEOUT", "error": f"Job exceeded {timeout_mins}min timeout"}


def run_training(num_epochs: int = 3) -> dict:
    """Submit + poll. Returns result dict with success flag."""
    job_id = submit_job(num_epochs=num_epochs)
    if not job_id:
        return {"success": False, "error": "Job submission failed"}
    return poll_job(job_id)


if __name__ == "__main__":
    result = run_training()
    print(f"\n{'='*60}")
    print(f"Training result: {json.dumps(result, indent=2)}")
