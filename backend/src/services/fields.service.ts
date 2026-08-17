/**
 * The qualification field registry — NetOne's Zambia-specific discovery
 * fields, with per-field required/optional, order, and prompt text, all
 * configurable from the Rules page (persisted alongside QualificationRules
 * in settings.repo.ts). This is the "AI understands, business rules
 * decide" contract applied to discovery itself: the field list below is
 * SAMPLE/DEMO configuration NetOne can replace once they supply their
 * actual requirements — nothing here is a final business rule.
 *
 * `source` on a field matters:
 *   - 'ai'      — Nia asks for it directly when it's marked required.
 *   - 'derived' — computed deterministically from other collected fields
 *                 (e.g. province from city); never asked.
 *   - 'manual'  — NetOne's own internal choice (e.g. which financing
 *                 partner), never something a customer states; only
 *                 editable from the Lead page.
 */
import type { CollectedProfile } from '../types.js';
import type { EmploymentCategory } from './qualification.service.js';

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

// Sample/demo field set — grouped, ordered, each with a default
// required/optional flag matching the expanded v1 conversational script
// (see ai.service.ts). NOT NetOne's final qualification policy.
export const DEFAULT_QUALIFICATION_FIELDS: QualificationField[] = [
  // ── Customer ──
  { key: 'name', label: 'Full name', category: 'customer', required: true, order: 1, question: 'May I get your full name, please?', extractionType: 'text', source: 'ai' },
  { key: 'email', label: 'Email', category: 'customer', required: false, order: 90, question: 'Would you like a written quote emailed to you? If so, what’s your email?', extractionType: 'text', source: 'ai' },

  // ── Product / intent ──
  { key: 'product', label: 'Product interest', category: 'product', required: true, order: 2, question: 'Which product are you interested in — one of our NetOne laptops?', extractionType: 'text', source: 'ai' },
  { key: 'productCategory', label: 'Product category', category: 'product', required: false, order: 3, question: '', extractionType: 'text', source: 'derived' },
  { key: 'preferredModel', label: 'Preferred model', category: 'product', required: false, order: 4, question: '', extractionType: 'text', source: 'derived' },
  { key: 'purchaseMethod', label: 'Purchase method', category: 'product', required: true, order: 5, question: 'Would you prefer to pay cash or on financing (monthly installments)?', extractionType: 'enum', options: ['cash', 'financing', 'unsure'], source: 'ai' },
  { key: 'budget', label: 'Budget', category: 'product', required: true, order: 6, question: 'Roughly what budget did you have in mind?', extractionType: 'text', source: 'ai' },

  // ── Location ──
  { key: 'city', label: 'City / town', category: 'location', required: true, order: 7, question: 'Which city or area are you based in, so we can arrange delivery or your nearest branch?', extractionType: 'text', source: 'ai' },
  { key: 'province', label: 'Province', category: 'location', required: false, order: 8, question: '', extractionType: 'text', source: 'derived' },
  { key: 'district', label: 'District', category: 'location', required: false, order: 9, question: 'Which district is that in?', extractionType: 'text', source: 'ai' },
  { key: 'area', label: 'Area / neighborhood', category: 'location', required: false, order: 10, question: 'Which part of town, roughly?', extractionType: 'text', source: 'ai' },

  // ── Employment (only relevant when purchaseMethod === 'financing') ──
  { key: 'employmentType', label: 'Employment type', category: 'employment', required: true, order: 20, question: 'To check financing eligibility with our partner lenders — are you formally employed (government, a private company, or an NGO), self-employed, or is your income from somewhere else (pension, farming, casual work)?', extractionType: 'enum', source: 'ai' },
  { key: 'employerName', label: 'Employer name', category: 'employment', required: false, order: 21, question: 'Who do you work for?', extractionType: 'text', source: 'ai' },
  { key: 'jobTitle', label: 'Job title', category: 'employment', required: false, order: 22, question: 'What’s your role there?', extractionType: 'text', source: 'ai' },
  { key: 'employmentDuration', label: 'Employment duration', category: 'employment', required: false, order: 23, question: 'How long have you been there?', extractionType: 'text', source: 'ai' },

  // ── Income (only relevant when purchaseMethod === 'financing') ──
  { key: 'monthlyIncome', label: 'Monthly income', category: 'income', required: true, order: 24, question: 'And roughly what is your monthly income? This helps us confirm affordability with our financing partner.', extractionType: 'text', source: 'ai' },
  { key: 'incomeFrequency', label: 'Income frequency', category: 'income', required: false, order: 25, question: '', extractionType: 'enum', options: ['monthly', 'weekly', 'daily', 'irregular'], source: 'derived' },
  { key: 'incomeCurrency', label: 'Income currency', category: 'income', required: false, order: 26, question: '', extractionType: 'enum', options: ['ZMW', 'USD'], source: 'derived' },
  { key: 'incomeSource', label: 'Income source', category: 'income', required: false, order: 27, question: 'Where does most of that income come from?', extractionType: 'text', source: 'ai' },
  { key: 'incomeVerified', label: 'Income verification', category: 'income', required: false, order: 28, question: '', extractionType: 'enum', options: ['declared', 'verified', 'unknown'], source: 'derived' },

  // ── Financing detail (only relevant when purchaseMethod === 'financing') ──
  { key: 'preferredRepaymentPeriod', label: 'Preferred repayment period', category: 'financing', required: true, order: 30, question: 'What repayment period would you prefer — 6, 12, or 18 months?', extractionType: 'text', source: 'ai' },
  { key: 'depositAvailable', label: 'Deposit available', category: 'financing', required: true, order: 31, question: 'Do you have a deposit available, and if so, roughly how much?', extractionType: 'text', source: 'ai' },
  { key: 'financingAmount', label: 'Financing amount', category: 'financing', required: false, order: 32, question: '', extractionType: 'text', source: 'derived' },
  { key: 'financingPartner', label: 'Financing partner', category: 'financing', required: false, order: 33, question: '', extractionType: 'text', source: 'manual' },
  { key: 'financingEligibilityStatus', label: 'Financing eligibility status', category: 'financing', required: false, order: 34, question: '', extractionType: 'text', source: 'manual' },
];

