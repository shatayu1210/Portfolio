# Telemetry & Observability Guide

This guide outlines how to integrate Loki, Prometheus, Grafana, and LangSmith into the AutoBot system to achieve production-grade observability.

## 1. Centralized Logging (Loki & Promtail)
Currently, logs are written locally to `slackbot/rlhf/logs/` and container stdout. To centralize this so logs from both the orchestrator and the pipeline are visible in Grafana:
We use **Promtail** to automatically scrape Docker container logs from `/var/lib/docker/containers/` and push them to Loki. 
This requires **zero code changes** to your python code. Just ensure your services are running in Docker or outputting to a place Promtail is configured to scrape (see `observability/promtail-config.yaml`).

## 2. Metrics (Prometheus & Grafana)
Track metrics like API latency or failure rates. We use `prometheus-fastapi-instrumentator`.

1. Install the package (already in `requirements.txt`):
   ```bash
   pip install prometheus-fastapi-instrumentator
   ```
2. In `app.py` (or `slack_orchestrator.py`), expose a `/metrics` FastAPI endpoint:
   ```python
   from prometheus_fastapi_instrumentator import Instrumentator
   Instrumentator().instrument(app).expose(app)
   ```
3. Update `observability/prometheus.yml` to scrape this target. Point your Grafana instance to your Prometheus server to visualize AutoBot's uptime.

## 3. Tracing LLM Flows (LangSmith)
AutoBot relies heavily on OpenAI and Hugging Face endpoint calls. LangSmith helps trace the exact prompts and token usage.
1. Install LangSmith:
   ```bash
   pip install langsmith
   ```
2. Set Environment Variables in `.env` or your cloud provider:
   ```env
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
   LANGCHAIN_API_KEY="<your-key>"
   LANGCHAIN_PROJECT="autobot-production"
   ```
3. Wrap your direct `openai.OpenAI()` clients (as seen in `adhoc.py` and `labeler.py`):
   ```python
   from langsmith import wrappers
   _openai_client = wrappers.wrap_openai(openai.OpenAI(...))
   ```
