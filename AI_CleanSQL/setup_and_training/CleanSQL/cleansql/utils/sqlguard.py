"""Guard rails preventing non read-only SQL from being executed."""
from __future__ import annotations

import re
from typing import Iterable

FORBIDDEN = (
    "INSERT",
    "UPDATE",
    "DELETE",
    "CREATE",
    "DROP",
    "ALTER",
    "ATTACH",
    "DETACH",
    "REPLACE",
    "TRUNCATE",
    "PRAGMA",
)

FORBIDDEN_PATTERN = re.compile(r"\b(" + "|".join(FORBIDDEN) + r")\b", re.IGNORECASE)


class ReadOnlyViolation(RuntimeError):
    """Raised when non read-only SQL is detected."""


def ensure_read_only(sql: str) -> None:
    cleaned = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    cleaned = re.sub(r"--.*?$", "", cleaned, flags=re.MULTILINE)
    if FORBIDDEN_PATTERN.search(cleaned):
        raise ReadOnlyViolation("SQL contains forbidden write operation")


def ensure_all_read_only(sql_statements: Iterable[str]) -> None:
    for stmt in sql_statements:
        ensure_read_only(stmt)
