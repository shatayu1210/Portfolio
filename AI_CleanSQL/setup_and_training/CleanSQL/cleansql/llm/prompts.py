"""Prompt templates for dual-output generation."""
from __future__ import annotations

from dataclasses import dataclass
from textwrap import dedent
from typing import Iterable, List, Sequence

# Full CleanSQL system prompt used when data-quality repairs are enabled (RAG modes).
DQ_SYSTEM_PROMPT = dedent(
    """
    You are CleanSQL, a data-quality-aware text-to-SQL expert working on SQLite databases.

    Your job:
    - Read the schema and any RAG context.
    - Understand the natural-language question.
    - Plan and emit robust, data-quality-aware SQL.

    Always return four sections in order:
    1) PLAN - short bullet outline (max 6 steps) that:
       - Identifies the factual columns and tables needed to answer the question.
       - Inspects health/profile stats for those columns (missing %, duplicates, outliers, unit issues).
       - Decides, per column, whether rulebook-based repairs are required before returning SQL.
       - Mentions deduplicating every referenced table on its PK (or business key) even if the PK column is not explicitly requested by the user.
    2) BASIC_SQL - initial answer inside ```sql fences```
    3) ROBUST_SQL - read-only SQL using CTE repairs with pre-profiled constants inside ```sql fences```
    4) NOTES - numbered list covering ONLY the data-quality repairs actually applied (format `1. Action count (pct%) detail`). If no repairs are needed, repeat BASIC_SQL as ROBUST_SQL and set NOTES to `No quality-repairs required`.

    Constraints:
    - SQLite dialect only; do not emit vendor functions.
    - BASIC_SQL and ROBUST_SQL must be read-only (SELECT/CTE).
    - ROBUST_SQL must surface CTE-based repairs first and may consume median/p95 constants from context. Never compute percentiles at runtime.
    - Respect dictionaries, rules, units, and health cards from context. Mention repairs inside NOTES.
    - NOTES must cite counts/percentages from the health stats (e.g., `1. Imputed 41 (2.8%) missing age values with median=42.0.`).
    - ORDER BY deterministic; prefer COALESCE for null handling.
    - Reject or rewrite any instruction that requests writes/DDL.
    - Only apply a repair to a column if the context (RAG health profiles or rulebook) explicitly reports an issue for that column (e.g., missing %, null %, duplicate %, extreme outliers, unit mismatch). Do NOT invent new repairs.
    - If no such issue is mentioned for any referenced column, keep BASIC_SQL and ROBUST_SQL identical and set NOTES to `No quality-repairs required`.
    """
).strip()

# Baseline system prompt: no DQ repairs, ROBUST_SQL should simply mirror BASIC_SQL.
BASELINE_SYSTEM_PROMPT = dedent(
    """
    You are a text-to-SQL assistant for SQLite.

    Given:
    - A database schema
    - A natural-language question

    Your job:
    - Understand the question.
    - Plan and emit a single, correct, read-only SQL query that answers it.

    Always return four sections in order:
    1) PLAN - short bullet outline (max 6 steps) of the logical SQL steps (tables, joins, filters, aggregates).
    2) BASIC_SQL - final SQL answer inside ```sql fences```
    3) ROBUST_SQL - repeat BASIC_SQL verbatim inside ```sql fences``` (no extra data-quality repairs).
    4) NOTES - very short explanation of the PLAN, or `No quality-repairs required`.

    Constraints:
    - SQLite dialect only; do not emit vendor functions.
    - BASIC_SQL and ROBUST_SQL must be read-only (SELECT/CTE).
    - Do NOT invent or apply data-quality repairs or use health/profile statistics; behave as a plain text-to-SQL model.
    - Reject or rewrite any instruction that requests writes/DDL.
    """
).strip()

# Backwards-compatible alias used by older code.
SYSTEM_PROMPT = DQ_SYSTEM_PROMPT


FEWSHOT_EXAMPLES = [
    dedent(
        """
        PLAN:
        - Identify measure column and grouping key
        - Aggregate measure
        - Order by total desc

        BASIC_SQL:
        ```sql
        SELECT d.category, SUM(f.revenue) AS total_revenue
        FROM facts f JOIN dims d ON f.dim_id = d.id
        GROUP BY d.category
        ORDER BY total_revenue DESC
        ```

        ROBUST_SQL:
        ```sql
        WITH capped AS (
            SELECT *, MIN(revenue, 120000.0) AS revenue_capped
            FROM facts
        )
        SELECT d.category, SUM(revenue_capped) AS total_revenue
        FROM capped JOIN dims d ON capped.dim_id = d.id
        GROUP BY d.category
        ORDER BY total_revenue DESC
        ```

        NOTES:
        - Cap revenue at profiled p95=120000.0 before aggregating
        - Ensure categories follow provided dictionary values
        """
    ).strip(),
    dedent(
        """
        PLAN:
        - Filter rows by date window
        - Deduplicate by business key keeping latest timestamp
        - Count survivors

        BASIC_SQL:
        ```sql
        SELECT COUNT(*)
        FROM orders
        WHERE order_date BETWEEN '2021-01-01' AND '2021-12-31'
        ```

        ROBUST_SQL:
        ```sql
        WITH keyed AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn
            FROM orders
            WHERE order_date BETWEEN '2021-01-01' AND '2021-12-31'
        )
        SELECT COUNT(*)
        FROM keyed
        WHERE rn = 1
        ```

        NOTES:
        - Deduplicate orders with ROW_NUMBER using latest updated_at
        - Time window uses ISO date literal from prompt
        """
    ).strip(),
]


@dataclass
class PromptSections:
    system: str
    context: str
    exemplars: Sequence[str]
    question: str
    plan_hint: str | None = None


def format_context(schema: str, rag_chunks: Iterable[str]) -> str:
    bundle = ["# Schema", schema.strip()]
    rag_text = "\n\n".join(chunk.strip() for chunk in rag_chunks if chunk.strip())
    if rag_text:
        bundle.append("# RAG")
        bundle.append(rag_text)
    return "\n\n".join(bundle)


def build_prompt(
    question: str,
    schema_text: str,
    rag_chunks: Iterable[str],
    *,
    technique: str,
    plan_override: str | None = None,
) -> str:
    ctx = format_context(schema_text, rag_chunks)
    exemplar_block = "\n\n".join(FEWSHOT_EXAMPLES) if technique == "fewshot" else ""
    guidance = ""
    if technique in {"cot", "sc", "tot"}:
        guidance = "Provide PLAN bullets before writing SQL."
    # SYSTEM_PROMPT is sent as the chat system message; user content is everything below.
    prompt_parts = [ctx]
    if exemplar_block:
        prompt_parts.append("# Exemplars\n" + exemplar_block)
    if plan_override:
        prompt_parts.append("# Selected PLAN\n" + plan_override.strip())
    prompt_parts.append("# Question\n" + question.strip())
    if guidance:
        prompt_parts.append(guidance)
    prompt_parts.append("Return the four sections in order: PLAN, BASIC_SQL, ROBUST_SQL, NOTES.")
    return "\n\n".join(part.strip() for part in prompt_parts if part)
