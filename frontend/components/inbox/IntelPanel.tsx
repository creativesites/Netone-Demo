'use client';

import { Check, Circle } from 'lucide-react';
import type { Conversation, Lead } from '@/lib/types';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-200">{value}</span>
    </div>
  );
}

const FIELDS: { key: keyof NonNullable<Lead['collected']>; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'product', label: 'Product' },
  { key: 'financing', label: 'Financing' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
];

export function IntelPanel({ conversation, lead }: { conversation: Conversation | null; lead: Lead | null }) {
  if (!conversation) {
    return <div className="border-l border-white/5 bg-white/[0.01]" />;
  }

  const collected = lead?.collected ?? null;
  const filled = collected ? FIELDS.filter((f) => collected[f.key]).length : 0;
  const pct = Math.round((filled / FIELDS.length) * 100);

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin border-l border-white/5 bg-white/[0.01] p-4">
      <div className="mb-4 flex flex-col items-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-emerald-500 text-lg font-bold text-white">
          {(conversation.contact_name ?? conversation.phone ?? '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="text-sm font-bold text-white">{conversation.contact_name ?? conversation.phone}</div>
        <div className="text-[11px] text-slate-500">{conversation.phone}</div>
        {conversation.is_lead ? (
          <span className="mt-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            SALES LEAD
          </span>
        ) : (
          <span className="mt-2 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            Not a lead · inbox only
          </span>
        )}
      </div>

      {!conversation.is_lead && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-400">
          The gatekeeper classified this chat as non-sales, so it stays in the inbox and is not pushed to the CRM.
        </div>
      )}

      {conversation.is_lead && lead && (
        <>
          {/* Profile completeness */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Profile collected</span>
              <span className="text-[11px] font-bold text-slate-300">{pct}%</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-1">
              {FIELDS.map((f) => {
                const val = collected?.[f.key];
                return (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    {val ? (
                      <Check size={13} className="shrink-0 text-emerald-400" />
                    ) : (
                      <Circle size={13} className="shrink-0 text-slate-600" />
                    )}
                    <span className="text-slate-500">{f.label}:</span>
                    <span className="truncate text-slate-200">{val ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead intelligence */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <Row label="Intent" value={<span className="capitalize">{(lead.intent ?? '—').replace(/_/g, ' ')}</span>} />
            <Row label="Purchase intent" value={<span className="capitalize">{lead.purchase_intent ?? '—'}</span>} />
            <Row
              label="Qualification"
              value={<span className="capitalize">{(lead.qualification_status ?? '—').replace(/_/g, ' ')}</span>}
            />
            <Row label="Assigned" value={lead.assigned_to ?? '—'} />
          </div>

          {/* Bitrix */}
          <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Bitrix24 CRM</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`text-xs font-semibold ${
                  lead.bitrix_status === 'synced'
                    ? 'text-emerald-300'
                    : lead.bitrix_status === 'failed'
                      ? 'text-rose-300'
                      : 'text-amber-300'
                }`}
              >
                {lead.bitrix_status === 'synced' ? '✓ Synced' : lead.bitrix_status === 'failed' ? '✗ Failed' : '⏳ Pending'}
              </span>
              {lead.bitrix_lead_id && (
                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[11px] text-violet-300">
                  #{lead.bitrix_lead_id}
                </span>
              )}
            </div>
          </div>

          {lead.ai_summary && (
            <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">AI summary</div>
              <p className="mt-1 text-xs text-slate-300">{lead.ai_summary}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
