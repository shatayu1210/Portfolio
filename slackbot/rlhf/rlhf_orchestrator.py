"""
rlhf_orchestrator.py — FastAPI RLHF pipeline endpoints.

Exposes:
  GET  /rlhf/status         — dataset stats + current pipeline state
  POST /rlhf/label          — run GPT-4o teacher labeling on unlabeled feedback
  POST /rlhf/train          — trigger DPO training on RunPod
  POST /rlhf/eval           — run gold-set evaluation with LLM judge
  POST /rlhf/deploy         — merge adapter + redeploy HF endpoint
  POST /rlhf/run            — full pipeline: label → train → eval → deploy
  GET  /rlhf/logs           — list available run log files
  GET  /rlhf/logs/{run_id}  — view a specific run's full log

All heavy operations run as background tasks (no HTTP timeout).
Every run writes a structured log to slackbot/rlhf/logs/<run_id>.log

Weekly schedule: Every Wednesday at 02:00 UTC (auto-triggered).
"""
import os
import sys
import json
import threading
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import JSONResponse, PlainTextResponse
from slack_sdk import WebClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"), override=True)

from rlhf.feedback_store import get_stats, get_dpo_pairs, mark_retrained
from rlhf.labeler        import run_labeler
from rlhf.runpod_trainer import run_training
from rlhf.eval_runner    import run_eval
from rlhf.redeployer     import run_redeployer

# ── Log directory ─────────────────────────────────────────────────────────────
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)


