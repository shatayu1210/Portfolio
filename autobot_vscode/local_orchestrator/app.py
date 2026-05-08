"""
Local orchestrator for the AutoBot VS Code extension.

Modes (AUTOBOT_MODE):
  - google_ai → Google AI Studio API key (GOOGLE_API_KEY); uses ChatGoogleGenerativeAI.
  - vertex    → Vertex AI GenerativeModel.generateContent (GCP + ADC).
  - ollama    → local Ollama.
  - stub      → canned JSON (no LLM).

Run with:
  uvicorn app:app --host 127.0.0.1 --port 5000 --reload

POST /api/orchestrate  JSON: { "command": "ask_issue"|"plan_patch"|"accept_plan"|"open_pr"|"query", ... }
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langgraph_workflow import planner_graph, patcher_graph, function_registry
import ssl

# Workaround for macOS Python SSL certificate issues with urllib
ssl._create_default_https_context = ssl._create_unverified_context

load_dotenv()

app = FastAPI(title="AutoBot Local Orchestrator", version="1.0.0")

# Allow the VS Code webview origin (vscode-webview://) and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus metrics (/metrics endpoint for Prometheus scraping) ────────────
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)

AUTOBOT_MODE = os.environ.get("AUTOBOT_MODE", "stub").lower()
AUTOBOT_STOP_AT = os.environ.get("AUTOBOT_STOP_AT", "").strip().lower()

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b")

GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "").strip()
# Gemini on Vertex is most reliably available in us-central1; us-west1 often 404s for the same model ID.
GCP_LOCATION = os.environ.get("GCP_LOCATION", "us-central1").strip()
# Vertex: prefer names without "-001" for auto-updated versions (see inference docs).
# If you still get 404, try gemini-1.5-flash-002 and confirm region in Model Garden.
VERTEX_MODEL = os.environ.get("VERTEX_MODEL", "gemini-2.5-flash").strip()

# Google AI Studio / Gemini Developer API (API key — not Vertex)
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "").strip()
# Google AI (API key): 2.0-flash is deprecated for new users; use 2.5+ (see Google error NOT_FOUND).
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_OWNER = os.environ.get("GITHUB_OWNER", "apache").strip()
GITHUB_REPO = os.environ.get("GITHUB_REPO", "airflow").strip()

# ── HuggingFace TGI endpoint (LoRA adapters for Planner / Patcher / Critic) ──
# Set AUTOBOT_MODE=hf_tgi to use your deployed TGI endpoint
HF_TGI_ENDPOINT = os.environ.get("HF_TGI_ENDPOINT", "").strip()  # e.g. https://abc.endpoints.huggingface.cloud
HF_TGI_TOKEN    = os.environ.get("HF_TGI_TOKEN", "").strip()     # HF access token
HF_PLANNER_ADAPTER = os.environ.get("HF_PLANNER_ADAPTER", "").strip()  # e.g. shatayu1210/autobot-planner-lora
HF_PATCHER_ADAPTER = os.environ.get("HF_PATCHER_ADAPTER", "").strip()  # e.g. shatayu1210/autobot-patcher-lora
HF_CRITIC_ADAPTER  = os.environ.get("HF_CRITIC_ADAPTER",  "").strip()  # e.g. shatayu1210/autobot-critic-lora

SKIP_DIR_NAMES = {
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    "node_modules",
    "build",
    ".eggs",
    ".mypy_cache",
    ".pytest_cache",
}

_google_llm = None
_vertex_initialized = False

# ── TGI call metadata sink ────────────────────────────────────────────────────
# Written by hf_tgi_chat after every call so that workflow nodes can inspect
# finish_reason, token counts, and truncation flags without changing the
# chat_fn signature (which must stay (str, str) -> str).
_tgi_call_metadata: dict[str, Any] = {}

# Rough estimate: 1 token ≈ 3.5 chars for code/JSON payloads
_CHARS_PER_TOKEN: float = 3.5
# Known model context window (input + output tokens)
# Adjust if your TGI deployment uses a different --max-total-tokens
_MODEL_CONTEXT_TOKENS: int = int(os.environ.get("HF_TGI_MAX_CONTEXT_TOKENS", "8192"))
# max_new_tokens for diff generation (diffs can be longer than a planning response)
_PATCHER_MAX_NEW_TOKENS: int = int(os.environ.get("HF_TGI_PATCHER_MAX_NEW_TOKENS", "2048"))


def hf_tgi_chat(adapter_id: str, max_new_tokens: int = 1024) -> "Callable[[str, str], str]":
    """General-purpose HF TGI chat function (planner, critic, etc.)."""
    return _hf_tgi_call(adapter_id, max_new_tokens=max_new_tokens, role="general")


def hf_tgi_patcher_chat(adapter_id: str) -> "Callable[[str, str], str]":
    """Patcher-specific variant with higher max_new_tokens for long diffs."""
    return _hf_tgi_call(adapter_id, max_new_tokens=_PATCHER_MAX_NEW_TOKENS, role="patcher")


def _hf_tgi_call(adapter_id: str, max_new_tokens: int, role: str) -> "Callable[[str, str], str]":
    """
    Returns a chat_fn that calls the HF TGI /generate endpoint.
    Writes diagnostics to _tgi_call_metadata after every call:
      input_chars, estimated_input_tokens, output_chars, finish_reason,
      output_truncated (bool), input_near_limit (bool), role
    """
    import requests
    def _call(system: str, user: str) -> str:
        global _tgi_call_metadata
        prompt = f"<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n"

        input_chars = len(prompt)
        estimated_input_tokens = int(input_chars / _CHARS_PER_TOKEN)
        input_near_limit = estimated_input_tokens > int(_MODEL_CONTEXT_TOKENS * 0.85)

        # Pre-call warning: input may be too large
        if input_near_limit:
            print(
                f"[WARNING][TGI/{role}] Large input detected: ~{estimated_input_tokens} tokens "
                f"(limit ~{_MODEL_CONTEXT_TOKENS}). Input may be truncated by the server."
            )

        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_new_tokens,
                "temperature": 0.1,
                "details": True,          # Ask TGI for finish_reason + token counts
            },
            **(  {"model": adapter_id} if adapter_id else {}  ),
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {HF_TGI_TOKEN}",
        }

        try:
            resp = requests.post(
                f"{HF_TGI_ENDPOINT}/generate",
                json=payload,
                headers=headers,
                timeout=180,
            )
        except requests.exceptions.Timeout:
            _tgi_call_metadata = {
                "role": role, "input_chars": input_chars,
                "estimated_input_tokens": estimated_input_tokens,
                "error": "request_timeout",
            }
            raise Exception("TGI request timed out after 180s")

        # HTTP 400 almost always means the input exceeded the model's context
        if resp.status_code == 400:
            err_body = resp.text[:500]
            is_input_too_large = any(kw in err_body.lower() for kw in (
                "input_too_large", "input length", "max_input_length",
                "exceeds model max length", "sequence length",
            ))
            _tgi_call_metadata = {
                "role": role,
                "input_chars": input_chars,
                "estimated_input_tokens": estimated_input_tokens,
                "error": "input_too_large" if is_input_too_large else "http_400",
                "input_too_large": is_input_too_large,
                "server_error": err_body,
            }
            if is_input_too_large:
                print(
                    f"[ERROR][TGI/{role}] INPUT TOO LARGE — server rejected request. "
                    f"Estimated ~{estimated_input_tokens} tokens "
                    f"(limit ~{_MODEL_CONTEXT_TOKENS}). "
                    f"The patcher_input must be pruned. Server: {err_body[:200]}"
                )
            raise Exception(f"HTTP {resp.status_code}: {resp.text}")

        if not resp.ok:
            _tgi_call_metadata = {
                "role": role, "input_chars": input_chars,
                "estimated_input_tokens": estimated_input_tokens,
                "error": f"http_{resp.status_code}",
            }
            raise Exception(f"HTTP {resp.status_code}: {resp.text}")

        result = resp.json()
        generated_text = result.get("generated_text", "")

        # Extract TGI generation details
        details = result.get("details", {})
        finish_reason = details.get("finish_reason", "unknown")   # "eos_token"|"length"|"stop_sequence"
        tgi_input_tokens  = details.get("prefill_tokens", estimated_input_tokens)
        tgi_output_tokens = details.get("generated_tokens", int(len(generated_text) / _CHARS_PER_TOKEN))

        output_truncated = (finish_reason == "length")
        if output_truncated:
            print(
                f"[WARNING][TGI/{role}] OUTPUT TRUNCATED — generation hit max_new_tokens={max_new_tokens}. "
                f"The diff is incomplete! Output chars: {len(generated_text)}. "
                f"Increase HF_TGI_PATCHER_MAX_NEW_TOKENS in .env."
            )

        _tgi_call_metadata = {
            "role": role,
            "input_chars": input_chars,
            "output_chars": len(generated_text),
            "estimated_input_tokens": estimated_input_tokens,
            "tgi_input_tokens": tgi_input_tokens,
            "tgi_output_tokens": tgi_output_tokens,
            "max_new_tokens": max_new_tokens,
            "model_context_tokens": _MODEL_CONTEXT_TOKENS,
            "finish_reason": finish_reason,
            "output_truncated": output_truncated,
            "input_near_limit": input_near_limit,
            "adapter_id": adapter_id or "(base)",
        }

        return generated_text
    return _call


def get_tgi_last_call_metadata() -> dict:
    """Return the metadata dict written by the most recent TGI call."""
    return dict(_tgi_call_metadata)


def _legacy_hf_tgi_chat(adapter_id: str) -> "Callable[[str, str], str]":
    """Kept for reference only — superseded by hf_tgi_chat."""
    return hf_tgi_chat(adapter_id)







def get_google_ai_llm():
    global _google_llm
    if _google_llm is not None:
        return _google_llm
    if not GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is not set for google_ai mode")
    from langchain_google_genai import ChatGoogleGenerativeAI

    _google_llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=GOOGLE_API_KEY,
    )
    return _google_llm


def google_ai_chat(system: str, user: str) -> str:
    from langchain_core.messages import HumanMessage, SystemMessage

    llm = get_google_ai_llm()
    resp = llm.invoke(
        [SystemMessage(content=system), HumanMessage(content=user)])
    content = getattr(resp, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and "text" in block:
                parts.append(str(block["text"]))
            else:
                parts.append(str(block))
        return "\n".join(parts)
    return str(resp)


def _ensure_vertex_init() -> None:
    """Vertex AI SDK init (same project/region as REST generateContent)."""
    global _vertex_initialized
    if _vertex_initialized:
        return
    if not GCP_PROJECT_ID:
        raise RuntimeError("GCP_PROJECT_ID is not set for vertex mode")
    import vertexai

    vertexai.init(project=GCP_PROJECT_ID, location=GCP_LOCATION)
    _vertex_initialized = True


def vertex_chat(system: str, user: str) -> str:
    """
    Vertex AI Gemini via GenerativeModel.generateContent (see inference docs).
    https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference
    """
    _ensure_vertex_init()
    from vertexai.generative_models import GenerativeModel

    model = GenerativeModel(VERTEX_MODEL, system_instruction=system)
    response = model.generate_content(user)
    if not response.candidates:
        fr = getattr(response, "prompt_feedback", None)
        return f"[blocked or empty response] {fr!r}"
    try:
        return (response.text or "").strip()
    except ValueError:
        return ""


def ollama_chat(system: str, user: str, timeout_s: int = 600) -> str:
    url = f"{OLLAMA_HOST}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    msg = body.get("message") or {}
    return str(msg.get("content") or "")


def ollama_available() -> bool:
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def extract_json_object(text: str) -> dict[str, Any]:
    """Extract a JSON object from text, handling markdown fences and raw JSON."""
    text = text.strip()
    # Try to find the first '{' and last '}'
    start = text.find('{')
    end = text.rfind('}')
    
    if start != -1 and end != -1 and end > start:
        json_str = text[start : end + 1]
        try:
            data = json.loads(json_str)
            if isinstance(data, dict):
                return data
            # If it's a list, wrap it or handle it in the caller
            return {"raw_list": data}
        except json.JSONDecodeError:
            pass

    # Fallback to simple load for cases like "```json\n...\n```"
    fence = re.match(r"^```(?:json)?\s*\n([\s\S]*?)\n```\s*$", text)
    if fence:
        text = fence.group(1).strip()
    
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
        return {"raw_list": data} if isinstance(data, list) else {"value": data}
    except json.JSONDecodeError:
        raise ValueError(f"Could not parse JSON from: {text[:200]}...")


def fetch_github_issue(issue_number: int) -> dict[str, Any] | None:
    if not GITHUB_TOKEN:
        return None
    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/issues/{issue_number}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    return {
        "issue_number": issue_number,
        "title": data.get("title", ""),
        "body": data.get("body") or "",
        "state": data.get("state", ""),
        "html_url": data.get("html_url", ""),
        "created_at": data.get("created_at", ""),
        "assignee": data.get("assignee"),
        "note": f"live GitHub issue from {GITHUB_OWNER}/{GITHUB_REPO}",
    }


def collect_repo_files(repo_root: str, max_files: int = 280) -> list[str]:
    root = Path(repo_root).expanduser().resolve()
    if not root.is_dir():
        return []
    out: list[str] = []
    for p in root.rglob("*"):
        if len(out) >= max_files:
            break
        if p.is_dir():
            continue
        try:
            rel = p.relative_to(root)
        except ValueError:
            continue
        rel_s = str(rel).replace("\\", "/")
        if "airflow/www/static/dist" in rel_s:
            continue
        parts = rel.parts
        if any(x in SKIP_DIR_NAMES for x in parts):
            continue
        if p.name.startswith(".") and p.name != ".flake8":
            continue
        if rel_s.endswith((".py", ".yaml", ".yml", ".md", ".rst")):
            out.append(rel_s)
    out.sort()
    return out[:max_files]


def readme_snippet(repo_root: str, max_lines: int = 35) -> str:
    root = Path(repo_root).expanduser().resolve()
    for name in ("README.md", "README.rst"):
        p = root / name
        if p.is_file():
            try:
                lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
                return "\n".join(lines[:max_lines])
            except OSError:
                continue
    return ""


def build_repo_context(repo_path: str) -> str:
    files = collect_repo_files(repo_path)
    readme = readme_snippet(repo_path)
    lines = [
        f"Repository root: {repo_path}",
        f"File sample ({len(files)} paths, Python/YAML/Markdown only; truncated):",
    ]
    lines.extend(files[:280])
    if readme:
        lines.append("\n--- README excerpt ---\n")
        lines.append(readme)
    return "\n".join(lines)


def stub_ask_issue(issue_number: int) -> dict[str, Any]:
    gh = fetch_github_issue(issue_number)
    if gh:
        return gh
    return {
        "issue_number": issue_number,
        "title": f"[STUB] Issue #{issue_number}",
        "body": "Stub issue — set GITHUB_TOKEN + GITHUB_OWNER/GITHUB_REPO for live GitHub data.",
        "state": "open",
        "html_url": f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/issues/{issue_number}",
    }

def stub_ask_pr(pr_number: int) -> dict[str, Any]:
    gh = gh_get_pr(pr_number)
    if gh:
        return gh
    return {
        "pr_number": pr_number,
        "title": f"[STUB] PR #{pr_number}",
        "body": "Stub PR — set GITHUB_TOKEN + GITHUB_OWNER/GITHUB_REPO for live GitHub data.",
        "state": "open",
        "html_url": f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/pull/{pr_number}",
    }


def stub_plan(issue_number: int, repo_path: str) -> dict[str, Any]:
    plan = {
        "summary": "Stub plan (AUTOBOT_MODE=stub).",
        "files": ["airflow/__init__.py"],
        "steps": ["Inspect code", "Add fix", "Test"],
    }
    code_spans = [
        {
            "file": "airflow/example_dags/example.py",
            "symbol": "main",
            "start_line": 1,
            "end_line": 20,
        }
    ]
    return {
        "issue_number": issue_number,
        "repo_path": repo_path,
        "plan": plan,
        "code_spans": code_spans,
        "note": "stub planner",
    }


def parse_plan_response(raw: str, backend: str) -> dict[str, Any]:
    parsed = extract_json_object(raw)
    plan = {
        "summary": str(parsed.get("summary", "")),
        "files": list(parsed.get("files") or []),
        "steps": list(parsed.get("steps") or []),
    }
    spans = parsed.get("code_spans") or []
    code_spans: list[dict[str, Any]] = []
    for s in spans:
        if not isinstance(s, dict):
            continue
        start_line = max(1, int(s.get("start_line", 1)))
        end_line = max(start_line, int(s.get("end_line", max(10, start_line))))
        code_spans.append(
            {
                "file": str(s.get("file", "airflow/__init__.py")),
                "symbol": str(s.get("symbol", "unknown")),
                "start_line": start_line,
                "end_line": end_line,
            }
        )
    if not code_spans:
        code_spans = [
            {
                "file": "README.md",
                "symbol": "n/a",
                "start_line": 1,
                "end_line": 5,
            }
        ]
    return {
        "plan": plan,
        "code_spans": code_spans,
        "raw_model_text": raw[:4000],
        "note": f"planner via {backend}",
    }


def llm_plan(
    chat_fn: Callable[[str, str], str],
    issue_number: int,
    repo_path: str,
    issue_title: str,
    issue_body: str,
    backend: str,
) -> dict[str, Any]:
    system = (
        "You are the Planner for the Apache Airflow codebase. "
        "Output a single JSON object only — no markdown fences, no commentary. "
        "Schema: {\n"
        '  "summary": string,\n'
        '  "files": string[],\n'
        '  "steps": string[],\n'
        '  "code_spans": [{ "file": string, "symbol": string, "start_line": number, "end_line": number }]\n'
        "}\n"
        "Use file paths that appear in the repository listing. Prefer paths under airflow/."
    )
    ctx = build_repo_context(repo_path)
    user = (
        f"GitHub issue #{issue_number}\n"
        f"Title: {issue_title}\n\n"
        f"Body:\n{issue_body[:12000]}\n\n"
        f"--- Repository context ---\n{ctx[:80000]}\n"
    )
    raw = chat_fn(system, user)
    out = parse_plan_response(raw, backend)
    return {
        "issue_number": issue_number,
        "repo_path": repo_path,
        "plan": out["plan"],
        "code_spans": out["code_spans"],
        "note": out["note"],
        "raw_model_text": out["raw_model_text"],
    }


def llm_patch_and_critic(
    chat_fn: Callable[[str, str], str],
    issue_title: str,
    issue_body: str,
    plan: Any,
    code_spans: Any,
    backend: str,
    max_iterations: int = 3,
) -> dict[str, Any]:
    plan_s = json.dumps(plan, indent=2) if not isinstance(plan, str) else plan
    spans_s = json.dumps(code_spans, indent=2) if not isinstance(code_spans, str) else code_spans

    def _strip_fences(text: str) -> str:
        text = text.strip()
        if not text.startswith("```"):
            return text
        lines = text.splitlines()
        inner: list[str] = []
        first = True
        for line in lines:
            if first:
                first = False
                continue
            if line.strip() == "```":
                break
            inner.append(line)
        return "\n".join(inner).strip()

    def _validate_diff(diff_text: str) -> str:
        lines = [ln for ln in diff_text.splitlines() if ln.strip()]
        if not lines:
            return "ERROR: diff is empty"
        if not any(ln.startswith("--- ") for ln in lines):
            return "ERROR: missing '--- ' header"
        if not any(ln.startswith("+++ ") for ln in lines):
            return "ERROR: missing '+++ ' header"
        if not any(ln.startswith("@@ ") for ln in lines):
            return "ERROR: missing '@@ ' hunk header"
        # Reject diffs whose only changes are blank-line insertions/deletions —
        # this is the model generating a structurally valid but semantically empty diff.
        added_lines   = [ln[1:] for ln in diff_text.splitlines() if ln.startswith("+") and not ln.startswith("+++")]
        removed_lines = [ln[1:] for ln in diff_text.splitlines() if ln.startswith("-") and not ln.startswith("---")]
        substantive_adds    = [ln for ln in added_lines   if ln.strip()]
        substantive_removes = [ln for ln in removed_lines if ln.strip()]
        if not substantive_adds and not substantive_removes:
            return (
                "ERROR: diff only adds/removes blank lines — no real code changes detected. "
                "You must output a diff that adds or modifies actual code (not just whitespace)."
            )
        return "VALID"

    def _extract_diff_payload(raw: str) -> str:
        text = _strip_fences(raw)
        idx = text.find("diff --git ")
        if idx != -1:
            return text[idx:].strip()

        # Fallback: many models emit unified hunks without diff --git header.
        # If we can find ---/+++ headers, normalize to full git diff.
        lines = text.splitlines()
        start = -1
        for i, ln in enumerate(lines):
            if ln.startswith("--- "):
                start = i
                break
        if start == -1:
            return text.strip()

        chunk = lines[start:]
        minus = ""
        plus = ""
        for ln in chunk:
            if ln.startswith("--- ") and not minus:
                minus = ln[4:].strip()
            elif ln.startswith("+++ ") and not plus:
                plus = ln[4:].strip()
            if minus and plus:
                break

        if not minus or not plus:
            return "\n".join(chunk).strip()

        def _clean(path: str) -> str:
            p = path
            if p.startswith("a/") or p.startswith("b/"):
                p = p[2:]
            return p

        a_path = _clean(minus)
        b_path = _clean(plus)
        if a_path == "/dev/null":
            a_path = b_path
        if b_path == "/dev/null":
            b_path = a_path

        return (
            f"diff --git a/{a_path} b/{b_path}\n" + "\n".join(chunk).strip()
        )

    def _touched_files(diff_text: str) -> list[str]:
        files: list[str] = []
        for line in diff_text.splitlines():
            if line.startswith("+++ "):
                path = line[4:].strip()
                if path.startswith("b/"):
                    path = path[2:]
                files.append(path)
        return files

    def _parse_critic(raw: str) -> tuple[str, str]:
        response_text = _strip_fences(raw)
        verdict = "REVISE"
        feedback = ""
        try:
            parsed = json.loads(response_text)
            verdict = str(parsed.get("verdict", "REVISE")).upper()
            feedback = str(parsed.get("feedback", ""))
        except Exception:
            match = re.search(r'"verdict"\s*:\s*"(ACCEPT|REVISE|REJECT)"', response_text)
            if match:
                verdict = match.group(1)
            fb_match = re.search(r'"feedback"\s*:\s*"([^"]*)"', response_text)
            feedback = fb_match.group(1) if fb_match else response_text[:800]
        if verdict not in ("ACCEPT", "REVISE", "REJECT"):
            verdict = "REVISE"
        return verdict, feedback

    last_diff = ""
    last_verdict = "REVISE"
    last_feedback = ""
    progress: list[str] = []
    plan_files = []
    if isinstance(plan, dict):
        plan_files = [str(p) for p in (plan.get("files") or [])]

    for iteration in range(max_iterations):
        feedback_section = f"\nCRITIC FEEDBACK TO ADDRESS:\n{last_feedback}\n" if last_feedback else ""

        patcher_sys = (
            "You are a code Patcher. Generate a unified diff implementing this plan. "
            "Output ONLY a unified diff in standard git format. No explanation."
        )
        patcher_user = (
            f"PLAN:\n{plan_s}\n\n"
            f"CODE SPANS:\n{spans_s}\n"
            f"{feedback_section}\n"
            "Each file must include proper diff --git, --- / +++ headers and @@ hunks. "
            "Touch planned files first; do not return README placeholder text. "
            "Return ONLY the diff text, no prose and no markdown fences."
        )
        try:
            raw_diff = chat_fn(patcher_sys, patcher_user)
        except Exception as e:
            raise RuntimeError(f"[PATCHER] {e}") from e
        diff_text = _extract_diff_payload(raw_diff)
        validation = _validate_diff(diff_text)
        touched = _touched_files(diff_text)
        if validation == "VALID" and plan_files:
            if not any(tf in plan_files for tf in touched):
                validation = (
                    "ERROR: diff does not modify planned files; "
                    f"planned={plan_files} touched={touched}"
                )
        progress.append(f"Patcher (iter {iteration}): {validation}")

        if validation != "VALID":
            last_diff = diff_text
            last_verdict = "REVISE"
            last_feedback = f"Generate a valid unified diff. {validation}"
            progress.append(f"Skipping critic (iter {iteration}) due to invalid patch")
            continue

        critic_sys = (
            "You are a code Critic. Evaluate this diff against the issue and plan. "
            "Respond with JSON only: "
            '{"verdict":"ACCEPT|REVISE|REJECT","feedback":"..."}'
        )
        critic_user = (
            f"ISSUE_TITLE: {issue_title}\n"
            f"ISSUE_BODY: {issue_body[:12000]}\n\n"
            f"PLAN:\n{plan_s}\n\n"
            f"DIFF:\n{diff_text[:12000]}\n\n"
            "ACCEPT if diff is correct and review-ready. "
            "REVISE if fixable issues remain. "
            "REJECT if approach is fundamentally wrong."
        )
        try:
            raw_critic = chat_fn(critic_sys, critic_user)
        except Exception as e:
            raise RuntimeError(f"[CRITIC] {e}") from e
        verdict, feedback = _parse_critic(raw_critic)
        progress.append(f"Critic (iter {iteration}): verdict={verdict}")

        last_diff = diff_text
        last_verdict = verdict
        last_feedback = feedback

        if verdict in ("ACCEPT", "REJECT"):
            return {
                "diff": last_diff,
                "verdict": last_verdict,
                "reasoning": last_feedback,
                "plan_echo": plan,
                "iterations_used": iteration + 1,
                "note": f"patcher+critic via {backend}",
                "progress": progress,
            }

    return {
        "diff": "",
        "verdict": "REJECT",
        "reasoning": (
            "Patcher could not produce a valid unified diff touching planned files "
            f"after {max_iterations} iterations. Last feedback: {last_feedback}"
        ),
        "plan_echo": plan,
        "iterations_used": max_iterations,
        "note": f"patcher+critic via {backend}",
        "progress": progress + [f"Loop exhausted after {max_iterations} iterations"],
    }


def _issue_title_body(issue_number: int) -> tuple[str, str]:
    gh = fetch_github_issue(issue_number)
    if gh:
        return str(gh.get("title") or ""), str(gh.get("body") or "")
    return (
        f"[STUB] Issue #{issue_number}",
        "No GitHub token — using stub title/body. Set GITHUB_TOKEN for real issue text.",
    )


# ── GitHub REST helpers for adhoc queries ──────────────────────────────────


def _github_get(path: str) -> dict | list | None:
    """Authenticated GET against the GitHub REST API. Returns parsed JSON or None."""
    if not GITHUB_TOKEN:
        return None
    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/{path.lstrip('/')}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        return None


def gh_get_issue(issue_number: int) -> dict | None:
    """Get a single issue by number."""
    return _github_get(f"issues/{issue_number}")


def gh_get_issue_comments(issue_number: int) -> list | None:
    """Get comments on an issue."""
    return _github_get(f"issues/{issue_number}/comments")


def gh_get_issue_timeline(issue_number: int) -> list | None:
    """Get timeline events for an issue."""
    return _github_get(f"issues/{issue_number}/timeline")


def gh_get_pr(pr_number: int) -> dict | None:
    """Get a single pull request by number."""
    return _github_get(f"pulls/{pr_number}")


def gh_get_pr_files(pr_number: int) -> list | None:
    """Get files changed by a pull request."""
    return _github_get(f"pulls/{pr_number}/files")


def gh_get_pr_reviews(pr_number: int) -> list | None:
    """Get reviews on a pull request."""
    return _github_get(f"pulls/{pr_number}/reviews")


def gh_get_pr_commits(pr_number: int) -> list | None:
    """Get commits in a pull request."""
    return _github_get(f"pulls/{pr_number}/commits")


def gh_get_pr_ci_status(pr_number: int) -> dict | None:
    """Get CI check-runs for a PR's head SHA."""
    pr = gh_get_pr(pr_number)
    if not pr:
        return None
    sha = pr.get("head", {}).get("sha", "")
    if not sha:
        return None
    return _github_get(f"commits/{sha}/check-runs")


