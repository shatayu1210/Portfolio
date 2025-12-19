"""Hybrid dense+sparse retrieval client for Qdrant (version-adaptive).

- Tries server-side fusion via Query API (RRF). If not supported in your
  qdrant-client build, falls back to two searches + client-side RRF(k=60).
- Compatible with qdrant-client >=1.8.0,<1.15.0 (your pin).
- Assumes the collection stores two named vectors: "dense" and "sparse".
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple, Any, Dict

from FlagEmbedding import BGEM3FlagModel, FlagReranker
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

from cleansql.config import settings


DENSE_NAME = "dense"
SPARSE_NAME = "sparse"
CLIENT_RRF_K = 60.0
OVERSAMPLE_FACTOR = 3  # fetch 3×limit per branch


@dataclass
class RetrievalResult:
    text: str
    score: float
    payload: dict


def _model_fields(model: Any) -> Dict[str, Any]:
    # pydantic v1/v2 compatibility
    return getattr(model, "model_fields", None) or getattr(model, "__fields__", None) or {}


class HybridRetriever:
    def __init__(
        self,
        index_dir: Path | None = None,
        embedding_model: str | None = None,
        reranker_model: str | None = None,
        enable_reranker: bool | None = None,
    ) -> None:
        # Embedded Qdrant DB path
        self.index_dir = Path(index_dir or settings.qdrant_path)
        self.client = QdrantClient(path=str(self.index_dir))
        self._collection_cache: Dict[str, str] = {}
        self._known_collections: List[str] = self._fetch_collections()

        # Embedding and optional reranker
        model_name = embedding_model or settings.embedding_model
        self.embedder = BGEM3FlagModel(model_name, use_fp16=True)

        reranker_name = reranker_model or settings.reranker_model
        self.reranker = (
            FlagReranker(reranker_name, use_fp16=True)
            if (enable_reranker or settings.enable_reranker)
            else None
        )

    def _fetch_collections(self) -> List[str]:
        try:
            resp = self.client.get_collections()
            return [col.name for col in getattr(resp, "collections", [])]
        except Exception:
            return []

    def _collection(self, db_id: str) -> str:
        if db_id in self._collection_cache:
            return self._collection_cache[db_id]

        # Try configured prefix first
        desired = f"{settings.qdrant_collection_prefix}_{db_id}"
        if desired in self._known_collections:
            self._collection_cache[db_id] = desired
            return desired

        # Fallback: match any collection that ends with _{db_id}
        suffix = f"_{db_id}"
        for name in self._known_collections:
            if name.endswith(suffix):
                self._collection_cache[db_id] = name
                return name

        # Refresh list once and retry
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
            f"Available collections: {self._known_collections}"
        )

    def _encode_query(self, query: str) -> Tuple[list[float], rest.SparseVector]:
        """
        Returns (dense_vec, sparse_vec). Handles FlagEmbedding outputs that may use
        'lexical_weights' or 'sparse_vecs'.
        """
        out = self.embedder.encode([query], return_dense=True, return_sparse=True)
        dense_vec = out["dense_vecs"][0]

        if "lexical_weights" in out:
            # dict[token_id] -> weight
            lw = out["lexical_weights"][0]
            sparse_vec = rest.SparseVector(indices=list(lw.keys()), values=list(lw.values()))
        else:
            # {"indices": [...], "values": [...]}
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

    # ---------------- Server-side (Query API) with RRF, if available ----------------

    def _server_side_rrf(
        self,
        collection: str,
        dense_vec: list[float],
        sparse_vec: rest.SparseVector,
        qfilter: rest.Filter,
        limit: int,
    ):
        """
        Try server-side Query API with RRF. Returns list of points or None if unsupported.
        Handles both explicit RrfQuery(k=...) and FusionQuery(Fusion.RRF).
        """
        NearestQuery = getattr(rest, "NearestQuery", None)
        Prefetch = getattr(rest, "Prefetch", None)
        # Prefer explicit RrfQuery if available; else FusionQuery(Fusion.RRF)
        RrfQuery = getattr(rest, "RrfQuery", None)
        Rrf = getattr(rest, "Rrf", None)
        FusionQuery = getattr(rest, "FusionQuery", None)
        Fusion = getattr(rest, "Fusion", None)

        if not (NearestQuery and Prefetch and (RrfQuery or (FusionQuery and Fusion))):
            return None

        prefetch_limit = max(limit, OVERSAMPLE_FACTOR * limit)

        # NearestQuery expects raw vectors (dense list / SparseVector)
        pf_dense = Prefetch(
            query=NearestQuery(nearest=dense_vec),
            using=DENSE_NAME,
            filter=qfilter,
            limit=prefetch_limit,
        )
        pf_sparse = Prefetch(
            query=NearestQuery(nearest=sparse_vec),
            using=SPARSE_NAME,
            filter=qfilter,
            limit=prefetch_limit,
        )

        # Fusion query
        fusion_query = (
            RrfQuery(rrf=Rrf(k=int(CLIENT_RRF_K))) if (RrfQuery and Rrf) else FusionQuery(fusion=Fusion.RRF)
        )

        # Call query_points using query= and prefetch= (no "query_request")
        try:
            if hasattr(self.client, "query_points"):
                resp = self.client.query_points(
                    collection_name=collection,
                    query=fusion_query,
                    prefetch=[pf_dense, pf_sparse],
                    query_filter=qfilter,
                    limit=limit,
                    with_payload=True,
                )
                return getattr(resp, "points", resp)
            # HTTP fallback
            if hasattr(self.client, "http") and hasattr(self.client.http, "points_api"):
                QueryRequest = getattr(rest, "QueryRequest", None)
                if not QueryRequest:
                    return None
                req = QueryRequest(
                    query=fusion_query,
                    prefetch=[pf_dense, pf_sparse],
                    filter=qfilter,
                    limit=limit,
                    with_payload=True,
                )
                http_resp = self.client.http.points_api.query_points(
                    collection_name=collection, query_request=req
                )
                result = getattr(http_resp, "result", http_resp)
                return getattr(result, "points", result)
        except Exception:
            return None
        return None

    # ---------------- Client-side: two searches + RRF(k=60), equal weight ----------------

    def _search_dense(self, collection: str, dense_vec: list[float], qfilter: rest.Filter, limit: int):
        """Robust dense search across client versions."""
        cand = limit
        cand = max(cand, OVERSAMPLE_FACTOR * limit)

        # Try modern signature: query_filter=...
        try:
            return self.client.search(
                collection_name=collection,
                query_vector=(DENSE_NAME, dense_vec),
                query_filter=qfilter,
                with_payload=True,
                limit=cand,
            )
        except (TypeError, AssertionError):
            pass

        # Try older signature: filter=...
        try:
            return self.client.search(
                collection_name=collection,
                query_vector=(DENSE_NAME, dense_vec),
                filter=qfilter,
                with_payload=True,
                limit=cand,
            )
        except (TypeError, AssertionError):
            pass

        # Try search_points via SearchRequest
        NamedVector = getattr(rest, "NamedVector", None)
        try:
            fields = _model_fields(rest.SearchRequest)
            vec_value = (
                NamedVector(name=DENSE_NAME, vector=dense_vec) if NamedVector else dense_vec
            )
            kwargs = {"vector": vec_value}
            if "filter" in fields:
                kwargs["filter"] = qfilter
            sr = rest.SearchRequest(with_payload=True, limit=cand, **kwargs)
            if hasattr(self.client, "search_points"):
                r = self.client.search_points(collection_name=collection, search_request=sr)
                return getattr(r, "result", r)
            if hasattr(self.client, "http") and hasattr(self.client.http, "points_api"):
                r = self.client.http.points_api.search_points(collection_name=collection, search_request=sr)
                return getattr(r, "result", r)
        except Exception:
            pass

        raise RuntimeError("Dense search failed across compatibility attempts.")

    def _search_sparse(self, collection: str, sparse_vec: rest.SparseVector, qfilter: rest.Filter, limit: int):
        """Robust sparse search across client versions."""
        cand = limit
        cand = max(cand, OVERSAMPLE_FACTOR * limit)

        # Try tuple form directly (name, SparseVector)
        try:
            return self.client.search(
                collection_name=collection,
                query_vector=(SPARSE_NAME, sparse_vec),
                query_filter=qfilter,
                with_payload=True,
                limit=cand,
            )
        except (TypeError, AssertionError):
            pass
        try:
            return self.client.search(
                collection_name=collection,
                query_vector=(SPARSE_NAME, sparse_vec),
                filter=qfilter,
                with_payload=True,
                limit=cand,
            )
        except (TypeError, AssertionError):
            pass

        # Try search_points via SearchRequest with various field names
        try:
            fields = _model_fields(rest.SearchRequest)
            NamedSparseVector = getattr(rest, "NamedSparseVector", None)

            # Candidate (field_name, value) pairs to try
            candidates: list[Tuple[str, Any]] = []

            if "sparse_vector" in fields:
                if NamedSparseVector:
                    candidates.append(("sparse_vector", NamedSparseVector(name=SPARSE_NAME, vector=sparse_vec)))
                candidates.append(("sparse_vector", sparse_vec))

            if "vector" in fields and NamedSparseVector:
                # Some versions accept NamedSparseVector via "vector"
                candidates.append(("vector", NamedSparseVector(name=SPARSE_NAME, vector=sparse_vec)))

            for field_name, value in candidates:
                try:
                    kwargs = {field_name: value, "with_payload": True, "limit": cand}
                    if "filter" in fields:
                        kwargs["filter"] = qfilter
                    sr = rest.SearchRequest(**kwargs)
                    if hasattr(self.client, "search_points"):
                        r = self.client.search_points(collection_name=collection, search_request=sr)
                        return getattr(r, "result", r)
                    if hasattr(self.client, "http") and hasattr(self.client.http, "points_api"):
                        r = self.client.http.points_api.search_points(
                            collection_name=collection, search_request=sr
                        )
                        return getattr(r, "result", r)
                except Exception:
                    continue
        except Exception:
            pass

        raise RuntimeError("Sparse search failed across compatibility attempts.")

    def _client_side_rrf(
        self,
        collection: str,
        dense_vec: list[float],
        sparse_vec: rest.SparseVector,
        qfilter: rest.Filter,
        limit: int,
    ):
        """Run dense & sparse searches and fuse with RRF(k=60)."""
        dense_res = self._search_dense(collection, dense_vec, qfilter, limit)
        sparse_res = self._search_sparse(collection, sparse_vec, qfilter, limit)

        def _points(seq_like):
            seq = getattr(seq_like, "result", seq_like)
            return getattr(seq, "points", seq)

        # RRF(k=60), equal weight
        scores: dict[Any, float] = {}
        by_id: dict[Any, Any] = {}

        def _accumulate(results):
            pts = _points(results)
            for rank, p in enumerate(pts, start=1):
                pid = getattr(p, "id", getattr(p, "point_id", None))
                if pid is None:
                    # Some HTTP variants return dicts
                    pid = getattr(getattr(p, "payload", {}), "get", lambda *_: None)("id") or id(p)
                scores[pid] = scores.get(pid, 0.0) + 1.0 / (CLIENT_RRF_K + rank)
                by_id[pid] = p

        _accumulate(dense_res)
        _accumulate(sparse_res)

        top_ids = sorted(scores, key=scores.get, reverse=True)[:limit]
        return [by_id[i] for i in top_ids if i in by_id]

    # ----------------------------- Public API -----------------------------

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
        dense_vec, sparse_vec = self._encode_query(query)
        qfilter = self._build_filter(db_id, table_filter, column_filter)
        collection = self._collection(db_id)

        # Try server-side Query API first (if available in this client build)
        points = self._server_side_rrf(collection, dense_vec, sparse_vec, qfilter, limit)

        # Fallback: client-side RRF
        if points is None:
            points = self._client_side_rrf(collection, dense_vec, sparse_vec, qfilter, limit)

        # Normalize to RetrievalResult
        results = [
            RetrievalResult(
                text=(getattr(pt, "payload", {}) or {}).get("text", ""),
                score=float(getattr(pt, "score", 0.0)),
                payload=getattr(pt, "payload", {}) or {},
            )
            for pt in (points or [])
        ]

        # Optional rerank with cross-encoder
        if (use_reranker or settings.enable_reranker) and self.reranker and len(results) > 1:
            scores = self.reranker.compute_score([query] * len(results), [r.text for r in results])
            for r, s in zip(results, scores):
                r.score = float(s)
            results.sort(key=lambda r: r.score, reverse=True)

        return results
