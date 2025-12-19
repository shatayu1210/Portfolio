"""Simple utilities for timing blocks and functions."""
from __future__ import annotations

import contextlib
import time
from typing import Iterator


@contextlib.contextmanager
def timer(name: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        duration = time.perf_counter() - start
        print(f"[timer] {name}: {duration:.3f}s")


def timed_call(func, *args, **kwargs):
    with timer(func.__name__):
        return func(*args, **kwargs)
