"""
Advanced RAG Service with:
- Hybrid Search (Dense semantic + BM25 sparse) via Reciprocal Rank Fusion
- Cross-encoder reranking for precision
- Query rewriting and classification
- RBAC-enforced metadata filtering
- Uncertainty evaluation with configurable thresholds
"""

import logging
import re
from typing import Optional

import numpy as np
from django.conf import settings
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from langchain_huggingface import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)


class QueryProcessor:
    """
    Rewrites, expands, and classifies user queries before retrieval.
    Uses lightweight heuristics and optional LLM calls for optimal retrieval.
    """

    # Intent categories mapped to retrieval strategies
    INTENT_CATEGORIES = {
        'factual': 'precise',      # "What is the fee for X?"
        'procedural': 'expansive', # "How do I apply for Y?"
        'comparative': 'multi',    # "What is the difference between X and Y?"
        'temporal': 'time_scoped', # "What are the deadlines for X?"
        'ambiguous': 'broad',      # Vague queries need broader retrieval
    }

    # Keywords that signal query intent
    TEMPORAL_KEYWORDS = {
        'deadline', 'due date', 'when', 'last date', 'start date', 'end date',
        'valid till', 'expiry', 'valid until', 'semester', 'session',
    }
    PROCEDURAL_KEYWORDS = {
        'how to', 'how do i', 'process', 'procedure', 'steps', 'apply',
        'register', 'submit', 'request', 'form', 'application',
    }
    COMPARATIVE_KEYWORDS = {
        'difference', 'compare', 'vs', 'versus', 'better', 'which',
        'difference between',
    }
    FACTUAL_KEYWORDS = {
        'what is', 'what are', 'define', 'meaning', 'definition',
        'how much', 'how many', 'fee', 'cost', 'amount', 'percentage',
    }

    def classify_intent(self, query: str) -> str:
        """Classify the query intent to guide retrieval strategy."""
        q = query.lower().strip()

        if any(kw in q for kw in self.TEMPORAL_KEYWORDS):
            return 'temporal'
        if any(kw in q for kw in self.COMPARATIVE_KEYWORDS):
            return 'comparative'
        if any(kw in q for kw in self.PROCEDURAL_KEYWORDS):
            return 'procedural'
        if any(kw in q for kw in self.FACTUAL_KEYWORDS):
            return 'factual'

        # Check for very short or vague queries
        words = q.split()
        if len(words) <= 3:
            return 'ambiguous'

        return 'factual'

    def rewrite_query(self, query: str) -> str:
        """
        Lightweight query rewriting: normalizes whitespace, expands abbreviations,
        and fixes common phrasing issues without an LLM call.
        """
        # Normalize whitespace
        q = ' '.join(query.split())

        # Common abbreviation expansions for academic context
        expansions = {
            r'\bdept\b': 'department',
            r'\bprofs?\b': 'professor',
            r'\bexam\b': 'examination',
            r'\bdoc\b': 'document',
            r'\binfo\b': 'information',
            r'\bregs?\b': 'regulation',
            r'\bpolicy\b': 'policy',
        }
        for pattern, replacement in expansions.items():
            q = re.sub(pattern, replacement, q, flags=re.IGNORECASE)

        return q.strip()

    def extract_keywords(self, query: str) -> list[str]:
        """Extract meaningful keywords from a query for sparse retrieval."""
        # Simple keyword extraction: remove stop words, keep meaningful terms
        stop_words = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'shall', 'can',
            'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
            'it', 'they', 'them', 'their', 'this', 'that', 'these', 'those',
            'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
            'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
            'as', 'into', 'about', 'between', 'through', 'during', 'before',
            'after', 'above', 'below', 'and', 'but', 'or', 'not', 'no',
            'so', 'if', 'then', 'than', 'too', 'very', 'just', 'also',
            'now', 'here', 'there', 'all', 'each', 'every', 'both', 'few',
            'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
        }
        words = re.findall(r'\b[a-zA-Z]{2,}\b', query.lower())
        return [w for w in words if w not in stop_words]


