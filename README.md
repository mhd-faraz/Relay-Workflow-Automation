# Relay — AI Workflow Orchestrator

> A production-grade, generic AI workflow orchestration platform. Define workflows as connected typed nodes, trigger them from webhooks or a UI, execute them durably in the background, pause for human approval, validate AI outputs against a schema, and recover cleanly from crashes — without ever repeating a side effect.

Built as a capstone project for the Airtribe AI-First Software Engineering Program.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [System Design](#system-design)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Option A — Run with Docker (Recommended)](#option-a--run-with-docker-recommended)
  - [Option B — Run Locally](#option-b--run-locally)
- [Environment Variables](#environment-variables)
- [Seeded Demo Workflows](#seeded-demo-workflows)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Future Enhancements](#future-enhancements)

---

## Overview

Operations teams run on workflows. An order arrives, needs to be classified, maybe needs a human to sign off on it, and then needs an action taken. In AI-first products, one or more of those steps now involves a model making a judgment call — but that judgment is only useful if the system underneath it is reliable: runs must survive crashes, side effects must never repeat, and sensitive actions must never execute without a human saying yes.

**Relay** is a general-purpose orchestration engine for exactly this pattern. It is not built around a single use case (e.g. "refund requests") — it is a reusable platform where **any** workflow can be composed from a small set of typed building blocks: an AI decision step, a branching condition, an HTTP call, a delay, a notification, an email action, and a human approval gate. A visual, drag-and-drop builder (inspired by n8n) lets a user compose a new workflow from these nodes without writing code.

The project ships with four pre-built demo workflows spanning different domains (e-commerce, customer support, content moderation, and email automation) to demonstrate that the engine is genuinely generic rather than hard-coded to one scenario.

---

## Key Features

- **Visual workflow builder** — drag-and-drop canvas (built with React Flow) for composing workflows from typed nodes, with a live properties panel for configuring each node's behavior.
- **DAG-based execution engine** — workflows are directed graphs of nodes; the engine walks the graph, resolving templated inputs (`{{field}}`, `{{parsed.field}}`) at each step.
- **Durable, crash-safe execution** — every step's status and output is persisted to MongoDB *before* the engine advances. If the worker process dies mid-run, the next worker resumes from the last completed step instead of restarting the run.
- **Draft → Publish lifecycle** — workflows are editable while in `draft`. Publishing freezes an immutable snapshot (`publishedDefinition`) so that in-flight runs are never affected by a later edit.
- **AI decision nodes** — a node can call an LLM, with its raw output validated against a developer-defined JSON schema before downstream nodes are allowed to use it. Malformed or incomplete AI output fails the step loudly rather than silently propagating bad data.
- **Pluggable AI provider adapter** — the engine talks to AI through a single adapter interface (`complete(prompt) → { text, tokenUsage }`). Swapping between Groq, OpenAI, and Gemini is a one-line environment variable change; a mock adapter is used automatically in tests so the test suite never makes a real network call.
- **Human-in-the-loop approval gates** — a run reaching an `approval` node pauses (`status: paused`), creates an `Approval` document, and will not proceed to the next node until a human explicitly approves or rejects it from the UI. Rejecting a run fails it outright; the "sensitive" downstream node is never reached without a saved approval record — this is enforced in the engine itself, not by the AI's prompt.
- **Real-world side effects** — beyond notifications, a workflow can send a real email via Gmail SMTP (Nodemailer), demonstrating that the orchestrator can drive actions with real-world consequences, gated behind human approval.
- **Idempotency & guardrails** — every step is keyed by `runId:nodeId` so a resumed run never re-executes (and never re-sends, re-charges, or re-emails) a step that already completed. A configurable `maxSteps` cap stops any workflow — including an accidental or malicious cycle — from looping forever. Webhook payloads are scanned for common prompt-injection phrases before being handed to the AI.
- **Full execution trace** — every run stores a complete, queryable trace: every step's input, output, status, timing, attempt count, and (for AI nodes) token usage.
- **Multi-tenant with shared templates** — users authenticate with email/password (JWT). Each user has their own private workflows and run history; a set of shared, read-only **template** workflows is visible to every user as a starting point, mirroring how a real SaaS product separates "my workspace" from "gallery/templates."
- **Dockerized** — the entire stack (backend, frontend, Redis) is defined in `docker-compose.yml` and comes up with a single command, with MongoDB Atlas as the one external managed dependency.

---

## Architecture

┌─────────────────┐ ┌──────────────────────────────────────────┐
│ │ HTTPS │ Backend │
│ React Frontend │────────▶│ Express API ──▶ MongoDB (Atlas) │
│ (Vite + Flow) │◀────────│ │ │
│ │ JSON │ ▼ │
└─────────────────┘ │ BullMQ Queue ──▶ Redis │
│ │ │
│ ▼ │
│ Worker Process │
│ (WorkflowEngine) │
│ │ │
│ ├──▶ AI Adapter ──▶ Groq/OpenAI/Gemini │
│ ├──▶ Email Adapter ──▶ Gmail SMTP │
│ └──▶ HTTP Node ──▶ any external API │
└──────────────────────────────────────────┘


**Request flow for a trigger:**

1. Client calls `POST /api/workflows/:id/trigger` with an input payload.
2. API creates a `Run` document (status `pending`) with a frozen snapshot of the published workflow definition, then enqueues a job on the BullMQ queue.
3. A worker process (running in the same container as the API, listening continuously) picks up the job and hands the run to the `WorkflowEngine`.
4. The engine walks the DAG node by node, persisting each step's result to MongoDB as it goes, until the run completes, fails, or pauses on an approval gate.
5. If paused, a human resolves the approval from the UI (`POST /api/approvals/:id/resolve`), which re-enqueues the same run — the engine picks up exactly where it left off.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend / API | Node.js + Express | Simple, well-understood, async-friendly |
| Database | MongoDB + Mongoose | Flexible schema for heterogeneous node configs |
| Background jobs | BullMQ + Redis | Battle-tested durable queue with built-in retry/backoff |
| AI integration | Groq (primary), OpenAI & Gemini adapters | Groq for fast, free-tier inference; adapter pattern keeps the engine provider-agnostic |
| Authentication | JWT + bcrypt | Stateless, standard |
| Email | Nodemailer (Gmail SMTP) | Demonstrates a real-world side effect behind an approval gate |
| Frontend | React (Vite) | Fast dev loop |
| Workflow canvas | React Flow | Purpose-built for node/edge editors |
| Animation | Framer Motion | Polished UI transitions |
| Testing | Jest + Supertest | Standard Node testing stack |
| Containerization | Docker + Docker Compose | One-command reproducible environment |

---

## System Design

### Run state machine

pending ──▶ running ──▶ completed
│ │
│ └──▶ paused ──▶ running (on approval) ──▶ completed
│ │
│ └──▶ failed (on rejection)
└──▶ failed (on error / step-cap exceeded)


- **pending** — run created, job enqueued, not yet picked up by a worker.
- **running** — a worker is actively executing nodes.
- **paused** — execution stopped at an `approval` node awaiting a human decision. The run's `currentNodeId` and `stepCount` are persisted so it can resume exactly here.
- **completed** — every reachable node executed successfully; final `output` is the merged context of all step outputs.
- **failed** — a node threw an unrecoverable error, an approval was rejected, or the step cap was exceeded. `failureReason` records why.

### Durable execution & crash recovery (exactly-once side effects)

The engine never trusts in-memory state across a crash. On every call to `engine.execute(runId)`:

1. It loads the `Run` and its `definitionSnapshot` fresh from MongoDB.
2. For the current node, it first checks whether a `Step` document for `(runId, nodeId)` already has `status: completed`. If so, it **skips re-execution** and reuses the stored output — this is what makes a resumed run safe to call even if the previous attempt had already finished some nodes.
3. Only if no completed step exists does it actually run the node's logic, immediately persisting a `Step` document (`idempotencyKey: "<runId>:<nodeId>"`, unique-indexed) before doing any side-effecting work.
4. The step's result (`completed` or `failed`) is written back before the engine advances to the next node.

Practically: if the worker process is killed mid-run (`docker kill`, deploy restart, crash), the in-flight step is left in a non-`completed` state; the next worker to pick up that `runId` re-evaluates from the database and re-runs only the unfinished step — already-completed steps (including ones that sent an email or called a payment API) are never repeated.

### DAG model

A workflow is a flat array of typed `node` objects, each with an `id`, a `type`, a `config` object, and either a `next: [nodeId]` array (linear) or `onTrue` / `onFalse` node IDs (for `condition` nodes). The engine resolves the next node to visit purely from this graph — there is no hard-coded sequence anywhere in the engine code, which is what makes the platform generic rather than scenario-specific.

### Approval gates are enforced in the engine, not the prompt

A `type: "approval"` node, when reached, checks for an existing `Approval` document for `(runId, nodeId)`. If none exists, it creates one (`status: pending`) and throws a special `APPROVAL_PENDING` signal that the engine catches and turns into a `paused` run — **the engine itself refuses to proceed**, independent of anything the AI "decided." The downstream node (e.g. "Send Email", "Process Payment") is structurally unreachable until a human calls the resolve endpoint, which re-enqueues the run. This satisfies the requirement that sensitive actions cannot execute unless an approval record exists, enforced by the orchestrator rather than by trusting model output.

### AI output validation & the provider adapter

Every AI node's raw response is parsed as JSON and checked against a per-node `outputSchema` (required fields + types). If the model returns malformed JSON or omits a required field, the step fails with a descriptive error rather than letting bad data silently flow into a condition or an email body. Output is also run through a lightweight extractor that pulls the JSON object out of any surrounding model "reasoning" text, since some models wrap their JSON in explanation.

The engine talks to AI exclusively through an adapter with a single method, `complete(prompt, options) → { text, tokenUsage }`. Three real adapters (Groq, OpenAI, Gemini) and one mock adapter implement this interface; which one is used is chosen entirely by `AI_PROVIDER` in the environment, and `NODE_ENV=test` always forces the mock adapter so the automated test suite never depends on a live API key or network access.

### Guardrails

- **Step cap** — every run has a `maxSteps` (default 100). The engine checks this before executing each node, so a cyclic workflow (accidental or adversarial) fails cleanly instead of looping forever.
- **Prompt-injection sanitization** — webhook payloads are scanned for phrases like "ignore previous instructions" before being handed to an AI node; matched substrings are replaced with `[SANITIZED]`.
- **Timeouts** — every outbound call (AI provider, HTTP node, mock-world calls) carries an explicit timeout so a hung external dependency can't hang a worker indefinitely.

### Multi-tenancy & templates

Every `Workflow` and `Run` document carries a `userId`. List/read/trigger endpoints scope queries to `{ $or: [{ userId: req.userId }, { isTemplate: true }] }` — a user always sees their own workflows plus a fixed set of shared, read-only templates seeded at setup time. Only the owner of a (non-template) workflow may edit, publish, or delete it; this is enforced at the controller level by scoping every mutation query with `userId`, not just by hiding buttons in the UI.

---

## Project Structure

Relay-Capstone/
├── docker-compose.yml
├── .env # root env for docker-compose (gitignored)
├── backend/
│ ├── Dockerfile
│ ├── src/
│ │ ├── config/ # env, db, redis connection setup
│ │ ├── models/ # Workflow, Run, Step, Approval, User (Mongoose)
│ │ ├── engine/
│ │ │ ├── WorkflowEngine.js # DAG walker, state machine, crash recovery
│ │ │ └── nodeRunners.js # per-node-type execution logic
│ │ ├── adapters/ # AI providers + email, swappable
│ │ ├── workers/ # BullMQ worker + queue setup
│ │ ├── controllers/, routes/ # REST API
│ │ ├── middleware/ # auth, rate limiting, error handling
│ │ └── index.js # Express app entrypoint + worker bootstrap
│ ├── seeds/demoWorkflows.js # seeds the 4 template workflows
│ └── tests/ # Jest + Supertest suite
└── frontend/
├── Dockerfile, nginx.conf
└── src/
├── pages/ # Dashboard, Workflows, Runs, Approvals, Builder, Login/Signup
├── components/builder/ # React Flow canvas, node palette, properties panel
├── context/AuthContext.jsx
└── services/api.js # Axios client with JWT interceptor


---

## Getting Started

### Option A — Run with Docker (Recommended)

This brings up the backend, frontend, and Redis together. MongoDB Atlas is used as the external database (no local Mongo container needed).

**Prerequisites:** Docker Desktop, a MongoDB Atlas connection string, and (optionally) a Groq API key and Gmail App Password for full functionality.

1. Clone the repo:
```bash
   git clone <repo-url>
   cd Relay-Capstone
```

2. Create a `.env` file in the **project root** (same level as `docker-compose.yml`):
```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   AI_PROVIDER=groq
   GROQ_API_KEY=your_groq_api_key
   OPENAI_API_KEY=
   GEMINI_API_KEY=
   GMAIL_USER=your_gmail_address
   GMAIL_APP_PASSWORD=your_gmail_app_password
   JWT_SECRET=any_long_random_string
```

3. Build and start everything:
```bash
   docker compose up --build
```

4. Open the app:
   - Frontend: **http://localhost:5174**
   - Backend health check: **http://localhost:3000/health**

5. Seed the demo template workflows (one-time, run against the backend container):
```bash
   docker exec -it relay-backend node seeds/demoWorkflows.js
```

6. Sign up for an account in the UI, and you'll see both your own workflows and the shared templates.

---

### Option B — Run Locally

**Prerequisites:** Node.js 20+, a local or Docker Redis instance, MongoDB Atlas connection string.

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # fill in your own values
npm run seed            # seeds the 4 demo template workflows
npm run dev              # starts Express API + BullMQ worker on :3000
```

**Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev               # starts Vite dev server, typically on :5174
```

**Redis** (if not already running — Docker is the easiest path):
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `REDIS_HOST` / `REDIS_PORT` | ✅ (local only) | Redis connection; hard-coded to the `redis` service name in Docker |
| `AI_PROVIDER` | ✅ | One of `groq`, `openai`, `gemini` — selects which adapter the engine uses |
| `GROQ_API_KEY` | depends | Required if `AI_PROVIDER=groq` |
| `OPENAI_API_KEY` | depends | Required if `AI_PROVIDER=openai` |
| `GEMINI_API_KEY` | depends | Required if `AI_PROVIDER=gemini` |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | optional | Needed only to use the "Send Email" node; generate an App Password from your Google Account security settings (not your normal Gmail password) |
| `JWT_SECRET` | ✅ | Secret used to sign auth tokens |
| `MAX_STEPS_PER_RUN` | optional | Default step cap per run (default: 100) |

---

## Seeded Demo Workflows

Four workflows ship as shared templates, visible to every user, to demonstrate the platform is genuinely generic:

1. **E-Commerce Order Processing** — AI classifies an incoming order, conditionally routes high-value orders through a manager approval gate, notifies fulfillment, calls a payment endpoint, and confirms completion.
2. **Support Ticket Router** — AI classifies a support message by urgency/category, escalates high-urgency tickets through an approval gate, and routes the ticket with an SLA delay.
3. **Content Moderation Pipeline** — AI reviews user-generated content for policy violations; unsafe content is routed to a human-review approval gate before a final decision is recorded.
4. **Email Automation** — AI drafts a professional email from a short topic, a human reviews and approves the draft, and only then is a real email sent via Gmail SMTP — demonstrating an AI-drafted, human-approved, real-world action.

---

## API Reference

All endpoints below are prefixed with `/api` and (except `/auth/*` and the webhook endpoint) require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create an account, returns a JWT |
| POST | `/auth/login` | Log in, returns a JWT |
| GET | `/auth/me` | Current user info |
| POST | `/workflows` | Create a draft workflow |
| GET | `/workflows` | List your workflows + shared templates |
| GET | `/workflows/:id` | Get one workflow |
| PUT | `/workflows/:id` | Edit a draft workflow (owner only) |
| POST | `/workflows/:id/publish` | Freeze and publish a workflow (owner only) |
| DELETE | `/workflows/:id` | Delete a draft workflow (owner only) |
| POST | `/workflows/:id/trigger` | Start a run with an input payload |
| POST | `/webhooks/:id` | Public webhook trigger, authenticated via `x-webhook-secret` header |
| GET | `/runs` | List your runs |
| GET | `/runs/:id` | Get one run |
| GET | `/runs/:id/steps` | Full step-by-step trace for a run |
| GET | `/approvals?status=pending` | List approvals |
| POST | `/approvals/:id/resolve` | Approve or reject, resumes or fails the run |

---

## Authentication

Authentication is JWT-based (`bcrypt` for password hashing, 7-day token expiry). Every workflow and run carries a `userId`; API queries are always scoped to the authenticated user (plus shared templates, where applicable), so one user's private workflows and run history are never visible to another user. The webhook trigger endpoint intentionally does **not** require a JWT — it is designed for server-to-server integration, authenticated instead by a per-workflow secret sent in the `x-webhook-secret` header, exactly like how Stripe or GitHub webhooks work.

---

## Testing

```bash
cd backend
npm test
```

17 tests across three suites, all using an isolated test database and the mock AI adapter (no live API calls):

- **`workflow.test.js`** — CRUD + publish-validation rules (no nodes, missing entry node, editing/deleting a published workflow).
- **`engine.test.js`** — DAG execution, condition branching, the step cap stopping a cyclic workflow, **crash recovery** (a pre-completed step is not re-executed), and approval gates correctly pausing a run.
- **`guardrails.test.js`** — prompt-injection detection and payload sanitization, and confirming a sensitive node is structurally unreachable without a saved approval.

---

## Known Limitations

Being transparent about where this stops being a production system:

- **Single shared email identity.** All "Send Email" actions are sent from one configured Gmail account, not from each user's own address — functionally similar to how a company's automated `noreply@` address works. True per-user sending would require Google OAuth and per-user token storage, which is out of scope for this capstone.
- **No per-user rate limiting on side-effecting nodes.** A malicious user with an account could trigger many email-sending runs. A production deployment would add per-user quotas.
- **Node type library is intentionally small.** Six node types cover the demonstrated use cases; a production tool like n8n ships hundreds of pre-built integrations.
- **AI output quality depends on prompt phrasing.** The schema-validation step catches malformed JSON, but a weak prompt can still produce a technically valid but low-quality answer — this is inherent to any LLM-backed system, not specific to this engine.

---

## Future Enhancements

- Live, node-by-node highlighting on the canvas while a run is executing (not just after-the-fact traces)
- OAuth-based per-user email/Slack sending
- A richer node library (Slack, Google Sheets, database writes)
- Per-user workflow quotas and billing hooks

---

## Author

**Mohammad Faraz**
Full Stack MERN Developer & Generative AI Engineer
