import os
import json
import glob
from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "autobot_password")

# Path to your extracted data
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../etl/training_data"))

def clear_graph(session):
    print("Clearing existing graph in batches...")
    # Delete relationships first to avoid heavy detach overhead
    while True:
        res = session.run("MATCH ()-[r]->() WITH r LIMIT 10000 DELETE r RETURN count(r) as count")
        if res.single()["count"] == 0:
            break
    
    # Delete remaining nodes
    while True:
        res = session.run("MATCH (n) WITH n LIMIT 10000 DELETE n RETURN count(n) as count")
        if res.single()["count"] == 0:
            break
            
    print("Constraints being created...")
    session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (i:Issue) REQUIRE i.number IS UNIQUE")
    session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (p:PR) REQUIRE p.number IS UNIQUE")
    session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (f:File) REQUIRE f.filename IS UNIQUE")
    session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (r:Review) REQUIRE r.id IS UNIQUE")
    session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.login IS UNIQUE")
    session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (l:Label) REQUIRE l.name IS UNIQUE")

def ingest_issues(driver):
    issue_files = glob.glob(os.path.join(DATA_DIR, "issues_clean*.jsonl"))
    print(f"Found {len(issue_files)} issue JSONL files.")
    
    query = """
    UNWIND $batch AS record
    MERGE (i:Issue {number: record.issue_number})
    SET i.title = record.issue.title,
        i.body_truncated = substring(record.issue.body, 0, 800),
        i.created_at = record.issue.created_at
        
    // For each linked PR, create the PR node and relationship
    WITH i, record
    UNWIND record.resolved_by_prs AS pr_num
    MERGE (p:PR {number: pr_num})
    MERGE (i)-[:RESOLVED_BY]->(p)
    """

    for file_path in issue_files:
        batch = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    issue = data.get("issue", {})
                    if not issue:
                        continue
                    
                    record = {
                        "issue_number": data.get("issue_number"),
                        "issue": {
                            "title": issue.get("title", ""),
                            "body": issue.get("body") or "",
                            "created_at": issue.get("created_at", "")
                        },
                        "resolved_by_prs": data.get("resolved_by_prs") or []
                    }
                    batch.append(record)
                    
                    if len(batch) >= 500:
                        with driver.session() as session:
                            session.run(query, parameters={"batch": batch})
                        batch = []
                except Exception as e:
                    print(f"Error parsing line in {file_path}: {e}")
        
        # Flush remaining
        if batch:
            with driver.session() as session:
                session.run(query, parameters={"batch": batch})
    print("Finished ingesting Issues.")

