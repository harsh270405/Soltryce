import logging

from celery import shared_task

from .ingestion import DocumentIngestionService
from .models import InstitutionalDocument

logger = logging.getLogger(__name__)


@shared_task
def ingest_document_task(document_id: int):
    """Extract, index, and expose a rulebook to the RAG service."""
    document = InstitutionalDocument.objects.get(pk=document_id)
    try:
        result = DocumentIngestionService().process_and_upload_pdf(
            file_path=document.file.path,
            document_title=document.title,
            access_levels=document.access_levels,
            effective_date=document.effective_date.isoformat(),
            document_id=document.pk,
            category=document.category,
            department=document.department,
            tags=document.tags,
        )
        document.is_ingested = True
        document.chunk_count = result.get('chunk_count', 0)
        document.content_hash = result.get('content_hash', '')
        document.ingestion_error = ''
        document.save(update_fields=[
            'is_ingested', 'chunk_count', 'content_hash', 'ingestion_error', 'updated_at',
        ])
        logger.info(
            "Document '%s' ingested: %d chunks, %d duplicates skipped",
            document.title, result.get('chunk_count', 0), result.get('skipped_duplicates', 0),
        )
    except Exception as exc:
        document.is_ingested = False
        document.ingestion_error = str(exc)[:500]
        document.save(update_fields=['is_ingested', 'ingestion_error', 'updated_at'])
        logger.exception("Ingestion failed for document '%s'", document.title)
        raise
