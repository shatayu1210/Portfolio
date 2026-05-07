# Telemetry & Observability Guide

This guide outlines how to integrate Loki, Prometheus, Grafana, and LangSmith into the AutoBot system to achieve production-grade observability.

## 1. Centralized Logging (Loki)
Currently, logs are written locally to `slackbot/rlhf/logs/`. To centralize this so logs from both the orchestrator and the pipeline are visible in Grafana:
1. Install `python-logging-loki`:
   ```bash
   pip install python-logging-loki
   ```
2. Update the `_make_run_logger` function in `rlhf_orchestrator.py` and the main logger in `slack_orchestrator.py`:
   ```python
   import logging_loki
   handler = logging_loki.LokiHandler(
       url="https://<your-loki-endpoint>/loki/api/v1/push", 
       tags={"application": "autobot-rlhf"},
       version="1",
   )
   logger.addHandler(handler)
   ```

## 2. Metrics (Prometheus & Grafana)
Track metrics like Slack event processing time, RLHF training duration, and evaluation scores.
1. Install `prometheus-client`:
   ```bash
   pip install prometheus-client
   ```
2. In `slack_orchestrator.py` and `rlhf_orchestrator.py`, expose a `/metrics` FastAPI endpoint.
3. Add decorators to track API latency or failure rates:
   ```python
   from prometheus_client import Summary
   REQUEST_TIME = Summary('request_processing_seconds', 'Time spent processing request')

   @REQUEST_TIME.time()
   def handle_adhoc_query(...):
   ```
4. Point your Grafana instance to your Prometheus server to visualize AutoBot's uptime and RLHF success rates.

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
