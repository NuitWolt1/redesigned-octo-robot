import type { VercelRequest, VercelResponse } from '@vercel/node';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

const FALLBACK = 'Mananger_Playerok';

// Актуальный @username менеджера: спрашиваем Telegram по ID, запоминаем в базе и отдаём последний известный.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  const managerId = (process.env.MANAGER_ID || '951457448').trim();
  let username = '';
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(managerId)}`, { signal: AbortSignal.timeout(5000) });
    const data = await response.json() as { ok?: boolean; result?: { username?: string } };
    if (data.ok && data.result?.username && /^[A-Za-z0-9_]{4,32}$/.test(data.result.username)) username = data.result.username;
  } catch { /* используем сохранённое значение */ }
  try {
    if (databaseIsConfigured()) {
      if (username) await databaseRequest<unknown[]>('app_settings', new URLSearchParams({ select: 'key', on_conflict: 'key' }), 'POST', { key: 'manager_username', value: username, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
      else {
        const rows = await databaseRequest<{ value: string }[]>('app_settings', new URLSearchParams({ select: 'value', key: 'eq.manager_username' }), 'GET');
        username = rows[0]?.value || '';
      }
    }
  } catch { /* таблица ещё не создана */ }
  return res.status(200).json({ username: username || FALLBACK });
}
