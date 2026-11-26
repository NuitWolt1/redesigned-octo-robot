import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isBotRequest, readRequestBody, verifyAdminInitData } from '../server/admin.js';
import { SERIAL, giftRow, lookupGift } from '../server/gifts.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

type GiftInput = {
  id: string; collection: string; number: number; model: string; modelRarity: string;
  backdrop: string; backdropRarity: string; symbol: string; symbolRarity: string;
  image: string; source: string; serial: string; price?: unknown;
};
type GiftRow = {
  id: string; collection: string; gift_number: number; model: string; model_rarity: string;
  backdrop: string; backdrop_rarity: string; symbol: string; symbol_rarity: string;
  image: string; source: string; serial: string; created_at: string; price_rub?: number | string | null;
};

function safeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function validHttpUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:'; } catch { return false; }
}
function fromRow(row: GiftRow) {
  return {
    id: row.id, collection: row.collection, number: row.gift_number, model: row.model,
    modelRarity: row.model_rarity, backdrop: row.backdrop, backdropRarity: row.backdrop_rarity,
    symbol: row.symbol, symbolRarity: row.symbol_rarity, image: row.image, source: row.source,
    serial: row.serial, createdAt: row.created_at,
    price: row.price_rub === null || row.price_rub === undefined ? null : Number(row.price_rub)
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured. Add Supabase environment variables in Vercel.' });

  try {
    if (req.method === 'GET') {
      const query = new URLSearchParams({ select: '*', order: 'created_at.desc' });
      const rows = await databaseRequest<GiftRow[]>('market_gifts', query, 'GET');
      return res.status(200).json({ items: rows.map(fromRow) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const body = readRequestBody(req.body);
    if (!isBotRequest(req.headers['x-bot-auth']) && !verifyAdminInitData(typeof body.initData === 'string' ? body.initData : '')) {
      return res.status(403).json({ error: 'Administrator access required.' });
    }

    const action = body.action;
    if (action === 'delete') {
      const id = safeText(body.id, 100);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'Invalid gift ID.' });
      const query = new URLSearchParams({ id: `eq.${id}`, select: 'id' });
      await databaseRequest<unknown[]>('market_gifts', query, 'DELETE');
      return res.status(200).json({ ok: true });
    }

    if (action === 'add_links') {
      const links = Array.isArray(body.links) ? body.links.slice(0, 25) as { serial?: unknown; price?: unknown }[] : [];
      const wanted = links.filter(l => typeof l.serial === 'string' && SERIAL.test(l.serial));
      if (!wanted.length) return res.status(400).json({ error: 'No valid gift links.' });
      const found = await Promise.all(wanted.map(async l => ({ l, r: await lookupGift(l.serial as string) })));
      const rows = found.flatMap(({ l, r }) => {
        if (!r.ok) return [];
        const p = Number(l.price);
        return [giftRow(r.serial, r, Number.isFinite(p) && p > 0 && p <= 1e9 ? Math.round(p * 100) / 100 : undefined)];
      });
      if (rows.length) await databaseRequest<GiftRow[]>('market_gifts', new URLSearchParams({ select: 'id', on_conflict: 'id' }), 'POST', rows, 'resolution=merge-duplicates,return=representation');
      return res.status(200).json({ added: rows.length, failed: found.filter(f => !f.r.ok).map(f => ({ serial: f.r.serial, error: (f.r as { error: string }).error })) });
    }

    if (action === 'set_price') {
      const id = safeText(body.id, 100);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'Invalid gift ID.' });
      const empty = body.price === null || body.price === undefined || body.price === '';
      const price = empty ? null : Math.round(Number(body.price) * 100) / 100;
      if (price !== null && (!Number.isFinite(price) || price <= 0 || price > 1e9)) return res.status(400).json({ error: 'Invalid price.' });
      const rows = await databaseRequest<GiftRow[]>('market_gifts', new URLSearchParams({ id: `eq.${id}`, select: '*' }), 'PATCH', { price_rub: price });
      if (!rows.length) return res.status(404).json({ error: 'Gift not found.' });
      return res.status(200).json({ item: fromRow(rows[0]) });
    }

    const normalizeGift = (input: unknown) => {
      const gift = input as Partial<GiftInput> | undefined;
      if (!gift) throw new Error('Invalid gift details.');
      const id = safeText(gift.id, 100);
      const collection = safeText(gift.collection, 100);
      const model = safeText(gift.model, 100);
      const backdrop = safeText(gift.backdrop, 100);
      const symbol = safeText(gift.symbol, 100);
      const image = safeText(gift.image, 1000);
      const source = safeText(gift.source, 1000);
      const number = Number(gift.number);
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || !collection || !model || !backdrop || !symbol || !Number.isSafeInteger(number) || number < 1 || !validHttpUrl(image) || !validHttpUrl(source)) {
        throw new Error('Invalid gift details.');
      }
      const rawPrice = gift.price;
      const price = rawPrice === null || rawPrice === undefined || rawPrice === '' ? undefined : Math.round(Number(rawPrice) * 100) / 100;
      if (price !== undefined && (!Number.isFinite(price) || price <= 0 || price > 1e9)) throw new Error('Invalid gift details.');
      return {
        ...(price !== undefined ? { price_rub: price } : {}),
        id, collection, gift_number: number, model, model_rarity: safeText(gift.modelRarity, 30) || '—',
        backdrop, backdrop_rarity: safeText(gift.backdropRarity, 30) || '—', symbol,
        symbol_rarity: safeText(gift.symbolRarity, 30) || '—', image, source,
        serial: safeText(gift.serial, 160) || `${collection}-${number}`
      };
    };

    const query = new URLSearchParams({ select: '*' });
    if (action === 'import') {
      const gifts = body.items;
      if (!Array.isArray(gifts) || gifts.length > 500) return res.status(400).json({ error: 'Invalid import list (maximum 500 gifts).'});
      const rowsToImport = gifts.map(normalizeGift);
      if (!rowsToImport.length) return res.status(200).json({ imported: 0 });
      query.set('on_conflict', 'id');
      const rows = await databaseRequest<GiftRow[]>('market_gifts', query, 'POST', rowsToImport, 'resolution=merge-duplicates,return=representation');
      return res.status(200).json({ imported: rows.length });
    }
    if (action !== 'create') return res.status(400).json({ error: 'Unknown action.' });
    const row = normalizeGift(body.gift);
    const rows = await databaseRequest<GiftRow[]>('market_gifts', query, 'POST', row);
    return res.status(201).json({ item: fromRow(rows[0]) });
  } catch (error) {
    console.error('Catalog API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return res.status(message.includes('not configured') ? 503 : message === 'Invalid gift details.' ? 400 : 500).json({ error: message });
  }
}
