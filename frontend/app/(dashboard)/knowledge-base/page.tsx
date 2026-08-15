'use client';

import { useState } from 'react';
import { Package, FileStack } from 'lucide-react';
import { ProductsTab } from '@/components/kb/ProductsTab';
import { DocumentsTab } from '@/components/kb/DocumentsTab';

const TABS = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'documents', label: 'Documents', icon: FileStack },
] as const;

export default function KnowledgeBasePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('products');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Configuration</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Knowledge Base</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-500">
        What Nia knows about NetOne — editable products and reference documents. Add more, correct
        pricing, or ingest new material any time; changes take effect on the very next conversation.
      </p>

      <div className="mt-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">{tab === 'products' ? <ProductsTab /> : <DocumentsTab />}</div>
    </div>
  );
}
