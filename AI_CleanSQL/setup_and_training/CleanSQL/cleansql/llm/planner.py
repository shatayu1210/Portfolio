"""Tree-of-Thought plan generator."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, List

from cleansql.config import settings
from cleansql.llm.prompts import SYSTEM_PROMPT
from cleansql.llm.vllm_client import VLLMClient

PLAN_PROMPT_SUFFIX = (
    "Generate PLAN bullets only (no SQL) that cover tables, joins, filters, "
    "and data-quality repairs."
)


@dataclass
class PlanCandidate:
    text: str
    score: float


class PlanSelector:
    def __init__(self, client: VLLMClient | None = None, branching: int | None = None) -> None:
        self.client = client or VLLMClient()
        self.branching = branching or settings.tot_branching

    def _prompt(self, question: str, schema: str, rag_summary: str) -> str:
        return "\n\n".join(
            [
                "# Schema",
                schema.strip(),
                "# RAG",
                rag_summary.strip(),
                "# Schema",
                "# Question",
                question.strip(),
                "Respond with PLAN bullets only.",
            ]
        )

    def propose(self, question: str, schema: str, rag_chunks: Iterable[str]) -> List[PlanCandidate]:
        rag_summary = "\n\n".join(list(rag_chunks)[:3])
        prompt = self._prompt(question, schema, rag_summary)
        candidates: List[PlanCandidate] = []
        for _ in range(self.branching):
            text = self.client.generate(
                prompt,
                system=SYSTEM_PROMPT + "\n\n" + PLAN_PROMPT_SUFFIX,
                temperature=0.3,
                max_tokens=256,
            )
            score = self.score_plan(text)
            candidates.append(PlanCandidate(text=text.strip(), score=score))
        return candidates

    def score_plan(self, plan_text: str) -> float:
        tokens = plan_text.lower()
        score = 0.0
        for keyword in ("fk", "join", "cte", "repair", "median", "p95", "dedupe", "unit", "dictionary"):
            if keyword in tokens:
                score += 1.0
        steps = len([line for line in plan_text.splitlines() if line.strip().startswith(('-','*'))])
        score += min(steps, 6) * 0.2
        return score

    def select(self, question: str, schema: str, rag_chunks: Iterable[str]) -> str:
        candidates = self.propose(question, schema, rag_chunks)
        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates[0].text
