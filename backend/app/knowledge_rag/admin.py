from django.contrib import admin
from .models import InstitutionalDocument, DocumentChunkMetadata
from .tasks import ingest_document_task


@admin.register(InstitutionalDocument)
class InstitutionalDocumentAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'category', 'department', 'effective_date',
        'version', 'is_ingested', 'chunk_count', 'uploaded_at',
    )
    list_filter = ('is_ingested', 'category', 'access_levels')
    search_fields = ('title', 'department', 'tags')
    readonly_fields = ('chunk_count', 'content_hash', 'ingestion_error', 'updated_at')

    actions = ['trigger_ingestion', 'force_reingestion']

    @admin.action(description='Process & upload selected documents to AI (Qdrant)')
    def trigger_ingestion(self, request, queryset):
        pending_docs = queryset.filter(is_ingested=False)
        count = pending_docs.count()
        for doc in pending_docs:
            ingest_document_task.delay(doc.id)
        if count > 0:
            self.message_user(request, f"Successfully queued {count} documents for AI ingestion.")
        else:
            self.message_user(request, "No uningested documents were selected.", level='warning')

    @admin.action(description='Force re-ingestion of selected documents')
    def force_reingestion(self, request, queryset):
        count = queryset.count()
        for doc in queryset:
            doc.is_ingested = False
            doc.save(update_fields=['is_ingested'])
            ingest_document_task.delay(doc.id)
        self.message_user(request, f"Queued {count} documents for re-ingestion.")


@admin.register(DocumentChunkMetadata)
class DocumentChunkMetadataAdmin(admin.ModelAdmin):
    list_display = ('document', 'chunk_index', 'section_heading', 'page_number')
    list_filter = ('document',)
    search_fields = ('section_heading', 'keywords')
    raw_id_fields = ('document',)
