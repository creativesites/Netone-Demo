'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Save, Check, Info } from 'lucide-react';
import { useRealtimeDoc, apiPut } from '@/lib/realtime';
import { EMPLOYMENT_CATEGORIES, type QualificationRules, type QualificationCriterionRule, type EmploymentCategory } from '@/lib/types';

const DEFAULT_RULES: QualificationRules = {
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
