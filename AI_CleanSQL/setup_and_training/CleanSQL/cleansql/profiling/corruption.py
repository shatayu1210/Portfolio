"""Reproducible corruption utilities for Stage-2."""
from __future__ import annotations

import argparse
import json
import random
import shutil
import sqlite3
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Tuple


@dataclass
class CorruptionPlan:
    db_id: str
    missingness: List[Tuple[str, str]]
    outliers: List[Tuple[str, str]]
    duplicates: Tuple[str, str]
    categorical_typos: List[Tuple[str, str]]
    seed: int = 7

    def to_json(self) -> dict:
        return asdict(self)


def copy_db(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def _add_missingness(conn: sqlite3.Connection, table: str, column: str, pct: float, rng: random.Random) -> None:
    """
    Randomly set a percentage of rows in `table.column` to NULL.

    To avoid integrity errors (e.g., NOT NULL / FK constraints), we first
    check the table schema and skip columns that are declared NOT NULL.
    """
    # Check if column is nullable; skip NOT NULL columns to avoid constraint failures
    info_rows = conn.execute(f"PRAGMA table_info('{table}')").fetchall()
    col_info = next((r for r in info_rows if r[1] == column), None)
    if col_info is not None:
        # PRAGMA table_info: (cid, name, type, notnull, dflt_value, pk)
        notnull_flag = col_info[3]
        if notnull_flag:  # 1 means NOT NULL
            # Simply skip introducing missingness on NOT NULL columns
            return

    row_ids = [row[0] for row in conn.execute(f"SELECT rowid FROM \"{table}\" WHERE \"{column}\" IS NOT NULL")]
    if not row_ids:
        return
    k = max(1, int(len(row_ids) * pct / 100))
    chosen = rng.sample(row_ids, min(len(row_ids), k))

    # Use a savepoint so that if this column violates constraints (e.g. CHECKs),
    # we can roll back just this column's updates and still keep other corruptions.
    conn.execute("SAVEPOINT add_missingness")
    try:
        conn.executemany(
            f"UPDATE \"{table}\" SET \"{column}\" = NULL WHERE rowid = ?",
            ((rid,) for rid in chosen),
        )
        conn.execute("RELEASE add_missingness")
    except sqlite3.IntegrityError:
        # Roll back this column's updates only and skip it
        conn.execute("ROLLBACK TO add_missingness")
        conn.execute("RELEASE add_missingness")
        return


def _inject_outliers(conn: sqlite3.Connection, table: str, column: str, pct: float, rng: random.Random) -> None:
    """
    Multiply a small percentage of numeric values in `table.column` by a large factor.

    To avoid integrity/type errors, we:
    - Only operate on columns whose declared type looks numeric.
    - Wrap the UPDATEs in a savepoint and roll back on IntegrityError.
    """
    # Check declared column type; skip obviously non-numeric columns
    info_rows = conn.execute(f"PRAGMA table_info('{table}')").fetchall()
    col_info = next((r for r in info_rows if r[1] == column), None)
    if col_info is not None:
        col_type = (col_info[2] or "").lower()
        numeric_markers = ("int", "real", "num", "double", "float", "dec")
        if not any(m in col_type for m in numeric_markers):
            return

    row_ids = [row[0] for row in conn.execute(f"SELECT rowid FROM \"{table}\" WHERE \"{column}\" IS NOT NULL")]
    if not row_ids:
        return
    k = max(1, int(len(row_ids) * pct / 100))
    chosen = rng.sample(row_ids, min(len(row_ids), k))
    # Make outliers much more extreme so that capped/imputed ROBUST_SQL differs
    # meaningfully from naive BASIC_SQL aggregates.
    factor = rng.uniform(20, 50)

    conn.execute("SAVEPOINT inject_outliers")
    try:
        conn.executemany(
            f"UPDATE \"{table}\" SET \"{column}\" = \"{column}\" * ? WHERE rowid = ?",
            ((factor, rid) for rid in chosen),
        )
        conn.execute("RELEASE inject_outliers")
    except sqlite3.IntegrityError:
        conn.execute("ROLLBACK TO inject_outliers")
        conn.execute("RELEASE inject_outliers")
        return


def _duplicate_rows(conn: sqlite3.Connection, table: str, key_col: str, pct: float, rng: random.Random) -> None:
    """
    Duplicate a small percentage of rows in `table`.

    To avoid UNIQUE/PRIMARY KEY violations (e.g., on address_id), we:
    - Identify primary-key columns via PRAGMA table_info.
    - Insert duplicates only for **non-PK columns**, letting SQLite
      auto-generate new PK values where applicable.
    """
    # Identify non-PK columns to duplicate
    info_rows = conn.execute(f"PRAGMA table_info('{table}')").fetchall()
    non_pk_cols = [r[1] for r in info_rows if not r[5]]  # r[5] is pk flag
    if not non_pk_cols:
        return

    rows = conn.execute(
        f"SELECT {', '.join(f'\"{c}\"' for c in non_pk_cols)} FROM \"{table}\""
    ).fetchall()
    total = len(rows)
    if total == 0:
        return

    k = max(1, int(total * pct / 100))
    chosen_rows = rng.sample(rows, min(total, k))

    placeholders = ",".join(["?"] * len(non_pk_cols))
    column_clause = ",".join([f"\"{col}\"" for col in non_pk_cols])
    insert_sql = f"INSERT INTO \"{table}\" ({column_clause}) VALUES ({placeholders})"

    conn.execute("SAVEPOINT duplicate_rows")
    try:
        conn.executemany(insert_sql, ([row[col] for col in non_pk_cols] for row in chosen_rows))
        conn.execute("RELEASE duplicate_rows")
    except sqlite3.IntegrityError:
        conn.execute("ROLLBACK TO duplicate_rows")
        conn.execute("RELEASE duplicate_rows")
        return

# Injecting a few common typos in categorical columns
def _categorical_typos(conn: sqlite3.Connection, table: str, column: str, rng: random.Random) -> None:
    replacements = {
        "female": "f",
        "woman": "f",
        "women": "f",
        "male": "m",
        "man": "m",
        "ny": "new york",
    }
    for target, typo in replacements.items():
        conn.execute(
            f"UPDATE \"{table}\" SET \"{column}\" = ? WHERE lower(\"{column}\") = ?",
            (typo, target),
        )

# Synthetically randomly adding 2-8% missingness, 1% outliers, 2.5% duplicates, and 
def apply_corruption(plan: CorruptionPlan, src_db: Path, dst_db: Path) -> None:
    rng = random.Random(plan.seed)
    copy_db(src_db, dst_db)
    conn = sqlite3.connect(dst_db)
    conn.row_factory = sqlite3.Row
    try:
        for table, column in plan.missingness:
            _add_missingness(conn, table, column, pct=rng.uniform(2, 8), rng=rng)
        for table, column in plan.outliers:
            # Corrupt a larger fraction of rows (5–10%) to make outliers impactful
            _inject_outliers(conn, table, column, pct=rng.uniform(5, 10), rng=rng)
        table, key_col = plan.duplicates
        _duplicate_rows(conn, table, key_col, pct=2.5, rng=rng)
        for table, column in plan.categorical_typos:
            _categorical_typos(conn, table, column, rng)
        conn.commit()
    finally:
        conn.close()


def main() -> None:  # pragma: no cover
    parser = argparse.ArgumentParser(description="Apply corruption plan")
    parser.add_argument("--plan", required=True)
    parser.add_argument("--src", required=True)
    parser.add_argument("--dst", required=True)
    args = parser.parse_args()
    plan = CorruptionPlan(**json.loads(Path(args.plan).read_text()))
    apply_corruption(plan, Path(args.src), Path(args.dst))


if __name__ == "__main__":
    main()
