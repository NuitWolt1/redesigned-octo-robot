import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRequestBody, verifyAdminInitData, verifyTelegramInitData } from '../server/admin.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

type StatsRow = { telegram_id: string; balance: number | string; spent: number | string; purchases: number | string };
const toStats = (row?: StatsRow) => ({ balance: Number(row?.balance ?? 0), spent: Number(row?.spent ?? 0), purchases: Number(row?.purchases ?? 0) });
const round2 = (n: number) => Math.round(n * 100) / 100;

// Empty / missing field = "leave unchanged". Returns undefined for invalid numbers.
function readNumber(value: unknown, integer: boolean): number | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1e9 || (integer && !Number.isInteger(n))) return undefined;
  return n;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured. Add Supabase environment variables in Vercel.' });

  try {
    const body = readRequestBody(req.body);
    const initData = typeof body.initData === 'string' ? body.initData : '';
    const find = (id: string) => databaseRequest<StatsRow[]>('user_stats', new URLSearchParams({ select: '*', telegram_id: `eq.${id}` }), 'GET');

    if (body.action === 'me') {
      const user = verifyTelegramInitData(initData);
      if (!user) return res.status(403).json({ error: 'Open the Mini App inside Telegram.' });
      return res.status(200).json(toStats((await find(user.id))[0]));
    }

    if (body.action !== 'adjust') return res.status(400).json({ error: 'Unknown action.' });
    if (!verifyAdminInitData(initData)) return res.status(403).json({ error: 'Administrator access required.' });

    const telegramId = String(body.telegramId ?? '').trim();
    if (!/^[0-9]{1,15}$/.test(telegramId)) return res.status(400).json({ error: 'Invalid Telegram ID.' });
    const mode = body.mode === 'set' ? 'set' : 'add';
    const input = { balance: readNumber(body.balance, false), spent: readNumber(body.spent, false), purchases: readNumber(body.purchases, true) };
    if (input.balance === undefined || input.spent === undefined || input.purchases === undefined) return res.status(400).json({ error: 'Invalid number.' });

    const current = toStats((await find(telegramId))[0]);
    const next = { ...current };
    (['balance', 'spent', 'purchases'] as const).forEach(key => {
      const value = input[key];
      if (value === null) return;
      next[key] = mode === 'set' ? value : current[key] + value;
    });
    next.balance = round2(next.balance); next.spent = round2(next.spent);
    if (next.balance < 0 || next.spent < 0 || next.purchases < 0) return res.status(400).json({ error: 'Values cannot be negative.' });

    const query = new URLSearchParams({ select: '*', on_conflict: 'telegram_id' });
    const rows = await databaseRequest<StatsRow[]>('user_stats', query, 'POST', { telegram_id: telegramId, ...next, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
    return res.status(200).json(toStats(rows[0]));
  } catch (error) {
    console.error('Stats API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
}
