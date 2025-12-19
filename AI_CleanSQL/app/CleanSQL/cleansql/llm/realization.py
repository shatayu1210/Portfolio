"""Self-consistency SQL generation with RAG context."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from cleansql.config import settings
from cleansql.llm.prompts import build_prompt, DQ_SYSTEM_PROMPT
try:
    from cleansql.llm.vllm_client import VLLMClient
except ImportError:
    VLLMClient = None
try:
    from cleansql.llm.local_client import LocalLLMClient
except ImportError:
    LocalLLMClient = None
from cleansql.rag.client import HybridRetriever
from cleansql.utils.parsing import DualOutput, DualOutputParseError, parse_dual_output

LOGGER = logging.getLogger(__name__)


def _schema_to_text(schema: dict) -> str:
    """Convert schema dict to text format."""
    parts = []
    for table in schema.get("tables", []):
        cols = ", ".join(f"{col['name']} {col['type']}" for col in table.get("columns", []))
        parts.append(f"{table['name']}: {cols}")
    return "\n".join(parts)


@dataclass
class RealizationResult:
    """Result of SQL generation with self-consistency."""
    output: DualOutput
    rag_chunks: List[str]
    raw_text: str = ""


class Realizer:
    """Self-consistency SQL generator with RAG retrieval."""
    
    def __init__(
        self,
        retriever: HybridRetriever | None = None,
        llm = None,
    ) -> None:
        self.retriever = retriever
        # Auto-detect available client
        if llm is None:
            if LocalLLMClient is not None:
                self.llm = LocalLLMClient()
            elif VLLMClient is not None:
                self.llm = VLLMClient()
            else:
                raise RuntimeError("No LLM client available. Install vllm or use local_client.")
        else:
            self.llm = llm

    def _rag(self, question: str, db_id: str, topk: int) -> List[str]:
        """Retrieve relevant RAG chunks."""
        if topk <= 0 or not self.retriever:
            return []
        results = self.retriever.search(
            question,
            db_id=db_id,
            limit=topk,
            use_reranker=settings.enable_reranker,
        )
        return [r.text for r in results]

    def _sample(self, prompt: str, system: str, temperature: float, attempts: int = 3) -> DualOutput:
        """Sample from model with retry on parse failure."""
        last_error: Exception | None = None
        for attempt in range(attempts):
            text = self.llm.generate(prompt, system=system, temperature=temperature)
            try:
                return parse_dual_output(text)
            except DualOutputParseError as exc:
                LOGGER.warning(f"Parse failed (attempt {attempt+1}/{attempts}): {exc}")
                print(f"\n===== RAW MODEL RESPONSE (attempt {attempt+1}) =====\n{text}\n===== END =====\n")
                last_error = exc
        raise last_error or RuntimeError("Unable to parse model response after retries")

    def realize(
        self,
        question: str,
        schema: dict,
        db_id: str,
        *,
        use_self_consistency: bool = True,
        rag_topk: int | None = None,
    ) -> RealizationResult:
        """Generate SQL with self-consistency (3 samples, pick best by plan+notes length).
        
        Args:
            question: Natural language question
            schema: Database schema dict with tables/columns
            db_id: Database identifier for RAG retrieval
            use_self_consistency: If True, sample 3 times and pick best; else single sample
            rag_topk: Number of RAG chunks to retrieve (default: settings.rag_topk)
        
        Returns:
            RealizationResult with best DualOutput and RAG chunks
        """
        topk = rag_topk if rag_topk is not None else settings.rag_topk
        rag_chunks = self._rag(question, db_id, topk=topk)
        schema_text = _schema_to_text(schema)
        
        prompt = build_prompt(
            question,
            schema_text,
            rag_chunks,
            include_fewshot=False,  # Fewshot examples in RAG chunks if needed
        )
        
        if use_self_consistency:
            # Self-consistency: sample N times, pick best by plan+notes length
            best: DualOutput | None = None
            best_score = -1.0
            for i in range(settings.sc_samples):
                LOGGER.info(f"Self-consistency sample {i+1}/{settings.sc_samples}")
                candidate = self._sample(prompt, DQ_SYSTEM_PROMPT, temperature=settings.temp)
                # Score by plan detail + notes detail (more detailed = better)
                score = len(candidate.plan) + len(candidate.notes)
                if score > best_score:
                    best_score = score
                    best = candidate
            
            if best is None:
                raise RuntimeError("Self-consistency failed to return any candidate")
            
            return RealizationResult(output=best, rag_chunks=rag_chunks, raw_text="self_consistency")
        else:
            # Single sample
            output = self._sample(prompt, DQ_SYSTEM_PROMPT, temperature=settings.temp)
            return RealizationResult(output=output, rag_chunks=rag_chunks, raw_text="single")