// ── Zambia geography ────────────────────────────────────────────────────
export const ZAMBIA_PROVINCES = [
  'Lusaka', 'Copperbelt', 'Central', 'Eastern', 'Luapula',
  'Northern', 'Muchinga', 'Southern', 'Western', 'North-Western',
] as const;

// A pragmatic, non-exhaustive lookup of major towns to their province, used
// only to DERIVE province from the city the customer already gave — never
// asked as a separate question. Not a qualification criterion.
export const ZAMBIA_CITY_TO_PROVINCE: Record<string, string> = {
  lusaka: 'Lusaka', chilanga: 'Lusaka', kafue: 'Lusaka', chongwe: 'Lusaka', chirundu: 'Lusaka',
  ndola: 'Copperbelt', kitwe: 'Copperbelt', chingola: 'Copperbelt', mufulira: 'Copperbelt',
  luanshya: 'Copperbelt', kalulushi: 'Copperbelt', chililabombwe: 'Copperbelt',
  kabwe: 'Central', kapiri: 'Central', 'kapiri mposhi': 'Central', mkushi: 'Central', serenje: 'Central',
  chipata: 'Eastern', petauke: 'Eastern', katete: 'Eastern', lundazi: 'Eastern',
  mansa: 'Luapula', kawambwa: 'Luapula', samfya: 'Luapula',
  kasama: 'Northern', mbala: 'Northern', mpika: 'Northern',
  chinsali: 'Muchinga', isoka: 'Muchinga',
  livingstone: 'Southern', choma: 'Southern', mazabuka: 'Southern', monze: 'Southern', siavonga: 'Southern',
  mongu: 'Western', senanga: 'Western', kaoma: 'Western',
  solwezi: 'North-Western', kasempa: 'North-Western', mwinilunga: 'North-Western',
};

export function deriveProvinceFromCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  return ZAMBIA_CITY_TO_PROVINCE[key] ?? null;
}

// ── Employment sub-types (Zambia-specific discovery detail) ────────────
// Structured detail beneath the existing, unchanged 6-category
// EmploymentCategory used for credit-risk scoring (canonicalizeEmployment,
// creditRiskTier — see qualification.service.ts). This layer never
// replaces that engine; it's descriptive detail mapped onto it below.
export const EMPLOYMENT_TYPE_OPTIONS: { value: string; label: string; group: 'formal' | 'self_employment' | 'other_income' }[] = [
  { value: 'government', label: 'Government employee', group: 'formal' },
  { value: 'private_company', label: 'Private company employee', group: 'formal' },
  { value: 'ngo', label: 'NGO employee', group: 'formal' },
  { value: 'other_formal', label: 'Other formal employer', group: 'formal' },
  { value: 'registered_business', label: 'Registered business owner', group: 'self_employment' },
  { value: 'informal_business', label: 'Informal business owner', group: 'self_employment' },
  { value: 'trader', label: 'Trader / vendor', group: 'self_employment' },
  { value: 'freelancer', label: 'Freelancer / contract worker', group: 'self_employment' },
  { value: 'other_self_employed', label: 'Other self-employed', group: 'self_employment' },
  { value: 'pension', label: 'Pensioner', group: 'other_income' },
  { value: 'farming', label: 'Farming income', group: 'other_income' },
  { value: 'commission', label: 'Commission-based income', group: 'other_income' },
  { value: 'casual', label: 'Casual / occasional income', group: 'other_income' },
  { value: 'multiple', label: 'Multiple income sources', group: 'other_income' },
  { value: 'student', label: 'Student', group: 'other_income' },
  { value: 'unemployed', label: 'Unemployed / no income', group: 'other_income' },
];

// Maps the finer employmentType detail onto the existing, proven
// EmploymentCategory used by the credit-risk engine — extend this table
// if new employmentType values are added, so scoring never silently
// treats an unmapped value as "informally employed" by accident.
export const EMPLOYMENT_TYPE_TO_CATEGORY: Record<string, EmploymentCategory> = {
  government: 'civil_servant',
  private_company: 'formally_employed',
  ngo: 'formally_employed',
  other_formal: 'formally_employed',
  registered_business: 'self_employed',
  informal_business: 'self_employed',
  trader: 'self_employed',
  freelancer: 'self_employed',
  other_self_employed: 'self_employed',
  pension: 'informally_employed',
  farming: 'informally_employed',
  commission: 'informally_employed',
  casual: 'informally_employed',
  multiple: 'informally_employed',
  student: 'student',
  unemployed: 'unemployed',
};
