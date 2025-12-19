"""Profiling Spider SQLite databases to drive RAG content."""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

from cleansql.utils.io import ensure_dir, write_json

def _to_builtin(value):
    if isinstance(value, (np.generic,)):
        return value.item()
    return value

def _sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    if isinstance(obj, tuple):
        return [_sanitize_for_json(v) for v in obj]
    return _to_builtin(obj)


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_tables(conn: sqlite3.Connection) -> List[dict]:
    cursor = conn.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = []
    for row in cursor:
        table_name = row["name"]
        columns = []
        for col in conn.execute(f"PRAGMA table_info('{table_name}')"):
            columns.append({
                "name": col[1],
                "type": col[2],
                "notnull": bool(col[3]),
                "default": col[4],
                "pk": bool(col[5]),
            })
        fk_rows = conn.execute(f"PRAGMA foreign_key_list('{table_name}')").fetchall()
        foreign_keys = [
            {"from": f"{table_name}.{fk['from']}", "to": f"{fk['table']}.{fk['to']}"}
            for fk in fk_rows
        ]
        tables.append({
            "name": table_name,
            "ddl": row["sql"],
            "columns": columns,
            "foreign_keys": foreign_keys,
        })
    return tables


def numeric_stats(series: pd.Series) -> Dict[str, float]:
    values = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    if values.empty:
        return {"min": None, "max": None, "median": None, "p95": None, "mean": None}
    return {
        "min": float(values.min()),
        "max": float(values.max()),
        "median": float(values.median()),
        "p95": float(values.quantile(0.95, interpolation="nearest")),
        "mean": float(values.mean()),
    }


def column_health(conn: sqlite3.Connection, table: str, column: str) -> Dict:
    df = pd.read_sql_query(f"SELECT \"{column}\" FROM \"{table}\"", conn)
    total = len(df)
    non_null = df[column].notna().sum()
    metrics = {
        "null_pct": 0.0 if total == 0 else round((total - non_null) / total * 100, 3),
        "dup_pct": 0.0,
        "total_rows": total,
        "missing_count": total - non_null,
    }
    metrics.update(numeric_stats(df[column]))
    if non_null:
        dup_pct = 1 - df[column].nunique(dropna=True) / non_null
        metrics["dup_pct"] = round(max(0.0, dup_pct * 100), 3)
        metrics["duplicate_count"] = max(non_null - df[column].nunique(dropna=True), 0)
    else:
        metrics["duplicate_count"] = 0
    if metrics.get("p95") is not None:
        try:
            numeric_values = pd.to_numeric(df[column], errors="coerce")
            outlier_count = int((numeric_values > metrics["p95"]).sum())
            metrics["outlier_count"] = outlier_count
        except Exception:
            metrics["outlier_count"] = 0
    else:
        metrics["outlier_count"] = 0
    p95_constant = metrics.get("p95") or 0
    cte_repairs = [
        f"WITH base AS (SELECT * FROM {table}), dedup AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY {column} ORDER BY rowid DESC) rn FROM base) SELECT * FROM dedup WHERE rn = 1",
        f"WITH capped AS (SELECT *, MIN({column}, {p95_constant}) AS {column}_capped FROM {table}) SELECT * FROM capped",
    ]
    return {
        "table": table,
        "column": column,
        "metrics": metrics,
        "cte_repairs": cte_repairs,
    }


def build_rulebook() -> List[str]:
    return [
        "Null% <= 5 -> fill using median constant",
        "Outliers > p95 -> cap to p95 constant using SAFE_VALUE CTE",
        "Duplicate business keys -> keep latest by timestamp or surrogate id",
    ]


def column_dictionary(
    conn: sqlite3.Connection,
    table: str,
    column: str,
    sample_limit: int = 5000,
    coverage_target: float = 0.9,
    max_values: int = 80,
) -> Dict:
    df = pd.read_sql_query(
        f"SELECT \"{column}\" FROM \"{table}\" WHERE \"{column}\" IS NOT NULL LIMIT {sample_limit}",
        conn,
    )
    series = (
        df[column]
        .dropna()
        .astype(str)
        .value_counts()
    )
    total = int(series.sum())
    values: List[str] = []
    running = 0
    for value, count in series.items():
        values.append(value)
        running += int(count)
        if (total and running / total >= coverage_target) or len(values) >= max_values:
            break
    coverage_pct = round((running / total) * 100, 2) if total else 0.0
    units = "score 0..100" if "score" in column.lower() else ""
    return {
        "table": table,
        "column": column,
        "values": values,
        "units": units,
        "coverage_pct": coverage_pct,
        "distinct_total": int(series.shape[0]),
        "included_count": len(values),
        "sampled_rows": int(len(df)),
    }


