/**
 * WhatsApp connection control — proxied to the Baileys service so the browser
 * only ever talks to the backend (single origin, shared secret stays internal).
 */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { logger } from '../logger.js';

const WA = () => config.whatsappServiceUrl.replace(/\/+$/, '');

async function waFetch(path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(`${WA()}${path}`, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  // Live connection status (status, method, pairing code, linked user).
  app.get('/api/whatsapp/status', async (_req, reply) => {
    try {
      const res = await waFetch('/status');
      return reply.send(await res.json());
    } catch (err) {
      logger.warn({ err: String(err) }, 'whatsapp status unreachable');
      return reply.send({ status: 'disconnected', hasQr: false, pairingCode: null, error: 'service unreachable' });
    }
  });

  // Stream the QR PNG (or status SVG) straight through.
  app.get('/api/whatsapp/qr', async (_req, reply) => {
    try {
      const res = await waFetch('/qr');
      const buf = Buffer.from(await res.arrayBuffer());
      reply.header('Content-Type', res.headers.get('content-type') ?? 'image/png');
      reply.header('Cache-Control', 'no-store');
      return reply.send(buf);
    } catch (err) {
      return reply.code(502).send({ error: 'qr unavailable' });
    }
  });

  // Begin a QR link (fresh session).
  app.post('/api/whatsapp/connect/qr', async (_req, reply) => {
    try {
      const res = await waFetch('/connect/qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      return reply.send(await res.json());
    } catch (err) {
      return reply.code(502).send({ error: 'whatsapp service unreachable' });
    }
  });

  // Begin a link-with-code flow for a phone number.
  app.post('/api/whatsapp/connect/code', async (req, reply) => {
    const phone = String((req.body as { phone?: string })?.phone ?? '').replace(/\D/g, '');
    if (phone.length < 7) return reply.code(400).send({ error: 'valid phone number required' });
    try {
      const res = await waFetch('/connect/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return reply.code(res.status).send(await res.json());
    } catch (err) {
      return reply.code(502).send({ error: 'whatsapp service unreachable' });
    }
  });

  // Disconnect / relink (wipe session, show a fresh QR).
  app.post('/api/whatsapp/logout', async (_req, reply) => {
    try {
      const res = await waFetch('/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      return reply.send(await res.json());
    } catch (err) {
      return reply.code(502).send({ error: 'whatsapp service unreachable' });
    }
  });
}
