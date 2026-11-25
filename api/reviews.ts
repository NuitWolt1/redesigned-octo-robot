import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRequestBody, verifyAdminInitData } from '../server/admin.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

type ReviewRow = { id: string; username: string; rating: number; review_text: string; created_at: string };
function safeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function fromRow(row: ReviewRow) {
  return { id: row.id, username: row.username, rating: row.rating, text: row.review_text, createdAt: Date.parse(row.created_at) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured. Add Supabase environment variables in Vercel.' });

  try {
    if (req.method === 'GET') {
      const query = new URLSearchParams({ select: '*', order: 'created_at.desc' });
      const rows = await databaseRequest<ReviewRow[]>('reviews', query, 'GET');
      return res.status(200).json({ items: rows.map(fromRow) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const body = readRequestBody(req.body);
    if (!verifyAdminInitData(typeof body.initData === 'string' ? body.initData : '')) {
      return res.status(403).json({ error: 'Administrator access required.' });
    }

    if (body.action === 'delete') {
      const id = safeText(body.id, 100);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'Invalid review ID.' });
      const query = new URLSearchParams({ id: `eq.${id}`, select: 'id' });
      await databaseRequest<unknown[]>('reviews', query, 'DELETE');
      return res.status(200).json({ ok: true });
    }

    const normalizeReview = (input: unknown) => {
      const review = input as { id?: unknown; username?: unknown; rating?: unknown; text?: unknown; createdAt?: unknown } | undefined;
      if (!review) throw new Error('Invalid review details.');
      const id = safeText(review.id, 100);
      const username = safeText(review.username, 40);
      const text = safeText(review.text, 900);
      const rating = Number(review.rating);
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || !username || !text || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Invalid review details.');
      }
      const ts = Number(review.createdAt);
      const validDate = Number.isFinite(ts) && ts > 1.4e12 && ts < Date.now() + 48 * 3600 * 1000;
      return { id, username, rating, review_text: text, ...(validDate ? { created_at: new Date(ts).toISOString() } : {}) };
    };
    const query = new URLSearchParams({ select: '*' });
    if (body.action === 'import') {
      const items = body.items;
      if (!Array.isArray(items) || items.length > 500) return res.status(400).json({ error: 'Invalid import list (maximum 500 reviews).'});
      const rowsToImport = items.map(normalizeReview);
      if (!rowsToImport.length) return res.status(200).json({ imported: 0 });
      query.set('on_conflict', 'id');
      const rows = await databaseRequest<ReviewRow[]>('reviews', query, 'POST', rowsToImport, 'resolution=merge-duplicates,return=representation');
      return res.status(200).json({ imported: rows.length });
    }
    if (body.action !== 'create') return res.status(400).json({ error: 'Unknown action.' });
    const row = normalizeReview(body.review);
    const rows = await databaseRequest<ReviewRow[]>('reviews', query, 'POST', row);
    return res.status(201).json({ item: fromRow(rows[0]) });
  } catch (error) {
    console.error('Reviews API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return res.status(message.includes('not configured') ? 503 : message === 'Invalid review details.' ? 400 : 500).json({ error: message });
  }
}
