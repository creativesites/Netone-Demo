import type { Lead } from './types';

const COLUMNS: { header: string; get: (l: Lead) => string }[] = [
  { header: 'ID', get: (l) => String(l.id) },
  { header: 'Name', get: (l) => l.name ?? '' },
  { header: 'Phone', get: (l) => l.phone ?? '' },
  { header: 'Channel', get: (l) => l.channel },
  { header: 'Product', get: (l) => l.product ?? '' },
  { header: 'Purchase Intent', get: (l) => l.purchase_intent ?? '' },
  { header: 'Financing Interest', get: (l) => (l.financing_interest ? 'Yes' : 'No') },
  { header: 'Qualification', get: (l) => (l.qualification_status ?? '').replace(/_/g, ' ') },
  { header: 'Score', get: (l) => (l.score != null ? String(l.score) : '') },
  { header: 'Credit Risk', get: (l) => l.credit_risk ?? '' },
  { header: 'Employment', get: (l) => l.collected?.employment ?? '' },
  { header: 'Monthly Income', get: (l) => l.collected?.monthlyIncome ?? '' },
  { header: 'Location', get: (l) => l.collected?.location ?? '' },
  { header: 'Assigned To', get: (l) => l.assigned_to ?? '' },
  { header: 'Next Action', get: (l) => l.next_action ?? '' },
  { header: 'Bitrix Status', get: (l) => l.bitrix_status ?? '' },
  { header: 'Bitrix Lead ID', get: (l) => l.bitrix_lead_id ?? '' },
  { header: 'Created At', get: (l) => l.created_at },
  { header: 'Updated At', get: (l) => l.updated_at },
];

// Excel's CSV import treats a field as a formula if it starts with one of
// these characters — prefix with a tab to defuse it without corrupting the
// visible value (protects against a lead name/product containing e.g. "=cmd").
function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `\t${value}` : value;
  const escaped = guarded.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

/** Builds a CSV (Excel opens it natively) from the given leads and triggers a browser download. */
export function exportLeadsToExcel(leads: Lead[], filename = 'netone-leads.csv'): void {
  const lines = [
    COLUMNS.map((c) => csvCell(c.header)).join(','),
    ...leads.map((l) => COLUMNS.map((c) => csvCell(c.get(l))).join(',')),
  ];
  // UTF-8 BOM so Excel renders non-ASCII characters correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Revoking the object URL synchronously, in the same tick as the click,
  // races the browser's actual download-start in some engines (Firefox
  // especially) and can silently kill the download with no visible error —
  // defer cleanup so the browser has a chance to begin reading the blob first.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
