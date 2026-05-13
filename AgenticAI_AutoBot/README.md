# AutoBot Dev Monorepo

This repository contains the end-to-end AutoBot pipeline for:
- collecting GitHub issue/PR data,
- building cleaned and time-sliced datasets,
- generating model labels/training artifacts,
- running model evaluation notebooks, and
- serving predictions in Slack.

## System Architecture & Overview

AutoBot is an agentic AI ecosystem designed to streamline open-source maintenance for high-scale repositories like Apache Airflow. By combining **GraphRAG-based reasoning** with a **temporal bottleneck detection engine**, AutoBot can autonomously identify engineering stalls, plan architectural fixes, and execute code patches within a sandboxed environment.

### Project Walkthrough

![System Overview](docs/images/AutoBot%201.jpg)
*System Overview and High-level Architecture*

![Data Pipeline](docs/images/AutoBot%202.jpg)
*Temporal Snapshotting & ETL Pipeline*

![Risk Scoring](docs/images/AutoBot%203.jpg)
*Hybrid Deterministic + AI Risk Scoring*

![GraphRAG Ingestion](docs/images/AutoBot%204.jpg)
*Neo4j Graph Construction and Relationship Mapping*

![Orchestration Loop](docs/images/AutoBot%205.jpg)
*Agentic Planning & ReAct Tool Loop*

![VS Code Integration](docs/images/AutoBot%206.jpg)
*Seamless Extension UI for Repository Analysis*

![Predictive Analytics](docs/images/AutoBot%207.jpg)
*Bottleneck Prediction & Dashboard Reporting*

## What This Repo Contains

| Path | Purpose | Typical use |
|------|---------|-------------|
| `etl/` | Airflow + Docker ETL from GitHub to Snowflake (extract, clean, snapshot) | Data ingestion and snapshot generation |
| `labelling/` | Label generation pipeline (`scorer`, `reasoner`, `planner`, `patcher`, `critic`) | Produce supervised training labels from snapshots |
| `training/` | Model training notebooks/scripts (`bottleneck_detector`, `patch_planner`) | Train and tune task-specific models |
| `evals/` | Evaluation notebooks for training runs and planner/critic outputs | Compare quality across runs |
| `slackbot/` | Slack app + tooling to query data and return bottleneck analysis | User-facing bot integration |
| `cli/` | Lightweight utility scripts and one-off data prep jobs | Local scripts for exports/indexing |
| `code_pipeline/` | Separate starter/lab project for multi-agent evaluation experiments | Reference/experimental pipeline |

## Data/Model Flow

1. `etl/` extracts and cleans GitHub data, then creates T+7/T+14 snapshots.
2. `labelling/` converts snapshots into model-specific labels.
3. `training/` uses labeled data to train bottleneck/planner components.
4. `evals/` tracks model quality and iteration results.
5. `slackbot/` consumes outputs for interactive predictions.

## Quickstart By Goal (AI IDE Friendly)

Use this section when onboarding a new teammate or prompting an AI IDE assistant to run specific pipelines.

### Goal A: Rebuild ETL training corpus (`issues_clean.jsonl`, `prs_clean.jsonl`)

1. **Set environment**
   - `cd etl`
   - copy template env if needed: `cp .env.example .env`
   - populate GitHub + Snowflake credentials
2. **Run extraction**
   - run Airflow DAG `full_extract` (see `etl/README.md`)
   - choose `sink_mode=local` (writes JSONL to `etl/extracted_data/`) or `sink_mode=snowflake`
3. **Consolidate and clean**
   - `python3 etl/clean_and_consolidate.py`
   - outputs written to `etl/training_data/`
4. **Validate outputs**
   - check these files exist:
     - `etl/training_data/issues_clean.jsonl`
     - `etl/training_data/prs_clean.jsonl`
     - `etl/training_data/cleaning_report.json`
5. **If extraction was interrupted**
   - fix checkpoint drift: `python3 etl/recover_missing_issues.py --apply`
   - or rebuild checkpoints: `python3 etl/rebuild_checkpoints.py`

Primary reference: `etl/README.md`

### Goal B: Load cleaned data into Snowflake

Use local loader when Airflow is unstable or for repeatable manual loads.

```bash
cd etl
python3 load_to_snowflake.py \
  --account <account> \
  --user <user> \
  --password '<password>' \
  --source cleaned \
  --mode both
```

Reference: `etl/load_to_snowflake.py` and `etl/README.md`

### Goal C: Stand up GraphRAG and ingest Neo4j graph

#### Prerequisites
- Cleaned JSONL data must exist in `etl/training_data/` (`issues_clean.jsonl`, `prs_clean.jsonl`).
- Docker must be running.

#### 1. Start Neo4j
```bash
cd graphrag && docker compose up -d
```
Neo4j Browser: `http://localhost:7474` (user: `neo4j`, password: `autobot_password`)

#### 2. Run ingestion
```bash
cd .. && python3 graphrag/ingest_graph_actual.py
```
The ingestion script runs **three sequential passes**:

