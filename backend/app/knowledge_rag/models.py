from django.db import models


class InstitutionalDocument(models.Model):
    CATEGORY_CHOICES = [
        ('academic', 'Academic Policy'),
        ('administrative', 'Administrative Policy'),
        ('financial', 'Financial Policy'),
        ('hr', 'Human Resources'),
        ('infrastructure', 'Infrastructure'),
        ('student_life', 'Student Life'),
        ('examination', 'Examination Policy'),
        ('admission', 'Admission Policy'),
        ('general', 'General'),
    ]

    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='policy_documents/')

    # Access control
    access_levels = models.JSONField(
        default=list,
        help_text='List of roles that can access this document. e.g. ["student", "staff", "public"]'
    )

    # Enhanced metadata for better retrieval
    category = models.CharField(
        max_length=30, choices=CATEGORY_CHOICES, default='general',
        help_text="Document category for metadata-filtered retrieval"
    )
    department = models.CharField(
        max_length=100, blank=True, default='',
        help_text="Issuing department or authority"
    )
    tags = models.JSONField(
        default=list, blank=True,
        help_text='Keywords/tags for sparse retrieval. e.g. ["fee", "deadline", "scholarship"]'
    )

    # Policy lifecycle
    effective_date = models.DateField(help_text="Date this policy takes effect")
    expiry_date = models.DateField(
        null=True, blank=True,
        help_text="Date this policy expires (null = no expiry)"
    )
    version = models.CharField(
        max_length=20, blank=True, default='1.0',
        help_text="Document version for tracking updates"
    )

    # Ingestion tracking
    is_ingested = models.BooleanField(default=False, help_text="Has this been vectorized in Qdrant?")
    chunk_count = models.PositiveIntegerField(
        default=0, help_text="Number of chunks stored in the vector database"
    )
    content_hash = models.CharField(
        max_length=64, blank=True, default='',
        help_text="SHA-256 hash of file content for deduplication"
    )
    ingestion_error = models.TextField(
        blank=True, default='',
        help_text="Last ingestion error message if failed"
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['is_ingested']),
            models.Index(fields=['effective_date']),
        ]

    def __str__(self):
        return self.title


class DocumentChunkMetadata(models.Model):
    """
    Stores per-chunk metadata for advanced retrieval features.
    This enables keyword search, section navigation, and relevance feedback.
    """
    document = models.ForeignKey(
        InstitutionalDocument, on_delete=models.CASCADE, related_name='chunk_metadata'
    )
    chunk_index = models.PositiveIntegerField(help_text="Position of chunk within the document")
    section_heading = models.CharField(
        max_length=255, blank=True, default='',
        help_text="Detected or extracted section heading"
    )
    keywords = models.JSONField(
        default=list, blank=True,
        help_text="Extracted keywords for this specific chunk"
    )
    chunk_hash = models.CharField(
        max_length=64, blank=True, default='',
        help_text="Hash of chunk content for deduplication"
    )
    page_number = models.PositiveIntegerField(default=1)
    char_offset = models.PositiveIntegerField(
        default=0, help_text="Character offset from document start"
    )

    class Meta:
        ordering = ['document', 'chunk_index']
        unique_together = ['document', 'chunk_index']
        indexes = [
            models.Index(fields=['document', 'chunk_index']),
        ]

    def __str__(self):
        return f"{self.document.title} - Chunk {self.chunk_index}"
