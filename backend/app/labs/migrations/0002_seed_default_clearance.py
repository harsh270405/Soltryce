from django.db import migrations


def seed_clearance_levels(apps, schema_editor):
    ClearanceLevel = apps.get_model("labs", "ClearanceLevel")
    ClearanceLevel.objects.get_or_create(level=0, defaults={"label": "Basic"})


def clear_clearance_levels(apps, schema_editor):
    ClearanceLevel = apps.get_model("labs", "ClearanceLevel")
    ClearanceLevel.objects.filter(level=0).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("labs", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_clearance_levels, clear_clearance_levels),
    ]