def exemplars() -> List[dict]:
    return [
        {
            "plan": [
                "Scan fact table",
                "Check metric column health and apply rulebook repairs",
                "Deduplicate dimension on primary/business key",
                "Join dimension",
                "Aggregate"
            ],
            "basic_sql": "SELECT d.name, SUM(f.metric) FROM fact f JOIN dim d ON f.dim_id=d.id GROUP BY d.name",
            "robust_sql": (
                "WITH dim_dedup AS ("
                " SELECT * FROM ("
                "   SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn"
                "   FROM dim"
                " ) WHERE rn = 1"
                "), capped AS ("
                " SELECT *, MIN(metric, :metric_p95) AS metric_capped"
                " FROM fact"
                ")"
                " SELECT d.name, SUM(metric_capped)"
                " FROM capped JOIN dim_dedup d ON capped.dim_id = d.id"
                " GROUP BY d.name"
            ),
            "notes": [
                "1. Capped 12 (0.6%) metric outliers at p95=120000.0.",
                "2. Deduplicated 18 (0.9%) dimension rows on business key before join."
            ],
        },
        {
            "plan": [
                "Filter dates",
                "Check status column health for missing/dup issues",
                "Deduplicate orders on primary/business key",
                "Handle nulls",
                "Order"
            ],
            "basic_sql": "SELECT COUNT(*) FROM orders WHERE status='completed'",
            "robust_sql": (
                "WITH normalized AS ("
                " SELECT order_id, COALESCE(status, 'unknown') AS status, order_date, updated_at"
                " FROM orders"
                "), keyed AS ("
                " SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn"
                " FROM normalized"
                " WHERE order_date BETWEEN '2021-01-01' AND '2021-12-31'"
                ")"
                " SELECT COUNT(*) FROM keyed WHERE rn = 1 AND status = 'completed'"
            ),
            "notes": [
                "1. Imputed 41 (2.8%) missing status values with dictionary standard labels.",
                "2. Deduplicated 6 (0.3%) orders keeping latest updated_at."
            ],
        },
    ]


def is_categorical_column(conn: sqlite3.Connection, table: str, column: str, column_type: str) -> bool:
    text_types = {"TEXT", "CHAR", "VARCHAR"}
    col_type = (column_type or "").upper()
    if col_type not in text_types:
        return False

    lowered = column.lower()
    exclusion_tokens = ["id", "name", "email", "code", "desc", "description", "address", "url", "path", "uuid", "date", "time"]
    if any(token in lowered for token in exclusion_tokens):
        return False

    total_rows = conn.execute(
        f"SELECT COUNT(*) FROM \"{table}\" WHERE \"{column}\" IS NOT NULL"
    ).fetchone()[0]
    if not total_rows or total_rows < 15:
        return False

    distinct_count = conn.execute(
        f"SELECT COUNT(DISTINCT \"{column}\") FROM \"{table}\" WHERE \"{column}\" IS NOT NULL"
    ).fetchone()[0]
    if distinct_count < 2:
        return False

    mode_count = conn.execute(
        f"SELECT MAX(cnt) FROM (SELECT COUNT(*) AS cnt FROM \"{table}\" WHERE \"{column}\" IS NOT NULL GROUP BY \"{column}\")"
    ).fetchone()[0] or 0

    singleton_count = conn.execute(
        f"SELECT COUNT(*) FROM (SELECT COUNT(*) AS cnt FROM \"{table}\" WHERE \"{column}\" IS NOT NULL GROUP BY \"{column}\" HAVING cnt = 1)"
    ).fetchone()[0] or 0

    uniqueness_ratio = distinct_count / total_rows
    mode_ratio = mode_count / total_rows if total_rows else 0.0
    singleton_ratio = singleton_count / total_rows if total_rows else 0.0

    max_small_card = min(50, max(2, int(0.05 * total_rows)))
    is_low_card = (
        distinct_count <= max_small_card
        and mode_ratio >= 0.02
    )

    is_high_card = (
        50 < distinct_count <= 300
        and uniqueness_ratio <= 0.2
    )

    if uniqueness_ratio >= 0.8 or singleton_ratio >= 0.5:
        return False

    return is_low_card or is_high_card


def profile_db(db_id: str, db_path: Path, out_dir: Path) -> None:
    conn = connect(db_path)
    tables = fetch_tables(conn)
    health = []
    dictionaries = []
    for table in tables:
        for column in table["columns"]:
            col_name = column["name"]
            col_type = column["type"] or ""
            health.append(column_health(conn, table["name"], col_name))
            if is_categorical_column(conn, table["name"], col_name, col_type):
                dictionaries.append(column_dictionary(conn, table["name"], col_name))
    profile = {
        "db_id": db_id,
        "tables": tables,
        "health": health,
        "rulebook": build_rulebook(),
        "dictionaries": dictionaries,
        "exemplars": exemplars(),
    }
    ensure_dir(out_dir)
    write_json(out_dir / f"{db_id}.json", _sanitize_for_json(profile))
    conn.close()


def main(args: argparse.Namespace) -> None:
    db_ids = Path(args.db_list).read_text().splitlines()
    for db_id in db_ids:
        db_id = db_id.strip()
        if not db_id:
            continue
        db_path = Path(args.spider_root) / db_id / f"{db_id}.sqlite"
        if not db_path.exists():
            raise FileNotFoundError(db_path)
        profile_db(db_id, db_path, Path(args.out_dir))
        print(f"Profiled {db_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Profile Spider DBs")
    parser.add_argument("--db-list", required=True)
    parser.add_argument("--spider-root", required=True)
    parser.add_argument("--out-dir", required=True)
    main(parser.parse_args())
