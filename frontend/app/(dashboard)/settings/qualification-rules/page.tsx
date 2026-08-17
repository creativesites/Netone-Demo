'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Save, Check, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { useRealtimeDoc, apiPut } from '@/lib/realtime';
import { EMPLOYMENT_CATEGORIES, type QualificationRules, type QualificationCriterionRule, type EmploymentCategory, type QualificationField, type FieldCategory } from '@/lib/types';

// Sample/demo discovery field registry — mirrors
// backend/src/services/fields.service.ts::DEFAULT_QUALIFICATION_FIELDS.
// Only used as the initial fallback before /api/settings/qualification-rules
// responds; the real (possibly rep-edited) registry always wins once loaded.
const DEFAULT_FIELDS: QualificationField[] = [
  { key: 'name', label: 'Full name', category: 'customer', required: true, order: 1, question: 'May I get your full name, please?', extractionType: 'text', source: 'ai' },
  { key: 'email', label: 'Email', category: 'customer', required: false, order: 90, question: 'Would you like a written quote emailed to you? If so, what’s your email?', extractionType: 'text', source: 'ai' },
  { key: 'product', label: 'Product interest', category: 'product', required: true, order: 2, question: 'Which product are you interested in — one of our NetOne laptops?', extractionType: 'text', source: 'ai' },
  { key: 'productCategory', label: 'Product category', category: 'product', required: false, order: 3, question: '', extractionType: 'text', source: 'derived' },
  { key: 'preferredModel', label: 'Preferred model', category: 'product', required: false, order: 4, question: '', extractionType: 'text', source: 'derived' },
  { key: 'purchaseMethod', label: 'Purchase method', category: 'product', required: true, order: 5, question: 'Would you prefer to pay cash or on financing (monthly installments)?', extractionType: 'enum', options: ['cash', 'financing', 'unsure'], source: 'ai' },
  { key: 'budget', label: 'Budget', category: 'product', required: true, order: 6, question: 'Roughly what budget did you have in mind?', extractionType: 'text', source: 'ai' },
  { key: 'city', label: 'City / town', category: 'location', required: true, order: 7, question: 'Which city or area are you based in, so we can arrange delivery or your nearest branch?', extractionType: 'text', source: 'ai' },
  { key: 'province', label: 'Province', category: 'location', required: false, order: 8, question: '', extractionType: 'text', source: 'derived' },
  { key: 'district', label: 'District', category: 'location', required: false, order: 9, question: 'Which district is that in?', extractionType: 'text', source: 'ai' },
  { key: 'area', label: 'Area / neighborhood', category: 'location', required: false, order: 10, question: 'Which part of town, roughly?', extractionType: 'text', source: 'ai' },
  { key: 'employmentType', label: 'Employment type', category: 'employment', required: true, order: 20, question: 'To check financing eligibility with our partner lenders — are you formally employed (government, a private company, or an NGO), self-employed, or is your income from somewhere else (pension, farming, casual work)?', extractionType: 'enum', source: 'ai' },
  { key: 'employerName', label: 'Employer name', category: 'employment', required: false, order: 21, question: 'Who do you work for?', extractionType: 'text', source: 'ai' },
  { key: 'jobTitle', label: 'Job title', category: 'employment', required: false, order: 22, question: 'What’s your role there?', extractionType: 'text', source: 'ai' },
  { key: 'employmentDuration', label: 'Employment duration', category: 'employment', required: false, order: 23, question: 'How long have you been there?', extractionType: 'text', source: 'ai' },
  { key: 'monthlyIncome', label: 'Monthly income', category: 'income', required: true, order: 24, question: 'And roughly what is your monthly income? This helps us confirm affordability with our financing partner.', extractionType: 'text', source: 'ai' },
  { key: 'incomeFrequency', label: 'Income frequency', category: 'income', required: false, order: 25, question: '', extractionType: 'enum', options: ['monthly', 'weekly', 'daily', 'irregular'], source: 'derived' },
  { key: 'incomeCurrency', label: 'Income currency', category: 'income', required: false, order: 26, question: '', extractionType: 'enum', options: ['ZMW', 'USD'], source: 'derived' },
  { key: 'incomeSource', label: 'Income source', category: 'income', required: false, order: 27, question: 'Where does most of that income come from?', extractionType: 'text', source: 'ai' },
  { key: 'incomeVerified', label: 'Income verification', category: 'income', required: false, order: 28, question: '', extractionType: 'enum', options: ['declared', 'verified', 'unknown'], source: 'derived' },
  { key: 'preferredRepaymentPeriod', label: 'Preferred repayment period', category: 'financing', required: true, order: 30, question: 'What repayment period would you prefer — 6, 12, or 18 months?', extractionType: 'text', source: 'ai' },
  { key: 'depositAvailable', label: 'Deposit available', category: 'financing', required: true, order: 31, question: 'Do you have a deposit available, and if so, roughly how much?', extractionType: 'text', source: 'ai' },
  { key: 'financingAmount', label: 'Financing amount', category: 'financing', required: false, order: 32, question: '', extractionType: 'text', source: 'derived' },
  { key: 'financingPartner', label: 'Financing partner', category: 'financing', required: false, order: 33, question: '', extractionType: 'text', source: 'manual' },
  { key: 'financingEligibilityStatus', label: 'Financing eligibility status', category: 'financing', required: false, order: 34, question: '', extractionType: 'text', source: 'manual' },
];

