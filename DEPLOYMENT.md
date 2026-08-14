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

> **Key rule:** the frontend and backend must be on the **same protocol**. If
> the frontend is served over HTTPS (e.g. Vercel), the backend must be HTTPS
> too — a browser on an `https://` page cannot call an `http://` API (mixed
> content is blocked). The simplest way to dodge this entirely on a shared
> server that doesn't have a spare domain/TLS setup: serve **both** frontend
> and backend directly over plain HTTP on their own ports (no reverse proxy,
> no cert) — see §0a below. Add HTTPS later only if you move the frontend to
> Vercel.

---

## 0. Port scheme (shared-host friendly)

Every port defaults to the **47xx range** — uncommon enough to avoid clashing
with other demos/services on the same box:

| Service | Env var | Default |
|---|---|---|
| Frontend | `FRONTEND_PORT` | `4701` |
| Backend | `BACKEND_PORT` | `4702` |
| WhatsApp bridge | `WHATSAPP_PORT` | `4703` |
| Postgres (host-exposed) | `POSTGRES_PORT` | `4705` |

All four are read from `.env` by `docker-compose.yml`, so changing a value
there is enough for the Docker path — no code edits needed. If a port still
collides on your server:

1. Pick a free port (`ss -ltn` or `lsof -i` to check what's taken).
2. Set the corresponding `*_PORT` var in `.env`.
3. Update the two values that reference another service's port directly:
   `BACKEND_WEBHOOK_URL` (whatsapp → backend) and `NEXT_PUBLIC_BACKEND_URL` /
   `WHATSAPP_SERVICE_URL` if you're not using the Compose defaults above.
4. `docker compose up -d --build`.

(Postgres's *internal* container port is always the standard `5432` —
`POSTGRES_PORT` only changes the host-side mapping used for direct `psql`
access from outside Docker.)

### 0a. Direct-port deployment (no domain, no reverse proxy)

If the box doesn't have a spare domain/TLS setup (e.g. another app already
owns port 80/443 on this host), skip Caddy entirely and hit the services by
`http://<server-ip>:<port>` directly:

- `backend` and `frontend` publish straight on the host (plain HTTP).
- `postgres` and `whatsapp` stay bound to `127.0.0.1` — nothing needs to reach
  Postgres from outside the box, and the backend reaches `whatsapp` over the
  internal Docker network regardless of any host port mapping.

```bash
docker compose up -d --build postgres backend whatsapp frontend
```

