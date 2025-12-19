"""Generate SFT training data from Stage 2 results or create synthetic examples."""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Dict, List

from cleansql.llm.prompts import DQ_SYSTEM_PROMPT, build_prompt
from cleansql.llm.realization import Realizer
from cleansql.rag.client import HybridRetriever
from cleansql.utils.io import load_jsonl, setup_logging

LOGGER = logging.getLogger(__name__)


def load_profiles(profile_dir: Path) -> Dict[str, dict]:
    """Load all database profiles."""
    profiles = {}
    for path in profile_dir.glob("*.json"):
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            profiles[data["db_id"]] = data
    return profiles


def schema_to_text(schema: dict) -> str:
    """Convert schema dict to text format."""
    parts = []
    for table in schema.get("tables", []):
        cols = ", ".join(f"{col['name']} {col['type']}" for col in table.get("columns", []))
        parts.append(f"{table['name']}: {cols}")
    return "\n".join(parts)


def format_ideal_response(plan: List[str], basic_sql: str, robust_sql: str, notes: List[str]) -> str:
    """Format the ideal 4-section CleanSQL response."""
    plan_text = "\n".join(f"- {step}" for step in plan)
    notes_text = "\n".join(f"{i+1}. {note}" for i, note in enumerate(notes)) if notes else "No quality-repairs required."
    
    return f"""PLAN:
{plan_text}

BASIC_SQL:
```sql
{basic_sql}
```

ROBUST_SQL:
```sql
{robust_sql}
```

NOTES:
{notes_text}"""


def generate_from_stage2_results(
    stage2_results: Path,
    stage2_ids: Path,
    profiles: Dict[str, dict],
    retriever: HybridRetriever,
    output_path: Path,
    max_examples: int = 500,
) -> None:
    """Generate training examples from existing Stage 2 results."""
    import pandas as pd
    
    # Load Stage 2 results (has SQL outputs)
    df = pd.read_csv(stage2_results)
    
    # Load Stage 2 IDs (has questions)
    id_map = {}
    if stage2_ids and stage2_ids.exists():
        for item in load_jsonl(stage2_ids):
            id_map[item["question_id"]] = item
    
    realizer = Realizer(retriever=retriever)
    examples = []
    
    for idx, row in df.iterrows():
        if len(examples) >= max_examples:
            break
            
        db_id = row["db_id"]
        question_id = row.get("question_id", f"stage2_{idx}")
        
        # Get question from ID map or try to extract from row
        question = ""
        if question_id in id_map:
            question = id_map[question_id].get("question", "")
        if not question:
            # Try to get from row (some CSVs might have it)
            question = row.get("question", "")
        if not question:
            LOGGER.warning("No question found for %s, skipping", question_id)
            continue
            
        profile = profiles.get(db_id)
        if not profile:
            LOGGER.warning("Missing profile for %s", db_id)
            continue
        
        # Get RAG chunks (same as during evaluation)
        try:
            result = realizer.realize(
                question,
                schema=profile,
                db_id=db_id,
                technique="sc",  # Use SC as it's the best technique
                rag_topk=5,
                rerank=False,
            )
        except Exception as exc:
            LOGGER.warning("Failed to realize %s: %s", question, exc)
            continue
        
        # Build the user prompt (same as during inference)
        schema_text = schema_to_text(profile)
        rag_chunks = result.rag_chunks
        user_prompt = build_prompt(
            question,
            schema_text,
            rag_chunks,
            technique="sc",
        )
        
        # Use the actual output as the ideal response (or you can refine it)
        ideal_response = format_ideal_response(
            result.output.plan,
            result.output.basic_sql,
            result.output.robust_sql,
            result.output.notes,
        )
        
        examples.append({
            "messages": [
                {"role": "system", "content": DQ_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": ideal_response},
            ]
        })
    
    # Write to JSONL
    with output_path.open("w", encoding="utf-8") as f:
        for ex in examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
    
    LOGGER.info("Generated %d training examples to %s", len(examples), output_path)


def generate_synthetic_examples(
    stage2_ids: Path,
    profiles: Dict[str, dict],
    retriever: HybridRetriever,
    output_path: Path,
    num_examples: int = 300,
) -> None:
    """Generate synthetic training examples using GPT-4 or similar."""
    # This would call GPT-4 to generate ideal responses
    # For now, we'll use the stage2 results approach
    LOGGER.warning("Synthetic generation not implemented. Use generate_from_stage2_results instead.")
    pass


def main(args: argparse.Namespace) -> None:
    setup_logging()
    profiles = load_profiles(Path(args.profile_dir))
    retriever = HybridRetriever(index_dir=Path(args.index_dir)) if args.index_dir else None
    
    if args.mode == "from_results":
        if not args.stage2_results:
            raise ValueError("--stage2-results required for 'from_results' mode")
        stage2_ids = Path(args.stage2_ids) if args.stage2_ids else None
        generate_from_stage2_results(
            Path(args.stage2_results),
            stage2_ids,
            profiles,
            retriever,
            Path(args.output),
            max_examples=args.max_examples,
        )
    elif args.mode == "synthetic":
        if not args.stage2_ids:
            raise ValueError("--stage2-ids required for 'synthetic' mode")
        generate_synthetic_examples(
            Path(args.stage2_ids),
            profiles,
            retriever,
            Path(args.output),
            num_examples=args.max_examples,
        )
    else:
        raise ValueError(f"Unknown mode: {args.mode}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate SFT training data")
    parser.add_argument("--mode", choices=["from_results", "synthetic"], required=True)
    parser.add_argument("--output", required=True, help="Output JSONL file path")
    parser.add_argument("--profile-dir", required=True)
    parser.add_argument("--index-dir", help="Qdrant index directory (for RAG)")
    parser.add_argument("--stage2-results", help="Stage 2 results CSV (for from_results mode)")
    parser.add_argument("--stage2-ids", help="Stage 2 IDs JSONL (for question lookup)")
    parser.add_argument("--max-examples", type=int, default=500)
    main(parser.parse_args())

