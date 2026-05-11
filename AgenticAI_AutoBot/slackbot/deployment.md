# AutoBot Deployment Guide

This guide covers deploying the AutoBot Slack integration and RLHF pipeline to a production cloud environment (e.g., AWS, GCP, or a managed Kubernetes cluster).

## 1. Architecture Overview
- **Slack Orchestrator (`slackbot/slack_orchestrator.py`)**: Port 8000. Handles incoming Slack Events and Interactivity (Buttons).
- **RLHF Orchestrator (`slackbot/rlhf/rlhf_orchestrator.py`)**: Port 8001. Handles the scheduled weekly DPO training and evaluation.
- **RunPod Serverless**: Handles the heavy GPU DPO training dynamically via `dpo_train_job.py` (hosted on a GitHub Gist).

## 2. Docker Deployment
We use a unified **root `docker-compose.yml`** to spin up the entire ecosystem, including the orchestrators, Sandbox, Neo4j, and the full observability stack (Loki, Promtail, Prometheus, Grafana).

**Important Files to bundle:**
- The root `docker-compose.yml`.
- `observability/prometheus.yml` and `observability/promtail-config.yaml`.
- The entire `slackbot/` directory.
- `slackbot/rlhf/eval_gold_set.json`: **CRITICAL**. This file contains the human-curated Gold Set used by the LLM-as-a-Judge during evaluation. When deploying to the cloud, ensure this file is baked into the Docker image or mounted via a persistent volume so `eval_runner.py` can read it.

## 3. Environment Variables
Ensure the following variables are injected securely (e.g., AWS Secrets Manager, Kubernetes Secrets):
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL`
- `OPENAI_API_KEY`, `HF_TOKEN`
- `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`

## 4. Setting up Webhooks
Once deployed, your cloud load balancer will give you a public IP or Domain name.
1. Go to `api.slack.com/apps` -> **Event Subscriptions**
2. Change the Request URL from ngrok to: `https://your-domain.com/slack/events`
3. Go to **Interactivity & Shortcuts**
4. Change the Request URL to: `https://your-domain.com/slack/interactive`