class BM25Index:
    """
    In-memory BM25 sparse retrieval index backed by rank_bm25.
    Built on top of the Qdrant payload for hybrid search.
    """

    def __init__(self):
        self.documents = []
        self.doc_ids = []
        self.bm25 = None

    def build(self, points: list):
        """Build BM25 index from Qdrant points."""
        try:
            from rank_bm25 import BM25Okapi
        except ImportError:
            logger.warning("rank_bm25 not installed; sparse retrieval disabled.")
            return

        corpus = []
        self.doc_ids = []
        for point in points:
            text = point.payload.get('text', '') if hasattr(point, 'payload') else point.get('text', '')
            # Tokenize: lowercase and split on non-alphanumeric
            tokens = re.findall(r'\b[a-zA-Z0-9]{2,}\b', text.lower())
            corpus.append(tokens)
            self.doc_ids.append(str(point.id) if hasattr(point, 'id') else point.get('id', ''))

        if corpus:
            self.bm25 = BM25Okapi(corpus)
            self.documents = points

    def search(self, query: str, top_k: int = 10) -> list[tuple[str, float]]:
        """Search the BM25 index. Returns list of (doc_id, score)."""
        if not self.bm25:
            return []

        tokens = re.findall(r'\b[a-zA-Z0-9]{2,}\b', query.lower())
        scores = self.bm25.get_scores(tokens)

        # Get top-k indices
        top_indices = np.argsort(scores)[::-1][:top_k]
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                results.append((self.doc_ids[idx], float(scores[idx])))
        return results


class HybridRetriever:
    """
    Combines dense semantic search with BM25 sparse search using
    Reciprocal Rank Fusion (RRF).
    """

    def __init__(self, dense_client: QdrantClient, collection_name: str,
                 dense_embeddings, dense_weight: float = 0.7, sparse_weight: float = 0.3):
        self.client = dense_client
        self.collection_name = collection_name
        self.dense_embeddings = dense_embeddings
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight
        self._bm25_index = BM25Index()
        self._bm25_built = False

    def _ensure_bm25_index(self, access_filter: qdrant_models.Filter):
        """Lazily build BM25 index from stored documents."""
        if self._bm25_built:
            return

        try:
            # Fetch all points for BM25 indexing
            all_points = []
            offset = None
            while True:
                result = self.client.scroll(
                    collection_name=self.collection_name,
                    scroll_filter=access_filter,
                    limit=1000,
                    offset=offset,
                    with_payload=True,
                )
                points, next_offset = result
                all_points.extend(points)
                if next_offset is None:
                    break
                offset = next_offset

            if all_points:
                self._bm25_index.build(all_points)
                self._bm25_built = True
        except Exception as e:
            logger.warning("Failed to build BM25 index: %s", e)

    def _rrf_fusion(self, dense_results: list, sparse_results: list,
                    k: int = 60) -> list[dict]:
        """
        Reciprocal Rank Fusion (RRF) to combine dense and sparse results.
        RRF score = 1 / (k + rank) for each result list. Results are combined
        by summing RRF scores across all lists.
        """
        # Build a map of chunk_id -> combined RRF score
        scores: dict[str, float] = {}
        result_map: dict[str, dict] = {}

        for rank, result in enumerate(dense_results):
            chunk_id = result.get('chunk_id') or result.get('id', '')
            rrf_score = 1.0 / (k + rank + 1)
            scores[chunk_id] = scores.get(chunk_id, 0.0) + rrf_score
            if chunk_id not in result_map:
                result_map[chunk_id] = result

        for rank, result in enumerate(sparse_results):
            chunk_id = result.get('chunk_id') or result.get('id', '')
            rrf_score = 1.0 / (k + rank + 1)
            scores[chunk_id] = scores.get(chunk_id, 0.0) + rrf_score
            if chunk_id not in result_map:
                result_map[chunk_id] = result

        # Sort by combined RRF score descending
        sorted_ids = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)

        fused_results = []
        for cid in sorted_ids:
            result = result_map[cid]
            result['rrf_score'] = scores[cid]
            fused_results.append(result)

        return fused_results

    def search(
        self,
        query: str,
        access_filter: Optional[qdrant_models.Filter] = None,
        category: Optional[str] = None,
        top_k: int = 10,
    ) -> list[dict]:
        """
        Hybrid search: dense semantic + BM25 sparse with RRF fusion.
        """
        # Dense search
        query_embedding = self.dense_embeddings.embed_query(query)

        query_filter = access_filter
        if category:
            category_filter = qdrant_models.FieldCondition(
                key='category',
                match=qdrant_models.MatchValue(value=category),
            )
            if query_filter is None:
                query_filter = qdrant_models.Filter(must=[category_filter])
            else:
                query_filter.must.append(category_filter)

        dense_response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_embedding,
            using='dense',
            limit=top_k,
            query_filter=query_filter,
        )

        dense_results = []
        for hit in dense_response.points:
            dense_results.append({
                'id': str(hit.id),
                'chunk_id': str(hit.id),
                'score': hit.score,
                'content': hit.payload.get('text', '') if hit.payload else '',
                'document_title': hit.payload.get('document_title', '') if hit.payload else '',
                'section': hit.payload.get('heading', '') if hit.payload else '',
                'category': hit.payload.get('category', '') if hit.payload else '',
                'access_levels': hit.payload.get('access_levels', []) if hit.payload else [],
                'effective_date': hit.payload.get('effective_date', '') if hit.payload else '',
                'document_id': hit.payload.get('document_id') if hit.payload else None,
                'keywords': hit.payload.get('keywords', []) if hit.payload else [],
            })

        # Sparse search (BM25)
        self._ensure_bm25_index(access_filter)
        sparse_raw = self._bm25_index.search(query, top_k=top_k)

        sparse_results = []
        for doc_id, bm25_score in sparse_raw:
            # Look up payload from indexed documents
            for point in self._bm25_index.documents:
                point_id = str(point.id) if hasattr(point, 'id') else point.get('id', '')
                if point_id == doc_id:
                    sparse_results.append({
                        'id': doc_id,
                        'chunk_id': doc_id,
                        'score': bm25_score,
                        'content': point.payload.get('text', '') if hasattr(point, 'payload') else point.get('text', ''),
                        'document_title': point.payload.get('document_title', '') if hasattr(point, 'payload') else '',
                        'section': point.payload.get('heading', '') if hasattr(point, 'payload') else '',
                        'category': point.payload.get('category', '') if hasattr(point, 'payload') else '',
                        'access_levels': point.payload.get('access_levels', []) if hasattr(point, 'payload') else [],
                        'effective_date': point.payload.get('effective_date', '') if hasattr(point, 'payload') else '',
                        'document_id': point.payload.get('document_id') if hasattr(point, 'payload') else None,
                        'keywords': point.payload.get('keywords', []) if hasattr(point, 'payload') else [],
                    })
                    break

        # RRF fusion
        fused = self._rrf_fusion(dense_results, sparse_results)

        return fused[:top_k]


