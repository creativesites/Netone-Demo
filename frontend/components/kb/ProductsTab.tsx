'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ExternalLink, X, Save, Laptop } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/realtime';
import type { KbProduct } from '@/lib/types';

const EMPTY: Omit<KbProduct, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  category: 'laptop',
  price_zmw: null,
  price_note: '',
  specs: {},
  description: '',
  financing: '',
  source_url: '',
};

function fmtPrice(p: KbProduct) {
  if (p.price_zmw) return `K${Number(p.price_zmw).toLocaleString()}`;
  return p.price_note || 'Price on request';
}

export function ProductsTab() {
  const [products, setProducts] = useState<KbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KbProduct | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await apiGet('/api/kb/products');
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: number) {
    if (!confirm('Delete this product from the knowledge base?')) return;
    await apiDelete(`/api/kb/products/${id}`);
    load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-500">
          NetOne&apos;s product catalog — this is what Nia references when answering pricing and spec
          questions on WhatsApp. Keep it accurate.
        </p>
        <button
          onClick={() => setCreating(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Plus size={14} /> Add product
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-ink-400">Loading catalog…</div>
      ) : products.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-400">No products yet. Add one to get started.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Laptop size={14} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{p.name}</div>
                    <div className="text-[11px] capitalize text-ink-400">{p.category}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(p)} className="rounded-lg p-1.5 text-ink-400 hover:bg-surface-muted hover:text-ink-700">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="mt-2 text-base font-bold text-brand-600">{fmtPrice(p)}</div>
              {p.price_note && p.price_zmw && <div className="text-[11px] text-ink-400">{p.price_note}</div>}

              {p.description && <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{p.description}</p>}

              {Object.keys(p.specs ?? {}).length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {Object.entries(p.specs).map(([k, v]) => (
                    <div key={k} className="flex gap-1 text-[11px]">
                      <span className="font-medium text-ink-500">{k}:</span>
                      <span className="text-ink-600">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {p.financing && (
                <div className="mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">{p.financing}</div>
              )}

              {p.source_url && (
                <a
                  href={p.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex items-center gap-1 text-[11px] text-ink-400 hover:text-brand-600"
                >
                  Source <ExternalLink size={10} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <ProductForm
          product={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: KbProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Omit<KbProduct, 'id' | 'created_at' | 'updated_at'>>(
    product
      ? {
          name: product.name,
          category: product.category,
          price_zmw: product.price_zmw,
          price_note: product.price_note ?? '',
          specs: product.specs ?? {},
          description: product.description ?? '',
          financing: product.financing ?? '',
          source_url: product.source_url ?? '',
        }
      : EMPTY
  );
  const [specText, setSpecText] = useState(
    Object.entries(form.specs)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
  );
  const [saving, setSaving] = useState(false);

  function parseSpecs(text: string): Record<string, string> {
    const specs: Record<string, string> = {};
    text.split('\n').forEach((line) => {
      const [k, ...rest] = line.split(':');
      if (k && rest.length) specs[k.trim()] = rest.join(':').trim();
    });
    return specs;
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, specs: parseSpecs(specText) };
    try {
      if (product) {
        await apiPut(`/api/kb/products/${product.id}`, payload);
      } else {
        await apiPost('/api/kb/products', payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto scroll-thin rounded-2xl border border-line bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="text-sm font-semibold text-ink-900">{product ? 'Edit product' : 'Add product'}</div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-400 hover:bg-surface-muted">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="NEO Pro15P"
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium text-ink-500">Category</span>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-ink-500">Price (ZMW, optional)</span>
              <input
                type="number"
                value={form.price_zmw ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, price_zmw: e.target.value ? Number(e.target.value) : null }))}
                className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Price note (e.g. &quot;K220/month&quot; or &quot;was K14,999&quot;)</span>
            <input
              value={form.price_note ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, price_note: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Description</span>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Specs (one per line, &quot;Key: Value&quot;)</span>
            <textarea
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              rows={4}
              placeholder={'Processor: Intel i5\nRAM: 8GB\nStorage: 512GB SSD'}
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 font-mono text-[13px] outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Financing note</span>
            <input
              value={form.financing ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, financing: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Source URL (optional)</span>
            <input
              value={form.source_url ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-line px-3.5 py-2 text-sm text-ink-600 hover:bg-surface-muted">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
