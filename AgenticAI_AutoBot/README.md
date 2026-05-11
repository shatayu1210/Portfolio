# AgenticAI AutoBot 🤖
### Proactive Triage & Autonomous Code-Patching System

AutoBot is a production-grade multi-agent system designed to manage the lifecycle of software issues for large-scale repositories like **Apache Airflow**.

[**Technical Setup Guide →**](./SETUP.md) | [**Full Architecture Reference (v9) →**](./docs/autobot_v9.md)

---

## 🌟 Key Capabilities

### 1. Proactive Risk Sentinel (Triage)
Unlike reactive bots, AutoBot **proactively monitors** the repository to prevent delivery bottlenecks:
- **Severity Scoring:** Automatically classifies every incoming issue as Low/Medium/High.
- **Cited Reasoning:** Generates a 2-3 sentence "Risk Narrative" for high-severity issues, citing specific historical precedents and CI signals.
- **Real-time Alerting:** Posts early-detection alerts to Slack, allowing delivery leads to reprioritize work before a bottleneck occurs.

### 2. Autonomous Patching Assistant
- **Planning:** Generates structured fix plans using historical priors from a **Neo4j GraphRAG** knowledge graph.
- **Patching:** Fine-tuned LoRA models generate `git diffs` and validate them in a Docker sandbox.
- **Self-Correction:** If tests fail, the **Diagnostic Router** analyzes the error and triggers an agentic re-plan.

### 3. Safety & RLHF
- **Multi-Layered Guardrails:** Blast Radius (3-file limit), Confidence HITL Gates, and a Logical Critic.
- **Automated RLHF:** Captures human feedback in Slack and triggers serverless **DPO retraining** on RunPod.

---
## 🏗️ System Architecture
- **Orchestrator:** LangGraph state machine managing agent transitions.
- **Data Engine:** Airflow + Snowflake ETL; high-speed **Go** symbol indexing (Tree-sitter).
- **Knowledge Graph:** 300k+ node Neo4j instance for multi-hop historical reasoning.
- **Observability:** Prometheus + Grafana dashboards for latency and success-rate tracking.

*For full details, see [autobot_v9.md](./docs/autobot_v9.md).*
