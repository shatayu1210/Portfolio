"""Utility helpers for IO, logging, and reproducibility."""
from __future__ import annotations

import json
import logging
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List, Optional

import numpy as np

from cleansql.config import settings


def project_path(*parts: str | Path) -> Path:
    """Return an absolute path rooted at the CleanSQL project."""

    return settings.project_root.joinpath(*parts)


def ensure_dir(path: str | Path) -> Path:
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_jsonl(path: str | Path) -> List[dict]:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def write_jsonl(path: str | Path, rows: Iterable[dict]) -> None:
    path = Path(path)
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_json(path: str | Path, obj: dict) -> None:
    path = Path(path)
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


def read_json(path: str | Path) -> dict:
    with Path(path).open("r", encoding="utf-8") as f:
        return json.load(f)


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logging once."""

    if getattr(setup_logging, "_configured", False):
        return
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    setup_logging._configured = True  # type: ignore[attr-defined]


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)


@dataclass
class QuerySpec:
    db_id: str
    query: str
    question: str
    question_id: Optional[str] = None
    hardness: Optional[str] = None
    category: Optional[str] = None


def stream_jsonl(path: str | Path) -> Iterator[dict]:
    with Path(path).open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)
