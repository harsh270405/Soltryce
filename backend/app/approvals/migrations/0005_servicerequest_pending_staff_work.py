# Generated manually for the support-staff maintenance workflow.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('approvals', '0004_servicerequest_agent_thread_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='servicerequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('OPEN', 'Open'),
                    ('IN_PROGRESS', 'In Progress'),
                    ('PENDING_APPROVAL', 'Pending Human Approval'),
                    ('PENDING', 'Pending Staff Work'),
                    ('COMPLETED', 'Completed'),
                    ('FAILED', 'Failed'),
                ],
                default='OPEN',
                max_length=20,
            ),
        ),
    ]
