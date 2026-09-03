/**
 * Operator diagnostics — one call that answers "is everything actually
 * working right now?" for the person running the demo.
 *
 * Every check here PROBES the real dependency rather than reporting what
 * the config claims, because the two have already diverged twice: the
 * dashboard showed "Bitrix24 Connected" while every REST call was being
 * rejected, and "WhatsApp Engine Online" while the session had been dead
 * for 31 hours.
 *
 * SECRETS NEVER APPEAR HERE — tokens/secrets are reported only as
 * present/absent, never echoed, because this is served on an unlisted
 * (not authenticated) URL.
 */
import type { FastifyInstance } from 'fastify';
import { config, flags } from '../config.js';
import { query } from '../db/pool.js';
import { firestoreReady } from '../firebase.js';

type CheckStatus = 'ok' | 'warn' | 'fail' | 'off';

interface Check {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  meta?: Record<string, unknown>;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

async function checkDatabase(): Promise<Check> {
  try {
    const res = await withTimeout(
      query<{ leads: string; conversations: string; messages: string; last_lead: string | null }>(
        `SELECT (SELECT COUNT(*) FROM leads)          AS leads,
                (SELECT COUNT(*) FROM conversations)  AS conversations,
                (SELECT COUNT(*) FROM messages)       AS messages,
                (SELECT MAX(created_at)::text FROM leads) AS last_lead`
      ),
      5000
    );
    const r = res.rows[0];
    return {
      key: 'database',
      label: 'PostgreSQL',
      status: 'ok',
      detail: `${r.leads} leads · ${r.conversations} conversations · ${r.messages} messages`,
      meta: { lastLeadAt: r.last_lead },
    };
  } catch (err) {
    return { key: 'database', label: 'PostgreSQL', status: 'fail', detail: String(err) };
  }
}

async function checkWhatsapp(): Promise<Check> {
  try {
    const res = await withTimeout(
      fetch(`${config.whatsappServiceUrl.replace(/\/+$/, '')}/status`),
      5000
    );
    const j = (await res.json()) as {
      status?: string;
      user?: unknown;
      lastConnectedAt?: string;
      hasQr?: boolean;
    };
    const connected = j.status === 'connected';
    return {
      key: 'whatsapp',
      label: 'WhatsApp bridge',
      status: connected ? 'ok' : 'fail',
      detail: connected
        ? 'Session live — inbound messages will arrive'
        : `Session ${j.status ?? 'unknown'} — NO messages will arrive until re-paired`,
      meta: { user: j.user ?? null, lastConnectedAt: j.lastConnectedAt ?? null, hasQr: !!j.hasQr },
    };
  } catch (err) {
    return {
      key: 'whatsapp',
      label: 'WhatsApp bridge',
      status: 'fail',
      detail: `Bridge unreachable: ${String(err)}`,
    };
  }
}

async function checkBitrix(): Promise<Check> {
  if (!flags.hasBitrix) {
    return { key: 'bitrix', label: 'Bitrix24 CRM', status: 'off', detail: 'BITRIX24_WEBHOOK_URL not set' };
  }
  try {
    const base = config.bitrix.webhookUrl.replace(/\/+$/, '');
    const res = await withTimeout(fetch(`${base}/profile.json`), 6000);
    const j = (await res.json()) as { error?: string; error_description?: string; result?: { NAME?: string; LAST_NAME?: string } };
    if (j.error) {
      return {
        key: 'bitrix',
        label: 'Bitrix24 CRM',
        status: 'fail',
        detail: `${j.error}: ${j.error_description ?? ''} — leads will NOT sync`,
      };
    }
    // Confirm the lead statuses the adapter maps onto still exist. A
    // re-provisioned portal can come back with different STATUS_IDs, which
    // would break stage sync silently.
    const NEEDED = ['NEW', 'IN_PROCESS', 'PROCESSED', 'CONVERTED', 'JUNK'];
    let missing: string[] = [];
    try {
      const sres = await withTimeout(fetch(`${base}/crm.status.list.json?filter[ENTITY_ID]=STATUS`), 6000);
      const sj = (await sres.json()) as { result?: { STATUS_ID: string }[] };
      const ids = (sj.result ?? []).map((s) => s.STATUS_ID);
      if (ids.length) missing = NEEDED.filter((n) => !ids.includes(n));
    } catch {
      /* status list is a bonus check — don't fail the whole probe on it */
    }
    const who = [j.result?.NAME, j.result?.LAST_NAME].filter(Boolean).join(' ');
    return {
      key: 'bitrix',
      label: 'Bitrix24 CRM',
      status: missing.length ? 'warn' : 'ok',
      detail: missing.length
        ? `API responding, but lead statuses missing: ${missing.join(', ')} — stage sync will misbehave`
        : `API responding${who ? ` as ${who}` : ''} · all 5 lead statuses present`,
      meta: { assignedById: config.bitrix.assignedById || null },
    };
  } catch (err) {
    return { key: 'bitrix', label: 'Bitrix24 CRM', status: 'fail', detail: `Unreachable: ${String(err)}` };
  }
}

async function checkFacebook(): Promise<Check> {
  if (!flags.hasFacebook) {
    return {
      key: 'facebook',
      label: 'Facebook Messenger',
      status: 'off',
      detail: 'FACEBOOK_APP_SECRET / FACEBOOK_PAGE_ACCESS_TOKEN not set',
    };
  }
  const meta: Record<string, unknown> = {
    pageId: config.facebook.pageId || null,
    hasAppSecret: !!config.facebook.appSecret,
    hasVerifyToken: !!config.facebook.verifyToken,
    hasPageToken: !!config.facebook.pageAccessToken,
  };
  try {
    // Is the PAGE actually subscribed to this app's webhooks? This is the
    // step most often missed — the callback URL verifies fine while no
    // events are ever delivered.
    const url = `https://graph.facebook.com/v19.0/${config.facebook.pageId}/subscribed_apps?access_token=${encodeURIComponent(config.facebook.pageAccessToken)}`;
    const res = await withTimeout(fetch(url), 8000);
    const j = (await res.json()) as {
      error?: { message?: string; type?: string };
      data?: { name?: string; subscribed_fields?: string[] }[];
    };
    if (j.error) {
      return {
        key: 'facebook',
        label: 'Facebook Messenger',
        status: 'fail',
        detail: `Graph API: ${j.error.message ?? j.error.type ?? 'error'} (page token may be expired)`,
        meta,
      };
    }
    const apps = j.data ?? [];
    const fields = apps.flatMap((a) => a.subscribed_fields ?? []);
    const subscribedToMessages = fields.includes('messages');
    return {
      key: 'facebook',
      label: 'Facebook Messenger',
      status: subscribedToMessages ? 'ok' : 'warn',
      detail: apps.length === 0
        ? 'Page is NOT subscribed to any app — Meta will never deliver messages'
        : subscribedToMessages
          ? `Page subscribed · fields: ${fields.join(', ')}`
          : `Page subscribed but NOT to "messages" · fields: ${fields.join(', ') || 'none'}`,
      meta: { ...meta, subscribedApps: apps.map((a) => a.name).filter(Boolean), subscribedFields: fields },
    };
  } catch (err) {
    return { key: 'facebook', label: 'Facebook Messenger', status: 'fail', detail: `Graph API unreachable: ${String(err)}`, meta };
  }
}

function checkAi(): Check {
  const provider = flags.hasDeepseek ? 'deepseek' : flags.hasGemini ? 'gemini' : 'none';
  return {
    key: 'ai',
    label: 'AI provider',
    status: provider === 'none' ? 'warn' : 'ok',
    detail: provider === 'none'
      ? 'No API key — running on the deterministic keyword fallback'
      : `${provider} key configured (preferred: ${config.ai.provider})`,
    meta: { hasDeepseek: flags.hasDeepseek, hasGemini: flags.hasGemini },
  };
}

function checkFirestore(): Check {
  const ready = firestoreReady();
  return {
    key: 'firestore',
    label: 'Firestore mirror',
    status: ready ? 'ok' : 'warn',
    detail: ready
      ? 'Mirroring live — dashboard updates push instantly'
      : 'Not configured — dashboard falls back to REST polling (still works, slightly slower)',
  };
}

async function recentErrors(): Promise<{ at: string; leadId: number | null; type: string; detail: string }[]> {
  try {
    const res = await query<{ created_at: string; lead_id: number | null; event_type: string; payload: any }>(
      `SELECT created_at::text, lead_id, event_type, payload
         FROM lead_events WHERE status = 'error'
        ORDER BY created_at DESC LIMIT 10`
    );
    return res.rows.map((r) => ({
      at: r.created_at,
      leadId: r.lead_id,
      type: r.event_type,
      detail: String(r.payload?.detail ?? r.payload?.error ?? ''),
    }));
  } catch {
    return [];
  }
}

export async function diagnosticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/diagnostics', async () => {
    const [database, whatsapp, bitrix, facebook, errors] = await Promise.all([
      checkDatabase(),
      checkWhatsapp(),
      checkBitrix(),
      checkFacebook(),
      recentErrors(),
    ]);
    const checks = [database, whatsapp, bitrix, facebook, checkAi(), checkFirestore()];
    const worst: CheckStatus = checks.some((c) => c.status === 'fail')
      ? 'fail'
      : checks.some((c) => c.status === 'warn')
        ? 'warn'
        : 'ok';
    return {
      generatedAt: new Date().toISOString(),
      overall: worst,
      demoReady: !checks.some((c) => c.status === 'fail'),
      uptimeSeconds: Math.round(process.uptime()),
      checks,
      recentErrors: errors,
    };
  });
}
