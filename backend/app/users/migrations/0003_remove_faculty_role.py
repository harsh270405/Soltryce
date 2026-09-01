# Generated manually for the three-role access model.

from django.db import migrations, models


def map_faculty_to_student(apps, schema_editor):
    CustomUser = apps.get_model('users', 'CustomUser')
    CustomUser.objects.filter(role='faculty').update(role='student')


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_customuser_display_name_alter_customuser_email'),
    ]

    operations = [
        migrations.RunPython(map_faculty_to_student, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[
                    ('student', 'Student'),
                    ('admin', 'Administrator'),
                    ('staff', 'Support Staff'),
                ],
                default='student',
                max_length=20,
            ),
        ),
    ]
