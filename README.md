# MemoAI

**[Live demo →](https://fyp-26-frontend.vercel.app)**

A study platform where you talk to a model, drop in a lecture PDF or slide deck, and get a flashcard deck back — then revise it on a spaced-repetition schedule that adapts to how well you actually recalled each card.

The whole language-model layer runs on **self-hosted Ollama**. No OpenAI key, no per-token cost, no student coursework leaving the machine it's marked on.

**Stack** — FastAPI · Python 3.13 · MongoDB · Ollama · Next.js 16 · React 19 · TypeScript · Tailwind v4 · Pytest · Vitest · Vercel

> A three-service monorepo. The FastAPI backend is the larger half of it.

---

## Repository layout

| Directory | What it is |
|---|---|
| [`rest-backend/`](rest-backend) | FastAPI API — auth, decks, study scheduler, LLM dispatch. 2,830 LOC, 946 LOC of tests. |
| [`web-frontend/`](web-frontend) | Next.js 16 app — chat, deck editor, study runner. 6,497 LOC TS/TSX, 12 test suites. |
| [`analytics-dashboard/`](analytics-dashboard) | Separate Next.js app reading the same MongoDB for usage charts (Recharts). |

---

## What's interesting in here

**A real spaced-repetition scheduler, not a review counter.**
[`app/services/study_service.py`](rest-backend/app/services/study_service.py) implements **SM-2**: per-card `ease_factor` (starting 2.5), `repetitions`, `interval`, `lapses` and `next_due_at`, updated from a 0–5 recall quality rating on every review. Study sessions are server-side state with a served-card ledger, so refreshing the page doesn't re-serve a card you just answered and doesn't silently drop one you didn't.

**Intent dispatch in front of the model.**
A chat message can be conversation *or* an instruction to build a deck. [`intent_service.py`](rest-backend/app/services/intent_service.py) resolves which, and extracts the card count out of natural phrasing — "make 30 flashcards", "turn this into 50 questions" — with a keyword-and-regex fast path ahead of the LLM classifier, so the common case never pays for an inference round trip. The routed request then goes to a generation pipeline that returns structured, schema-validated cards rather than prose to be scraped.

**Streaming through two hops.**
Token-by-token generation is served over **Server-Sent Events** ([`sse.py`](rest-backend/app/services/sse.py), `llm_stream_service.py`) and reaches the browser through a Next.js catch-all proxy, which is the more interesting half of the problem: after login the session cookie lives on the Vercel domain and the browser cannot send it cross-origin to the FastAPI host. [`app/api/proxy/[...path]/route.ts`](web-frontend/app/api/proxy/[...path]/route.ts) forwards every call with the cookie re-attached and pipes the response body straight through — one code path that handles JSON, multipart uploads and SSE, using `duplex: "half"` for streaming request bodies.

**Course material in, flashcards out.**
[`file_parser.py`](rest-backend/app/services/file_parser.py) extracts text from PDFs (`pypdf`) and PowerPoint decks (`python-pptx`), trimming to a context budget. Upload endpoints accept a file alongside a chat message, so "make me 40 cards from this lecture" is a single request.

**Auth done properly.**
Passwords hashed with **Argon2** via passlib ([`core/security.py`](rest-backend/app/core/security.py)) — the current password-hashing recommendation, not bcrypt-by-default. Signed session cookies via Starlette `SessionMiddleware` with `SameSite=Lax` and a `Secure` flag driven by environment, CORS restricted to an explicit origin allowlist.

**Startup that fails loudly.**
The API verifies its MongoDB connection, confirms the Ollama server and the required model are reachable, and ensures indexes exist — all before serving a request. A broken dependency surfaces at boot, not in a user's face mid-study-session.

---

## Testing

| | |
|---|---|
| Backend | 16 Pytest files, 946 LOC — routers and services separately, with `pytest-cov` coverage and **Allure** HTML reporting wired up as Pipenv scripts |
| Frontend | 12 Vitest suites via Testing Library + jsdom, covering login, register, chat, deck editor, study runner and survey flows |

```bash
# backend
cd rest-backend && pipenv install && pipenv run start
pipenv run report          # pytest + coverage + HTML report

# frontend
cd web-frontend && npm install && npm run dev
npm run test:run
```

Requires MongoDB and a running Ollama instance. Configuration is via environment variables (`SESSION_SECRET`, `FRONTEND_URL`, `HTTPS_ONLY`, `NEXT_PUBLIC_API_URL`).

## API surface

26 endpoints across five routers — `auth` (register/login/logout/me), `decks` (CRUD plus per-card patch/delete and preview), `study` (next card, rate, score), `llm` (chat, streaming chat, chat-with-file, dispatch, streaming dispatch, dispatch-with-file, chat history), and `survey` (research response capture) — 4, 8, 3, 10 and 1 respectively.

---

Final-year project, January – July 2026.