const CATEGORY_LABEL: Record<FieldCategory, string> = {
  customer: 'Customer',
  product: 'Product / intent',
  employment: 'Employment',
  income: 'Income',
  location: 'Location',
  financing: 'Financing',
};

const DEFAULT_RULES: QualificationRules = {
  fields: DEFAULT_FIELDS,
  criteria: [
    { key: 'purchaseIntent', label: 'Purchase intent', weight: 25, required: true },
    { key: 'product', label: 'Product identified', weight: 15, required: true },
    { key: 'financing', label: 'Financing interest captured', weight: 10, required: false },
    { key: 'location', label: 'Location captured', weight: 10, required: true },
    { key: 'contact', label: 'Contact information', weight: 5, required: true },
    { key: 'employment', label: 'Employment / credit risk', weight: 20, required: true },
    { key: 'monthlyIncome', label: 'Monthly income disclosed', weight: 10, required: false },
    { key: 'budget', label: 'Budget indicated', weight: 5, required: false },
  ],
  qualifiedThreshold: 70,
  followUpThreshold: 40,
  employmentWeights: {
    civil_servant: 100,
    formally_employed: 90,
    self_employed: 55,
    informally_employed: 25,
    student: 15,
    unemployed: 0,
  },
};

function riskTierFor(weight: number): { label: string; cls: string } {
  if (weight <= 0) return { label: 'Ineligible', cls: 'text-rose-600' };
  if (weight < 40) return { label: 'High risk', cls: 'text-orange-600' };
  if (weight < 75) return { label: 'Medium risk', cls: 'text-amber-600' };
  return { label: 'Low risk', cls: 'text-emerald-600' };
}

