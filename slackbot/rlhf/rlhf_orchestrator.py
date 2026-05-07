"""
rlhf_orchestrator.py — FastAPI RLHF pipeline endpoints.

Exposes:
  GET  /rlhf/status         — dataset stats + current pipeline state
  POST /rlhf/label          — run GPT-4o teacher labeling on unlabeled feedback
  POST /rlhf/train          — trigger DPO training on RunPod
  POST /rlhf/eval           — run gold-set evaluation with LLM judge
  POST /rlhf/deploy         — merge adapter + redeploy HF endpoint
  POST /rlhf/run            — full pipeline: label → train → eval → deploy
  POST /rlhf/seed           — (dev only) seed synthetic feedback for testing

All heavy operations run as background tasks so Render doesn't time out.
Check Render logs for real-time output of each step.
"""
import os
import sys
import threading
from datetime import datetime, timezone

from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import JSONResponse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"), override=True)

from rlhf.feedback_store   import get_stats, get_dpo_pairs, mark_retrained
from rlhf.labeler          import run_labeler
from rlhf.runpod_trainer   import run_training
from rlhf.eval_runner      import run_eval
from rlhf.redeployer       import run_redeployer

app = FastAPI(
    title="AutoBot RLHF Orchestrator",
    description="On-demand and scheduled DPO retraining pipeline for the AutoBot Reasoner",
)

# ── Pipeline state (in-memory, resets on Render restart) ─────────────────────
_pipeline_state = {
    "status":       "idle",        # idle | labeling | training | evaluating | deploying | done | failed
    "last_run":     None,
    "last_result":  None,
    "started_at":   None,
}
_state_lock = threading.Lock()


def _set_state(status: str, **kwargs):
    with _state_lock:
        _pipeline_state["status"] = status
        _pipeline_state.update(kwargs)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/rlhf/status")
async def rlhf_status():
    """Dataset stats + current pipeline phase."""
    stats = get_stats()
    with _state_lock:
        state = dict(_pipeline_state)
    return {"pipeline": state, "dataset": stats}


@app.post("/rlhf/label")
async def rlhf_label(background_tasks: BackgroundTasks, max_records: int = 50):
    """
    Run GPT-4o teacher labeling on all unlabeled thumbs-down records.
    Check Render logs for per-record progress.
    """
    def _run():
        _set_state("labeling", started_at=datetime.now(timezone.utc).isoformat())
        print(f"\n{'='*60}")
        print(f"[RLHF] Labeling started at {_pipeline_state['started_at']}")
        result = run_labeler(max_records=max_records)
        _set_state("idle", last_run="label", last_result=result)
        print(f"[RLHF] Labeling complete: {result}")

    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={
            "error": f"Pipeline busy: {_pipeline_state['status']}"
        })
    background_tasks.add_task(_run)
    return {"status": "labeling started", "check": "Render logs for progress"}


@app.post("/rlhf/train")
async def rlhf_train(background_tasks: BackgroundTasks, num_epochs: int = 3):
    """
    Trigger DPO training job on RunPod. Polls until completion.
    Training logs visible in RunPod dashboard + Render logs (polling output).
    """
    def _run():
        pairs = get_dpo_pairs()
        if len(pairs) < 5:
            msg = f"Not enough labeled pairs: {len(pairs)} (need ≥5)"
            print(f"[RLHF] {msg}")
            _set_state("idle", last_result={"error": msg})
            return

        _set_state("training", started_at=datetime.now(timezone.utc).isoformat())
        print(f"\n{'='*60}")
        print(f"[RLHF] Submitting DPO training job — {len(pairs)} pairs, {num_epochs} epochs")
        result = run_training(num_epochs=num_epochs)
        _set_state("idle", last_run="train", last_result=result)
        print(f"[RLHF] Training result: {result}")

    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={
            "error": f"Pipeline busy: {_pipeline_state['status']}"
        })
    background_tasks.add_task(_run)
    return {"status": "training job submitted to RunPod", "check": "RunPod dashboard + Render logs"}


@app.post("/rlhf/eval")
async def rlhf_eval(background_tasks: BackgroundTasks):
    """
    Run gold-set evaluation. Returns pass/fail with per-issue scores.
    Uses GPT-4o-as-judge with 5-rubric scoring (threshold 4.0/5.0).
    """
    def _run():
        _set_state("evaluating", started_at=datetime.now(timezone.utc).isoformat())
        print(f"\n{'='*60}")
        print("[RLHF] Starting gold-set evaluation...")
        result = run_eval()
        _set_state("idle", last_run="eval", last_result=result)
        status = "✅ PASS" if result.get("passed") else "❌ FAIL"
        print(f"[RLHF] Eval complete: {status} — mean score: {result.get('overall_mean')}/5")

    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={
            "error": f"Pipeline busy: {_pipeline_state['status']}"
        })
    background_tasks.add_task(_run)
    return {"status": "evaluation started", "check": "Render logs for per-issue scores"}


