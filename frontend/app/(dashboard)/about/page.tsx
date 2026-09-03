import {
  MessageCircle,
  Target,
  Brain,
  Scale,
  Database,
  PhoneCall,
  BarChart3,
  SlidersHorizontal,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Circle,
  type LucideIcon,
} from 'lucide-react';
import { ArchitectureDiagram } from '@/components/architecture/ArchitectureDiagram';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600">{children}</div>;
}

function StageCard({ Icon, title, desc }: { Icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-white p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={16} />
      </span>
      <div>
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{desc}</p>
      </div>
    </div>
  );
}

function StatusRow({ label, live }: { label: string; live: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      {live ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Circle size={15} className="text-ink-300" />}
      <span className={live ? 'text-ink-800' : 'text-ink-400'}>{label}</span>
      <span
        className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          live ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-ink-400'
        }`}
      >
        {live ? 'Live' : 'Roadmap'}
      </span>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-brand-500 p-8 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/netone-logo-white.png" alt="NetOne" className="h-8 w-auto" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">Lead Intelligence &amp; Marketing Automation</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 md:text-[15px]">
          A centralized lead-automation layer that connects NetOne&apos;s digital marketing channels to
          Bitrix24 — it automatically captures and understands customer enquiries, qualifies prospects
          against NetOne&apos;s own business rules, and hands the sales team an actionable, ready-to-call lead.
        </p>
      </div>

      {/* Problem / value */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <SectionLabel>The problem</SectionLabel>
          <p className="text-sm leading-relaxed text-ink-700">
            Enquiries arrive across WhatsApp, social and web, in customers&apos; own words. Today that means
            manual reading, manual judgement calls on who&apos;s a real buyer, and manual data entry into
            Bitrix24 — slow, inconsistent, and easy for a good lead to fall through the cracks.
          </p>
        </div>
        <div className="card p-5">
          <SectionLabel>What this platform does</SectionLabel>
          <p className="text-sm leading-relaxed text-ink-700">
            Every enquiry — whichever channel it arrives on — is read by AI, scored against NetOne&apos;s
            configurable qualification criteria, and
            — if it&apos;s a genuine opportunity — created directly in Bitrix24 with the reasoning attached, so
            a rep opens a lead that&apos;s already pre-qualified instead of a cold, unread message.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-6">
        <SectionLabel>How it works</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <StageCard
            Icon={MessageCircle}
            title="1. Channel"
            desc="Customer sends a message on WhatsApp or Facebook Messenger (both live today), or another digital channel (roadmap) — no new app for the customer to install."
          />
          <StageCard
            Icon={Target}
            title="2. Lead capture"
            desc="The message is normalized into one common lead format, the contact is identified, and duplicate messages are ignored automatically."
          />
          <StageCard
            Icon={Brain}
            title="3. AI qualification"
            desc="AI reads the conversation and extracts intent, product interest, financing needs and urgency — and a conversational assistant asks for anything still missing."
          />
          <StageCard
            Icon={Scale}
            title="4. Scoring against NetOne's rules"
            desc="A configurable, weighted rules engine — not the AI — decides the qualification tier and produces a visible 0-100 score with a reasoned breakdown."
          />
          <StageCard
            Icon={Database}
            title="5. Bitrix24"
            desc="Qualified leads are created or enriched in the real Bitrix24 CRM automatically, with the AI summary and reasoning attached as lead notes."
          />
          <StageCard
            Icon={PhoneCall}
            title="6. Sales follow-up"
            desc="The lead is routed to the right desk (e.g. Financing, Customer Care) and a rep follows up with full context already captured."
          />
        </div>
      </div>

      {/* Architecture */}
      <div className="mt-6">
        <SectionLabel>Explore the architecture</SectionLabel>
        <p className="mb-3 text-sm text-ink-500">
          Start at the system level, then step into any highlighted box for how it actually works underneath.
        </p>
        <ArchitectureDiagram />
      </div>

      {/* Capabilities */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <SectionLabel>Key capabilities</SectionLabel>
          <ul className="space-y-2.5 text-sm text-ink-700">
            <li className="flex items-start gap-2">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-500" />
              A gatekeeper filters out greetings, spam and support chatter — only genuine sales opportunities
              reach Bitrix24.
            </li>
            <li className="flex items-start gap-2">
              <SlidersHorizontal size={15} className="mt-0.5 shrink-0 text-brand-500" />
              Qualification criteria, weights and thresholds are configurable to NetOne&apos;s process — not
              hard-coded — under Rules.
            </li>
            <li className="flex items-start gap-2">
              <Brain size={15} className="mt-0.5 shrink-0 text-brand-500" />
              Every score shows its reasoning: which criteria were met, which are missing, and the
              recommended next action.
            </li>
            <li className="flex items-start gap-2">
              <Zap size={15} className="mt-0.5 shrink-0 text-brand-500" />
              Bitrix24 remains the system of record — this layer makes what enters it more intelligent, it
              doesn&apos;t replace it.
            </li>
            <li className="flex items-start gap-2">
              <BarChart3 size={15} className="mt-0.5 shrink-0 text-brand-500" />
              A dedicated Analytics view gives management conversion rate, credit-risk distribution, product
              demand and lead volume — computed live from the same database, not a separate reporting layer.
            </li>
          </ul>
        </div>

        <div className="card p-5">
          <SectionLabel>What&apos;s live vs. roadmap</SectionLabel>
          <div className="divide-y divide-line">
            <StatusRow label="WhatsApp channel" live />
            <StatusRow label="Facebook Messenger channel" live />
            <StatusRow label="AI qualification &amp; scoring" live />
            <StatusRow label="Configurable qualification rules" live />
            <StatusRow label="Bitrix24 lead sync" live />
            <StatusRow label="Real-time inbox &amp; dashboard" live />
            <StatusRow label="Leads table, search &amp; Excel export" live />
            <StatusRow label="Management analytics" live />
            <StatusRow label="Channel &amp; source attribution" live />
            <StatusRow label="Human handoff (manual takeover)" live />
            <StatusRow label="Instagram &amp; website channels" live={false} />
            <StatusRow label="Campaign-level attribution (UTM, ad click-through)" live={false} />
            <StatusRow label="Automated follow-up escalation" live={false} />
            <StatusRow label="AI assist for sales reps" live={false} />
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-ink-400">
        NetOne Lead Intelligence &amp; Marketing Automation — internal proof of concept.
      </p>
    </div>
  );
}
