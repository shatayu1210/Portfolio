"""Build Qdrant embedded index from profiling payloads."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable, List

from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

from cleansql.config import settings
from cleansql.rag import chunkers
from cleansql.utils.io import ensure_dir


def iter_profiles(profiles_dir: Path) -> Iterable[dict]:
    for path in sorted(profiles_dir.glob("*.json")):
        with path.open("r", encoding="utf-8") as f:
            yield json.load(f)


def build_collection(client: QdrantClient, collection: str, dim: int) -> None:
    client.recreate_collection(
        collection_name=collection,
        vectors_config={
            "dense": rest.VectorParams(size=dim, distance=rest.Distance.COSINE),
        },
        sparse_vectors_config={
            "sparse": rest.SparseVectorParams(index=rest.SparseIndexParams(on_disk=False))
        },
    )


def _sparse_vectors(outputs: dict) -> List[rest.SparseVector]:
    if "lexical_weights" in outputs:
        vecs = outputs["lexical_weights"]
        return [rest.SparseVector(indices=list(vec.keys()), values=list(vec.values())) for vec in vecs]
    if "sparse_vecs" in outputs:
        return [rest.SparseVector(indices=vec["indices"], values=vec["values"]) for vec in outputs["sparse_vecs"]]
    raise ValueError("BGEM3 output missing sparse vectors")


def upsert_chunks(client: QdrantClient, collection: str, texts: List[str], payloads: List[dict], model: BGEM3FlagModel) -> None:
    outputs = model.encode(texts, batch_size=8, return_dense=True, return_sparse=True)
    dense_vecs = outputs["dense_vecs"]
    sparse_vecs = _sparse_vectors(outputs)

    client.upsert(
        collection_name=collection,
        points=rest.Batch(
            ids=list(range(1, len(texts) + 1)),
            payloads=payloads,
            vectors={
                "dense": dense_vecs,
                "sparse": sparse_vecs,
            },
        ),
    )


def main(args: argparse.Namespace) -> None:
    profiles_dir = Path(args.profiles)
    ensure_dir(args.index_dir)
    client = QdrantClient(path=str(args.index_dir))

    model = BGEM3FlagModel(settings.embedding_model, use_fp16=True)

    probe = model.encode(["probe"], return_dense=True, return_sparse=True)["dense_vecs"][0]
    for profile in iter_profiles(profiles_dir):
        payloads = chunkers.build_chunk_payload(profile)
        texts = [p["text"] for p in payloads]
        collection = f"{args.collection_prefix}_{profile['db_id']}"
        if not texts:
            continue
        build_collection(client, collection, dim=len(probe))
        upsert_chunks(client, collection, texts, payloads, model)
        print(f"Indexed {len(texts)} chunks for {collection}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Qdrant embedded index")
    parser.add_argument("--profiles", type=Path, required=True)
    parser.add_argument("--index-dir", type=Path, required=True)
    parser.add_argument("--collection-prefix", type=str, default=settings.qdrant_collection_prefix)
    args = parser.parse_args()
    main(args)
