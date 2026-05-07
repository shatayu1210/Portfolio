"""
labeler.py — Teacher labeling step of the RLHF/DPO pipeline.

Reads unlabeled thumbs-down records from HF Dataset.
Calls GPT-4o with the same prompt + issue context to generate a "chosen" response.
Writes chosen_response back and marks labeled=True.
"""
import os
import sys
from openai import OpenAI

# Allow running from slackbot/ or slackbot/rlhf/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"), override=True)

from rlhf.feedback_store import get_unlabeled, mark_labeled

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client         = OpenAI(api_key=OPENAI_API_KEY)

TEACHER_SYSTEM = (
    "You are a delivery risk analyst for GitHub issues in open-source projects. "
    "You will be given an issue snapshot and must write 2-3 sentences for a scrum master or delivery lead. "
    "Structure your response as follows:\n"
    "(1) Lead with how long the issue has been open and whether anyone is assigned — no assignee is itself a red flag.\n"
    "(2) Cite concrete activity signals: number of comments, comment gaps, linked PR states, or silent reviewers.\n"
    "(3) State the delivery or user impact risk clearly.\n"
    "High-level technical terms (bug type, affected component, feature area) are fine. "
    "Do NOT mention file names, function names, class names, or code implementation details. "
    "No bullet points. Write in flowing prose. Be specific, grounded, and concise."
)


def generate_chosen(prompt_text: str) -> str:
    """Use GPT-4o to generate the gold/chosen response for a given reasoner prompt."""
    # Extract just the user-turn content from the Qwen chat template
    # prompt_text looks like: <|im_start|>system\n...<|im_end|>\n<|im_start|>user\n{issue_data}<|im_end|>\n<|im_start|>assistant\n
    user_content = prompt_text
    if "<|im_start|>user" in prompt_text:
        user_content = prompt_text.split("<|im_start|>user\n")[1].split("<|im_end|>")[0].strip()

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": TEACHER_SYSTEM},
            {"role": "user",   "content": user_content},
        ],
        temperature=0.3,
        max_tokens=300,
    )
    return response.choices[0].message.content.strip()


def run_labeler(max_records: int = 50) -> dict:
    """
    Main entry point. Fetch unlabeled records, call GPT-4o, write back.
    Returns a summary dict.
    """
    print("\n[Labeler] Fetching unlabeled feedback records...")
    records = get_unlabeled()

    if not records:
        print("[Labeler] No unlabeled records found. Nothing to do.")
        return {"labeled": 0, "skipped": 0}

    records = records[:max_records]
    print(f"[Labeler] Found {len(records)} records to label.")

    labeled_nums    = []
    chosen_map: dict[int, str] = {}
    failed          = 0

    for i, rec in enumerate(records):
        num   = rec["issue_number"]
        title = rec.get("issue_title", "")[:60]
        print(f"  [{i+1}/{len(records)}] #{num}: {title}...")

        try:
            chosen = generate_chosen(rec["prompt"])
            chosen_map[num] = chosen
            labeled_nums.append(num)
            print(f"    ✅ Generated chosen response ({len(chosen)} chars)")
        except Exception as e:
            print(f"    ❌ GPT-4o failed for #{num}: {e}")
            failed += 1

    if labeled_nums:
        mark_labeled(labeled_nums, chosen_map)

    summary = {
        "labeled": len(labeled_nums),
        "failed":  failed,
        "skipped": len(records) - len(labeled_nums) - failed,
    }
    print(f"\n[Labeler] Done: {summary}")
    return summary


if __name__ == "__main__":
    result = run_labeler()
    print(f"\n✅ Labeling complete: {result}")
