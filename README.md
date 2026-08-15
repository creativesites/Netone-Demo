# NetOne — Omnichannel Marketing-to-CRM Lead Automation

A live proof-of-concept demonstrating an **automated lead pipeline** from a
marketing interaction to a real CRM record:

```
Customer interaction → Channel adapter → Normalized lead event →
AI intelligence → Deterministic qualification → Local persistence →
Bitrix24 CRM (REAL) → Sales assignment / follow-up → Live dashboard
```

WhatsApp is used as the **live demo channel** because a prospect can trigger the
whole flow from their own phone. The architecture is **channel-agnostic**:
Facebook, Instagram, TikTok and Web can feed the same pipeline in production by
adding an adapter beside the WhatsApp one — nothing downstream changes.

> This is a POC. Meta/Facebook/Instagram/TikTok channels are **architectural
> placeholders only** and are not integrated. WhatsApp, the AI classification,
> the database, and Bitrix24 are **real**.

---

## Architecture

```
whatsapp-service/   Baileys WhatsApp bridge (own container + persistent session)
                    → forwards channel-neutral payloads to the backend
backend/            Fastify + TypeScript
                    ├─ adapters/channels/  WhatsApp → NormalizedLeadEvent
                    ├─ adapters/crm/       CRMAdapter interface + Bitrix24 (real)
                    ├─ services/           AI gatekeeper + conversational agent
                    │                      (DeepSeek→Gemini→deterministic),
                    │                      qualification, lead orchestrator
                    ├─ firebase.ts         Firestore mirror (real-time layer)
                    ├─ events/             SSE pub/sub bus (live pipeline)
                    └─ db/                 Postgres (leads, conversations,
                                           messages, lead_events, dedup, settings)
frontend/           Next.js + Tailwind console (Clerk auth)
                    ├─ Dashboard           live pipeline + lead intelligence
                    └─ Inbox               WhatsApp-style conversations + AI agent
postgres/           PostgreSQL 16 (source of truth)
Firebase/           Firestore (real-time) · Clerk (auth)
```

### Behavior

- **Lead gatekeeper.** Every inbound message is AI-classified first. Only genuine
  sales leads enter the CRM pipeline; non-leads (greetings, spam, support noise)
  stay in the inbox and are never pushed to Bitrix or counted as leads.
- **Conversational agent ("Nia").** Once a lead is detected, the agent replies on
  WhatsApp in a natural, friendly, professional tone and collects the core profile
  — name, product, financing preference, budget, location — over several turns,
  then enriches the Bitrix lead. Fully autonomous, with a live on/off toggle in
  the dashboard header.
- **Real-time.** The backend (Firebase Admin) mirrors conversations, messages,
  leads and metrics to **Firestore**; the console subscribes with `onSnapshot`
  listeners. A REST fallback keeps the UI live even before Firestore is enabled.
  The animated live-pipeline uses Server-Sent Events.
- **Auth.** The console is protected by **Clerk**. Set `DISABLE_AUTH=true` to run
  the demo without forcing sign-in.

### Real-time layer setup (Firebase)

The backend needs the **Cloud Firestore API enabled** and a database created:
open the [Firebase console](https://console.firebase.google.com/) → your project →
**Firestore Database → Create database** (Native mode). Until then the backend logs
a one-time notice and the UI runs on the REST fallback — nothing breaks.

The Firebase Admin service-account JSON lives at `backend/secrets/firebase-admin.json`
(git-ignored). The public web config goes in `NEXT_PUBLIC_FIREBASE_*` env vars.

### Design principles
- **Channel-agnostic core.** Every channel adapter emits the same
  `NormalizedLeadEvent`; the pipeline never references WhatsApp.
- **AI describes, code decides.** The LLM only produces Zod-validated structured
  output. Duplicate detection, persistence, CRM calls, retries, qualification
  and routing are deterministic backend code.
- **Graceful degradation.** DeepSeek → Gemini → deterministic keyword classifier,
  so the demo never dies if AI is unavailable or out of tokens. Bitrix failures
  surface on the dashboard as `failed / retry pending`.

---

## Quick start (Docker Compose)

```bash
cp .env.example .env
# Fill in: BITRIX24_WEBHOOK_URL, DEEPSEEK_API_KEY (and/or GEMINI_API_KEY),
#          WEBHOOK_SHARED_SECRET
docker compose up --build
```

Then:
1. Open the dashboard: <http://localhost:4701> — click **WhatsApp · Connect**
   in the header and either scan the QR or link with a phone-number code.
2. From another phone, send the demo number a message like
   *"Hi, I'm interested in getting a NetOne laptop on financing."*
3. Watch the dashboard react live and the lead appear in Bitrix24.

All ports default to the 47xx range (frontend `4701`, backend `4702`,
whatsapp `4703`, postgres `4705`) so the stack won't collide with other demos
on the same host — override any of them in `.env` if needed.

### Local development (without Docker)
```bash
# Postgres must be running and DATABASE_URL set (see .env).
cd backend && npm install && npm run dev      # http://localhost:4702
cd frontend && npm install && npm run dev     # http://localhost:4701
cd whatsapp-service && npm install && npm start
```

---

## Environment variables

See [`.env.example`](./.env.example). Highlights:

| Variable | Purpose |
|---|---|
| `BITRIX24_WEBHOOK_URL` | REAL inbound webhook base URL (`.../rest/<user>/<token>/`) with `crm` scope |
| `BITRIX24_ASSIGNED_BY_ID` | Bitrix user id leads are assigned to |
| `AI_PROVIDER` | `deepseek` (default) or `gemini` — first provider tried |
| `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` | AI credentials; if both blank → deterministic fallback |
| `WEBHOOK_SHARED_SECRET` | Shared secret the WhatsApp service sends to the backend webhook |
| `NEXT_PUBLIC_BACKEND_URL` | Browser-reachable backend URL for SSE/REST |
| `NEXT_PUBLIC_BITRIX24_PORTAL_URL` | Portal base URL (optional) — turns lead badges into "open in CRM" links |

**Secrets never get committed** — `.env`, the WhatsApp `session/` directory and
build artifacts are all git-ignored.

---

## WhatsApp session persistence

The Baileys service stores auth state via `useMultiFileAuthState` in
`SESSION_DIR` (`/app/session`), mounted as `./data/whatsapp_session`. The link
survives restarts; a logout clears the session and shows a fresh QR at `/qr`.

---

## Key API surface (backend)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/channels/whatsapp/webhook` | Inbound channel events (secret-guarded) |
| GET | `/api/stream` | Server-Sent Events feed for the dashboard |
| GET | `/api/leads`, `/api/leads/:id` | Lead list / detail with events |
| GET | `/api/metrics`, `/api/status` | Dashboard metrics & integration health |
| GET | `/health` | Liveness |

---

## Data model

- **leads** — one row per contact per channel; AI fields, qualification,
  Bitrix sync status + CRM lead id, assignment, next action.
- **lead_events** — append-only per-lead audit timeline.
- **processed_messages** — idempotency guard (dedup by channel + message id).
