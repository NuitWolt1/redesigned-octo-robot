import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isBotRequest, readRequestBody, verifyAdminInitData } from '../server/admin.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

const get = <T,>(table: Parameters<typeof databaseRequest>[0], query: Record<string, string>) => databaseRequest<T[]>(table, new URLSearchParams(query), 'GET');
const num = (v: unknown) => Number(v ?? 0) || 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured.' });
  try {
    const body = readRequestBody(req.body);
    if (!isBotRequest(req.headers['x-bot-auth']) && !verifyAdminInitData(typeof body.initData === 'string' ? body.initData : '')) return res.status(403).json({ error: 'Administrator access required.' });

    if (body.action === 'user') {
      const id = String(body.telegramId ?? '').trim();
      if (!/^[0-9]{1,15}$/.test(id)) return res.status(400).json({ error: 'Invalid Telegram ID.' });
      const [stats, devices, gifts, history] = await Promise.all([
        get<{ balance: number; spent: number; purchases: number }>('user_stats', { select: '*', telegram_id: `eq.${id}` }),
        get<{ first_seen: string; info: { label?: string } }>('user_devices', { select: 'first_seen,info', telegram_id: `eq.${id}`, order: 'first_seen.desc' }),
        get<{ price_rub: number | null }>('user_gifts', { select: 'price_rub', telegram_id: `eq.${id}` }),
        get<{ id: string }>('user_history', { select: 'id', telegram_id: `eq.${id}` })
      ]);
      return res.status(200).json({
        balance: num(stats[0]?.balance), spent: num(stats[0]?.spent), purchases: num(stats[0]?.purchases),
        devices: devices.length, lastDevice: devices[0]?.info?.label || '', firstSeen: devices.length ? devices[devices.length - 1].first_seen : '',
        gifts: gifts.length, listed: gifts.filter(g => g.price_rub !== null).length, history: history.length
      });
    }

    if (body.action !== 'summary') return res.status(400).json({ error: 'Unknown action.' });
    const [devices, market, mine, reviews, stats, history] = await Promise.all([
      get<{ telegram_id: string; first_seen: string }>('user_devices', { select: 'telegram_id,first_seen', limit: '20000' }),
      get<{ price_rub: number | null; seller_id: string | null }>('market_gifts', { select: 'price_rub,seller_id', limit: '20000' }),
      get<{ price_rub: number | null }>('user_gifts', { select: 'price_rub', limit: '20000' }),
      get<{ id: string }>('reviews', { select: 'id', limit: '20000' }),
      get<{ balance: number; spent: number; purchases: number }>('user_stats', { select: 'balance,spent,purchases', limit: '20000' }),
      get<{ id: string }>('user_history', { select: 'id', limit: '20000' })
    ]);
    const firstByUser = new Map<string, number>();
    devices.forEach(d => { const t = Date.parse(d.first_seen); const old = firstByUser.get(d.telegram_id); if (old === undefined || t < old) firstByUser.set(d.telegram_id, t); });
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const week = Date.now() - 7 * 24 * 3600 * 1000;
    return res.status(200).json({
      users: firstByUser.size, newToday: [...firstByUser.values()].filter(t => t >= today.getTime()).length, newWeek: [...firstByUser.values()].filter(t => t >= week).length,
      devices: devices.length, marketGifts: market.length, forSale: market.filter(g => g.price_rub !== null).length, userListed: market.filter(g => g.seller_id).length,
      credited: mine.length, reviews: reviews.length, history: history.length,
      totalBalance: Math.round(stats.reduce((s, r) => s + num(r.balance), 0) * 100) / 100, totalSpent: Math.round(stats.reduce((s, r) => s + num(r.spent), 0) * 100) / 100,
      totalPurchases: stats.reduce((s, r) => s + num(r.purchases), 0)
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
}