def gh_search_issues(query: str, max_results: int = 10) -> list | None:
    """Search issues/PRs using GitHub search syntax."""
    if not GITHUB_TOKEN:
        return None
    q = f"repo:{GITHUB_OWNER}/{GITHUB_REPO} {query}"
    url = f"https://api.github.com/search/issues?q={urllib.request.quote(q)}&per_page={max_results}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("items", [])[:max_results]
    except urllib.error.HTTPError:
        return None


# ── Tool registry for LLM tool-calling ─────────────────────────────────────

# Each entry: (callable, description_for_llm)
GITHUB_TOOLS: dict[str, tuple[Any, str]] = {
    "get_issue": (
        lambda issue_number: gh_get_issue(int(issue_number)),
        "Get a GitHub issue by number. Args: issue_number (int)",
    ),
    "get_issue_comments": (
        lambda issue_number: gh_get_issue_comments(int(issue_number)),
        "Get comments on a GitHub issue. Args: issue_number (int)",
    ),
    "get_issue_timeline": (
        lambda issue_number: gh_get_issue_timeline(int(issue_number)),
        "Get timeline events for a GitHub issue. Args: issue_number (int)",
    ),
    "get_pr": (
        lambda pr_number: gh_get_pr(int(pr_number)),
        "Get a GitHub pull request by number. Args: pr_number (int)",
    ),
    "get_pr_files": (
        lambda pr_number: gh_get_pr_files(int(pr_number)),
        "Get files changed in a pull request. Args: pr_number (int)",
    ),
    "get_pr_reviews": (
        lambda pr_number: gh_get_pr_reviews(int(pr_number)),
        "Get reviews on a pull request. Args: pr_number (int)",
    ),
    "get_pr_commits": (
        lambda pr_number: gh_get_pr_commits(int(pr_number)),
        "Get commits in a pull request. Args: pr_number (int)",
    ),
    "get_pr_ci_status": (
        lambda pr_number: gh_get_pr_ci_status(int(pr_number)),
        "Get CI check-run status for a PR. Args: pr_number (int)",
    ),
    "search_issues": (
        lambda query, max_results=10: gh_search_issues(str(query), int(max_results)),
        "Search GitHub issues/PRs by keyword. Args: query (str), max_results (int, default 10)",
    ),
}

