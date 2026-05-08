import os
import re
import json
import tempfile
import shutil
import subprocess
from typing import TypedDict, List, Dict, Any, Optional
from pathlib import Path
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# Import TGI metadata reader — only available when AUTOBOT_MODE=hf_tgi
try:
    from app import get_tgi_last_call_metadata as _get_tgi_metadata
except ImportError:
    def _get_tgi_metadata() -> dict:
        return {}

# Import existing logic from local_orchestrator
from planner_orchestrator import (
    run_planner_with_refinement, assemble_patcher_input,
    Issue as OrcIssue, PlannerPlan as OrcPlan
)
from graphrag_client import get_candidate_files, neo4j_available

# ──────────────────────────────────────────────────────────────────────────────
# Error classification patterns for the Diagnostic Router
# ──────────────────────────────────────────────────────────────────────────────
PATCHER_ERRORS = [
    r"hunk (FAILED|failed)",
    r"patch does not apply",
    r"offset \d+ lines",
    r"IndentationError",
    r"SyntaxError",
    r"missing import",
    r"Patch application failed",
    r"malformed patch",
    r"reversed \(or previously applied\)",
    r"can't find file to patch",
    r"fuzz factor",
]

PLANNER_ERRORS = [
    r"AssertionError",
    r"AssertionFailed",
    r"TestTimeout",
    r"LogicConflict",
    r"FAILED.*test_",          # pytest test failure
    r"FAILED.*spec\.",         # jest/vitest test failure
    r"TypeError",
    r"AttributeError",
    r"NameError",
    r"ModuleNotFoundError",
    r"cannot import name",
    r"\d+ failed",             # pytest summary "X failed"
    r"● .*>",                  # jest failure bullet
]

def classify_sandbox_error(sandbox_output: str) -> str:
    """
    Returns 'retry_patcher', 'escalate_planner', or 'end' depending on the
    nature of the sandbox failure.
    """
    if not sandbox_output:
        return "retry_patcher"

    # Check for patcher-class errors first (lower-level, fixable without a new plan)
    for pattern in PATCHER_ERRORS:
        if re.search(pattern, sandbox_output, re.IGNORECASE):
            return "retry_patcher"

    # Check for planner-class errors (fundamental logic issues)
    for pattern in PLANNER_ERRORS:
        if re.search(pattern, sandbox_output, re.IGNORECASE):
            return "escalate_planner"

    # Default: give the patcher another shot
    return "retry_patcher"


# ──────────────────────────────────────────────────────────────────────────────
# AgentState
# ──────────────────────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    issue_number: int
    title: str
    body: str
    repo_path: str
    ts_index: Dict[str, Any]
    backend_label: str

    # Internal state
    candidate_files: List[str]
    repo_context: str

    # Outputs from Planner
    plan: Optional[Dict[str, Any]]
    trace: Optional[Dict[str, Any]]
    patcher_input: Optional[Dict[str, Any]]

    # Outputs from Patcher
    patch: Optional[str]
    iterations: int
    patcher_history: List[Dict[str, Any]]

    # Critic / CoD state
    critic_verdict: Optional[str]        # "ACCEPT" | "REVISE" | "REJECT"
    critic_feedback: Optional[str]       # Natural-language critique
    debate_rounds: int                   # How many Critic↔Patcher rounds

    # Sandbox Results
    sandbox_result: Optional[Dict[str, Any]]
    sandbox_error_class: Optional[str]   # "retry_patcher" | "escalate_planner"

    # Context / Token diagnostics (populated by patcher_node after every LLM call)
    context_diagnostics: Optional[Dict[str, Any]]

    # Rejection context — populated when escalating to Planner after a Critic REJECT.
    # Carries the failed plan, diff, sandbox error and critic reasoning so the
    # re-planner can avoid repeating the same mistake.
    rejection_context: Optional[Dict[str, Any]]

    # Final verdict
    status: str
    error: Optional[str]


# Global registry to hold non-serializable callables (chat_fn, patcher_fn, critic_fn) per issue
function_registry: Dict[int, Dict[str, Any]] = {}


# ──────────────────────────────────────────────────────────────────────────────
# Planner Graph Nodes
# ──────────────────────────────────────────────────────────────────────────────
def orchestrator_node(state: AgentState) -> AgentState:
    print(f"[LangGraph] Orchestrator: Initializing for issue #{state['issue_number']}")
    if neo4j_available():
        candidates = get_candidate_files(state['issue_number'], top_k=6)
    else:
        candidates = []

    return {
        **state,
        "candidate_files": candidates,
        "iterations": 0,
        "debate_rounds": 0,
    }


