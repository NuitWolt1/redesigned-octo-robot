import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isBotRequest, readRequestBody, verifyAdminInitData, verifyTelegramInitData } from '../server/admin.js';
import { titleFromSlug } from '../server/gifts.js';
import { emo } from '../server/emoji.js';
import { escapeHtml, notify } from '../server/notify.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

type Row = { id: string; telegram_id: string; kind: string; title: string; link: string | null; op_type: string | null; amount: number | string; note: string | null; created_at: string };
const toItem = (r: Row) => ({ id: r.id, kind: r.kind, title: r.title, link: r.link, opType: r.op_type, amount: Number(r.amount), note: r.note, createdAt: Date.parse(r.created_at) });
const NFT = /(?:https?:\/\/)?t\.me\/nft\/([A-Za-z0-9_]+)-(\d{1,9})/i;
const OP_TITLES: Record<string, string> = { topup: 'Пополнение через менеджера', profit: 'Прибыль с продаж' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured. Add Supabase environment variables in Vercel.' });

  try {
    const body = readRequestBody(req.body);
    const initData = typeof body.initData === 'string' ? body.initData : '';
    const list = (id: string) => databaseRequest<Row[]>('user_history', new URLSearchParams({ select: '*', telegram_id: `eq.${id}`, order: 'created_at.desc', limit: '50' }), 'GET');

    if (body.action === 'me') {
      const user = verifyTelegramInitData(initData);
      if (!user) return res.status(403).json({ error: 'Open the Mini App inside Telegram.' });
      return res.status(200).json({ items: (await list(user.id)).map(toItem) });
    }

    if (!isBotRequest(req.headers['x-bot-auth']) && !verifyAdminInitData(initData)) return res.status(403).json({ error: 'Administrator access required.' });

    if (body.action === 'delete') {
      const id = String(body.id ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid ID.' });
      await databaseRequest<unknown[]>('user_history', new URLSearchParams({ id: `eq.${id}`, select: 'id' }), 'DELETE');
      return res.status(200).json({ ok: true });
    }

    const telegramId = String(body.telegramId ?? '').trim();
    if (!/^[0-9]{1,15}$/.test(telegramId)) return res.status(400).json({ error: 'Invalid Telegram ID.' });
    if (body.action === 'list') return res.status(200).json({ items: (await list(telegramId)).map(toItem) });
    if (body.action !== 'add') return res.status(400).json({ error: 'Unknown action.' });

    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return res.status(400).json({ error: 'Invalid amount.' });
    const ts = Number(body.createdAt);
    const when = Number.isFinite(ts) && ts > 1.4e12 && ts < Date.now() + 48 * 3600 * 1000 ? { created_at: new Date(ts).toISOString() } : {};
    let row: Record<string, unknown>;
    if (body.kind === 'purchase') {
      const m = String(body.nftLink ?? '').match(NFT);
      if (!m) return res.status(400).json({ error: 'Invalid NFT link.' });
      row = { telegram_id: telegramId, kind: 'purchase', title: `${titleFromSlug(m[1])} #${m[2]}`, link: `https://t.me/nft/${m[1]}-${m[2]}`, amount, ...when };
    } else if (body.kind === 'operation' && typeof body.opType === 'string' && OP_TITLES[body.opType]) {
      row = { telegram_id: telegramId, kind: 'operation', op_type: body.opType, title: OP_TITLES[body.opType], amount, ...when };
    } else return res.status(400).json({ error: 'Invalid entry type.' });
    const rows = await databaseRequest<Row[]>('user_history', new URLSearchParams({ select: '*' }), 'POST', row);
    const note = row.kind === 'purchase' ? `${emo('🎁')} Покупка записана: <b>${escapeHtml(row.title)}</b> — ${amount} ₽`
      : row.op_type === 'profit' ? `${emo('✅')} Прибыль с продаж: <b>+${amount} ₽</b>` : `${emo('✅')} Баланс пополнен через менеджера: <b>+${amount} ₽</b>`;
    await notify(telegramId, note);
    return res.status(201).json({ item: toItem(rows[0]) });
  } catch (error) {
    console.error('History API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
}
