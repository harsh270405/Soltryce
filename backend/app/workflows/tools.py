from langchain_core.tools import tool
from app.knowledge_rag.services import InstitutionalRAGService


@tool
def retrieve_policy_documents(query: str, access_level: str = "public", category: str = "") -> str:
    """
    Retrieves verified institutional policy documents and rules via hybrid RAG.
    Combines dense semantic search with BM25 sparse retrieval and cross-encoder reranking.
    """
    rag_service = InstitutionalRAGService()
    result = rag_service.process_query(
        query=query,
        access_level=access_level,
        category=category if category else None,
    )

    docs = result.get('documents', [])
    if not docs or result.get('uncertain', True):
        return "WARNING: Unverified policy or conflicting data detected. Escalate to human review."

    parts = []
    for d in docs:
        title = d.get('document_title', 'Unknown')
        section = d.get('section', '')
        content = d.get('content', '')
        effective = d.get('effective_date', '')
        header = f"Doc: {title}"
        if section:
            header += f" | Section: {section}"
        if effective:
            header += f" | Effective: {effective}"
        parts.append(f"{header}\n{content}")

    return "\n\n".join(parts)


@tool
def request_certificate_service(student_id: str, certificate_type: str) -> str:
    """High-Risk Tool: Generates official transcripts or clearance certificates."""
    # Logic to interact with student database records goes here
    return f"SUCCESS: Official {certificate_type} generated for student ID {student_id} pending dispatch."


@tool
def create_maintenance_ticket(location: str, issue_description: str) -> str:
    """Safe Tool: Creates a facility maintenance ticket."""
    return f"SUCCESS: Maintenance ticket logged for {location}. Status: Open."


@tool
def book_laboratory(lab_name: str, time_slot: str, student_id: str) -> str:
    """High-Risk Tool: Confirms a physical or equipment lab reservation."""
    return f"SUCCESS: Lab {lab_name} booked for student {student_id} at {time_slot}."
