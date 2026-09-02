# Soltryce — Institutional Academic Assistant

A production-grade RAG (Retrieval-Augmented Generation) system for campus policy and rulebook queries. Soltryce helps students, staff, and administrators find accurate, grounded information from institutional documents through an AI-powered assistant with role-based access control.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                        │
│         Dashboards · Chat · Scheduling · Rulebooks             │
└──────────────────────────┬─────────────────────────────────────┘
                           │ JWT Auth
┌──────────────────────────▼─────────────────────────────────────┐
│                     Django REST API                            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Auth/JWT │  │ Request API  │  │ Knowledge Admin API      │  │
│  │ RBAC     │  │ (queries)    │  │ (upload/manage PDFs)     │  │
│  └──────────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│  ┌──────────┐  ┌──────┴───────┐  ┌──────────┴───────────────┐  │
│  │   Labs   │  │ Clearances   │  │ Audit Log                │  │
│  │ Booking  │  │              │  │                          │  │
│  └──────────┘  └──────────────┘  └──────────────────────────┘  │
└───────────────────────┼─────────────────────┼──────────────────┘
                        │                     │
              ┌─────────▼─────────┐  ┌────────▼────────┐
              │   Celery Worker   │  │  Ingestion Task │
              │ (LangGraph Agent) │  │  (PDF→Qdrant)   │
              └─────────┬─────────┘  └────────┬────────┘
                        │                     │
         ┌──────────────▼─────────────────────▼──────────────┐
         │                    RAG Pipeline                   │
         │                                                   │
         │  1. Query Classification (intent detection)       │
         │  2. Query Rewriting (normalization, expansion)    │
         │  3. Hybrid Retrieval (Dense + BM25 + RRF)         │
         │  4. Cross-Encoder Reranking                       │
         │  5. Uncertainty Evaluation                        │
         │  6. LLM Grounded Answer Generation                │
         │  7. Self-Reflection (quality verification)        │
         └─────────────────────┬─────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐ ┌───────▼──────┐ ┌───────▼───────┐
     │   Qdrant DB   │ │  PostgreSQL  │ │   Redis       │
     │  (Vectors +   │ │  (Django +   │ │  (Celery      │
     │   Payloads)   │ │  Checkpoints)│ │   Broker)     │
     └───────────────┘ └──────────────┘ └───────────────┘
