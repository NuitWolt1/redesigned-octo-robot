import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isBotRequest, readRequestBody, verifyAdminInitData, verifyTelegramInitData } from '../server/admin.js';
import { SERIAL, giftRow, lookupGift } from '../server/gifts.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

type Row = {
  id: string; telegram_id: string; serial: string; collection: string; gift_number: number; model: string; model_rarity: string;
  backdrop: string; backdrop_rarity: string; symbol: string; symbol_rarity: string; image: string; source: string;
  price_rub: number | string | null; created_at: string;
};
const toItem = (r: Row) => ({
  id: r.id, serial: r.serial, collection: r.collection, number: r.gift_number, model: r.model, modelRarity: r.model_rarity,
  backdrop: r.backdrop, backdropRarity: r.backdrop_rarity, symbol: r.symbol, symbolRarity: r.symbol_rarity, image: r.image,
  source: r.source, price: r.price_rub === null ? null : Number(r.price_rub), createdAt: Date.parse(r.created_at)
});
const marketId = (id: string) => `my-${id.replace(/-/g, '')}`;
const UUID = /^[0-9a-f-]{36}$/i;
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured. Add Supabase environment variables in Vercel.' });

  try {
    const body = readRequestBody(req.body);
    const initData = typeof body.initData === 'string' ? body.initData : '';
    const action = body.action;
    const mine = (id: string) => databaseRequest<Row[]>('user_gifts', new URLSearchParams({ select: '*', telegram_id: `eq.${id}`, order: 'created_at.desc', limit: '100' }), 'GET');
    const byId = async (id: string) => (await databaseRequest<Row[]>('user_gifts', new URLSearchParams({ select: '*', id: `eq.${id}` }), 'GET'))[0];
    const patchPrice = async (id: string, price: number | null) => (await databaseRequest<Row[]>('user_gifts', new URLSearchParams({ select: '*', id: `eq.${id}` }), 'PATCH', { price_rub: price }))[0];

    if (action === 'me' || action === 'list_item' || action === 'unlist') {
      const user = verifyTelegramInitData(initData);
      if (!user) return res.status(403).json({ error: 'Open the Mini App inside Telegram.' });
      if (action === 'me') return res.status(200).json({ items: (await mine(user.id)).map(toItem) });
      const id = String(body.id ?? '');
      const row = UUID.test(id) ? await byId(id) : undefined;
      if (!row || row.telegram_id !== user.id) return res.status(404).json({ error: 'Gift not found.' });
      if (action === 'unlist') {
        await databaseRequest<unknown[]>('market_gifts', new URLSearchParams({ id: `eq.${marketId(id)}`, select: 'id' }), 'DELETE');
        return res.status(200).json({ item: toItem(await patchPrice(id, null)) });
      }
      const price = Math.round(Number(body.price) * 100) / 100;
      if (!Number.isFinite(price) || price <= 0 || price > 1e9) return res.status(400).json({ error: 'Invalid price.' });
      await databaseRequest<unknown[]>('market_gifts', new URLSearchParams({ select: 'id', on_conflict: 'id' }), 'POST', {
        id: marketId(id), collection: row.collection, gift_number: row.gift_number, model: row.model, model_rarity: row.model_rarity,
        backdrop: row.backdrop, backdrop_rarity: row.backdrop_rarity, symbol: row.symbol, symbol_rarity: row.symbol_rarity,
        image: row.image, source: row.source, serial: row.serial, price_rub: price, seller_id: user.id
      }, 'resolution=merge-duplicates,return=representation');
      return res.status(200).json({ item: toItem(await patchPrice(id, price)) });
    }

    if (!isBotRequest(req.headers['x-bot-auth']) && !verifyAdminInitData(initData)) return res.status(403).json({ error: 'Administrator access required.' });

    if (action === 'remove') {
      const id = String(body.id ?? '');
      if (!UUID.test(id)) return res.status(400).json({ error: 'Invalid ID.' });
      await databaseRequest<unknown[]>('market_gifts', new URLSearchParams({ id: `eq.${marketId(id)}`, select: 'id' }), 'DELETE');
      await databaseRequest<unknown[]>('user_gifts', new URLSearchParams({ id: `eq.${id}`, select: 'id' }), 'DELETE');
      return res.status(200).json({ ok: true });
    }

    const telegramId = String(body.telegramId ?? '').trim();
    if (!/^[0-9]{1,15}$/.test(telegramId)) return res.status(400).json({ error: 'Invalid Telegram ID.' });
    if (action === 'admin_list') return res.status(200).json({ items: (await mine(telegramId)).map(toItem) });
    if (action !== 'add') return res.status(400).json({ error: 'Unknown action.' });

    const serials = [...new Set((Array.isArray(body.links) ? body.links : []).filter((s: unknown): s is string => typeof s === 'string' && SERIAL.test(s)))].slice(0, 10);
    if (!serials.length) return res.status(400).json({ error: 'No valid gift links.' });
    const added: string[] = [];
    const failed: { serial: string; error: string }[] = [];
    for (const serial of serials) {
      const taken = await databaseRequest<{ telegram_id: string }[]>('user_gifts', new URLSearchParams({ select: 'telegram_id', serial: `eq.${serial}` }), 'GET');
      if (taken.length) { failed.push({ serial, error: taken[0].telegram_id === telegramId ? 'Already in this inventory.' : 'Already in another inventory.' }); continue; }
      const found = await lookupGift(serial);
      if (!found.ok) { failed.push({ serial, error: found.error }); continue; }
      const g = giftRow(serial, found);
      await databaseRequest<unknown[]>('user_gifts', new URLSearchParams({ select: 'id' }), 'POST', {
        telegram_id: telegramId, serial, collection: g.collection, gift_number: g.gift_number, model: g.model, model_rarity: g.model_rarity,
        backdrop: g.backdrop, backdrop_rarity: g.backdrop_rarity, symbol: g.symbol, symbol_rarity: g.symbol_rarity, image: g.image, source: g.source
      });
      added.push(`${g.collection} #${g.gift_number}`);
    }
    if (added.length) {
      await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(6000),
        body: JSON.stringify({ chat_id: telegramId, parse_mode: 'HTML', text: `🎁 Подарок зачислен: <b>${esc(added.join(', '))}</b>\nОн появился в «Мои подарки», его можно выставить на продажу.` })
      }).catch(() => undefined);
    }
    return res.status(200).json({ added, failed });
  } catch (error) {
    console.error('My gifts API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
}