def planner_node(state: AgentState) -> AgentState:
    print(f"[LangGraph] Planner: Generating plan for issue #{state['issue_number']}")
    issue_obj = OrcIssue(number=state['issue_number'], title=state['title'], body=state['body'])

    chat_fn = function_registry.get(state['issue_number'], {}).get('chat_fn')
    if not chat_fn:
        return {**state, "error": "No chat_fn provided in registry", "status": "failed"}

    # ── Inject rejection context when re-planning after a Critic REJECT ──────────────
    # Prepend a failure brief to repo_context so run_planner_with_refinement
    # includes it in the user prompt, grounding the new plan away from the mistake.
    repo_context = state.get('repo_context', '')
    rejection_context = state.get('rejection_context')
    if rejection_context:
        failed_plan     = rejection_context.get('failed_plan', {})
        critic_verdict  = rejection_context.get('critic_verdict', 'REJECT')
        critic_feedback = rejection_context.get('critic_feedback', '(none)')
        sandbox_error   = rejection_context.get('sandbox_error', '(none)')
        failed_diff     = rejection_context.get('failed_diff', '')

        failure_brief = (
            "\n" + "=" * 70 + "\n"
            "⚠️  RE-PLANNING REQUIRED — PREVIOUS ATTEMPT FAILED\n"
            "=" * 70 + "\n"
            f"The previous plan targeted these files:\n"
            f"  {failed_plan.get('files', []) if isinstance(failed_plan, dict) else '?'}\n\n"
            f"Summary of what was planned:\n"
            f"  {(failed_plan.get('summary', '') if isinstance(failed_plan, dict) else str(failed_plan))[:500]}\n\n"
            f"The Patcher generated a diff but validation FAILED.\n"
            f"Critic verdict: {critic_verdict}\n"
            f"Critic feedback:\n  {critic_feedback[:800]}\n\n"
            f"Sandbox / type-check error:\n  {sandbox_error[:800]}\n\n"
            "INSTRUCTIONS FOR YOUR NEW PLAN:\n"
            "  1. Do NOT target the same files unless the critic feedback explicitly says the file is correct.\n"
            "  2. Fix the root cause described in the critic feedback and sandbox error above.\n"
            "  3. If the error is a TypeScript type error, ensure your code_spans point to the exact\n"
            "     lines where the type is defined or used — not just the file header.\n"
            "  4. If the error says 'tsc not found' or 'exit 254', that is an environment issue,\n"
            "     not a code issue — proceed with the same plan.\n"
            "=" * 70 + "\n"
        )
        print(
            f"[Planner] Re-planning with rejection context. "
            f"Critic said: {critic_verdict}. Feedback: {critic_feedback[:200]}"
        )
        repo_context = failure_brief + repo_context

    try:
        plan, trace = run_planner_with_refinement(
            chat_fn=chat_fn,
            issue=issue_obj,
            repo_path=state['repo_path'],
            repo_context=repo_context,
            ts_index=state['ts_index'],
            graphrag_candidates=state.get('candidate_files', []),
            backend=state['backend_label'],
        )

        return {
            **state,
            "plan": {
                "summary": plan.summary,
                "files": plan.files,
                "steps": plan.steps,
                "code_spans": plan.code_spans,
                "requires_code_change": plan.requires_code_change,
            },
            "trace": {
                "iterations": trace.iterations,
                "final_confidence": trace.final_confidence,
                "triggers_detected": trace.triggers_detected,
                "research_steps_used": trace.research_steps_used,
            },
            "status": "plan_generated"
        }
    except Exception as e:
        return {
            **state,
            "error": f"Planner failed: {str(e)}",
            "status": "failed"
        }


