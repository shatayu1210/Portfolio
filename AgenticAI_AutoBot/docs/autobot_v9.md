# AutoBot v9 — Full System Architecture & Implementation Reference

> **Purpose:** Comprehensive technical reference for the AutoBot system as implemented. Suitable as the primary source for drafting a 50-60 page project report. All sections reflect the actual codebase; nothing described here is aspirational or deprecated.

---

## 1. Project Overview

AutoBot is an end-to-end agentic AI system purpose-built for the Apache Airflow open-source repository. It performs three distinct jobs:

1. **Slack Triage Pipeline** — Continuously monitors the Airflow GitHub repository, scores every new issue by severity, generates a delivery-risk narrative for high-severity issues, and posts a Slack alert.
2. **VS Code Agentic Patch Assistant** — A VS Code extension that lets a developer describe an issue in natural language, receive a structured fix plan, approve it, and watch the system generate, validate, and apply a code patch.
3. **RLHF Retraining Loop** — Collects human feedback on Reasoner outputs via Slack thumbs-up/down, runs DPO training on RunPod GPU serverless, evaluates the retrained model against a gold set, and re-deploys to the HuggingFace endpoint automatically every Wednesday.

The three pipelines share a common infrastructure backbone: a Neo4j GraphRAG database, a HuggingFace TGI inference endpoint hosting fine-tuned LoRA adapters, and a Prometheus + Grafana + Loki observability stack.

---

## 2. Data Pipeline & ETL

### 2.1 GitHub Extraction

All raw data originates from the Apache Airflow GitHub repository (`apache/airflow`). The ETL layer is implemented in the `etl/` directory using Apache Airflow DAGs as the orchestration engine.

The extraction pipeline collects:
- **Issues** — 12,000+ issues scraped via the GitHub REST API including full body text, labels, assignee counts, linked PR numbers, CI status, comment threads, and PR review feedback.
- **Pull Requests** — 43,000+ PRs scraped with file diff metadata, author, reviewers, merge status, and linked issue numbers.

The GitHub App (`autobot-extract`) is used for authenticated API access at 5,000 requests/hour vs the 60/hour unauthenticated limit.

Data is cleaned and consolidated using `clean_and_consolidate.py` and loaded to Snowflake via `load_to_snowflake.py`. The Snowflake schema serves as the analytical warehouse for training dataset construction.

A dual-snapshot polling strategy is used at runtime: page 1 (most recently updated 30 issues) is always fetched, plus one random backlog page (pages 2–50) to continuously audit stale open issues.

### 2.2 Tree-sitter Index

The `tree_sitter/` directory contains the build script (`build_treesitter_index.py`) and the resulting `treesitter_index.json` (2.6 MB). This index maps every Python file in the Airflow repository to its top-level symbols (classes and functions). It is built once, loaded into memory at orchestrator startup, and used by the Planner Orchestrator's research tools during refinement passes.

---

## 3. GraphRAG — Neo4j Knowledge Graph

### 3.1 Graph Schema

The GraphRAG layer lives in `graphrag/`. The Neo4j database (Neo4j 5.18.1) holds a rich multi-hop knowledge graph covering every issue, PR, contributor, file, review, and label in the Apache Airflow repository.

**Node types:**

| Label | Unique Key | Properties |
|-------|-----------|------------|
| `Issue` | `number` | title, body_truncated, created_at |
| `PR` | `number` | title, body_truncated, merged_at |
| `File` | `filename` | filename (full repo-relative path) |
| `Review` | `id` | body, state, is_inline_comment, diff_hunk |
| `User` | `login` | GitHub username |
| `Label` | `name` | GitHub label string (e.g. `kind:bug`, `provider:cncf-kubernetes`) |

**Relationship types (11 total):**

