# BookLeaf Publishing — Author Support & Communication Portal

A full-stack Author Support & Operations Portal built for **BookLeaf Publishing**, featuring role-based Author and Admin interfaces, real-time ticket synchronization, and **Google Gemini (`gemini-2.5-flash`)** AI-assisted triage, priority scoring, and Knowledge-Base-grounded response drafting.

---

## 🔗 Live Demo & API Documentation

- **Live Web Application (Author & Admin Portals):** `[INSERT_YOUR_VERCEL_URL_HERE]`
- **Live Backend REST API:** `[INSERT_YOUR_RENDER_URL_HERE]`
- **Interactive Swagger / OpenAPI Documentation:** `[INSERT_YOUR_RENDER_URL_HERE]/docs`

---

## 🔑 Pre-Seeded Test Credentials

The application automatically seeds `bookleaf_sample_data.json` (10 Authors, 18 Books, and 3 sample tickets) on startup. You can also use the **1-Click Evaluator Quick Login** buttons directly on the login screen.

| Role | Name / Persona | Email | Password | What This Account Tests |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | BookLeaf Support Admin | `admin@bookleafpub.com` | `admin123` | Full Ticket Queue, AI Draft Editor, Category/Priority Overrides, Internal Notes |
| **Admin** | Operations Lead | `ops@bookleafpub.com` | `admin123` | Multi-admin ticket assignment workflow |
| **Author** | Priya Sharma (`AUTH001`) | `priya.sharma@email.com` | `password123` | 2 Published books (`BK001`, `BK002`) with active sales & ₹3,570 pending royalty |
| **Author** | Kavita Deshmukh (`AUTH009`) | `kavita.deshmukh@email.com` | `password123` | **Edge Cases:** `BK015` (*In Production - Typesetting*, `null` MRP/dates) & `BK016` (₹850 pending < ₹1,000 threshold) |
| **Author** | Sneha Kulkarni (`AUTH007`) | `sneha.kulkarni@email.com` | `password123` | **Edge Case:** `BK013` (*In Production - Cover Design*, `null` fields) + 2 Bestsellers |
| **Author** | Ananya Reddy (`AUTH003`) | `ananya.reddy@email.com` | `password123` | **Edge Case:** `BK005` (₹2,546 unpaid > ₹1,000 threshold with `null` last payout date) |

*(Note: All other authors `AUTH002`–`AUTH010` from `bookleaf_sample_data.json` are also seeded with password `password123`.)*

---

## 🏗️ Architecture & Tech Stack Decisions

- **Frontend — Next.js (App Router) + TypeScript + Tailwind CSS:**
  - Provides strict TypeScript interfaces (`src/types/index.ts`) that explicitly handle nullable fields (`mrp: number | null`, `publication_date: string | null`) for books still in production (`BK013`, `BK015`).
  - Implements **real-time ticket synchronization** via lightweight background polling (every 3 seconds on the Author Portal, 5 seconds on the Admin Queue) so admin responses and status transitions appear live without page refreshes.
- **Backend — Python (FastAPI) + SQLAlchemy ORM + Pydantic v2:**
  - Clean separation of concerns across `models/`, `schemas/`, `middleware/`, `services/`, and `routers/`.
  - **Automatic OpenAPI/Swagger Specification** at `/docs` and strict input validation via Pydantic (`Literal` types for allowed statuses, categories, and priorities, returning structured `422` validation errors rather than `500` crashes).
  - **Role-Based Access Control (RBAC):** JWT Bearer authentication middleware (`get_current_user` and `require_admin`). Furthermore, `sanitize_ticket_for_user()` strips admin-only internal notes (`is_internal=True`) and unapproved AI drafts from all Author API responses.
- **Database — SQLite (Local) / PostgreSQL-ready (SQLAlchemy):**
  - Zero-configuration local execution with automatic idempotent startup seeding (`app/seed.py`), while supporting cloud PostgreSQL via `DATABASE_URL`.

---

## 🤖 AI Integration Strategy (Prompt Design, Cost & Error Handling)