export default function QualificationRulesPage() {
  const remote = useRealtimeDoc<QualificationRules>(
    'settings/qualificationRules',
    '/api/settings/qualification-rules',
    (r) => r as QualificationRules,
    5000
  );
  const [rules, setRules] = useState<QualificationRules>(DEFAULT_RULES);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (remote && !loaded) {
      setRules({ ...DEFAULT_RULES, ...remote, employmentWeights: { ...DEFAULT_RULES.employmentWeights, ...remote.employmentWeights } });
      setLoaded(true);
    }
  }, [remote, loaded]);

  const total = rules.criteria.reduce((s, c) => s + c.weight, 0);

  function updateCriterion(key: string, patch: Partial<QualificationCriterionRule>) {
    setRules((r) => ({ ...r, criteria: r.criteria.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
    setSaved(false);
  }

  function updateEmploymentWeight(category: EmploymentCategory, weight: number) {
    setRules((r) => ({ ...r, employmentWeights: { ...r.employmentWeights, [category]: Math.max(0, Math.min(100, weight)) } }));
    setSaved(false);
  }

  function updateField(key: string, patch: Partial<QualificationField>) {
    setRules((r) => ({ ...r, fields: r.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
    setSaved(false);
  }

  /** Swaps this field's order with its neighbor within the same category —
   *  the only reordering that makes sense in a category-grouped list. */
  function moveField(key: string, direction: -1 | 1) {
    setRules((r) => {
      const field = r.fields.find((f) => f.key === key);
      if (!field) return r;
      const siblings = r.fields.filter((f) => f.category === field.category).sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((f) => f.key === key);
      const swapWith = siblings[idx + direction];
      if (!swapWith) return r;
      return {
        ...r,
        fields: r.fields.map((f) => {
          if (f.key === field.key) return { ...f, order: swapWith.order };
          if (f.key === swapWith.key) return { ...f, order: field.order };
          return f;
        }),
      };
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await apiPut('/api/settings/qualification-rules', rules);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setRules(DEFAULT_RULES);
    setSaved(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Configuration</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Qualification Rules</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        These rules don&apos;t need to be hard-coded — they can be configured around NetOne&apos;s actual
        business process and financing-partner requirements. Every lead is scored live against exactly
        these criteria, and the reasoning is shown to the sales team on the lead itself.
      </p>

      <div className="mt-6 card p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Required Information &amp; Weights</span>
          <span className={`text-xs font-mono ${total === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {total} / 100 pts
          </span>
        </div>

        <div className="space-y-2">
          {rules.criteria.map((c) => (
            <div key={c.key} className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted px-3 py-2.5">
              <button
                onClick={() => updateCriterion(c.key, { required: !c.required })}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  c.required ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white'
                }`}
                title="Required for a lead to be considered fully qualified"
              >
                {c.required && <Check size={12} />}
              </button>
              <span className="flex-1 text-sm text-ink-800">{c.label}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={c.weight}
                onChange={(e) => updateCriterion(c.key, { weight: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-right text-sm text-ink-900 outline-none focus:border-brand-500"
              />
              <span className="text-[11px] text-ink-400">pts</span>
            </div>
          ))}
        </div>
        {total !== 100 && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600">
            <Info size={12} /> Weights don&apos;t need to total 100 — scores are normalized automatically.
          </p>
        )}
      </div>

      <div className="mt-4 card p-5">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Discovery Fields</div>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-500">
          Sample/demo configuration — replace with NetOne&apos;s actual requirements. This is the exact field
          list Nia (the WhatsApp assistant) asks about: toggling a field required makes her start actively
          asking for it, in this order, the next time she talks to a lead. Fields marked <em>derived</em> or{' '}
          <em>manual</em> are never asked — they&apos;re computed automatically or set by a rep.
        </p>
        <div className="space-y-5">
          {(['customer', 'product', 'location', 'employment', 'income', 'financing'] as FieldCategory[]).map((cat) => {
            const inCategory = rules.fields.filter((f) => f.category === cat).sort((a, b) => a.order - b.order);
            if (inCategory.length === 0) return null;
            return (
              <div key={cat}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{CATEGORY_LABEL[cat]}</div>
                <div className="space-y-2">
                  {inCategory.map((f, i) => (
                    <div key={f.key} className="rounded-xl border border-line bg-surface-muted px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        {f.source === 'ai' ? (
                          <button
                            onClick={() => updateField(f.key, { required: !f.required })}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                              f.required ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white'
                            }`}
                            title="Required — Nia will actively ask for this"
                          >
                            {f.required && <Check size={12} />}
                          </button>
                        ) : (
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line bg-gray-100 text-[8px] font-bold uppercase text-ink-400"
                            title={f.source === 'derived' ? 'Derived automatically — never asked' : 'Set manually by a rep — never asked'}
                          >
                            {f.source === 'derived' ? 'D' : 'M'}
                          </span>
                        )}
                        <span className="flex-1 text-sm text-ink-800">{f.label}</span>
                        {f.source === 'ai' && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => moveField(f.key, -1)}
                              disabled={i === 0}
                              className="rounded p-1 text-ink-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move earlier"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              onClick={() => moveField(f.key, 1)}
                              disabled={i === inCategory.length - 1}
                              className="rounded p-1 text-ink-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                              title="Move later"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {f.source === 'ai' && (
                        <input
                          value={f.question}
                          onChange={(e) => updateField(f.key, { question: e.target.value })}
                          placeholder="Question Nia asks…"
                          className="mt-2 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink-700 outline-none focus:border-brand-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 card p-5">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Credit Worthiness — Employment Type Weighting
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-500">
          Zambia&apos;s market has high informal employment, so NetOne&apos;s financing partners assess
          repayment risk primarily by employment type — a civil servant&apos;s installment can be deducted at
          source, so that&apos;s lower risk than income that isn&apos;t formally verifiable. Set each
          category&apos;s weight to match your partners&apos; actual underwriting policy — it drives both the
          lead score and the credit-risk badge shown to sales.
        </p>
        <div className="space-y-2">
          {EMPLOYMENT_CATEGORIES.map((cat) => {
            const weight = rules.employmentWeights[cat.value] ?? 0;
            const tier = riskTierFor(weight);
            return (
              <div key={cat.value} className="rounded-xl border border-line bg-surface-muted px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-800">{cat.label}</span>
                  <span className={`shrink-0 text-[11px] font-semibold ${tier.cls}`}>{tier.label}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weight}
                    onChange={(e) => updateEmploymentWeight(cat.value, Number(e.target.value))}
                    className="min-w-0 flex-1 accent-brand-500"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weight}
                    onChange={(e) => updateEmploymentWeight(cat.value, Number(e.target.value) || 0)}
                    className="w-14 shrink-0 rounded-lg border border-line bg-white px-2 py-1 text-right text-sm text-ink-900 outline-none focus:border-brand-500"
                  />
                  <span className="shrink-0 text-[11px] text-ink-400">%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 card p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Qualification Thresholds</div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11px] text-ink-500">Qualified — score ≥</span>
            <input
              type="number"
              min={0}
              max={100}
              value={rules.qualifiedThreshold}
              onChange={(e) => {
                setRules((r) => ({ ...r, qualifiedThreshold: Number(e.target.value) || 0 }));
                setSaved(false);
              }}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink-500">Needs follow-up — score ≥</span>
            <input
              type="number"
              min={0}
              max={100}
              value={rules.followUpThreshold}
              onChange={(e) => {
                setRules((r) => ({ ...r, followUpThreshold: Number(e.target.value) || 0 }));
                setSaved(false);
              }}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl bg-ink-900 p-4 font-mono text-[12px] leading-relaxed text-emerald-300">
          <div className="text-ink-400">// Live preview — recalculated on every lead update</div>
          <div>
            IF <span className="text-white">score</span> {'>='} <span className="text-amber-300">{rules.qualifiedThreshold}</span>
          </div>
          <div className="pl-4">THEN Lead = <span className="text-emerald-400">QUALIFIED</span> · Priority = HIGH</div>
          <div>
            IF <span className="text-white">score</span> {'>='} <span className="text-amber-300">{rules.followUpThreshold}</span>
          </div>
          <div className="pl-4">THEN Lead = <span className="text-amber-400">NEEDS FOLLOW-UP</span></div>
          <div>ELSE Lead = <span className="text-rose-400">UNQUALIFIED</span></div>
          <div className="mt-2 text-ink-400">// Employment weighting is applied inside the "Employment / credit risk" criterion above</div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save rules'}
        </button>
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink-600 transition-colors hover:bg-surface-muted"
        >
          <RotateCcw size={14} /> Reset to defaults
        </button>
      </div>
    </div>
  );
}
