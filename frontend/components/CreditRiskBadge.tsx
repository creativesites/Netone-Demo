import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, type LucideIcon } from 'lucide-react';

const TIER: Record<string, { label: string; cls: string; Icon: LucideIcon }> = {
  low: { label: 'Low credit risk', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ShieldCheck },
  medium: { label: 'Medium credit risk', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: ShieldAlert },
  high: { label: 'High credit risk', cls: 'bg-orange-50 text-orange-700 border-orange-200', Icon: ShieldAlert },
  ineligible: { label: 'Not financing-eligible', cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: ShieldX },
  unknown: { label: 'Credit risk unknown', cls: 'bg-gray-100 text-ink-400 border-line', Icon: ShieldQuestion },
};

export function CreditRiskBadge({ risk, className = '' }: { risk: string | null | undefined; className?: string }) {
  const tier = TIER[risk ?? 'unknown'] ?? TIER.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tier.cls} ${className}`}>
      <tier.Icon size={12} />
      {tier.label}
    </span>
  );
}
