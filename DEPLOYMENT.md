# Deployment & Updating Guide

NetOne Lead Automation has four runtime pieces. They do **not** all deploy the
same way — this guide covers each and how they wire together.

| Component | What it is | Where it runs |
|---|---|---|
| **frontend** | Next.js console (dashboard + inbox) | **Vercel** (or any Next host) |
| **backend** | Fastify API: adapters, AI, CRM, Firestore mirror, SSE | Container host with **public HTTPS** |
| **whatsapp** | Baileys WhatsApp bridge (persistent session) | Container host with a **persistent volume** |
| **postgres** | Source-of-truth database | Managed Postgres or a container |

```
 Browser ── HTTPS ──▶ Vercel (frontend)
                         │  REST + SSE (HTTPS)
                         ▼
                     backend  ◀── internal ──  whatsapp (Baileys)
                         │                         ▲
                         ├─ Postgres               │ WhatsApp Web (QR link)
                         ├─ Firestore (real-time)
                         └─ Bitrix24 / DeepSeek (HTTPS out)
```

> **Key rule:** the browser loads the frontend over HTTPS, so the backend it
> talks to **must also be HTTPS** (a browser on an `https://` page cannot call an
> `http://` API — mixed content is blocked). Give the backend a TLS endpoint.

---

## 1. Environment variables (complete reference)

Copy `.env.example` → `.env` and fill these. Secrets live only in `.env`
(git-ignored) and each platform's secret store — never in the repo.

### Backend (+ whatsapp + postgres)
| Variable | Example / notes |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/netone_leads` |
| `BACKEND_PORT` | `4000` |
| `WEBHOOK_SHARED_SECRET` | random string; the whatsapp service sends it |
| `DEEPSEEK_API_KEY` | your DeepSeek key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | `deepseek-chat` |
| `GEMINI_API_KEY` | optional fallback |
| `AI_PROVIDER` | `deepseek` |
| `BITRIX24_WEBHOOK_URL` | `https://<portal>.bitrix24.com/rest/<user>/<token>/` |
| `BITRIX24_ASSIGNED_BY_ID` | Bitrix user id for lead assignment |
| `FIREBASE_PROJECT_ID` | `crm-integrations-ca0ce` |
| `FIREBASE_ADMIN_CREDENTIALS` | path to service-account JSON (mounted/secret file) |
| `WHATSAPP_SERVICE_URL` | `http://whatsapp:3000` (internal) |
| `AUTO_REPLY_DEFAULT` | `true` |

### WhatsApp service
| Variable | Notes |
|---|---|
| `PORT` | `3000` |
| `SESSION_DIR` | `/app/session` (mounted volume — **persist this**) |
| `BACKEND_WEBHOOK_URL` | `http://backend:4000/api/channels/whatsapp/webhook` |
| `WEBHOOK_SHARED_SECRET` | must match the backend's |

### Frontend (Vercel)
| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | **public HTTPS URL of the backend**, e.g. `https://api.yourdomain.com` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` … `_APP_ID` | the 6 public Firebase web-config values |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key (server-only) |
| `DISABLE_AUTH` | optional; `true` opens the console without Clerk sign-in |

---

## 2. Frontend → Vercel

The repo is a **monorepo**; the Next app lives in `frontend/`. This is the #1
cause of Vercel failures (`No Next.js version detected`) — you must point Vercel
at the subdirectory.

1. **Import the repo** at [vercel.com/new](https://vercel.com/new).
2. **Set the Root Directory to `frontend`.**
   Project → *Settings → Build & Deployment → Root Directory* → `frontend`.
   (Framework auto-detects as Next.js; `frontend/vercel.json` pins it.)
3. **Add Environment Variables** (Settings → Environment Variables) — every
   `NEXT_PUBLIC_*` value plus `CLERK_SECRET_KEY`. Set `NEXT_PUBLIC_BACKEND_URL`
   to your backend's public HTTPS URL. `NEXT_PUBLIC_*` are read at **build time**,
   so redeploy after changing them.
4. **Deploy.** Vercel runs `next build`. The repo already disables the
   `standalone` output on Vercel (`output` is only set when not on Vercel), so no
   further config is needed.
5. **Clerk production keys:** the current keys are `pk_test_…` / `sk_test_…`
   (Clerk *development* instance). For a real domain, create a **Production**
   instance in the Clerk dashboard, add your Vercel domain, and swap in the
   `pk_live_…` / `sk_live_…` keys.

**Custom domain / CORS:** the backend uses permissive CORS (`origin: true`), so
it accepts the Vercel domain out of the box. To lock it down later, restrict the
CORS origin in `backend/src/server.ts` to your exact frontend URL.

---

## 3. Backend + WhatsApp + Postgres

The WhatsApp service needs a **long-lived process + a persistent volume** (for
the Baileys session) — that rules out serverless/Vercel. Two good options:

### Option A — Single VPS with Docker Compose (recommended)

Cleanest, because backend↔whatsapp talk over the internal Compose network and
the session volume just works.

```bash
# On the server (Docker + Docker Compose installed):
git clone <your repo> netone && cd netone
cp .env.example .env && nano .env          # fill in all backend/whatsapp values

# Put the Firebase Admin service-account JSON here (git-ignored):
mkdir -p backend/secrets
nano backend/secrets/firebase-admin.json   # paste the JSON

