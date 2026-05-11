# AutoBot Observability Setup Guide

This guide walks you through setting up the Prometheus, Loki, and Grafana stack to monitor the AutoBot agentic workflows.

## 1. Accessing Grafana
- **URL:** `http://localhost:3000`
- **Default Username:** `admin`
- **Default Password:** `autobot_grafana` (or as defined in your `.env`)

---

## 2. Connecting Data Sources

### Prometheus (Metrics)
1. Navigate to **Connections** -> **Data Sources** in the sidebar.
2. Click **Add data source** and select **Prometheus**.
3. **URL:** `http://autobot_prometheus:9090`
4. Click **Save & Test**.

### Loki (Logs)
1. Navigate to **Connections** -> **Data Sources**.
2. Click **Add data source** and select **Loki**.
3. **URL:** `http://autobot_loki:3100`
4. Click **Save & Test**.

---

## 3. Centralized Log Sink (Loki + Promtail)
The system uses **Promtail** to automatically discover and scrape logs from all Docker containers. 
- It reads logs from `/var/lib/docker/containers` on the host.
- It attaches a `container_name` label to every log line.
- Logs are queryable in Grafana via the **Explore** tab using: `{container_name="autobot_orchestrator"}`.

---

## 4. Impactful Dashboard Panels
Create a new dashboard and add the following five panels for a comprehensive view of AutoBot performance.

### Panel A: Agentic Success Rate
- **Data Source:** Prometheus
- **Query:** `autobot_patch_success_total / autobot_plan_requests_total`
- **Visualization:** **Gauge**
- **Unit:** `Misc / Percent (0.0-1.0)`
- **Thresholds:** Green (80), Yellow (50), Red (0)

### Panel B: Plan Refinement Depth
- **Data Source:** Prometheus
- **Query:** `sum by (le) (rate(autobot_refinement_iterations_bucket[15m]))`
- **Visualization:** **Bar Chart**
- **Description:** Tracks how many iterations the Planner needs before the Critic approves the plan.

### Panel C: Sandbox Failure Breakdown
- **Data Source:** Prometheus
- **Query:** `sum by (reason) (autobot_patch_failure_total)`
- **Visualization:** **Pie Chart**
- **Legend:** Set Mode to `Table` and show `Value`.
- **Reasons Tracked:** `patch_apply_failed`, `typescript_failed`, `eslint_failed`, `test_failed`.

### Panel D: GraphRAG Candidate Density
- **Data Source:** Prometheus
- **Query:** `autobot_graphrag_candidates_count`
- **Visualization:** **Time Series**
- **Description:** Monitors the number of files Neo4j identifies as relevant for each issue.

### Panel E: Live Trace Stream
- **Data Source:** Loki
- **Query:** `{container_name="autobot_orchestrator"}`
- **Visualization:** **Logs**
- **Description:** Real-time scrolling feed of Planner/Critic/Patcher logic.
