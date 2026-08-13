/** Inbound channel webhooks. Each channel has its own adapter; all normalize. */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { whatsappAdapter } from '../adapters/channels/whatsapp.adapter.js';
import { processEvent } from '../services/lead.service.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/channels/whatsapp/webhook', async (req, reply) => {
    // Shared-secret check (defense against random internet POSTs).
    if (config.webhookSecret) {
      const provided = req.headers['x-webhook-secret'];
      if (provided !== config.webhookSecret) {
        return reply.code(401).send({ ok: false, error: 'invalid webhook secret' });
      }
    }

    let event;
    try {
      event = whatsappAdapter.toNormalizedEvent(req.body);
    } catch (err) {
      logger.warn({ err: String(err), body: req.body }, 'Rejected malformed WhatsApp payload');
      return reply.code(400).send({ ok: false, error: 'invalid payload' });
    }

    // Respond fast; run the (deliberately paced) pipeline in the background.
    void processEvent(event).catch((err) =>
      logger.error({ err: String(err) }, 'processEvent crashed')
    );

    return reply.code(202).send({ ok: true, accepted: true });
  });
}