| Relationship | From → To | Meaning |
|-------------|----------|--------|
| `RESOLVED_BY` | Issue → PR | This PR closed the issue |
| `TOUCHES` | PR → File | PR modified this file |
| `REVIEWED_IN` | Review → PR | Review/comment belongs to this PR |
| `APPLIES_TO` | Review → File | Inline comment targets this file |
| `AUTHORED` | User → PR | User opened this PR |
| `MERGED` | User → PR | User merged this PR |
| `REVIEWED` | User → PR | User submitted a review on this PR |
| `REPORTED` | User → Issue | User opened this issue |
| `COMMENTED_ON` | User → Issue | User commented on this issue |
| `HAS_LABEL` | Issue → Label | Issue carries this GitHub label |
| `HAS_LABEL` | PR → Label | PR carries this GitHub label |

**Full traversal pattern:**
```
(User)-[:REPORTED]->(Issue)-[:RESOLVED_BY]->(PR)-[:TOUCHES]->(File)
                                                  ↑
(User)-[:AUTHORED]----------------------------->(PR)<-[:REVIEWED]-(User)
(User)-[:MERGED]------------------------------>(PR)
(User)-[:COMMENTED_ON]---------------------->(Issue)
(Issue)-[:HAS_LABEL]------------------------>(Label)
(PR)-[:HAS_LABEL]--------------------------->(Label)
(Review)-[:REVIEWED_IN]-------------------->(PR)
(Review)-[:APPLIES_TO]-------------------->(File)
```

### 3.2 Ingestion Architecture

`ingest_graph_actual.py` runs three sequential passes over the cleaned JSONL training data:

**Pass 1 — `ingest_issues()`**
- Source: `etl/training_data/issues_clean*.jsonl`
- Creates `Issue` nodes (number, title, body_truncated, created_at).
- Creates stub `PR` nodes and `RESOLVED_BY` edges for every linked PR number.
- Batch size: 500 records.

**Pass 2 — `ingest_prs()`**
- Source: `etl/training_data/prs_clean*.jsonl`
- Fills in full `PR` metadata (title, body_truncated, merged_at).
- Creates `File` nodes and `TOUCHES` edges for every file in the PR diff.
- Creates `Review` nodes (both full reviews and inline review comments) with `REVIEWED_IN` and `APPLIES_TO` edges.
- Batch size: 200 records.

**Pass 3 — `ingest_users_and_labels()`** *(added in latest update)*
- Source: both JSONL files (second pass read).
- Creates `User` nodes from `pr.user.login` (author), `pr.merged_by.login` (merger), `reviews[].user.login` (reviewers), `review_comments[].user.login` (inline comment authors), `issue.user.login` (reporter), `comments[].user.login` (commenters).
- Creates `Label` nodes from `pr.labels[].name` and `issue.label_names[]`.
- Wires all `AUTHORED`, `MERGED`, `REVIEWED`, `REPORTED`, `COMMENTED_ON`, `HAS_LABEL` relationships.
- Batch size: 200 records (PRs) / 500 records (Issues).

**Memory-safe deletion:** The `clear_graph()` function deletes the existing graph in batches of 10,000 relationships then 10,000 nodes (loop-until-empty) rather than a single `MATCH (n) DETACH DELETE n` transaction, preventing `MemoryPoolOutOfMemoryError` on large graphs.

**Neo4j memory configuration** (`graphrag/docker-compose.yml`):
```
NEO4J_dbms_memory_heap_initial__size=2G
NEO4J_dbms_memory_heap_max__size=6G
NEO4J_dbms_memory_pagecache_size=2G
NEO4J_dbms_memory_transaction_total_max=4G
```

`vectorize_issues.py` separately handles the vector embedding layer using Neo4j's built-in vector index for similarity search (384-dimensional `all-MiniLM-L6-v2` embeddings).

### 3.3 Runtime Retrieval

The `graphrag_client.py` module (inside `autobot_vscode/local_orchestrator/`) exposes:
- `get_candidate_files(issue_number, top_k=6)` — queries the vector index for issues similar to the current issue, then traverses `RESOLVED_BY → TOUCHES` edges to extract the files changed in those PRs. Returns a ranked list of candidate files most likely relevant to this issue.
- `get_neighbor_files(file_path, top_k=3)` — finds files that co-appeared in the same PR as the given file (co-modification graph traversal via `TOUCHES`).
- `similar_issues(query, top_k)` and `linked_prs_for_issues(issue_numbers)` — used by the Slack adhoc handler.

