import type { VercelRequest, VercelResponse } from '@vercel/node';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

// GRAM — новое название Toncoin (TON). Курс берём у CoinGecko; USD→RUB считаем из пары любой монеты.
const COIN_IDS = ['the-open-network', 'gram'];

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  let rates: { usd: number; gram: number } | null = null;
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS.join(',')}&vs_currencies=usd,rub`, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
    const data = await response.json() as Record<string, { usd?: number; rub?: number }>;
    const coin = COIN_IDS.map(id => data[id]).find(c => c && Number(c.usd) > 0 && Number(c.rub) > 0);
    if (coin) rates = { usd: Number(coin.rub) / Number(coin.usd), gram: Number(coin.rub) };
  } catch { /* берём последний сохранённый курс */ }
  try {
    if (databaseIsConfigured()) {
      if (rates) await databaseRequest<unknown[]>('app_settings', new URLSearchParams({ select: 'key', on_conflict: 'key' }), 'POST', { key: 'rates', value: JSON.stringify(rates), updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
      else {
        const rows = await databaseRequest<{ value: string; updated_at: string }[]>('app_settings', new URLSearchParams({ select: 'value,updated_at', key: 'eq.rates' }), 'GET');
        if (rows[0]) { rates = JSON.parse(rows[0].value); return res.status(200).json({ ...rates, stale: true, updatedAt: rows[0].updated_at }); }
      }
    }
  } catch { /* ignore */ }
  if (!rates) return res.status(503).json({ error: 'Rates are unavailable.' });
  return res.status(200).json({ ...rates, stale: false, updatedAt: new Date().toISOString() });
}