# Add GraphRAG tools if neo4j is available
try:
    from graphrag_client import similar_issues, linked_prs_for_issues, neo4j_available as _neo4j_ok

    if _neo4j_ok():
        GITHUB_TOOLS["graphrag_similar_issues"] = (
            lambda issue_number, k=5: similar_issues(int(issue_number), int(k)),
            "Find top-K issues similar to a given issue using GraphRAG vector search. Args: issue_number (int), k (int, default 5)",
        )
        GITHUB_TOOLS["graphrag_linked_prs"] = (
            lambda issue_numbers: linked_prs_for_issues([int(n) for n in issue_numbers]),
            "Find PRs linked to a list of issue numbers in the graph. Args: issue_numbers (list[int])",
        )
except ImportError:
    pass  # neo4j driver not installed — skip GraphRAG tools


# ── Query router: deterministic classification before LLM tool planning ────

_GRAPHRAG_KEYWORDS = [
    "similar to", "like issue", "like #", "historical", "in the past",
    "past issues", "closed like", "resolved like", "related issues",
    "similar bugs", "same kind", "how long did it take",
    "average resolution", "which files do they", "files usually modified",
    "files modified in similar", "prs that fixed", "prs linked to",
    "neighbour", "neighbor", "historically",
]

_LIVE_ONLY_KEYWORDS = [
    "latest", "recent issues", "opened today", "opened this week",
    "status of pr", "ci status", "who merged", "who closed",
    "current assignee", "what changed in pr", "files in pr",
]