# ──────────────────────────────────────────────────────────────────────────────
# Patcher Graph Nodes
# ──────────────────────────────────────────────────────────────────────────────
def patcher_prep_node(state: AgentState) -> AgentState:
    print(f"[LangGraph] Patcher Prep: Assembling context for issue #{state['issue_number']}")
    issue_obj = OrcIssue(number=state['issue_number'], title=state['title'], body=state['body'])
    plan_obj = OrcPlan.from_raw(state['plan'])

    patcher_input = assemble_patcher_input(
        plan=plan_obj,
        issue=issue_obj,
        repo_path=state['repo_path'],
        ts_index=state['ts_index']
    )

    # ── Context assembly diagnostics ──────────────────────────────────────────
    fc = patcher_input.get("file_contexts", {})
    n_primary    = len(fc.get("primary", []))
    n_supporting = len(fc.get("supporting", []))
    n_tests      = len(fc.get("tests", []))
    primary_files = [c["file"] for c in fc.get("primary", [])]
    supporting_files = [c.get("file") for c in fc.get("supporting", [])]

    print(
        f"[Patcher Prep] Context assembled — "
        f"primary={n_primary} {primary_files}, "
        f"supporting={n_supporting} {supporting_files}, "
        f"tests={n_tests}"
    )
    if n_supporting == 0:
        print(
            f"[Patcher Prep] ⚠️  WARNING: 0 supporting files found for plan.files={plan_obj.files}. "
            f"Possible causes:\n"
            f"  1. File uses path aliases (e.g. '@/hooks/foo') that can't be resolved statically.\n"
            f"  2. File is a TSX component with no same-directory siblings in the ts-index.\n"
            f"  3. The ts-index ({len(state.get('ts_index', {}))} entries) doesn't cover this directory.\n"
            f"  The patcher will have less context and may hallucinate. "
            f"Consider adding sibling/dependency files to the plan manually."
        )
    if n_tests == 0:
        print(
            f"[Patcher Prep] ℹ️  No test files found for {plan_obj.files}. "
            f"Sandbox will skip test execution (patch-apply-only mode)."
        )

    return {
        **state,
        "patcher_input": patcher_input,
        "patcher_history": [],
        "iterations": 0,
        "debate_rounds": 0,
        "critic_verdict": None,
        "critic_feedback": None,
        "sandbox_error_class": None,
        "status": "patcher_ready"
    }



