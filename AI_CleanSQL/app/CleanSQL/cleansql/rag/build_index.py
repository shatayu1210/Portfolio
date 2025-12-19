"""Build Qdrant index from CSV profile."""
from __future__ import annotations

from pathlib import Path
from typing import List

from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

from cleansql.config import settings
from cleansql.rag import chunkers


DENSE_NAME = "dense"
SPARSE_NAME = "sparse"


def _sparse_vectors(outputs: dict) -> List[rest.SparseVector]:
    """Extract sparse vectors from BGEM3 output."""
    if "lexical_weights" in outputs:
        vecs = outputs["lexical_weights"]
        return [rest.SparseVector(indices=list(vec.keys()), values=list(vec.values())) for vec in vecs]
    if "sparse_vecs" in outputs:
        return [rest.SparseVector(indices=vec["indices"], values=vec["values"]) for vec in outputs["sparse_vecs"]]
    raise ValueError("BGEM3 output missing sparse vectors")


def build_collection(client: QdrantClient, collection: str, dim: int) -> None:
    """Create or recreate Qdrant collection with hybrid vectors."""
    client.recreate_collection(
        collection_name=collection,
        vectors_config={
            DENSE_NAME: rest.VectorParams(size=dim, distance=rest.Distance.COSINE),
        },
        sparse_vectors_config={
            SPARSE_NAME: rest.SparseVectorParams(index=rest.SparseIndexParams(on_disk=False))
        },
    )


def upsert_chunks(
    client: QdrantClient,
    collection: str,
    texts: List[str],
    payloads: List[dict],
    model: BGEM3FlagModel
) -> None:
    """Encode and upsert chunks to Qdrant."""
    outputs = model.encode(texts, batch_size=8, return_dense=True, return_sparse=True)
    dense_vecs = outputs["dense_vecs"]
    sparse_vecs = _sparse_vectors(outputs)

    client.upsert(
        collection_name=collection,
        points=rest.Batch(
            ids=list(range(1, len(texts) + 1)),
            payloads=payloads,
            vectors={
                DENSE_NAME: dense_vecs,
                SPARSE_NAME: sparse_vecs,
            },
        ),
    )


def build_index_from_profile(
    profile: dict,
    index_dir: Path | None = None,
    collection_name: str | None = None,
) -> None:
    """Build Qdrant index from a single profile dict.
    
    Args:
        profile: Profile dict from csv_profile.profile_csv()
        index_dir: Path to Qdrant storage (default: settings.qdrant_path)
        collection_name: Collection name (default: prefix_db_id)
    """
    index_dir = Path(index_dir or settings.qdrant_path)
    index_dir.mkdir(parents=True, exist_ok=True)
    
    client = QdrantClient(path=str(index_dir))
    model = BGEM3FlagModel(settings.embed_model, use_fp16=True)
    
    # Build chunks
    payloads = chunkers.build_chunk_payload(profile)
    texts = [p["text"] for p in payloads]
    
    if not texts:
        raise ValueError("No chunks generated from profile")
    
    # Get embedding dimension
    probe = model.encode(["probe"], return_dense=True, return_sparse=True)["dense_vecs"][0]
    dim = len(probe)
    
    # Create collection
    collection = collection_name or f"{settings.qdrant_prefix}_{profile['db_id']}"
    build_collection(client, collection, dim)
    
    # Upsert chunks
    upsert_chunks(client, collection, texts, payloads, model)
    
    print(f"✅ Indexed {len(texts)} chunks for collection '{collection}'")
