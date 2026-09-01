"""
Advanced Document Ingestion Service with:
- Section-aware hierarchical chunking
- Automatic metadata extraction (headings, keywords)
- Content deduplication via SHA-256 hashing
- Rich Qdrant payload for hybrid retrieval
"""

import hashlib
import logging
import re
import uuid
from typing import List, Optional

from django.conf import settings
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


class MetadataExtractor:
    """Extracts structural metadata from document chunks."""

    # Common section heading patterns in academic/institutional documents
    HEADING_PATTERNS = [
        re.compile(r'^(#{1,4})\s+(.+)$', re.MULTILINE),  # Markdown
        re.compile(r'^([A-Z][A-Z\s]{2,})$', re.MULTILINE),  # ALL CAPS lines
        re.compile(r'^(\d+\.?\d*\.?\d*)\s+(.+)$', re.MULTILINE),  # Numbered sections
        re.compile(r'^(Article|Section|Chapter|Rule|Policy|Regulation|clause)\s+[\d.]+', re.IGNORECASE | re.MULTILINE),
    ]

    # Stop words for keyword extraction
    STOP_WORDS = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'shall', 'can', 'i', 'me', 'my', 'we',
        'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'their',
        'this', 'that', 'these', 'those', 'to', 'of', 'in', 'for', 'on',
        'with', 'at', 'by', 'from', 'as', 'into', 'about', 'and', 'but',
        'or', 'not', 'no', 'so', 'if', 'then', 'than', 'too', 'very',
        'just', 'also', 'now', 'here', 'there', 'all', 'each', 'every',
        'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
        'own', 'same', 'page', 'section', 'article', 'rule', 'policy',
    }

    def extract_heading(self, text: str) -> str:
        """Extract the most likely section heading from a chunk."""
        lines = text.strip().split('\n')

        # Check first few lines for heading patterns
        for line in lines[:5]:
            line = line.strip()
            if not line:
                continue

            # ALL CAPS line (likely a heading)
            if line.isupper() and len(line) > 3 and len(line) < 100:
                return line.title()

            # Numbered section
            match = re.match(r'^(\d+\.?\d*\.?\d*)\s+(.+)$', line)
            if match:
                return line[:100]

            # Article/Section/Chapter prefix
            match = re.match(r'^(Article|Section|Chapter|Rule|Policy|Regulation|Clause)\s+[\d.]+[:\s]*(.*)', line, re.IGNORECASE)
            if match:
                return line[:100]

        return ''

    def extract_keywords(self, text: str, top_n: int = 8) -> list[str]:
        """Extract top keywords from text using TF-based scoring."""
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        word_freq = {}
        for word in words:
            if word not in self.STOP_WORDS:
                word_freq[word] = word_freq.get(word, 0) + 1

        # Sort by frequency and return top keywords
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, freq in sorted_words[:top_n]]