@app.post("/rlhf/deploy")
async def rlhf_deploy(background_tasks: BackgroundTasks):
    """
    Merge LoRA adapter + push to HF Hub + update HF Inference Endpoint.
    Only runs if the last eval passed.
    """
    def _run():
        last_result = _pipeline_state.get("last_result", {})
        if _pipeline_state.get("last_run") == "eval" and not last_result.get("passed"):
            print("[RLHF] ❌ Deployment blocked — last eval did not pass.")
            _set_state("idle", last_result={"error": "Eval did not pass — deployment blocked"})
            return

        _set_state("deploying", started_at=datetime.now(timezone.utc).isoformat())
        print(f"\n{'='*60}")
        print("[RLHF] Starting redeployment...")
        result = run_redeployer()

        if result.get("success"):
            # Mark all retrained pairs in HF Dataset
            pairs = get_dpo_pairs()
            issue_nums = [p["issue_number"] for p in pairs]
            mark_retrained(issue_nums)

        _set_state("idle", last_run="deploy", last_result=result)
        status = "✅ Deployed" if result.get("success") else "❌ Failed"
        print(f"[RLHF] Deployment: {status} — revision: {result.get('new_revision')}")

    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={
            "error": f"Pipeline busy: {_pipeline_state['status']}"
        })
    background_tasks.add_task(_run)
    return {"status": "deployment started", "check": "Render logs for merge/push progress"}


@app.post("/rlhf/run")
async def rlhf_run_full(background_tasks: BackgroundTasks, num_epochs: int = 3):
    """
    Full pipeline: label → train → eval → deploy (if eval passes).
    All steps run sequentially in background. Monitor via Render logs.
    Returns 409 if already running.
    """
    def _run():
        print(f"\n{'='*60}")
        print(f"[RLHF] Full pipeline started — {datetime.now(timezone.utc).isoformat()}")

        # Step 1: Label
        _set_state("labeling")
        label_result = run_labeler()
        print(f"[RLHF] Step 1 (Labeling) done: {label_result}")

        if label_result.get("labeled", 0) == 0 and get_dpo_pairs() == []:
            print("[RLHF] No labeled pairs available — aborting pipeline")
            _set_state("idle", last_run="full", last_result={"error": "No data to train on"})
            return

        # Step 2: Train
        _set_state("training")
        train_result = run_training(num_epochs=num_epochs)
        print(f"[RLHF] Step 2 (Training) done: {train_result}")

        if not train_result.get("success"):
            _set_state("idle", last_run="full", last_result={"error": "Training failed", "detail": train_result})
            return

        # Step 3: Eval
        _set_state("evaluating")
        eval_result = run_eval()
        print(f"[RLHF] Step 3 (Eval) done: passed={eval_result.get('passed')}, mean={eval_result.get('overall_mean')}")

        if not eval_result.get("passed"):
            print(f"[RLHF] ❌ Eval failed ({eval_result.get('overall_mean')}/5.0) — skipping deployment")
            _set_state("idle", last_run="full", last_result={
                "stopped_at": "eval", "eval": eval_result
            })
            return

        # Step 4: Deploy
        _set_state("deploying")
        deploy_result = run_redeployer()
        print(f"[RLHF] Step 4 (Deploy) done: {deploy_result}")

        if deploy_result.get("success"):
            pairs      = get_dpo_pairs()
            issue_nums = [p["issue_number"] for p in pairs]
            mark_retrained(issue_nums)

        _set_state("idle", last_run="full", last_result={
            "label":  label_result,
            "train":  train_result,
            "eval":   eval_result,
            "deploy": deploy_result,
        })
        print(f"[RLHF] ✅ Full pipeline complete")

    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={
            "error": f"Pipeline busy: {_pipeline_state['status']}"
        })
    background_tasks.add_task(_run)
    return {
        "status":  "full RLHF pipeline started",
        "steps":   "label → train (RunPod) → eval (GPT-4o judge) → deploy (HF endpoint)",
        "monitor": "Check Render logs for step-by-step output",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rlhf_orchestrator:app", host="0.0.0.0", port=8001, reload=False)
