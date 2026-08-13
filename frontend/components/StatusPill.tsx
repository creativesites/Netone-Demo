type Tone = 'green' | 'amber' | 'red' | 'slate' | 'blue';

const tones: Record<Tone, { dot: string; text: string; ring: string }> = {
  green: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'bg-emerald-400' },
  amber: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'bg-amber-400' },
  red: { dot: 'bg-rose-500', text: 'text-rose-300', ring: 'bg-rose-500' },
  slate: { dot: 'bg-slate-500', text: 'text-slate-400', ring: 'bg-slate-500' },
  blue: { dot: 'bg-brand-500', text: 'text-brand-500', ring: 'bg-brand-500' },
};

export function StatusPill({
  label,
  value,
  tone,
  pulse = false,
}: {
  label: string;
  value: string;
  tone: Tone;
  pulse?: boolean;
}) {
  const t = tones[tone];
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${t.ring} opacity-60 animate-pulse-ring`}
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t.dot}`} />
      </span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`text-xs font-semibold ${t.text}`}>{value}</div>
      </div>
    </div>
  );
}
