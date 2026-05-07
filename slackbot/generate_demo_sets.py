import json
import os
import random
from poller import HEADERS, GITHUB_API_URL, _compute_days_open, _fetch_pr_states_with_numbers, _fetch_issue_comments, _fetch_pr_review_feedback
from sentinel import score_issue
import requests

def fetch_batch_for_demo(pages=5) -> list[dict]:
    """Fetch recent open issues from GitHub API with rich metadata."""
    issues = []
    print(f"Fetching {pages} pages of issues for demo generation...")
    for page_num in range(1, pages + 1):
        params = {
            "state": "open",
            "per_page": 30,
            "page": page_num,
            "sort": "updated",
            "direction": "desc"
        }
        response = requests.get(GITHUB_API_URL, headers=HEADERS, params=params)
        if response.status_code != 200:
            print(f"❌ GitHub API error: {response.status_code} — {response.text[:200]}")
            break
            
        page_data = response.json()
        if not page_data:
            break
            
        for item in page_data:
            if "pull_request" in item:
                continue
            
            issue_number   = item["number"]
            created_at     = item["created_at"]
            
            # Fetch rich metadata
            pr_states, pr_numbers = _fetch_pr_states_with_numbers(issue_number)
            comments_text, max_gap = _fetch_issue_comments(issue_number)
            silent_reviewers, pr_feedback = _fetch_pr_review_feedback(pr_numbers)
            
            issues.append({
                "issue_number":         issue_number,
                "title":                item["title"],
                "body":                 item.get("body") or "",
                "url":                  item["html_url"],
                "created_at":           created_at,
                "labels":               [lb["name"] for lb in item.get("labels", [])],
                "days_open":            _compute_days_open(created_at),
                "comment_count":        item.get("comments", 0),
                "assignee_count":       len(item.get("assignees", [])),
                "linked_pr_count":      len([s for s in pr_states if s != "none"]),
                "pr_states":            pr_states,
                "pr_numbers":           pr_numbers,
                "ci_status":            "none",
                "max_comment_gap_days": max_gap,
                "comments_text":        comments_text,
                "silent_reviewers":     silent_reviewers,
                "pr_review_feedback":   pr_feedback,
            })
        print(f"  Page {page_num}: processed {len(issues)} issues so far")
    return issues

def generate_sets():
    raw_issues = fetch_batch_for_demo(pages=12)  # Fetch ~360 items to get ~80 pure issues
    print(f"Total pure issues fetched: {len(raw_issues)}")
    
    print("Scoring all issues via Sentinel...")
    scored_issues = []
    for i, issue in enumerate(raw_issues):
        try:
            scored = score_issue(issue)
            scored_issues.append(scored)
            if i % 10 == 0:
                print(f"  Scored {i}/{len(raw_issues)}...")
        except Exception as e:
            print(f"  ❌ Failed to score #{issue['issue_number']}: {e}")
            
    # Separate into high and low/medium
    high_issues = [i for i in scored_issues if i.get("is_high_severity")]
    low_medium_issues = [i for i in scored_issues if not i.get("is_high_severity")]
    
    print(f"\nFound {len(high_issues)} HIGH severity and {len(low_medium_issues)} LOW/MEDIUM severity issues.")
    
    if len(high_issues) < 8:
        print("⚠️ Not enough HIGH severity issues found for 2 sets. Need at least 8.")
        print("Falling back to taking the top N by High Probability...")
        
        # Sort specifically by the probability of the 'high' class
        scored_issues.sort(key=lambda x: x.get("probabilities", {}).get("high", 0.0), reverse=True)
        
        high_issues = scored_issues[:8]
        low_medium_issues = scored_issues[8:]
        
        # Explicitly force the flags so there's no leakage
        for h in high_issues:
            h["is_high_severity"] = True
            if "forced" not in h.get("predicted_class", ""):
                h["predicted_class"] = "high (forced for demo)"
        for l in low_medium_issues:
            l["is_high_severity"] = False
    # Shuffle to randomize
    random.shuffle(high_issues)
    random.shuffle(low_medium_issues)
    
    # Create Set 1
    set_1 = high_issues[0:4] + low_medium_issues[0:26]
    random.shuffle(set_1)
    
    # Create Set 2
    set_2 = high_issues[4:8] + low_medium_issues[26:52]
    random.shuffle(set_2)
    
    with open("demo_set_1.json", "w") as f:
        json.dump(set_1, f, indent=2)
        
    with open("demo_set_2.json", "w") as f:
        json.dump(set_2, f, indent=2)
        
    print("\n✅ Successfully generated demo_set_1.json and demo_set_2.json!")
    
    def print_stats(set_num, s):
        high_count = len([i for i in s if i['is_high_severity']])
        low_med_count = len(s) - high_count
        high_issues = [f"#{i['issue_number']} ({i.get('predicted_class', 'high')})" for i in s if i['is_high_severity']]
        print(f"\n📊 Set {set_num} Stats (Total: {len(s)} issues):")
        print(f"  - LOW/MEDIUM (Filtered out): {low_med_count}")
        print(f"  - HIGH (Sent to Reasoner):   {high_count}")
        print(f"  - HIGH Issue Numbers:        {', '.join(high_issues)}")

    print_stats(1, set_1)
    print_stats(2, set_2)

if __name__ == "__main__":
    generate_sets()
