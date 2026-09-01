# Generated manually after replacing the retired faculty role with staff.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_rag', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='institutionaldocument',
            name='access_levels',
            field=models.JSONField(
                default=list,
                help_text='List of roles that can access this document. e.g. ["student", "staff", "public"]',
            ),
        ),
    ]
