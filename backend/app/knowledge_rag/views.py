from django.db import transaction
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from app.users.permissions import IsPlatformAdmin
from .models import InstitutionalDocument
from .tasks import ingest_document_task
from .ingestion import DocumentIngestionService


def document_data(document):
    return {
        'id': document.id,
        'title': document.title,
        'access_levels': document.access_levels,
        'category': document.category,
        'department': document.department,
        'tags': document.tags,
        'effective_date': document.effective_date,
        'expiry_date': document.expiry_date,
        'version': document.version,
        'is_ingested': document.is_ingested,
        'chunk_count': document.chunk_count,
        'content_hash': document.content_hash,
        'ingestion_error': document.ingestion_error,
        'uploaded_at': document.uploaded_at,
        'updated_at': document.updated_at,
        'file_url': document.file.url if document.file else None,
    }


class RulebookListCreateView(APIView):
    permission_classes = [IsPlatformAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        docs = InstitutionalDocument.objects.all()
        # Optional filtering
        category = request.query_params.get('category')
        if category:
            docs = docs.filter(category=category)
        is_ingested = request.query_params.get('is_ingested')
        if is_ingested is not None:
            docs = docs.filter(is_ingested=is_ingested.lower() == 'true')
        return Response([document_data(doc) for doc in docs])

    def post(self, request):
        title = request.data.get('title', '').strip()
        file = request.FILES.get('file')
        access_levels = request.data.getlist('access_levels') or ['student', 'staff', 'admin']
        effective_date = request.data.get('effective_date')
        category = request.data.get('category', 'general')
        department = request.data.get('department', '').strip()

        # Parse tags from comma-separated string or list
        tags_raw = request.data.get('tags', '')
        if isinstance(tags_raw, str):
            tags = [t.strip() for t in tags_raw.split(',') if t.strip()]
        else:
            tags = request.data.getlist('tags') or []

        expiry_date = request.data.get('expiry_date') or None
        version = request.data.get('version', '1.0').strip()

        if not title or not file or not effective_date:
            return Response(
                {'detail': 'title, file and effective_date are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not file.name.lower().endswith('.pdf'):
            return Response(
                {'detail': 'Only PDF rulebooks are supported.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if category not in dict(InstitutionalDocument.CATEGORY_CHOICES):
            return Response(
                {'detail': f'Invalid category. Choose from: {", ".join(dict(InstitutionalDocument.CATEGORY_CHOICES).keys())}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        document = InstitutionalDocument.objects.create(
            title=title,
            file=file,
            access_levels=access_levels,
            effective_date=effective_date,
            category=category,
            department=department,
            tags=tags,
            expiry_date=expiry_date,
            version=version,
        )
        transaction.on_commit(lambda: ingest_document_task.delay(document.pk))
        return Response(document_data(document), status=status.HTTP_201_CREATED)


class RulebookDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request, document_id):
        document = InstitutionalDocument.objects.filter(pk=document_id).first()
        if not document:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(document_data(document))

    def patch(self, request, document_id):
        """Update document metadata (triggers re-ingestion if critical fields change)."""
        document = InstitutionalDocument.objects.filter(pk=document_id).first()
        if not document:
            return Response(status=status.HTTP_404_NOT_FOUND)

        updated_fields = []
        for field in ['title', 'category', 'department', 'version', 'expiry_date']:
            if field in request.data:
                setattr(document, field, request.data[field])
                updated_fields.append(field)

        if 'access_levels' in request.data:
            document.access_levels = request.data.getlist('access_levels') or document.access_levels
            updated_fields.append('access_levels')
            updated_fields.append('is_ingested')  # Force re-ingestion

        if 'tags' in request.data:
            tags_raw = request.data.get('tags', '')
            if isinstance(tags_raw, str):
                document.tags = [t.strip() for t in tags_raw.split(',') if t.strip()]
            else:
                document.tags = request.data.getlist('tags') or []
            updated_fields.append('tags')
            updated_fields.append('is_ingested')  # Force re-ingestion

        if updated_fields:
            document.save(update_fields=updated_fields + ['updated_at'])

            # Re-ingest if access levels or tags changed
            if 'is_ingested' in updated_fields:
                document.is_ingested = False
                document.save(update_fields=['is_ingested', 'updated_at'])
                transaction.on_commit(lambda: ingest_document_task.delay(document.pk))

        return Response(document_data(document))

    def delete(self, request, document_id):
        document = InstitutionalDocument.objects.filter(pk=document_id).first()
        if not document:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if document.is_ingested:
            try:
                DocumentIngestionService().remove_document(document.pk)
            except Exception:
                return Response(
                    {'detail': 'The rulebook could not be removed from the vector database.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        document.file.delete(save=False)
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
