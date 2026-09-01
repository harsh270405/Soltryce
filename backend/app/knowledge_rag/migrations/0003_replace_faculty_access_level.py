# Preserve access to existing rulebooks after retiring the faculty role.

from django.db import migrations


def replace_faculty_access_level(apps, schema_editor):
    InstitutionalDocument = apps.get_model('knowledge_rag', 'InstitutionalDocument')
    for document in InstitutionalDocument.objects.all().iterator():
        levels = document.access_levels or []
        if 'faculty' not in levels:
            continue
        document.access_levels = list(dict.fromkeys('student' if level == 'faculty' else level for level in levels))
        document.save(update_fields=['access_levels'])


class Migration(migrations.Migration):

    dependencies = [
        ('knowledge_rag', '0002_alter_institutionaldocument_access_levels'),
    ]

    operations = [
        migrations.RunPython(replace_faculty_access_level, migrations.RunPython.noop),
    ]