### 1. Model Choice Justification
We use **Google Gemini (`gemini-2.5-flash`)** via its OpenAI-compatible endpoint (`LLM_BASE_URL` / `LLM_MODEL` in `.env`).
- **Why `gemini-2.5-flash`:** It offers sub-2-second latency, native structured JSON output (`response_format={"type": "json_object"}`), strong adherence to policy rules, and a generous free tier. Because our client uses the standard OpenAI SDK configured via environment variables, the system can switch between Gemini, OpenAI (`gpt-4o-mini`), or Groq (`llama-3.1-8b-instant`) with zero code changes.

### 2. Cost & Token Optimization (66% Input Token Reduction)
- **Single-Pass Structured Inference:** Instead of making 3 separate LLM calls (Classification + Priority + Draft Generation), `analyze_ticket_with_ai()` performs **one single API call** returning `{ category, priority, reasoning, draft_response }`. This sends the system prompt and Knowledge Base only once per ticket.
- **Scoped Context Injection:** Rather than dumping the entire 18-book catalog into every prompt, `build_ticket_user_prompt()` queries the database for **only** the specific book linked to the ticket (or a compact summary of that specific author's 1–3 books if `"General / Account Level"` is selected).

### 3. Dynamic Ledger Grounding & Policy Accuracy
The prompt combines the **BookLeaf Knowledge Base** (80/20 royalty split, quarterly payouts + 45-day window, ₹1,000 minimum rollover threshold, 48-hour ISBN/stock-sync SLAs, 5–7 business day free reprints) with the author's live database numbers. As a result, AI drafts cite exact ISBNs, copies sold, pending royalty balances, and print partners.

### 4. Graceful Degradation & Fallback (`heuristic_fallback_classification`)
If the AI API is unreachable, rate-limited, times out (15s timeout), or if `LLM_API_KEY` is missing:
- Ticket creation **never fails**.
- The service catches the error, logs it, and falls back to a deterministic keyword heuristic classifier (`ai_classified=False`, `ai_draft_response=None`).
- Admins can still classify, prioritize, and reply manually, or click **"Regenerate AI Draft"** once connectivity is restored.

---

## 📡 REST API Documentation

Interactive Swagger documentation is available at `http://localhost:8000/docs`.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate with `email` & `password`; returns JWT Bearer token and user profile. |
| `GET` | `/api/auth/me` | Author / Admin | Get currently authenticated user profile. |
| `GET` | `/api/auth/admins` | Admin Only | List all admin accounts for ticket assignment. |
| `GET` | `/api/books` | Author / Admin | Authors receive only their own books; Admins receive all books. |
| `POST` | `/api/tickets` | Author | Submit a support ticket; triggers AI classification, priority scoring, and response drafting. |
| `GET` | `/api/tickets` | Author / Admin | List tickets. Supports Admin query filters: `status`, `category`, `priority`, `date_sort` (`newest` \| `oldest`). |
| `GET` | `/api/tickets/{id}` | Author / Admin | Get single ticket details & messages (internal notes stripped for Authors). |
| `PATCH` | `/api/tickets/{id}` | Admin Only | Update status, assign admin, edit AI draft, or override AI category/priority (`is_category_overridden`, `is_priority_overridden`). |
| `POST` | `/api/tickets/{id}/messages` | Author / Admin | Post a public reply (`is_internal: false`) or Admin-only internal note (`is_internal: true`). Auto-transitions `Open` tickets to `In Progress` on Admin reply. |
| `POST` | `/api/tickets/{id}/regenerate-ai` | Admin Only | Re-run Gemini AI triage and draft generation on an existing ticket. |

---

## 🚀 Local Setup Instructions

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

### 1. Start the Backend (FastAPI)
```bash
cd backend
python -m venv venv

# Activate virtual environment (Windows):
venv\Scripts\activate
# Or on macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt

# Copy environment template and add your Gemini / OpenAI / Groq API key
cp .env.example .env

# Run the FastAPI server (automatically creates tables & seeds bookleaf_sample_data.json)
uvicorn app.main:app --reload --port 8000