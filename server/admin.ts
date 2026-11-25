import { createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_IDS = new Set(['8491418744', '9264762756']);

type TelegramUser = { id?: number };

export function verifyAdminInitData(initData: string): { id: string } | null {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken || !initData || initData.length > 8192) return null;

  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
    const suppliedHash = Buffer.from(receivedHash, 'hex');
    if (suppliedHash.length !== calculatedHash.length || !timingSafeEqual(suppliedHash, calculatedHash)) return null;

    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(authDate) || authDate <= 0 || authDate > now + 60 || now - authDate > 86400) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw) as TelegramUser;
    if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id)) return null;

    const id = String(user.id);
    return ADMIN_IDS.has(id) ? { id } : null;
  } catch {
    return null;
  }
}

export function readRequestBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return body && typeof body === 'object' ? body as Record<string, unknown> : {};
}
