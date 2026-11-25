import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRequestBody, verifyAdminInitData } from '../server/admin.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ isAdmin: false });
  }
  const body = readRequestBody(req.body);
  const initData = typeof body.initData === 'string' ? body.initData : '';
  const admin = verifyAdminInitData(initData);
  if (!process.env.BOT_TOKEN) return res.status(503).json({ isAdmin: false, error: 'Admin access is not configured.' });
  return res.status(admin ? 200 : 200).json({ isAdmin: Boolean(admin) });
}
