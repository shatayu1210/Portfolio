"""Spider-style evaluation metrics."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import sqlglot

from cleansql.exec.sqlite_runner import execute_sql
from cleansql.utils import sqlguard
from cleansql.utils.sqlguard import ReadOnlyViolation


@dataclass
class MetricResult:
    exact_match: bool
    exec_match: bool
    components: Dict[str, float]


def canonicalize(sql: str) -> str:
    return sqlglot.transpile(sql, read="sqlite", write="sqlite")[0]


def _component_sets(expr: sqlglot.Expression) -> Dict[str, set]:
    comps = {
        "select": set(),
        "where": set(),
        "group": set(),
        "order": set(),
        "having": set(),
    }
    for projection in expr.expressions:
        comps["select"].add(projection.sql())
    if expr.args.get("where"):
        comps["where"].add(expr.args["where"].sql())
    if expr.args.get("group"):
        for grp in expr.args["group"].expressions:
            comps["group"].add(grp.sql())
    if expr.args.get("order"):
        for order in expr.args["order"].expressions:
            comps["order"].add(order.sql())
    if expr.args.get("having"):
        comps["having"].add(expr.args["having"].sql())
    return comps


def component_metrics(pred_sql: str, gold_sql: str) -> Dict[str, float]:
    pred_expr = sqlglot.parse_one(pred_sql, read="sqlite")
    gold_expr = sqlglot.parse_one(gold_sql, read="sqlite")
    pred = _component_sets(pred_expr)
    gold = _component_sets(gold_expr)
    scores = {}
    for key in pred:
        tp = len(pred[key] & gold[key])
        fp = len(pred[key] - gold[key])
        fn = len(gold[key] - pred[key])
        prec = tp / (tp + fp) if tp + fp else 1.0
        rec = tp / (tp + fn) if tp + fn else 1.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 1.0
        scores[f"{key}_precision"] = prec
        scores[f"{key}_recall"] = rec
        scores[f"{key}_f1"] = f1
    return scores


def execution_accuracy(pred_sql: str, gold_sql: str, db_path: Path) -> bool:
    try:
        sqlguard.ensure_read_only(pred_sql)
        sqlguard.ensure_read_only(gold_sql)
    except ReadOnlyViolation:
        # Treat any write attempt as execution mismatch, but don't crash eval.
        return False
    try:
        pred_rows = execute_sql(db_path, pred_sql)
        gold_rows = execute_sql(db_path, gold_sql)
    except Exception:
        return False
    return pred_rows == gold_rows


def evaluate_query(pred_sql: str, gold_sql: str, db_path: Path) -> MetricResult:
    try:
        canon_pred = canonicalize(pred_sql)
        canon_gold = canonicalize(gold_sql)
    except Exception:
        canon_pred, canon_gold = pred_sql, gold_sql
    exact = canon_pred.strip().lower() == canon_gold.strip().lower()
    try:
        comps = component_metrics(canon_pred, canon_gold)
    except Exception:
        comps = {f"{name}_{metric}": 0.0 for name in ("select","where","group","order","having") for metric in ("precision","recall","f1")}
    exec_match = execution_accuracy(canon_pred, canon_gold, db_path)
    return MetricResult(exact_match=exact, exec_match=exec_match, components=comps)
