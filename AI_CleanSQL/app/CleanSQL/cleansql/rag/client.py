"""Hybrid dense+sparse retrieval client for Qdrant."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from FlagEmbedding import BGEM3FlagModel, FlagReranker
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

from cleansql.config import settings


DENSE_NAME = "dense"
SPARSE_NAME = "sparse"
CLIENT_RRF_K = 60.0
OVERSAMPLE_FACTOR = 3


@dataclass
class RetrievalResult:
    text: str
    score: float
    payload: dict


def _model_fields(model: Any) -> Dict[str, Any]:
    """Pydantic v1/v2 compatibility."""
    return getattr(model, "model_fields", None) or getattr(model, "__fields__", None) or {}


class HybridRetriever:
    """Hybrid dense+sparse retrieval with optional reranking."""
    
    def __init__(
        self,
        index_dir: Path | None = None,
        embedding_model: str | None = None,
        reranker_model: str | None = None,
        enable_reranker: bool | None = None,
    ) -> None:
        self.index_dir = Path(index_dir or settings.qdrant_path)
        # Use prefer_grpc=False to ensure REST API is used (has .search method)
        self.client = QdrantClient(path=str(self.index_dir), prefer_grpc=False)
        self._collection_cache: Dict[str, str] = {}
        self._known_collections: List[str] = self._fetch_collections()

        model_name = embedding_model or settings.embed_model
        self.embedder = BGEM3FlagModel(model_name, use_fp16=True)

        reranker_name = reranker_model or settings.reranker_model
        self.reranker = (
            FlagReranker(reranker_name, use_fp16=True)
            if (enable_reranker or settings.enable_reranker)
            else None
        )
    
    def close(self):
        """Close the Qdrant client to release lock."""
        if hasattr(self, 'client') and self.client:
            try:
                # Close the client properly
                if hasattr(self.client, 'close'):
                    self.client.close()
            except:
                pass
            finally:
                # Force cleanup
                self.client = None
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False

    def _fetch_collections(self) -> List[str]:
        try:
            resp = self.client.get_collections()
            return [col.name for col in getattr(resp, "collections", [])]
        except Exception:
            return []

    def _collection(self, db_id: str) -> str:
        """Find collection name for db_id."""
        if db_id in self._collection_cache:
            return self._collection_cache[db_id]

        desired = f"{settings.qdrant_prefix}_{db_id}"
        if desired in self._known_collections:
            self._collection_cache[db_id] = desired
            return desired

        suffix = f"_{db_id}"
        for name in self._known_collections:
            if name.endswith(suffix):
                self._collection_cache[db_id] = name
                return name

        self._known_collections = self._fetch_collections()
        if desired in self._known_collections:
            self._collection_cache[db_id] = desired
            return desired
        for name in self._known_collections:
            if name.endswith(suffix):
                self._collection_cache[db_id] = name
                return name

        raise ValueError(
            f"No Qdrant collection for db '{db_id}'. Expected '{desired}'. "
            f"Available: {self._known_collections}"
        )

    def _encode_query(self, query: str) -> Tuple[list[float], rest.SparseVector]:
        """Encode query to dense and sparse vectors."""
        out = self.embedder.encode([query], return_dense=True, return_sparse=True)
        dense_vec = out["dense_vecs"][0]

        if "lexical_weights" in out:
            lw = out["lexical_weights"][0]
            sparse_vec = rest.SparseVector(indices=list(lw.keys()), values=list(lw.values()))
        else:
            sv = out["sparse_vecs"][0]
            sparse_vec = rest.SparseVector(indices=sv["indices"], values=sv["values"])
        return dense_vec, sparse_vec

    def _build_filter(
        self,
        db_id: str,
        table_filter: Optional[Iterable[str]],
        column_filter: Optional[Iterable[str]],
    ) -> rest.Filter:
        must: list[rest.Condition] = [
            rest.FieldCondition(key="db_id", match=rest.MatchValue(value=db_id))
        ]
        if table_filter:
            must.append(rest.FieldCondition(key="table", match=rest.MatchAny(any=list(table_filter))))
        if column_filter:
            must.append(rest.FieldCondition(key="column", match=rest.MatchAny(any=list(column_filter))))
        return rest.Filter(must=must)

    def _search_dense(self, collection: str, dense_vec: list[float], qfilter: rest.Filter, limit: int):
        """Dense vector search using query_points API."""
        cand = max(limit, OVERSAMPLE_FACTOR * limit)
        
        try:
            # query_points expects just the vector, not wrapped
            result = self.client.query_points(
                collection_name=collection,
                query=dense_vec,
                using=DENSE_NAME,
                query_filter=qfilter,
                with_payload=True,
                limit=cand,
            )
            return result.points if hasattr(result, 'points') else result
        except Exception as e:
            raise RuntimeError(f"Dense search failed: {e}")

    def _search_sparse(self, collection: str, sparse_vec: rest.SparseVector, qfilter: rest.Filter, limit: int):
        """Sparse vector search using query_points API."""
        cand = max(limit, OVERSAMPLE_FACTOR * limit)
        
        try:
            # query_points expects just the vector, not wrapped
            result = self.client.query_points(
                collection_name=collection,
                query=sparse_vec,
                using=SPARSE_NAME,
                query_filter=qfilter,
                with_payload=True,
                limit=cand,
            )
            return result.points if hasattr(result, 'points') else result
        except Exception as e:
            raise RuntimeError(f"Sparse search failed: {e}")

    def _client_side_rrf(
        self,
        collection: str,
        dense_vec: list[float],
        sparse_vec: rest.SparseVector,
        qfilter: rest.Filter,
        limit: int,
    ):
        """Client-side RRF fusion."""
        dense_res = self._search_dense(collection, dense_vec, qfilter, limit)
        sparse_res = self._search_sparse(collection, sparse_vec, qfilter, limit)

        def _points(seq_like):
            seq = getattr(seq_like, "result", seq_like)
            return getattr(seq, "points", seq)

        scores: dict[Any, float] = {}
        by_id: dict[Any, Any] = {}

        def _accumulate(results):
            pts = _points(results)
            for rank, p in enumerate(pts, start=1):
                pid = getattr(p, "id", getattr(p, "point_id", None))
                if pid is None:
                    pid = id(p)
                scores[pid] = scores.get(pid, 0.0) + 1.0 / (CLIENT_RRF_K + rank)
                by_id[pid] = p

        _accumulate(dense_res)
        _accumulate(sparse_res)

        top_ids = sorted(scores, key=scores.get, reverse=True)[:limit]
        return [by_id[i] for i in top_ids if i in by_id]

    def search(
        self,
        query: str,
        db_id: str,
        *,
        limit: int = 3,
        table_filter: Optional[Iterable[str]] = None,
        column_filter: Optional[Iterable[str]] = None,
        use_reranker: bool | None = None,
    ) -> List[RetrievalResult]:
        """Hybrid search with optional reranking."""
        dense_vec, sparse_vec = self._encode_query(query)
        qfilter = self._build_filter(db_id, table_filter, column_filter)
        collection = self._collection(db_id)

        points = self._client_side_rrf(collection, dense_vec, sparse_vec, qfilter, limit)

        results = [
            RetrievalResult(
                text=(getattr(pt, "payload", {}) or {}).get("text", ""),
                score=float(getattr(pt, "score", 0.0)),
                payload=getattr(pt, "payload", {}) or {},
            )
            for pt in (points or [])
        ]

        if (use_reranker or settings.enable_reranker) and self.reranker and len(results) > 1:
            scores = self.reranker.compute_score([query] * len(results), [r.text for r in results])
            for r, s in zip(results, scores):
                r.score = float(s)
            results.sort(key=lambda r: r.score, reverse=True)

        return results
