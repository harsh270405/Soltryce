from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase, override_settings

from app.approvals.models import ServiceRequest
from app.users.models import CustomUser
from app.workflows.tasks import _invoke_academic_agent, process_user_request
from app.workflows.maintenance import REJECT, REQUIRES_ADMIN, evaluate_maintenance_request


class ProcessUserRequestTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username='student', email='student@example.com', password='not-a-real-password'
        )
        self.request = ServiceRequest.objects.create(
            user=self.user,
            query='When is the withdrawal deadline?',
            category='academic_question',
            status='IN_PROGRESS',
        )

    @patch('app.workflows.tasks._invoke_academic_agent', return_value={'response': 'The deadline is Friday.', 'documents': []})
    @patch('app.workflows.tasks.AuditTrail.objects.create', side_effect=RuntimeError('audit unavailable'))
    def test_audit_failure_does_not_replace_a_completed_response(self, audit_create, invoke_agent):
        process_user_request.run(str(self.request.id), self.request.query)

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, 'COMPLETED')
        self.assertEqual(self.request.response, 'The deadline is Friday.')

    @patch('app.workflows.tasks.create_academic_agent')
    @patch('app.workflows.tasks.ConnectionPool', side_effect=OSError('database unavailable'))
    @patch('app.workflows.tasks._postgres_connection_info', return_value='postgresql://unavailable')
    def test_checkpoint_failure_uses_nonpersistent_workflow(self, _, __, create_agent):
        agent = MagicMock()
        agent.invoke.return_value = {'response': 'Grounded response'}
        create_agent.return_value = agent

        result = _invoke_academic_agent({'query': 'question'}, {'configurable': {'thread_id': 'thread'}})

        self.assertEqual(result['response'], 'Grounded response')
        create_agent.assert_called_once_with()


class MaintenanceTriageSafetyTests(SimpleTestCase):
    @override_settings(GROQ_API_KEY='')
    def test_missing_location_is_rejected_without_model_access(self):
        assessment = evaluate_maintenance_request('Fix the light.', {'issue_description': 'The light is broken.'})

        self.assertEqual(assessment.decision, REJECT)
        self.assertIn('building, room, or area', assessment.reason.lower())

    @override_settings(GROQ_API_KEY='test-key', GROQ_MODEL='test-model')
    @patch('app.workflows.maintenance.ChatGroq')
    def test_hazardous_request_cannot_be_auto_approved(self, chat_groq):
        model = MagicMock()
        model.invoke.return_value.content = '{"decision":"AUTO_APPROVE","reason":"Routine repair."}'
        chat_groq.return_value = model

        assessment = evaluate_maintenance_request(
            'Sparks are coming from the socket in Lab 2.',
            {'location': 'Lab 2', 'issue_description': 'Sparks from the wall socket'},
        )

        self.assertEqual(assessment.decision, REQUIRES_ADMIN)
