/**
 * Single source of truth for "where do API calls go".
 *
 * In the browser: ALWAYS same-origin (`''` → `/api/...`), letting Next.js
 * proxy through to the backend (app/api/[...path]/route.ts, which forwards
 * REST and streams SSE). The browser must never call the backend host
 * directly.
 *
 * Why this matters: NEXT_PUBLIC_BACKEND_URL is inlined into the client
 * bundle at BUILD time. A stale or wrong value silently breaks every
 * client-side fetch in production while the backend stays perfectly
 * healthy — which is exactly what happened when it was baked as an
 * unreachable `https://<ip>:8443` and blanked Analytics, ROI, Knowledge
 * Base, the Inbox, the WhatsApp status widget and the hand-back-to-AI
 * button all at once. Same-origin also removes mixed-content, CORS and
 * self-signed-cert failure modes entirely.
 *
 * Server-side (SSR / route handlers) there is no origin to resolve a
 * relative URL against, so the env var still applies there.
 *
 * This lived as four separate copies (realtime.ts, useLeadStream.ts,
 * useWhatsAppStatus.ts, WhatsAppConnect.tsx) which is how they drifted —
 * import this instead of writing a fifth.
 */
export function apiBase(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_BACKEND_URL || '';
}