def patcher_node(state: AgentState) -> AgentState:
    iteration = state.get("iterations", 0) + 1
    print(f"[LangGraph] Patcher: Generating diff — iteration {iteration}")

    patcher_fn = function_registry.get(state['issue_number'], {}).get('patcher_fn')
    if not patcher_fn:
        return {**state, "error": "No patcher_fn provided", "status": "failed"}

    patcher_sys = (
        "You are AutoBot Patcher. Generate a valid unified diff that implements the plan below.\n"
        "Rules:\n"
        "1. Output ONLY the unified diff — no prose, no markdown fences, no explanations.\n"
        "2. Use EXACT context lines copied from the FILE CONTENT sections below.\n"
        "3. Format every file change as:\n"
        "   diff --git a/<path> b/<path>\n"
        "   --- a/<path>\n"
        "   +++ b/<path>\n"
        "   @@ -<old_start>,<old_count> +<new_start>,<new_count> @@\n"
        "4. Include at least 2 context lines before and after each changed block.\n"
        "5. Only modify files listed under FILES TO MODIFY.\n"
        "6. IMPORTANT: Your diff MUST contain at least one meaningful code change — "
        "a real line of code added or modified. Do NOT output a diff that only adds "
        "blank lines or whitespace. That is invalid and will be rejected."
    )

    # ── Pre-call input diagnostics ─────────────────────────────────────────────
    pi = state.get('patcher_input') or {}
    plan_directive = pi.get('planner_directive') or pi.get('plan') or {}
    file_contexts  = pi.get('file_contexts') or {}
    primary_files  = file_contexts.get('primary', [])
    plan_incomplete = not plan_directive or not primary_files

    # ── Build structured human-readable prompt (better for LoRA model) ──────────
    # The LoRA patcher model was fine-tuned on structured text, not raw JSON blobs.
    issue_ctx = pi.get('issue_context', {})
    directive = plan_directive if isinstance(plan_directive, dict) else {}

    prompt_parts = []
    prompt_parts.append(
        f"ISSUE #{issue_ctx.get('issue_number', state.get('issue_number', '?'))}: "
        f"{issue_ctx.get('title', state.get('title', ''))}"
    )
    if issue_ctx.get('body'):
        prompt_parts.append(f"DESCRIPTION:\n{issue_ctx['body'][:2000]}")

    plan_files = directive.get('files', [])
    prompt_parts.append(
        f"\nPLAN SUMMARY: {directive.get('summary', '')}\n"
        f"FILES TO MODIFY: {', '.join(plan_files)}\n"
        "STEPS:\n" + "\n".join(f"  - {s}" for s in directive.get('steps', []))
    )

    for ctx in primary_files:
        fp = ctx.get('file', '')
        excerpt = ctx.get('excerpt', '')
        prompt_parts.append(f"\n=== FILE: {fp} ===\n{excerpt[:8000]}")

    for ctx in file_contexts.get('supporting', [])[:2]:
        fp = ctx.get('file', '')
        excerpt = ctx.get('excerpt', '')
        prompt_parts.append(f"\n=== SUPPORTING FILE: {fp} (read-only) ===\n{excerpt[:2000]}")

    code_span_hints = ""
    if directive.get('code_spans'):
        hints = [
            f"  {s.get('file')} lines {s.get('start_line')}-{s.get('end_line')} ({s.get('symbol', '')})"
            for s in directive['code_spans'][:4]
        ]
        code_span_hints = "KEY CODE SPANS TO CHANGE:\n" + "\n".join(hints) + "\n"

    prompt_parts.append(
        f"\n{code_span_hints}"
        "OUTPUT INSTRUCTIONS: Output ONLY the unified diff below. "
        "No prose, no explanation, no markdown fences. "
        "Context lines (unchanged) must be copied EXACTLY from the file content above."
    )

    patcher_user = "\n".join(prompt_parts)

    _CHARS_PER_TOKEN = 3.5
    patcher_input_chars = len(patcher_user) + len(patcher_sys)
    estimated_input_tokens = int(patcher_input_chars / _CHARS_PER_TOKEN)

    if plan_incomplete:
        print(
            f"[WARNING][Patcher] patcher_input appears INCOMPLETE — "
            f"missing planner_directive or primary file contexts. "
            f"The model may hallucinate. patcher_input keys: {list(pi.keys())}"
        )
    else:
        print(
            f"[Patcher] Input assembled: ~{estimated_input_tokens} tokens, "
            f"{len(primary_files)} primary file(s), "
            f"{len(file_contexts.get('supporting', []))} supporting file(s)."
        )

    # Append sandbox failure feedback
    sandbox_res = state.get("sandbox_result")
    if sandbox_res and sandbox_res.get("status") == "failed":
        patcher_user += (
            f"\n\n═══ SANDBOX FAILURE REPORT (Iteration {state.get('iterations', 0)}) ═══\n"
            f"{sandbox_res['output']}\n"
            f"Error class: {state.get('sandbox_error_class', 'unknown')}\n"
            "═══ ACTION REQUIRED ═══\n"
            "Fix your unified diff to address the above failure. "
            "Ensure context lines match EXACTLY what is in the file."
        )

    # Append Critic feedback (Chain of Debate)
    critic_feedback = state.get("critic_feedback")
    critic_verdict = state.get("critic_verdict")
    if critic_feedback and critic_verdict in ("REVISE",):
        patcher_user += (
            f"\n\n═══ CRITIC REVIEW (Round {state.get('debate_rounds', 0)}) ═══\n"
            f"Verdict: {critic_verdict}\n"
            f"Critique: {critic_feedback}\n"
            "═══ INSTRUCTIONS ═══\n"
            "Revise your diff to address the critic's concerns before resubmitting."
        )

    try:
        raw_diff = patcher_fn(patcher_sys, patcher_user)

        # \u2500\u2500 Post-call diagnostics \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        tgi_meta = _get_tgi_metadata()   # populated by hf_tgi_chat/_hf_tgi_call

        context_diagnostics = {
            "iteration": iteration,
            # Input analysis
            "input_chars": patcher_input_chars,
            "estimated_input_tokens": estimated_input_tokens,
            "plan_incomplete": plan_incomplete,
            "primary_file_count": len(primary_files),
            "supporting_file_count": len(file_contexts.get("supporting", [])),
            # Output analysis (from TGI response details)
            "finish_reason": tgi_meta.get("finish_reason", "unknown"),
            "output_truncated": tgi_meta.get("output_truncated", False),
            "output_chars": tgi_meta.get("output_chars", len(raw_diff)),
            # Token counts (real if TGI provided details, estimated otherwise)
            "tgi_input_tokens": tgi_meta.get("tgi_input_tokens", estimated_input_tokens),
            "tgi_output_tokens": tgi_meta.get("tgi_output_tokens"),
            "max_new_tokens": tgi_meta.get("max_new_tokens"),
            "model_context_tokens": tgi_meta.get("model_context_tokens"),
            "input_near_limit": tgi_meta.get("input_near_limit", False),
            # Input-too-large detection (from HTTP 400 analysis)
            "input_too_large": tgi_meta.get("input_too_large", False),
            "adapter_id": tgi_meta.get("adapter_id"),
        }

        # Console warnings for easy detection in server logs
        if context_diagnostics["output_truncated"]:
            print(
                f"[CRITICAL][Patcher iter={iteration}] OUTPUT TRUNCATED \u2014 "
                f"diff is INCOMPLETE (finish_reason=length). "
                f"Increase HF_TGI_PATCHER_MAX_NEW_TOKENS in .env "
                f"(current: {context_diagnostics['max_new_tokens']})."
            )
        if context_diagnostics["plan_incomplete"]:
            print(
                f"[CRITICAL][Patcher iter={iteration}] INCOMPLETE PLAN \u2014 "
                f"patcher_input is missing planner_directive or primary file contexts. "
                f"Hallucination risk is HIGH."
            )
        if context_diagnostics["input_near_limit"]:
            print(
                f"[WARNING][Patcher iter={iteration}] Input near context limit: "
                f"~{context_diagnostics['estimated_input_tokens']} tokens "
                f"(limit ~{context_diagnostics['model_context_tokens']}). "
                f"Some file context may have been cut off server-side."
            )

        return {
            **state,
            "patch": raw_diff,
            "iterations": iteration,
            "context_diagnostics": context_diagnostics,
            "status": "patch_generated"
        }
    except Exception as e:
        # Capture any TGI metadata that was written before the exception
        tgi_meta = _get_tgi_metadata()
        context_diagnostics = {
            "iteration": iteration,
            "input_chars": patcher_input_chars,
            "estimated_input_tokens": estimated_input_tokens,
            "plan_incomplete": plan_incomplete,
            "error": str(e),
            "input_too_large": tgi_meta.get("input_too_large", False),
            "server_error": tgi_meta.get("server_error"),
            "finish_reason": "error",
        }
        if tgi_meta.get("input_too_large"):
            print(
                f"[CRITICAL][Patcher iter={iteration}] INPUT TOO LARGE \u2014 "
                f"patcher_input (~{estimated_input_tokens} tokens) exceeded server context. "
                f"Reduce file contexts or set HF_TGI_MAX_CONTEXT_TOKENS correctly."
            )
        return {
            **state,
            "error": f"Patcher failed: {str(e)}",
            "context_diagnostics": context_diagnostics,
            "status": "failed"
        }



