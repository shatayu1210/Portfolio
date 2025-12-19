"""Profiling CSV/Excel files for RAG-based data quality awareness."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd


def _to_builtin(value):
    """Convert numpy types to Python builtins."""
    if isinstance(value, (np.generic,)):
        return value.item()
    return value


def _sanitize_for_json(obj):
    """Recursively sanitize object for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    if isinstance(obj, tuple):
        return [_sanitize_for_json(v) for v in obj]
    return _to_builtin(obj)


def infer_column_type(series: pd.Series) -> str:
    """Infer SQL-like type from pandas series."""
    dtype = series.dtype
    if pd.api.types.is_integer_dtype(dtype):
        return "INTEGER"
    if pd.api.types.is_float_dtype(dtype):
        return "REAL"
    if pd.api.types.is_bool_dtype(dtype):
        return "BOOLEAN"
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "DATETIME"
    return "TEXT"


def numeric_stats(series: pd.Series) -> Dict[str, float]:
    """Compute numeric statistics for a column."""
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


def column_health(df: pd.DataFrame, table_name: str, column: str) -> Dict:
    """Compute health metrics for a column."""
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
    median_constant = metrics.get("median") or 0
    
    cte_repairs = [
        f"WITH dedup AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY {column} ORDER BY rowid DESC) rn FROM {table_name}) SELECT * FROM dedup WHERE rn = 1",
        f"WITH capped AS (SELECT *, MIN({column}, {p95_constant}) AS {column}_capped FROM {table_name}) SELECT * FROM capped",
        f"WITH imputed AS (SELECT *, COALESCE({column}, {median_constant}) AS {column}_filled FROM {table_name}) SELECT * FROM imputed",
    ]
    
    return {
        "table": table_name,
        "column": column,
        "metrics": metrics,
        "cte_repairs": cte_repairs,
    }


def build_rulebook() -> List[str]:
    """Return standard data quality rules."""
    return [
        "Null% <= 5 -> fill using median constant",
        "Outliers > p95 -> cap to p95 constant using MIN() CTE",
        "Duplicate business keys -> keep latest by timestamp or surrogate id",
        "Categorical typos -> canonicalize using dictionary",
    ]


def column_dictionary(
    df: pd.DataFrame,
    table_name: str,
    column: str,
    sample_limit: int = 5000,
    coverage_target: float = 0.9,
    max_values: int = 80,
) -> Dict:
    """Build value dictionary for categorical columns."""
    sample_df = df[[column]].dropna().head(sample_limit)
    series = sample_df[column].astype(str).value_counts()
    
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
        "table": table_name,
        "column": column,
        "values": values,
        "units": units,
        "coverage_pct": coverage_pct,
        "distinct_total": int(series.shape[0]),
        "included_count": len(values),
        "sampled_rows": int(len(sample_df)),
    }


def exemplars() -> List[dict]:
    """Return example PLAN/SQL/NOTES patterns."""
    return [
        {
            "plan": [
                "Identify measure column and grouping key",
                "Check metric column health and apply rulebook repairs",
                "Deduplicate dimension on primary/business key",
                "Join dimension",
                "Aggregate"
            ],
            "basic_sql": "SELECT category, SUM(revenue) AS total_revenue FROM data GROUP BY category ORDER BY total_revenue DESC",
            "robust_sql": (
                "WITH capped AS ("
                " SELECT *, MIN(revenue, 120000.0) AS revenue_capped"
                " FROM data"
                ")"
                " SELECT category, SUM(revenue_capped) AS total_revenue"
                " FROM capped"
                " GROUP BY category"
                " ORDER BY total_revenue DESC"
            ),
            "notes": [
                "1. Capped 12 (0.6%) revenue outliers at p95=120000.0.",
                "2. Ensured categories follow provided dictionary values."
            ],
        },
        {
            "plan": [
                "Filter rows by date window",
                "Check status column health for missing/dup issues",
                "Deduplicate by business key keeping latest timestamp",
                "Handle nulls",
                "Count"
            ],
            "basic_sql": "SELECT COUNT(*) FROM data WHERE status='completed'",
            "robust_sql": (
                "WITH normalized AS ("
                " SELECT id, COALESCE(status, 'unknown') AS status, date, updated_at"
                " FROM data"
                "), keyed AS ("
                " SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn"
                " FROM normalized"
                ")"
                " SELECT COUNT(*) FROM keyed WHERE rn = 1 AND status = 'completed'"
            ),
            "notes": [
                "1. Imputed 41 (2.8%) missing status values with dictionary standard labels.",
                "2. Deduplicated 6 (0.3%) orders keeping latest updated_at."
            ],
        },
    ]


def is_categorical_column(df: pd.DataFrame, column: str, column_type: str) -> bool:
    """Heuristic to detect categorical columns suitable for dictionary."""
    if column_type not in {"TEXT"}:
        return False
    
    lowered = column.lower()
    exclusion_tokens = ["id", "name", "email", "code", "desc", "description", "address", "url", "path", "uuid", "date", "time"]
    if any(token in lowered for token in exclusion_tokens):
        return False
    
    total_rows = df[column].notna().sum()
    if not total_rows or total_rows < 15:
        return False
    
    distinct_count = df[column].nunique(dropna=True)
    if distinct_count < 2:
        return False
    
    uniqueness_ratio = distinct_count / total_rows
    
    # Low cardinality: <= 50 distinct values
    is_low_card = distinct_count <= min(50, max(2, int(0.05 * total_rows)))
    
    # Medium cardinality: 50-300 distinct, uniqueness <= 20%
    is_high_card = 50 < distinct_count <= 300 and uniqueness_ratio <= 0.2
    
    if uniqueness_ratio >= 0.8:
        return False
    
    return is_low_card or is_high_card


def profile_csv(
    file_path: Path,
    table_name: str = "data",
    db_id: str = "user_upload",
) -> dict:
    """Profile a CSV/Excel file for RAG ingestion.
    
    Returns profile dict with:
    - db_id: identifier
    - tables: schema info
    - health: column health metrics
    - rulebook: data quality rules
    - dictionaries: categorical value dictionaries
    - exemplars: example SQL patterns
    """
    # Load data
    if str(file_path).endswith(('.xlsx', '.xls')):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)
    
    # Build schema
    columns = []
    for col in df.columns:
        col_type = infer_column_type(df[col])
        columns.append({
            "name": col,
            "type": col_type,
            "notnull": False,
            "default": None,
            "pk": False,
        })
    
    # Build DDL
    col_defs = ', '.join(f"{c['name']} {c['type']}" for c in columns)
    ddl = f"CREATE TABLE {table_name} ({col_defs})"
    
    tables = [{
        "name": table_name,
        "ddl": ddl,
        "columns": columns,
        "foreign_keys": [],
    }]
    
    # Compute health metrics
    health = []
    for col in df.columns:
        health.append(column_health(df, table_name, col))
    
    # Build dictionaries for categorical columns
    dictionaries = []
    for col in df.columns:
        col_type = infer_column_type(df[col])
        if is_categorical_column(df, col, col_type):
            dictionaries.append(column_dictionary(df, table_name, col))
    
    profile = {
        "db_id": db_id,
        "tables": tables,
        "health": health,
        "rulebook": build_rulebook(),
        "dictionaries": dictionaries,
        "exemplars": exemplars(),
    }
    
    return _sanitize_for_json(profile)


def save_profile(profile: dict, output_path: Path) -> None:
    """Save profile to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2)