def _make_run_logger(run_id: str) -> tuple[logging.Logger, Path]:
    """Create a file logger for one pipeline run. Returns (logger, log_path)."""
    log_path = LOG_DIR / f"{run_id}.log"
    logger   = logging.getLogger(run_id)
    logger.setLevel(logging.DEBUG)
    # File handler
    fh = logging.FileHandler(log_path)
    fh.setFormatter(logging.Formatter("%(asctime)s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
    logger.addHandler(fh)
    # Also mirror to stdout (Render logs)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(asctime)s  %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(sh)
    return logger, log_path


# ── Pipeline state (in-memory, resets on restart) ─────────────────────────────
_pipeline_state = {
    "status":      "idle",   # idle | labeling | training | evaluating | deploying
    "last_run":    None,
    "last_result": None,
    "started_at":  None,
    "last_log":    None,     # path to the most recent run log
}
_state_lock = threading.Lock()


def _set_state(status: str, **kwargs):
    with _state_lock:
        _pipeline_state["status"] = status
        _pipeline_state.update(kwargs)

# ── Slack Notification Helper ──────────────────────────────────────────────────

def _send_slack_update(message: str, color: str = "#36a64f"):
    """Send a status update to the configured Slack channel."""
    try:
        client = WebClient(token=os.getenv("SLACK_BOT_TOKEN"))
        channel = os.getenv("SLACK_CHANNEL", "#demo")
        client.chat_postMessage(
            channel=channel,
            text="RLHF Pipeline Update",
            attachments=[{
                "color": color,
                "title": "🤖 RLHF Pipeline Update",
                "text": message,
                "footer": "AutoBot Retraining System",
                "ts": int(datetime.now().timestamp())
            }]
        )
    except Exception as e:
        print(f"[Orchestrator] Failed to send Slack update: {e}")


# ── Core pipeline function (shared by on-demand and scheduler) ─────────────────

def _run_full_pipeline(trigger: str = "manual", num_epochs: int = 3):
    """Execute the full RLHF pipeline synchronously (call from a thread)."""
    run_id  = f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{trigger}"
    log, lp = _make_run_logger(run_id)
    _set_state("labeling", started_at=datetime.now(timezone.utc).isoformat(), last_log=str(lp))

    log.info(f"{'='*60}")
    log.info(f"RLHF pipeline started  trigger={trigger}  run_id={run_id}")
    log.info(f"{'='*60}")

    # ── Step 1: Label ─────────────────────────────────────────────────────────
    log.info("STEP 1 / 4 — Teacher Labeling (GPT-4o)")
    log.info("-" * 40)
    label_result = run_labeler()
    log.info(f"Labeling result: {json.dumps(label_result)}")

    pending = get_dpo_pairs()
    if not pending:
        msg = "No labeled DPO pairs available — aborting"
        log.warning(msg)
        _set_state("idle", last_run="full", last_result={"error": msg})
        return

    log.info(f"DPO pairs ready: {len(pending)}")

    # ── Step 2: Train ─────────────────────────────────────────────────────────
    _set_state("training")
    log.info("STEP 2 / 4 — DPO Training (RunPod)")
    log.info("-" * 40)
    log.info(f"Submitting {len(pending)} pairs for {num_epochs} epochs...")
    train_result = run_training(num_epochs=num_epochs)
    log.info(f"Training result: {json.dumps(train_result)}")

    if not train_result.get("success"):
        log.error(f"Training failed — aborting: {train_result.get('error')}")
        _set_state("idle", last_run="full", last_result={"error": "Training failed", "detail": train_result})
        _send_slack_update(
            f"⚠️ *RLHF Pipeline Stopped*\n"
            f"• *Phase:* training\n"
            f"• *Reason:* {train_result.get('error', 'Unknown failure')}\n"
            f"• *Debug:* Check `{lp.name}` in `rlhf/logs/`\n"
            f"• <https://www.runpod.io/console/serverless/endpoint/{os.getenv('RUNPOD_ENDPOINT_ID')}|View GPU Logs on RunPod>",
            color="#f44336"
        )
        return

    # ── Step 3: Eval ──────────────────────────────────────────────────────────
    _set_state("evaluating")
    log.info("STEP 3 / 4 — Gold-Set Evaluation (GPT-4o judge, threshold 4.0/5)")
    log.info("-" * 40)
    eval_result = run_eval()
    passed      = eval_result.get("passed")
    mean        = eval_result.get("overall_mean")
    log.info(f"Overall mean: {mean}/5.0  →  {'PASS ✅' if passed else 'FAIL ❌'}")
    for item in eval_result.get("per_issue", []):
        log.info(f"  #{item.get('issue_number')}: {item.get('mean_score')}/5  {item.get('scores', {}).get('reasoning', '')[:80]}")

    if not passed:
        log.warning(f"Eval below threshold ({mean} < 4.0) — deployment skipped")
        _set_state("idle", last_run="full", last_result={"stopped_at": "eval", "eval": eval_result})
        _send_slack_update(
            f"⚠️ *RLHF Pipeline Stopped*\n"
            f"• *Phase:* evaluation\n"
            f"• *Reason:* Score ({mean}/5.0) below 4.0 threshold\n"
            f"• *Debug:* Check `{lp.name}` in `rlhf/logs/`",
            color="#f44336"
        )
        return

    # ── Step 4: Deploy ────────────────────────────────────────────────────────
    _set_state("deploying")
    log.info("STEP 4 / 4 — Merge LoRA + Redeploy HF Endpoint")
    log.info("-" * 40)
    deploy_result = run_redeployer()
    log.info(f"Deploy result: {json.dumps(deploy_result)}")

    if deploy_result.get("success"):
        issue_nums = [p["issue_number"] for p in pending]
        mark_retrained(issue_nums)
        log.info(f"Marked {len(issue_nums)} pairs as retrained in HF Dataset")

    # ── Summary ───────────────────────────────────────────────────────────────
    final = {
        "label":  label_result,
        "train":  train_result,
        "eval":   eval_result,
        "deploy": deploy_result,
        "log":    str(lp),
    }
    _set_state("idle", last_run="full", last_result=final)

    # ── Slack Notification ────────────────────────────────────────────────────
    dashboard_url = f"https://www.runpod.io/console/serverless/endpoint/{os.getenv('RUNPOD_ENDPOINT_ID')}"
    
    if deploy_result.get("success"):
        _send_slack_update(
            f"✅ *RLHF Pipeline Successful*\n"
            f"• *Pairs trained:* {len(pending)}\n"
            f"• *Eval Score:* {eval_result.get('overall_mean', 0):.2f}/5.0\n"
            f"• *Action:* Model redeployed to HF Endpoint.\n"
            f"• <{dashboard_url}|View RunPod History>",
            color="#36a64f"
        )
    else:
        _send_slack_update(
            f"⚠️ *RLHF Pipeline Stopped*\n"
            f"• *Phase:* {_pipeline_state.get('status')}\n"
            f"• *Reason:* {deploy_result.get('error', 'Unknown failure')}\n"
            f"• *Debug:* Check `{lp.name}` in `rlhf/logs/`\n"
            f"• <{dashboard_url}|View GPU Logs on RunPod>",
            color="#f44336"
        )

    log.info("=" * 60)
    log.info(f"Pipeline complete  revision={deploy_result.get('new_revision', 'n/a')}")
    log.info(f"Log saved → {lp}")
    log.info("=" * 60)


# ── Weekly Wednesday scheduler ─────────────────────────────────────────────────

def _start_weekly_scheduler():
    """Fires the full pipeline every Wednesday at 02:00 UTC."""
    import time

    def _loop():
        print("[RLHF Scheduler] Weekly scheduler started — fires every Wednesday 02:00 UTC")
        while True:
            now    = datetime.now(timezone.utc)
            # weekday(): Monday=0, Wednesday=2
            days_until_wed  = (2 - now.weekday()) % 7
            next_wed        = now.replace(hour=2, minute=0, second=0, microsecond=0)
            if days_until_wed == 0 and now.hour >= 2:
                days_until_wed = 7   # already past 02:00 today, wait for next week
            from datetime import timedelta
            next_wed += timedelta(days=days_until_wed)
            wait_secs = (next_wed - now).total_seconds()
            print(f"[RLHF Scheduler] Next run: {next_wed.isoformat()}  (in {wait_secs/3600:.1f}h)")
            time.sleep(wait_secs)
            if _pipeline_state["status"] == "idle":
                print("[RLHF Scheduler] Triggering weekly pipeline...")
                _run_full_pipeline(trigger="weekly-wednesday")
            else:
                print(f"[RLHF Scheduler] Skipping — pipeline busy: {_pipeline_state['status']}")

    t = threading.Thread(target=_loop, daemon=True)
    t.start()


# ── App lifespan ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _start_weekly_scheduler()
    yield


app = FastAPI(
    title="AutoBot RLHF Orchestrator",
    description="On-demand and scheduled DPO retraining pipeline — every Wednesday 02:00 UTC",
    lifespan=lifespan,
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/rlhf/status")
async def rlhf_status():
    """Dataset stats + current pipeline phase + path to last run log."""
    stats = get_stats()
    with _state_lock:
        state = dict(_pipeline_state)
    return {"pipeline": state, "dataset": stats}


@app.post("/rlhf/label")
async def rlhf_label(background_tasks: BackgroundTasks, max_records: int = 50):
    """Run GPT-4o teacher labeling. Log written to rlhf/logs/<run_id>.log"""
    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={"error": f"Pipeline busy: {_pipeline_state['status']}"})

    def _run():
        run_id  = f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-label"
        log, lp = _make_run_logger(run_id)
        _set_state("labeling", started_at=datetime.now(timezone.utc).isoformat(), last_log=str(lp))
        log.info(f"Labeling started  max_records={max_records}")
        result = run_labeler(max_records=max_records)
        log.info(f"Labeling complete: {json.dumps(result)}")
        _set_state("idle", last_run="label", last_result=result)

    background_tasks.add_task(_run)
    return {"status": "labeling started", "logs": f"rlhf/logs/  (check /rlhf/logs for filename)"}


@app.post("/rlhf/train")
async def rlhf_train(background_tasks: BackgroundTasks, num_epochs: int = 3):
    """Trigger RunPod DPO training. Log written to rlhf/logs/<run_id>.log"""
    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={"error": f"Pipeline busy: {_pipeline_state['status']}"})

    def _run():
        run_id  = f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-train"
        log, lp = _make_run_logger(run_id)
        pairs   = get_dpo_pairs()
        if len(pairs) < 5:
            log.error(f"Not enough pairs: {len(pairs)} (need ≥5)")
            _set_state("idle", last_result={"error": "Not enough pairs"})
            return
        _set_state("training", started_at=datetime.now(timezone.utc).isoformat(), last_log=str(lp))
        log.info(f"Training started  pairs={len(pairs)}  epochs={num_epochs}")
        result = run_training(num_epochs=num_epochs)
        log.info(f"Training result: {json.dumps(result)}")
        _set_state("idle", last_run="train", last_result=result)

    background_tasks.add_task(_run)
    return {"status": "training submitted to RunPod"}


@app.post("/rlhf/eval")
async def rlhf_eval(background_tasks: BackgroundTasks):
    """Run gold-set eval. Log written to rlhf/logs/<run_id>.log"""
    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={"error": f"Pipeline busy: {_pipeline_state['status']}"})

    def _run():
        run_id  = f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-eval"
        log, lp = _make_run_logger(run_id)
        _set_state("evaluating", started_at=datetime.now(timezone.utc).isoformat(), last_log=str(lp))
        log.info("Gold-set evaluation started")
        result = run_eval()
        passed = result.get("passed")
        mean   = result.get("overall_mean")
        log.info(f"Overall: {mean}/5.0  →  {'PASS' if passed else 'FAIL'}")
        for item in result.get("per_issue", []):
            log.info(f"  #{item.get('issue_number')}: {item.get('mean_score')}/5")
        _set_state("idle", last_run="eval", last_result=result)

    background_tasks.add_task(_run)
    return {"status": "evaluation started"}


