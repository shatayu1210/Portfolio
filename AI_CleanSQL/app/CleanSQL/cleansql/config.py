"""Global configuration for CleanSQL."""
from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field


class CleanSQLSettings(BaseSettings):
    """Configuration container using environment overrides."""

    project_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1])
    work_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1] / "work")

    # vLLM endpoint for Qwen model
    vllm_host: str = Field("127.0.0.1", env="VLLM_HOST")
    vllm_port: int = Field(8000, env="VLLM_PORT")
    vllm_timeout: float = Field(90.0, env="VLLM_TIMEOUT")
    vllm_model_path: str = Field("", env="VLLM_MODEL_PATH")  # Path to fine-tuned Qwen model

    # RAG retrieval defaults
    rag_topk: int = Field(3)
    enable_reranker: bool = Field(False)
    reranker_model: str = Field("BAAI/bge-reranker-v2-m3")

    # Embedding model for Qdrant
    embed_model: str = Field("BAAI/bge-m3")

    # Self-consistency prompting
    temp: float = Field(0.2)
    sc_samples: int = Field(3)

    # Qdrant configuration
    qdrant_path: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1] / "work" / "qdrant_index")
    qdrant_prefix: str = Field("cleansql_user")

    model_config = {
        "env_file": ".env",
        "env_prefix": "CLEANSQL_",
        "case_sensitive": False,
        "extra": "ignore"  # Ignore extra fields from .env
    }


settings = CleanSQLSettings()
