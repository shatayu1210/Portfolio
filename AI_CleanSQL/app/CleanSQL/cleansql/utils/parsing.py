"""Robust parsing helpers for dual-output prompts."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import List

import sqlglot


SECTION_PATTERN = re.compile(
    r"^[#\s]*?(?P<header>[A-Z_]+)\s*:?(?P<body>.*?)(?=\n[#\s]*[A-Z_]+\s*:|\Z)",
    re.DOTALL | re.MULTILINE,
)
FENCE_PATTERN = re.compile(r"```\s*sql\s*(?P<code>.*?)```", re.DOTALL | re.IGNORECASE)
BULLET_PATTERN = re.compile(r"^[\-*+]\s*(.+)$", re.MULTILINE)

HEADER_NAMES = ["PLAN", "BASIC_SQL", "ROBUST_SQL", "NOTES"]


@dataclass
class DualOutput:
    plan: List[str]
    basic_sql: str
    robust_sql: str
    notes: List[str] = field(default_factory=list)


class DualOutputParseError(ValueError):
    pass


def _stringify(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts = [_stringify(item).strip() for item in value]
        return "\n".join(part for part in parts if part)
    if isinstance(value, dict):
        if "text" in value:
            return _stringify(value["text"])
        joined = "\n".join(
            f"{key}: {_stringify(val)}" for key, val in value.items() if _stringify(val)
        )
        return joined or json.dumps(value)
    return str(value)


def _section_map(text: str) -> dict:
    """Map raw model text to section bodies keyed by PLAN/BASIC_SQL/ROBUST_SQL/NOTES.

    Handles:
    - JSON dicts like {"plan": [...], "basic_sql": "...", ...}
    - Markdown headings like '### PLAN', '### BASIC_SQL', etc.
    """
    stripped = text.strip()

    # 1) JSON-style output
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        data = None

    if isinstance(data, dict):
        sections = {key.upper(): _stringify(val).strip() for key, val in data.items()}
        sections = {k: v for k, v in sections.items() if v}
        if sections:
            return sections

    # 2) Heading-based output (markdown or plain)
    # Normalize common markdown variants like '**PLAN**' to plain 'PLAN'
    for name in HEADER_NAMES:
        stripped = re.sub(
            rf"(?im)^\s*\*+\s*{name}\s*\*+\s*$",
            name,
            stripped,
        )
    stripped = re.sub(r"(?im)^\s*\*\*\s*$", "", stripped)
    header_matches: list[tuple[int, str]] = []
    for name in HEADER_NAMES:
        # Match lines like 'PLAN', 'PLAN:', '### PLAN', '## BASIC_SQL  ' etc.
        m = re.search(rf"(?im)^[#\s]*{name}\s*:?\s*$", stripped)
        if m:
            header_matches.append((m.start(), name))

    if not header_matches:
        raise DualOutputParseError("No sections detected in model response")

    header_matches.sort(key=lambda x: x[0])
    sections: dict[str, str] = {}
    for idx, (start, name) in enumerate(header_matches):
        # Body starts after the header line's newline
        nl_pos = stripped.find("\n", start)
        body_start = nl_pos + 1 if nl_pos != -1 else len(stripped)
        body_end = header_matches[idx + 1][0] if idx + 1 < len(header_matches) else len(stripped)
        sections[name] = stripped[body_start:body_end].strip()
    return sections


def _extract_sql(block: str) -> str:
    fence = FENCE_PATTERN.search(block)
    if not fence:
        raise DualOutputParseError("SQL section missing fenced code block")
    sql_text = fence.group("code").strip()
    try:
        return sqlglot.transpile(sql_text, read="sqlite", write="sqlite")[0]
    except Exception as exc:
        # Treat unparsable SQL as a parse error so caller can resample
        raise DualOutputParseError(f"SQL parse failed: {exc}") from exc


def _extract_plan(block: str) -> List[str]:
    bullets = BULLET_PATTERN.findall(block)
    if bullets:
        return [b.strip() for b in bullets if b.strip()]
    # fallback: split sentences
    lines = [line.strip("- *") for line in block.splitlines() if line.strip()]
    return lines or [block.strip()]


def _extract_notes(block: str) -> List[str]:
    return [note.strip() for note in BULLET_PATTERN.findall(block)] or [line.strip() for line in block.splitlines() if line.strip()]


def parse_dual_output(text: str) -> DualOutput:
    """Parse PLAN/BASIC/ROBUST/NOTES sections from model text."""

    sections = _section_map(text)
    missing = {key for key in ("PLAN", "BASIC_SQL", "ROBUST_SQL", "NOTES") if key not in sections}
    if missing:
        raise DualOutputParseError(f"Missing sections: {', '.join(sorted(missing))}")

    return DualOutput(
        plan=_extract_plan(sections["PLAN"]),
        basic_sql=_extract_sql(sections["BASIC_SQL"]),
        robust_sql=_extract_sql(sections["ROBUST_SQL"]),
        notes=_extract_notes(sections["NOTES"]),
    )


def canonicalize_sql(sql: str) -> str:
    """Normalize SQL formatting."""
    return sqlglot.transpile(sql, read="sqlite", write="sqlite")[0]


def referenced_tables(sql: str) -> List[str]:
    """Extract table names from SQL."""
    parsed = sqlglot.parse_one(sql, read="sqlite")
    return sorted({table.alias_or_name for table in parsed.find_all(sqlglot.exp.Table)})


def referenced_columns(sql: str) -> List[str]:
    """Extract column references from SQL."""
    parsed = sqlglot.parse_one(sql, read="sqlite")
    cols = []
    for col in parsed.find_all(sqlglot.exp.Column):
        cols.append(".".join(part for part in (col.table, col.name) if part))
    return sorted(set(cols))