def _classify_query(query: str) -> str:
    """
    Returns 'graphrag', 'live', or 'mixed' based on keyword heuristics.
    This runs before the LLM tool planner to restrict the available tool list.
    """
    q = query.lower()
    if any(kw in q for kw in _GRAPHRAG_KEYWORDS):
        return "graphrag"
    if any(kw in q for kw in _LIVE_ONLY_KEYWORDS):
        return "live"
    return "mixed"


# ── Soft guardrail for adhoc queries ───────────────────────────────────────

GUARDRAIL_PROMPT = (
    "You are a security guardrail. Classify if the user's query is relevant to:\n"
    "1. GitHub issues, pull requests, commits, code reviews, or CI status.\n"
    "2. The Apache Airflow software repository.\n"
    "3. General software engineering tasks within the scope of this project.\n\n"
    "If it is relevant, output exactly: YES\n"
    "If it is NOT relevant (e.g. general chat, jokes, recipes, unrelated domains), output exactly: NO"
)


def _hyperlink_refs(text: str) -> str:
    """Replace bare #N references with HTML anchors linking to GitHub."""
    base = f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}"
    text = re.sub(
        r"(?<!\w)#(\d{3,6})(?!\w)",
        lambda m: f'<a href="{base}/issues/{m.group(1)}">#{m.group(1)}</a>',
        text,
    )
    text = re.sub(
        r"\bPR #(\d{3,6})\b",
        lambda m: f'<a href="{base}/pull/{m.group(1)}">PR #{m.group(1)}</a>',
        text,
    )
    return text


from fastapi.responses import JSONResponse, StreamingResponse
import asyncio

async def llm_adhoc_query_stream(chat_fn: Callable[[str, str], str], user_query: str):
    """Streaming version of adhoc query."""
    def yield_event(event_type: str, data: dict):
        payload = json.dumps({"type": event_type, **data})
        return f"data: {payload}\n\n"

    # Pass 0: Soft guardrail
    yield yield_event("step", {"msg": "Checking query relevance..."})
    await asyncio.sleep(0.01) # Yield to event loop
    relevance = await asyncio.to_thread(chat_fn, GUARDRAIL_PROMPT, user_query)
    relevance = relevance.strip().upper()
    
    if "NO" in relevance and "YES" not in relevance:
        ans = (
            "I am AutoBot, an assistant dedicated to the Apache Airflow repository. "
            "I can help with GitHub issues, PRs, CI status, code reviews, and repository queries. "
            "I'm unable to assist with questions outside this scope."
        )
        yield yield_event("done", {"answer": ans, "tools_called": [], "guardrail_blocked": True})
        return

    # Pass 1: Plan — filter tools based on query classification
    yield yield_event("step", {"msg": "Planning tool execution..."})
    await asyncio.sleep(0.01)

    route = _classify_query(user_query)
    if route == "graphrag":
        active_tools = {k: v for k, v in GITHUB_TOOLS.items() if "graphrag" in k}
        if not active_tools:
            ans = "It looks like you're asking about historical or similar issues, which requires the GraphRAG database. However, the database is currently offline or unreachable. Please start the Neo4j instance to enable historical insights."
            yield yield_event("done", {"answer": ans, "tools_called": [], "guardrail_blocked": True})
            return
        else:
            yield yield_event("step", {"msg": "Digging through historical store..."})
    elif route == "live":
        active_tools = {k: v for k, v in GITHUB_TOOLS.items() if "graphrag" not in k}
    else:
        active_tools = GITHUB_TOOLS

    tool_descriptions = "\n".join(f"- {name}: {desc}" for name, (_, desc) in active_tools.items())
    plan_system = (
        "You are a tool-calling planner for GitHub queries about apache/airflow.\n"
        "Available tools:\n"
        f"{tool_descriptions}\n\n"
        "Given the user's question, output a JSON object with a 'calls' array.\n"
        "Each call: {\"tool\": \"<name>\", \"args\": {\"<param>\": <value>}}.\n"
        "Max 5 calls. If the question can be answered with fewer, use fewer.\n"
        "Output JSON only — no commentary, no markdown fences."
    )
    raw_plan = await asyncio.to_thread(chat_fn, plan_system, user_query)

    plan_data = extract_json_object(raw_plan)
    calls = plan_data.get("calls", [])
    if not isinstance(calls, list):
        calls = []
    # Only allow calls to tools that were in the active tool set for this route
    calls = [c for c in calls if c.get("tool") in active_tools]

    tool_results = []
    tools_called = []

    if not calls:
        yield yield_event("step", {"msg": "No tools needed, answering directly..."})
    else:
        for call in calls:
            tool_name = call.get("tool")
            args = call.get("args", {})
            if tool_name not in GITHUB_TOOLS:
                continue

            msg = f"Executing {tool_name}..."
            if "graphrag" in tool_name:
                msg = "Digging through historical store..."
            elif "gh_" in tool_name or tool_name.startswith("get_") or tool_name == "search_issues":
                msg = "Querying live GitHub repository..."
                
            yield yield_event("step", {"msg": msg})
            await asyncio.sleep(0.01)
            
            fn, _ = active_tools[tool_name]
            try:
                # Wrap sync call to avoid blocking
                result = await asyncio.to_thread(fn, **args) if isinstance(args, dict) else await asyncio.to_thread(fn, args)
                # Use compact JSON to save tokens, truncate to 4000 chars to prevent context flooding
                result_str = json.dumps(result, separators=(',', ':'), default=str)[:4000]
                tool_results.append(f"[{tool_name}] → {result_str} ... (truncated)")
                tools_called.append(tool_name)
            except Exception as e:
                tool_results.append(f"[{tool_name}] → ERROR: {e}")
                tools_called.append(f"{tool_name}(error)")

    # Pass 2: Summarize
    yield yield_event("step", {"msg": "Summarizing results..."})
    await asyncio.sleep(0.01)
    summary_system = (
        "You are AutoBot, a helpful GitHub assistant for the Apache Airflow repository.\n"
        "Answer the user's question using ONLY the provided tool results. DO NOT output raw JSON.\n"
        "FORMATTING RULES (apply strictly):\n"
        "- Convert all ISO timestamps (e.g. 2024-06-02T03:49:11Z) to 'MM/DD/YY at HH:MM AM/PM UTC' format.\n"
        "- If any field like 'assignee' or 'merged_by' is null/None/empty, say 'nobody' instead of 'null'.\n"
        "- Reference issues and PRs as #N (e.g. #66353).\n"
        "- Be short, factual, and human-readable. One or two sentences max per fact.\n"
        "- If the tool results do not contain enough data to answer, say so clearly."
    )
    summary_user = f"User question: {user_query}\n\nTool results:\n" + "\n\n".join(tool_results)
    
    answer = await asyncio.to_thread(chat_fn, summary_system, summary_user)
    answer = _hyperlink_refs(answer)

    yield yield_event("done", {
        "answer": answer,
        "tools_called": tools_called,
        "guardrail_blocked": False,
    })

