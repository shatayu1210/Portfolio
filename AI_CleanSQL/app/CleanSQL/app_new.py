"""CleanSQL Streamlit App - Self-Consistency SQL Generation with Qdrant RAG."""
import html
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
import streamlit as st

from cleansql.config import settings
from cleansql.profiling.csv_profile import profile_csv
from cleansql.rag.build_index import build_index_from_profile
from cleansql.rag.client import HybridRetriever
from cleansql.llm.realization import Realizer
from cleansql.llm.vllm_client import VLLMClient

st.set_page_config(
    page_title="CleanSQL Assistant",
    page_icon="🧼",
    layout="wide",
)

# UI status (sidebar)
st.sidebar.caption(f"Model: Qwen-Coder 2.5 7B (fine-tuned)")
st.sidebar.caption(f"RAG: Qdrant (topK={settings.rag_topk})")
st.sidebar.caption(f"Prompt: Self-Consistency (N={settings.sc_samples})")

CUSTOM_PAGE_STYLE = """
<style>
:root {
    --bg-950: #020617;
    --bg-900: #0b1220;
    --bg-800: #111b2e;
    --bg-700: #1a2840;
    --text-100: #f8fafc;
    --text-200: #e2e8f0;
    --text-400: #cbd5f5;
    --text-muted: rgba(226, 232, 240, 0.7);
    --accent-sky: #38bdf8;
    --accent-indigo: #6366f1;
    --accent-indigo-dark: #4338ca;
    --pill-bg: rgba(99, 102, 241, 0.22);
    --pill-border: rgba(129, 140, 248, 0.3);
}

body {
    color: var(--text-200);
    background: var(--bg-900);
}

[data-testid="stAppViewContainer"] {
    background:
        radial-gradient(circle at 15% 20%, rgba(79, 70, 229, 0.18), transparent 55%),
        radial-gradient(circle at 85% 25%, rgba(14, 165, 233, 0.14), transparent 60%),
        var(--bg-900);
    color: var(--text-200);
}

[data-testid="stSidebar"] {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(17, 24, 39, 0.95));
    color: var(--text-200);
}

[data-testid="stAppViewContainer"] * {
    color: inherit;
}

[data-testid="stHeader"] {
    background: transparent;
}

.hero {
    padding: 2.75rem 3rem;
    border-radius: 1.4rem;
    background: linear-gradient(135deg, rgba(14, 23, 42, 0.95), rgba(79, 70, 229, 0.8));
    color: white;
    margin-bottom: 2rem;
    box-shadow: 0 28px 60px rgba(2, 6, 23, 0.45);
}

.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 999px;
    padding: 0.35rem 1.1rem;
    background: #048BCF;
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    margin-bottom: 0.75rem;
    color: rgba(255, 255, 255, 0.95);
}

.hero h1 {
    font-size: 2.6rem;
    font-weight: 700;
    margin-bottom: 0.65rem;
    color: var(--text-100);
}

.hero p {
    font-size: 1.06rem;
    max-width: 42rem;
    line-height: 1.65;
    color: rgba(241, 245, 249, 0.88);
}

.section-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.85rem;
    color: var(--text-100);
    letter-spacing: 0.01em;
}

.helper-text {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-top: 0.3rem;
}

.dataset-meta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
}

.dataset-meta .pill {
    background: var(--pill-bg);
    border: 1px solid var(--pill-border);
    border-radius: 999px;
    padding: 0.45rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-100);
}

div[data-testid="stAlert"] {
    border-radius: 1rem;
    box-shadow: 0 16px 35px rgba(2, 6, 23, 0.4);
    background: rgba(15, 23, 42, 0.85);
    color: var(--text-200);
}

[data-testid="stTextArea"] textarea {
    border-radius: 1rem !important;
    border: 1px solid rgba(99, 102, 241, 0.45) !important;
    box-shadow: none !important;
    font-size: 1rem;
    color: var(--text-100) !important;
    background: rgba(17, 24, 39, 0.85) !important;
}

[data-testid="stTextArea"] textarea:focus {
    border-color: rgba(99, 102, 241, 0.85) !important;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.35) !important;
}

.stButton>button, button[kind="primary"] {
    border-radius: 999px;
    padding: 0.7rem 1.9rem;
    background: linear-gradient(135deg, #1e40af, #3b82f6) !important;
    border: none !important;
    color: white !important;
    font-weight: 600;
    letter-spacing: 0.01em;
    box-shadow: 0 18px 32px rgba(14, 23, 42, 0.55);
}

.stButton>button:hover, button[kind="primary"]:hover {
    background: linear-gradient(135deg, #1e3a8a, #2563eb) !important;
    filter: brightness(1.1);
}

.stDataFrame {
    border-radius: 1rem;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.7);
}
</style>
"""

st.markdown(CUSTOM_PAGE_STYLE, unsafe_allow_html=True)


def format_bytes(num_bytes: int) -> str:
    """Return human readable string for byte count."""
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(num_bytes)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:,.1f} {unit}"
        value /= 1024
    return f"{value:,.1f} TB"


