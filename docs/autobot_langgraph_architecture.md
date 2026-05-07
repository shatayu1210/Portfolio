# AutoBot LangGraph Architecture & Workflow

This document provides a comprehensive overview of the AutoBot pipeline, a dual-graph agentic system built with LangGraph to autonomously plan, implement, and validate code changes (diffs) for GitHub issues. It is designed to be provided as context to AI coding assistants to quickly understand the system's execution flow.

## 📁 System Components

The system is distributed across a few core Python modules:

*   **`app.py`**: The FastAPI backend. It manages the REST API endpoints, initializes the LangGraph state, handles LLM provider selection (HuggingFace TGI, Ollama, Gemini), and acts as the top-level orchestrator that connects the Planner and Patcher graphs.
*   **`langgraph_workflow.py`**: Defines the `AgentState` schema and the nodes/edges for the core graphs (`planner_graph` and `patcher_graph`). It contains the logic for interacting with the sandbox container and the Chain of Debate (Critic) loop.
*   **`planner_orchestrator.py`**: Contains the complex, non-LangGraph refinement loop (`run_planner_with_refinement`) that the Planner node uses to draft, critique, and research plans. It also handles building the specific context blocks for the Patcher (`assemble_patcher_input`).
*   **`graphrag_client.py`**: Interfaces with a Neo4j graph database to retrieve historically related files (co-modification patterns) to improve context retrieval for novel issues.
*   **`.env`**: Configuration for LLM adapters, connection endpoints, and specific token/context budget limits (`HF_TGI_MAX_CONTEXT_TOKENS`, `HF_TGI_PATCHER_MAX_NEW_TOKENS`).

---

## 🧠 The State Schema (`AgentState`)

The entire execution state is tracked via a `TypedDict` in `langgraph_workflow.py`:

*   **Inputs**: `issue_number`, `title`, `body`, `repo_path`, `ts_index` (Tree-sitter symbol index).
*   **Planner Outputs**: `plan` (files, steps, code spans, requires_code_change), `trace` (confidence scores).
*   **Patcher Inputs**: `patcher_input` (a highly structured JSON payload with targeted file context chunks, resolved dependencies, and tests).
*   **Patcher Outputs**: `patch` (the generated unified diff), `iterations`, `context_diagnostics` (LLM token/truncation stats).
*   **Debate/Validation State**: `sandbox_result`, `sandbox_error_class`, `critic_verdict`, `critic_feedback`, `debate_rounds`.
*   **Escalation State**: `rejection_context` (details of a failed attempt passed back to the planner).

---

## 🔄 Execution Flow

The system operates in two distinct phases, separated by a human-in-the-loop (HITL) approval step.

### Phase 1: The Planner Graph (Generation & Refinement)
**Triggered by:** User asking to generate a plan via `/api/plan`.

1.  **`orchestrator_node`**: Initializes the state and queries Neo4j via `graphrag_client.py` to find historically related candidate files.
2.  **`planner_node`**: Hands execution over to `planner_orchestrator.py` (`run_planner_with_refinement`).
    *   **Draft**: The LLM generates an initial plan (Target files, Summary, Code Spans).
    *   **Score**: The system assigns a deterministic confidence score to the plan.
    *   **Evaluate**: The plan is checked for weaknesses (e.g., hallucinated files, missing context). An internal pure-prompt Critic evaluates the plan.
    *   **Research**: If weaknesses are found or the Critic complains, the system uses deterministic tools (grep, tree-sitter, GraphRAG) to gather more context.
    *   **Refine**: The LLM is prompted again with the new evidence to produce a better plan.
3.  **Pause**: The `planner_graph` ends. The plan is presented to the user on the frontend for approval/editing.

### Phase 2: The Patcher Graph (Implementation & Debate)
**Triggered by:** User approving the plan via `/api/approve_plan`.

1.  **`patcher_prep_node`**: Calls `assemble_patcher_input` in `planner_orchestrator.py`.
    *   This is a critical step. It takes the approved plan and builds a heavily constrained JSON payload (`patcher_input`).
    *   It retrieves **Primary** files (the targets), resolves **Supporting** files (tracing TypeScript/Python imports or finding same-directory siblings), and finds matching **Test** files.
2.  **`patcher_node`**: The LLM (using a specialized diff-generation adapter with higher `max_new_tokens`) takes the `patcher_input` and generates a strict Unified Diff. It also records detailed `context_diagnostics` to track token truncation.
3.  **`sandbox_node`**:
    *   Restores and cleans a persistent Docker container (`airflow-sandbox`).
    *   Applies the generated diff.
    *   **Multi-strategy Validation**: If the patch applies cleanly, it validates the code. For TypeScript, it runs `pnpm tsc --noEmit` (type checking), then `eslint`, then `vitest`. For Python, it runs `pytest`.
4.  **Diagnostic Router (`route_after_sandbox`)**:
    *   If Sandbox passes → Workflow ends (`APPROVED`).
    *   If Sandbox fails, regex patterns classify the error.
    *   **Patcher Errors** (syntax, indentation, hunk offset) → Route to `critic_node`.
    *   **Planner Errors** (assertion failures, logic conflicts) → Route to `escalate_planner`.
5.  **`critic_node` (Chain of Debate)**:
    *   Takes the failed diff and the sandbox error output.
    *   Provides structured reasoning and a verdict: `REVISE` or `REJECT`.
    *   `REVISE` → Loops back to `patcher_node` with the Critic's feedback appended to the prompt.
    *   `REJECT` → Determines the plan itself is flawed. Overrides the router and forces an `escalate_planner`.

### Phase 3: Automated Replanning (Escalation)
**Triggered by:** The Patcher graph terminating with an `escalate_planner` status (either from the Router or the Critic).

Handled directly in `app.py`:
1.  The app detects the escalation.
2.  It bundles the failed plan, the failed diff, the sandbox error, and the Critic's feedback into a `rejection_context`.
3.  It automatically re-invokes the **Planner Graph**.
4.  Inside `planner_node`, the `rejection_context` is injected directly into the repository context prompt with strict instructions: *"Do NOT target the same files... Fix the root cause described..."*
5.  A new, corrected plan is generated and returned to the user, who can then approve it to restart Phase 2.

---

## 🛠️ Key Architectural Decisions

1.  **Separation of Concerns**: Planner uses a standard Chat adapter (`HF_PLANNER_ADAPTER`); Patcher uses a specialized Diff-generation adapter (`HF_PATCHER_ADAPTER`).
2.  **Stateful Memory**: LangGraph's `MemorySaver` allows the system to remember previous iterations and debate rounds, preventing infinite loops.
3.  **Type Safety over Blind Testing**: In the Sandbox, TypeScript files are strictly type-checked (`tsc --noEmit`) before any tests are run. This prevents the system from passing a broken patch just because no unit tests exist for a file.
4.  **Observability Sink**: Every LLM call to HuggingFace TGI records token counts and truncation flags into a global metadata sink. This is captured into `context_diagnostics` so that every JSON trace log shows exactly if a model hit a context limit during generation.
