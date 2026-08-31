/**
 * Facebook Messenger channel adapter.
 *
 * Responsibility: take one raw Meta Messenger `messaging` entry and turn it
 * into a NormalizedLeadEvent — the exact same channel-neutral shape
 * whatsapp.adapter.ts produces. Nothing downstream (AI, qualification,
 * Bitrix, dashboard) knows or cares that this message came from Messenger
 * instead of WhatsApp.
 */
import { z } from 'zod';
import type { NormalizedLeadEvent } from '../../types.js';
import type { ChannelAdapter } from './whatsapp.adapter.js';

// One entry of the `entry[].messaging[]` array Meta posts to the webhook.
// Echoes (our own sent messages looping back) and non-text events
// (postbacks, attachments, read receipts) are filtered out by the caller
// before this schema runs — see routes/facebook.ts.
const messengerEventSchema = z.object({
  sender: z.object({ id: z.string().min(1) }),
  recipient: z.object({ id: z.string().min(1) }),
  timestamp: z.number().optional(),
  message: z.object({
    mid: z.string().min(1),
    text: z.string().min(1),
    is_echo: z.boolean().optional(),
  }),
});

export interface FacebookNormalizeInput {
  event: unknown;
  /** Resolved via facebookGraph.service.ts::getProfileName() by the caller
   *  — Messenger doesn't include a display name on the message event
   *  itself the way WhatsApp payloads do. */
  senderName: string | null;
}

export const facebookAdapter: ChannelAdapter<FacebookNormalizeInput> = {
  channel: 'facebook',
  toNormalizedEvent({ event, senderName }: FacebookNormalizeInput): NormalizedLeadEvent {
    const p = messengerEventSchema.parse(event);
    return {
      channel: 'facebook',
      externalMessageId: p.message.mid,
      externalContactId: p.sender.id,
      name: senderName,
      // Messenger PSIDs are not phone numbers — no dialable contact exists
      // for this channel, matching how WhatsApp LID-only contacts already
      // pass `phone: null` through this same field.
      phone: null,
      message: p.message.text.trim(),
      timestamp: p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString(),
      metadata: { pageId: p.recipient.id, psid: p.sender.id },
    };
  },
};
