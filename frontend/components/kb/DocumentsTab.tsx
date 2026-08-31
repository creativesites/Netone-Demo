'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, FileText, Link2, Upload, X, CheckCircle2, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/realtime';
import { formatDateTime } from '@/lib/format';
import type { KbDocument } from '@/lib/types';

const INGEST_STEPS = ['Uploading', 'Parsing content', 'Chunking', 'Generating embeddings', 'Indexing'];

function fmtDate(val: unknown) {
  return formatDateTime(val, '');
}

export function DocumentsTab() {
  const [documents, setDocuments] = useState<KbDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const res = await apiGet('/api/kb/documents');
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // While anything is still "ingesting", poll so the status flips to Indexed live.
  useEffect(() => {
    const hasIngesting = documents.some((d) => d.status === 'ingesting');
    if (hasIngesting && !pollRef.current) {
      pollRef.current = setInterval(load, 1200);
    } else if (!hasIngesting && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [documents]);

  async function remove(id: number) {
    if (!confirm('Remove this document from the knowledge base?')) return;
    await apiDelete(`/api/kb/documents/${id}`);
    load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-500">
          Reference notes fed into Nia&apos;s knowledge — paste a doc, a policy note, or a URL and it&apos;s
          ingested into the knowledge base.
        </p>
        <button
          onClick={() => setAdding(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Plus size={14} /> Add document
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-ink-400">Loading documents…</div>
      ) : documents.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-400">No documents yet.</div>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="card flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                {d.doc_type === 'url' ? <Link2 size={15} /> : d.doc_type === 'upload' ? <Upload size={15} /> : <FileText size={15} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-ink-900">{d.title}</div>
                  {d.status === 'indexed' ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <CheckCircle2 size={10} /> Indexed
                    </span>
                  ) : d.status === 'failed' ? (
                    <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Failed</span>
                  ) : (
                    <IngestingBadge />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-500">{d.content}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
                  {d.source && <span className="truncate">{d.source}</span>}
                  <span>{fmtDate(d.created_at)}</span>
                </div>
              </div>
              <button onClick={() => remove(d.id)} className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddDocumentModal
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function IngestingBadge() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStep((s) => Math.min(s + 1, INGEST_STEPS.length - 1)), 700);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      <Loader2 size={10} className="animate-spin" /> {INGEST_STEPS[step]}…
    </span>
  );
}

function AddDocumentModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<'note' | 'url'>('note');
  const [source, setSource] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await apiPost('/api/kb/documents', { title: title.trim(), doc_type: docType, source: source.trim() || null, content: content.trim() });
      onAdded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="text-sm font-semibold text-ink-900">Add document</div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-400 hover:bg-surface-muted">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex gap-1">
            {(['note', 'url'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDocType(t)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${
                  docType === t ? 'bg-brand-50 text-brand-600' : 'bg-surface-muted text-ink-500 hover:bg-surface-muted/70'
                }`}
              >
                {t === 'note' ? 'Paste text' : 'Reference URL'}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Financing partner terms"
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          {docType === 'url' && (
            <label className="block">
              <span className="text-[11px] font-medium text-ink-500">Source URL</span>
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
              />
            </label>
          )}
          <label className="block">
            <span className="text-[11px] font-medium text-ink-500">Content</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Paste the document text here — this is what gets ingested and referenced by the AI."
              className="mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <p className="text-[11px] text-ink-400">
            Ingestion (parsing, chunking, embedding, indexing) is simulated for the demo — the content is
            genuinely added to the AI&apos;s knowledge once indexed.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-line px-3.5 py-2 text-sm text-ink-600 hover:bg-surface-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? 'Ingesting…' : 'Ingest document'}
          </button>
        </div>
      </div>
    </div>
  );
}