Dashboard: `http://<server-ip>:4701` · Backend: `http://<server-ip>:4702`.
Set `NEXT_PUBLIC_BACKEND_URL=http://<server-ip>:4702` in `.env` before the
`frontend` build (it's baked in at build time).

Only open the ports you're actually serving in the firewall — typically just
`FRONTEND_PORT` and `BACKEND_PORT`:
```bash
sudo ufw allow 4701/tcp
sudo ufw allow 4702/tcp
```
Leave `WHATSAPP_PORT`/`POSTGRES_PORT` closed — they're bound to localhost so
opening the firewall for them wouldn't expose them anyway, but no need to try.

This only works end-to-end if the dashboard is opened at the plain-HTTP
`http://<server-ip>:4701` URL. If the frontend instead ends up on an HTTPS
host (Vercel, or this same box behind Caddy later), point it at an HTTPS
backend — see §3 for adding a reverse proxy without disrupting anything else
already running on the box.

---

## 1. Environment variables (complete reference)

Copy `.env.example` → `.env` and fill these. Secrets live only in `.env`
(git-ignored) and each platform's secret store — never in the repo.

### Backend (+ whatsapp + postgres)
| Variable | Example / notes |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/netone_leads` |
| `BACKEND_PORT` | `4702` |
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
| `WHATSAPP_SERVICE_URL` | `http://whatsapp:4703` (internal) |
| `AUTO_REPLY_DEFAULT` | `true` |

### WhatsApp service
| Variable | Notes |
|---|---|
| `PORT` | `4703` |
| `SESSION_DIR` | `/app/session` (mounted volume — **persist this**) |
| `BACKEND_WEBHOOK_URL` | `http://backend:4702/api/channels/whatsapp/webhook` |
| `WEBHOOK_SHARED_SECRET` | must match the backend's |

### Frontend (Vercel)
| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | **public HTTPS URL of the backend**, e.g. `https://api.yourdomain.com` (locally: `http://localhost:4702`) |
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

# Skip the frontend service if it's deployed on Vercel instead:
docker compose up -d --build postgres backend whatsapp
docker compose logs -f backend             # watch it come up
```

All service ports are bound to **127.0.0.1 only** (see `docker-compose.yml`) —
nothing is reachable from the internet until you put a reverse proxy in front.
Easiest is Caddy (automatic TLS):

```
# /etc/caddy/Caddyfile
api.yourdomain.com {
    reverse_proxy localhost:4702
}
```

The WhatsApp QR/pairing-code screens don't need their own public hostname —
the dashboard's Connect modal reaches them through the backend's
`/api/whatsapp/*` proxy.

Set the frontend's `NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com` on Vercel.

> You can also serve the frontend from this same Compose stack (it's included on
> port `4701` by default, also bound to localhost) instead of Vercel — add a
> second Caddy site block reverse-proxying to `localhost:4701`.

#### No domain yet — deploying to a bare IP

Let's Encrypt (and therefore Caddy's automatic TLS) needs a real hostname, not
a bare IP. If you only have a server IP, use a free wildcard DNS service like
**[sslip.io](https://sslip.io)** — `<anything>.<ip-with-dashes>.sslip.io`
resolves straight to that IP with no signup, so Caddy can still issue a real,
browser-trusted certificate:

```
# e.g. server IP 203.0.113.9 → api.203-0-113-9.sslip.io
# /etc/caddy/Caddyfile
api.203-0-113-9.sslip.io {
    reverse_proxy localhost:4702
}
```

Then `NEXT_PUBLIC_BACKEND_URL=https://api.203-0-113-9.sslip.io`. This is a
real TLS cert (no browser warning) — just an ugly hostname. Swap in a real
domain later by editing the Caddyfile and reloading (`sudo systemctl reload caddy`).

### Option B — Managed platform (Railway / Render / Fly.io)

Deploy **backend** and **whatsapp** as two services from their Dockerfiles, plus
a managed Postgres. They provide HTTPS automatically.

- **backend** → Dockerfile `backend/Dockerfile`, expose `4702`, set all backend
  env vars, attach a secret file for `backend/secrets/firebase-admin.json` (or
  use `GOOGLE_APPLICATION_CREDENTIALS`). Point `WHATSAPP_SERVICE_URL` at the
  whatsapp service's internal URL.
- **whatsapp** → Dockerfile `whatsapp-service/Dockerfile`, expose `4703`,
  **attach a persistent disk mounted at `/app/session`**, set
  `BACKEND_WEBHOOK_URL` to the backend's internal URL and the shared secret.
- **postgres** → the platform's managed Postgres; set `DATABASE_URL`.

---

## 4. Link WhatsApp (one-time per session)

The Baileys session persists on the `/app/session` volume, so you only link once
(and again only if you log the device out).

**Easiest: link from the dashboard.** The header shows a **WhatsApp · Connect**
button. Click it and choose either:
- **Scan QR** — open WhatsApp → *Linked devices → Link a device* → scan.
- **Link with code** — enter the phone number, get an 8-character code, then on
  the phone *Linked devices → Link with phone number instead* → enter the code.

The header flips to **WhatsApp · Connected** automatically once linked. (This
works because the backend proxies `/api/whatsapp/*` to the Baileys service, so
the browser never needs direct access to it.)

You can still reach the raw QR at the whatsapp service's `/qr` if preferred.
Check status any time with `GET <backend>/api/whatsapp/status`.

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

- [ ] Backend reachable at a **public HTTPS** URL (via Caddy/nginx — the
      container port itself is bound to `127.0.0.1`, not public).
- [ ] `NEXT_PUBLIC_BACKEND_URL` (Vercel) = that HTTPS URL; redeploy frontend.
- [ ] `WEBHOOK_SHARED_SECRET` identical on backend **and** whatsapp.
- [ ] `BACKEND_WEBHOOK_URL` (whatsapp) points at the backend.
- [ ] `WHATSAPP_SERVICE_URL` (backend) points at the whatsapp service.
- [ ] `backend/secrets/firebase-admin.json` present on the backend host.
- [ ] Bitrix + DeepSeek keys set on the backend.
- [ ] WhatsApp session volume is persistent.
- [ ] Firewall (`ufw`/security group) allows only 22, 80, 443 — the raw
      service ports (`4701`–`4705`) shouldn't be internet-reachable at all.

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
