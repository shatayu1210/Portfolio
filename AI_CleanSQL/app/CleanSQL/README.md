# CleanSQL - Data-Quality-Aware SQL Generation

## What is This?

CleanSQL takes your messy CSV/Excel data and generates clean SQL queries from natural language questions. It automatically detects and fixes data quality issues like missing values, duplicates, and outliers.

**Example:**

You upload a sales CSV and ask: *"What's the average revenue by category?"*

CleanSQL gives you:
1. **PLAN** - Step-by-step reasoning about what it's doing
2. **BASIC_SQL** - Simple query assuming clean data
3. **ROBUST_SQL** - Smart query that handles missing values, outliers, duplicates
4. **Quality Notes** - Explains what data issues it fixed (e.g., "Capped 12 outliers at $120K")

## How It Works

```
Your CSV → Profile data → Build RAG index → Ask question → Get SQL
                ↓              ↓                ↓
         Find issues    Store in Qdrant    Fine-tuned Qwen
         (nulls, dups,   (hybrid search)    (self-consistency)
          outliers)                              ↓
                                          PLAN + BASIC + ROBUST + Notes
```

**Key Features:**
- **Self-Consistency Prompting** - Generates 3 answers, picks the best one
- **Hybrid RAG** - Dense + sparse vector search for better context
- **Data Quality Awareness** - Automatically detects and fixes issues
- **No Execution** - Just generates SQL (you run it yourself)

## What You Need

**For Colab (Recommended):**
- Google Colab Pro ($10/month) - for T4 GPU
- Your fine-tuned Qwen model in Google Drive (folder with safetensors, config.json, tokenizer files)
- ngrok account (free) - to access Streamlit UI

**For Local (M1 Mac):**
- M1/M2/M3 Mac with 16GB+ RAM
- llama.cpp (converts model to GGUF)
- Your fine-tuned Qwen model

## Quick Start

See **[SETUP.md](SETUP.md)** for detailed instructions.

### Colab (4 steps):
```python
# 1. Mount Google Drive
from google.colab import drive
drive.mount('/content/drive')
MODEL_PATH = "/content/drive/MyDrive/qwen-coder-finetuned"

# 2. Start vLLM server (model loads from Drive)
!python -m vllm.entrypoints.openai.api_server --model $MODEL_PATH

# 3. Start Streamlit with ngrok
!streamlit run app_new.py &
public_url = ngrok.connect(8501)

# 4. Click the URL and use the app!
```

### Local M1 Mac (3 steps):
```bash
# 1. Convert and quantize model
llama-quantize qwen-coder.gguf qwen-coder-q4.gguf Q4_K_M

# 2. Start llama.cpp server
llama-server --model qwen-coder-q4.gguf --port 8000

# 3. Start Streamlit
streamlit run app_new.py
```

## Architecture

**Components:**
- **Streamlit** - Web UI for uploading CSV and asking questions
- **CSV Profiler** - Analyzes your data (schema, nulls, outliers, duplicates)
- **Qdrant** - Vector database for RAG (stores data profiles)
- **Fine-tuned Qwen** - Generates SQL with data quality awareness
- **Self-Consistency** - Samples 3 times, picks best answer

**Tech Stack:**
- Python 3.10+
- Streamlit (frontend)
- vLLM or llama.cpp (inference)
- Qdrant (vector DB)
- BAAI/bge-m3 (embeddings)
- sqlglot (SQL parsing)

## Performance

**Colab Pro (T4 GPU):**
- Single query: 2-3 seconds
- Self-consistency (3 samples): 6-9 seconds
- Model: Full FP16 (15GB)

**M1 Mac (16GB RAM):**
- Single query: 5-10 seconds
- Self-consistency (3 samples): 15-30 seconds
- Model: Q4 quantized (4GB)

## Example Output

**Question:** "What's the average revenue by category?"

**PLAN:**
- Identify revenue column and category grouping
- Check revenue health (outliers at p95=$120K)
- Apply outlier capping
- Aggregate by category

**BASIC_SQL:**
```sql
SELECT category, AVG(revenue) AS avg_revenue
FROM data
GROUP BY category
ORDER BY avg_revenue DESC
```

**ROBUST_SQL:**
```sql
WITH capped AS (
  SELECT *, MIN(revenue, 120000.0) AS revenue_capped
  FROM data
)
SELECT category, AVG(revenue_capped) AS avg_revenue
FROM capped
GROUP BY category
ORDER BY avg_revenue DESC
```

**Quality Notes:**
- Capped 12 (0.6%) revenue outliers at p95=$120,000
- Ensured categories follow dictionary values

## Configuration

Edit `.env` file:

```bash
# Model server
VLLM_HOST=127.0.0.1
VLLM_PORT=8000

# RAG settings
CLEANSQL_RAG_TOPK=3              # Number of context chunks
CLEANSQL_ENABLE_RERANKER=false   # Cross-encoder reranking

# Self-consistency
CLEANSQL_SC_SAMPLES=3            # Number of samples (1-5)
CLEANSQL_TEMP=0.2                # Sampling temperature
```

## Project Structure

```
CleanSQL/
├── app_new.py                   # Streamlit frontend
├── cleansql/                    # Core package
│   ├── config.py               # Settings
│   ├── llm/                    # LLM clients
│   │   ├── vllm_client.py     # For Colab/Linux
│   │   ├── local_client.py    # For M1 Mac
│   │   ├── prompts.py         # System prompts
│   │   └── realization.py     # Self-consistency
│   ├── rag/                    # RAG retrieval
│   │   ├── client.py          # Qdrant hybrid search
│   │   ├── build_index.py     # Index builder
│   │   └── chunkers.py        # Profile chunking
│   ├── profiling/              # Data profiling
│   │   └── csv_profile.py     # CSV analyzer
│   └── utils/                  # Utilities
│       └── parsing.py         # Output parsing
├── requirements_new.txt        # Dependencies
├── .env.example               # Config template
├── README.md                  # This file
└── SETUP.md                   # Setup instructions
```

## Limitations

- **Single table only** - Can't join multiple CSVs
- **No SQL execution** - Just generates queries
- **Colab sessions timeout** - 12 hours max
- **M1 Mac is slower** - 3x slower than GPU

## Troubleshooting

**"vLLM server not starting"**
- Check GPU: `nvidia-smi` (Colab) or use llama.cpp (M1 Mac)

**"Out of memory"**
- Colab: Reduce `--gpu-memory-utilization 0.8`
- M1 Mac: Use Q4 quantization

**"Parsing errors"**
- Model output must have: PLAN, BASIC_SQL, ROBUST_SQL, NOTES
- Check vLLM logs for generation issues

**"Qdrant index errors"**
- Delete `work/qdrant_index/` and re-upload CSV

## License

MIT License

---

**Built with:** vLLM • Qdrant • Streamlit • BAAI/bge-m3 • Qwen-Coder
