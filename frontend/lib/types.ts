export interface PipelineStep {
  key: string;
  label: string;
  status: 'ok' | 'error' | 'info' | 'pending';
  detail?: string;
  at: string;
}

// The full lead lifecycle — replaces qualification_status as the field
// driving Bitrix STATUS_ID, analytics, and every UI badge. See
// backend/src/services/qualification.service.ts::deriveStage().
export type QualificationStage =
  | 'NEW'
  | 'DISCOVERING'
  | 'QUALIFICATION_PENDING'
  | 'QUALIFIED'
  | 'NEEDS_REVIEW'
  | 'DISQUALIFIED'
  | 'SALES_READY'
  | 'CONVERTED';

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
  // Legacy 3-state column, kept for backward compat — qualification_stage
  // below is canonical.
  qualification_status: string | null;
  qualification_stage?: QualificationStage | null;
  converted_at?: string | null;
  ai_reasoning: string | null;
  ai_summary: string | null;
  ai_source: string | null;
  bitrix_lead_id: string | null;
  bitrix_status: 'pending' | 'synced' | 'failed' | null;
  bitrix_synced_at: string | null;
  assigned_to: string | null;
  next_action: string | null;
  score: number | null;
  score_breakdown: ScoreCriterionResult[] | null;
  credit_risk?: 'low' | 'medium' | 'high' | 'ineligible' | 'unknown' | null;
  collected?: CollectedProfile | null;
  profile_complete?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ScoreCriterionResult {
  key: string;
  label: string;
  weight: number;
  earned: number;
  met: boolean;
  required: boolean;
}

export interface CollectedProfile {
  name: string | null;
  product: string | null;
  financing: string | null;
  budget: string | null;
  location: string | null;
  employment: string | null;
  monthlyIncome: string | null;

  // Zambia-specific structured fields — sample/demo registry, see
  // backend/src/services/fields.service.ts. Optional/additive, same as
  // the backend CollectedProfile.
  email?: string | null;
  productCategory?: string | null;
  preferredModel?: string | null;
  purchaseMethod?: 'cash' | 'financing' | 'unsure' | null;
  employmentType?: string | null;
  employerName?: string | null;
  jobTitle?: string | null;
  employmentDuration?: string | null;
  incomeFrequency?: string | null;
  incomeCurrency?: string | null;
  incomeSource?: string | null;
  incomeVerified?: 'declared' | 'verified' | 'unknown' | null;
  province?: string | null;
  district?: string | null;
  city?: string | null;
  area?: string | null;
  financingPartner?: string | null;
  financingAmount?: string | null;
  preferredRepaymentPeriod?: string | null;
  depositAvailable?: string | null;
  financingEligibilityStatus?: string | null;
}

export type FieldCategory = 'customer' | 'product' | 'employment' | 'income' | 'location' | 'financing';

export interface QualificationField {
  key: keyof CollectedProfile;
  label: string;
  category: FieldCategory;
  required: boolean;
  order: number;
  question: string;
  extractionType: 'text' | 'enum' | 'number' | 'boolean';
  options?: string[];
  source: 'ai' | 'derived' | 'manual';
}

export interface DiscoveryResult {
  totalRequired: number;
  collectedCount: number;
  completionPercentage: number;
  collected: QualificationField[];
  missing: QualificationField[];
  nextField: QualificationField | null;
}

export interface QualificationCriterionRule {
  key: string;
  label: string;
  weight: number;
  required: boolean;
}

export type EmploymentCategory =
  | 'civil_servant'
  | 'formally_employed'
  | 'self_employed'
  | 'informally_employed'
  | 'student'
  | 'unemployed';

export const EMPLOYMENT_CATEGORIES: { value: EmploymentCategory; label: string }[] = [
  { value: 'civil_servant', label: 'Civil servant' },
  { value: 'formally_employed', label: 'Formally employed' },
  { value: 'self_employed', label: 'Self-employed / business owner' },
  { value: 'informally_employed', label: 'Informally employed' },
  { value: 'student', label: 'Student' },
  { value: 'unemployed', label: 'Unemployed / no income' },
];

export interface QualificationRules {
  criteria: QualificationCriterionRule[];
  qualifiedThreshold: number;
  followUpThreshold: number;
  employmentWeights: Record<EmploymentCategory, number>;
  // Sample/demo discovery field registry — see fields.service.ts.
  fields: QualificationField[];
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
  handoff_active: boolean;
  handoff_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  direction: 'inbound' | 'outbound';
  sender: 'contact' | 'agent' | 'human' | 'system';
  body: string;
  external_message_id: string | null;
  delivery_status?: 'sent' | 'failed' | null;
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

export interface Analytics {
  totals: {
    totalLeads: number;
    qualified: number;
    needsFollowUp: number;
    unqualified: number;
    avgScore: number;
    conversionRate: number;
    bitrixSynced: number;
    bitrixPending: number;
    bitrixFailed: number;
  };
  dailyVolume: { day: string; count: number }[];
  byQualification: { status: string; count: number }[];
  byStage: { stage: string; count: number }[];
  byProduct: { product: string; count: number }[];
  byCreditRisk: { risk: string; count: number }[];
  byChannel: { channel: string; count: number }[];
}

export interface IntegrationStatus {
  whatsapp: { status: string; detail?: string };
  leadEngine: { status: string; detail?: string };
  bitrix: { status: string; detail?: string };
  ai: { status: string; provider: string };
}

export interface KbProduct {
  id: number;
  name: string;
  category: string;
  price_zmw: number | null;
  price_note: string | null;
  specs: Record<string, string>;
  description: string | null;
  financing: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface KbDocument {
  id: number;
  title: string;
  doc_type: 'note' | 'url' | 'upload';
  source: string | null;
  content: string;
  status: 'ingesting' | 'indexed' | 'failed';
  created_at: string;
}

export interface ActiveEvent {
  correlationId: string;
  channel: string;
  contact: { name: string | null; phone: string | null };
  message: string;
  receivedAt: string;
  steps: PipelineStep[];
}
