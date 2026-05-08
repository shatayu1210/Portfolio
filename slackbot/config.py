import os
from dotenv import load_dotenv

# Load .env — works locally; on Render, env vars are injected directly
_here = os.path.dirname(__file__)
load_dotenv(os.path.join(_here, ".env"), override=False)          # slackbot/.env (if present)
load_dotenv(os.path.join(_here, "../.env"), override=False)       # project root .env (local dev)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO", "apache/airflow")
GITHUB_OWNER = os.getenv("GITHUB_OWNER", "apache")
GITHUB_REPO_NAME = os.getenv("GITHUB_REPO_NAME", "airflow")
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_CHANNEL = os.getenv("SLACK_CHANNEL", "#autobot-alerts")
HF_TOKEN = os.getenv("HF_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SCORER_ENDPOINT = os.getenv("SCORER_ENDPOINT", "")
REASONER_ENDPOINT = os.getenv("REASONER_ENDPOINT", "")
SCORER_THRESHOLD = float(os.getenv("SCORER_THRESHOLD", "0.8"))
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "1800"))
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")

# Validation — warn but don't crash; RLHF service doesn't need GITHUB_TOKEN
if not GITHUB_TOKEN:
    print("WARNING: GITHUB_TOKEN not set — GitHub polling will be disabled.")