def ingest_prs(driver):
    pr_files = glob.glob(os.path.join(DATA_DIR, "prs_clean*.jsonl"))
    print(f"Found {len(pr_files)} PR JSONL files.")

    # Due to size, we ingest PR metadata and files separately for cleanliness.
    pr_query = """
    UNWIND $batch AS record
    MERGE (p:PR {number: record.pr_number})
    SET p.title = record.pr_title,
        p.body_truncated = substring(record.pr_body, 0, 1000),
        p.merged_at = record.merged_at
        
    WITH p, record
    UNWIND record.files AS filename
    MERGE (f:File {filename: filename})
    MERGE (p)-[:TOUCHES]->(f)
    """
    
    review_query = """
    UNWIND $batch AS record
    MERGE (p:PR {number: record.pr_number})
    
    WITH p, record
    UNWIND record.reviews AS review
    MERGE (r:Review {id: review.id})
    SET r.body = review.body,
        r.state = review.state,
        r.is_inline_comment = review.is_inline_comment,
        r.diff_hunk = review.diff_hunk
    MERGE (r)-[:REVIEWED_IN]->(p)
    
    // Connect Review to File if it's an inline comment
    WITH r, p, review
    WHERE review.filename IS NOT NULL AND review.filename <> ""
    MERGE (f:File {filename: review.filename})
    MERGE (r)-[:APPLIES_TO]->(f)
    """

    for file_path in pr_files:
        pr_batch = []
        review_batch = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    pr = data.get("pr", {})
                    if not pr:
                        continue
                        
                    pr_num = pr.get("number")
                    
                    files = data.get("files") or []
                    filenames = [f.get("filename") for f in files if getattr(f, "get", lambda x: None)("filename")]
                    
                    pr_record = {
                        "pr_number": pr_num,
                        "pr_title": pr.get("title", ""),
                        "pr_body": pr.get("body") or "",
                        "merged_at": pr.get("merged_at", ""),
                        "files": filenames
                    }
                    pr_batch.append(pr_record)
                    
                    reviews = []
                    # Add PR Reviews
                    for rev in (data.get("reviews") or []):
                        if not rev.get("id"): continue
                        reviews.append({
                            "id": str(rev.get("id")) + "_review",
                            "body": rev.get("body") or "",
                            "state": rev.get("state", ""),
                            "is_inline_comment": False,
                            "diff_hunk": None,
                            "filename": None
                        })
                    
                    # Add PR Review Comments (inline code comments)
                    for comment in (data.get("review_comments") or []):
                        if not comment.get("id"): continue
                        reviews.append({
                            "id": str(comment.get("id")) + "_comment",
                            "body": comment.get("body") or "",
                            "state": "COMMENT", # It's inline friction
                            "is_inline_comment": True,
                            "diff_hunk": comment.get("diff_hunk"),
                            "filename": comment.get("path") # The file it targets
                        })
                        
                    if reviews:
                        review_batch.append({
                            "pr_number": pr_num,
                            "reviews": reviews
                        })
                    
                    if len(pr_batch) >= 200:
                        with driver.session() as session:
                            session.run(pr_query, parameters={"batch": pr_batch})
                            if review_batch:
                                session.run(review_query, parameters={"batch": review_batch})
                        pr_batch = []
                        review_batch = []
                        
                except Exception as e:
                    print(f"Error parsing line in {file_path}: {e}")
        
        # Flush remaining
        if pr_batch:
            with driver.session() as session:
                session.run(pr_query, parameters={"batch": pr_batch})
                if review_batch:
                    session.run(review_query, parameters={"batch": review_batch})
    print("Finished ingesting PRs and Reviews.")