def critic_node(state: AgentState) -> AgentState:
    """
    Chain-of-Debate: The Critic analyzes the generated diff + sandbox output
    and provides structured feedback before the Patcher retries.
    """
    debate_round = state.get("debate_rounds", 0) + 1
    print(f"[LangGraph] Critic: Debate round {debate_round} for issue #{state['issue_number']}")

    # Use dedicated critic_fn if available, fall back to patcher_fn
    fns = function_registry.get(state['issue_number'], {})
    critic_fn = fns.get('critic_fn') or fns.get('patcher_fn')
    if not critic_fn:
        # No critic available — pass through with generic feedback
        return {
            **state,
            "critic_verdict": "REVISE",
            "critic_feedback": "No critic function registered. Retry based on sandbox output.",
            "debate_rounds": debate_round,
            "status": "critic_done"
        }

    sandbox_res = state.get("sandbox_result", {})
    patch = state.get("patch", "")
    patcher_input = state.get("patcher_input", {})
    error_class = state.get("sandbox_error_class", "unknown")

    critic_sys = (
        "You are a code Critic in a Chain-of-Debate pipeline. "
        "Your job is to analyze a failed diff and provide precise, actionable feedback "
        "that will help the Patcher fix it on the next attempt. "
        "Respond ONLY with a JSON object: "
        '{"verdict": "REVISE"|"REJECT", "feedback": "<precise instructions>"}'
        "\n"
        "Use REVISE if the approach is salvageable with targeted fixes. "
        "Use REJECT if the approach is fundamentally wrong and a new plan is needed."
    )

    critic_user = (
        f"ISSUE TITLE: {state.get('title', '')}\n\n"
        f"PLAN SUMMARY: {json.dumps(patcher_input.get('planner_directive', {}), default=str)[:3000]}\n\n"
        f"FAILED DIFF:\n{patch[:6000]}\n\n"
        f"SANDBOX ERROR (class={error_class}):\n{sandbox_res.get('output', '')[:4000]}\n\n"
        "Based on the above, what EXACTLY must the Patcher change in its next diff attempt?\n"
        "Be specific: reference line numbers, context lines, or hunk offsets from the error."
    )

    try:
        raw = critic_fn(critic_sys, critic_user)
        # Parse JSON response
        verdict = "REVISE"
        feedback = raw
        try:
            # Strip markdown fences if present
            clean = raw.strip()
            if clean.startswith("```"):
                clean = re.sub(r"^```[a-z]*\n?", "", clean)
                clean = re.sub(r"\n?```$", "", clean)
            parsed = json.loads(clean)
            verdict = str(parsed.get("verdict", "REVISE")).upper()
            feedback = str(parsed.get("feedback", raw))
        except (json.JSONDecodeError, AttributeError):
            # Try regex extraction
            m_v = re.search(r'"verdict"\s*:\s*"(REVISE|REJECT)"', raw, re.IGNORECASE)
            if m_v:
                verdict = m_v.group(1).upper()
            m_f = re.search(r'"feedback"\s*:\s*"([^"]*)"', raw)
            if m_f:
                feedback = m_f.group(1)

        if verdict not in ("REVISE", "REJECT"):
            verdict = "REVISE"

        print(f"[LangGraph] Critic verdict: {verdict}")
        return {
            **state,
            "critic_verdict": verdict,
            "critic_feedback": feedback,
            "debate_rounds": debate_round,
            "status": "critic_done"
        }
    except Exception as e:
        return {
            **state,
            "critic_verdict": "REVISE",
            "critic_feedback": f"Critic encountered an error: {str(e)}. Retry based on sandbox output.",
            "debate_rounds": debate_round,
            "status": "critic_done"
        }


