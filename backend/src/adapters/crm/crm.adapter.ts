/**
 * CRM adapter contract. The business pipeline depends on this interface, never on
 * Bitrix directly — so a future Salesforce/HubSpot adapter can drop in unchanged.
 */
import type { Lead, LeadAnalysis } from '../../types.js';

export interface CreateLeadResult {
  ok: boolean;
  crmLeadId?: string;
  status: 'synced' | 'failed';
  error?: string;
  raw?: unknown;
}

export interface CRMAdapter {
  name: string;
  isConfigured(): boolean;
  createLead(lead: Lead, analysis: LeadAnalysis): Promise<CreateLeadResult>;
  /** Enrich an existing CRM lead as the conversation collects more detail. */
  updateLead(crmLeadId: string, lead: Lead, analysis: LeadAnalysis): Promise<boolean>;
  assignLead(crmLeadId: string, assignedById: string): Promise<boolean>;
}