### 3.4 Example GraphRAG Queries

**Who fixed a bug and what files did they touch?**
```cypher
MATCH (u:User)-[:AUTHORED]->(p:PR)<-[:RESOLVED_BY]-(i:Issue)
MATCH (p)-[:TOUCHES]->(f:File)
RETURN u.login, p.number, i.title, collect(f.filename) LIMIT 10
```

**All Kubernetes provider bugs and their fixers:**
```cypher
MATCH (l:Label {name: "provider:cncf-kubernetes"})<-[:HAS_LABEL]-(i:Issue)
-[:RESOLVED_BY]->(p:PR)<-[:AUTHORED]-(u:User)
RETURN i.number, i.title, p.number, u.login
```

**Co-modified files (files that always change together):**
```cypher
MATCH (f1:File)<-[:TOUCHES]-(p:PR)-[:TOUCHES]->(f2:File)
WHERE f1.filename < f2.filename
RETURN f1.filename, f2.filename, count(p) AS co_changes
ORDER BY co_changes DESC LIMIT 20
```

---

## 4. Model Training

### 4.1 Scorer Model

**Purpose:** Binary/ternary severity classifier that labels each incoming issue as `low`, `medium`, or `high`.

**Base model:** Fine-tuned from a 1.5B parameter causal LM (SmolLM/Qwen family). The model was converted to a sequence classification head.

**Training data:** Constructed from the Snowflake warehouse. Input format exactly matches the runtime prompt format:
```
PROJECT: apache/airflow | P50=1d P75=6d P90=23d P95=47d
ISSUE: {title} | LABELS: {labels} | ASSIGNEES: {n} | DAYS_OPEN: {n} | ...
BODY: {body}
COMMENTS: {count} comments
```

**Deployed to:** HuggingFace Space (`autobot298/autobot-scorer-api`). Called by the Slack Sentinel with a 120-second timeout to handle cold starts.

**Smart routing:** If `P(high) > 0.4` → escalate. If `P(medium) > 0.8` → escalate as medium-escalated. Otherwise use argmax.

### 4.2 Reasoner Model

**Purpose:** Generates a 2–3 sentence delivery-risk narrative for each high-severity issue, targeting scrum masters and delivery leads.

**Base model:** `autobot298/autobot-reasoner-merged` — a Qwen2.5-based causal LM fine-tuned with LoRA using DPO. Deployed to a HuggingFace Inference Endpoint on AWS us-east-1 A10G GPU.

**Training data:** Built from the same Snowflake warehouse. The prompt format includes the Scorer's risk score as a prefix, issue metadata (days open, snapshot tier T+1/T+7/T+14/T+30+, linked PRs, silent reviewers, CI status), full body, comment thread, and PR review feedback.

**Output format:** Free-form prose (2–3 sentences). First sentence leads with time open and assignment status. Second sentence cites activity signals. Third sentence states delivery risk.

### 4.3 Planner Model

**Purpose:** Given a GitHub issue, decides if a code change is required and produces a structured fix plan.

**Base model:** Fine-tuned LoRA adapter (`autobot298/planner-lora-adapter-v7`) on top of a Qwen2.5-Coder-7B base. Deployed to a shared HuggingFace TGI endpoint.

**Training data:** Constructed by `training/patch_planner/build_planner_data.py`. The pipeline:
1. Sources PR records from `prs_clean.jsonl`.
2. Fast pre-filters: numeric issue link check, Python/TS/JS/config file check.
3. For each PR, fetches tree-sitter code spans for changed Python files.
4. Injects GraphRAG file candidates and historical idioms.
5. Applies strict target cleaning: strips HTML, raw URLs, ASF boilerplate, PR template prose, caps to 180-word "What to change" targets.
6. 80/10/10 PR-level split. Writes `planner_train_graphrag.jsonl`.

**Multiple dataset versions:** v1 (5.8 MB), v3 (17.8 MB), v4 (19.2 MB), final (19.9 MB).