# ──────────────────────────────────────────────────────────────────────────────
# Sandbox Node
# ──────────────────────────────────────────────────────────────────────────────
def find_test_files(repo_path: str, patched_files: list[str]) -> list[str]:
    """Given a list of patched files, find corresponding test files in the repo."""
    test_files = []
    root = Path(repo_path)
    for p in patched_files:
        path = Path(p)
        name = path.name
        if name.endswith('.py'):
            test_name = f"test_{name}"
            found = list(root.rglob(test_name))
            if found:
                test_files.append(str(found[0].relative_to(root)))
        elif name.endswith('.tsx') or name.endswith('.ts'):
            base = path.stem
            ext = path.suffix
            test_name = f"{base}.test{ext}"
            found = list(root.rglob(test_name))
            if found:
                test_files.append(str(found[0].relative_to(root)))
    return list(set(test_files))


def sandbox_node(state: AgentState) -> AgentState:
    print(f"[LangGraph] Sandbox: Testing patch — iteration {state.get('iterations', 0)}")
    patch = state.get("patch")
    repo_path = state["repo_path"]

    if not patch:
        return {**state, "error": "No patch to test", "status": "failed"}

    container_name = os.environ.get("SANDBOX_CONTAINER", "airflow-sandbox")
    container_cwd = os.environ.get("SANDBOX_CWD", "/opt/airflow")

    sandbox_result = {}
    temp_patch = None
    try:
        # 1. Clean container to pristine state
        subprocess.run(["docker", "exec", "-w", container_cwd, container_name, "git", "restore", "."], capture_output=True)
        subprocess.run(["docker", "exec", "-w", container_cwd, container_name, "git", "clean", "-fd"], capture_output=True)

        # 2. Inject the patch
        with tempfile.NamedTemporaryFile("w", delete=False) as f:
            f.write(patch)
            temp_patch = f.name

        subprocess.run(["docker", "cp", temp_patch, f"{container_name}:/tmp/changes.patch"], check=True)

        # 3. Apply the patch
        apply_cmd = ["docker", "exec", "-w", container_cwd, container_name, "patch", "-p1", "-i", "/tmp/changes.patch"]
        apply_res = subprocess.run(apply_cmd, capture_output=True, text=True)

        if apply_res.returncode != 0:
            sandbox_result = {
                "status": "failed",
                "output": f"Patch application failed:\n{apply_res.stderr}\n{apply_res.stdout}"
            }
        else:
            # 4. Validate the patch — multi-strategy depending on file type
            patched_files = state.get("plan", {}).get("files", [])
            test_files = find_test_files(repo_path, patched_files)

            # Detect whether any patched file is TypeScript/TSX
            ts_files = [f for f in patched_files if f.endswith((".ts", ".tsx", ".js", ".jsx"))]
            py_files  = [f for f in patched_files if f.endswith(".py")]

            # UI directory inside the container (where pnpm / tsc / vitest live)
            ui_dir = os.environ.get("SANDBOX_UI_DIR",
                f"{container_cwd}/airflow-core/src/airflow/ui")

            validation_outputs: list[str] = []
            all_passed = True

            # ── Strategy A: TypeScript type check (for .ts/.tsx files) ─────────
            if ts_files:
                print(f"[Sandbox] Running TypeScript type check (pnpm tsc --noEmit) for {ts_files}")
                tsc_cmd = [
                    "docker", "exec", "-w", ui_dir, container_name,
                    "pnpm", "tsc", "--noEmit", "--pretty", "false"
                ]
                tsc_res = subprocess.run(tsc_cmd, capture_output=True, text=True, timeout=180)
                tsc_out = (tsc_res.stdout + tsc_res.stderr).strip()
                validation_outputs.append(
                    f"--- TypeScript type check ---\n{tsc_out[:3000] or '(no output)'}"
                )
                if tsc_res.returncode != 0:
                    all_passed = False
                    print(f"[Sandbox] ❌ TypeScript type check FAILED (exit {tsc_res.returncode})")
                else:
                    print(f"[Sandbox] ✓ TypeScript type check passed")

            # ── Strategy B: ESLint on patched TS files ──────────────────────────
            if ts_files and all_passed:  # Only lint if types are clean
                for ts_file in ts_files[:2]:  # cap at 2 files to stay fast
                    # Path inside container is relative to container_cwd
                    container_file = f"{container_cwd}/{ts_file}"
                    print(f"[Sandbox] Running ESLint on {ts_file}")
                    lint_cmd = [
                        "docker", "exec", "-w", ui_dir, container_name,
                        "pnpm", "eslint", "--max-warnings=0",
                        "--format=compact", container_file
                    ]
                    lint_res = subprocess.run(lint_cmd, capture_output=True, text=True, timeout=60)
                    lint_out = (lint_res.stdout + lint_res.stderr).strip()
                    if lint_out:
                        validation_outputs.append(
                            f"--- ESLint: {ts_file} ---\n{lint_out[:2000]}"
                        )
                    if lint_res.returncode != 0:
                        all_passed = False
                        print(f"[Sandbox] ❌ ESLint FAILED for {ts_file}")
                    else:
                        print(f"[Sandbox] ✓ ESLint passed for {ts_file}")

            # ── Strategy C: Vitest unit tests (if test files exist for TS) ──────
            if test_files:
                print(f"[Sandbox] Running unit tests: {test_files}")
                for tf in test_files:
                    if tf.endswith((".ts", ".tsx")):
                        test_cmd = [
                            "docker", "exec", "-w", ui_dir, container_name,
                            "pnpm", "vitest", "run", tf
                        ]
                    elif tf.endswith(".py"):
                        test_cmd = [
                            "docker", "exec", "-w", container_cwd, container_name,
                            "pytest", tf, "-v", "--tb=short"
                        ]
                    else:
                        continue

                    res = subprocess.run(test_cmd, capture_output=True, text=True, timeout=120)
                    test_out = f"--- TEST: {tf} ---\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
                    validation_outputs.append(test_out)
                    if res.returncode != 0:
                        all_passed = False
                        print(f"[Sandbox] ❌ Tests FAILED: {tf}")
                    else:
                        print(f"[Sandbox] ✓ Tests passed: {tf}")

            # ── Strategy D: Python pytest (no TS involved) ───────────────────────
            elif py_files and not ts_files and not test_files:
                print(f"[Sandbox] No test files found for Python files {py_files}. Skipping test execution.")
                validation_outputs.append(
                    "No corresponding test files found. Patch applied cleanly (no tests run)."
                )

            # ── No validators ran at all (rare edge case) ────────────────────────
            if not validation_outputs:
                validation_outputs.append(
                    "Patch applied cleanly. No validation strategy matched "
                    f"(patched_files={patched_files}, test_files={test_files})."
                )

            full_output = "\n\n".join(validation_outputs)
            if all_passed:
                sandbox_result = {
                    "status": "passed",
                    "output": f"All validations passed!\n{full_output}"
                }
            else:
                sandbox_result = {
                    "status": "failed",
                    "output": f"Validation failed:\n{full_output}"
                }



    except Exception as e:
        sandbox_result = {"status": "failed", "output": f"Sandbox execution error: {str(e)}"}
    finally:
        if temp_patch and os.path.exists(temp_patch):
            os.remove(temp_patch)
        # Always revert inside the persistent container
        subprocess.run(["docker", "exec", "-w", container_cwd, container_name, "git", "restore", "."], capture_output=True)
        subprocess.run(["docker", "exec", "-w", container_cwd, container_name, "git", "clean", "-fd"], capture_output=True)

    # Classify the error so the router knows where to send next
    error_class = None
    if sandbox_result["status"] == "failed":
        error_class = classify_sandbox_error(sandbox_result["output"])
        print(f"[LangGraph] Sandbox FAILED — error class: {error_class}")
    else:
        print(f"[LangGraph] Sandbox PASSED ✓")

    history = state.get("patcher_history", [])
    history.append({
        "iteration": state.get("iterations", 0),
        "diff": patch,
        "sandbox_result": sandbox_result,
        "error_class": error_class,
        "critic_verdict": state.get("critic_verdict"),
        "critic_feedback": state.get("critic_feedback"),
        # Context / token diagnostics from the preceding patcher_node call
        "context_diagnostics": state.get("context_diagnostics"),
    })

    new_status = "sandbox_completed" if sandbox_result["status"] == "passed" else "sandbox_failed"
    return {
        **state,
        "sandbox_result": sandbox_result,
        "sandbox_error_class": error_class,
        "patcher_history": history,
        "status": new_status
    }