```

---

## Project Structure

```
.
├── backend/                        # Django REST API + RAG pipeline
│   ├── app/
│   │   ├── approvals/              # HITL approval queue (approve/reject agent actions)
│   │   ├── audit/                  # Audit logging for accountability
│   │   ├── knowledge_rag/          # PDF ingestion, hybrid retrieval, reranking
│   │   │   ├── ingestion.py        #   PDF → chunking → embedding → Qdrant
│   │   │   ├── services.py         #   Hybrid search (dense + BM25 + RRF)
│   │   │   ├── models.py           #   Rulebook document model
│   │   │   └── tasks.py            #   Celery tasks for async ingestion
│   │   ├── labs/                   # Lab booking management
│   │   │   ├── models.py           #   Lab and booking models
│   │   │   ├── serializers.py      #   DRF serializers
│   │   │   └── views.py            #   Booking CRUD endpoints
│   │   ├── users/                  # JWT auth, RBAC, user management
│   │   └── workflows/              # LangGraph agent, tools, request routing
│   │       ├── agent.py            #   LangGraph state graph definition
│   │       ├── tools.py            #   Tool definitions for the agent
│   │       ├── maintenance.py      #   Maintenance request triage logic
│   │       └── tasks.py            #   Celery tasks for agent execution
│   ├── backend/                    # Django project settings
│   │   ├── settings.py             #   Main settings (env-driven)
│   │   ├── urls.py                 #   Root URL configuration
│   │   └── celery.py               #   Celery app configuration
│   ├── start.sh                    # Docker entrypoint (migrate + runserver)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example                # All configurable environment variables
├── frontend/                       # React SPA (Vite + Nginx)
│   ├── src/
│   │   ├── App.jsx                 # All page components (Auth, Dashboards, Users, Rulebooks, Profile)
│   │   ├── api.js                  # Axios instance with JWT interceptors
│   │   ├── main.jsx                # React root mount
│   │   ├── index.css               # Soltryce design system (CSS custom properties, light/dark)
│   │   └── components/
│   │       ├── Chat.jsx            # Chat interface component
│   │       ├── AdminPanel.jsx      # HITL approval queue
│   │       ├── AdminSchedule.jsx   # Admin schedule management
│   │       ├── BookingSettings.jsx # Booking configuration
│   │       ├── ClearanceManager.jsx# Clearance management
│   │       ├── LabManagement.jsx   # Lab resource management
│   │       ├── ScheduleGrid.jsx    # Schedule grid display
│   │       └── StudentSchedule.jsx # Student schedule view
│   ├── nginx.conf                  # Reverse proxy config for production
│   ├── Dockerfile                  # Multi-stage: Node build → Nginx serve
│   └── package.json
├── docker-compose.yml              # Full stack orchestration
├── prompt.md                       # LLM system prompt for the assistant
├── .gitignore
└── README.md
```

---

## Key Features

### Advanced RAG Pipeline

| Feature | Description |
|---------|-------------|
| **Hybrid Search** | Combines dense semantic search (all-MiniLM-L6-v2) with BM25 sparse retrieval via Reciprocal Rank Fusion (RRF) |
| **Cross-Encoder Reranking** | ms-marco-MiniLM-L-6-v2 reranker re-scores retrieved chunks for precision |
| **Query Processing** | Intent classification (factual/procedural/comparative/temporal), query rewriting, and keyword extraction |
| **RBAC Filtering** | Role-based access control enforced at the retrieval level — students never see staff-only policies |
| **Metadata-Rich Chunks** | Section headings, keywords, categories, departments, and page numbers stored per chunk |
| **Deduplication** | SHA-256 content hashing prevents duplicate chunks and documents |
| **Self-Reflection** | Post-generation quality check for hallucination markers and citation completeness |
| **Markdown Rendering** | Frontend renders assistant responses with full markdown support (tables, headers, lists, code blocks) |

### LangGraph Agent Workflow

```
classify_query → retrieve_rulebook_context → compose_grounded_answer → self_reflect → END
```

1. **classify_query**: Detects intent (factual, procedural, comparative, temporal, ambiguous) and extracts keywords
2. **retrieve_rulebook_context**: Executes hybrid search with RBAC filtering and reranking
3. **compose_grounded_answer**: Generates LLM-grounded response with rich context and metadata
4. **self_reflect**: Verifies answer quality — checks for hallucination markers and source citations

### Document Management

- **Category-based organization**: Academic, Administrative, Financial, HR, Infrastructure, Student Life, Examination, Admission
- **Version tracking**: Document versioning with expiry dates
- **Chunk statistics**: Track chunk counts, content hashes, and ingestion errors per document
- **Force re-ingestion**: Admin action to re-process documents when policies change
- **Filtering API**: Filter documents by category and ingestion status

### Lab Booking System

- Students can request lab sessions with preferred time slots
- Administrators approve or reject bookings
- Staff can manage lab resources and availability
- Schedule grid visualization for time slot management

### Human-in-the-Loop Approvals

- Sensitive actions (maintenance routing, lab bookings) are queued for administrator review
- Administrators can approve or reject with a reason
- All decisions are audit-logged

### Frontend Capabilities

- **Responsive design**: CSS custom properties design system with light/dark mode
- **Animated UI**: Framer Motion for page transitions, hover effects, and micro-interactions
- **Role-based dashboards**: Student, Staff, and Admin views with context-specific tools
- **Markdown rendering**: Academic assistant responses render with full markdown support (tables, bold, headers, lists, blockquotes, code blocks)
- **JWT authentication**: Token refresh interceptor for seamless session management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Django 5+ / Django REST Framework |
| **AI/ML** | LangChain, LangGraph, HuggingFace Transformers, Sentence Transformers |
| **Vector DB** | Qdrant (dense vectors + payload indexes) |
| **LLM** | Groq API (configurable model) |
| **Task Queue** | Celery + Redis |
| **Database** | PostgreSQL 15 |
| **Frontend** | React 19 + Vite 8 + Framer Motion + Nginx |
| **CSS** | Custom design system with CSS custom properties, Tailwind CSS |
| **Markdown** | react-markdown for assistant response rendering |
| **Icons** | Lucide React |
| **HTTP Client** | Axios with JWT interceptors |
| **Orchestration** | Docker Compose |

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- A Groq API key (optional — falls back to source excerpts without LLM)

### 1. Clone and configure

```bash
git clone <repository-url>
cd Soltryce
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set your secrets:

