"""End-to-end realization pipeline (context -> prompt -> parse)."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, List, Optional

from cleansql.config import settings
from cleansql.llm.planner import PlanSelector
from cleansql.llm.prompts import build_prompt, DQ_SYSTEM_PROMPT, BASELINE_SYSTEM_PROMPT
from cleansql.llm.vllm_client import VLLMClient
from cleansql.rag.client import HybridRetriever
from cleansql.utils.parsing import DualOutput, DualOutputParseError, parse_dual_output

LOGGER = logging.getLogger(__name__)


def _schema_to_text(schema: dict) -> str:
    parts = []
    for table in schema.get("tables", []):
        cols = ", ".join(f"{col['name']} {col['type']}" for col in table.get("columns", []))
        parts.append(f"{table['name']}: {cols}")
    return "\n".join(parts)


@dataclass
class RealizationResult:
    output: DualOutput
    raw_text: str
    rag_chunks: List[str]


class Realizer:
    def __init__(
        self,
        retriever: HybridRetriever | None = None,
        llm: VLLMClient | None = None,
        planner: PlanSelector | None = None,
    ) -> None:
        self.retriever = retriever
        self.llm = llm or VLLMClient()
        self.planner = planner or PlanSelector(self.llm)

    def _rag(self, question: str, db_id: str, tables: Iterable[str], columns: Iterable[str], topk: int, rerank: bool) -> List[str]:
        if topk <= 0 or not self.retriever:
            return []
        results = self.retriever.search(
            question,
            db_id=db_id,
            limit=topk,
            table_filter=tables,
            column_filter=columns,
            use_reranker=rerank,
        )
        return [r.text for r in results]

    def _temperature(self, technique: str) -> float:
        return {
            "baseline": 0.1,
            "fewshot": 0.15,
            "cot": 0.15,
            "sc": 0.2,
            "tot": 0.15,
        }.get(technique, settings.default_temperature)

    def _sample(self, prompt: str, system: str, temperature: float, attempts: int = 3) -> DualOutput:
        last_error: Exception | None = None
        for _ in range(attempts):
            text = self.llm.generate(prompt, system=system, temperature=temperature)
            try:
                return parse_dual_output(text)
            except DualOutputParseError as exc:
                LOGGER.warning("Parse failed: %s", exc)
                # Force print so it shows in Colab output
                print("\n===== RAW MODEL RESPONSE START =====\n")
                print(text)
                print("\n===== RAW MODEL RESPONSE END =====\n")
                last_error = exc
        raise last_error or RuntimeError("Unable to parse model response")

    def realize(
        self,
        question: str,
        schema: dict,
        db_id: str,
        *,
        technique: str = "baseline",
        rag_topk: int | None = None,
        rerank: bool = False,
        tables: Optional[Iterable[str]] = None,
        columns: Optional[Iterable[str]] = None,
    ) -> RealizationResult:
        tables = tables or []
        columns = columns or []
        rag_chunks = self._rag(question, db_id, tables, columns, topk=rag_topk or settings.rag_topk, rerank=rerank)
        schema_text = _schema_to_text(schema)
        plan_override = None
        # Choose system prompt: baseline runs are plain text-to-SQL, others enable DQ repairs.
        system_prompt = BASELINE_SYSTEM_PROMPT if technique == "baseline" else DQ_SYSTEM_PROMPT
        if technique == "tot":
            plan_override = self.planner.select(question, schema_text, rag_chunks)
        prompt = build_prompt(
            question,
            schema_text,
            rag_chunks,
            technique=technique if technique != "sc" else "cot",
            plan_override=plan_override,
        )
        if technique == "sc":
            best: DualOutput | None = None
            best_score = -1.0
            for _ in range(settings.sc_samples):
                candidate = self._sample(prompt, system_prompt, temperature=self._temperature("sc"))
                score = len(candidate.plan) + len(candidate.notes)
                if score > best_score:
                    best_score = score
                    best = candidate
            if best is None:
                raise RuntimeError("Self-consistency failed to return any candidate")
            return RealizationResult(output=best, raw_text="self_consistency", rag_chunks=rag_chunks)
        else:
            output = self._sample(prompt, system_prompt, temperature=self._temperature(technique))
            return RealizationResult(output=output, raw_text="single", rag_chunks=rag_chunks)
