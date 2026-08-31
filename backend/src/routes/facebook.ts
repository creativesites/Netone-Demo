/**
 * Facebook Messenger webhook — Meta's verify handshake + inbound events.
 *
 * Registered as its own encapsulated Fastify plugin (like webhook.ts and
 * whatsapp.ts) so the raw-body content-type parser below — needed to verify
 * Meta's X-Hub-Signature-256, which requires the exact original bytes, not
 * Fastify's already-parsed JSON — only applies to these two routes and
 * never touches the rest of the app's JSON parsing.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config, flags } from '../config.js';
import { logger } from '../logger.js';
import { facebookAdapter } from '../adapters/channels/facebook.adapter.js';
import { getProfileName } from '../services/facebookGraph.service.js';
import { processEvent } from '../services/lead.service.js';

function verifySignature(rawBody: Buffer, header: string | undefined): boolean {
  if (!header || !config.facebook.appSecret) return false;
  const expected = 'sha256=' + createHmac('sha256', config.facebook.appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface MessengerEntry {
  messaging?: {
    sender?: { id?: string };
    recipient?: { id?: string };
    timestamp?: number;
    message?: { mid?: string; text?: string; is_echo?: boolean };
  }[];
}

export async function facebookRoutes(app: FastifyInstance): Promise<void> {
  // Preserve the raw bytes Meta signed — the default JSON parser discards them.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body as Buffer;
    try {
      done(null, JSON.parse((body as Buffer).toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Meta's one-time webhook verification handshake.
  app.get('/api/channels/facebook/webhook', async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === config.facebook.verifyToken) {
      return reply.code(200).send(q['hub.challenge']);
    }
    return reply.code(403).send();
  });

  app.post('/api/channels/facebook/webhook', async (req, reply) => {
    // ACK immediately — Meta expects a fast 200 and retries aggressively otherwise.
    reply.code(200).send('EVENT_RECEIVED');

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody || !verifySignature(rawBody, req.headers['x-hub-signature-256'] as string | undefined)) {
      logger.warn('Rejected Facebook webhook — invalid or missing signature');
      return;
    }
    if (!flags.hasFacebook) {
      logger.warn('Facebook webhook received but FACEBOOK_* env vars are not configured');
      return;
    }

    const body = req.body as { object?: string; entry?: MessengerEntry[] };
    if (body.object !== 'page') return;

    for (const entry of body.entry ?? []) {
      for (const messaging of entry.messaging ?? []) {
        // Skip echoes (our own sent messages looping back) and non-text
        // events (postbacks, attachments, read receipts) — out of scope.
        if (!messaging.message?.text || messaging.message.is_echo) continue;
        try {
          const senderName = await getProfileName(messaging.sender!.id!);
          const event = facebookAdapter.toNormalizedEvent({ event: messaging, senderName });
          void processEvent(event).catch((err) =>
            logger.error({ err: String(err) }, 'Facebook processEvent crashed')
          );
        } catch (err) {
          logger.warn({ err: String(err), messaging }, 'Rejected malformed Facebook messaging event');
        }
      }
    }
  });
}
