/** Knowledge base REST: editable product catalog + simulated document ingestion. */
import type { FastifyInstance } from 'fastify';
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listDocuments,
  createDocument,
  updateDocumentStatus,
  deleteDocument,
  type KbProductInput,
} from '../db/kb.repo.js';
import { logger } from '../logger.js';

function asProductInput(body: unknown): KbProductInput | null {
  const b = body as Partial<KbProductInput> & Record<string, unknown>;
  if (!b || typeof b.name !== 'string' || !b.name.trim()) return null;
  return {
    name: b.name.trim(),
    category: typeof b.category === 'string' ? b.category : 'laptop',
    price_zmw: typeof b.price_zmw === 'number' ? b.price_zmw : null,
    price_note: typeof b.price_note === 'string' ? b.price_note : null,
    specs: typeof b.specs === 'object' && b.specs ? (b.specs as Record<string, string>) : {},
    description: typeof b.description === 'string' ? b.description : null,
    financing: typeof b.financing === 'string' ? b.financing : null,
    source_url: typeof b.source_url === 'string' ? b.source_url : null,
  };
}

export async function kbRoutes(app: FastifyInstance): Promise<void> {
  // ── Products ─────────────────────────────────────────────
  app.get('/api/kb/products', async () => ({ products: await listProducts() }));

  app.post('/api/kb/products', async (req, reply) => {
    const input = asProductInput(req.body);
    if (!input) return reply.code(400).send({ error: 'name is required' });
    return { product: await createProduct(input) };
  });

  app.put('/api/kb/products/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const input = asProductInput(req.body);
    if (!Number.isInteger(id) || !input) return reply.code(400).send({ error: 'invalid id or payload' });
    const product = await updateProduct(id, input);
    if (!product) return reply.code(404).send({ error: 'not found' });
    return { product };
  });

  app.delete('/api/kb/products/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid id' });
    await deleteProduct(id);
    return { ok: true };
  });

  // ── Documents (simulated ingestion pipeline) ────────────────
  app.get('/api/kb/documents', async () => ({ documents: await listDocuments() }));

  app.post('/api/kb/documents', async (req, reply) => {
    const body = (req.body ?? {}) as { title?: string; doc_type?: 'note' | 'url' | 'upload'; source?: string; content?: string };
    if (!body.title?.trim() || !body.content?.trim()) {
      return reply.code(400).send({ error: 'title and content are required' });
    }
    const doc = await createDocument({
      title: body.title.trim(),
      doc_type: body.doc_type ?? 'note',
      source: body.source ?? null,
      content: body.content.trim(),
      status: 'ingesting',
    });

    // Simulated ingestion pipeline (parse -> chunk -> embed -> index). No real
    // vector store here — the point is the KB content is genuinely fed to the
    // AI prompts once indexed; the delay just gives the UI a real progress arc.
    setTimeout(async () => {
      try {
        await updateDocumentStatus(doc.id, 'indexed');
      } catch (err) {
        logger.warn({ err: String(err), docId: doc.id }, 'KB document ingestion failed');
      }
    }, 2500 + Math.random() * 2000);

    return { document: doc };
  });

  app.delete('/api/kb/documents/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid id' });
    await deleteDocument(id);
    return { ok: true };
  });
}