```env
DJANGO_SECRET_KEY=your-secret-key-here
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 2. Start services

```bash
docker-compose up --build
```

This starts:

| Service | Description | URL |
|---------|-------------|-----|
| **web** | Django REST API | `http://localhost:8000` |
| **frontend** | React SPA (Nginx) | `http://localhost:5173` |
| **celery** | Background workers | — |
| **db** | PostgreSQL 15 | `localhost:5432` |
| **redis** | Celery broker | `localhost:6379` |
| **qdrant** | Vector database | `http://localhost:6333` |

### 3. Create admin user

```bash
docker exec -it soltryce_web python manage.py createsuperuser
```

### 4. Upload documents

Navigate to `http://localhost:8000/admin/` and upload policy PDFs via the Knowledge section. Documents are automatically ingested into the vector database.

---

## Local Development

For development without Docker:

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Edit with your local settings

# Update DATABASE_URL in .env to point to your local PostgreSQL:
# DATABASE_URL=postgres://postgres:password@localhost:5432/soltryce_ai

python manage.py migrate
python manage.py runserver
```

### Celery Worker

```bash
cd backend
celery -A backend worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` with HMR.

### Running Tests

```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm run lint
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register/` | Register new user |
| `POST` | `/api/v1/auth/login/` | Get JWT tokens |
| `POST` | `/api/v1/auth/refresh/` | Refresh access token |
| `GET` | `/api/v1/auth/me/` | Get current user profile |
| `PATCH` | `/api/v1/auth/me/` | Update profile |

### User Management (Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/users/` | List all users |
| `POST` | `/api/v1/auth/users/` | Create staff account |
| `PATCH` | `/api/v1/auth/users/<id>/` | Update user role or status |

### Knowledge Base (Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/knowledge/rulebooks/` | List all documents |
| `POST` | `/api/v1/knowledge/rulebooks/` | Upload new PDF |
| `GET` | `/api/v1/knowledge/rulebooks/<id>/` | Get document details |
| `PATCH` | `/api/v1/knowledge/rulebooks/<id>/` | Update metadata |
| `DELETE` | `/api/v1/knowledge/rulebooks/<id>/` | Remove document |

### Service Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/requests/request/` | Submit a query |
| `GET` | `/api/v1/requests/mine/` | Get own request history |
| `GET` | `/api/v1/requests/history/` | Get all requests (admin) |
| `GET` | `/api/v1/requests/pending/` | Get pending approvals (admin) |
| `GET` | `/api/v1/requests/dashboard/` | Get admin dashboard stats |
| `POST` | `/api/v1/requests/<id>/process/` | Approve or reject a request |
| `GET` | `/api/v1/requests/staff/tickets/` | Get staff maintenance tickets |
| `POST` | `/api/v1/requests/request/<id>/staff-status/` | Update ticket status |

### Lab Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/labs/` | List available labs |
| `POST` | `/api/v1/labs/` | Create lab booking request |
| `GET` | `/api/v1/labs/bookings/` | List bookings |
| `PATCH` | `/api/v1/labs/bookings/<id>/` | Update booking |

---

## Configuration Reference

### RAG Settings (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_MIN_SCORE` | `0.15` | Minimum cosine similarity threshold |
| `RAG_MAX_CHUNKS` | `8` | Maximum chunks retrieved per query |
| `RAG_DENSE_WEIGHT` | `0.7` | Weight for dense search in RRF |
| `RAG_SPARSE_WEIGHT` | `0.3` | Weight for BM25 search in RRF |
| `RAG_RERANK_TOP_K` | `5` | Chunks to keep after reranking |
| `RAG_CHUNK_SIZE` | `1000` | Characters per chunk during ingestion |
| `RAG_CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | HuggingFace dense embedding model |
| `RERANKER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Cross-encoder reranker |
| `QUERY_CLASSIFICATION_ENABLED` | `true` | Enable intent classification |

### LLM Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | *(empty)* | Groq API key (optional) |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq model identifier |

### Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://...` | PostgreSQL connection string |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | Redis broker URL |
| `CELERY_RESULT_BACKEND` | `redis://redis:6379/0` | Redis result backend |
| `QDRANT_URL` | `http://qdrant:6333` | Qdrant API endpoint |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |
| `JWT_ACCESS_TOKEN_MINUTES` | `15` | Access token lifetime |
| `JWT_REFRESH_TOKEN_DAYS` | `7` | Refresh token lifetime |

### Django Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | *(required)* | Django secret key |
| `DJANGO_DEBUG` | `False` | Debug mode |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Allowed hostnames |
| `RUNNING_IN_DOCKER` | `false` | Flag for Docker-specific config |

---

## How the RAG Pipeline Works

### 1. Ingestion Flow

```
PDF Upload → PyPDFLoader → Section-Aware Chunking → Metadata Extraction → Embedding → Qdrant Upsert
```

- PDFs are loaded page-by-page using PyPDFLoader
- Split hierarchically using RecursiveCharacterTextSplitter with custom separators
- Each chunk gets: section heading, keywords, category, department, page number
- Dense vectors generated via all-MiniLM-L6-v2 (384 dimensions)
- Upserted to Qdrant with rich payload for filtering and display
- Celery tasks handle async ingestion to avoid blocking the API

### 2. Query Flow

```
User Query → Intent Classification → Query Rewriting → Hybrid Search → Reranking → LLM Generation → Self-Reflection
```

- **Intent classification**: Determines if the query is factual, procedural, comparative, temporal, or ambiguous
- **Query rewriting**: Normalizes the query, expands acronyms, extracts keywords
- **Hybrid search**: Runs dense (vector) and sparse (BM25) search in parallel, merges via RRF
- **RBAC filtering**: Filters results based on the user's role (student/staff/admin)
- **Reranking**: Cross-encoder re-scores top chunks for precision
- **LLM generation**: Groq API generates a grounded answer with source citations
- **Self-Reflection**: Checks for hallucination markers and verifies citation completeness

### 3. Hybrid Retrieval (RRF)

```
RRF_score = Σ  1 / (k + rank_i)
            i∈{dense, sparse}
```

- Dense search captures semantic similarity
- BM25 search captures keyword/term matching
- Reciprocal Rank Fusion merges both result lists
- Configurable weights via `RAG_DENSE_WEIGHT` and `RAG_SPARSE_WEIGHT`

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Student** | Ask academic questions, submit maintenance/lab requests, view own history, see schedule |
| **Staff** | View and update assigned maintenance tickets |
| **Admin** | Full access — manage users, upload rulebooks, approve/reject requests, manage labs, view audit logs |

---

## Frontend Design System

The frontend uses a custom CSS design system defined in `index.css` via CSS custom properties.

### Theme Tokens

| Token | Purpose |
|-------|---------|
| `--brand` | Primary color palette |
| `--surface` / `--surface-elevated` | Background layers |
| `--text` / `--text-secondary` / `--text-muted` | Typography hierarchy |
| `--border` / `--border-soft` | Borders |
| `--radius` / `--radius-sm` / `--radius-xs` | Border radii |
| `--shadow-xs` through `--shadow-xl` | Elevation system |

### Dark Mode

Toggle via `data-theme="dark"` on `<html>`, which remaps all CSS custom property tokens.

### Markdown Rendering

Academic assistant responses are rendered as markdown using `react-markdown`. Supported elements:

- Headers (h1–h4)
- Bold, italic, strikethrough
- Ordered and unordered lists
- Tables with styled headers and alternating row colors
- Blockquotes with brand-colored left border
- Inline code and code blocks
- Horizontal rules
- Links with brand color hover

---

## Environment Variables Quick Reference

Copy `backend/.env.example` to `backend/.env` and configure:

```bash
cp backend/.env.example backend/.env
```

**Required:**
- `DJANGO_SECRET_KEY` — Generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`

**Optional (for LLM-powered answers):**
- `GROQ_API_KEY` — Get from [console.groq.com](https://console.groq.com)
- `GROQ_MODEL` — Default: `openai/gpt-oss-20b`

Without a Groq API key, the system returns grounded source excerpts from the rulebooks instead of LLM-generated summaries.

---

## License

This project is proprietary software for institutional use.
