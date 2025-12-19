"""Read-only SQLite execution helpers."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable, List, Sequence

from cleansql.utils import sqlguard


class SQLiteExecutor:
    def __init__(self, db_path: Path) -> None:
        uri = f"file:{db_path}?mode=ro&immutable=1"
        self.conn = sqlite3.connect(uri, uri=True)
        self.conn.row_factory = sqlite3.Row

    def close(self) -> None:
        self.conn.close()

    def run(self, sql: str, params: Sequence | None = None) -> List[dict]:
        sqlguard.ensure_read_only(sql)
        cur = self.conn.execute(sql, params or [])
        rows = [dict(row) for row in cur.fetchall()]
        cur.close()
        return rows


def execute_sql(db_path: Path | str, sql: str) -> List[dict]:
    executor = SQLiteExecutor(Path(db_path))
    try:
        try:
            return executor.run(sql)
        except (sqlite3.Error, sqlguard.ReadOnlyViolation):
            # On any SQLite or read-only guard error (e.g., ambiguous column,
            # type mismatch, or forbidden write), treat as empty result so
            # evaluation can continue while penalizing the query in metrics.
            return []
    finally:
        executor.close()
