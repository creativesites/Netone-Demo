'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import { useRealtimeCollection } from '@/lib/realtime';
import { exportLeadsToExcel } from '@/lib/exportLeads';
import { bitrixLeadUrl } from '@/lib/bitrix';
import { channelLabel } from '@/lib/channel';
import { CreditRiskBadge } from '@/components/CreditRiskBadge';
import type { Lead } from '@/lib/types';

const QUALIFICATIONS = ['qualified', 'needs_follow_up', 'unqualified'] as const;

function qualBadge(q: string | null) {
  switch (q) {
    case 'qualified':
      return { text: 'Qualified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'needs_follow_up':
      return { text: 'Needs follow-up', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'unqualified':
      return { text: 'Unqualified', cls: 'bg-gray-100 text-ink-500 border-line' };
    default:
      return { text: 'Pending', cls: 'bg-gray-100 text-ink-400 border-line' };
  }
}

function intentTone(pi: string | null) {
  if (pi === 'high') return 'text-emerald-600';
  if (pi === 'medium') return 'text-amber-600';
  return 'text-ink-500';
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function LeadsPage() {
  const leads = useRealtimeCollection<Lead>('leads', 'updated_at', '/api/leads?limit=500', (r) => (r.leads ?? []) as Lead[], 5000, 500);

  const [search, setSearch] = useState('');
  const [qualFilter, setQualFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (qualFilter !== 'all' && l.qualification_status !== qualFilter) return false;
      if (!q) return true;
      return [l.name, l.phone, l.product, l.next_action, l.collected?.location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, search, qualFilter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">CRM</div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Leads</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Every lead the pipeline has qualified, across every channel. Click a row for the full profile.
          </p>
        </div>
        <button
          onClick={() => exportLeadsToExcel(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          Export to Excel
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, product, location…"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink-800 outline-none focus:border-brand-400"
          />
        </div>
        <select
          value={qualFilter}
          onChange={(e) => setQualFilter(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-800 outline-none focus:border-brand-400"
        >
          <option value="all">All qualifications</option>
          {QUALIFICATIONS.map((q) => (
            <option key={q} value={q}>
              {q.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-400">
          {filtered.length} of {leads.length}
        </span>
      </div>

      <div className="mt-4 card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted text-[11px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Intent</th>
                <th className="px-4 py-3 font-semibold">Qualification</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Credit risk</th>
                <th className="px-4 py-3 font-semibold">Bitrix</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-500">
                    {leads.length === 0 ? 'No leads yet.' : 'No leads match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const q = qualBadge(l.qualification_status);
                  const bitrixUrl = l.bitrix_lead_id ? bitrixLeadUrl(l.bitrix_lead_id) : null;
                  return (
                    <tr key={l.id} className="border-b border-line last:border-0 hover:bg-brand-50/40">
                      <td className="px-0 py-0">
                        <Link href={`/leads/${l.id}`} className="block px-4 py-3">
                          <div className="font-medium text-ink-800">{l.name ?? l.phone ?? 'Unknown'}</div>
                          <div className="text-[11px] text-ink-400">{l.phone ?? ''}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="block text-ink-500">
                          {channelLabel(l.channel)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="block text-ink-700">
                          {l.product ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className={`block font-medium capitalize ${intentTone(l.purchase_intent)}`}>
                          {l.purchase_intent ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="block">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${q.cls}`}>{q.text}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="block font-semibold text-ink-800">
                          {l.score ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="block">
                          <CreditRiskBadge risk={l.credit_risk} />
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {l.bitrix_lead_id && bitrixUrl ? (
                          <a
                            href={bitrixUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-mono text-violet-700 hover:bg-violet-100"
                          >
                            #{l.bitrix_lead_id}
                          </a>
                        ) : (
                          <Link href={`/leads/${l.id}`} className="block text-[11px] text-ink-400">
                            —
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="block whitespace-nowrap text-[11px] text-ink-400">
                          {fmt(l.updated_at)}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
