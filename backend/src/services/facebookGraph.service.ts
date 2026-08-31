/**
 * Thin Facebook Graph API client for Messenger — send + profile lookup only.
 * Mirrors the "just enough to demo" scope of bitrix24.adapter.ts: no retry
 * queue, no attachment support, real HTTP calls against the real Graph API.
 */
import { config, flags } from '../config.js';
import { logger } from '../logger.js';

const GRAPH_VERSION = 'v19.0';
const TIMEOUT_MS = 10000;

async function graphFetch(path: string, init?: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(config.facebook.pageAccessToken)}`;
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || `HTTP ${res.status}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Sends a plain-text Messenger reply to the given PSID. Returns true on success. */
export async function sendMessengerMessage(psid: string, text: string): Promise<boolean> {
  if (!flags.hasFacebook) return false;
  try {
    await graphFetch('/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text },
        messaging_type: 'RESPONSE',
      }),
    });
    return true;
  } catch (err) {
    logger.warn({ err: String(err), psid }, 'Messenger send failed');
    return false;
  }
}

/** Best-effort display name lookup — Messenger events don't carry one directly. */
export async function getProfileName(psid: string): Promise<string | null> {
  if (!flags.hasFacebook) return null;
  try {
    const json = await graphFetch(`/${psid}?fields=first_name,last_name`);
    const name = [json.first_name, json.last_name].filter(Boolean).join(' ').trim();
    return name || null;
  } catch (err) {
    logger.warn({ err: String(err), psid }, 'Messenger profile lookup failed');
    return null;
  }
}
