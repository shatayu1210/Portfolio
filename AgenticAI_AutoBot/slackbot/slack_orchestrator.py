import asyncio
import threading
import time
from datetime import datetime
from typing import TypedDict, Annotated
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import JSONResponse

from langgraph.graph import StateGraph, END
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from config import (
    SLACK_BOT_TOKEN,
    SLACK_CHANNEL,
    POLL_INTERVAL_SECONDS,
    SCORER_THRESHOLD
)
from poller import poll_once
from sentinel import run_sentinel, score_issue
from reasoner import run_reasoner, analyze_issue, build_prompt
from notifier import run_notifier, send_slack_message
from adhoc import handle_adhoc_query, handle_top_risk_query, handle_explain_query
from generate_demo_sets import generate_sets
from rlhf.feedback_store import push_feedback

# ── In-memory scored issues cache (reset on restart) ─────────────────────────
# Stores ALL scored issues from the last pipeline run, sorted by high probability desc.
last_scored_cache: list[dict] = []

# Prevents concurrent pipeline runs from interleaving their print logs.
_pipeline_lock = threading.Lock()

# ── Slack client for event handling ──────────────────────────────────────────
slack_client = WebClient(token=SLACK_BOT_TOKEN)


# ── LangGraph State ───────────────────────────────────────────────────────────

class PipelineState(TypedDict):
    """State that flows through the LangGraph pipeline."""
    # Input
    raw_issues:      list[dict]
    # After sentinel
    high_issues:     list[dict]
    # After reasoner
    analyzed_issues: list[dict]
    # After notifier
    sent_count:      int
    failed_count:    int
    # Metadata
    cycle_start:     str
    error:           str | None


# ── LangGraph Nodes ───────────────────────────────────────────────────────────

def node_poll(state: PipelineState) -> PipelineState:
    """Node 1 — Poll GitHub for new issues."""
    print(f"\n[LangGraph] node_poll running...")
    try:
        new_issues = poll_once()
        return {
            **state,
            "raw_issues":  new_issues,
            "cycle_start": datetime.now().isoformat(),
            "error":       None
        }
    except Exception as e:
        print(f"[LangGraph] node_poll error: {e}")
        return {**state, "raw_issues": [], "error": str(e)}


def node_score(state: PipelineState) -> PipelineState:
    """Node 2 — Sentinel scores each issue and fires Reason+Notify immediately for each HIGH."""
    global last_scored_cache
    print(f"[LangGraph] node_score running on {len(state['raw_issues'])} issues...")
    if not state["raw_issues"]:
        return {**state, "high_issues": [], "analyzed_issues": [], "sent_count": 0, "failed_count": 0}

    sent_count   = 0
    failed_count = 0
    analyzed     = []

    def on_high_found(scored_issue: dict):
        nonlocal sent_count, failed_count
        num = scored_issue["issue_number"]
        print(f"    [Immediate] Reasoning #{num}...")
        try:
            result = analyze_issue(scored_issue)
            analyzed.append(result)
            print(f"    [Immediate] Sending Slack notification for #{num}...")
            success = send_slack_message(result)
            if success:
                print(f"    [Immediate] ✅ Sent #{num} to Slack")
                sent_count += 1
            else:
                print(f"    [Immediate] ❌ Slack send failed for #{num}")
                failed_count += 1
        except Exception as e:
            print(f"    [Immediate] ❌ Reason/Notify failed for #{num}: {e}")
            failed_count += 1

    try:
        high_issues = run_sentinel(state["raw_issues"], on_high_found=on_high_found)

        all_scored = state["raw_issues"]  # sentinel mutates in-place
        last_scored_cache = sorted(
            all_scored,
            key=lambda x: x.get("probabilities", {}).get("high", 0.0),
            reverse=True
        )
        print(f"[Cache] Stored {len(last_scored_cache)} scored issues in memory.")
        return {
            **state,
            "high_issues":     high_issues,
            "analyzed_issues": analyzed,
            "sent_count":      sent_count,
            "failed_count":    failed_count,
        }
    except Exception as e:
        print(f"[LangGraph] node_score error: {e}")
        return {**state, "high_issues": [], "analyzed_issues": [], "sent_count": 0, "failed_count": 0, "error": str(e)}


# ── Build LangGraph pipeline ──────────────────────────────────────────────────

