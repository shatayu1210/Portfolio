FROM python:3.12-slim

# Prevents Python from writing pyc files and buffering stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Copy only the slackbot directory (all code lives here)
COPY . .

# Install all dependencies from requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Expose port — Render injects $PORT at runtime
EXPOSE 8000

# Default: run the Slack Orchestrator
# To run the RLHF Orchestrator instead, override CMD in a second Render service:
#   cd rlhf && uvicorn rlhf_orchestrator:app --host 0.0.0.0 --port $PORT
CMD ["sh", "-c", "uvicorn slack_orchestrator:app --host 0.0.0.0 --port ${PORT:-8000}"]
