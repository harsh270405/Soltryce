# LangChain vs LangGraph — Analysis

## Overview

This project (Soltryce) is an **institutional academic assistant** that uses RAG (Retrieval-Augmented Generation) to answer queries from official rulebooks and policies. Two AI orchestration libraries are used: **LangChain** and **LangGraph**. This document explains what each does, why both are used, and whether the usage is justified.

---

## What LangChain Does

LangChain provides the **building blocks** — LLM wrappers, message abstractions, embedding model wrappers, document loaders, text splitters, and tool decorators.

| File | Import | Purpose |
|------|--------|---------|
| `workflows/agent.py` | `langchain_core.messages` | Message types (`HumanMessage`, `SystemMessage`) for LLM prompting |
| `workflows/agent.py` | `langchain_groq.ChatGroq` | LLM client for Groq API (model inference) |
| `workflows/maintenance.py` | `langchain_core.messages` + `langchain_groq` | Same: message types + LLM for maintenance request triage |
| `workflows/tools.py` | `langchain_core.tools` | `@tool` decorator for defining agent tool functions |
| `knowledge_rag/services.py` | `langchain_huggingface.HuggingFaceEmbeddings` | Embedding model wrapper for dense vector search |
| `knowledge_rag/ingestion.py` | `langchain_community.PyPDFLoader` | PDF parsing |
| `knowledge_rag/ingestion.py` | `langchain_text_splitters.RecursiveCharacterTextSplitter` | Document chunking |
| `knowledge_rag/ingestion.py` | `langchain_huggingface.HuggingFaceEmbeddings` | Embedding generation during ingestion |

---

## What LangGraph Does

LangGraph provides the **orchestration layer** — it defines the order of operations as a state machine, manages shared state between steps, and persists conversation threads via its Postgres checkpointer.

| File | Import | Purpose |
|------|--------|---------|
| `workflows/agent.py` | `langgraph.graph.StateGraph`, `END` | Defines the multi-step agent workflow as a directed graph |
| `workflows/agent.py` | `langgraph.graph.message.add_messages` | State reducer for message history |
| `workflows/tasks.py` | `langgraph.checkpoint.postgres.PostgresSaver` | Persistent conversation state across Celery task invocations |

### The Workflow Graph

```
classify_query → retrieve_rulebook_context → compose_grounded_answer → self_reflect → END
```

1. **classify_query** — Intent detection and query planning
2. **retrieve_rulebook_context** — Hybrid search + reranking via Qdrant
3. **compose_grounded_answer** — LLM-grounded response generation with citations
4. **self_reflect** — Verify answer quality and completeness

---

## Why Both Are Used

**LangChain** = individual components (LLM calls, embeddings, document parsing, chunking)
**LangGraph** = orchestration (connecting those components into a multi-step pipeline with state management and persistence)

They are complementary, not redundant. LangGraph *depends on* LangChain (specifically `langchain-core`) for message types and abstractions.

---

## Was the Use Necessary?

### LangChain: Partially Necessary, Partially Overkill

| Component | Needed? | Why |
|-----------|---------|-----|
| `langchain_groq.ChatGroq` | Reasonable | Wraps the Groq API with a clean interface. Could be replaced with raw `groq` SDK calls, but the wrapper is convenient. |
| `langchain_core.messages` | Overkill | `HumanMessage`/`SystemMessage` are just simple data classes. Could use plain strings with a system/user role pattern. |
| `langchain_core.tools` | Overkill | The `@tool` decorator is used in `tools.py` but those tools are **never actually wired into the LangGraph agent** — the agent graph doesn't use them at all. The agent calls `InstitutionalRAGService` directly. |
| `langchain_huggingface` | Overkill | `HuggingFaceEmbeddings` is a thin wrapper around `sentence-transformers`. The project already has `sentence-transformers` in requirements — `model.encode()` could be called directly. |
| `langchain_community.PyPDFLoader` | Overkill | Just wraps `pypdf`. Could replace with direct `pypdf` calls. |
| `langchain_text_splitters` | Overkill | `RecursiveCharacterTextSplitter` is a text chunking utility. Could be reimplemented or replaced with simpler code. |

### LangGraph: Necessary but Partially Underutilized

| Feature | Used? | Assessment |
|---------|-------|------------|
| `StateGraph` | Yes | The core graph structure for the agent pipeline. This is the right tool for the job. |
| `add_messages` | Yes | State reducer for accumulating messages across nodes. |
| Postgres checkpointer | Yes | Enables conversation persistence across Celery tasks. Genuinely useful. |
| Conditional edges | No | The graph is purely linear (`A→B→C→D→END`). No branching logic is used — a simple function chain could achieve the same result. |
| Human-in-the-loop | Not wired | `ActionApproval` model exists for pausing and resuming, but `resume_agent_thread_task` is a stub that just returns a dict. |

---

## Dead Code

`tools.py` defines the following tools with the `@tool` decorator, but they are **never connected to the LangGraph agent graph**:

- `retrieve_policy_documents` — duplicates what `InstitutionalRAGService` already does
- `request_certificate_service` — stub for transcript/certificate generation
- `create_maintenance_ticket` — stub for facility maintenance logging
- `book_laboratory` — stub for lab reservation

These appear to be scaffolding for future multi-tool orchestration that was never completed.

---

## Summary

| Question | Answer |
|----------|--------|
| **What does LangChain do?** | Provides LLM wrappers, message types, embedding wrappers, document loaders, text splitters, and tool decorators |
| **What does LangGraph do?** | Orchestrates a 4-node linear pipeline with shared state and optional Postgres persistence |
| **Why both?** | LangGraph builds on LangChain's message types and LLM wrappers — they're designed to work together |
| **Was LangChain necessary?** | Partially. The Groq wrapper and checkpointer are useful. But most imports (`PyPDFLoader`, `HuggingFaceEmbeddings`, `RecursiveCharacterTextSplitter`, `@tool`) could be replaced with direct library calls since the project already depends on those libraries directly |
| **Was LangGraph necessary?** | Yes, for the checkpointing/persistence feature. But the graph itself is linear (no branching), so a simpler function chain could theoretically work — LangGraph's value here is mainly the state management and checkpointer integration |
| **Dead code?** | `tools.py` defines tools with `@tool` but they're never connected to the agent graph |