# ──────────────────────────────────────────────────────────────────────────────
# Routing Functions
# ──────────────────────────────────────────────────────────────────────────────
MAX_PATCHER_ITERATIONS = 3
MAX_DEBATE_ROUNDS = 2
MAX_PLANNER_ESCALATIONS = 1


def route_after_sandbox(state: AgentState) -> str:
    """
    Diagnostic Router: decides what to do after a Sandbox run.

    - sandbox passed          → end
    - error on any kind       → end (safety)
    - max iterations reached  → end
    - patcher-class error     → critic  (Chain of Debate before retry)
    - planner-class error     → escalate_planner (re-plan)
    """
    if state.get("error"):
        return "end"

    if state["status"] == "sandbox_completed":
        return "end"

    if state.get("iterations", 0) >= MAX_PATCHER_ITERATIONS:
        print(f"[LangGraph] Router: Max iterations ({MAX_PATCHER_ITERATIONS}) reached → end")
        return "end"

    error_class = state.get("sandbox_error_class", "retry_patcher")

    if error_class == "escalate_planner":
        # Only escalate to planner a limited number of times to avoid infinite loops
        # We track this via the debate_rounds field as a proxy
        escalations = state.get("debate_rounds", 0)
        if escalations >= MAX_PLANNER_ESCALATIONS:
            print(f"[LangGraph] Router: Max planner escalations reached → end")
            return "end"
        print(f"[LangGraph] Router: Planner-class error detected → escalate_planner")
        return "escalate_planner"

    # Patcher-class error: go through Critic first (Chain of Debate)
    if state.get("debate_rounds", 0) < MAX_DEBATE_ROUNDS:
        print(f"[LangGraph] Router: Patcher-class error → critic (debate round {state.get('debate_rounds',0)+1})")
        return "critic"

    # Debate exhausted — retry patcher directly
    print(f"[LangGraph] Router: Debate exhausted → retry_patcher directly")
    return "retry_patcher"


