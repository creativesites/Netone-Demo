import type { Metrics } from '@/lib/types';

function Card({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</div>
      <div className={`absolute inset-x-0 bottom-0 h-0.5 ${accent}`} />
    </div>
  );
}

export function MetricsRow({ metrics }: { metrics: Metrics | null }) {
  const m = metrics ?? { leadsToday: 0, qualified: 0, needsFollowUp: 0, syncedToCrm: 0 };
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="Leads Today" value={m.leadsToday} accent="bg-brand-500" icon="📈" />
      <Card label="Qualified" value={m.qualified} accent="bg-emerald-500" icon="✅" />
      <Card label="Needs Follow-up" value={m.needsFollowUp} accent="bg-amber-500" icon="⏳" />
      <Card label="Synced to CRM" value={m.syncedToCrm} accent="bg-violet-500" icon="🔗" />
    </div>
  );
}
