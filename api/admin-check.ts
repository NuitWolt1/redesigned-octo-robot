import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';

type TelegramUser = { id?: number };

function verifyTelegramInitData(initData: string, botToken: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Telegram Mini Apps validation: secret = HMAC_SHA256("WebAppData", bot_token).
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
    const suppliedHash = Buffer.from(receivedHash, 'hex');
    if (suppliedHash.length !== calculatedHash.length || !timingSafeEqual(suppliedHash, calculatedHash)) return null;

    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    // Reject stale or future-dated launch payloads.
    if (!Number.isFinite(authDate) || authDate <= 0 || authDate > now + 60 || now - authDate > 86400) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw) as TelegramUser;
    return typeof user.id === 'number' && Number.isSafeInteger(user.id) ? user : null;
  } catch {
    return null;
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ isAdmin: false });
  }

  const botToken = process.env.BOT_TOKEN;
  // Only these Telegram accounts are allowed to manage the catalog.
  // The IDs are not secrets; the bot token must remain in Vercel Environment Variables.
  const adminIds = new Set(['8491418744', '9264762756']);
  if (!botToken) {
    return res.status(503).json({ isAdmin: false, error: 'Admin access is not configured.' });
  }

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : req.body;
  const initData = body && typeof body.initData === 'string' ? body.initData : '';
  if (!initData || initData.length > 8192) return res.status(401).json({ isAdmin: false });

  const user = verifyTelegramInitData(initData, botToken);
  if (!user) return res.status(401).json({ isAdmin: false });
  return res.status(200).json({ isAdmin: adminIds.has(String(user.id)) });
}
