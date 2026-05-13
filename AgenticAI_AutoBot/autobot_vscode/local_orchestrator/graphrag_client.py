"""
Neo4j GraphRAG client for the AutoBot orchestrator.

Used by:
  - planner_orchestrator (candidate files, co-modified neighbor files)
  - app.py query command  (similar issues, linked PRs for adhoc queries)

Requires: pip install neo4j
Neo4j must be running: cd graphrag && docker compose up -d

All functions return empty lists / False when Neo4j is unreachable,
so the rest of the system degrades gracefully.
"""
from __future__ import annotations

import os
from datetime import datetime

from neo4j import GraphDatabase

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASS = os.environ.get("NEO4J_PASS", "password")

_driver = None


def _get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
    return _driver


def neo4j_available() -> bool:
    """Return True if Neo4j is reachable."""
    try:
        _get_driver().verify_connectivity()
        return True
    except Exception:
        return False


# ── Planner-orchestrator tools ─────────────────────────────────────────────


def get_candidate_files(issue_number: int, top_k: int = 6) -> list[str]:
    """Files historically touched by PRs linked to issues similar to this one."""
    if not neo4j_available():
        return []
    try:
        with _get_driver().session() as s:
            result = s.run(
                """
                MATCH (i:Issue {number: $n})-[:RESOLVED_BY]->(pr:PR)-[:TOUCHES]->(f:File)
                RETURN f.filename AS path, count(*) AS freq
                ORDER BY freq DESC LIMIT $k
                """,
                n=issue_number,
                k=top_k,
            )
            return [r["path"] for r in result]
    except Exception:
        return []


def get_neighbor_files(file_path: str, top_k: int = 5) -> list[str]:
    """Files historically co-modified with this file."""
    if not neo4j_available():
        return []
    try:
        with _get_driver().session() as s:
            result = s.run(
                """
                MATCH (:File {filename: $p})<-[:TOUCHES]-(pr:PR)-[:TOUCHES]->(other:File)
                WHERE other.filename <> $p
                RETURN other.filename AS path, count(*) AS freq
                ORDER BY freq DESC LIMIT $k
                """,
                p=file_path,
                k=top_k,
            )
            return [r["path"] for r in result]
    except Exception:
        return []


# ── Adhoc query tools ──────────────────────────────────────────────────────


def similar_issues(issue_number: int, k: int = 5) -> list[dict]:
    """
    Vector similarity search over ingested issues.
    Requires 'issue_embeddings' vector index from vectorize_issues.py.
    Falls back to fulltext search if vector index is missing.
    """
    if not neo4j_available():
        return []
    try:
        with _get_driver().session() as s:
            try:
                result = s.run(
                    """
                    MATCH (seed:Issue {number: $n})
                    CALL db.index.vector.queryNodes('issue_embeddings', $k, seed.embedding)
                    YIELD node AS issue, score
                    WHERE issue.number <> $n
                    RETURN issue.number AS number, issue.title AS title,
                           issue.state AS state, issue.html_url AS url,
                           issue.created_at AS created_at, issue.closed_at AS closed_at,
                           issue.user_login AS reporter, score
                    ORDER BY score DESC
                    """,
                    n=issue_number,
                    k=k,
                )
            except Exception:
                # Fallback: fulltext search (no embeddings)
                result = s.run(
                    """
                    MATCH (seed:Issue {number: $n})
                    WITH seed.title + ' ' + coalesce(seed.body, '') AS query
                    CALL db.index.fulltext.queryNodes('issue_text', query)
                    YIELD node AS issue, score
                    WHERE issue.number <> $n
                    RETURN issue.number AS number, issue.title AS title,
                           issue.state AS state, issue.html_url AS url,
                           issue.created_at AS created_at, issue.closed_at AS closed_at,
                           issue.user_login AS reporter, score
                    ORDER BY score DESC LIMIT $k
                    """,
                    n=issue_number,
                    k=k,
                )
            rows = [dict(r) for r in result]
            # Compute days_to_resolve for each row
            for r in rows:
                if r.get("created_at") and r.get("closed_at"):
                    try:
                        c = datetime.fromisoformat(str(r["created_at"]).replace("Z", ""))
                        cl = datetime.fromisoformat(str(r["closed_at"]).replace("Z", ""))
                        r["days_to_resolve"] = (cl - c).days
                    except Exception:
                        r["days_to_resolve"] = None
                else:
                    r["days_to_resolve"] = None
            return rows
    except Exception:
        return []


def linked_prs_for_issues(issue_numbers: list[int]) -> list[dict]:
    """Return PRs linked to any of the given issue numbers."""
    if not neo4j_available():
        return []
    try:
        with _get_driver().session() as s:
            result = s.run(
                """
                MATCH (i:Issue)-[:RESOLVED_BY]->(pr:PR)
                WHERE i.number IN $nums
                OPTIONAL MATCH (u:User)-[:AUTHORED]->(pr)
                RETURN i.number AS issue_number, pr.number AS pr_number,
                       u.login AS author, pr.merged_at AS merged_at,
                       pr.title AS pr_title
                ORDER BY pr.merged_at DESC
                """,
                nums=issue_numbers,
            )
            return [dict(r) for r in result]
    except Exception:
        return []


def execute_cypher(query: str, limit: int = 20) -> list[dict]:
    """Execute a raw Cypher query against the Neo4j database (Read-Only)."""
    if not neo4j_available():
        return [{"error": "Neo4j is currently unreachable."}]
    # Read-only guardrail — allow CALL db.index.* for vector/fulltext search, block all writes
    query_upper = query.upper()
    write_keywords = ["CREATE ", "MERGE ", " SET ", "DELETE ", "REMOVE ", "DROP "]
    if any(kw in query_upper for kw in write_keywords):
        return [{"error": "Write operations are not permitted via this tool. Use read-only queries."}]
    try:
        # Enforce limit if not explicitly defined by LLM
        if "LIMIT" not in query.upper():
            query += f" LIMIT {limit}"
        
        with _get_driver().session(default_access_mode="READ") as s:
            result = s.run(query)
            data = [dict(r) for r in result]
            if not data:
                return [{"error": "Query returned 0 results. You likely hallucinated a relationship or property. STOP AND FIX IT! Rule 1: Use [:AUTHORED], NOT AUTHORED_BY. Rule 2: Use [:REVIEWED], NOT REVIEWED_BY. Rule 3: Use [:HAS_LABEL], NOT a .LABELS property. Rule 4: Use [:TOUCHES]->(File), NOT a .TOUCHES property."}]
            return data
    except Exception as e:
        return [{"error": f"Cypher execution failed: {str(e)}"}]
