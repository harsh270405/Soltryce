import uuid
import logging
from urllib.parse import quote

from celery import shared_task
from django.conf import settings
from psycopg_pool import ConnectionPool

from app.approvals.models import ServiceRequest
from app.audit.models import AuditTrail
from .agent import create_academic_agent


logger = logging.getLogger(__name__)


def _postgres_connection_info():
    database = settings.DATABASES['default']
    if not database['ENGINE'].endswith('postgresql'):
        return None
    user, password = quote(database['USER'], safe=''), quote(database['PASSWORD'], safe='')
    host, port = database['HOST'] or 'localhost', database['PORT'] or '5432'
    return f"postgresql://{user}:{password}@{host}:{port}/{database['NAME']}"


@shared_task
def process_user_request(request_id: str, user_message: str):
    """Run and persist one role-aware LangGraph academic-assistant workflow."""
    item = ServiceRequest.objects.select_related('user').get(id=request_id)
    if not item.agent_thread_id:
        item.agent_thread_id = str(uuid.uuid4())
        item.save(update_fields=['agent_thread_id', 'updated_at'])

    config = {'configurable': {'thread_id': item.agent_thread_id}}

    # Extract optional category filter from request metadata
    category = item.metadata.get('category', '')

    initial_state = {
        'request_id': str(item.id),
        'query': user_message,
        'access_level': item.user.get_access_level(),
        'category': category,
        'messages': [],
    }

    try:
        result = _invoke_academic_agent(initial_state, config)
        response = result.get('response')
        if not response:
            raise RuntimeError('Academic workflow completed without a response.')

        item.response = response
        item.status = 'COMPLETED'

        # Enrich metadata with reflection and query info
        metadata = item.metadata.copy()
        if result.get('reflection_notes'):
            metadata['reflection'] = result['reflection_notes']
        if result.get('query_intent'):
            metadata['query_intent'] = result['query_intent']
        if result.get('needs_escalation'):
            metadata['needs_escalation'] = True
        item.metadata = metadata

        item.save(update_fields=['response', 'status', 'metadata', 'updated_at'])
        _record_success_audit(item, result)

    except Exception as exc:
        logger.exception('Academic workflow failed for service request %s', item.id)
        item.status = 'FAILED'
        item.response = 'We could not complete this academic query right now. Please try again shortly.'
        item.save(update_fields=['response', 'status', 'updated_at'])
        try:
            AuditTrail.objects.create(
                request=item,
                agent_name='langgraph-academic-agent',
                step_number=2,
                action_taken=f'Workflow failed: {type(exc).__name__}',
            )
        except Exception:
            logger.exception('Unable to record workflow failure for service request %s', item.id)
        raise


def _invoke_academic_agent(initial_state: dict, config: dict):
    """Use persistent checkpoints where possible without making them a prerequisite."""
    conninfo = _postgres_connection_info()
    if not conninfo:
        return create_academic_agent().invoke(initial_state, config=config)

    checkpoint_ready = False
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        with ConnectionPool(conninfo=conninfo, min_size=1, max_size=3) as pool:
            checkpointer = PostgresSaver(pool)
            checkpointer.setup()
            checkpoint_ready = True
            return create_academic_agent(checkpointer).invoke(initial_state, config=config)
    except Exception:
        if checkpoint_ready:
            raise
        logger.warning('Postgres checkpointing is unavailable; continuing without persistence.', exc_info=True)
        return create_academic_agent().invoke(initial_state, config=config)


def _record_success_audit(item: ServiceRequest, result: dict) -> None:
    """An audit outage must not discard an answer that was successfully generated."""
    try:
        AuditTrail.objects.create(
            request=item,
            agent_name='langgraph-academic-agent',
            step_number=2,
            retrieved_docs=result.get('documents', []),
            action_taken=f'Grounded academic response generated (intent: {result.get("query_intent", "unknown")})',
        )
    except Exception:
        logger.exception('Unable to record workflow success for service request %s', item.id)


@shared_task
def resume_agent_thread_task(thread_id: str, approved: bool, feedback: str = ''):
    """Record a compatibility event for legacy agent approval threads."""
    return {'thread_id': thread_id, 'approved': approved, 'feedback': feedback}
