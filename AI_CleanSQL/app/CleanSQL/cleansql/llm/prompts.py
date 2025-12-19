"""Prompt templates for dual-output SQL generation with data quality awareness."""
from __future__ import annotations

from textwrap import dedent
from typing import Iterable, Sequence

# Data-quality-aware system prompt for CleanSQL
DQ_SYSTEM_PROMPT = dedent(
    """
    You are CleanSQL, a data-quality-aware text-to-SQL expert.

    Your job:
    - Read the schema and RAG context (column health profiles, dictionaries, repair rules).
    - Understand the natural-language question.
    - Plan and emit robust, data-quality-aware SQL.

    Always return four sections in order:
    1) PLAN - short bullet outline (max 6 steps) that:
       - Identifies the factual columns and tables needed to answer the question.
       - Inspects health/profile stats for those columns (missing %, duplicates, outliers, unit issues).
       - Decides, per column, whether rulebook-based repairs are required.
       - Mentions deduplicating every referenced table on its PK (or business key) if duplicates exist.
    2) BASIC_SQL - initial answer inside ```sql fences```
    3) ROBUST_SQL - read-only SQL using CTE repairs with pre-profiled constants inside ```sql fences```
    4) NOTES - numbered list covering ONLY the data-quality repairs actually applied (format `1. Action count (pct%) detail`). If no repairs are needed, set NOTES to `No quality-repairs required`.

    Constraints:
    - BASIC_SQL and ROBUST_SQL must be read-only (SELECT/CTE only, no DDL/DML).
    - ROBUST_SQL must surface CTE-based repairs first and may consume median/p95 constants from context. Never compute percentiles at runtime.
    - Respect dictionaries, rules, units, and health cards from context. Mention repairs inside NOTES.
    - NOTES must cite counts/percentages from the health stats (e.g., `1. Imputed 41 (2.8%) missing age values with median=42.0.`).
    - ORDER BY deterministic; prefer COALESCE for null handling.
    - Only apply a repair to a column if the context (RAG health profiles or rulebook) explicitly reports an issue for that column (e.g., missing %, null %, duplicate %, extreme outliers, unit mismatch). Do NOT invent new repairs.
    - If no such issue is mentioned for any referenced column, keep BASIC_SQL and ROBUST_SQL identical and set NOTES to `No quality-repairs required`.
    """
).strip()


FEWSHOT_EXAMPLES = [
    dedent(
        """
        PLAN:
        - Identify measure column and grouping key
        - Check metric column health and apply rulebook repairs
        - Deduplicate dimension on primary/business key
        - Join dimension
        - Aggregate

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
        1. Capped 12 (0.6%) revenue outliers at p95=120000.0 before aggregating.
        2. Ensured categories follow provided dictionary values.
        """
    ).strip(),
    dedent(
        """
        PLAN:
        - Filter rows by date window
        - Check status column health for missing/dup issues
        - Deduplicate by business key keeping latest timestamp
        - Handle nulls
        - Count survivors

        BASIC_SQL:
        ```sql
        SELECT COUNT(*)
        FROM orders
        WHERE order_date BETWEEN '2021-01-01' AND '2021-12-31'
        ```

        ROBUST_SQL:
        ```sql
        WITH normalized AS (
            SELECT order_id, COALESCE(status, 'unknown') AS status, order_date, updated_at
            FROM orders
        ), keyed AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn
            FROM normalized
            WHERE order_date BETWEEN '2021-01-01' AND '2021-12-31'
        )
        SELECT COUNT(*) FROM keyed WHERE rn = 1
        ```

        NOTES:
        1. Imputed 41 (2.8%) missing status values with dictionary standard labels.
        2. Deduplicated 6 (0.3%) orders keeping latest updated_at.
        """
    ).strip(),
]


def format_context(schema: str, rag_chunks: Iterable[str]) -> str:
    """Format schema and RAG chunks into context block."""
    bundle = ["# Schema", schema.strip()]
    rag_text = "\n\n".join(chunk.strip() for chunk in rag_chunks if chunk.strip())
    if rag_text:
        bundle.append("# RAG Context")
        bundle.append(rag_text)
    return "\n\n".join(bundle)


def build_prompt(
    question: str,
    schema_text: str,
    rag_chunks: Iterable[str],
    *,
    include_fewshot: bool = False,
) -> str:
    """Build complete user prompt with schema, RAG, and question.
    
    System prompt (DQ_SYSTEM_PROMPT) should be sent separately as system message.
    """
    ctx = format_context(schema_text, rag_chunks)
    
    prompt_parts = [ctx]
    
    if include_fewshot:
        exemplar_block = "\n\n".join(FEWSHOT_EXAMPLES)
        prompt_parts.append("# Exemplars\n" + exemplar_block)
    
    prompt_parts.append("# Question\n" + question.strip())
    prompt_parts.append("Provide PLAN bullets before writing SQL.")
    prompt_parts.append("Return the four sections in order: PLAN, BASIC_SQL, ROBUST_SQL, NOTES.")
    
    return "\n\n".join(part.strip() for part in prompt_parts if part)
