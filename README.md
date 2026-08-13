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
                    ├─ services/           AI (DeepSeek→Gemini→deterministic),
                    │                      qualification, lead orchestrator
                    ├─ events/             SSE pub/sub bus
                    └─ db/                 Postgres (leads, lead_events, dedup)
frontend/           Next.js + Tailwind real-time dashboard (SSE)
postgres/           PostgreSQL 16
```

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
1. Open the WhatsApp linking screen: <http://localhost:3000/qr> — scan with the
   demo phone (WhatsApp → Linked devices → Link a device).
2. Open the dashboard: <http://localhost:3001> — WhatsApp shows **Connected**.
3. From another phone, send the demo number a message like
   *"Hi, I'm interested in getting a NetOne laptop on financing."*
4. Watch the dashboard react live and the lead appear in Bitrix24.

### Local development (without Docker)
```bash
# Postgres must be running and DATABASE_URL set (see .env).
cd backend && npm install && npm run dev      # http://localhost:4000
cd frontend && npm install && npm run dev     # http://localhost:3001
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