**Output format (strict text, not JSON/Markdown):**
```
REQUIRES_CODE_CHANGE: YES
REASON: <one sentence>
PLAN:
- What to change: <one concise paragraph>
- Target files:
  - <repo/path.py>
- Test strategy: <one sentence>
```

### 4.4 Patcher Model

**Purpose:** Given an approved plan and full file context, generates a `git diff`-format patch.

**Adapter:** `autobot298/autobot-patcher_lora` on the same TGI endpoint.

**Training data:** Constructed from real closed Airflow PRs. Input is the patcher context bundle (issue title+body, plan summary, primary file contents with tree-sitter spans, supporting files, test files). Output is the actual git diff from the PR.

### 4.5 Critic Model

**Purpose:** Reviews the Patcher's diff and returns `ACCEPT`, `REVISE`, or `REJECT` with structured feedback.

A separate LoRA adapter can be configured via `HF_CRITIC_ADAPTER`. When not set, the system falls back to using the Patcher adapter for the Critic role as well.

---

## 5. LangGraph Agentic Workflow

The agentic orchestration is implemented using **LangGraph** (`langgraph_workflow.py`, 910 lines). Two separate compiled state graphs handle the two main workflows.

### 5.1 AgentState

A `TypedDict` that carries all state across graph nodes:
- Issue metadata (`issue_number`, `title`, `body`, `repo_path`)
- Retrieved context (`candidate_files`, `repo_context`, `ts_index`)
- Planner outputs (`plan`, `trace`, `patcher_input`)
- Patcher outputs (`patch`, `iterations`, `patcher_history`)
- Critic state (`critic_verdict`, `critic_feedback`, `debate_rounds`)
- Sandbox results (`sandbox_result`, `sandbox_error_class`)
- Context diagnostics (`context_diagnostics`)
- Rejection context for re-planning (`rejection_context`)
- Final status (`status`, `error`)

### 5.2 Planner Graph

**Nodes in order:**
1. `orchestrator_node` — Queries Neo4j for `top_k=6` candidate files via `get_candidate_files()`. Initialises counters.
2. `planner_node` — Calls `run_planner_with_refinement()` from `planner_orchestrator.py`. Injects any `rejection_context` from a prior failed attempt into the repo_context as a failure brief, so the LLM is grounded away from the previous mistake.

**Graph edge:** `orchestrator_node` → `planner_node` → END.

### 5.3 Patcher Graph

**Nodes in order:**
1. `patcher_prep_node` — Calls `assemble_patcher_input()`. Builds a tiered file context bundle: primary files (full contents with tree-sitter spans), supporting files (related files from same directory), test files (auto-discovered by stem matching). Logs warnings if 0 supporting files are found.
2. `patcher_node` — Calls the Patcher LLM with the full context. Extracts a unified diff from the response. Records each attempt in `patcher_history`.
3. `critic_node` — Calls the Critic LLM. Returns `ACCEPT`, `REVISE`, or `REJECT` with structured feedback.
4. `sandbox_node` — Applies the diff to a copy of the repo and runs the test suite inside the Docker sandbox container. Classifies the error type.
5. `diagnostic_router_node` — Reads `sandbox_error_class`. Routes back to `patcher_node` for patcher-class errors (hunk failures, syntax errors, indentation errors) or triggers `escalate_planner` for logic-class errors (AssertionError, TypeError, pytest FAILED).

**Cycle detection:** Up to 3 Patcher iterations, 2 Critic debate rounds. After exhausting retries, returns `status=failed`.

**Planner escalation:** Triggered when `sandbox_error_class == "escalate_planner"` OR `critic_verdict == "REJECT"` AND sandbox failed. The system re-runs the full Planner graph with the `rejection_context` (failed plan + diff + critic feedback + sandbox error) injected into the prompt.

### 5.4 Planner Orchestrator (`planner_orchestrator.py`)

The Planner Orchestrator sits between the raw LLM call and the LangGraph node. It implements a bounded multi-pass refinement loop:

**Pass 1:** Initial Planner call with issue + GraphRAG candidates + tree-sitter context.

