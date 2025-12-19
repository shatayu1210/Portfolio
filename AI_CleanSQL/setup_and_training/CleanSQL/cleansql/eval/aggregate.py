"""Aggregate Stage-1 and Stage-2 CSV outputs into concise summary tables.

For Stage-1 (prompting techniques):
- Input: per-query CSVs from run_stage1.py (one file per technique).
- Output:
  - stage1_exact.csv : rows = techniques, cols = precision/recall/f1/accuracy
    using exact_match as accuracy.
  - stage1_exec.csv  : same, but using exec_match as accuracy.

For Stage-2 (RAG contexts on corrupted data):
- Input: per-query CSVs from run_stage2.py (one file per context).
- Output:
  - stage2_exact.csv : rows = contexts (schema_only, rag_topk3, ...),
    cols = precision/recall/f1/accuracy using dq_robust_1pct.
  - stage2_exec.csv  : same, but using dq_robust_5pct.
"""
from __future__ import annotations

import argparse
import glob
from pathlib import Path

import pandas as pd


STAGE1_COMPONENT_PREFIXES = ["select", "where", "group", "order", "having"]


def load_glob(pattern: str) -> pd.DataFrame:
    if not pattern:
        return pd.DataFrame()
    frames = []
    for path in glob.glob(pattern):
        frames.append(pd.read_csv(path))
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def _stage1_summary_tables(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build Stage-1 exact/exec summary tables.

    We intentionally ignore clause-level metrics (select/where/group/order/having)
    and summarize each technique ONLY by:
    - exact_match (for the 'exact' table)
    - exec_match (for the 'exec' table)

    The precision/recall/f1/accuracy columns are all set to the corresponding
    accuracy value to keep the table shape consistent without adding extra
    clause-level context.
    """
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()

    rows_exact = []
    rows_exec = []
    for tech, g in df.groupby("technique"):
        acc_exact = float(g["exact_match"].mean()) if "exact_match" in g.columns else 0.0
        acc_exec = float(g["exec_match"].mean()) if "exec_match" in g.columns else 0.0

        rows_exact.append(
            {
                "technique": tech,
                "precision": round(acc_exact, 3),
                "recall": round(acc_exact, 3),
                "f1": round(acc_exact, 3),
                "accuracy": round(acc_exact, 3),
            }
        )
        rows_exec.append(
            {
                "technique": tech,
                "precision": round(acc_exec, 3),
                "recall": round(acc_exec, 3),
                "f1": round(acc_exec, 3),
                "accuracy": round(acc_exec, 3),
            }
        )

    return pd.DataFrame(rows_exact), pd.DataFrame(rows_exec)


def _stage2_summary_tables(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build Stage-2 exact/exec-like tables from dq metrics.

    We interpret:
    - "exact" => dq_robust_1pct
    - "exec"  => dq_robust_5pct
    and expose them in a precision/recall/f1/accuracy table (all equal to the
    underlying robustness metric for simplicity).
    """
    if df.empty:
        return pd.DataFrame(), pd.DataFrame()

    rows_exact = []
    rows_exec = []
    for ctx, g in df.groupby("context"):
        exact = float(g["dq_robust_1pct"].mean()) if "dq_robust_1pct" in g.columns else 0.0
        exec_ = float(g["dq_robust_5pct"].mean()) if "dq_robust_5pct" in g.columns else 0.0

        rows_exact.append(
            {
                "context": ctx,
                "precision": round(exact, 3),
                "recall": round(exact, 3),
                "f1": round(exact, 3),
                "accuracy": round(exact, 3),
            }
        )
        rows_exec.append(
            {
                "context": ctx,
                "precision": round(exec_, 3),
                "recall": round(exec_, 3),
                "f1": round(exec_, 3),
                "accuracy": round(exec_, 3),
            }
        )

    return pd.DataFrame(rows_exact), pd.DataFrame(rows_exec)


def main(args: argparse.Namespace) -> None:
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    wrote_any = False

    if args.stage1_glob:
        df1 = load_glob(args.stage1_glob)
        exact1, exec1 = _stage1_summary_tables(df1)
        if not exact1.empty:
            exact_path = out_dir / "summary_stage1_exact.csv"
            exact1.to_csv(exact_path, index=False)
            print(f"Wrote Stage-1 exact summary to {exact_path}")
            wrote_any = True
        if not exec1.empty:
            exec_path = out_dir / "summary_stage1_exec.csv"
            exec1.to_csv(exec_path, index=False)
            print(f"Wrote Stage-1 exec summary to {exec_path}")
            wrote_any = True

    if args.stage2_glob:
        df2 = load_glob(args.stage2_glob)
        exact2, exec2 = _stage2_summary_tables(df2)
        if not exact2.empty:
            exact_path = out_dir / "summary_stage2_exact.csv"
            exact2.to_csv(exact_path, index=False)
            print(f"Wrote Stage-2 exact summary to {exact_path}")
            wrote_any = True
        if not exec2.empty:
            exec_path = out_dir / "summary_stage2_exec.csv"
            exec2.to_csv(exec_path, index=False)
            print(f"Wrote Stage-2 exec summary to {exec_path}")
            wrote_any = True

    if not wrote_any:
        print("No data to aggregate; nothing written.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aggregate CleanSQL results")
    parser.add_argument("--stage1_glob", default="", help="Glob for Stage-1 CSVs (optional)")
    parser.add_argument("--stage2_glob", default="", help="Glob for Stage-2 CSVs (optional)")
    parser.add_argument(
        "--out_dir",
        default="results",
        help="Directory to write summary_* CSVs into (default: results)",
    )
    main(parser.parse_args())