async def llm_plan_patch_stream(chat_fn: Callable[[str, str], str], n, repo, backend_label: str):
    def yield_event(event_type: str, data: dict):
        return f"data: {json.dumps({'type': event_type, **data})}\n\n"

    try:
        n_int = int(n)
    except (TypeError, ValueError):
        yield yield_event("error", {"msg": "invalid issue_number"})
        return
    
    if not repo or not Path(repo).expanduser().is_dir():
        yield yield_event("error", {"msg": "invalid repo_path"})
        return

    q = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def on_step(msg: str):
        # We must schedule the put back onto the main event loop
        asyncio.run_coroutine_threadsafe(q.put({"type": "step", "msg": msg}), loop)

    async def _run_planner():
        try:
            title, body = _issue_title_body(n_int)
            issue_obj = OrcIssue(number=n_int, title=title, body=body)
            repo_ctx = build_repo_context(repo)
            
            # Sync call executed in a thread
            graphrag_candidates = get_candidate_files(n_int, top_k=6) if _neo4j_check() else []
            plan, trace = await asyncio.to_thread(
                run_planner_with_refinement,
                chat_fn, issue_obj, repo, repo_ctx, _ts_index, graphrag_candidates, backend_label, on_step
            )
            orc_log_trace(trace)
            await q.put({"type": "done", "plan": {
                "summary": plan.summary, "files": plan.files, "steps": plan.steps,
                "requires_code_change": plan.requires_code_change
            }, "code_spans": plan.code_spans, "trace": trace.__dict__})
        except Exception as e:
            error_msg = str(e)
            print(f"[ERROR] Orchestrator exception: {error_msg}")
            if "503" in error_msg or "Service Unavailable" in error_msg:
                error_msg = "I'm unable to talk to the Planner LLM at the moment (Endpoint is likely paused or offline)."
            elif "401" in error_msg or "Unauthorized" in error_msg:
                error_msg = "I cannot authenticate with the LLM. Please check your tokens in the .env file."
            await q.put({"type": "error", "msg": error_msg})

    task = asyncio.create_task(_run_planner())

    while True:
        event = await q.get()
        if event["type"] == "step":
            yield yield_event("step", {"msg": event["msg"]})
        elif event["type"] == "done":
            yield yield_event("plan_done", {
                "issue_number": n_int,
                "repo_path": repo,
                "plan": event["plan"],
                "code_spans": event["code_spans"],
                "refinement_used": event["trace"].get("iterations", 0) > 0,
                "research_steps": event["trace"].get("research_steps_used", 0),
                "confidence": event["trace"].get("final_confidence", 0),
            })
            break
        elif event["type"] == "error":
            yield yield_event("error", {"msg": event["msg"]})
            break

@app.post("/api/orchestrate_stream")
async def orchestrate_stream(request: Request):
    """Streaming endpoint for UI real-time updates."""
    data = await request.json()
    command = data.get("command")
    if command not in ("query", "plan_patch"):
        return JSONResponse({"error": "Only query and plan_patch are supported for streaming."}, status_code=400)

    user_query = data.get("query", "")
    mode = AUTOBOT_MODE
    use_ollama = mode == "ollama" and ollama_available()
    use_google_ai = mode == "google_ai" and bool(GOOGLE_API_KEY)
    use_vertex = mode == "vertex" and bool(GCP_PROJECT_ID)

    use_hf_tgi = mode == "hf_tgi"

    chat_fn = None
    if use_google_ai: chat_fn = google_ai_chat
    elif use_vertex: chat_fn = vertex_chat
    elif use_ollama: chat_fn = ollama_chat
    elif use_hf_tgi: chat_fn = hf_tgi_chat(HF_PLANNER_ADAPTER)

    if not chat_fn:
        async def err_stream():
            yield f"data: {json.dumps({'type': 'error', 'msg': 'No LLM active. Set AUTOBOT_MODE correctly in .env'})}\n\n"
        return StreamingResponse(err_stream(), media_type="text/event-stream")

    if command == "query":
        return StreamingResponse(llm_adhoc_query_stream(chat_fn, user_query), media_type="text/event-stream")
    elif command == "plan_patch":
        repo_path = str(data.get("repo_path") or "").strip()
        n = data.get("issue_number")
        return StreamingResponse(llm_plan_patch_stream(chat_fn, n, repo_path, backend_label=AUTOBOT_MODE), media_type="text/event-stream")

def llm_adhoc_query(chat_fn: Callable[[str, str], str], user_query: str) -> dict:
    """
    Three-pass adhoc query answering:
      1. Guardrail check (is it relevant?)
      2. LLM reads tool registry → outputs JSON tool-call plan
      3. Execute tools deterministically → LLM summarizes results
    """
    # Pass 0: Soft guardrail
    relevance = chat_fn(GUARDRAIL_PROMPT, user_query).strip().upper()
    if "NO" in relevance and "YES" not in relevance:
        return {
            "answer": (
                "I am AutoBot, an assistant dedicated to the Apache Airflow repository. "
                "I can help with GitHub issues, PRs, CI status, code reviews, and repository queries. "
                "I'm unable to assist with questions outside this scope."
            ),
            "tools_called": [],
            "guardrail_blocked": True,
        }

    # Pass 1: LLM decides which tools to call
    route = _classify_query(user_query)
    if route == "graphrag":
        active_tools = {k: v for k, v in GITHUB_TOOLS.items() if "graphrag" in k}
        if not active_tools:
            return {
                "answer": "It looks like you're asking about historical or similar issues, which requires the GraphRAG database. However, the database is currently offline or unreachable. Please start the Neo4j instance to enable historical insights.",
                "tools_called": [],
                "guardrail_blocked": True,
            }
    elif route == "live":
        active_tools = {k: v for k, v in GITHUB_TOOLS.items() if "graphrag" not in k}
    else:
        active_tools = GITHUB_TOOLS

    tool_descriptions = "\n".join(
        f"- {name}: {desc}" for name, (_, desc) in active_tools.items()
    )
    plan_system = (
        "You are a tool-calling planner for GitHub queries about apache/airflow.\n"
        "Available tools:\n"
        f"{tool_descriptions}\n\n"
        "Given the user's question, output a JSON object with a 'calls' array.\n"
        "Each call: {\"tool\": \"<name>\", \"args\": {\"<param>\": <value>}}.\n"
        "Max 5 calls. If the question can be answered with fewer, use fewer.\n"
        "Output JSON only — no commentary, no markdown fences."
    )
    raw_plan = chat_fn(plan_system, user_query)

    # Parse tool-call plan
    tools_called: list[str] = []
    tool_results: list[str] = []
    try:
        plan = extract_json_object(raw_plan)
        calls = plan.get("calls") or []
        for call in calls[:5]:
            tool_name = str(call.get("tool", ""))
            args = call.get("args") or {}
            if tool_name not in active_tools:
                continue
            fn, _ = active_tools[tool_name]
            try:
                result = fn(**args) if isinstance(args, dict) else fn(args)
                # Truncate large results for LLM context
                result_str = json.dumps(result, indent=1, default=str)[:6000]
                tool_results.append(f"[{tool_name}] → {result_str}")
                tools_called.append(tool_name)
            except Exception as e:
                tool_results.append(f"[{tool_name}] → ERROR: {e}")
                tools_called.append(f"{tool_name}(error)")
    except (json.JSONDecodeError, KeyError):
        tool_results.append(f"[raw_plan] Could not parse tool plan: {raw_plan[:500]}")

    # Pass 2: LLM summarizes tool results into a user-facing answer
    summary_system = (
        "You are AutoBot, a helpful GitHub assistant for the Apache Airflow repository.\n"
        "Answer the user's question using ONLY the provided tool results. DO NOT output raw JSON.\n"
        "FORMATTING RULES (apply strictly):\n"
        "- Convert all ISO timestamps (e.g. 2024-06-02T03:49:11Z) to 'MM/DD/YY at HH:MM AM/PM UTC' format.\n"
        "- If any field like 'assignee' or 'merged_by' is null/None/empty, say 'nobody' instead of 'null'.\n"
        "- Reference issues and PRs as #N (e.g. #66353).\n"
        "- Be short, factual, and human-readable. One or two sentences max per fact.\n"
        "- If the tool results do not contain enough data to answer, say so clearly."
    )
    summary_user = (
        f"User question: {user_query}\n\n"
        "Tool results:\n" + "\n\n".join(tool_results)
    )
    answer = chat_fn(summary_system, summary_user)
    answer = _hyperlink_refs(answer)

    return {
        "answer": answer,
        "tools_called": tools_called,
        "guardrail_blocked": False,
    }