| Pass | Function | What it writes |
|------|----------|----------------|
| 1 | `ingest_issues()` | `Issue` nodes + `RESOLVED_BY → PR` stubs |
| 2 | `ingest_prs()` | Full `PR` metadata + `TOUCHES → File` + `Review` nodes |
| 3 | `ingest_users_and_labels()` | `User` nodes + `Label` nodes + 7 new relationship types |

#### 3. Graph Schema

The fully ingested graph contains **6 node types** and **11 relationship types**:

**Nodes:** `Issue`, `PR`, `File`, `Review`, `User`, `Label`

**Relationships:**
```
(User)-[:REPORTED]->(Issue)-[:RESOLVED_BY]->(PR)-[:TOUCHES]->(File)
(User)-[:AUTHORED]----------------------------->(PR)<-[:REVIEWED]-(User)
(User)-[:MERGED]------------------------------>(PR)
(User)-[:COMMENTED_ON]---------------------->(Issue)
(Issue/PR)-[:HAS_LABEL]------------------->(Label)
(Review)-[:REVIEWED_IN]------------------>(PR)
(Review)-[:APPLIES_TO]------------------>(File)
```

#### 4. Memory configuration
The `graphrag/docker-compose.yml` is tuned for large-graph operations:
```
NEO4J_dbms_memory_heap_max__size=6G
NEO4J_dbms_memory_transaction_total_max=4G
```
If you see `MemoryPoolOutOfMemoryError`, restart the container before re-ingesting:
```bash
cd graphrag && docker compose down && docker compose up -d
```

#### 5. Verify the full graph in Neo4j Browser (`http://localhost:7474`)
```cypher
// Node counts by type
MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC;

// Relationship counts by type
MATCH ()-[r]->() RETURN type(r) AS rel, count(r) AS count ORDER BY count DESC;

// Full multi-hop: who fixed what bug and touched which files?
MATCH (u:User)-[:AUTHORED]->(p:PR)<-[:RESOLVED_BY]-(i:Issue)
MATCH (p)-[:TOUCHES]->(f:File)
RETURN u.login, p.number, i.title, collect(f.filename) LIMIT 10;
```

#### 6. (Optional) Add vector embeddings
```bash
python3 graphrag/vectorize_issues.py
```
Adds 384-dimensional `all-MiniLM-L6-v2` embeddings to `Issue` nodes for semantic similarity search.

Reference: `graphrag/README.md`

### Goal D: Rebuild tree-sitter index for planner retrieval

Rebuild when Airflow repo snapshot changes or when training data is refreshed and you want path/context alignment.

```bash
cd tree_sitter
python3 build_treesitter_index.py \
  --repo "/absolute/path/to/autobot_dev/tree_sitter/airflow" \
  --output "/absolute/path/to/autobot_dev/tree_sitter/treesitter_index.json"
```

Reference: `tree_sitter/README.md`

### Goal E: Generate patcher/planner training datasets

1. Ensure prerequisites:
   - cleaned ETL data in `etl/training_data/`
   - Neo4j running (if GraphRAG enabled)
   - tree-sitter index built for planner path-grounding
2. Run builders under `training/patch_*` (for example `patch_patcher/build_patcher_data.py`, `patch_planner/build_planner_data.py`)
3. Keep generated large artifacts in ignored local dirs; only commit scripts/docs/notebooks intended for collaboration.

### AI IDE prompt template (copy/paste)

Use this as a starting prompt for any assistant in Cursor/VS Code:

```text
You are helping with autobot_dev. First read README.md plus:
- etl/README.md
- graphrag/README.md
- tree_sitter/README.md

Goal: <replace with one goal above>.
Constraints:
- Do not commit secrets or large generated data.
- Prefer reproducible commands and explicit validation checks.
- After running steps, summarize outputs and next actions.
```

## Quick Start (Most Common Path)

### 1) Run ETL

1. `cd etl`
2. Copy template env: `cp .env.example .env`
3. Fill credentials and set Snowflake connection (`snowflake_default`)
4. Start services: `docker compose up -d`
5. Trigger DAGs in Airflow UI (extract -> clean -> snapshot)

### 2) Build labels

1. `cd labelling`
2. Install deps: `pip install -r requirements.txt`
3. Run examples:
   - `python label_pipeline.py --model scorer`
   - `python label_pipeline.py --model all --stats`

### 3) Train and evaluate

- Use notebooks under `training/` for model training
- Use notebooks under `evals/` for run comparison and quality checks

## ETL DAGs at a Glance

- `full_extract`: full GitHub issues/PR ingestion to Snowflake RAW tables
- `test_extract`: small smoke test extraction (useful before full runs)
- `clean_bot_issues`: legacy cleaner DAG (kept in history; current cleaning path is script-driven in `etl/clean_and_consolidate.py`)
- `snapshot_issues`: CLEANED -> PRELAB issue snapshots at T+7/T+14 (if enabled in your branch)

## Security Notes

- Never commit real secrets (`.env`, private keys, service account files, API tokens).
- Use `.env.example` as the only committed env template.
- If a key is ever exposed, rotate it immediately and clean history before public release.

## Repo Status

This is an active research/development monorepo. Some folders (for example `evals/` and parts of `code_pipeline/`) are exploratory and may change structure between runs.
