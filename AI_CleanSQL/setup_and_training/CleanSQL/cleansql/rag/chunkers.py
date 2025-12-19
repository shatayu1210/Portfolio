"""Chunking utilities for profiling artifacts."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List


@dataclass
class Chunk:
    text: str
    library: str
    metadata: Dict[str, str]


def _format_schema(profile: dict) -> List[Chunk]:
    chunks: List[Chunk] = []
    for table in profile.get("tables", []):
        ddl = table.get("ddl", "")
        desc_lines = [f"Columns: {', '.join(col['name'] for col in table.get('columns', []))}"]
        if table.get("foreign_keys"):
            edges = [f"{fk['from']} -> {fk['to']}" for fk in table["foreign_keys"]]
            desc_lines.append("FKs: " + "; ".join(edges))
        text = f"TABLE {table['name']}\n{ddl}\n" + "\n".join(desc_lines)
        chunks.append(Chunk(text=text, library="Structure", metadata={"table": table["name"], "db_id": profile["db_id"]}))
    return chunks


def _format_health(profile: dict) -> List[Chunk]:
    chunks: List[Chunk] = []
    for column in profile.get("health", []):
        metrics = column.get("metrics", {})
        snippets = column.get("cte_repairs", [])
        text = "\n".join([
            f"HEALTH {column['table']}.{column['column']}",
            f"rows={metrics.get('total_rows')} missing={metrics.get('missing_count')} ({metrics.get('null_pct')}%)",
            f"duplicates={metrics.get('duplicate_count')} ({metrics.get('dup_pct')}%) outliers={metrics.get('outlier_count')}",
            f"median={metrics.get('median')}",
            f"p95={metrics.get('p95')}",
            "Rules: " + "; ".join(profile.get("rulebook", [])),
            "Repairs:\n" + "\n".join(snippets),
        ])
        chunks.append(Chunk(text=text, library="HealthRules", metadata={"table": column["table"], "column": column["column"], "db_id": profile["db_id"]}))
    return chunks


def _format_values(profile: dict) -> List[Chunk]:
    chunks: List[Chunk] = []
    for col_dict in profile.get("dictionaries", []):
        value_list = col_dict.get("values", [])
        entries = ", ".join(value_list)
        units = col_dict.get("units", "")
        coverage = col_dict.get("coverage_pct")
        included = col_dict.get("included_count")
        distinct_total = col_dict.get("distinct_total")
        meta_line = f"coverage={coverage}% ({included}/{distinct_total} values)" if coverage is not None else ""
        text = "\n".join(
            filter(
                None,
                [
                    f"{col_dict['table']}.{col_dict['column']} values: {entries}",
                    meta_line,
                    f"Units:{units}" if units else "",
                ],
            )
        )
        chunks.append(Chunk(text=text, library="ValuesUnits", metadata={"table": col_dict["table"], "column": col_dict["column"], "db_id": profile["db_id"]}))
    return chunks


def _format_exemplars(profile: dict) -> List[Chunk]:
    exemplars = profile.get("exemplars", []) or profile.get("dual_shots", [])
    chunks: List[Chunk] = []
    for i, shot in enumerate(exemplars):
        text = "\n".join([
            "PLAN:\n" + "\n".join(shot.get("plan", [])),
            "BASIC_SQL:\n" + shot.get("basic_sql", ""),
            "ROBUST_SQL:\n" + shot.get("robust_sql", ""),
            "NOTES:\n" + "\n".join(shot.get("notes", [])),
        ])
        chunks.append(Chunk(text=text, library="Exemplars", metadata={"db_id": profile["db_id"], "shot_id": str(i)}))
    return chunks


def build_chunks(profile: dict) -> List[Chunk]:
    """Combine the four libraries into a single chunk list."""

    return _format_schema(profile) + _format_health(profile) + _format_values(profile) + _format_exemplars(profile)


def build_chunk_payload(profile: dict) -> List[dict]:
    payloads = []
    for chunk in build_chunks(profile):
        payload = {
            "text": chunk.text,
            "library": chunk.library,
            **chunk.metadata,
        }
        payloads.append(payload)
    return payloads