# ── Planner orchestrator integration ──────────────────────────────────────

from planner_orchestrator import (
    Issue as OrcIssue,
    PlannerPlan as OrcPlan,
    run_planner_with_refinement,
    assemble_patcher_input,
    log_trace as orc_log_trace,
)

try:
    from graphrag_client import get_candidate_files, neo4j_available as _neo4j_check
except ImportError:
    def get_candidate_files(n: int, top_k: int = 6) -> list[str]:
        return []
    def _neo4j_check() -> bool:
        return False

# Load tree-sitter index once at startup
TS_INDEX_PATH = os.environ.get("TS_INDEX_PATH", "").strip()
_ts_index: dict = {}
if TS_INDEX_PATH and Path(TS_INDEX_PATH).is_file():
    try:
        _ts_index = json.loads(Path(TS_INDEX_PATH).read_text())
        print(f"Tree-sitter index loaded: {len(_ts_index)} files from {TS_INDEX_PATH}")
    except Exception as e:
        print(f"Warning: could not load tree-sitter index from {TS_INDEX_PATH}: {e}")


@app.post("/api/orchestrate")
async def orchestrate(request: Request):
    data = await request.json()
    command = data.get("command")
    if not command:
        return JSONResponse({"error": "missing command"}, status_code=400)

    mode = AUTOBOT_MODE
    use_ollama    = mode == "ollama"    and ollama_available()
    use_google_ai = mode == "google_ai" and bool(GOOGLE_API_KEY)
    use_vertex    = mode == "vertex"    and bool(GCP_PROJECT_ID)
    use_hf_tgi    = mode == "hf_tgi"    and bool(HF_TGI_ENDPOINT)

    # Unified orchestrator chat_fn (used for refinement + synthesis)
    chat_fn: Callable[[str, str], str] | None = None
    backend_label = "stub"
    if use_google_ai:
        chat_fn = google_ai_chat;  backend_label = f"google_ai:{GEMINI_MODEL}"
    elif use_vertex:
        chat_fn = vertex_chat;     backend_label = f"vertex:{VERTEX_MODEL}"
    elif use_ollama:
        chat_fn = ollama_chat;     backend_label = f"ollama:{OLLAMA_MODEL}"
    elif use_hf_tgi:
        chat_fn = hf_tgi_chat(HF_PLANNER_ADAPTER); backend_label = f"hf_tgi:{HF_PLANNER_ADAPTER}"


    if command == "ask_issue":
        n = int(data.get("issue_number") or 0)
        return stub_ask_issue(n)

    if command == "ask_pr":
        n = int(data.get("pr_number") or 0)
        return stub_ask_pr(n)

    if command == "plan_patch":
        n = data.get("issue_number")
        repo = str(data.get("repo_path") or "").strip()
        try:
            n_int = int(n)
        except (TypeError, ValueError):
            return JSONResponse({"error": "invalid issue_number"}, status_code=400)
        if not repo:
            return JSONResponse({"error": "repo_path is required (set local Airflow clone path)"}, status_code=400)
        if not Path(repo).expanduser().is_dir():
            return JSONResponse({"error": f"repo_path is not a directory: {repo}"}, status_code=400)

        title, body = _issue_title_body(n_int)

        # Determine which LLM backend to use
        chat_fn = None
        backend_label = "stub"
        if use_google_ai:
            chat_fn = google_ai_chat
            backend_label = f"google_ai:{GEMINI_MODEL}"
        elif use_vertex:
            chat_fn = vertex_chat
            backend_label = f"vertex:{VERTEX_MODEL}"
        elif use_ollama:
            chat_fn = ollama_chat
            backend_label = f"ollama:{OLLAMA_MODEL}"
        elif use_hf_tgi:
            chat_fn = hf_tgi_chat(HF_PLANNER_ADAPTER)
            backend_label = f"hf_tgi:{HF_PLANNER_ADAPTER}"

        if chat_fn is None:
            return stub_plan(n_int, repo)

        # Run planner through the LangGraph pipeline
        try:
            repo_ctx = build_repo_context(repo)
            if n_int not in function_registry:
                function_registry[n_int] = {}
            function_registry[n_int]["chat_fn"] = chat_fn

            initial_state = {
                "issue_number": n_int,
                "title": title,
                "body": body,
                "repo_path": repo,
                "repo_context": repo_ctx,
                "ts_index": _ts_index,
                "backend_label": backend_label
            }
            
            config = {"configurable": {"thread_id": str(n_int)}}
            
            # Stream the graph to log every single pass/node execution
            final_state = initial_state.copy()
            graph_log = []
            for event in planner_graph.stream(initial_state, config, stream_mode="updates"):
                graph_log.append(event)
                for node_name, node_state in event.items():
                    final_state.update(node_state)
            
            # Dump the stream log
            from datetime import datetime
            ts = datetime.now().strftime("%Y%m%dT%H%M%S")
            os.makedirs("logs", exist_ok=True)
            with open(os.path.join("logs", f"langgraph_planner_{n_int}_{ts}.json"), "w") as f:
                json.dump(graph_log, f, default=str, indent=2)
            
            if final_state.get("status") == "failed":
                return JSONResponse({"error": final_state.get("error", "Unknown LangGraph error")}, status_code=502)
                
            plan = final_state.get("plan", {})
            trace = final_state.get("trace", {})
            
            if trace:
                from planner_orchestrator import OrchestratorTrace
                tr = OrchestratorTrace(
                    issue_number=n_int,
                    backend=backend_label,
                    iterations=trace.get("iterations", 0),
                    final_confidence=trace.get("final_confidence", 0.0),
                    triggers_detected=trace.get("triggers_detected", []),
                    research_steps_used=trace.get("research_steps_used", 0)
                )
                orc_log_trace(tr)

            return {
                "issue_number": n_int,
                "repo_path": repo,
                "plan": {
                    "summary": plan.get("summary"),
                    "files": plan.get("files"),
                    "steps": plan.get("steps"),
                },
                "code_spans": plan.get("code_spans"),
                "note": f"planner via LangGraph/{backend_label} (orchestrator: {trace.get('iterations', 0)} refinement passes, confidence={trace.get('final_confidence', 0.0)})",
                "orchestrator_trace": trace,
            }
        except Exception as e:
            return JSONResponse({"error": f"planner LangGraph failed: {e}"}, status_code=502)

    if command == "approve_plan":
        """User approved the planner output. Run the full Patcher → Critic → Sandbox pipeline."""
        approved_raw = data.get("plan", {})
        n = data.get("issue_number")
        repo = str(data.get("repo_path") or "").strip()
        try:
            n_int = int(n)
        except (TypeError, ValueError):
            return JSONResponse({"error": "invalid issue_number"}, status_code=400)
        if not repo or not Path(repo).expanduser().is_dir():
            return JSONResponse({"error": f"repo_path required: {repo}"}, status_code=400)

        title, body = _issue_title_body(n_int)

        # Determine patcher_fn — uses patcher-specific max_new_tokens for long diffs
        patcher_fn = None
        if use_hf_tgi and HF_PATCHER_ADAPTER:
            patcher_fn = hf_tgi_patcher_chat(HF_PATCHER_ADAPTER)
        elif use_google_ai:
            patcher_fn = google_ai_chat
        elif use_vertex:
            patcher_fn = vertex_chat
        elif use_ollama:
            patcher_fn = ollama_chat

        if patcher_fn is None:
            return JSONResponse({"error": "No LLM configured for Patcher"}, status_code=500)

        # Determine critic_fn — use dedicated adapter if set, else share patcher adapter
        critic_fn = None
        if use_hf_tgi and HF_CRITIC_ADAPTER:
            critic_fn = hf_tgi_chat(HF_CRITIC_ADAPTER)
        else:
            critic_fn = patcher_fn

        config = {"configurable": {"thread_id": str(n_int)}}
        try:
            # Register callables in global registry (avoids msgpack serialization issues)
            if n_int not in function_registry:
                function_registry[n_int] = {}
            function_registry[n_int]["patcher_fn"] = patcher_fn
            function_registry[n_int]["critic_fn"] = critic_fn

            # Build full initial state for the patcher to run in isolation
            initial_state = {
                "issue_number": n_int,
                "title": title,
                "body": body,
                "repo_path": repo,
                "ts_index": _ts_index,
                "backend_label": f"hf_tgi:{HF_PATCHER_ADAPTER}" if use_hf_tgi else AUTOBOT_MODE,
                "plan": approved_raw,
                "iterations": 0,
                "debate_rounds": 0,
                "patcher_history": [],
                "critic_verdict": None,
                "critic_feedback": None,
                "sandbox_error_class": None,
            }

            # ── Stream the Patcher graph for per-node observability ──
            from datetime import datetime
            final_state = initial_state.copy()
            graph_log = []
            for event in patcher_graph.stream(initial_state, config, stream_mode="updates"):
                graph_log.append(event)
                for node_name, node_state in event.items():
                    print(f"[Stream] node={node_name} status={node_state.get('status','?')} "
                          f"iter={node_state.get('iterations','?')} "
                          f"critic={node_state.get('critic_verdict','–')} "
                          f"error_class={node_state.get('sandbox_error_class','–')}")
                    final_state.update(node_state)

            # Persist full stream log
            ts = datetime.now().strftime("%Y%m%dT%H%M%S")
            os.makedirs("logs", exist_ok=True)
            log_path = os.path.join("logs", f"langgraph_patcher_{n_int}_{ts}.json")
            with open(log_path, "w") as f:
                json.dump(graph_log, f, default=str, indent=2)

            # Persist per-iteration patcher history
            patcher_history = final_state.get("patcher_history", [])
            if patcher_history:
                trace_path = os.path.join("logs", f"patcher_trace_{n_int}_{ts}.json")
                with open(trace_path, "w") as f:
                    json.dump(patcher_history, f, default=str, indent=2)

            if final_state.get("status") == "failed":
                return JSONResponse({"error": final_state.get("error", "LangGraph Patcher failed")}, status_code=502)

            sandbox_res = final_state.get("sandbox_result", {})
            error_class = final_state.get("sandbox_error_class")

            # ── Handle Planner escalation ──────────────────────────────────────
            # Trigger when:
            #   (a) Diagnostic Router classified the error as a logic/plan problem, OR
            #   (b) The Critic explicitly REJECTED the approach (not just REVISE)
            # In both cases the patcher cannot fix this — the plan itself needs to change.
            critic_verdict_final = final_state.get("critic_verdict")
            should_escalate = (
                error_class == "escalate_planner"
                or critic_verdict_final == "REJECT"
            ) and sandbox_res.get("status") == "failed"

            if should_escalate:
                escalation_reason = (
                    "Critic REJECT" if critic_verdict_final == "REJECT"
                    else "Diagnostic Router (logic/test failure)"
                )
                print(
                    f"[App] Planner escalation triggered for issue #{n_int} "
                    f"({escalation_reason}) — re-running Planner with rejection context"
                )

                # Build rich rejection context so the re-planner can avoid the same mistake
                rejection_context = {
                    "failed_plan": final_state.get("plan", {}),
                    "failed_diff": final_state.get("patch", ""),
                    "sandbox_error": sandbox_res.get("output", ""),
                    "critic_verdict": critic_verdict_final,
                    "critic_feedback": final_state.get("critic_feedback", ""),
                    "sandbox_error_class": error_class,
                    "escalation_reason": escalation_reason,
                    "patcher_iterations": final_state.get("iterations", 0),
                    "debate_rounds": final_state.get("debate_rounds", 0),
                    "context_diagnostics": final_state.get("context_diagnostics"),
                }

                chat_fn = function_registry.get(n_int, {}).get('chat_fn')
                if not chat_fn:
                    if use_hf_tgi and HF_PLANNER_ADAPTER:
                        chat_fn = hf_tgi_chat(HF_PLANNER_ADAPTER)
                    elif use_google_ai:
                        chat_fn = google_ai_chat
                    elif use_vertex:
                        chat_fn = vertex_chat
                    elif use_ollama:
                        chat_fn = ollama_chat
                    if chat_fn:
                        function_registry[n_int]["chat_fn"] = chat_fn

                if chat_fn:
                    repo_ctx = build_repo_context(repo)
                    replan_state = {
                        "issue_number": n_int,
                        "title": title,
                        "body": body,
                        "repo_path": repo,
                        "repo_context": repo_ctx,
                        "ts_index": _ts_index,
                        "backend_label": f"hf_tgi:{HF_PLANNER_ADAPTER}" if use_hf_tgi else AUTOBOT_MODE,
                        # Pass failure evidence so planner_node can inject it into the prompt
                        "rejection_context": rejection_context,
                    }
                    replan_log = []
                    replan_final = replan_state.copy()
                    for event in planner_graph.stream(replan_state, config, stream_mode="updates"):
                        replan_log.append(event)
                        for node_name, node_state in event.items():
                            replan_final.update(node_state)

                    ts2 = datetime.now().strftime("%Y%m%dT%H%M%S")
                    with open(os.path.join("logs", f"langgraph_replanner_{n_int}_{ts2}.json"), "w") as f:
                        json.dump(replan_log, f, default=str, indent=2)

                    new_plan = replan_final.get("plan", {})
                    return {
                        "issue_number": n_int,
                        "diff": final_state.get("patch", ""),
                        "verdict": "ESCALATED_TO_PLANNER",
                        "feedback": (
                            f"Escalation reason: {escalation_reason}\n"
                            f"Critic feedback: {final_state.get('critic_feedback', '(none)')}\n"
                            f"Sandbox error: {sandbox_res.get('output', '')[:800]}\n\n"
                            "A new plan has been generated. Please review and re-approve."
                        ),
                        "new_plan": new_plan,
                        "patcher_history": patcher_history,
                        "rejection_context": rejection_context,
                        "debug": {
                            "patcher_log": log_path,
                            "replanner_log": os.path.join("logs", f"langgraph_replanner_{n_int}_{ts2}.json"),
                            "escalation_reason": escalation_reason,
                            "critic_verdict": critic_verdict_final,
                            "patcher_iterations": final_state.get("iterations", 0),
                        }
                    }
                else:
                    return JSONResponse({
                        "error": "Sandbox failed with a logic error requiring replanning, but no Planner LLM is configured.",
                        "sandbox_output": sandbox_res.get("output", ""),
                        "rejection_context": rejection_context,
                        "patcher_history": patcher_history,
                    }, status_code=502)



            # ── Normal (non-escalation) response ──────────────────────────────
            return {
                "issue_number": n_int,
                "diff": final_state.get("patch", ""),
                "verdict": "APPROVED" if sandbox_res.get("status") == "passed" else "REJECTED",
                "feedback": sandbox_res.get("output", ""),
                "patcher_history": patcher_history,
                "debug": {
                    "iterations": final_state.get("iterations", 0),
                    "debate_rounds": final_state.get("debate_rounds", 0),
                    "critic_verdict": final_state.get("critic_verdict"),
                    "critic_feedback": final_state.get("critic_feedback"),
                    "sandbox_error_class": error_class,
                    "patcher_log": log_path,
                }
            }
        except Exception as e:
            return JSONResponse({"error": f"LangGraph execution failed: {e}"}, status_code=502)



    if command == "accept_plan":
        plan = data.get("plan")
        code_spans = data.get("code_spans")
        issue_number = data.get("issue_number")
        repo = str(data.get("repo_path") or "").strip()
        issue_title = "Unknown issue title"
        issue_body = ""
        try:
            if issue_number is not None:
                issue_title, issue_body = _issue_title_body(int(issue_number))
        except (TypeError, ValueError):
            pass

        # ── hf_tgi: route through the full LangGraph patcher graph (same as approve_plan)
        # This gives the patcher proper file contexts from assemble_patcher_input.
        if use_hf_tgi:
            try:
                n_int = int(issue_number) if issue_number is not None else 0
                if not repo or not Path(repo).expanduser().is_dir():
                    return JSONResponse({"error": f"repo_path required for hf_tgi patcher: {repo!r}"}, status_code=400)

                patcher_fn = hf_tgi_patcher_chat(HF_PATCHER_ADAPTER) if HF_PATCHER_ADAPTER else None
                if patcher_fn is None:
                    return JSONResponse({"error": "HF_PATCHER_ADAPTER is not set in .env"}, status_code=500)

                critic_fn = hf_tgi_chat(HF_CRITIC_ADAPTER) if HF_CRITIC_ADAPTER else patcher_fn

                if n_int not in function_registry:
                    function_registry[n_int] = {}
                function_registry[n_int]["patcher_fn"] = patcher_fn
                function_registry[n_int]["critic_fn"] = critic_fn

                # Normalise plan so patcher_prep_node can build file contexts
                plan_dict = plan if isinstance(plan, dict) else {}
                if "code_spans" not in plan_dict and code_spans:
                    plan_dict = dict(plan_dict)
                    plan_dict["code_spans"] = code_spans

                config = {"configurable": {"thread_id": str(n_int)}}
                initial_state = {
                    "issue_number": n_int,
                    "title": issue_title,
                    "body": issue_body,
                    "repo_path": repo,
                    "ts_index": _ts_index,
                    "backend_label": f"hf_tgi:{HF_PATCHER_ADAPTER}",
                    "plan": plan_dict,
                    "iterations": 0,
                    "debate_rounds": 0,
                    "patcher_history": [],
                    "critic_verdict": None,
                    "critic_feedback": None,
                    "sandbox_error_class": None,
                }

                from datetime import datetime
                final_state = initial_state.copy()
                graph_log = []
                for event in patcher_graph.stream(initial_state, config, stream_mode="updates"):
                    graph_log.append(event)
                    for node_name, node_state in event.items():
                        print(f"[Stream][accept_plan] node={node_name} status={node_state.get('status','?')}")
                        final_state.update(node_state)

                ts_str = datetime.now().strftime("%Y%m%dT%H%M%S")
                os.makedirs("logs", exist_ok=True)
                log_path = os.path.join("logs", f"langgraph_patcher_accept_{n_int}_{ts_str}.json")
                with open(log_path, "w") as f:
                    json.dump(graph_log, f, default=str, indent=2)

                if final_state.get("status") == "failed":
                    return JSONResponse({"error": final_state.get("error", "Patcher failed")}, status_code=502)

                sandbox_res = final_state.get("sandbox_result", {})
                return {
                    "diff": final_state.get("patch", ""),
                    "verdict": "APPROVED" if sandbox_res.get("status") == "passed" else final_state.get("critic_verdict", "REVISE"),
                    "reasoning": final_state.get("critic_feedback", sandbox_res.get("output", "")),
                    "plan_echo": plan_dict,
                    "iterations_used": final_state.get("iterations", 1),
                    "note": f"patcher via LangGraph hf_tgi:{HF_PATCHER_ADAPTER}",
                    "progress": [
                        f"iter={h.get('iteration')} sandbox={h.get('sandbox_result',{}).get('status')} critic={h.get('critic_verdict')}"
                        for h in final_state.get("patcher_history", [])
                    ],
                    "debug": {"patcher_log": log_path},
                }
            except Exception as e:
                return JSONResponse({"error": f"hf_tgi accept_plan failed: {e}"}, status_code=502)

        if use_google_ai:
            try:
                return llm_patch_and_critic(google_ai_chat, issue_title, issue_body, plan, code_spans, f"google_ai:{GEMINI_MODEL}")
            except Exception as e:
                error_msg = str(e)
                model_name = "Patcher LLM" if "[PATCHER]" in error_msg else "Critic LLM" if "[CRITIC]" in error_msg else "LLM"
                if "503" in error_msg or "Service Unavailable" in error_msg:
                    error_msg = f"I'm unable to talk to the {model_name} at the moment (Endpoint paused or offline)."
                return JSONResponse({"error": error_msg}, status_code=502)

        if use_vertex:
            try:
                return llm_patch_and_critic(vertex_chat, issue_title, issue_body, plan, code_spans, f"vertex:{VERTEX_MODEL}")
            except Exception as e:
                error_msg = str(e)
                model_name = "Patcher LLM" if "[PATCHER]" in error_msg else "Critic LLM" if "[CRITIC]" in error_msg else "LLM"
                if "503" in error_msg or "Service Unavailable" in error_msg:
                    error_msg = f"I'm unable to talk to the {model_name} at the moment (Endpoint paused or offline)."
                return JSONResponse({"error": error_msg}, status_code=502)

        if use_ollama:
            try:
                return llm_patch_and_critic(ollama_chat, issue_title, issue_body, plan, code_spans, f"ollama:{OLLAMA_MODEL}")
            except Exception as e:
                error_msg = str(e)
                model_name = "Patcher LLM" if "[PATCHER]" in error_msg else "Critic LLM" if "[CRITIC]" in error_msg else "LLM"
                if "503" in error_msg or "Service Unavailable" in error_msg:
                    error_msg = f"I'm unable to talk to the {model_name} at the moment (Endpoint paused or offline)."
                return JSONResponse({"error": error_msg}, status_code=502)

        return JSONResponse(
            {"error": "No active LLM mode for accept_plan. Set AUTOBOT_MODE to google_ai, vertex, ollama, or hf_tgi and restart."},
            status_code=400,
        )


    if command == "open_pr":
        diff = str(data.get("diff") or "")
        return {
            "status": "ok",
            "title": "[local] AutoBot draft PR",
            "body": f"Local test PR.\n\n```diff\n{diff[:2000]}\n```",
            "html_url": f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/compare/local-test",
            "note": "No GitHub API call",
        }

    if command == "query":
        user_query = str(data.get("query") or "").strip()
        if not user_query:
            return JSONResponse({"error": "'query' field is required"}, status_code=400)
        if not GITHUB_TOKEN:
            return {"answer": "GITHUB_TOKEN is not set. Please add it to .env and restart.", "tools_called": []}
        chat_fn = None
        backend = "stub"
        if use_google_ai:
            chat_fn = google_ai_chat
            backend = f"google_ai:{GEMINI_MODEL}"
        elif use_vertex:
            chat_fn = vertex_chat
            backend = f"vertex:{VERTEX_MODEL}"
        elif use_ollama:
            chat_fn = ollama_chat
            backend = f"ollama:{OLLAMA_MODEL}"
        elif use_hf_tgi:
            chat_fn = hf_tgi_chat(HF_PLANNER_ADAPTER)
            backend = f"hf_tgi:{HF_PLANNER_ADAPTER}"
        if chat_fn is None:
            return {"answer": "No LLM active — set AUTOBOT_MODE in .env", "tools_called": []}
        try:
            result = llm_adhoc_query(chat_fn, user_query)
            result["backend"] = backend
            return result
        except Exception as e:
            return JSONResponse({"error": f"query failed: {e}"}, status_code=502)

    if command == "detect_intent":
        text = data.get("text", "")
        chat_fn = None
        if use_google_ai: chat_fn = google_ai_chat
        elif use_vertex: chat_fn = vertex_chat
        elif use_ollama: chat_fn = ollama_chat
        elif use_hf_tgi: chat_fn = hf_tgi_chat(HF_PLANNER_ADAPTER)
        
        if not chat_fn:
            return JSONResponse({"error": "No LLM active for intent detection"}, status_code=502)
        
        prompt = (
            "You are an intent router for a GitHub assistant. "
            "Given the user's message, output ONLY a JSON object with 'intent' and 'issue_number' (or 'pr_number').\n"
            "Intents:\n"
            "- 'plan_patch': user specifically asks to fix, patch, or write code for an issue.\n"
            "- 'ask_issue': user just provides an issue number or asks to simply view/read it.\n"
            "- 'ask_pr': user just provides a PR number or asks to simply view/read a PR.\n"
            "- 'query': user asks a general question (e.g., 'who closed PR', 'status of issue', etc).\n"
            "If an issue number is found, extract it as an integer in 'issue_number'. "
            "If a PR number is found for ask_pr, extract it as an integer in 'pr_number'.\n"
            "Output JSON only.\n"
            f"Message: {text}"
        )
        try:
            raw = chat_fn("You are a helpful JSON router.", prompt)
            return extract_json_object(raw)
        except Exception as e:
            return JSONResponse({"error": f"Intent detection failed: {e}"}, status_code=502)

    return JSONResponse({"error": f"unknown command: {command}"}, status_code=400)



