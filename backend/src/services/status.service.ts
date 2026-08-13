/** Aggregate integration health for the dashboard header. */
import { config, flags } from '../config.js';

export interface IntegrationStatus {
  whatsapp: { status: 'connected' | 'connecting' | 'disconnected' | 'unknown'; detail?: string };
  leadEngine: { status: 'online'; detail?: string };
  bitrix: { status: 'connected' | 'not_configured'; detail?: string };
  ai: { status: 'connected' | 'fallback'; provider: string };
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
    bitrix: flags.hasBitrix
      ? { status: 'connected', detail: 'Bitrix24 webhook configured' }
      : { status: 'not_configured', detail: 'set BITRIX24_WEBHOOK_URL' },
    ai: flags.hasDeepseek || flags.hasGemini
      ? { status: 'connected', provider: config.ai.provider }
      : { status: 'fallback', provider: 'deterministic' },
  };
}
