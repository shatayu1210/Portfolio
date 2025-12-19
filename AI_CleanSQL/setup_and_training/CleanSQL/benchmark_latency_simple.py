#!/usr/bin/env python3
"""Simple single-model latency benchmark."""
from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path
from typing import List

import pandas as pd
from tqdm import tqdm

from cleansql.llm.realization import Realizer
from cleansql.llm.vllm_client import VLLMClient
from cleansql.rag.client import HybridRetriever
from cleansql.utils.io import load_jsonl


def load_profiles(profile_dir: Path) -> dict:
    """Load all database profiles."""
    profiles = {}
    for path in profile_dir.glob("*.json"):
        data = json.loads(path.read_text())
        profiles[data["db_id"]] = data
    return profiles


def main(args: argparse.Namespace) -> None:
    """Benchmark a single model."""
    print("="*70)
    print(f"INFERENCE LATENCY BENCHMARK: {args.model_name}")
    print("="*70)
    
    # Load queries and profiles
    queries = load_jsonl(args.ids)
    profiles = load_profiles(Path(args.profile_dir))
    
    print(f"\nLoaded {len(queries)} queries")
    print(f"Loaded {len(profiles)} database profiles")
    print(f"Benchmarking {args.num_samples} queries with {args.num_runs} runs each")
    
    # Create realizer
    client = VLLMClient(host=args.host, port=args.port, timeout=300.0)
    retriever = HybridRetriever(index_dir=Path(args.index_dir)) if args.rag_topk > 0 else None
    realizer = Realizer(retriever=retriever, llm=client)
    
    # Sample queries
    sampled = queries[:args.num_samples] if len(queries) > args.num_samples else queries
    
    results = []
    all_latencies = []
    
    for item in tqdm(sampled, desc=f"Running {args.model_name}"):
        profile = profiles.get(item["db_id"])
        if not profile:
            continue
        
        latencies = []
        for run in range(args.num_runs):
            start = time.perf_counter()
            try:
                realizer.realize(
                    item["question"],
                    schema=profile,
                    db_id=item["db_id"],
                    technique=args.technique,
                    rag_topk=args.rag_topk,
                    rerank=False,
                )
                end = time.perf_counter()
                latencies.append(end - start)
            except Exception as e:
                print(f"\nError on {item.get('question_id', 'unknown')} (run {run+1}): {e}")
                continue
        
        if latencies:
            avg_latency = statistics.mean(latencies)
            min_latency = min(latencies)
            max_latency = max(latencies)
            all_latencies.extend(latencies)
            
            results.append({
                "question_id": item.get("question_id", "unknown"),
                "db_id": item["db_id"],
                "avg_latency": avg_latency,
                "min_latency": min_latency,
                "max_latency": max_latency,
                "std_latency": statistics.stdev(latencies) if len(latencies) > 1 else 0.0,
                "num_runs": len(latencies),
            })
    
    # Statistics
    if all_latencies:
        print(f"\n{'='*70}")
        print(f"{args.model_name} - Overall Statistics")
        print(f"{'='*70}")
        print(f"Total queries benchmarked: {len(results)}")
        print(f"Total inference calls: {len(all_latencies)}")
        print(f"\nLatency Statistics:")
        print(f"  Mean:   {statistics.mean(all_latencies):.3f}s")
        print(f"  Median: {statistics.median(all_latencies):.3f}s")
        print(f"  Min:    {min(all_latencies):.3f}s")
        print(f"  Max:    {max(all_latencies):.3f}s")
        if len(all_latencies) >= 2:
            print(f"  Std:    {statistics.stdev(all_latencies):.3f}s")
            # P95, P99
            sorted_latencies = sorted(all_latencies)
            p95_idx = int(len(sorted_latencies) * 0.95)
            p99_idx = int(len(sorted_latencies) * 0.99)
            p95_latency = sorted_latencies[p95_idx] if p95_idx < len(sorted_latencies) else sorted_latencies[-1]
            p99_latency = sorted_latencies[p99_idx] if p99_idx < len(sorted_latencies) else sorted_latencies[-1]
            print(f"  P95:    {p95_latency:.3f}s")
            print(f"  P99:    {p99_latency:.3f}s")
        
        # Throughput
        total_time = sum(all_latencies)
        throughput = len(all_latencies) / total_time if total_time > 0 else 0
        print(f"\nThroughput: {throughput:.2f} queries/second")
    
    # Save results
    df = pd.DataFrame(results)
    df.to_csv(args.output, index=False)
    print(f"\n✓ Detailed results saved to: {args.output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark inference latency for a single model")
    parser.add_argument("--ids", type=str, default="data/stage2_ids.jsonl", help="Query IDs file")
    parser.add_argument("--profile-dir", type=str, default="data/profiles", help="Profile directory")
    parser.add_argument("--index-dir", type=str, default="work/qdrant_index", help="RAG index directory")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="vLLM host")
    parser.add_argument("--port", type=int, default=8000, help="vLLM port")
    parser.add_argument("--model-name", type=str, default="Model", help="Model name for display")
    parser.add_argument("--num-samples", type=int, default=20, help="Number of queries to benchmark")
    parser.add_argument("--num-runs", type=int, default=3, help="Number of runs per query")
    parser.add_argument("--technique", type=str, default="sc", help="Inference technique")
    parser.add_argument("--rag-topk", type=int, default=5, help="RAG top-k")
    parser.add_argument("--output", type=str, default="results/latency_benchmark.csv", help="Output CSV file")
    
    main(parser.parse_args())