@app.get("/health")
async def health():
    ollama_ok = ollama_available()
    return {
        "status": "ok",
        "service": "local_autobot_orchestrator",
        "mode": AUTOBOT_MODE,
        "gcp_project": GCP_PROJECT_ID or None,
        "gcp_location": GCP_LOCATION,
        "vertex_model": VERTEX_MODEL,
        "vertex_ready": bool(GCP_PROJECT_ID),
        "vertex_llm_active": AUTOBOT_MODE == "vertex" and bool(GCP_PROJECT_ID),
        "gemini_model": GEMINI_MODEL,
        "google_api_key_set": bool(GOOGLE_API_KEY),
        "google_ai_llm_active": AUTOBOT_MODE == "google_ai" and bool(GOOGLE_API_KEY),
        "github_repo": f"{GITHUB_OWNER}/{GITHUB_REPO}",
        "github_token_set": bool(GITHUB_TOKEN),
        "ollama_host": OLLAMA_HOST,
        "ollama_model": OLLAMA_MODEL,
        "ollama_reachable": ollama_ok,
        "ollama_llm_active": AUTOBOT_MODE == "ollama" and ollama_ok,
    }


@app.get("/api/orchestrate")
async def orchestrate_get():
    return {
        "message": "POST JSON with command: ask_issue | plan_patch | accept_plan | open_pr | query",
        "docs": "http://127.0.0.1:5000/docs",
        "autobot_mode": AUTOBOT_MODE,
        "google_ai": f"model={GEMINI_MODEL} (GOOGLE_API_KEY in .env)",
        "vertex": f"{VERTEX_MODEL} project={GCP_PROJECT_ID or '?'} location={GCP_LOCATION}",
        "ollama": f"{OLLAMA_HOST} model={OLLAMA_MODEL}",
    }


def main() -> None:
    import uvicorn
    port = int(os.environ.get("PORT", "5000"))
    print(f"AUTOBOT_MODE={AUTOBOT_MODE} GCP_PROJECT_ID={GCP_PROJECT_ID or '(unset)'}")
    print(
        f"VERTEX_MODEL={VERTEX_MODEL} GEMINI_MODEL={GEMINI_MODEL} "
        f"GOOGLE_API_KEY={'set' if GOOGLE_API_KEY else 'unset'} "
        f"OLLAMA reachable={ollama_available()}"
    )
    print(f"GitHub repo={GITHUB_OWNER}/{GITHUB_REPO} token={'set' if GITHUB_TOKEN else 'unset'}")
    print(f"Listening on http://127.0.0.1:{port}")
    print(f"API docs:   http://127.0.0.1:{port}/docs")
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=True)


if __name__ == "__main__":
    main()