**Confidence scoring (deterministic, no LLM):**
- Base 0.5
- +0.10 if `requires_code_change` is set
- +0.15 if all planned files exist on disk
- +0.20 if 1–6 valid files
- +0.05 per file overlapping with GraphRAG candidates (capped at 0.15)

**Trigger detection:** Fires refinement if:
- `sparse_files` — no files planned, or all files are `__init__.py`
- `path_not_found` — any planned file doesn't exist in the repo
- `no_code_change_flagged` — REQUIRES_CODE_CHANGE=NO when evidence suggests otherwise

**Research loop (deterministic tools, no LLM):**
1. Keyword grep (multi-keyword intersection scorer with path domain boost)
2. Tree-sitter symbol lookup for candidate files
3. Import tracing (follow what candidate files import)
4. Caller tracing (find who calls key symbols via grep)
5. File window reads around code_spans (±20 lines context)
6. GraphRAG neighbour file traversal
7. Novel-issue wider traversal (when no vector matches exist)

Evidence is compressed to 12 snippets max (max 3 per unique file) before being injected into the re-plan prompt.

**Critic (LLM, runs every pass):** Verifies the plan independently of the confidence score. Returns `APPROVED` or `REJECTED` with feedback and optional new search terms. If the Critic rejects but triggers didn't fire, forces `critic_override` trigger.

**Exit conditions:** Critic `APPROVED` + confidence ≥ 0.75, OR Critic approved despite low score (trust Critic), OR confidence plateau (delta < 0.05) after Critic approved, OR max 5 iterations reached.

### 5.5 Diagnostic Router Error Classification

Two regex pattern sets classify sandbox failures:

**PATCHER_ERRORS** (→ retry patcher): hunk FAILED, patch does not apply, IndentationError, SyntaxError, missing import, malformed patch, can't find file to patch.

**PLANNER_ERRORS** (→ escalate planner): AssertionError, TestTimeout, LogicConflict, FAILED test_, TypeError, AttributeError, NameError, ModuleNotFoundError, pytest summary "X failed".

---

## 6. Sandbox

The sandbox (`sandbox/`) is a Docker container that receives a patch and a target file path, applies the diff using the system `patch` command, optionally runs the relevant test files using `pytest`, and returns structured JSON with `status`, `output`, and `exit_code`.

The sandbox mounts the Airflow repository read-only at `/workspace`. It runs on port 5001. The orchestrator calls it at `http://sandbox:5001` inside the Docker network.

---

## 7. Slack Pipeline

### 7.1 Architecture

```
Poller → Sentinel (Scorer) → Reasoner → Notifier
                                      ↘ RLHF Feedback Collector
```

### 7.2 Poller (`poller.py`)

Runs every 30 minutes. Fetches two pages of open issues: page 1 (most recent 30) + a random backlog page. For each issue, enriches with: days open, linked PR count and states (via Timeline API), issue comment text and max comment gap, PR review feedback (reviews + inline comments). Handles GitHub App authentication.

**Demo Mode:** When `DEMO_MODE=True`, loads from static `demo_set_1.json` or `demo_set_2.json` instead of calling the live GitHub API.

### 7.3 Sentinel (`sentinel.py`)

Calls the Scorer HuggingFace Space endpoint at `/score` with the full training-format scorer input string. Returns label + confidence + per-class probabilities. Smart routing escalates medium issues with P(medium) > 0.8. All scored issues are marked as seen in SQLite. Only HIGH issues are forwarded to the Reasoner.

### 7.4 Reasoner (`reasoner.py`)

Calls the HuggingFace Inference Endpoint (dedicated A10G GPU) with the full training-format Reasoner prompt. Retries up to 3 times on 503 (cold start). Parses the narrative output into `summary` (first sentence), `root_cause` (full text), `suggested_action` (last sentence).

### 7.5 Notifier (`notifier.py`)

Posts a rich Slack Block Kit message with the issue title, severity badge, narrative summary, root cause, suggested action, and GitHub link. Adds thumbs-up/thumbs-down reaction buttons for RLHF feedback collection.