@app.post("/rlhf/deploy")
async def rlhf_deploy(background_tasks: BackgroundTasks):
    """Merge adapter + push HF Hub revision + update endpoint."""
    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={"error": f"Pipeline busy: {_pipeline_state['status']}"})

    def _run():
        run_id  = f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-deploy"
        log, lp = _make_run_logger(run_id)
        _set_state("deploying", started_at=datetime.now(timezone.utc).isoformat(), last_log=str(lp))
        log.info("Redeployment started")
        result = run_redeployer()
        log.info(f"Deploy result: {json.dumps(result)}")
        if result.get("success"):
            pairs      = get_dpo_pairs()
            issue_nums = [p["issue_number"] for p in pairs]
            mark_retrained(issue_nums)
            log.info(f"Marked {len(issue_nums)} pairs retrained")
        _set_state("idle", last_run="deploy", last_result=result)

    background_tasks.add_task(_run)
    return {"status": "deployment started"}


@app.post("/rlhf/run")
async def rlhf_run_full(background_tasks: BackgroundTasks, num_epochs: int = 3):
    """Full pipeline: label → train (RunPod) → eval (GPT-4o) → deploy if pass."""
    if _pipeline_state["status"] != "idle":
        return JSONResponse(status_code=409, content={"error": f"Pipeline busy: {_pipeline_state['status']}"})
    background_tasks.add_task(_run_full_pipeline, "on-demand", num_epochs)
    return {
        "status":   "full RLHF pipeline started",
        "steps":    "label → train (RunPod) → eval (GPT-4o judge) → deploy (HF endpoint)",
        "schedule": "Also runs automatically every Wednesday 02:00 UTC",
        "logs":     "GET /rlhf/logs to list run logs",
    }


@app.get("/rlhf/logs")
async def list_logs():
    """List all run log files in rlhf/logs/."""
    files = sorted(LOG_DIR.glob("*.log"), reverse=True)
    return {"logs": [f.name for f in files], "count": len(files)}


@app.get("/rlhf/logs/{run_id}")
async def view_log(run_id: str):
    """View the full log for a specific run ID (filename without .log)."""
    log_path = LOG_DIR / f"{run_id}.log"
    if not log_path.exists():
        return JSONResponse(status_code=404, content={"error": f"Log not found: {run_id}"})
    return PlainTextResponse(log_path.read_text())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rlhf_orchestrator:app", host="0.0.0.0", port=8001, reload=False)
