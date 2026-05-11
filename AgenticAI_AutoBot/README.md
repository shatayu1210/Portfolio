# AgenticAI AutoBot 🤖
### Autonomous GitHub Orchestration & Code-Patching System

AutoBot is a production-grade multi-agent system designed to manage the lifecycle of software issues for large-scale repositories like **Apache Airflow**. It moves beyond simple RAG by using a **Multi-Agent Orchestration** loop to plan, write, and validate code patches autonomously.

[**Technical Setup Guide (Deep Dive) →**](./SETUP.md) | [**Full Architecture Reference (v9) →**](./docs/autobot_v9.md)

---

## 🌟 Key Capabilities
- **Autonomous Patching:** Uses a **Planner → Patcher → Critic** cycle to generate valid `git diffs` from natural language issue descriptions.
- **GraphRAG Reasoning:** Traverses a Neo4j knowledge graph (12k issues, 43k PRs) to find historical priors and "idiomatic" fix patterns.
- **Safety-First Design:** Implemented "Blast Radius" containment, "Confidence HITL" gates, and a "Logical Critic" to ensure code safety.
- **Automated RLHF Loop:** Captures human feedback in Slack and triggers serverless **DPO (Direct Preference Optimization)** retraining on RunPod.

## 🏗️ System Architecture
The system is built as a distributed monorepo:
- **Orchestrator:** A LangGraph-based Python service managing agent state and tool-calling.
- **Knowledge Graph:** Neo4j storing 300k+ nodes (Issues, PRs, Files) for relational retrieval.
- **Inference:** High-concurrency HuggingFace TGI endpoints serving fine-tuned LoRA adapters.
- **Frontend:** A premium VS Code Extension providing an interactive "Pair Programmer" experience.
- **Observability:** Full Prometheus + Grafana stack tracking average planning latency and patch success rates.

## 🛡️ Multi-Layered Guardrails
To prevent autonomous "hallucinations" in production:
1. **Blast Radius:** Blocks any plan touching >3 files before human approval.
2. **Confidence HITL:** Forces manual intervention if the Planner's self-scored confidence is <0.8.
3. **Logical Critic:** A post-sandbox agent that verifies if the patch actually solves the *intent* of the issue, even if tests pass.
4. **Sandboxed Validation:** Every patch is validated inside a Docker sandbox before being presented to the user.

---
## 📁 Project Structure
- `autobot_langgraph/`: Core orchestration logic and state graphs.
- `autobot_vscode/`: VS Code extension source and webview UI.
- `graphrag/`: Neo4j ingestion and Cypher tool-calling logic.
- `slackbot/`: Sentinel triage bot and RLHF feedback collection.
- `etl/`: Airflow DAGs for data ingestion to Snowflake.

---
*For setup instructions, please refer to [SETUP.md](./SETUP.md).*
