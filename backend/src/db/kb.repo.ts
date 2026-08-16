/** Knowledge base: editable product catalog + simulated document ingestion. */
import { query } from './pool.js';
import { logger } from '../logger.js';

export interface KbProduct {
  id: number;
  name: string;
  category: string;
  price_zmw: number | null;
  price_note: string | null;
  specs: Record<string, string>;
  description: string | null;
  financing: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface KbProductInput {
  name: string;
  category?: string;
  price_zmw?: number | null;
  price_note?: string | null;
  specs?: Record<string, string>;
  description?: string | null;
  financing?: string | null;
  source_url?: string | null;
}

export async function listProducts(): Promise<KbProduct[]> {
  const res = await query<KbProduct>(`SELECT * FROM kb_products ORDER BY category, price_zmw NULLS LAST, name`);
  return res.rows;
}

export async function createProduct(input: KbProductInput): Promise<KbProduct> {
  const res = await query<KbProduct>(
    `INSERT INTO kb_products (name, category, price_zmw, price_note, specs, description, financing, source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      input.name,
      input.category ?? 'laptop',
      input.price_zmw ?? null,
      input.price_note ?? null,
      JSON.stringify(input.specs ?? {}),
      input.description ?? null,
      input.financing ?? null,
      input.source_url ?? null,
    ]
  );
  return res.rows[0];
}

export async function updateProduct(id: number, input: KbProductInput): Promise<KbProduct | null> {
  const res = await query<KbProduct>(
    `UPDATE kb_products SET
        name = $2, category = $3, price_zmw = $4, price_note = $5,
        specs = $6, description = $7, financing = $8, source_url = $9, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [
      id,
      input.name,
      input.category ?? 'laptop',
      input.price_zmw ?? null,
      input.price_note ?? null,
      JSON.stringify(input.specs ?? {}),
      input.description ?? null,
      input.financing ?? null,
      input.source_url ?? null,
    ]
  );
  return res.rows[0] ?? null;
}

export async function deleteProduct(id: number): Promise<void> {
  await query(`DELETE FROM kb_products WHERE id = $1`, [id]);
}

export interface KbDocument {
  id: number;
  title: string;
  doc_type: 'note' | 'url' | 'upload';
  source: string | null;
  content: string;
  status: 'ingesting' | 'indexed' | 'failed';
  created_at: string;
}

export async function listDocuments(): Promise<KbDocument[]> {
  const res = await query<KbDocument>(`SELECT * FROM kb_documents ORDER BY created_at DESC`);
  return res.rows;
}

export async function createDocument(input: {
  title: string;
  doc_type: 'note' | 'url' | 'upload';
  source?: string | null;
  content: string;
  status?: 'ingesting' | 'indexed' | 'failed';
}): Promise<KbDocument> {
  const res = await query<KbDocument>(
    `INSERT INTO kb_documents (title, doc_type, source, content, status)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.title, input.doc_type, input.source ?? null, input.content, input.status ?? 'ingesting']
  );
  return res.rows[0];
}

export async function updateDocumentStatus(id: number, status: 'ingesting' | 'indexed' | 'failed'): Promise<void> {
  await query(`UPDATE kb_documents SET status = $2 WHERE id = $1`, [id, status]);
}

// createDocument()'s "ingestion" is a simulated in-memory setTimeout — if the
// backend restarts inside that ~2.5-4.5s window, the doc is left stuck at
// 'ingesting' forever (no persisted job survives a restart), silently
// excluded from getKnowledgeContext() with no way to recover from the UI.
// Since ingestion has no real processing risk, self-heal any leftovers on
// every startup rather than requiring someone to notice and re-add the doc.
export async function healStuckIngestion(): Promise<void> {
  const res = await query(`UPDATE kb_documents SET status = 'indexed' WHERE status = 'ingesting' RETURNING id`);
  if ((res.rowCount ?? 0) > 0) {
    logger.info({ count: res.rowCount }, 'Healed KB documents stuck in ingesting from a previous run');
  }
}

export async function deleteDocument(id: number): Promise<void> {
  await query(`DELETE FROM kb_documents WHERE id = $1`, [id]);
}

/** Compact text block fed into the AI prompts so Nia actually knows NetOne's real catalog. */
export async function getKnowledgeContext(): Promise<string> {
  const [products, documents] = await Promise.all([listProducts(), listDocuments()]);
  const parts: string[] = [];

  if (products.length) {
    parts.push(
      'PRODUCT CATALOG:\n' +
        products
          .map((p) => {
            const specBits = Object.entries(p.specs ?? {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            const price = p.price_zmw ? `K${Number(p.price_zmw).toLocaleString()}` : p.price_note ?? 'price on request';
            return `- ${p.name} (${p.category}) — ${price}${specBits ? ` — ${specBits}` : ''}${p.financing ? ` — Financing: ${p.financing}` : ''}`;
          })
          .join('\n')
    );
  }

  const indexed = documents.filter((d) => d.status === 'indexed');
  if (indexed.length) {
    parts.push(
      'REFERENCE NOTES:\n' +
        indexed
          .slice(0, 8)
          .map((d) => `- ${d.title}: ${d.content.slice(0, 400)}`)
          .join('\n')
    );
  }

  return parts.join('\n\n');
}
