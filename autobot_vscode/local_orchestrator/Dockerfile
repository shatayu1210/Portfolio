FROM python:3.11-slim

WORKDIR /app

# grep is used by planner_orchestrator.py's keyword_search research tool
RUN apt-get update && apt-get install -y grep docker.io && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source — never COPY .env
COPY app.py langgraph_workflow.py planner_orchestrator.py graphrag_client.py ./

# Optional: copy the tree-sitter index if you placed it here (see README)
# COPY ts_index.json ./

# logs/ must exist and be writable at runtime
RUN mkdir -p logs

EXPOSE 8000

# IMPORTANT: --workers 1 only.
# function_registry in langgraph_workflow.py is in-memory and not shared across workers.
# Multi-worker setups will cause "No patcher_fn provided" errors on accept_plan calls.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
