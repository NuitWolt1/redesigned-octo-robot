import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isBotRequest, readRequestBody, verifyTelegramInitData } from '../server/admin.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';

type Row = { telegram_id: string; currency: string; rub_type: string | null; rub_card: string | null; rub_phone: string | null; rub_bank: string | null; ton_wallet: string | null };
const toProfile = (r?: Row) => ({ currency: r?.currency ?? 'RUB', rubType: r?.rub_type ?? '', rubCard: r?.rub_card ?? '', rubPhone: r?.rub_phone ?? '', rubBank: r?.rub_bank ?? '', tonWallet: r?.ton_wallet ?? '' });

// Только переданные поля обновляются; пустая строка очищает поле. Возвращает текст ошибки или объект столбцов.
function readFields(body: Record<string, unknown>): { error: string } | { fields: Record<string, string | null> } {
  const fields: Record<string, string | null> = {};
  const text = (key: string) => (body[key] === undefined || body[key] === null ? undefined : String(body[key]).trim());
  const currency = text('currency');
  if (currency !== undefined) { if (!['RUB', 'USD', 'GRAM'].includes(currency)) return { error: 'Invalid currency.' }; fields.currency = currency; }
  const rubType = text('rubType');
  if (rubType !== undefined) { if (!['', 'card', 'phone'].includes(rubType)) return { error: 'Invalid RUB type.' }; fields.rub_type = rubType || null; }
  const card = text('rubCard');
  if (card !== undefined) { const d = card.replace(/[\s-]/g, ''); if (d && !/^\d{16,19}$/.test(d)) return { error: 'Card number must have 16–19 digits.' }; fields.rub_card = d || null; }
  const phone = text('rubPhone');
  if (phone !== undefined) { const p = phone.replace(/[\s()-]/g, ''); if (p && !/^\+?\d{10,15}$/.test(p)) return { error: 'Invalid phone number.' }; fields.rub_phone = p || null; }
  const bank = text('rubBank');
  if (bank !== undefined) { if (bank.length > 40 || /[<>]/.test(bank)) return { error: 'Invalid bank name.' }; fields.rub_bank = bank || null; }
  const ton = text('tonWallet');
  if (ton !== undefined) { if (ton && (ton.length < 20 || ton.length > 128 || !/^[A-Za-z0-9_:-]+$/.test(ton))) return { error: 'Invalid TON address.' }; fields.ton_wallet = ton || null; }
  return { fields };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured.' });
  try {
    const body = readRequestBody(req.body);
    let id: string;
    if (isBotRequest(req.headers['x-bot-auth'])) {
      id = String(body.telegramId ?? '').trim();
      if (!/^[0-9]{1,15}$/.test(id)) return res.status(400).json({ error: 'Invalid Telegram ID.' });
    } else {
      const user = verifyTelegramInitData(typeof body.initData === 'string' ? body.initData : '');
      if (!user) return res.status(403).json({ error: 'Open the Mini App inside Telegram.' });
      id = user.id;
    }
    const find = async () => (await databaseRequest<Row[]>('user_profile', new URLSearchParams({ select: '*', telegram_id: `eq.${id}` }), 'GET'))[0];
    if (body.action === 'me' || body.action === 'get') return res.status(200).json(toProfile(await find()));
    if (body.action !== 'save') return res.status(400).json({ error: 'Unknown action.' });
    const parsed = readFields(body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const rows = await databaseRequest<Row[]>('user_profile', new URLSearchParams({ select: '*', on_conflict: 'telegram_id' }), 'POST',
      { telegram_id: id, ...parsed.fields, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
    return res.status(200).json(toProfile(rows[0]));
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
}