def build_pipeline() -> any:
    """Build and compile the LangGraph state machine."""

    graph = StateGraph(PipelineState)

    # Add nodes
    graph.add_node("poll",   node_poll)
    graph.add_node("score",  node_score)

    # Entry point
    graph.set_entry_point("poll")

    # Edges
    graph.add_edge("poll", "score")
    graph.add_edge("score", END)

    return graph.compile()


pipeline = build_pipeline()
print("LangGraph pipeline compiled ✅")


# ── Polling loop (background thread) ─────────────────────────────────────────

def polling_loop():
    """Background thread — runs the LangGraph pipeline every POLL_INTERVAL_SECONDS."""
    print(f"Polling loop started — interval: {POLL_INTERVAL_SECONDS}s")

    while True:
        print(f"\nSleeping {POLL_INTERVAL_SECONDS}s until next cycle...")
        time.sleep(POLL_INTERVAL_SECONDS)
        
        try:
            with _pipeline_lock:
                print(f"\n{'='*60}")
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Running pipeline cycle...")

                initial_state: PipelineState = {
                    "raw_issues":      [],
                    "high_issues":     [],
                    "analyzed_issues": [],
                    "sent_count":      0,
                    "failed_count":    0,
                    "cycle_start":     datetime.now().isoformat(),
                    "error":           None
                }

                final_state = pipeline.invoke(initial_state)

                print(f"\n[Cycle Summary]")
                print(f"  Raw issues:    {len(final_state['raw_issues'])}")
                print(f"  HIGH severity: {len(final_state['high_issues'])}")
                print(f"  Analyzed:      {len(final_state['analyzed_issues'])}")
                print(f"  Slack sent:    {final_state['sent_count']}")
                print(f"  Failed:        {final_state['failed_count']}")
                if final_state.get("error"):
                    print(f"  Error:         {final_state['error']}")

        except Exception as e:
            print(f"[Polling loop error]: {e}")


# ── FastAPI app ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background polling thread when FastAPI starts."""
    print("Starting AutoBot Orchestrator...")
    thread = threading.Thread(target=polling_loop, daemon=True)
    thread.start()
    print("Background polling thread started ✅")
    yield
    print("Shutting down AutoBot Orchestrator...")


