const stages = [
  {
    label: 'Channel',
    sub: 'WhatsApp',
    icon: '💬',
    desc: 'Customer messages NetOne on WhatsApp — a channel they already use, no app install required.',
  },
  {
    label: 'Lead Capture',
    sub: 'Normalized',
    icon: '🎯',
    desc: 'Every channel (WhatsApp today; web chat, USSD, or call center next) is normalized into one lead format.',
  },
  {
    label: 'Intelligence',
    sub: 'AI Analysis',
    icon: '🧠',
    desc: 'AI reads the conversation and extracts intent, product interest, financing needs, and urgency.',
  },
  {
    label: 'Qualification',
    sub: 'Rules',
    icon: '⚖️',
    desc: 'Business rules decide whether this is a genuine sales opportunity worth a rep’s time.',
  },
  {
    label: 'Bitrix24',
    sub: 'CRM',
    icon: '🗄️',
    desc: 'Qualified leads are created automatically in the real CRM — zero manual data entry.',
  },
  {
    label: 'Sales',
    sub: 'Follow-up',
    icon: '📞',
    desc: 'A sales rep gets an assigned, ready-to-call lead with full context already captured.',
  },
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
                title={s.desc}
                className={`min-w-[96px] cursor-help rounded-xl border px-3 py-2.5 text-center transition-colors duration-500 ${
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