docker compose up -d --build               # starts postgres, backend, whatsapp, frontend
docker compose logs -f whatsapp            # watch for the QR / connection
```

Then put **HTTPS in front of the backend** (port 4000) so the browser can reach
it. Easiest is Caddy (auto-TLS):

```
# /etc/caddy/Caddyfile
api.yourdomain.com {
    reverse_proxy localhost:4000
}
qr.yourdomain.com {           # optional, only needed while linking WhatsApp
    reverse_proxy localhost:3000
}
```

Set the frontend's `NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com` on Vercel.

> You can also serve the frontend from this same Compose stack (it's included on
> port 3001) instead of Vercel — but Vercel is simpler for the Next app. If you
> use Vercel, you can remove the `frontend` service from `docker-compose.yml`.

### Option B — Managed platform (Railway / Render / Fly.io)

Deploy **backend** and **whatsapp** as two services from their Dockerfiles, plus
a managed Postgres. They provide HTTPS automatically.

- **backend** → Dockerfile `backend/Dockerfile`, expose 4000, set all backend env
  vars, attach a secret file for `backend/secrets/firebase-admin.json` (or use
  `GOOGLE_APPLICATION_CREDENTIALS`). Point `WHATSAPP_SERVICE_URL` at the
  whatsapp service's internal URL.
- **whatsapp** → Dockerfile `whatsapp-service/Dockerfile`, expose 3000, **attach a
  persistent disk mounted at `/app/session`**, set `BACKEND_WEBHOOK_URL` to the
  backend's internal URL and the shared secret.
- **postgres** → the platform's managed Postgres; set `DATABASE_URL`.

---

## 4. Link WhatsApp (one-time per session)

The Baileys session persists on the `/app/session` volume, so you only scan once
(and again only if you log the device out).

1. Reach the QR: `https://qr.yourdomain.com/qr` (Option A) or the whatsapp
   service URL `/qr` (Option B). Locally: `http://localhost:3000/qr`.
2. On the demo phone: **WhatsApp → Linked devices → Link a device** → scan.
3. The dashboard header flips **WhatsApp → Connected**. Check
   `GET <whatsapp>/status` any time.

Keep the volume across redeploys and the link survives restarts. Never commit the
`session/` directory (it's git-ignored).

---

## 5. Enable Firestore (real-time layer)

Firebase Admin authenticates already, but the database must exist:

1. [Firebase console](https://console.firebase.google.com/) → project
   `crm-integrations-ca0ce` → **Firestore Database → Create database** → **Native
   mode** → pick a region.
2. Restart the backend. It logs `Firebase Admin initialized` and mirror writes
   start succeeding; the console switches from REST polling to live `onSnapshot`.

Until this is done everything still works via the REST fallback — nothing breaks.
Lock down access later with Firestore security rules (authenticated reads only).

---

## 6. Wiring checklist

- [ ] Backend reachable at a **public HTTPS** URL.
- [ ] `NEXT_PUBLIC_BACKEND_URL` (Vercel) = that HTTPS URL; redeploy frontend.
- [ ] `WEBHOOK_SHARED_SECRET` identical on backend **and** whatsapp.
- [ ] `BACKEND_WEBHOOK_URL` (whatsapp) points at the backend.
- [ ] `WHATSAPP_SERVICE_URL` (backend) points at the whatsapp service.
- [ ] `backend/secrets/firebase-admin.json` present on the backend host.
- [ ] Bitrix + DeepSeek keys set on the backend.
- [ ] WhatsApp session volume is persistent.

---

## 7. Updating / redeploying

**Frontend (Vercel):** push to the connected branch → Vercel auto-builds. Or
`vercel --prod` from `frontend/`. Changed a `NEXT_PUBLIC_*` var? Redeploy so it's
re-baked into the bundle.

**Backend / WhatsApp (Docker Compose):**
```bash
git pull
docker compose up -d --build backend           # rebuild just the backend
docker compose up -d --build whatsapp           # rebuild just the whatsapp service
docker compose logs -f backend
```
The DB schema migrates automatically on backend startup (idempotent). The
WhatsApp session survives because the volume isn't touched.

**Backend / WhatsApp (Railway/Render):** push to the connected branch → the
platform rebuilds the changed service. Keep the whatsapp disk attached.

**Database:** migrations run on every backend boot (`ensure schema`). No manual
step. For destructive changes, back up first (`pg_dump`).

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Vercel: *No Next.js version detected* | Set **Root Directory = `frontend`**. |
| Vercel build fails on Clerk (`Missing publishableKey`) | Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and `CLERK_SECRET_KEY`) in Vercel env, redeploy. |
| Dashboard loads but no data / `Mixed Content` in console | Backend URL is `http://` while the page is `https://`. Serve the backend over HTTPS and update `NEXT_PUBLIC_BACKEND_URL`. |
| Dashboard empty, backend healthy | CORS or wrong `NEXT_PUBLIC_BACKEND_URL`. Confirm the URL and that `GET <backend>/api/status` works from your browser. |
| Backend logs *Firestore mirror DISABLED* | Firestore API/database not created — see §5. UI still runs on REST fallback. |
| WhatsApp won't connect / QR loops | Ensure the session volume is writable and persistent; hit `POST <whatsapp>/restart` with `{"force":true}` to reset the session and rescan. |
| Auto-reply not sending | WhatsApp must be **Connected**; the toggle must be **On**; `WHATSAPP_SERVICE_URL` must be reachable from the backend. |
| Lead not in Bitrix | Check `BITRIX24_WEBHOOK_URL` scope includes `crm`; backend logs show the `crm.lead.add` response. |
