/** Aggregate integration health for the dashboard header. */
import { config, flags } from '../config.js';

export interface IntegrationStatus {
  whatsapp: { status: 'connected' | 'connecting' | 'disconnected' | 'unknown'; detail?: string };
  leadEngine: { status: 'online'; detail?: string };
  bitrix: { status: 'connected' | 'not_configured' | 'error'; detail?: string };
  facebook: { status: 'connected' | 'not_configured'; detail?: string };
  ai: { status: 'connected' | 'fallback'; provider: string };
}

/**
 * Bitrix health is PROBED, not assumed. Reporting "connected" just because
 * an env var is set is how a dashboard ends up claiming the CRM is fine
 * while every single sync is failing — exactly what happened when the demo
 * portal's REST API got disabled (FEATURE_NOT_AVAILABLE_ON_CURRENT_PLAN)
 * and the header still showed a green "Connected" pill. Cached briefly so
 * the 15s status heartbeat doesn't hammer the Bitrix API.
 */
let bitrixProbe: { at: number; ok: boolean; detail: string } | null = null;
const BITRIX_PROBE_TTL_MS = 60_000;

async function probeBitrix(): Promise<{ ok: boolean; detail: string }> {
  if (bitrixProbe && Date.now() - bitrixProbe.at < BITRIX_PROBE_TTL_MS) {
    return { ok: bitrixProbe.ok, detail: bitrixProbe.detail };
  }
  let result = { ok: false, detail: 'unreachable' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${config.bitrix.webhookUrl.replace(/\/+$/, '')}/profile.json`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as { error?: string; error_description?: string };
    result = json?.error
      ? { ok: false, detail: json.error_description || json.error }
      : { ok: true, detail: 'Bitrix24 REST API responding' };
  } catch (err) {
    result = { ok: false, detail: 'Bitrix24 unreachable' };
  }
  bitrixProbe = { at: Date.now(), ...result };
  return result;
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  let whatsapp: IntegrationStatus['whatsapp'] = { status: 'unknown' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${config.whatsappServiceUrl.replace(/\/+$/, '')}/status`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as { status?: string };
    whatsapp = { status: (json.status as any) ?? 'unknown' };
  } catch {
    whatsapp = { status: 'disconnected', detail: 'service unreachable' };
  }

  return {
    whatsapp,
    leadEngine: { status: 'online' },
    bitrix: !flags.hasBitrix
      ? ({ status: 'not_configured', detail: 'set BITRIX24_WEBHOOK_URL' } as const)
      : (await probeBitrix()).ok
        ? ({ status: 'connected', detail: 'Bitrix24 REST API responding' } as const)
        : ({ status: 'error', detail: (await probeBitrix()).detail } as const),
    facebook: flags.hasFacebook
      ? { status: 'connected', detail: 'Messenger Page configured' }
      : { status: 'not_configured', detail: 'set FACEBOOK_PAGE_ACCESS_TOKEN' },
    ai: flags.hasDeepseek || flags.hasGemini
      ? { status: 'connected', provider: config.ai.provider }
      : { status: 'fallback', provider: 'deterministic' },
  };
}
