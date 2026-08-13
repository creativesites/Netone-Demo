/**
 * Core domain types. The NormalizedLeadEvent is the channel-agnostic contract:
 * every channel adapter (WhatsApp today; Meta/Instagram/TikTok/Web later) must
 * produce exactly this shape, so nothing downstream knows or cares about WhatsApp.
 */

export type Channel = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'web';

export interface NormalizedLeadEvent {
  channel: Channel;
  externalMessageId: string;
  externalContactId: string;
  name: string | null;
  phone: string | null;
  message: string;
  timestamp: string; // ISO
  metadata: Record<string, unknown>;
}

export type Intent =
  | 'product_inquiry'
  | 'financing_inquiry'
  | 'support'
  | 'complaint'
  | 'general'
  | 'unknown';

export type PurchaseIntent = 'low' | 'medium' | 'high';
export type Qualification = 'qualified' | 'needs_follow_up' | 'unqualified';

export interface LeadAnalysis {
  intent: Intent;
  product: string | null;
  financingInterest: boolean;
  purchaseIntent: PurchaseIntent;
  qualification: Qualification;
  reasoning: string;
  summary: string;
  aiSource: 'deepseek' | 'gemini' | 'deterministic';
}

export interface Lead {
  id: number;
  external_contact_id: string;
  channel: Channel;
  source: string;
  name: string | null;
  phone: string | null;
  initial_message: string;
  intent: Intent | null;
  product: string | null;
  financing_interest: boolean | null;
  purchase_intent: PurchaseIntent | null;
  qualification_status: Qualification | null;
  ai_reasoning: string | null;
  ai_summary: string | null;
  ai_source: string | null;
  bitrix_lead_id: string | null;
  bitrix_status: 'pending' | 'synced' | 'failed' | null;
  bitrix_synced_at: string | null;
  assigned_to: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
}

/** A single step in the live processing pipeline, streamed to the dashboard. */
export interface PipelineStep {
  key: string;
  label: string;
  status: 'ok' | 'error' | 'info' | 'pending';
  detail?: string;
  at: string;
}
