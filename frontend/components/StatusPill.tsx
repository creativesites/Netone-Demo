type Tone = 'green' | 'amber' | 'red' | 'slate' | 'blue';

const tones: Record<Tone, { dot: string; text: string; ring: string }> = {
  green: { dot: 'bg-emerald-500', text: 'text-emerald-600', ring: 'bg-emerald-500' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-600', ring: 'bg-amber-500' },
  red: { dot: 'bg-rose-500', text: 'text-rose-600', ring: 'bg-rose-500' },
  slate: { dot: 'bg-ink-400', text: 'text-ink-500', ring: 'bg-ink-400' },
  blue: { dot: 'bg-brand-500', text: 'text-brand-600', ring: 'bg-brand-500' },
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
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${t.ring} opacity-50 animate-pulse-ring`} />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t.dot}`} />
      </span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
        <div className={`text-xs font-semibold ${t.text}`}>{value}</div>
      </div>
    </div>
  );
}
