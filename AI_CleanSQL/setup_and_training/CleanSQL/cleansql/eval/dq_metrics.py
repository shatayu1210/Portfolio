"""Metrics focused on answer quality under corruption."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

import numpy as np


@dataclass
class DQRecord:
    clean: float
    prediction: float
    literals_matched: int
    literals_total: int
    notes: List[str]


def rel_error(pred: float, ref: float) -> float:
    denom = max(1.0, abs(ref))
    return abs(pred - ref) / denom


def dq_robust(records: Iterable[DQRecord], epsilon: float) -> float:
    flags = [rel_error(r.prediction, r.clean) <= epsilon for r in records]
    return float(np.mean(flags)) if flags else 0.0


def mape(records: Iterable[DQRecord]) -> float:
    errors = [rel_error(r.prediction, r.clean) for r in records]
    return float(np.mean(errors)) if errors else 0.0


def mae(records: Iterable[DQRecord]) -> float:
    errors = [abs(r.prediction - r.clean) for r in records]
    return float(np.mean(errors)) if errors else 0.0


def bias(records: Iterable[DQRecord]) -> float:
    diffs = [r.prediction - r.clean for r in records]
    return float(np.mean(diffs)) if diffs else 0.0


def literal_accuracy(records: Iterable[DQRecord]) -> float:
    ratios = []
    for rec in records:
        if rec.literals_total == 0:
            ratios.append(1.0)
        else:
            ratios.append(rec.literals_matched / rec.literals_total)
    return float(np.mean(ratios)) if ratios else 0.0


def dq_note_coverage(records: Iterable[DQRecord]) -> float:
    hits = [1.0 if rec.notes else 0.0 for rec in records]
    return float(np.mean(hits)) if hits else 0.0


def summarize(records: List[DQRecord]) -> dict:
    return {
        "dq_robust_1pct": dq_robust(records, 0.01),
        "dq_robust_2pct": dq_robust(records, 0.02),
        "dq_robust_5pct": dq_robust(records, 0.05),
        "mape": mape(records),
        "mae": mae(records),
        "bias": bias(records),
        "literal_acc": literal_accuracy(records),
        "dq_note_coverage": dq_note_coverage(records),
    }