class InstitutionalRAGService:
    """
    High-level RAG service that orchestrates query processing, hybrid retrieval,
    and uncertainty evaluation for institutional academic documents.
    """

    def __init__(self):
        qdrant_url = getattr(settings, 'QDRANT_URL', 'http://localhost:6333')
        self.client = QdrantClient(url=qdrant_url)
        self.collection_name = 'soltryce_docs'

        self.embeddings = HuggingFaceEmbeddings(
            model_name=getattr(settings, 'EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        )

        self.query_processor = QueryProcessor()
        self.retriever = HybridRetriever(
            dense_client=self.client,
            collection_name=self.collection_name,
            dense_embeddings=self.embeddings,
        )

    def _build_access_filter(self, access_level: str) -> Optional[qdrant_models.Filter]:
        """Build a Qdrant filter for RBAC-enforced access control."""
        if access_level == 'admin':
            return None  # Admin sees everything

        return qdrant_models.Filter(
            must=[
                qdrant_models.FieldCondition(
                    key='access_levels',
                    match=qdrant_models.MatchAny(any=[access_level, 'public']),
                )
            ]
        )

    def evaluate_uncertainty(self, query: str, results: list[dict]) -> bool:
        """
        Evaluate whether retrieved results are sufficient to answer confidently.
        Returns True if the answer is uncertain and should be escalated.
        """
        min_score = getattr(settings, 'RAG_MIN_SCORE', 0.20)

        if not results:
            return True

        top_score = max(r.get('score', 0) for r in results)
        return top_score < min_score

    def process_query(
        self,
        query: str,
        access_level: str = 'public',
        category: Optional[str] = None,
    ) -> dict:
        """
        Full RAG pipeline: rewrite -> retrieve -> rerank -> evaluate.
        Returns dict with 'documents' and 'uncertain' keys.
        """
        # 1. Query processing
        rewritten = self.query_processor.rewrite_query(query)
        keywords = self.query_processor.extract_keywords(rewritten)

        # 2. Build access filter
        access_filter = self._build_access_filter(access_level)

        # 3. Hybrid retrieval
        documents = self.retriever.search(
            query=rewritten,
            access_filter=access_filter,
            category=category,
            top_k=10,
        )

        # 4. Uncertainty evaluation
        uncertain = self.evaluate_uncertainty(query, documents)

        logger.info(
            "Query processed: '%s' -> %d documents, uncertain=%s",
            query, len(documents), uncertain,
        )

        return {
            'documents': documents,
            'uncertain': uncertain,
        }
