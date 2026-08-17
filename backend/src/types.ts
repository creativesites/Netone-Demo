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

// Internal computation only — used to cross a qualified/follow-up score
// threshold. Not written to the DB or shown to users directly anymore;
// QualificationStage (below) is the field that drives Bitrix, analytics,
// and every UI badge. Kept because the threshold math in
// qualification.service.ts still needs a "did they clear the bar" read.
export type Qualification = 'qualified' | 'needs_follow_up' | 'unqualified';

// The full lead lifecycle, replacing the 3-state Qualification everywhere
// it used to drive external behavior (Bitrix STATUS_ID, analytics, UI
// badges). Derived deterministically in qualification.service.ts from the
// Qualification threshold read above plus Discovery completeness — see
// deriveStage(). CONVERTED is the one state a human sets manually (nothing
// in this pipeline observes real deal closure automatically).
export type QualificationStage =
  | 'NEW'
  | 'DISCOVERING'
  | 'QUALIFICATION_PENDING'
  | 'QUALIFIED'
  | 'NEEDS_REVIEW'
  | 'DISQUALIFIED'
  | 'SALES_READY'
  | 'CONVERTED';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface LeadAnalysis {
  intent: Intent;
  isLead: boolean; // gatekeeper: does this message represent a sales lead?
  sentiment: Sentiment;
  product: string | null;
  financingInterest: boolean;
  purchaseIntent: PurchaseIntent;
  qualification: Qualification;
  reasoning: string;
  summary: string;
  aiSource: 'deepseek' | 'gemini' | 'deterministic';
}

/**
 * Structured lead profile the conversational agent collects over turns.
 *
 * The original 7 fields (name..monthlyIncome) are the free-text values Nia
 * has always collected and are kept exactly as-is — everything reading them
 * (Bitrix comments, IntelPanel, LeadDetail) keeps working unchanged. The
 * fields below extend the model per NetOne's Zambia-specific qualification
 * brief: structured versions of purchase method / employment / location /
 * income / financing, populated either by the AI (asked directly or
 * inferred from the free-text answers) or manually by a rep. Which fields
 * are actually required/asked is configurable — see fields.service.ts.
 */
export interface CollectedProfile {
  name: string | null;
  product: string | null;
  financing: string | null;
  budget: string | null;
  location: string | null;
  // Customer's own words (e.g. "I'm a teacher", "I run my own shop") — the
  // qualification engine canonicalizes this into a credit-risk category
  // rather than forcing the conversation into a rigid enum.
  employment: string | null;
  monthlyIncome: string | null;

  // Everything below is optional (`?:`) rather than a required nullable
  // key — additive, so every existing CollectedProfile object literal
  // (lead.service.ts's seed, ai.service.ts's merges) keeps typechecking
  // without having to enumerate 20 new nulls at every construction site.
  // Treat a missing key the same as null.

  // ── Customer ──
  email?: string | null;

  // ── Product / intent ──
  productCategory?: string | null;
  preferredModel?: string | null;
  purchaseMethod?: 'cash' | 'financing' | 'unsure' | null;

  // ── Employment (structured) ──
  employmentType?: string | null; // one of EMPLOYMENT_TYPE_OPTIONS' keys
  employerName?: string | null;
  jobTitle?: string | null;
  employmentDuration?: string | null;

  // ── Income ──
  incomeFrequency?: string | null; // e.g. 'monthly' | 'weekly' | 'daily'
  incomeCurrency?: string | null; // e.g. 'ZMW' | 'USD'
  incomeSource?: string | null;
  incomeVerified?: 'declared' | 'verified' | 'unknown' | null;

  // ── Location (structured) ──
  province?: string | null;
  district?: string | null;
  city?: string | null;
  area?: string | null;

  // ── Financing ──
  financingPartner?: string | null; // NetOne's internal choice — never AI-asked
  financingAmount?: string | null;
  preferredRepaymentPeriod?: string | null;
  depositAvailable?: string | null;
  financingEligibilityStatus?: string | null;
}


/** One line item in the configurable lead-scoring breakdown. */
export interface ScoreCriterionResult {
  key: string;
  label: string;
  weight: number;
  earned: number;
  met: boolean;
  required: boolean;
}

export interface AgentTurn {
  reply: string;
  collected: CollectedProfile;
  complete: boolean;
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
  // Legacy 3-state column — still written for backward compatibility (old
  // dashboards/exports/analytics history), but qualification_stage below is
  // now the canonical field driving Bitrix, analytics, and every UI badge.
  qualification_status: Qualification | null;
  qualification_stage: QualificationStage | null;
  converted_at: string | null;
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
  credit_risk: 'low' | 'medium' | 'high' | 'ineligible' | 'unknown' | null;
  collected: CollectedProfile;
  profile_complete: boolean;
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
