"""
redeployer.py — Merge LoRA adapter into base model, push to HF Hub, and
update the HF Inference Endpoint to the new revision.

Expects RunPod to have saved the LoRA adapter to:
  /workspace/dpo_adapter/   (on RunPod pod)

We receive the adapter by downloading it from a pre-configured HF Hub
adapter repo (autobot298/autobot-reasoner-dpo-adapter).

Flow:
  1. Download adapter from HF Hub (adapter repo)
  2. Load base merged model + adapter with PEFT
  3. Merge and unload → pure merged model
  4. Push merged model as a new revision of the production model repo
  5. PATCH the HF Inference Endpoint to use the new revision
"""
import os
import sys
import json
import subprocess
import requests
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"), override=True)

HF_TOKEN              = os.getenv("HF_TOKEN")
HF_ENDPOINT_NAME      = os.getenv("HF_ENDPOINT_NAME")        # e.g. "autobot-reasoner"
HF_ENDPOINT_NAMESPACE = os.getenv("HF_ENDPOINT_NAMESPACE", "autobot298")
PRODUCTION_MODEL_REPO = os.getenv("PRODUCTION_MODEL_REPO")   # e.g. "autobot298/autobot-reasoner-7b"
ADAPTER_REPO          = os.getenv("ADAPTER_REPO", "autobot298/autobot-reasoner-dpo-adapter")

HF_API_BASE = "https://api.endpoints.huggingface.cloud/v2"
HF_HEADERS  = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Content-Type": "application/json",
}


def get_current_endpoint_revision() -> str | None:
    """Fetch current model revision deployed on the endpoint."""
    url  = f"{HF_API_BASE}/endpoint/{HF_ENDPOINT_NAMESPACE}/{HF_ENDPOINT_NAME}"
    resp = requests.get(url, headers=HF_HEADERS)
    if resp.ok:
        data = resp.json()
        return data.get("model", {}).get("revision")
    print(f"[Redeployer] Could not fetch endpoint info: {resp.status_code} {resp.text[:200]}")
    return None


def update_endpoint_revision(new_revision: str) -> bool:
    """PATCH the HF Inference Endpoint to use a new model revision."""
    url  = f"{HF_API_BASE}/endpoint/{HF_ENDPOINT_NAMESPACE}/{HF_ENDPOINT_NAME}"
    body = {"model": {"repository": PRODUCTION_MODEL_REPO, "revision": new_revision}}
    resp = requests.patch(url, headers=HF_HEADERS, json=body)
    if resp.ok:
        print(f"[Redeployer] ✅ Endpoint updated to revision: {new_revision}")
        return True
    print(f"[Redeployer] ❌ Failed to update endpoint: {resp.status_code} {resp.text[:300]}")
    return False


def merge_and_push(adapter_local_path: str, new_revision_tag: str) -> bool:
    """
    Load base model + LoRA adapter, merge, push to HF Hub.
    This runs locally or on RunPod — requires GPU RAM.
    """
    try:
        import torch
        from peft import PeftModel, PeftConfig
        from transformers import AutoModelForCausalLM, AutoTokenizer

        print(f"[Redeployer] Loading adapter config from {adapter_local_path}...")
        config     = PeftConfig.from_pretrained(adapter_local_path)
        base_model = config.base_model_name_or_path

        print(f"[Redeployer] Loading base model: {base_model}")
        tokenizer = AutoTokenizer.from_pretrained(base_model, token=HF_TOKEN)
        model     = AutoModelForCausalLM.from_pretrained(
            base_model,
            torch_dtype=torch.float16,
            device_map="auto",
            token=HF_TOKEN,
        )

        print("[Redeployer] Applying LoRA adapter...")
        model = PeftModel.from_pretrained(model, adapter_local_path)

        print("[Redeployer] Merging and unloading adapter...")
        model = model.merge_and_unload()

        print(f"[Redeployer] Pushing merged model to {PRODUCTION_MODEL_REPO} as revision {new_revision_tag}...")
        model.push_to_hub(
            PRODUCTION_MODEL_REPO,
            commit_message=f"DPO retrained model — {new_revision_tag}",
            token=HF_TOKEN,
            revision=new_revision_tag,
        )
        tokenizer.push_to_hub(
            PRODUCTION_MODEL_REPO,
            commit_message=f"DPO retrained tokenizer — {new_revision_tag}",
            token=HF_TOKEN,
            revision=new_revision_tag,
        )
        print(f"[Redeployer] ✅ Model pushed as revision '{new_revision_tag}'")
        return True

    except Exception as e:
        print(f"[Redeployer] ❌ Merge/push failed: {e}")
        return False


def run_redeployer(adapter_local_path: str = None) -> dict:
    """
    Full redeployment flow.
    If adapter_local_path is None, downloads from ADAPTER_REPO on HF Hub.
    """
    new_revision = f"dpo-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"

    # Download adapter from HF Hub if not provided locally
    if adapter_local_path is None:
        adapter_local_path = "/tmp/dpo_adapter"
        print(f"[Redeployer] Downloading adapter from {ADAPTER_REPO}...")
        from huggingface_hub import snapshot_download
        snapshot_download(
            repo_id=ADAPTER_REPO,
            local_dir=adapter_local_path,
            token=HF_TOKEN,
        )
        print(f"[Redeployer] Adapter downloaded to {adapter_local_path}")

    # Merge + push
    merge_ok = merge_and_push(adapter_local_path, new_revision)
    if not merge_ok:
        return {"success": False, "error": "Merge or push failed"}

    # Update HF endpoint
    deploy_ok = update_endpoint_revision(new_revision)
    if not deploy_ok:
        return {"success": False, "error": "Endpoint update failed", "revision": new_revision}

    return {"success": True, "new_revision": new_revision}


if __name__ == "__main__":
    result = run_redeployer()
    print(f"\n{'='*60}")
    print(f"Redeployment result: {json.dumps(result, indent=2)}")
