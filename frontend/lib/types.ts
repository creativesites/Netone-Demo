export interface PipelineStep {
  key: string;
  label: string;
  status: 'ok' | 'error' | 'info' | 'pending';
  detail?: string;
  at: string;
}

export interface Lead {
  id: number;
  external_contact_id: string;
  channel: string;
  source: string;
  name: string | null;
  phone: string | null;
  initial_message: string;
  intent: string | null;
  product: string | null;
  financing_interest: boolean | null;
  purchase_intent: string | null;
  qualification_status: string | null;
  ai_reasoning: string | null;
  ai_summary: string | null;
  ai_source: string | null;
  bitrix_lead_id: string | null;
  bitrix_status: 'pending' | 'synced' | 'failed' | null;
  bitrix_synced_at: string | null;
  assigned_to: string | null;
  next_action: string | null;
  collected?: CollectedProfile | null;
  profile_complete?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CollectedProfile {
  name: string | null;
  product: string | null;
  financing: string | null;
  budget: string | null;
  location: string | null;
}

export interface Conversation {
  id: number;
  channel: string;
  external_contact_id: string;
  contact_name: string | null;
  phone: string | null;
  raw_reply_address?: string | null;
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

export interface ChatMessage {
  id: number;
  conversation_id: number;
  direction: 'inbound' | 'outbound';
  sender: 'contact' | 'agent' | 'system';
  body: string;
  external_message_id: string | null;
  created_at: string;
}

export interface LeadEvent {
  id: number;
  event_type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Metrics {
  leadsToday: number;
  qualified: number;
  needsFollowUp: number;
  syncedToCrm: number;
}

export interface IntegrationStatus {
  whatsapp: { status: string; detail?: string };
  leadEngine: { status: string; detail?: string };
  bitrix: { status: string; detail?: string };
  ai: { status: string; provider: string };
}

export interface ActiveEvent {
  correlationId: string;
  channel: string;
  contact: { name: string | null; phone: string | null };
  message: string;
  receivedAt: string;
  steps: PipelineStep[];
}
