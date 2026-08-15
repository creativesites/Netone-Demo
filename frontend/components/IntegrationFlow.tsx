import { MessageCircle, Target, Brain, Scale, Database, PhoneCall, type LucideIcon } from 'lucide-react';

const stages: { label: string; sub: string; Icon: LucideIcon; desc: string }[] = [
  {
    label: 'Channel',
    sub: 'WhatsApp',
    Icon: MessageCircle,
    desc: 'Customer messages NetOne on WhatsApp — a channel they already use, no app install required.',
  },
  {
    label: 'Lead Capture',
    sub: 'Normalized',
    Icon: Target,
    desc: 'Every channel (WhatsApp today; web chat, USSD, or call center next) is normalized into one lead format.',
  },
  {
    label: 'Intelligence',
    sub: 'AI Analysis',
    Icon: Brain,
    desc: 'AI reads the conversation and extracts intent, product interest, financing needs, and urgency.',
  },
  {
    label: 'Qualification',
    sub: 'Rules',
    Icon: Scale,
    desc: 'Business rules decide whether this is a genuine sales opportunity worth a rep’s time.',
  },
  {
    label: 'Bitrix24',
    sub: 'CRM',
    Icon: Database,
    desc: 'Qualified leads are created automatically in the real CRM — zero manual data entry.',
  },
  {
    label: 'Sales',
    sub: 'Follow-up',
    Icon: PhoneCall,
    desc: 'A sales rep gets an assigned, ready-to-call lead with full context already captured.',
  },
];

export function IntegrationFlow({ activeIndex = -1 }: { activeIndex?: number }) {
  return (
    <div className="card p-5" data-tour="integration-flow">
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
                <s.Icon size={18} className={`mx-auto ${active ? 'text-brand-600' : 'text-ink-400'}`} />
                <div className={`mt-1 text-[11px] font-semibold ${active ? 'text-brand-600' : 'text-ink-700'}`}>
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
