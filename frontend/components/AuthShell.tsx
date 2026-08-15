import { MessageCircle, Brain, Database, BarChart3, type LucideIcon } from 'lucide-react';

const POINTS: { Icon: LucideIcon; text: string }[] = [
  { Icon: MessageCircle, text: 'Captures customer enquiries from WhatsApp and other digital channels' },
  { Icon: Brain, text: 'AI reads each conversation and qualifies it against NetOne’s own rules' },
  { Icon: Database, text: 'Creates and enriches leads directly in the real Bitrix24 CRM' },
  { Icon: BarChart3, text: 'Gives management live visibility into enquiries, quality and follow-up' },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Branded context panel — explains the site to anyone who just got the link. */}
      <div className="hidden w-[42%] max-w-md flex-col justify-between bg-brand-500 p-10 text-white md:flex">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/netone-logo-white.png" alt="NetOne" className="h-7 w-auto" />
          <h1 className="mt-8 text-2xl font-semibold leading-tight tracking-tight">
            Lead Intelligence &amp; Marketing Automation
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            This console connects NetOne&apos;s digital channels to Bitrix24 — capturing, understanding and
            qualifying customer enquiries automatically, so sales gets ready-to-call leads instead of raw
            messages.
          </p>
        </div>
        <ul className="space-y-4">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <p.Icon size={15} />
              </span>
              <span className="pt-1 text-[13px] leading-relaxed text-white/85">{p.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-white/50">Internal proof of concept &middot; NetOne Zambia</p>
      </div>

      {/* Auth widget */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="text-center md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="NetOne" className="mx-auto mb-3 h-12 w-12 rounded-xl" />
          <h1 className="text-lg font-bold text-ink-900">NetOne Lead Intelligence</h1>
          <p className="mt-1 max-w-xs text-[13px] text-ink-500">
            Connects WhatsApp and other channels to Bitrix24 with AI-qualified leads.
          </p>
        </div>
        <div className="hidden text-center md:block">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
