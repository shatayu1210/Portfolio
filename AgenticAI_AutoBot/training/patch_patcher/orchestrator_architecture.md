# AutoBot — Orchestrator-Driven Refinement Architecture
> How repomap.py's retrieval logic maps to orchestrator refinement loops, complete model I/O specs, and full orchestrator responsibilities.

---

## 1. Why repomap.py's Approach Doesn't Fit — And What Does

### What repomap.py Actually Does (Aider's Design)

Aider's `repomap.py` is a **monolithic, single-pass retrieval engine**. On every invocation it:

1. Walks the entire repo, runs tree-sitter on every file, extracts all defs/refs.
2. Builds an in-memory `networkx.MultiDiGraph` of cross-file symbol references.
3. Runs PageRank with personalization weights (chat files, mentioned identifiers).
4. Binary-searches a tag count to fit the output into a token budget.
5. Renders a condensed tree view of ranked files + their visible symbols.

This works for Aider because Aider is a **single-agent, single-model system** — it has one LLM that needs one big context window stuffed with "the most relevant parts of the repo." There is no planning step, no refinement, no decomposition. The repo map IS the retrieval.

### Why This Is Wrong for AutoBot

AutoBot has three atomic models with different context needs. Stuffing a monolithic repo map into each one causes several problems:

- **Wasted tokens.** The Planner doesn't need function bodies. The Patcher doesn't need file rankings. The Critic doesn't need candidate lists. A single fat context blob means every model pays for information only one model uses.
- **No progressive narrowing.** repomap.py computes everything once, up front. If the initial PageRank misses the right file (common for novel issues), there is no recovery path — you're stuck with a bad map.
- **No separation of concerns.** The retrieval logic, the ranking logic, and the context formatting are all fused into one 600-line class. You can't swap the ranking strategy without rewriting the renderer.
- **Latency at the wrong time.** Full-repo tree-sitter + PageRank takes 1-5 seconds on a large repo. In Aider this is tolerable (it runs once per turn). In AutoBot's multi-step pipeline, you'd pay this cost repeatedly or cache stale results.

### What AutoBot Should Do Instead

**Decompose repomap.py's responsibilities across the orchestrator's refinement ladder.** Instead of one monolithic retrieval pass, distribute the work:

| repomap.py Step | AutoBot Equivalent | Owned By |
|---|---|---|
| Tree-sitter tag extraction (all files) | **Pre-indexed in Neo4j** as `(:File)-[:DEFINES]->(:Symbol)` nodes | Offline ETL (already done) |
| Cross-file reference graph | **`[:TOUCHES]` edges from PR history** in Neo4j (empirically stronger than static call-graph for predicting which files to change together) | Offline ETL |
| PageRank personalization | **GraphRAG top-K** query with issue embedding similarity — ranks files by historical resolution frequency, not static reference density | Orchestrator Level 0 |
| Binary-search token fitting | **Orchestrator context budgeting** — each model gets a purpose-built context bundle, not a one-size-fits-all tree | Orchestrator prompt assembly |
| Tree rendering of ranked symbols | **On-demand VS Code file reads + tree-sitter spans** for only the files the Planner actually selected | Orchestrator Level 1-2 refinement |

The key architectural shift: **retrieval is no longer a function call that returns a blob. It is a multi-step orchestrator workflow that progressively narrows context.**

---

## 2. Orchestrator Refinement Loop — The repomap.py Replacement

This maps directly to the escalation ladder from `Planner_README.md`, but now explicitly shows where each piece of repomap.py's logic lives.

### Level 0: Fast Path (replaces repomap.py's PageRank ranking)

**What runs:**
- GraphRAG top-K query: embed issue → ANN search → `RESOLVED_BY → TOUCHES` traversal → ranked candidate files.
- Tree-sitter symbol headers for top candidates (from Neo4j `[:DEFINES]` edges — no live file reads yet).

**What it produces:**
- `CANDIDATE_FILES`: list of 6-10 file paths ranked by historical resolution frequency.
- `SYMBOL_SUMMARIES`: for each candidate file, the class/function names it defines (names and kinds only, no code).

**Why this is better than repomap.py:** repomap.py ranks files by static reference PageRank. Level 0 ranks files by *"which files were actually modified when similar issues were resolved."* This is a strictly more useful signal for a Planner whose job is to predict files-to-modify.