### 7.6 Adhoc Query Handler (`adhoc.py`)

Handles Slack `@AutoBot` mentions. Architecture:

1. **Guardrail (LLM-based):** Classifies the query against an `_GUARDRAIL_SYSTEM` prompt. Rejects off-topic, adversarial, or non-Airflow queries before any tools are called.
2. **Tool Planner:** Uses the OpenAI-compatible HuggingFace TGI client to select which GitHub or GraphRAG tools to call.
3. **Tool Executor:** Calls tools (max 4 per query to prevent infinite loops). Tools include: `gh_get_issue`, `gh_get_pr`, `gh_get_pr_files`, `gh_get_issue_comments`, `gh_search_issues`, and optional GraphRAG tools (`similar_issues`, `linked_prs_for_issues`, `get_neighbor_files`) loaded dynamically when Neo4j is available.
4. **Summarizer:** Synthesises tool results into a human-readable answer.

---

## 8. VS Code Extension

The extension lives in `autobot_vscode/`. It is a TypeScript/Node VS Code extension that communicates with the local Docker-based Orchestrator over HTTP.

### 8.1 Extension Architecture

- `src/extension.ts` — Activates the extension, registers the `autobot.openPanel` command, creates the WebviewPanel.
- `media/webview.js` — All UI logic (chat rendering, intent detection, SSE stream consumption, plan card rendering, diff application).
- `media/webview.css` — Dark-mode VS Code-native styling.

### 8.2 User Flow

1. User types a message in the chat input.
2. `parseIntent()` calls `/api/orchestrate` with `command=detect_intent`. The LLM returns `{intent, issue_number, pr_number}`.
3. **Guardrail:** If issue/PR number is missing for an ask intent, a friendly error is shown without calling the backend.
4. **Intent routing:**
   - `ask_issue` → `doAskIssue()` → `/api/orchestrate` `command=ask_issue` → renders Issue card.
   - `ask_pr` → `doAskPr()` → `/api/orchestrate` `command=ask_pr` → renders PR card.
   - `plan_patch` → `doPlanPatch()` → SSE stream from `/api/orchestrate_stream` `command=plan_patch` → renders Plan card with Approve button.
   - `query` → `doQuery()` → SSE stream from `/api/orchestrate_stream` `command=query`.
5. On plan approval: `doApprovePlan()` → `/api/orchestrate` `command=approve_plan` → runs Patcher graph → renders diff card with Apply button.
6. Apply button uses VS Code `workspace.applyEdit` API to write the diff to the local file system.

### 8.3 Issue & PR Cards

Cards display: title (coloured by open/closed/merged state), body (truncated at 400 characters with a "View more" link to GitHub), labels (colour-coded), state badge, assignee, reviews count (PR only), opened date (PR only). GitHub URL is constructed as `https://github.com/apache/airflow/issues/{n}`.

### 8.4 Intent Detection Fallback

If the LLM intent endpoint fails, a regex heuristic kicks in: looks for `#\d+` pattern, checks for fix/plan/patch keywords to route plan_patch, checks for `pr` keyword.

---

## 9. Local Orchestrator (`app.py`)

The FastAPI application (2,009 lines) is the brain of the VS Code extension. It runs inside the `autobot_orchestrator` Docker container on port 8000.

### 9.1 LLM Backends

Configured via `AUTOBOT_MODE` environment variable:
- `hf_tgi` — HuggingFace TGI endpoint with LoRA adapter routing. Used in production. Sends raw `<|im_start|>system...` formatted prompts.
- `google_ai` — Google AI Studio via `ChatGoogleGenerativeAI`. Uses Gemini 2.5 Flash.
- `vertex` — Vertex AI GenerativeModel. Uses Gemini 2.5 Flash on GCP.
- `ollama` — Local Ollama server (qwen2.5-coder:7b by default).
- `stub` — Returns canned responses for development without any LLM.

### 9.2 Key Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/orchestrate` | POST | Main router for ask_issue, ask_pr, plan_patch, approve_plan, detect_intent, query commands |
| `/api/orchestrate_stream` | POST | SSE stream for plan_patch and query commands |
| `/health` | GET | Returns current mode, configured models, token presence flags |
| `/metrics` | GET | Prometheus metrics (via prometheus-fastapi-instrumentator) |

