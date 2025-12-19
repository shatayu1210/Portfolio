# CleanSQL Project Structure

## Clean Directory Structure

```
CleanSQL/
├── README.md                      # What CleanSQL does
├── SETUP.md                       # How to run it (Colab or M1 Mac)
├── app_new.py                     # Streamlit frontend
├── requirements_new.txt           # Python dependencies
├── .env.example                   # Configuration template
├── .env                          # Your configuration (gitignored)
├── .gitignore                    # Git ignore rules
├── quickstart.sh                 # Quick start script (for local)
│
├── cleansql/                     # Core package
│   ├── __init__.py
│   ├── config.py                # Settings (Pydantic)
│   │
│   ├── llm/                     # LLM clients
│   │   ├── __init__.py
│   │   ├── vllm_client.py      # For Colab/Linux (CUDA)
│   │   ├── local_client.py     # For M1 Mac (Metal)
│   │   ├── prompts.py          # System prompts
│   │   └── realization.py      # Self-consistency SQL generation
│   │
│   ├── rag/                     # RAG retrieval
│   │   ├── __init__.py
│   │   ├── client.py           # Qdrant hybrid search
│   │   ├── build_index.py      # Index builder
│   │   └── chunkers.py         # Profile → RAG chunks
│   │
│   ├── profiling/               # Data profiling
│   │   ├── __init__.py
│   │   └── csv_profile.py      # CSV analyzer
│   │
│   └── utils/                   # Utilities
│       ├── __init__.py
│       └── parsing.py          # Output parsing
│
├── .streamlit/                  # Streamlit config
│   └── config.toml             # UI theme/settings
│
└── scripts/                     # Helper scripts
    └── serve_vllm.sh           # vLLM server startup (Linux)
```

## What Each File Does

### Root Files

**README.md**
- What CleanSQL does
- How it works
- Example output
- Quick start guide

**SETUP.md**
- Complete setup instructions
- Option 1: Google Colab Pro (recommended)
- Option 2: M1 Mac (local)
- Troubleshooting

**app_new.py**
- Streamlit web UI
- CSV/Excel upload
- Question input
- SQL output display

**requirements_new.txt**
- Python dependencies
- Install with: `pip install -r requirements_new.txt`

**.env.example**
- Configuration template
- Copy to `.env` and customize

**.env**
- Your actual configuration
- Not committed to git

**quickstart.sh**
- Quick start script for local setup
- Not used for Colab

### Core Package (cleansql/)

**config.py**
- Centralized settings using Pydantic
- Environment variable overrides
- Default values

**llm/vllm_client.py**
- vLLM API client for Colab/Linux
- OpenAI-compatible interface
- Used with CUDA GPUs

**llm/local_client.py**
- Local LLM client for M1 Mac
- Works with llama.cpp or Ollama
- Auto-detects server type

**llm/prompts.py**
- System prompts (DQ_SYSTEM_PROMPT)
- Prompt builder
- Few-shot examples

**llm/realization.py**
- Self-consistency SQL generation
- Samples 3 times, picks best
- Integrates RAG retrieval

**rag/client.py**
- Qdrant hybrid retrieval
- Dense + sparse vectors
- RRF fusion
- Optional reranking

**rag/build_index.py**
- Builds Qdrant index from profile
- Encodes with BAAI/bge-m3
- Stores in work/qdrant_index/

**rag/chunkers.py**
- Chunks profile into 4 libraries:
  1. Structure (schema/DDL)
  2. HealthRules (metrics + repairs)
  3. ValuesUnits (dictionaries)
  4. Exemplars (SQL patterns)

**profiling/csv_profile.py**
- Profiles CSV/Excel files
- Extracts schema
- Computes health metrics
- Builds dictionaries
- Generates exemplars

**utils/parsing.py**
- Parses model output
- Extracts PLAN/BASIC_SQL/ROBUST_SQL/NOTES
- Validates SQL with sqlglot

### Generated at Runtime

**work/** (created automatically)
- `qdrant_index/` - Vector database storage
- Created when you upload first CSV

## Files Removed (Old Setup)

### Deleted Files
- ❌ `app.py` - Old Streamlit app (replaced by app_new.py)
- ❌ `llm_integration.py` - Old Claude integration
- ❌ `profiler.py` - Old Weaviate profiling
- ❌ `local_llm.py` - Old Ollama integration
- ❌ `data_assistant.py` - Old CLI entry point
- ❌ `batch_eval.py` - Evaluation scripts
- ❌ `eval_questions.py` - Evaluation scripts
- ❌ `test_llm_integration.py` - Old tests
- ❌ `duckdb_categorical_counts.py` - DuckDB utilities
- ❌ `requirements.txt` - Old dependencies
- ❌ `docker-compose.yml` - Docker config
- ❌ `EVAL_README.md` - Evaluation docs

### Deleted Folders
- ❌ `data/` - Sample CSV files (not needed)
- ❌ `data_assistant/` - Old CLI package
- ❌ `eval_results/` - Evaluation results
- ❌ `test_output/` - Test outputs
- ❌ `test_output_enhanced/` - Test outputs
- ❌ `test_output_final/` - Test outputs
- ❌ `.vscode/` - VS Code settings

## What You Need

### For Colab Demo
```
CleanSQL/
├── README.md
├── SETUP.md
├── app_new.py
├── requirements_new.txt
├── .env.example
└── cleansql/ (entire package)
```

### For M1 Mac
```
CleanSQL/
├── README.md
├── SETUP.md
├── app_new.py
├── requirements_new.txt
├── .env.example
├── quickstart.sh
└── cleansql/ (entire package)
```

## Installation

### Colab
```python
# Upload CleanSQL.zip to Colab
!unzip CleanSQL.zip
%cd CleanSQL
!pip install -r requirements_new.txt
```

### M1 Mac
```bash
cd CleanSQL
pip install -r requirements_new.txt
```

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
# For Colab (vLLM)
VLLM_HOST=127.0.0.1
VLLM_PORT=8000

# For M1 Mac (llama.cpp)
VLLM_HOST=127.0.0.1
VLLM_PORT=8000

# RAG settings
CLEANSQL_RAG_TOPK=3
CLEANSQL_SC_SAMPLES=3
```

## Summary

**Total files:** ~25 (down from ~50+)
**Total folders:** 7 (down from ~15+)
**Clean structure:** ✅
**Ready for demo:** ✅
