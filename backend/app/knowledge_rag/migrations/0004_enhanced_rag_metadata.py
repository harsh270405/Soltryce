"""
Migration for enhanced RAG metadata: categories, tags, department, chunk tracking,
deduplication, and DocumentChunkMetadata model.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_rag', '0003_replace_faculty_access_level'),
    ]

    operations = [
        # Add new fields to InstitutionalDocument
        migrations.AddField(
            model_name='institutionaldocument',
            name='category',
            field=models.CharField(
                choices=[
                    ('academic', 'Academic Policy'),
                    ('administrative', 'Administrative Policy'),
                    ('financial', 'Financial Policy'),
                    ('hr', 'Human Resources'),
                    ('infrastructure', 'Infrastructure'),
                    ('student_life', 'Student Life'),
                    ('examination', 'Examination Policy'),
                    ('admission', 'Admission Policy'),
                    ('general', 'General'),
                ],
                default='general',
                help_text='Document category for metadata-filtered retrieval',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='department',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Issuing department or authority',
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='tags',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Keywords/tags for sparse retrieval. e.g. ["fee", "deadline", "scholarship"]',
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='expiry_date',
            field=models.DateField(
                blank=True,
                help_text='Date this policy expires (null = no expiry)',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='version',
            field=models.CharField(
                blank=True,
                default='1.0',
                help_text='Document version for tracking updates',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='chunk_count',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Number of chunks stored in the vector database',
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='content_hash',
            field=models.CharField(
                blank=True,
                default='',
                help_text='SHA-256 hash of file content for deduplication',
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='ingestion_error',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Last ingestion error message if failed',
            ),
        ),
        migrations.AddField(
            model_name='institutionaldocument',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        # Add indexes
        migrations.AddIndex(
            model_name='institutionaldocument',
            index=models.Index(fields=['category'], name='knowledge_rag_category_idx'),
        ),
        migrations.AddIndex(
            model_name='institutionaldocument',
            index=models.Index(fields=['is_ingested'], name='knowledge_rag_ingested_idx'),
        ),
        migrations.AddIndex(
            model_name='institutionaldocument',
            index=models.Index(fields=['effective_date'], name='knowledge_rag_effdate_idx'),
        ),
        # Create DocumentChunkMetadata model
        migrations.CreateModel(
            name='DocumentChunkMetadata',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chunk_index', models.PositiveIntegerField(help_text='Position of chunk within the document')),
                ('section_heading', models.CharField(blank=True, default='', help_text='Detected or extracted section heading', max_length=255)),
                ('keywords', models.JSONField(blank=True, default=list, help_text='Extracted keywords for this specific chunk')),
                ('chunk_hash', models.CharField(blank=True, default='', help_text='Hash of chunk content for deduplication', max_length=64)),
                ('page_number', models.PositiveIntegerField(default=1)),
                ('char_offset', models.PositiveIntegerField(default=0, help_text='Character offset from document start')),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chunk_metadata', to='knowledge_rag.institutionaldocument')),
            ],
            options={
                'ordering': ['document', 'chunk_index'],
                'indexes': [models.Index(fields=['document', 'chunk_index'], name='knowledge_rag_chunk_doc_idx')],
                'unique_together': {('document', 'chunk_index')},
            },
        ),
    ]