### 9.3 Repo Context Building

`build_repo_context(repo_path)` generates a compact context string for the Planner: top-level directory listing, list of Python files (excluding .venv, node_modules, etc.), and any README.md content.

### 9.4 Query Streaming (`llm_adhoc_query_stream`)

1. Guardrail LLM call — checks if the query is Airflow-scoped. Rejects with a branded polite fallback if not.
2. Relevance step — routes to one of 8 GitHub + GraphRAG tools.
3. Up to 4 tool calls.
4. Synthesis LLM call — produces final answer.
Each step is yielded as an SSE `step` event, final answer as `done`.

---

## 10. RLHF Pipeline

### 10.1 Feedback Collection

Slack thumbs-up/thumbs-down on Reasoner output messages is captured by the Slack bolt app. Each feedback record contains `issue_number`, `title`, `body`, `model_output`, `label` (positive/negative), and `timestamp`. Records are stored in a HuggingFace Dataset (`autobot298/autobot-feedback`).

### 10.2 Teacher Labeling (`rlhf/labeler.py`)

GPT-4o labels each unlabeled feedback pair as a DPO triplet: `{prompt, chosen, rejected}`. "Chosen" is the positive example (thumbs-up), "rejected" is the negative (thumbs-down or GPT-4o-generated worse alternative).

### 10.3 DPO Training (`rlhf/runpod_trainer.py`)

Submits the labeled DPO pairs to a RunPod serverless GPU endpoint. The training job runs `trl` DPO trainer for 3 epochs. The new adapter is pushed to `autobot298/autobot-reasoner-dpo-adapter` on HuggingFace Hub.

### 10.4 Evaluation (`rlhf/eval_runner.py`)

A gold set of hand-curated (issue, ideal_analysis) pairs. GPT-4o judges each model output on 5 dimensions. Threshold: overall mean ≥ 4.0/5.0. If below threshold, deployment is skipped.

### 10.5 Redeployment (`rlhf/redeployer.py`)

Merges the new LoRA adapter into the base model weights, pushes the merged model as a new revision to `autobot298/autobot-reasoner-merged`, and updates the HuggingFace Inference Endpoint to use the new revision via the HF API.

### 10.6 Scheduler

Fires every Wednesday at 02:00 UTC automatically via a Python `threading.Thread` daemon started at FastAPI app lifespan. All 4 steps (label → train → eval → deploy) run sequentially in the background thread. Full structured logs written to `rlhf/logs/{run_id}.log`. Slack notifications sent at completion or failure.

---

## 11. Observability Stack

All services are instrumented for full observability.

### 11.1 Prometheus

`observability/prometheus.yml` scrapes `/metrics` from both the Orchestrator (port 8000) and Sandbox (port 5001) every 15 seconds. `prometheus-fastapi-instrumentator` auto-instruments all FastAPI endpoints with request count, latency histograms, and error rates.

### 11.2 Loki + Promtail

`observability/promtail-config.yaml` collects stdout/stderr logs from all Docker containers and ships them to Loki (port 3100). Log lines from the LangGraph nodes (planner, patcher, critic, sandbox) are tagged with job labels for filtering.

### 11.3 Grafana

Grafana (port 3000) consumes both Prometheus and Loki data sources. Pre-built dashboards show: request latency per endpoint, LangGraph node execution counts, patcher iteration distribution, critic verdict breakdown, sandbox pass/fail rates, and full log streams filterable by container.

### 11.4 LangSmith

When `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY` are set, every LangGraph node execution sends a structured trace to LangSmith. This provides per-node token counts, latency, and intermediate state inspection for debugging.

---

## 12. Deployment Architecture (Local Docker)

All services run in a unified Docker Compose stack (`docker-compose.yml`):

