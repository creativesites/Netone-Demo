import { TrendingUp, CheckCircle2, Clock, Link2, type LucideIcon } from 'lucide-react';
import type { Metrics } from '@/lib/types';

function Card({
  label,
  value,
  accent,
  Icon,
}: {
  label: string;
  value: number;
  accent: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        <Icon size={16} className="text-ink-400" />
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink-900">{value}</div>
      <div className={`absolute inset-x-0 bottom-0 h-1 ${accent}`} />
    </div>
  );
}

export function MetricsRow({ metrics }: { metrics: Metrics | null }) {
  const m = metrics ?? { leadsToday: 0, qualified: 0, needsFollowUp: 0, syncedToCrm: 0 };
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="Leads Today" value={m.leadsToday} accent="bg-brand-500" Icon={TrendingUp} />
      <Card label="Qualified" value={m.qualified} accent="bg-emerald-500" Icon={CheckCircle2} />
      <Card label="Needs Follow-up" value={m.needsFollowUp} accent="bg-amber-500" Icon={Clock} />
      <Card label="Synced to CRM" value={m.syncedToCrm} accent="bg-violet-500" Icon={Link2} />
    </div>
  );
}