**Latency:** 25-50ms (Neo4j vector search + graph hop).

### Level 1: Cheap Expansion (replaces repomap.py's "mentioned_idents" personalization)

**Trigger:** Planner pass-1 says NO or cites only 1 low-confidence file.

**What runs:**
- Wider GraphRAG: increase top-K, include second-hop neighbors.
- Keyword/symbol search: extract key terms from issue body, search against file paths and symbol names in Neo4j.
- VS Code workspace file listing for targeted directories (equivalent to repomap.py's `find_src_files` but scoped, not full-repo).

**What it produces:**
- Expanded candidate list with provenance tags (why each file was added).
- Module-level context (which directory/package each candidate belongs to).

**Latency:** 50-100ms additional.

### Level 2: Precision Verification (replaces repomap.py's tree rendering)

**Trigger:** Pass-1 plan is YES but evidence is thin, or Level 1 found plausible new targets.

**What runs:**
- **VS Code file reads**: read actual source code for top 3-8 candidate files. This is the equivalent of repomap.py's `render_tree` / `TreeContext` — but only for files the Planner has already selected, not every file in the repo.
- **Tree-sitter span extraction**: for each read file, extract the specific function/class bodies around matched symbols. Bounded to ~50 lines per symbol, max 3 symbols per file.
- **Import/caller tracing**: if a suspected symbol is imported elsewhere, trace one hop to find the actual definition site.

**What it produces:**
- Code snippets with file path + line range + symbol header.
- Evidence of whether the Planner's targeted symbols actually exist and match the issue semantics.

**Latency:** 200-500ms (file I/O + tree-sitter parsing for a handful of files).

### Level 3: Deep Fallback (novel issues — repomap.py has no equivalent)

**Trigger:** GraphRAG is sparse/empty (novel issue pattern), or persistent ambiguity after Level 2.

**What runs:**
- Deeper GraphRAG traversal: additional hops, PR-review evidence, related file clusters.
- Cross-check with historical patch idioms for similar issue clusters.
- Bounded directory-level file scan with language-aware filtering (like repomap.py's `find_src_files` but budget-capped).

**What it produces:**
- Best-effort candidate list with explicit low-confidence markers.
- Orchestrator flags this for HITL confirmation before proceeding.

**Latency:** 500ms-2s (acceptable because this path is rare).

### Why This Is Superior to repomap.py

1. **Lazy evaluation.** Most issues resolve at Level 0-1. You never pay the cost of full-repo parsing unless you actually need it.
2. **Progressive narrowing.** Each level uses the output of the previous level to focus the search, rather than computing everything in parallel and hoping PageRank surfaces the right answer.
3. **Model-specific context.** The Planner gets file lists + symbol headers. The Patcher gets code spans. The Critic gets review history. No model gets a generic blob.
4. **Recovery path.** If Level 0 misses, Level 1-2 can recover. repomap.py has no recovery — if PageRank ranks a file low, it's gone.
5. **Agents stay atomic.** The Planner doesn't know about tree-sitter. The Patcher doesn't know about GraphRAG. The orchestrator mediates all retrieval, keeping each model's prompt clean and focused.

---

## 3. Model I/O Specifications

### 3.1 Planner

**Role:** Given an issue, predict which files need modification and what the intent for each file is.

#### Input (assembled by orchestrator)

```
ISSUE_TITLE: <title>
ISSUE_BODY: <body text, cleaned>
ISSUE_LABELS: <comma-separated labels>

CANDIDATE_FILES (from GraphRAG, ranked by historical frequency):
  1. airflow/operators/python.py  (freq: 7, from 5 similar issues)
  2. airflow/models/dagrun.py     (freq: 4, from 3 similar issues)
  3. ...up to K=6 files

SYMBOL_CONTEXT (tree-sitter headers for top candidates):
  airflow/operators/python.py:
    - class PythonOperator (line 45)
    - def execute(self, context) (line 112)
    - def _write_args(self, ...) (line 198)
  airflow/models/dagrun.py:
    - class DagRun (line 30)
    - def update_state(self, ...) (line 155)

SIMILAR_RESOLUTIONS (from GraphRAG):
  - Issue #8823 ("race condition in scheduler") → resolved by PR #8901
    touching: airflow/jobs/scheduler_job.py, airflow/models/dagrun.py
  - Issue #9102 ("missing task instances") → resolved by PR #9155
    touching: airflow/models/taskinstance.py
```

#### Input Context (what each field provides)

| Field | Source | Purpose |
|---|---|---|
| `ISSUE_TITLE` + `ISSUE_BODY` | MCP → GitHub API | The problem statement — what the Planner reasons about |
| `CANDIDATE_FILES` | Neo4j GraphRAG (Level 0) | Historical prior — "files that were modified for similar issues" |
| `SYMBOL_CONTEXT` | Neo4j `[:DEFINES]` edges | Structural grounding — tells Planner what symbols exist in candidates |
| `SIMILAR_RESOLUTIONS` | Neo4j `SIMILAR_TO → RESOLVED_BY → TOUCHES` | Pattern matching — shows how analogous issues were resolved |
| `ISSUE_LABELS` | MCP → GitHub API | Categorical signal (bug vs feature vs docs) |

#### Ground Truth Output (for training)

```
REQUIRES_CODE_CHANGE: YES
REASON: The issue describes a race condition in DagRun state transitions
  that causes missing task instances. Historical PRs for similar scheduler
  race conditions consistently touched dagrun.py and taskinstance.py.
PLAN:
  - file: airflow/models/dagrun.py
    what_to_change: Add locking around update_state to prevent concurrent
      state transitions from creating duplicate task instances
  - file: airflow/models/taskinstance.py
    what_to_change: Add idempotency check in task instance creation to
      handle the case where a parallel scheduler already created the instance
```

**Ground truth source:** From `prs.jsonl` — the `files[].filename` from the actual resolving PR gives the file list. The `what_to_change` is derived from the cleaned PR body text (cleaned per the target cleaning rule: strip HTML comments, markdown image embeds, license boilerplate, URLs; cap to 180 words).

**Training loss:** Next-token prediction on the structured plan output.

**Eval metrics:** File Recall@3, File Recall@5, Exact File Match, hallucination rate.

---

### 3.2 Patcher

**Role:** Given a plan + actual file contents, generate a unified diff for a single file.

#### Input (assembled by orchestrator)

```
ISSUE_BODY: <issue text>

PLANNER_OUTPUT:
  file: airflow/models/dagrun.py
  intent: Add locking around update_state to prevent concurrent state
    transitions from creating duplicate task instances

FILE_CONTENT (fetched live via MCP, truncated to relevant span):
  # airflow/models/dagrun.py, lines 140-210
  class DagRun(Base):
      ...
      def update_state(self, session=None):
          """Determines the overall state of the DagRun..."""
          <actual code lines>

HISTORICAL_IDIOMS (from Neo4j: past PRs that touched this exact file):
  - PR #7220: "Migrated database reads to async session, added
    select_for_update() on DagRun rows to prevent race conditions"
  - PR #8901: "Added row-level locking on state transitions using
    with_for_update() pattern"

GRAPHRAG_PR_CONTEXT:
  - Past CI outcomes for this file: 85% pass rate
  - Common review feedback: "Always use session.merge() not session.add()
    for DagRun updates"
```

#### Input Context (what each field provides)

| Field | Source | Purpose |
|---|---|---|
| `ISSUE_BODY` | Passed through from Planner stage | Problem statement for semantic grounding |
| `PLANNER_OUTPUT` | Planner model output (post-HITL approval) | What to change and why — the Patcher's directive |
| `FILE_CONTENT` | MCP → GitHub API / VS Code file read | The actual code to modify — truncated to relevant function ± 20 lines via tree-sitter span |
| `HISTORICAL_IDIOMS` | Neo4j: `File ← TOUCHED_BY ← PR.body + PR.commits[].message` | How past developers idiomatically modified this exact file |
| `GRAPHRAG_PR_CONTEXT` | Neo4j: `File ← TOUCHED_BY ← PR.ci_conclusion, PR.reviews` | CI pass rates and review conventions for this file |

#### Ground Truth Output (for training)

```diff
--- a/airflow/models/dagrun.py
+++ b/airflow/models/dagrun.py
@@ -155,7 +155,12 @@ class DagRun(Base):
     def update_state(self, session=None):
-        dag_runs = session.query(DagRun).filter(...)
+        dag_run = (
+            session.query(DagRun)
+            .filter(...)
+            .with_for_update()
+            .one()
+        )
         ...
```

**Ground truth source:** From `prs.jsonl` → `files[].patch` field — the actual unified diff from the merged PR. Each training example is ONE file's patch (not the whole PR), paired with the file content at the pre-patch state.

**Training enrichment:**
- Python files get tree-sitter AST span extraction (function/class boundaries) where blob lookup is available.
- When AST spans are unavailable, fallback hunk-window spans (±20 lines around diff hunk) are injected.
- GraphRAG file candidates + historical idioms persisted with query metadata.

**Training loss:** Next-token prediction on the unified diff output.

**Eval metrics:** CodeBLEU, Compilation Rate (`py_compile`), Test Pass Rate (sandbox), Edit Distance vs actual diff.

---

### 3.3 Critic

**Role:** Evaluate a generated patch. Predict review decision + generate actionable feedback.

#### Input (assembled by orchestrator)

```
GENERATED_PATCH:
  <the unified diff from Patcher>

SANDBOX_RESULT:
  exit_code: 0
  stdout: "47 passed, 0 failed"
  stderr: ""
  runtime: 12.3s

HISTORICAL_REVIEW_PATTERNS (from Neo4j):
  Review friction for airflow/models/dagrun.py:
  - "CHANGES_REQUESTED: This file must not import from airflow.models
    directly due to circular dependencies" (PR #7840)
  - "CHANGES_REQUESTED: Remember to call session.close() in the finally
    block, we've had memory leaks here before" (PR #8102)

  Inline code friction (diff_hunk-mapped):
  - Line 160: "Always use with_for_update() not FOR UPDATE raw SQL
    for portability" (PR #7220, reviewer: @kaxil)

HISTORICAL_CI_PATTERNS:
  - This file's recent CI failure rate: 15%
  - Common failure modes: import cycles, session leak in tests
  - check_runs[].conclusion where conclusion = 'failure': 6 of last 40 PRs
```

#### Input Context (what each field provides)

| Field | Source | Purpose |
|---|---|---|
| `GENERATED_PATCH` | Patcher model output | The artifact being reviewed |
| `SANDBOX_RESULT` | Local Docker sandbox execution | Concrete execution signal — did it compile and pass tests? |
| `HISTORICAL_REVIEW_PATTERNS` | Neo4j: `File → REVIEWED_IN → PR Reviews where state='CHANGES_REQUESTED'` | Team conventions and known "gotchas" for this file |
| `INLINE_CODE_FRICTION` | Neo4j: `pr_review_comments[].body` mapped to `diff_hunk` | Localized engineering feedback from past reviewers |
| `HISTORICAL_CI_PATTERNS` | Neo4j: `check_runs[].conclusion` for PRs touching this file | Flags historically fragile files |

#### Ground Truth Output (for training)

```
DECISION: APPROVE
FEEDBACK: The patch correctly applies row-level locking using
  with_for_update() which matches the established pattern from PR #7220.
  Session handling follows the merge() convention. No circular import
  risk introduced.
LINE_COMMENTS:
  - line 158: "Good use of with_for_update() — consistent with existing
    concurrency patterns in this file."
```

**Ground truth source:** From `prs.jsonl` → `reviews[]` field — real human review decisions (`state`: APPROVED / CHANGES_REQUESTED) and `body` text. Also `review_comments[]` for inline feedback.

**DPO training pairs (post-SFT):**
- `chosen`: final APPROVED review body for a PR.
- `rejected`: earlier CHANGES_REQUESTED review body for the same PR.
- This teaches the Critic to recognize what constitutes a good patch, not just what's wrong.

**Training loss:** SFT via next-token prediction, then DPO with β=0.1.

**Eval metrics:** Decision Accuracy (APPROVE vs CHANGES_REQUESTED), BERTScore (review body vs actual human review), ROUGE-L.

---

## 4. Complete Orchestrator Responsibilities

The orchestrator is the central nervous system. The three models are atomic and stateless — they receive a prompt, produce output, and have no memory. Everything else is the orchestrator's job.

### 4.1 Retrieval & Context Assembly

This is where the repomap.py replacement lives. The orchestrator owns ALL retrieval.

| Responsibility | Detail |
|---|---|
| **GraphRAG queries** | Embed issue text, query Neo4j for similar issues, traverse `RESOLVED_BY → TOUCHES` edges, rank candidate files by frequency. Owns the `neo4j_queries.py` utility layer. |
| **Tree-sitter context extraction** | For Planner: pull symbol headers from Neo4j `[:DEFINES]` edges. For Patcher: run live tree-sitter on fetched files to extract function/class spans bounded to relevant symbols ± 20 lines. |
| **VS Code file reads** | Fetch actual file contents via MCP / GitHub API / local workspace. Only for files the Planner has selected (never full-repo). |
| **Historical idiom retrieval** | Query Neo4j for past PR bodies and commit messages that touched the target files. Feed to Patcher as few-shot design-pattern context. |
| **Review history retrieval** | Query Neo4j for past review friction (`CHANGES_REQUESTED` reviews, inline comments, diff-hunk-mapped feedback) on target files. Feed to Critic. |
| **Context budgeting** | Each model gets a purpose-built context bundle within its token budget. Orchestrator compresses, ranks, deduplicates, and truncates — models never receive raw data dumps. |

### 4.2 Refinement Loop Management

The orchestrator implements the escalation ladder described in Section 2.

| Responsibility | Detail |
|---|---|
| **Confidence scoring** | After Planner pass-1, score evidence quality: how many candidate files matched? How strong were the GraphRAG similarity scores? Were tree-sitter spans non-empty? |
| **Trigger evaluation** | Check the 5 deterministic triggers from `Planner_README.md`: weak evidence, single low-confidence file, sparse candidates, semantic mismatch, path drift. |
| **Escalation execution** | Walk the Level 0 → 1 → 2 → 3 ladder. Each level runs only if the previous level's evidence was insufficient. |
| **Refinement bundle construction** | Build the delta-findings block for pass-2: `INITIAL_DECISION_SUMMARY`, `NEW_EVIDENCE_FOUND`, `CANDIDATE_FILES_RERANKED`, `CONFLICTS_OR_UNCERTAINTIES`, `REVISION_INSTRUCTION`. |
| **Single-retry enforcement** | One refinement round by default. The orchestrator does not allow unbounded re-prompting. |
| **Budget enforcement** | Hard caps per level: max files per round, max symbols per file, max lines per symbol, max refinement rounds. Prevents the orchestrator from degenerating into an expensive repo crawler. |

### 4.3 Pipeline Sequencing & Control Flow

```
Receive issue (from VS Code plugin or Slack)
  │
  ├─ Fetch issue body via MCP
  ├─ Run GraphRAG Level 0 retrieval
  ├─ Assemble Planner context bundle
  │
  ▼
Run Planner (pass-1)
  │
  ├─ If YES + high confidence → proceed
  ├─ If YES + low confidence → trigger refinement (Level 1-2)
  ├─ If NO + weak evidence → trigger refinement (Level 1-2)
  ├─ If NO + strong evidence → run cheap guard check, accept NO
  │
  ▼
[If refinement triggered]
  ├─ Execute escalation ladder
  ├─ Build refinement bundle
  ├─ Run Planner (pass-2)
  ├─ Validate pass-2 output schema/grounding
  │
  ▼
Present plan for HITL approval
  │
  ▼
[For each file in approved plan]
  ├─ Fetch file content via MCP (truncated to relevant span)
  ├─ Fetch historical idioms from Neo4j
  ├─ Assemble Patcher context bundle
  ├─ Run Patcher → unified diff
  │
  ▼
Assemble full patch (all file diffs)
  │
  ▼
Run Sandbox validation (Docker)
  ├─ Apply patch to repo snapshot
  ├─ Run pytest / build command
  ├─ Capture exit code + stdout + stderr
  │
  ├─ If FAIL → feed failure logs back to Patcher, retry (max 3)
  ├─ If PASS → proceed to Critic
  │
  ▼
Run Critic
  ├─ Feed: patch + sandbox result + review history + CI patterns
  ├─ If APPROVE → return final patch to VS Code
  ├─ If CHANGES_REQUESTED →
  │     ├─ If feedback is implementation-level → retry Patcher with feedback
  │     ├─ If feedback is strategy-level → re-enter Planner (rare)
  │     └─ Max 3 total Patcher↔Critic iterations
  │
  ▼
Return final .diff + critique to VS Code plugin
```

### 4.4 Replan Policy

The orchestrator re-enters the Planner **only** on strategy-level signals:

- Wrong subsystem or file family selected (Critic detects architectural mismatch).
- Repeated Patcher failures due to wrong symbol/file assumptions.
- New issue evidence appears mid-run (comments, scope change via MCP polling).

Ordinary implementation errors (syntax mistakes, wrong variable names, missing imports) stay in the Patcher ↔ Sandbox ↔ Critic retry loop. The orchestrator does NOT replan for these.

### 4.5 Sandbox Management

| Responsibility | Detail |
|---|---|
| **Container lifecycle** | Create disposable Docker container → copy repo snapshot → apply patch → run validation → capture logs → destroy container. |
| **Failure log formatting** | Parse sandbox stderr/stdout into structured feedback the Patcher can act on. Strip noise (stack traces from unrelated tests, dependency warnings). |
| **Retry integration** | On sandbox failure, append formatted failure log to Patcher's next prompt as `SANDBOX_FAILURE_LOG`. |
| **Resource limits** | Cap container runtime (e.g., 60s), memory (e.g., 2GB), no network. Prevent runaway test suites from blocking the pipeline. |

### 4.6 HITL (Human-in-the-Loop) Gate

| Responsibility | Detail |
|---|---|
| **Plan presentation** | After refinement, present the Planner's output to the developer in VS Code: which files, what intent, confidence level, evidence summary. |
| **Approval routing** | If developer approves → proceed to Patcher. If developer modifies → use modified plan. If developer rejects → stop. |
| **Transparency** | Show whether refinement changed the plan, which evidence triggered the change, and what confidence level the orchestrator assigned. |

### 4.7 Adapter Routing & Endpoint Management

| Responsibility | Detail |
|---|---|
| **LoRA selection** | The Coder Hub (Qwen 2.5 Coder 7B) hosts Planner, Patcher, and Critic as separate LoRA adapters. The orchestrator specifies which adapter to activate per call. |
| **Endpoint health** | Check HuggingFace endpoint status before calling. Handle auto-pause wake-up latency (cold start). |
| **Retry on infra failure** | Distinguish model-level failures (bad output) from infra-level failures (endpoint timeout, rate limit). Retry infra failures transparently. |

### 4.8 Logging & Observability

| Responsibility | Detail |
|---|---|
| **Per-issue trace** | Log the full pipeline trace: retrieval results, Planner input/output, refinement triggers, Patcher input/output, sandbox results, Critic decision. |
| **Refinement analytics** | Track: refinement trigger rate, first-pass NO → second-pass YES flip rate, precision impact of flips, recall gains, latency/token cost delta. |
| **Evidence bundles** | Persist the context bundles sent to each model for offline analysis and eval dataset construction. |
| **Cost tracking** | Log token counts per model call, endpoint wake-up events, total pipeline latency per issue. |

### 4.9 Novel-Issue Handling

When GraphRAG returns sparse or empty results (novel issue pattern with no historical precedent):

1. Broaden candidate search with bounded keyword/symbol matching against Neo4j.
2. Probe candidate files with limited code-span reads (Level 2).
3. Re-score and refine plan.
4. Flag as low-confidence and proceed to HITL gate with explicit uncertainty markers.
5. Use hard budgets to prevent endless scanning: max files per round, max symbols per file, max lines per symbol, max refinement rounds.

---

## 5. Summary: What Lives Where

| Concern | Owner | NOT Owned By |
|---|---|---|
| File ranking by historical resolution | Neo4j GraphRAG (orchestrator queries it) | Models |
| Symbol extraction (offline index) | Neo4j `[:DEFINES]` edges (pre-built by ETL) | Models |
| Live code reading | Orchestrator via MCP / VS Code file reads | Models |
| Tree-sitter span extraction (live) | Orchestrator (on-demand, for selected files only) | Models |
| Refinement trigger logic | Orchestrator (deterministic rules) | Models |
| Context compression & budgeting | Orchestrator | Models |
| Plan generation | Planner model | Orchestrator |
| Diff generation | Patcher model | Orchestrator |
| Review generation | Critic model | Orchestrator |
| Sandbox execution | Orchestrator (Docker SDK) | Models |
| HITL gating | Orchestrator (VS Code plugin surface) | Models |
| Retry/replan policy | Orchestrator (bounded loops) | Models |
| Endpoint/adapter routing | Orchestrator | Models |

The models are pure functions: `input → output`. Everything around them — retrieval, refinement, sequencing, validation, human interaction — is the orchestrator.
