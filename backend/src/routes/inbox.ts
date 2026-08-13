/** Inbox REST (Firestore is the primary real-time source; this backs it up). */
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { logger } from '../logger.js';
import {
  listConversations,
  getConversation,
  getMessages,
  addMessage,
  markRead,
} from '../db/conversations.repo.js';
import { mirrorConversation, mirrorMessage } from '../firebase.js';

export async function inboxRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/conversations', async () => ({ conversations: await listConversations(50) }));

  app.get('/api/conversations/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid id' });
    const conversation = await getConversation(id);
    if (!conversation) return reply.code(404).send({ error: 'not found' });
    return { conversation, messages: await getMessages(id) };
  });

  app.post('/api/conversations/:id/read', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid id' });
    await markRead(id);
    const conv = await getConversation(id);
    if (conv) await mirrorConversation(conv as unknown as Record<string, unknown>);
    return { ok: true };
  });

  // Manual reply from the inbox reply dock (human agent).
  app.post('/api/conversations/:id/send', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const text = String((req.body as { text?: string })?.text ?? '').trim();
    if (!Number.isInteger(id) || !text) return reply.code(400).send({ error: 'id and text required' });
    const conv = await getConversation(id);
    if (!conv) return reply.code(404).send({ error: 'not found' });

    let delivered = false;
    try {
      const res = await fetch(`${config.whatsappServiceUrl.replace(/\/+$/, '')}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: conv.phone ?? conv.external_contact_id, text }),
      });
      delivered = res.ok;
    } catch (err) {
      logger.warn({ err: String(err) }, 'Manual send failed (WhatsApp offline?)');
    }

    const msg = await addMessage(id, 'outbound', 'agent', text, null);
    const updated = await getConversation(id);
    await mirrorMessage(id, msg as unknown as Record<string, unknown>);
    if (updated) await mirrorConversation(updated as unknown as Record<string, unknown>);
    return { ok: true, delivered };
  });
}
