"""Global configuration for CleanSQL."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

from pathlib import Path


class CleanSQLSettings(BaseSettings):
    """Configuration container using environment overrides."""

    project_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1])
    data_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1] / "data")
    work_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1] / "work")
    results_root: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1] / "results")

    # vLLM endpoint
    vllm_host: str = Field("127.0.0.1", env="VLLM_HOST")
    vllm_port: int = Field(8000, env="VLLM_PORT")
    vllm_timeout: float = Field(90.0, env="VLLM_TIMEOUT")

    # Retrieval defaults
    rag_topk: int = Field(3, env="CLEANSQl_RAG_TOPK")
    rag_topk_stage2: int = Field(8, env="CLEANSQl_RAG_TOPK_STAGE2")
    reranker_model: str = Field("BAAI/bge-reranker-v2-mini", env="CLEANSQl_RERANKER")
    enable_reranker: bool = Field(False, env="CLEANSQl_ENABLE_RERANKER")

    # Embedding models
    embedding_model: str = Field("BAAI/bge-m3", env="CLEANSQl_EMBED_MODEL")

    # Prompt toggles
    default_temperature: float = Field(0.2, env="CLEANSQl_TEMP")
    sc_samples: int = Field(3, env="CLEANSQl_SC_SAMPLES")
    tot_branching: int = Field(3, env="CLEANSQl_TOT_B")

    qdrant_path: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1] / "work" / "qdrant_index")
    qdrant_collection_prefix: str = Field("cleansql", env="CLEANSQl_QDRANT_PREFIX")

    class Config:
        env_file = ".env"
        env_prefix = "CLEANSQl_"
        case_sensitive = False


settings = CleanSQLSettings()
