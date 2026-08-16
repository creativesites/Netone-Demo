'use client';

import { TrendingUp, CheckCircle2, Clock, Link2, Percent, Gauge, type LucideIcon } from 'lucide-react';
import { useRealtimeDoc } from '@/lib/realtime';
import type { Analytics } from '@/lib/types';
import { DailyVolumeChart } from '@/components/analytics/DailyVolumeChart';
import { BreakdownBars, type BreakdownRow } from '@/components/analytics/BreakdownBars';

function StatTile({ label, value, suffix, accent, Icon }: { label: string; value: number; suffix?: string; accent: string; Icon: LucideIcon }) {
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

const QUALIFICATION_LABEL: Record<string, string> = {
  qualified: 'Qualified',
  needs_follow_up: 'Needs follow-up',
  unqualified: 'Unqualified',
  pending: 'Pending',
};
const QUALIFICATION_COLOR: Record<string, string> = {
  qualified: 'bg-emerald-500',
  needs_follow_up: 'bg-amber-500',
  unqualified: 'bg-gray-300',
  pending: 'bg-gray-300',
};

const CREDIT_RISK_LABEL: Record<string, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  ineligible: 'Not eligible',
  unknown: 'Unknown',
};
const CREDIT_RISK_COLOR: Record<string, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  ineligible: 'bg-rose-500',
  unknown: 'bg-gray-300',
};

export default function AnalyticsPage() {
  const analytics = useRealtimeDoc<Analytics>('dashboard/analytics', '/api/analytics?days=14', (r) => r as Analytics);

  const a = analytics ?? {
    totals: { totalLeads: 0, qualified: 0, needsFollowUp: 0, unqualified: 0, avgScore: 0, conversionRate: 0, bitrixSynced: 0, bitrixPending: 0, bitrixFailed: 0 },
    dailyVolume: [],
    byQualification: [],
    byProduct: [],
    byCreditRisk: [],
    byChannel: [],
  };

  const qualificationRows: BreakdownRow[] = a.byQualification.map((r) => ({
    key: r.status,
    label: QUALIFICATION_LABEL[r.status] ?? r.status,
    count: r.count,
    colorClass: QUALIFICATION_COLOR[r.status] ?? 'bg-gray-300',
  }));

  const creditRiskRows: BreakdownRow[] = a.byCreditRisk.map((r) => ({
    key: r.risk,
    label: CREDIT_RISK_LABEL[r.risk] ?? r.risk,
    count: r.count,
    colorClass: CREDIT_RISK_COLOR[r.risk] ?? 'bg-gray-300',
  }));

  const productRows: BreakdownRow[] = a.byProduct.map((r) => ({
    key: r.product,
    label: r.product,
    count: r.count,
    colorClass: 'bg-brand-500',
  }));

  const channelRows: BreakdownRow[] = a.byChannel.map((r) => ({
    key: r.channel,
    label: r.channel,
    count: r.count,
    colorClass: 'bg-violet-500',
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Management</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Analytics</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        Real-time pipeline performance — every number below is computed live from the lead database, nothing simulated.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total Leads" value={a.totals.totalLeads} accent="bg-brand-500" Icon={TrendingUp} />
        <StatTile label="Conversion Rate" value={a.totals.conversionRate} suffix="%" accent="bg-emerald-500" Icon={Percent} />
        <StatTile label="Avg. Score" value={a.totals.avgScore} suffix="/100" accent="bg-violet-500" Icon={Gauge} />
        <StatTile label="Synced to CRM" value={a.totals.bitrixSynced} accent="bg-amber-500" Icon={Link2} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <StatTile label="Qualified" value={a.totals.qualified} accent="bg-emerald-500" Icon={CheckCircle2} />
        <StatTile label="Needs Follow-up" value={a.totals.needsFollowUp} accent="bg-amber-500" Icon={Clock} />
        <StatTile label="Unqualified" value={a.totals.unqualified} accent="bg-gray-300" Icon={Clock} />
      </div>

      <div className="mt-4">
        <DailyVolumeChart data={a.dailyVolume} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <BreakdownBars title="Qualification breakdown" rows={qualificationRows} />
        <BreakdownBars title="Credit-risk distribution" rows={creditRiskRows} emptyLabel="No financing-interested leads yet." />
        <BreakdownBars title="Top products" rows={productRows} emptyLabel="No product interest recorded yet." />
        <BreakdownBars title="By channel" rows={channelRows} />
      </div>

      {a.totals.bitrixFailed > 0 && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {a.totals.bitrixFailed} lead{a.totals.bitrixFailed === 1 ? '' : 's'} failed to sync to Bitrix24 — check the integration status on the dashboard.
        </div>
      )}
    </div>
  );
}
