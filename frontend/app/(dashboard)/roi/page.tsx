'use client';

import { useEffect, useState } from 'react';
import { Clock, Wallet, TrendingUp, Gauge, Info, RotateCcw, type LucideIcon } from 'lucide-react';
import { useRealtimeDoc } from '@/lib/realtime';
import type { Analytics } from '@/lib/types';

const ASSUMPTIONS_KEY = 'netone-roi-assumptions';
const DAYS = 30;

interface Assumptions {
  handleMinutes: number;
  hourlyCost: number;
}

const DEFAULT_ASSUMPTIONS: Assumptions = {
  // Illustrative starting points, not NetOne-supplied figures — adjust the
  // two inputs below to match NetOne's actual numbers.
  handleMinutes: 8,
  hourlyCost: 60,
};

function StatCard({ label, value, suffix, Icon, accent }: { label: string; value: string | number; suffix?: string; Icon: LucideIcon; accent: string }) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        <Icon size={16} className="text-ink-400" />
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink-900">
        {value}
        {suffix && <span className="ml-0.5 text-lg text-ink-400">{suffix}</span>}
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-1 ${accent}`} />
    </div>
  );
}

export default function RoiPage() {
  const analytics = useRealtimeDoc<Analytics>('dashboard/analytics', `/api/analytics?days=${DAYS}`, (r) => r as Analytics);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ASSUMPTIONS_KEY);
      if (saved) setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...JSON.parse(saved) });
    } catch {
      /* localStorage unavailable — keep defaults */
    }
  }, []);

  function update(patch: Partial<Assumptions>) {
    setAssumptions((a) => {
      const next = { ...a, ...patch };
      try {
        localStorage.setItem(ASSUMPTIONS_KEY, JSON.stringify(next));
      } catch {
        /* best-effort persistence only */
      }
      return next;
    });
  }

  function reset() {
    setAssumptions(DEFAULT_ASSUMPTIONS);
    try {
      localStorage.removeItem(ASSUMPTIONS_KEY);
    } catch {
      /* ignore */
    }
  }

  const totals = analytics?.totals ?? {
    totalLeads: 0,
    qualified: 0,
    needsFollowUp: 0,
    unqualified: 0,
    avgScore: 0,
    conversionRate: 0,
    bitrixSynced: 0,
    bitrixPending: 0,
    bitrixFailed: 0,
  };

  const minutesSaved = totals.totalLeads * assumptions.handleMinutes;
  const hoursSaved = minutesSaved / 60;
  const costSaved = hoursSaved * assumptions.hourlyCost;
  const leadsPerMonth = Math.round((totals.totalLeads / DAYS) * 30);
  const hoursSavedPerMonth = (leadsPerMonth * assumptions.handleMinutes) / 60;
  const costSavedPerMonth = hoursSavedPerMonth * assumptions.hourlyCost;

  const fmt0 = (n: number) => Math.round(n).toLocaleString();
  const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Management</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Executive ROI Summary</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        The lead counts below are real — pulled live from the last {DAYS} days of actual pipeline activity, the
        same data behind Analytics. The time/cost figures are estimates built from two assumptions you control,
        so you can plug in NetOne&apos;s real numbers instead of the illustrative defaults.
      </p>

      {/* Real data */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Leads Handled (${DAYS}d)`} value={totals.totalLeads} Icon={TrendingUp} accent="bg-brand-500" />
        <StatCard label="Qualified" value={totals.qualified} Icon={Gauge} accent="bg-emerald-500" />
        <StatCard label="Conversion Rate" value={totals.conversionRate} suffix="%" Icon={TrendingUp} accent="bg-emerald-500" />
        <StatCard label="Avg. Lead Score" value={totals.avgScore} suffix="/100" Icon={Gauge} accent="bg-violet-500" />
      </div>
      <p className="mt-2 text-[11px] text-ink-400">Live from your data — not an estimate.</p>

      {/* Assumptions */}
      <div className="mt-6 card p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Your assumptions</span>
          <button
            onClick={reset}
            className="flex items-center gap-1 text-[11px] font-medium text-ink-500 hover:text-brand-600"
          >
            <RotateCcw size={12} /> Reset to illustrative defaults
          </button>
        </div>
        <p className="mb-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-500">
          <Info size={13} className="mt-0.5 shrink-0" />
          These two numbers are illustrative starting points, not figures NetOne has supplied — replace them with
          your own to see the estimate change below.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] text-ink-500">Avg. minutes a rep spends qualifying one lead manually</span>
            <input
              type="number"
              min={0}
              value={assumptions.handleMinutes}
              onChange={(e) => update({ handleMinutes: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink-500">Rep cost per hour (ZMW)</span>
            <input
              type="number"
              min={0}
              value={assumptions.hourlyCost}
              onChange={(e) => update({ hourlyCost: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink-900 outline-none focus:border-brand-500"
            />
          </label>
        </div>
      </div>

      {/* Estimated impact */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Estimated impact — last {DAYS} days
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Rep hours saved" value={fmt1(hoursSaved)} Icon={Clock} accent="bg-amber-500" />
            <StatCard label="Cost saved (ZMW)" value={fmt0(costSaved)} Icon={Wallet} accent="bg-amber-500" />
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Projected — per month, at this rate
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Rep hours saved" value={fmt1(hoursSavedPerMonth)} Icon={Clock} accent="bg-brand-500" />
            <StatCard label="Cost saved (ZMW)" value={fmt0(costSavedPerMonth)} Icon={Wallet} accent="bg-brand-500" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface-muted px-4 py-3 text-[12px] leading-relaxed text-ink-500">
        <strong className="text-ink-700">How this is calculated:</strong> leads handled × assumed minutes per lead ÷
        60 = rep hours saved; rep hours saved × assumed hourly cost = cost saved. Every lead in the count was
        qualified end-to-end by Nia — intent read, questions asked, score computed, CRM record created — without a
        human touching it first.
      </div>
    </div>
  );
}