| Container | Image | Port | Purpose |
|---|---|---|---|
| `autobot_orchestrator` | `autobot-orchestrator` (local build) | 8000 | FastAPI LangGraph backend |
| `autobot_sandbox` | `autobot-sandbox` (local build) | 5001 | Patch application + test runner |
| `autobot_neo4j` | `neo4j:5.18.1` | 7474, 7687 | GraphRAG knowledge graph |
| `autobot_prometheus` | `prom/prometheus:v2.51.2` | 9090 | Metrics collection |
| `autobot_loki` | `grafana/loki:2.9.4` | 3100 | Log aggregation |
| `autobot_promtail` | `grafana/promtail:2.9.4` | — | Log shipper |
| `autobot_grafana` | `grafana/grafana:10.4.2` | 3000 | Dashboards |

**Volume mounts:**
- `${AIRFLOW_REPO_PATH:-./tree_sitter/airflow}:/workspace:ro` — Airflow repo mounted read-only into both Orchestrator and Sandbox.
- `./graphrag/data:/data` — Existing Neo4j data directory (bypasses re-ingestion).
- `./tree_sitter/treesitter_index.json:/app/ts_index.json:ro` — Pre-built tree-sitter index.

**Internal networking:** All containers communicate on the `autobot_default` Docker bridge network using service names (e.g., `http://sandbox:5001`, `bolt://neo4j:7687`).

**Required `.env` variables for local deployment:**
```
GITHUB_TOKEN=...
GITHUB_OWNER=apache
GITHUB_REPO=airflow
AUTOBOT_MODE=hf_tgi
HF_TGI_ENDPOINT=https://<your-endpoint>.aws.endpoints.huggingface.cloud
HF_TGI_TOKEN=hf_...
HF_PLANNER_ADAPTER=autobot298/planner-lora-adapter-v7
HF_PATCHER_ADAPTER=autobot298/autobot-patcher_lora
NEO4J_PASSWORD=autobot_password
AIRFLOW_REPO_PATH=./tree_sitter/airflow
```

---

## 13. Guardrails Summary

| Layer | Type | Mechanism |
|---|---|---|
| VS Code — Intent | Frontend JS | Regex + LLM. Missing number for ask_issue/ask_pr caught before backend call. |
| VS Code — Vague prompt | Frontend JS | `unknown` intent returns branded fallback message without any API call. |
| Orchestrator — Query | LLM | `GUARDRAIL_PROMPT` system prompt classifies query relevance. Off-topic queries get polite rejection. |
| Orchestrator — Tool limit | Code | Max 4 tool calls per query in adhoc query stream. |
| Slack adhoc | LLM | `_GUARDRAIL_SYSTEM` prompt in `adhoc.py` rejects non-Airflow, adversarial, or off-topic queries. |
| Slack tool limit | Code | Max 4 tool calls per Slack query. |

---

## 14. Key Design Decisions

1. **No WebSockets (current version):** The VS Code extension uses SSE (Server-Sent Events) for streaming. True bidirectional communication (required for client-side tool execution on the user's local files) would require a WebSocket refactor.

2. **Hybrid Retrieval is final:** GraphRAG supplies historical priors (which files were changed in similar past PRs). Tree-sitter supplies structural grounding (what symbols and line ranges exist in those files). Neither alone is sufficient.

3. **Deterministic research tools, not LLM:** The Planner Orchestrator's research loop (grep, file reads, import tracing, caller tracing) uses zero LLM calls. This makes the refinement loop fast, predictable, and cost-free.

4. **DPO not PPO:** Direct Preference Optimization is used for RLHF rather than Proximal Policy Optimization because it requires no reward model, is stable to train with small datasets, and works well with the binary thumbs-up/thumbs-down feedback signal.

5. **Planner output is strict text not JSON:** The Planner is trained to emit a strict plain-text format (`REQUIRES_CODE_CHANGE:`, `REASON:`, `PLAN:` fields) rather than JSON. This is more robust to partial generations and easier to parse with regex even when the model truncates.

6. **Escalation is bounded:** The Patcher/Critic/Sandbox loop runs at most 3 patcher iterations and 2 critic rounds. Planner escalation runs at most once (no infinite replanning). This prevents runaway agentic loops.
