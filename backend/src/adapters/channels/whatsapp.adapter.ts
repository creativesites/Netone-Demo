/**
 * WhatsApp channel adapter.
 *
 * Responsibility: take the raw payload posted by the Baileys WhatsApp service and
 * turn it into a NormalizedLeadEvent — the channel-neutral shape the rest of the
 * pipeline consumes. A future MetaAdapter / InstagramAdapter / TikTokAdapter would
 * live beside this file and implement the same `toNormalizedEvent` contract.
 */
import { z } from 'zod';
import type { NormalizedLeadEvent } from '../../types.js';

const whatsappPayloadSchema = z.object({
  channel: z.literal('whatsapp'),
  externalMessageId: z.string().min(1),
  externalContactId: z.string().min(1),
  phone: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  message: z.string().min(1),
  timestamp: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export interface ChannelAdapter<TRaw = unknown> {
  channel: string;
  toNormalizedEvent(raw: TRaw): NormalizedLeadEvent;
}

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',
  toNormalizedEvent(raw: unknown): NormalizedLeadEvent {
    const p = whatsappPayloadSchema.parse(raw);
    return {
      channel: 'whatsapp',
      externalMessageId: p.externalMessageId,
      externalContactId: p.externalContactId,
      name: p.name ?? null,
      phone: p.phone ?? p.externalContactId ?? null,
      message: p.message.trim(),
      timestamp: p.timestamp ?? new Date().toISOString(),
      metadata: p.metadata ?? {},
    };
  },
};
