"""
Advanced RAG-grounded academic assistant workflow using LangGraph.

Workflow nodes:
1. classify_query     — Intent detection and query planning
2. retrieve_context   — Hybrid search + reranking
3. compose_answer     — LLM-grounded response generation with citations
4. self_reflect       — Verify answer quality and completeness
"""

import json
import logging
from typing import Annotated, TypedDict

from django.conf import settings
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.knowledge_rag.services import InstitutionalRAGService

logger = logging.getLogger(__name__)


class AcademicAgentState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    request_id: str
    query: str
    access_level: str
    category: str  # Optional category filter
    # Query processing results
    query_intent: str
    query_keywords: list[str]
    # Retrieval results
    documents: list[dict]
    uncertain: bool
    # Response
    response: str
    reflection_notes: str
    needs_escalation: bool


def classify_query(state: AcademicAgentState):
    """Classify query intent and prepare retrieval strategy."""
    service = InstitutionalRAGService()
    processor = service.query_processor

    query = state['query']
    rewritten = processor.rewrite_query(query)
    intent = processor.classify_intent(rewritten)
    keywords = processor.extract_keywords(rewritten)

    logger.info(
        "Query classified: intent=%s, keywords=%s",
        intent, keywords,
    )

    return {
        'query_intent': intent,
        'query_keywords': keywords,
    }


def retrieve_rulebook_context(state: AcademicAgentState):
    """Retrieve only rulebook chunks that the requesting role may read, using hybrid search."""
    service = InstitutionalRAGService()
    category = state.get('category') or None

    result = service.process_query(
        query=state['query'],
        access_level=state['access_level'],
        category=category,
    )

    return {
        'documents': result['documents'],
        'uncertain': result['uncertain'],
    }


def _fallback_response(documents: list[dict]) -> str:
    """Generate a grounded fallback response from source excerpts when LLM is unavailable."""
    excerpts = []
    titles = set()
    for doc in documents:
        content = doc.get('content', '').strip()
        title = doc.get('document_title', 'Unknown')
        section = doc.get('section', '')
        if content:
            header = f"**{title}**"
            if section:
                header += f" — {section}"
            excerpts.append(f"{header}\n{content}")
            titles.add(title)

    if not excerpts:
        return ""

    sources = ", ".join(sorted(titles))
    return "\n\n---\n\n".join(excerpts) + f"\n\n**Sources:** {sources}"


def compose_grounded_answer(state: AcademicAgentState):
    """Generate an answer from retrieved evidence, never from unsupported assumptions."""
    documents = state.get('documents', [])

    if state.get('uncertain'):
        return {
            'response': (
                'I could not find sufficiently reliable information in the current rulebook to answer '
                'that question. Please reach out to the administration office for confirmation, or '
                'submit a service request and a staff member will assist you.'
            ),
            'needs_escalation': True,
        }

    if not documents:
        return {
            'response': (
                'No relevant documents were found for your query. Please check with the '
                'administration office for assistance.'
            ),
            'needs_escalation': True,
        }

    # Build rich context with metadata for the LLM
    context_parts = []
    for i, doc in enumerate(documents, 1):
        title = doc.get('document_title', 'Unknown Document')
        section = doc.get('section', '')
        effective = doc.get('effective_date', 'not specified')
        page = doc.get('page_number', '?')
        category = doc.get('category', '')
        content = doc.get('content', '')

        header = f"[{i}] Document: {title}"
        if section:
            header += f" | Section: {section}"
        if effective:
            header += f" | Effective: {effective}"
        if page:
            header += f" | Page: {page}"
        if category:
            header += f" | Category: {category}"

        context_parts.append(f"{header}\n{content}")

    context = "\n\n".join(context_parts)

    if not settings.GROQ_API_KEY:
        return {'response': _fallback_response(documents), 'needs_escalation': False}

    # Load the system prompt from prompt.md
    system_prompt = _load_system_prompt()

    prompt = SystemMessage(content=(
        f"{system_prompt}\n\n"
        f"## Retrieved Rulebook Context\n\n"
        f"The following {len(documents)} document chunk(s) were retrieved from the institutional knowledge base. "
        f"Use ONLY this context to answer the user's question.\n\n"
        f"{context}\n\n"
        f"---\n\n"
        f"## Instructions\n\n"
        f"- Answer the user's question using the context above.\n"
        f"- Cite document titles and section headings where possible.\n"
        f"- If the context does not contain enough information, say so clearly.\n"
        f"- Do not fabricate any information not present in the context.\n"
        f"- Be concise and direct. Use bullet points for multi-part answers.\n"
        f"- If the user's language is not English, respond in their language.\n"
    ))

    try:
        model = ChatGroq(
            model=settings.GROQ_MODEL,
            temperature=0,
            api_key=settings.GROQ_API_KEY,
            max_tokens=1024,
        )
        answer = model.invoke([prompt, HumanMessage(content=state['query'])])
        return {'response': str(answer.content), 'needs_escalation': False}
    except Exception as e:
        logger.exception("LLM call failed for request %s", state.get('request_id'))
        return {'response': _fallback_response(documents), 'needs_escalation': False}