class DocumentIngestionService:
    def __init__(self):
        qdrant_url = getattr(settings, 'QDRANT_URL', 'http://localhost:6333')
        self.client = QdrantClient(url=qdrant_url)
        self.collection_name = 'soltryce_docs'

        from langchain_huggingface import HuggingFaceEmbeddings
        self.embeddings = HuggingFaceEmbeddings(
            model_name=getattr(settings, 'EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
        )

        self.metadata_extractor = MetadataExtractor()

        # Configurable chunking parameters
        self.chunk_size = getattr(settings, 'RAG_CHUNK_SIZE', 1000)
        self.chunk_overlap = getattr(settings, 'RAG_CHUNK_OVERLAP', 200)

        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        """Creates the Qdrant collection with named vectors if it doesn't exist."""
        collections = self.client.get_collections().collections
        if not any(c.name == self.collection_name for c in collections):
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config={
                    'dense': qdrant_models.VectorParams(
                        size=getattr(settings, 'EMBEDDING_DIMENSION', 384),
                        distance=qdrant_models.Distance.COSINE,
                    )
                },
                optimizers_config=qdrant_models.OptimizersConfigDiff(
                    indexing_threshold=20000,
                ),
            )
            # Create payload index for faster filtering
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name='access_levels',
                field_schema=qdrant_models.PayloadSchemaType.KEYWORD,
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name='category',
                field_schema=qdrant_models.PayloadSchemaType.KEYWORD,
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name='document_id',
                field_schema=qdrant_models.PayloadSchemaType.INTEGER,
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name='effective_date',
                field_schema=qdrant_models.PayloadSchemaType.KEYWORD,
            )
            logger.info("Created Qdrant collection '%s' with payload indexes.", self.collection_name)

    def _compute_file_hash(self, file_path: str) -> str:
        """Compute SHA-256 hash of file content for deduplication."""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _compute_chunk_hash(self, text: str) -> str:
        """Compute hash of chunk content for deduplication."""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]

    def process_and_upload_pdf(
        self,
        file_path: str,
        document_title: str,
        access_levels: List[str],
        effective_date: str,
        document_id: int,
        category: str = 'general',
        department: str = '',
        tags: Optional[List[str]] = None,
    ) -> dict:
        """
        Parses a PDF with section-aware chunking, extracts metadata,
        deduplicates, and uploads to Qdrant.

        Returns dict with:
          - chunk_count: number of chunks ingested
          - content_hash: SHA-256 hash for deduplication
          - skipped_duplicates: number of duplicate chunks skipped
        """
        # 1. Check for duplicate document
        content_hash = self._compute_file_hash(file_path)

        # 2. Load the PDF
        loader = PyPDFLoader(file_path)
        pages = loader.load()

        if not pages:
            return {'chunk_count': 0, 'content_hash': content_hash, 'skipped_duplicates': 0}

        # 3. Section-aware hierarchical chunking
        # Use larger chunks with substantial overlap to keep sections intact
        text_splitter = RecursiveCharacterTextSplitter(
            separators=[
                '\n\n\n',           # Triple newline (section breaks)
                '\n\n',             # Double newline (paragraph breaks)
                '\n',               # Single newline
                r'(?<=\.\s)',       # After sentence endings
                ' ',                # Word boundaries
                '',                 # Character level (last resort)
            ],
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            is_separator_regex=True,
        )
        chunks = text_splitter.split_documents(pages)

        if not chunks:
            return {'chunk_count': 0, 'content_hash': content_hash, 'skipped_duplicates': 0}

        # 4. Enhance chunks with metadata and deduplicate
        points_to_upsert = []
        skipped_duplicates = 0

        for i, chunk in enumerate(chunks):
            chunk_text = chunk.page_content.strip()
            if not chunk_text or len(chunk_text) < 50:
                continue

            # Deduplication check
            chunk_hash = self._compute_chunk_hash(chunk_text)

            # Extract metadata
            heading = self.metadata_extractor.extract_heading(chunk_text)
            keywords = self.metadata_extractor.extract_keywords(chunk_text)

            # Build Qdrant payload
            payload = {
                'text': chunk_text,
                'chunk_index': i,
                'document_title': document_title,
                'heading': heading,
                'keywords': keywords,
                'category': category,
                'access_levels': access_levels,
                'effective_date': effective_date,
                'document_id': document_id,
                'department': department,
                'tags': tags or [],
                'content_hash': chunk_hash,
                'source_file': file_path,
            }

            # Generate point ID for deduplication
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{document_id}:{chunk_hash}"))

            # Generate dense embedding
            embedding = self.embeddings.embed_query(chunk_text)

            points_to_upsert.append(
                qdrant_models.PointStruct(
                    id=point_id,
                    vector={'dense': embedding},
                    payload=payload,
                )
            )

        # 5. Batch upload to Qdrant
        if points_to_upsert:
            self.client.upsert(
                collection_name=self.collection_name,
                points=points_to_upsert,
            )
            logger.info(
                "Uploaded %d chunks for document '%s' (hash: %s, skipped: %d)",
                len(points_to_upsert), document_title, content_hash, skipped_duplicates,
            )

        return {
            'chunk_count': len(points_to_upsert),
            'content_hash': content_hash,
            'skipped_duplicates': skipped_duplicates,
        }