def render_dataset_summary(dataframe: pd.DataFrame, filename: Optional[str]) -> None:
    """Show dataset headline stats."""
    rows, cols = dataframe.shape
    memory = format_bytes(dataframe.memory_usage(deep=True).sum())
    with st.container():
        st.markdown(
            '<div class="section-title">Dataset overview</div>', unsafe_allow_html=True
        )
        st.markdown(
            f"<p><strong>{filename or 'Uploaded data'}</strong></p>",
            unsafe_allow_html=True,
        )
        st.markdown(
            f"""
            <div class="dataset-meta">
                <span class="pill">{rows:,} rows</span>
                <span class="pill">{cols:,} columns</span>
                <span class="pill">{memory}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )


def load_dataframe(uploaded_file) -> pd.DataFrame:
    """Return DataFrame for CSV or Excel uploads."""
    uploaded_file.seek(0)
    file_name = uploaded_file.name.lower()
    if file_name.endswith(".csv"):
        return pd.read_csv(uploaded_file)
    if file_name.endswith((".xlsx", ".xls")):
        return pd.read_excel(uploaded_file)
    raise ValueError("Unsupported file type. Upload a CSV or Excel file.")


def reset_state():
    """Clean up session state."""
    st.session_state.dataframe = None
    st.session_state.filename = None
    st.session_state.file_signature = None
    st.session_state.profile = None
    st.session_state.db_id = None
    st.session_state.query_ready = False
    st.session_state.prompt_input = ""
    st.session_state.last_question = None
    st.session_state.last_basic_sql = None
    st.session_state.last_robust_sql = None
    st.session_state.last_notes = []
    st.session_state.last_plan = []
    st.session_state.last_error = None
    st.session_state.is_running_query = False


def initialize_assistant(dataframe: pd.DataFrame, filename: str) -> Optional[str]:
    """Profile CSV and build Qdrant index."""
    reset_state()
    
    # Save to temp file
    fd, temp_path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    dataframe.to_csv(temp_path, index=False)
    
    try:
        # Profile CSV
        db_id = filename.replace(".", "_").replace(" ", "_")
        profile = profile_csv(Path(temp_path), table_name="data", db_id=db_id)
        print(f'✅ Profiled "{filename}"')
        
        # Build Qdrant index
        build_index_from_profile(profile)
        print(f'✅ Built Qdrant index for "{filename}"')
        
        st.session_state.dataframe = dataframe
        st.session_state.filename = filename
        st.session_state.profile = profile
        st.session_state.db_id = db_id
        st.session_state.query_ready = True
        st.session_state.last_error = None
        
        return None
    except Exception as exc:
        reset_state()
        return str(exc)
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass


# Initialize session state
DEFAULT_STATE: Dict[str, Any] = {
    "dataframe": None,
    "filename": None,
    "file_signature": None,
    "profile": None,
    "db_id": None,
    "query_ready": False,
    "prompt_input": "",
    "current_question": "",
    "is_running_query": False,
    "last_question": None,
    "last_basic_sql": None,
    "last_robust_sql": None,
    "last_notes": [],
    "last_plan": [],
    "last_error": None,
}

for key, value in DEFAULT_STATE.items():
    if key not in st.session_state:
        if isinstance(value, (list, dict)):
            st.session_state[key] = value.copy()
        else:
            st.session_state[key] = value


# Hero section
st.markdown(
    """
    <section class="hero">
        <span class="hero-badge">CleanSQL v2.0</span>
        <h1>Data-Quality-Aware SQL Generation</h1>
        <p>Upload your data and ask questions in natural language. Get BASIC and ROBUST SQL with quality notes.</p>
    </section>
    """,
    unsafe_allow_html=True,
)

upload_col, tips_col = st.columns([3, 2])

with upload_col:
    st.markdown("<h3>1. Upload your dataset</h3>", unsafe_allow_html=True)
    st.markdown(
        "<p>Select a CSV or Excel file to profile and explore.</p>",
        unsafe_allow_html=True,
    )
    uploaded_file = st.file_uploader(
        "Choose a CSV or Excel file",
        type=["csv", "xlsx", "xls"],
        label_visibility="collapsed",
    )
    st.markdown(
        '<div class="helper-text">Supports CSV, XLSX, or XLS files.</div>',
        unsafe_allow_html=True,
    )

with tips_col:
    st.markdown('<h3 style="display:inline; text-decoration:underline">Tips for best results</h3>', unsafe_allow_html=True)
    st.markdown(
        """
        <ul class="follow-up-list">
            <li>Keep column headers descriptive — they improve SQL context.</li>
            <li>Ask detailed questions to receive better SQL and analysis.</li>
            <li>ROBUST SQL includes data-quality repairs based on profiling.</li>
        </ul>
        """,
        unsafe_allow_html=True,
    )

upload_progress = st.empty()

# Handle file upload
if uploaded_file is None:
    if st.session_state.file_signature is not None:
        reset_state()
    upload_progress.empty()
else:
    signature = (uploaded_file.name, getattr(uploaded_file, "size", None))
    if st.session_state.file_signature != signature:
        try:
            progress_bar = upload_progress.progress(5, text="Profiling the uploaded file...")
            dataframe = load_dataframe(uploaded_file)
            progress_bar.progress(30, text="File profiled. Building RAG index...")
            st.session_state.file_signature = signature
            
            error_message = initialize_assistant(dataframe, uploaded_file.name)
            progress_bar.progress(80, text="Initializing assistant...")
            if error_message:
                st.session_state.last_error = error_message
            else:
                progress_bar.progress(100, text="Upload complete!")
                st.success("All set! Ask a question about your dataset.")
        except Exception as exc:
            reset_state()
            st.session_state.last_error = str(exc)
        finally:
            upload_progress.empty()
    else:
        upload_progress.empty()


if st.session_state.dataframe is None:
    st.markdown(
        '<div class="section-title">Awaiting data</div>'
        "<p>Upload a CSV or Excel file to profile your dataset and start asking questions.</p>",
        unsafe_allow_html=True,
    )
    if st.session_state.last_error:
        st.error(st.session_state.last_error)
    st.stop()

render_dataset_summary(st.session_state.dataframe, st.session_state.filename)

with st.container():
    st.markdown(
        '<div class="section-title">Uploaded data preview</div>', unsafe_allow_html=True
    )
    st.dataframe(st.session_state.dataframe.head(5), use_container_width=True)

st.markdown(
    '<div class="section-title">2. Ask anything about this dataset</div>',
    unsafe_allow_html=True,
)

# Initialize question input in session state if not exists
if "question_input" not in st.session_state:
    st.session_state.question_input = ""

# Use form to ensure input is captured before button click
with st.form(key="query_form", clear_on_submit=False):
    query_col, button_col = st.columns([3, 1])
    
    with query_col:
        question_input = st.text_area(
            "Natural language prompt",
            value=st.session_state.question_input,
            placeholder='Example: "What is the average revenue by category?"',
            disabled=(
                not st.session_state.query_ready or st.session_state.is_running_query
            ),
            height=160,
            label_visibility="collapsed",
            key="question_text"
        )
    
    with button_col:
        st.markdown("<h3>Generate SQL</h3>", unsafe_allow_html=True)
        button_label = "Running..." if st.session_state.is_running_query else "Generate"
        ask_button = st.form_submit_button(
            button_label,
            type="primary",
            disabled=(
                not st.session_state.query_ready or st.session_state.is_running_query
            ),
            use_container_width=True
        )

if ask_button:
    # Get question from the form input
    question = question_input.strip()
    
    if not question:
        st.session_state.is_running_query = False
        st.session_state.last_error = "Please enter a question before clicking Generate."
    else:
        # Store question in session state
        st.session_state.question_input = question
        st.session_state.current_question = question
        st.session_state.last_question = question
        
        # Clear previous results
        st.session_state.last_error = None
        st.session_state.last_basic_sql = None
        st.session_state.last_robust_sql = None
        st.session_state.last_notes = []
        st.session_state.last_plan = []
        st.session_state.is_running_query = True
        
        try:
            with st.spinner(f'Generating SQL with self-consistency ({settings.sc_samples} samples)...'):
                # Initialize components (use context manager to properly close Qdrant)
                from cleansql.rag.client import HybridRetriever
                from cleansql.llm.realization import Realizer
                from cleansql.llm.vllm_client import VLLMClient
                
                with HybridRetriever() as retriever:
                    llm = VLLMClient()
                    realizer = Realizer(retriever=retriever, llm=llm)
                    
                    # Generate SQL
                    result = realizer.realize(
                        question=question,
                        schema=st.session_state.profile,
                        db_id=st.session_state.db_id,
                        use_self_consistency=True,
                    )
                    
                    st.session_state.last_basic_sql = result.output.basic_sql
                    st.session_state.last_robust_sql = result.output.robust_sql
                    st.session_state.last_notes = result.output.notes
                    st.session_state.last_plan = result.output.plan
                    st.session_state.last_error = None
                
        except Exception as exc:
            st.session_state.last_error = str(exc)
            st.session_state.last_basic_sql = None
            st.session_state.last_robust_sql = None
            st.session_state.last_notes = []
            st.session_state.last_plan = []
        finally:
            st.session_state.is_running_query = False

# Display results
if st.session_state.last_error:
    st.error(st.session_state.last_error)

if st.session_state.last_plan:
    st.markdown('<div class="section-title">Plan</div>', unsafe_allow_html=True)
    for step in st.session_state.last_plan:
        st.markdown(f"- {step}")

if st.session_state.last_basic_sql:
    st.markdown('<div class="section-title">BASIC SQL</div>', unsafe_allow_html=True)
    st.code(st.session_state.last_basic_sql, language="sql")

if st.session_state.last_robust_sql:
    st.markdown('<div class="section-title">ROBUST SQL (with data quality repairs)</div>', unsafe_allow_html=True)
    st.code(st.session_state.last_robust_sql, language="sql")

if st.session_state.last_notes:
    st.markdown('<div class="section-title">Data Quality Notes</div>', unsafe_allow_html=True)
    for note in st.session_state.last_notes:
        st.markdown(f"- {note}")