def ingest_users_and_labels(driver):
    """
    Second pass to create User and Label nodes and wire them to PRs/Issues.
    Adds: AUTHORED, MERGED, REVIEWED (PR-side) and REPORTED, COMMENTED_ON (Issue-side).
    Run after ingest_issues() and ingest_prs() so all PR/Issue nodes already exist.
    """
    print("Ingesting Users and Labels...")

    pr_user_query = """
    UNWIND $batch AS record
    // PR author
    MERGE (author:User {login: record.author_login})
    WITH author, record
    MERGE (p:PR {number: record.pr_number})
    MERGE (author)-[:AUTHORED]->(p)
    // merged_by
    WITH p, record
    FOREACH (ml IN CASE WHEN record.merged_by IS NOT NULL THEN [record.merged_by] ELSE [] END |
        MERGE (m:User {login: ml})
        MERGE (m)-[:MERGED]->(p)
    )
    // reviewers (from review objects)
    WITH p, record
    UNWIND record.reviewer_logins AS rlogin
    MERGE (rv:User {login: rlogin})
    MERGE (rv)-[:REVIEWED]->(p)
    """

    pr_label_query = """
    UNWIND $batch AS record
    MERGE (p:PR {number: record.pr_number})
    WITH p, record
    UNWIND record.labels AS lname
    MERGE (l:Label {name: lname})
    MERGE (p)-[:HAS_LABEL]->(l)
    """

    issue_user_query = """
    UNWIND $batch AS record
    MERGE (i:Issue {number: record.issue_number})
    WITH i, record
    MERGE (reporter:User {login: record.reporter_login})
    MERGE (reporter)-[:REPORTED]->(i)
    WITH i, record
    UNWIND record.commenter_logins AS clogin
    MERGE (c:User {login: clogin})
    MERGE (c)-[:COMMENTED_ON]->(i)
    """

    issue_label_query = """
    UNWIND $batch AS record
    MERGE (i:Issue {number: record.issue_number})
    WITH i, record
    UNWIND record.labels AS lname
    MERGE (l:Label {name: lname})
    MERGE (i)-[:HAS_LABEL]->(l)
    """

    # --- PRs ---
    pr_files = glob.glob(os.path.join(DATA_DIR, "prs_clean*.jsonl"))
    print(f"  Processing {len(pr_files)} PR file(s) for Users/Labels...")
    pr_user_batch, pr_label_batch = [], []

    for file_path in pr_files:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    pr = data.get("pr", {})
                    if not pr:
                        continue
                    pr_num = pr.get("number")
                    author_login = (pr.get("user") or {}).get("login")
                    if not author_login:
                        continue
                    merged_by = (pr.get("merged_by") or {}).get("login")

                    # Unique reviewer logins from review objects (not requested_reviewers,
                    # which is a snapshot — actual reviewers come from submitted reviews)
                    reviewer_logins = list({
                        (rev.get("user") or {}).get("login")
                        for rev in (data.get("reviews") or [])
                        if (rev.get("user") or {}).get("login")
                    })
                    # Also capture review comment authors
                    reviewer_logins += [
                        login for login in (
                            (c.get("user") or {}).get("login")
                            for c in (data.get("review_comments") or [])
                        )
                        if login and login not in reviewer_logins
                    ]

                    pr_user_batch.append({
                        "pr_number": pr_num,
                        "author_login": author_login,
                        "merged_by": merged_by,
                        "reviewer_logins": reviewer_logins
                    })

                    pr_labels = [l.get("name") for l in (pr.get("labels") or []) if l.get("name")]
                    if pr_labels:
                        pr_label_batch.append({
                            "pr_number": pr_num,
                            "labels": pr_labels
                        })

                    if len(pr_user_batch) >= 200:
                        with driver.session() as session:
                            session.run(pr_user_query, parameters={"batch": pr_user_batch})
                            if pr_label_batch:
                                session.run(pr_label_query, parameters={"batch": pr_label_batch})
                        pr_user_batch, pr_label_batch = [], []

                except Exception as e:
                    print(f"  Error in PR user/label pass ({file_path}): {e}")

        # Flush per-file remainder
        if pr_user_batch:
            with driver.session() as session:
                session.run(pr_user_query, parameters={"batch": pr_user_batch})
                if pr_label_batch:
                    session.run(pr_label_query, parameters={"batch": pr_label_batch})
            pr_user_batch, pr_label_batch = [], []

    # --- Issues ---
    issue_files = glob.glob(os.path.join(DATA_DIR, "issues_clean*.jsonl"))
    print(f"  Processing {len(issue_files)} Issue file(s) for Users/Labels...")
    iss_user_batch, iss_label_batch = [], []

    for file_path in issue_files:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    issue = data.get("issue", {})
                    if not issue:
                        continue
                    reporter_login = (issue.get("user") or {}).get("login")
                    if not reporter_login:
                        continue
                    issue_num = data.get("issue_number")

                    commenter_logins = list({
                        (c.get("user") or {}).get("login")
                        for c in (data.get("comments") or [])
                        if (c.get("user") or {}).get("login")
                    })

                    iss_user_batch.append({
                        "issue_number": issue_num,
                        "reporter_login": reporter_login,
                        "commenter_logins": commenter_logins
                    })

                    labels = data.get("label_names") or []
                    if labels:
                        iss_label_batch.append({
                            "issue_number": issue_num,
                            "labels": labels
                        })

                    if len(iss_user_batch) >= 500:
                        with driver.session() as session:
                            session.run(issue_user_query, parameters={"batch": iss_user_batch})
                            if iss_label_batch:
                                session.run(issue_label_query, parameters={"batch": iss_label_batch})
                        iss_user_batch, iss_label_batch = [], []

                except Exception as e:
                    print(f"  Error in Issue user/label pass ({file_path}): {e}")

        # Flush per-file remainder
        if iss_user_batch:
            with driver.session() as session:
                session.run(issue_user_query, parameters={"batch": iss_user_batch})
                if iss_label_batch:
                    session.run(issue_label_query, parameters={"batch": iss_label_batch})
            iss_user_batch, iss_label_batch = [], []

    print("Finished ingesting Users and Labels.")


def run_ingestion():
    driver = GraphDatabase.driver(URI, auth=AUTH)
    with driver.session() as session:
        clear_graph(session)

    ingest_issues(driver)
    ingest_prs(driver)
    ingest_users_and_labels(driver)

    driver.close()
    print("Graph Ingestion Complete! You can now query Neo4j for extractions.")

if __name__ == "__main__":
    run_ingestion()
