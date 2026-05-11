"""
eval_runner.py — Gold-set evaluation for the DPO-retrained Reasoner.

Loads gold_set.json, calls the current HF Inference Endpoint with each issue,
then uses GPT-4o-as-judge (5-rubric scoring) to rate each response.
Prints a pass/fail decision at threshold=4.0/5.0.
"""
import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"), override=True)

import requests
from openai import OpenAI

from reasoner import build_prompt, parse_analysis

OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY")
HF_TOKEN          = os.getenv("HF_TOKEN")
REASONER_ENDPOINT = os.getenv("REASONER_ENDPOINT")
PASS_THRESHOLD    = float(os.getenv("EVAL_PASS_THRESHOLD", "4.0"))

client = OpenAI(api_key=OPENAI_API_KEY)

GOLD_SET_PATH = os.path.join(os.path.dirname(__file__), "gold_set.json")

JUDGE_SYSTEM = """You are an expert evaluator of AI-generated delivery risk summaries for GitHub issues.
Score the candidate response on 5 rubrics, each from 1-5:

1. Delivery Risk Clarity (1-5): Does it clearly state WHY this is a delivery risk for the team?
2. Evidence-Based Signals (1-5): Does it cite specific signals (days open, assignee status, comment gaps, PR state)?
3. Non-Technical Accessibility (1-5): Is it understandable to a non-technical scrum master with no code knowledge?
4. Actionability (1-5): Does it suggest or imply what the team should do next?
5. Factual Grounding (1-5): Are all claims grounded in the issue data provided? No hallucinations?

Output ONLY valid JSON with this exact structure:
{
  "delivery_risk_clarity": <int>,
  "evidence_based_signals": <int>,
  "non_technical_accessibility": <int>,
  "actionability": <int>,
  "factual_grounding": <int>,
  "reasoning": "<one sentence explaining the overall score>"
}"""


def judge_response(issue_data: str, candidate: str, reference: str) -> dict:
    """Ask GPT-4o to score a candidate response against the reference."""
    user_msg = (
        f"ISSUE DATA:\n{issue_data}\n\n"
        f"REFERENCE RESPONSE (gold standard):\n{reference}\n\n"
        f"CANDIDATE RESPONSE (model output to evaluate):\n{candidate}"
    )
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.0,
        max_tokens=300,
    )
    raw = resp.choices[0].message.content.strip()
    try:
        return json.loads(raw)
    except Exception:
        # Try extracting JSON block if model added markdown
        import re
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        return json.loads(m.group()) if m else {}


def call_reasoner(issue: dict) -> str:
    """Call the current HF Reasoner endpoint with one gold issue."""
    prompt = build_prompt(
        title                = issue["title"],
        body                 = issue["body"],
        labels               = issue.get("labels", []),
        days_open            = issue.get("days_open", 0),
        assignee_count       = issue.get("assignee_count", 0),
        comment_count        = issue.get("comment_count", 0),
        linked_pr_count      = issue.get("linked_pr_count", 0),
        pr_states            = issue.get("pr_states", ["none"]),
        ci_status            = issue.get("ci_status", "none"),
        max_comment_gap_days = issue.get("max_comment_gap_days", 0.0),
        comments_text        = issue.get("comments_text", ""),
        silent_reviewers     = issue.get("silent_reviewers", 0),
        pr_review_feedback   = issue.get("pr_review_feedback", ""),
        risk_score           = issue.get("confidence_score"),
        risk_band            = issue.get("predicted_class", "high"),
    )
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type":  "application/json",
    }
    payload = {
        "inputs":     prompt,
        "parameters": {"max_new_tokens": 200, "temperature": 0.3, "return_full_text": False},
    }
    resp = requests.post(REASONER_ENDPOINT, headers=headers, json=payload, timeout=120)
    resp.raise_for_status()
    return resp.json()[0]["generated_text"].strip()


def run_eval() -> dict:
    """Main entry point. Returns pass/fail result and per-issue scores."""
    print("\n[Eval] Loading gold set...")
    with open(GOLD_SET_PATH) as f:
        gold_set = json.load(f)

    print(f"[Eval] Running eval on {len(gold_set)} gold issues...")
    print("-" * 60)

    all_scores = []
    results    = []

    for i, item in enumerate(gold_set):
        issue = item["issue"]
        ref   = item["reference_response"]
        num   = issue.get("issue_number", i + 1)
        title = issue["title"][:55]
        print(f"\n  [{i+1}/{len(gold_set)}] #{num}: {title}...")

        try:
            candidate = call_reasoner(issue)
            print(f"    Candidate: {candidate[:100]}...")

            issue_data_str = (
                f"Title: {issue['title']}\n"
                f"Days Open: {issue.get('days_open', 0)} | "
                f"Assignees: {issue.get('assignee_count', 0)} | "
                f"Comments: {issue.get('comment_count', 0)} | "
                f"Labels: {', '.join(issue.get('labels', []))}\n"
                f"Body: {issue.get('body', '')[:500]}"
            )
            scores = judge_response(issue_data_str, candidate, ref)
            rubric_scores = [
                scores.get("delivery_risk_clarity", 0),
                scores.get("evidence_based_signals", 0),
                scores.get("non_technical_accessibility", 0),
                scores.get("actionability", 0),
                scores.get("factual_grounding", 0),
            ]
            mean = sum(rubric_scores) / len(rubric_scores) if rubric_scores else 0
            all_scores.append(mean)
            print(f"    Scores: {rubric_scores} → Mean: {mean:.2f}/5")
            print(f"    Judge: {scores.get('reasoning', '')[:100]}")

            results.append({
                "issue_number": num,
                "mean_score":   round(mean, 2),
                "scores":       scores,
                "candidate":    candidate,
                "reference":    ref,
            })
        except Exception as e:
            print(f"    ❌ Eval failed for #{num}: {e}")
            all_scores.append(0)
            results.append({"issue_number": num, "error": str(e)})

    overall_mean = sum(all_scores) / len(all_scores) if all_scores else 0
    passed       = overall_mean >= PASS_THRESHOLD

    print("\n" + "=" * 60)
    print(f"[Eval] Overall mean score: {overall_mean:.2f} / 5.00")
    print(f"[Eval] Pass threshold:     {PASS_THRESHOLD:.2f} / 5.00")
    print(f"[Eval] Result:             {'✅ PASS — safe to deploy' if passed else '❌ FAIL — do not deploy'}")
    print("=" * 60)

    return {
        "passed":       passed,
        "overall_mean": round(overall_mean, 2),
        "threshold":    PASS_THRESHOLD,
        "per_issue":    results,
    }


if __name__ == "__main__":
    result = run_eval()
    if not result["passed"]:
        sys.exit(1)  # Non-zero exit signals failure to orchestrator