def route_after_critic(state: AgentState) -> str:
    """After the Critic speaks, decide to retry or escalate to planner."""
    verdict = state.get("critic_verdict", "REVISE")
    if verdict == "REJECT":
        print(f"[LangGraph] Critic REJECTED approach → escalate_planner")
        return "escalate_planner"
    print(f"[LangGraph] Critic said REVISE → retry_patcher")
    return "retry_patcher"


# ──────────────────────────────────────────────────────────────────────────────
# Planner Graph Definition
# ──────────────────────────────────────────────────────────────────────────────
planner_workflow = StateGraph(AgentState)
planner_workflow.add_node("orchestrator", orchestrator_node)
planner_workflow.add_node("planner", planner_node)

planner_workflow.set_entry_point("orchestrator")
planner_workflow.add_edge("orchestrator", "planner")
planner_workflow.add_edge("planner", END)

planner_graph = planner_workflow.compile()


# ──────────────────────────────────────────────────────────────────────────────
# Patcher Graph Definition (with CoD + Diagnostic Routing)
# ──────────────────────────────────────────────────────────────────────────────
patcher_workflow = StateGraph(AgentState)

patcher_workflow.add_node("patcher_prep", patcher_prep_node)
patcher_workflow.add_node("patcher", patcher_node)
patcher_workflow.add_node("sandbox", sandbox_node)
patcher_workflow.add_node("critic", critic_node)

# Entry: prep → patcher → sandbox
patcher_workflow.set_entry_point("patcher_prep")
patcher_workflow.add_edge("patcher_prep", "patcher")
patcher_workflow.add_edge("patcher", "sandbox")

# After sandbox: diagnostic routing
patcher_workflow.add_conditional_edges(
    "sandbox",
    route_after_sandbox,
    {
        "end": END,
        "critic": "critic",
        "retry_patcher": "patcher",
        "escalate_planner": END,   # Surface to caller; re-plan is triggered in app.py
    }
)

# After critic: route to patcher or escalate
patcher_workflow.add_conditional_edges(
    "critic",
    route_after_critic,
    {
        "retry_patcher": "patcher",
        "escalate_planner": END,
    }
)

patcher_graph = patcher_workflow.compile()
