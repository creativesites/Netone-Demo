const stages = [
  { label: 'Channel', sub: 'WhatsApp', icon: '💬' },
  { label: 'Lead Capture', sub: 'Normalized', icon: '🎯' },
  { label: 'Intelligence', sub: 'AI Analysis', icon: '🧠' },
  { label: 'Qualification', sub: 'Rules', icon: '⚖️' },
  { label: 'Bitrix24', sub: 'CRM', icon: '🗄️' },
  { label: 'Sales', sub: 'Follow-up', icon: '📞' },
];

export function IntegrationFlow({ activeIndex = -1 }: { activeIndex?: number }) {
  return (
    <div className="card p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
        Integration Flow
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto scroll-thin pb-1">
        {stages.map((s, i) => {
          const active = i <= activeIndex;
          return (
            <div key={s.label} className="flex items-center gap-1">
              <div
                className={`min-w-[96px] rounded-xl border px-3 py-2.5 text-center transition-colors duration-500 ${
                  active ? 'border-brand-500/30 bg-brand-50' : 'border-line bg-white'
                }`}
              >
                <div className="text-lg">{s.icon}</div>
                <div className={`text-[11px] font-semibold ${active ? 'text-brand-600' : 'text-ink-700'}`}>
                  {s.label}
                </div>
                <div className="text-[10px] text-ink-400">{s.sub}</div>
              </div>
              {i < stages.length - 1 && (
                <div className={`h-px w-4 transition-colors duration-500 ${i < activeIndex ? 'bg-brand-500' : 'bg-line'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
