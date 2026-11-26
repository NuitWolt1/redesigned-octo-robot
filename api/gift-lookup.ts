import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isBotRequest, readRequestBody, verifyAdminInitData } from '../server/admin.js';
import { SERIAL, lookupGift as lookup } from '../server/gifts.js';

const MAX_LINKS = 25;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const body = readRequestBody(req.body);
  if (!isBotRequest(req.headers['x-bot-auth']) && !verifyAdminInitData(typeof body.initData === 'string' ? body.initData : '')) return res.status(403).json({ error: 'Administrator access required.' });
  const serials = Array.isArray(body.serials) ? body.serials : [];
  if (!serials.length || serials.length > MAX_LINKS) return res.status(400).json({ error: `Send 1 to ${MAX_LINKS} gifts at a time.` });
  // Запросы идут только на t.me/nft/ и только с проверенным именем подарка.
  const valid = [...new Set(serials.filter((s): s is string => typeof s === 'string' && SERIAL.test(s)))];
  const results = await Promise.all(valid.map(lookup));
  return res.status(200).json({ results });
}
