'use client';

import { Check, Circle, ExternalLink, X, Clock } from 'lucide-react';
import type { Conversation, Lead } from '@/lib/types';
import { bitrixLeadUrl } from '@/lib/bitrix';
import { LeadScoreCard } from '../LeadScoreCard';
import { CreditRiskBadge } from '../CreditRiskBadge';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-ink-400">{label}</span>
      <span className="text-xs font-medium text-ink-800">{value}</span>
    </div>
  );
}

const FIELDS: { key: keyof NonNullable<Lead['collected']>; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'product', label: 'Product' },
  { key: 'financing', label: 'Financing' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'employment', label: 'Employment' },
  { key: 'monthlyIncome', label: 'Monthly income' },
];

export function IntelPanel({ conversation, lead }: { conversation: Conversation | null; lead: Lead | null }) {
  if (!conversation) {
    return <div className="border-l border-line bg-white" />;
  }

  const collected = lead?.collected ?? null;
  const filled = collected ? FIELDS.filter((f) => collected[f.key]).length : 0;
  const pct = Math.round((filled / FIELDS.length) * 100);

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin border-l border-line bg-white p-4">
      <div className="mb-4 flex flex-col items-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white">
          {(conversation.contact_name ?? conversation.phone ?? '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="text-sm font-semibold text-ink-900">{conversation.contact_name ?? conversation.phone}</div>
        <div className="text-[11px] text-ink-500">{conversation.phone}</div>
        {conversation.is_lead ? (
          <span className="mt-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">SALES LEAD</span>
        ) : (
          <span className="mt-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">Not a lead · inbox only</span>
        )}
      </div>

      {!conversation.is_lead && (
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-[11px] leading-relaxed text-ink-500">
          The gatekeeper classified this chat as non-sales, so it stays in the inbox and is not pushed to the CRM.
        </div>
      )}

      {conversation.is_lead && lead && (
        <>
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Profile collected</span>
              <span className="text-[11px] font-bold text-ink-700">{pct}%</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-1">
              {FIELDS.map((f) => {
                const val = collected?.[f.key];
                return (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    {val ? <Check size={13} className="shrink-0 text-emerald-500" /> : <Circle size={13} className="shrink-0 text-gray-300" />}
                    <span className="text-ink-400">{f.label}:</span>
                    <span className="truncate text-ink-800">{val ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-muted p-3">
            <Row label="Intent" value={<span className="capitalize">{(lead.intent ?? '—').replace(/_/g, ' ')}</span>} />
            <Row label="Purchase intent" value={<span className="capitalize">{lead.purchase_intent ?? '—'}</span>} />
            <Row label="Qualification" value={<span className="capitalize">{(lead.qualification_status ?? '—').replace(/_/g, ' ')}</span>} />
            <Row label="Assigned" value={lead.assigned_to ?? '—'} />
          </div>

          {(lead.financing_interest || (lead.credit_risk && lead.credit_risk !== 'unknown')) && (
            <div className="mt-3 flex justify-center">
              <CreditRiskBadge risk={lead.credit_risk} />
            </div>
          )}

          <div className="mt-3">
            <LeadScoreCard score={lead.score} breakdown={lead.score_breakdown} nextAction={lead.next_action} compact />
          </div>

          <div className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
            <div className="text-[10px] uppercase tracking-wide text-ink-400">Bitrix24 CRM</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`flex items-center gap-1 text-xs font-semibold ${lead.bitrix_status === 'synced' ? 'text-emerald-600' : lead.bitrix_status === 'failed' ? 'text-rose-600' : 'text-amber-600'}`}>
                {lead.bitrix_status === 'synced' ? <Check size={12} /> : lead.bitrix_status === 'failed' ? <X size={12} /> : <Clock size={12} />}
                {lead.bitrix_status === 'synced' ? 'Synced' : lead.bitrix_status === 'failed' ? 'Failed' : 'Pending'}
              </span>
              {lead.bitrix_lead_id && (() => {
                const url = bitrixLeadUrl(lead.bitrix_lead_id);
                return url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] text-violet-700 hover:bg-violet-100"
                  >
                    #{lead.bitrix_lead_id} <ExternalLink size={9} />
                  </a>
                ) : (
                  <span className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] text-violet-700">#{lead.bitrix_lead_id}</span>
                );
              })()}
            </div>
          </div>

          {lead.ai_summary && (
            <div className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
              <div className="text-[10px] uppercase tracking-wide text-ink-400">AI summary</div>
              <p className="mt-1 text-xs text-ink-700">{lead.ai_summary}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