app = FastAPI(
    title="AutoBot Slack Orchestrator",
    description="Polling + Adhoc query orchestrator for AutoBot Slack feature",
    lifespan=lifespan
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "autobot-slack-orchestrator",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/poll")
async def trigger_poll(background_tasks: BackgroundTasks):
    """
    Manually trigger one poll cycle.
    Returns 409 if a cycle is already running.
    """
    if _pipeline_lock.locked():
        return JSONResponse(
            status_code=409,
            content={"status": "busy", "detail": "A pipeline cycle is already running. Try again shortly."}
        )

    def run_cycle():
        with _pipeline_lock:
            initial_state: PipelineState = {
                "raw_issues":      [],
                "high_issues":     [],
                "analyzed_issues": [],
                "sent_count":      0,
                "failed_count":    0,
                "cycle_start":     datetime.now().isoformat(),
                "error":           None
            }
            final_state = pipeline.invoke(initial_state)
            print(f"[Manual poll] sent={final_state['sent_count']} failed={final_state['failed_count']}")

    background_tasks.add_task(run_cycle)
    return {"status": "poll cycle triggered"}


@app.post("/generate_demo_sets")
async def trigger_generate_demo_sets(background_tasks: BackgroundTasks):
    """
    Manually trigger the generation of the 30-issue demo JSON sets.
    Useful for resetting the demo state before a live presentation.
    """
    def run_generation():
        print("[Manual Generation] Starting demo set generation...")
        try:
            generate_sets()
        except Exception as e:
            print(f"[Manual Generation] Error: {e}")

    background_tasks.add_task(run_generation)
    return {"status": "demo set generation started in background"}


@app.get("/explain")
async def explain_issue(issue_number: int, channel: str = None, background_tasks: BackgroundTasks = None):
    """
    On-demand Scorer + Reasoner for a single issue.
    Called when a user clicks an 'Explain why' link from the top-risk list.
    Checks the in-memory cache first; falls back to live GitHub fetch + score if not found.
    Posts the Reasoner explanation back to the Slack channel.
    """
    target_channel = channel or SLACK_CHANNEL

    def run_explain():
        import slack_orchestrator as _self
        cached = next(
            (i for i in _self.last_scored_cache if i.get("issue_number") == issue_number),
            None
        )

        if cached:
            print(f"[Explain] Cache HIT for #{issue_number}")
            issue = cached
        else:
            print(f"[Explain] Cache MISS for #{issue_number} — fetching + scoring live")
            from adhoc import gh_get_issue
            raw = gh_get_issue(issue_number)
            if not raw:
                slack_client.chat_postMessage(
                    channel=target_channel,
                    text=f"⚠️ Could not fetch issue #{issue_number} from GitHub."
                )
                return
            issue = {
                "issue_number": raw["issue_number"],
                "title":        raw["title"],
                "body":         raw["body"],
                "url":          raw["html_url"],
                "created_at":   raw["created_at"],
                "labels":       raw["labels"],
                "days_open":    raw.get("days_open", 0),
                "comment_count":    raw.get("comments", 0),
                "assignee_count":   1 if raw.get("assignee") != "nobody" else 0,
                "linked_pr_count":  0,
                "pr_states":        ["none"],
                "ci_status":        "none",
                "max_comment_gap_days": 0.0,
                "comments_text":    "",
                "silent_reviewers": 0,
                "pr_review_feedback": "",
            }
            issue = score_issue(issue)

        try:
            result = analyze_issue(issue)
            a = result["analysis"]
            prob_high = issue.get("probabilities", {}).get("high", 0.0)
            pred_class = issue.get("predicted_class", "unknown")
            confidence = f"{prob_high:.0%}"

            text = (
                f"🔍 *Scoring Explanation for #{issue_number}*\n"
                f"*{issue['title']}*\n\n"
                f"🤖 *Scorer:* `{pred_class}` | Confidence: {confidence}\n\n"
                f"📋 *Why it was scored this way:*\n{a['narrative']}\n\n"
                f"<{issue.get('url', '')}|View Issue on GitHub>"
            )
            slack_client.chat_postMessage(channel=target_channel, text=text)
            print(f"[Explain] Posted explanation for #{issue_number} to {target_channel}")
        except Exception as e:
            print(f"[Explain] Failed for #{issue_number}: {e}")
            slack_client.chat_postMessage(
                channel=target_channel,
                text=f"⚠️ Failed to generate explanation for #{issue_number}: {e}"
            )

    background_tasks.add_task(run_explain)
    return {"status": f"explanation for #{issue_number} triggered", "channel": target_channel}


def process_adhoc_query(clean_query: str, issue_number: int | None, channel: str, thread_ts: str):
    """Background task to process adhoc query and send reply."""
    try:
        response_text = handle_adhoc_query(clean_query, issue_number)
        slack_client.chat_postMessage(
            channel=channel,
            text=response_text,
            thread_ts=thread_ts
        )
    except SlackApiError as e:
        print(f"[Adhoc] Slack reply failed: {e}")
    except Exception as e:
        print(f"[Adhoc] Processing failed: {e}")


@app.post("/slack/events")
async def slack_events(request: Request, background_tasks: BackgroundTasks):
    """
    Slack event handler.
    Handles:
      - URL verification challenge (one-time Slack setup)
      - App mention events → adhoc query path
    """
    body = await request.json()

    # Slack URL verification
    if body.get("type") == "url_verification":
        return JSONResponse({"challenge": body["challenge"]})

    # Slack Event Retries: ignore them so we don't process the same query 3 times
    if request.headers.get("X-Slack-Retry-Num"):
        return JSONResponse({"status": "ignored retry"})

    # Handle events
    event = body.get("event", {})
    event_type = event.get("type")

    if event_type == "app_mention":
        user_query = event.get("text", "")
        channel    = event.get("channel", SLACK_CHANNEL)
        thread_ts  = event.get("ts")

        # Strip bot mention from query (@AutoBot what is...)
        import re
        clean_query = re.sub(r"<@[A-Z0-9]+>", "", user_query).strip()

        # Extract issue number if mentioned (#12345)
        issue_match  = re.search(r"#(\d+)", clean_query)
        issue_number = int(issue_match.group(1)) if issue_match else None

        print(f"[Adhoc] query='{clean_query}' issue={issue_number}")

        # Run the heavy LLM processing in the background so we can instantly return 200 to Slack
        background_tasks.add_task(process_adhoc_query, clean_query, issue_number, channel, thread_ts)

    return JSONResponse({"status": "ok"})


@app.post("/slack/actions")
async def slack_actions(request: Request, background_tasks: BackgroundTasks):
    """
    Handles Slack interactive component actions (button clicks).
    Receives feedback_positive_<N> or feedback_negative_<N> button actions
    from the ✅ Helpful / 👎 Not Helpful buttons on notifications.
    Writes negative feedback to HF Dataset for RLHF/DPO training.
    Must return 200 within 3 seconds — heavy work goes to background task.
    """
    import json as _json
    import urllib.parse

    # Slack sends actions as application/x-www-form-urlencoded with a 'payload' field
    body_bytes = await request.body()
    body_str   = body_bytes.decode("utf-8")
    parsed     = urllib.parse.parse_qs(body_str)
    payload    = _json.loads(parsed.get("payload", ["{}"])[0])

    actions = payload.get("actions", [])
    if not actions:
        return JSONResponse({"status": "no actions"})

    action    = actions[0]
    action_id = action.get("action_id", "")
    user      = payload.get("user", {}).get("name", "unknown")

    print(f"[Feedback] Action: {action_id} from @{user}")

    def handle_feedback():
        try:
            # Parse: feedback_positive_66476 or feedback_negative_66476
            parts        = action_id.split("_")
            feedback_type = parts[1]   # "positive" or "negative"
            issue_number  = int(parts[2])

            # Look up the issue in the last scored cache to get prompt + response
            cached = next((i for i in last_scored_cache if i["issue_number"] == issue_number), None)

            if feedback_type == "negative":
                if cached:
                    # Reconstruct the prompt that was sent to the Reasoner
                    prompt = build_prompt(
                        title                = cached["title"],
                        body                 = cached.get("body", ""),
                        labels               = cached.get("labels", []),
                        days_open            = cached.get("days_open", 0),
                        assignee_count       = cached.get("assignee_count", 0),
                        comment_count        = cached.get("comment_count", 0),
                        linked_pr_count      = cached.get("linked_pr_count", 0),
                        pr_states            = cached.get("pr_states", ["none"]),
                        ci_status            = cached.get("ci_status", "none"),
                        max_comment_gap_days = cached.get("max_comment_gap_days", 0.0),
                        comments_text        = cached.get("comments_text", ""),
                        silent_reviewers     = cached.get("silent_reviewers", 0),
                        pr_review_feedback   = cached.get("pr_review_feedback", ""),
                        risk_score           = cached.get("confidence_score"),
                        risk_band            = cached.get("predicted_class", "high"),
                    )
                    bad_response = cached.get("raw_reasoning", "")
                    issue_title  = cached.get("title", f"Issue #{issue_number}")
                else:
                    prompt       = f"Issue #{issue_number} (prompt not in cache)"
                    bad_response = "Unknown — issue not in cache"
                    issue_title  = f"Issue #{issue_number}"

                ok = push_feedback(
                    issue_number  = issue_number,
                    issue_title   = issue_title,
                    prompt        = prompt,
                    bad_response  = bad_response,
                    feedback_type = "negative",
                )
                status_str = "✅ saved to training dataset" if ok else "⚠️ save failed"
                print(f"[Feedback] 👎 #{issue_number} — {status_str}")

            else:
                # Positive feedback — log only, no training data needed
                push_feedback(
                    issue_number  = issue_number,
                    issue_title   = cached.get("title", f"Issue #{issue_number}") if cached else f"Issue #{issue_number}",
                    prompt        = "",
                    bad_response  = "",
                    feedback_type = "positive",
                )
                print(f"[Feedback] ✅ #{issue_number} marked helpful by @{user}")

        except Exception as e:
            print(f"[Feedback] Error handling action '{action_id}': {e}")

    background_tasks.add_task(handle_feedback)
    # Must return 200 immediately — Slack will show a loading spinner otherwise
    return JSONResponse({"status": "ok"})


@app.get("/status")
async def status():
    """Returns current pipeline configuration."""
    return {
        "poll_interval_seconds": POLL_INTERVAL_SECONDS,
        "scorer_threshold":      SCORER_THRESHOLD,
        "slack_channel":         SLACK_CHANNEL,
        "pipeline_nodes": [
            "poll → score → threshold_check → reason → notify"
        ],
        "adhoc_status": "live — GitHub APIs + GraphRAG + LLM tool planner active"
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "slack_orchestrator:app",
        host="0.0.0.0",
        port=8000,
        reload=False
    )