def self_reflect(state: AcademicAgentState):
    """
    Self-reflection node: verify the answer quality.
    Checks for hallucination markers, source citations, and completeness.
    """
    response = state.get('response', '')
    documents = state.get('documents', [])
    needs_escalation = state.get('needs_escalation', False)

    if needs_escalation or not response:
        return {'reflection_notes': 'Escalation needed - insufficient evidence.'}

    # Check for source citations
    doc_titles = {doc.get('document_title', '') for doc in documents}
    has_citation = any(title in response for title in doc_titles if title)

    # Check for common hallucination markers
    hallucination_markers = [
        'i believe', 'i think', 'generally', 'usually',
        'in my opinion', 'it is common knowledge',
    ]
    has_hallucination = any(marker in response.lower() for marker in hallucination_markers)

    notes = []
    if not has_citation and documents:
        notes.append('Response may lack source citations.')
    if has_hallucination:
        notes.append('Potential hallucination detected - response contains opinion markers.')

    reflection = '; '.join(notes) if notes else 'Answer appears grounded and well-cited.'

    return {'reflection_notes': reflection}


def _load_system_prompt() -> str:
    """Load the system prompt from prompt.md file."""
    import os
    prompt_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'prompt.md'
    )
    try:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return (
            'You are Soltryce, the institutional academic assistant. '
            'Answer only from the supplied rulebook context. '
            'Do not invent information. Cite your sources.'
        )


def create_academic_agent(checkpointer=None):
    """
    Build and compile the LangGraph academic assistant workflow.

    Nodes:
      1. classify_query        — Intent detection and query planning
      2. retrieve_rulebook_context — Hybrid search + reranking
      3. compose_grounded_answer  — LLM-grounded response generation with citations
      4. self_reflect           — Verify answer quality and completeness
    """
    workflow = StateGraph(AcademicAgentState)

    # Add nodes
    workflow.add_node('classify_query', classify_query)
    workflow.add_node('retrieve_rulebook_context', retrieve_rulebook_context)
    workflow.add_node('compose_grounded_answer', compose_grounded_answer)
    workflow.add_node('self_reflect', self_reflect)

    # Define edges
    workflow.set_entry_point('classify_query')
    workflow.add_edge('classify_query', 'retrieve_rulebook_context')
    workflow.add_edge('retrieve_rulebook_context', 'compose_grounded_answer')
    workflow.add_edge('compose_grounded_answer', 'self_reflect')
    workflow.add_edge('self_reflect', END)

    # Compile with optional checkpointing
    compile_kwargs = {}
    if checkpointer is not None:
        compile_kwargs['checkpointer'] = checkpointer

    return workflow.compile(**compile_kwargs)
