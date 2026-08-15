/** Data-access for inbox conversations and messages. */
import { query } from './pool.js';

export interface Conversation {
  id: number;
  channel: string;
  external_contact_id: string;
  contact_name: string | null;
  phone: string | null;
  // Exact channel-native reply-to address (e.g. a WhatsApp JID). Not always a
  // dialable phone number — see whatsapp-service's LID handling. Always
  // prefer this over `phone` when sending a reply; it's the address the
  // contact actually messaged in from.
  raw_reply_address: string | null;
  is_lead: boolean;
  lead_id: number | null;
  last_message: string | null;
  last_direction: string | null;
  last_message_at: string | null;
  unread_count: number;
  intent: string | null;
  sentiment: string | null;
  ai_priority: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  direction: 'inbound' | 'outbound';
  sender: 'contact' | 'agent' | 'system';
  body: string;
  external_message_id: string | null;
  created_at: string;
}

/** Find or create the conversation for a contact/channel. */
export async function upsertConversation(
  channel: string,
  externalContactId: string,
  contactName: string | null,
  phone: string | null,
  rawReplyAddress: string | null = null
): Promise<Conversation> {
  const res = await query<Conversation>(
    `INSERT INTO conversations (channel, external_contact_id, contact_name, phone, raw_reply_address)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (channel, external_contact_id) DO UPDATE SET
        contact_name = COALESCE(EXCLUDED.contact_name, conversations.contact_name),
        phone = COALESCE(EXCLUDED.phone, conversations.phone),
        raw_reply_address = COALESCE(EXCLUDED.raw_reply_address, conversations.raw_reply_address),
        updated_at = now()
     RETURNING *`,
    [channel, externalContactId, contactName, phone, rawReplyAddress]
  );
  return res.rows[0];
}

export async function addMessage(
  conversationId: number,
  direction: 'inbound' | 'outbound',
  sender: 'contact' | 'agent' | 'system',
  body: string,
  externalMessageId: string | null
): Promise<Message> {
  const res = await query<Message>(
    `INSERT INTO messages (conversation_id, direction, sender, body, external_message_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [conversationId, direction, sender, body, externalMessageId]
  );
  // Roll up onto the conversation for list previews.
  await query(
    `UPDATE conversations SET
        last_message = $2,
        last_direction = $3,
        last_message_at = now(),
        unread_count = CASE WHEN $3 = 'inbound' THEN unread_count + 1 ELSE unread_count END,
        updated_at = now()
      WHERE id = $1`,
    [conversationId, body.slice(0, 280), direction]
  );
  return res.rows[0];
}

export async function updateConversationMeta(
  conversationId: number,
  meta: {
    is_lead?: boolean;
    lead_id?: number | null;
    intent?: string | null;
    sentiment?: string | null;
    ai_priority?: string | null;
  }
): Promise<Conversation> {
  const res = await query<Conversation>(
    `UPDATE conversations SET
        is_lead = COALESCE($2, is_lead),
        lead_id = COALESCE($3, lead_id),
        intent = COALESCE($4, intent),
        sentiment = COALESCE($5, sentiment),
        ai_priority = COALESCE($6, ai_priority),
        updated_at = now()
      WHERE id = $1 RETURNING *`,
    [
      conversationId,
      meta.is_lead ?? null,
      meta.lead_id ?? null,
      meta.intent ?? null,
      meta.sentiment ?? null,
      meta.ai_priority ?? null,
    ]
  );
  return res.rows[0];
}

export async function markRead(conversationId: number): Promise<void> {
  await query(`UPDATE conversations SET unread_count = 0, updated_at = now() WHERE id = $1`, [
    conversationId,
  ]);
}

export async function listConversations(limit = 50): Promise<Conversation[]> {
  const res = await query<Conversation>(
    `SELECT * FROM conversations ORDER BY last_message_at DESC NULLS LAST, updated_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function getConversation(id: number): Promise<Conversation | null> {
  const res = await query<Conversation>(`SELECT * FROM conversations WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function getMessages(conversationId: number, limit = 200): Promise<Message[]> {
  const res = await query<Message>(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC LIMIT $2`,
    [conversationId, limit]
  );
  return res.rows;
}

export async function getRecentMessages(conversationId: number, limit = 12): Promise<Message[]> {
  const res = await query<Message>(
    `SELECT * FROM (
        SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2
     ) t ORDER BY created_at ASC, id ASC`,
    [conversationId, limit]
  );
  return res.rows;
}
