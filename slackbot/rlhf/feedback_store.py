"""
feedback_store.py — Read/write RLHF feedback records to HuggingFace Dataset Hub.

Dataset repo: autobot298/autobot-feedback (private)
Schema per row:
  issue_number    int
  issue_title     str
  prompt          str    — full Qwen prompt string sent to Reasoner
  bad_response    str    — what the model actually said (thumbs-down)
  created_at      str    — ISO timestamp
  labeled         bool   — True once teacher response is generated
  chosen_response str    — GPT-4o teacher output (filled by labeler)
  retrained       bool   — True once this row was used in a DPO cycle
  feedback_type   str    — "negative" | "positive"
"""
import os
import json
from datetime import datetime, timezone

from datasets import load_dataset, Dataset, DatasetDict
from huggingface_hub import HfApi

HF_TOKEN       = os.getenv("HF_TOKEN")
DATASET_REPO   = "autobot298/autobot-feedback"
SPLIT          = "train"

_EMPTY_ROW = {
    "issue_number":    0,
    "issue_title":     "",
    "prompt":          "",
    "bad_response":    "",
    "created_at":      "",
    "labeled":         False,
    "chosen_response": "",
    "retrained":       False,
    "feedback_type":   "negative",
}


def _load_dataset() -> Dataset:
    """Load the full dataset from HF Hub. Creates it if it doesn't exist yet."""
    try:
        ds = load_dataset(DATASET_REPO, split=SPLIT, token=HF_TOKEN)
        return ds
    except Exception:
        # Repo doesn't exist yet — create an empty dataset
        print(f"[FeedbackStore] Dataset not found — initialising empty repo at {DATASET_REPO}")
        empty = Dataset.from_list([_EMPTY_ROW]).filter(lambda _: False)  # schema only, no rows
        empty.push_to_hub(DATASET_REPO, split=SPLIT, token=HF_TOKEN, private=True)
        return empty


def push_feedback(
    issue_number: int,
    issue_title: str,
    prompt: str,
    bad_response: str,
    feedback_type: str = "negative",
) -> bool:
    """Append one feedback record to the HF Dataset and push."""
    try:
        ds = _load_dataset()
        new_row = {
            **_EMPTY_ROW,
            "issue_number":  issue_number,
            "issue_title":   issue_title,
            "prompt":        prompt,
            "bad_response":  bad_response,
            "created_at":    datetime.now(timezone.utc).isoformat(),
            "feedback_type": feedback_type,
        }
        updated = ds.add_item(new_row)
        updated.push_to_hub(DATASET_REPO, split=SPLIT, token=HF_TOKEN, private=True)
        print(f"[FeedbackStore] ✅ Pushed feedback for #{issue_number} ({feedback_type})")
        return True
    except Exception as e:
        print(f"[FeedbackStore] ❌ Failed to push feedback: {e}")
        return False


def get_unlabeled() -> list[dict]:
    """Return all rows where labeled=False and feedback_type='negative'."""
    try:
        ds = _load_dataset()
        unlabeled = ds.filter(lambda r: not r["labeled"] and r["feedback_type"] == "negative")
        return [dict(r) for r in unlabeled]
    except Exception as e:
        print(f"[FeedbackStore] Failed to fetch unlabeled rows: {e}")
        return []


def mark_labeled(issue_numbers: list[int], chosen_responses: dict[int, str]) -> bool:
    """
    Update rows matching issue_numbers to set labeled=True and chosen_response.
    Pushes the full updated dataset back to HF Hub.
    """
    try:
        ds = _load_dataset()

        def _update(row):
            if row["issue_number"] in issue_numbers and not row["labeled"]:
                row["labeled"]         = True
                row["chosen_response"] = chosen_responses.get(row["issue_number"], "")
            return row

        updated = ds.map(_update)
        updated.push_to_hub(DATASET_REPO, split=SPLIT, token=HF_TOKEN, private=True)
        print(f"[FeedbackStore] ✅ Marked {len(issue_numbers)} rows as labeled")
        return True
    except Exception as e:
        print(f"[FeedbackStore] ❌ Failed to mark labeled: {e}")
        return False


def get_dpo_pairs() -> list[dict]:
    """Return labeled rows not yet used in retraining as DPO pairs."""
    try:
        ds = _load_dataset()
        pairs = ds.filter(lambda r: r["labeled"] and not r["retrained"] and r["feedback_type"] == "negative")
        return [dict(r) for r in pairs]
    except Exception as e:
        print(f"[FeedbackStore] Failed to get DPO pairs: {e}")
        return []


def mark_retrained(issue_numbers: list[int]) -> bool:
    """Flag rows as used in a completed DPO retraining cycle."""
    try:
        ds = _load_dataset()
        updated = ds.map(lambda r: {**r, "retrained": True}
                         if r["issue_number"] in issue_numbers else r)
        updated.push_to_hub(DATASET_REPO, split=SPLIT, token=HF_TOKEN, private=True)
        print(f"[FeedbackStore] ✅ Marked {len(issue_numbers)} rows as retrained")
        return True
    except Exception as e:
        print(f"[FeedbackStore] ❌ Failed to mark retrained: {e}")
        return False


def get_stats() -> dict:
    """Summary counts for the /rlhf/status endpoint."""
    try:
        ds = _load_dataset()
        total      = len(ds)
        negative   = len(ds.filter(lambda r: r["feedback_type"] == "negative"))
        unlabeled  = len(ds.filter(lambda r: not r["labeled"] and r["feedback_type"] == "negative"))
        labeled    = len(ds.filter(lambda r: r["labeled"] and not r["retrained"]))
        retrained  = len(ds.filter(lambda r: r["retrained"]))
        return {
            "total_feedback":   total,
            "negative":         negative,
            "unlabeled":        unlabeled,
            "labeled_pending":  labeled,
            "used_in_training": retrained,
        }
    except Exception as e:
        return {"error": str(e)}
