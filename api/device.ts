import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ADMIN_IDS, readRequestBody, verifyTelegramInitData } from '../server/admin.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';
import { emo } from '../server/emoji.js';

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const short = (v: unknown, n = 80) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function describe(ua: string, platform: string) {
  const android = ua.match(/Android[^;)]*;\s*([^;)]+)/);
  const os = /iPhone/.test(ua) ? 'iPhone (iOS)' : /iPad/.test(ua) ? 'iPad' : android ? `Android · ${android[1].trim()}` : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  return platform ? `${os} · Telegram ${platform}` : os;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!databaseIsConfigured()) return res.status(200).json({ ok: false });
  try {
    const body = readRequestBody(req.body);
    const initData = typeof body.initData === 'string' ? body.initData : '';
    const user = verifyTelegramInitData(initData);
    if (!user) return res.status(403).json({ error: 'Open the Mini App inside Telegram.' });
    const deviceId = String(body.deviceId ?? '');
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId)) return res.status(400).json({ error: 'Invalid device ID.' });

    const known = await databaseRequest<{ device_id: string }[]>('user_devices', new URLSearchParams({ select: 'device_id', telegram_id: `eq.${user.id}` }), 'GET');
    if (known.some(d => d.device_id === deviceId)) return res.status(200).json({ ok: true, isNew: false });

    const info = (body.info && typeof body.info === 'object' ? body.info : {}) as Record<string, unknown>;
    const ua = short(req.headers['user-agent'], 300);
    const label = describe(ua, short(info.platform, 20));
    await databaseRequest<unknown[]>('user_devices', new URLSearchParams({ select: 'device_id' }), 'POST', { telegram_id: user.id, device_id: deviceId, info: { label, ua, screen: short(info.screen, 20), lang: short(info.lang, 20), tz: short(info.tz, 40), version: short(info.version, 10) } });
    if (known.length >= 10) return res.status(200).json({ ok: true, isNew: true, notified: false });

    let tgUser: { first_name?: string; last_name?: string; username?: string } = {};
    try { tgUser = JSON.parse(new URLSearchParams(initData).get('user') || '{}'); } catch { /* ignore */ }
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Без имени';
    const ip = short(String(req.headers['x-forwarded-for'] || '').split(',')[0], 45);
    const place = [short(req.headers['x-vercel-ip-country'], 4), (() => { try { return decodeURIComponent(short(req.headers['x-vercel-ip-city'], 60)); } catch { return ''; } })()].filter(Boolean).join(', ');
    const text = [
      known.length === 0 ? `${emo('🆕')} <b>Новый пользователь</b>` : `${emo('📱')} <b>Новое устройство</b>`,
      `${emo('👤')} ${esc(name)}${tgUser.username ? ` (@${esc(tgUser.username)})` : ''}`,
      `🆔 <code>${user.id}</code>`,
      `${/iPhone|iPad|Android/.test(label) ? emo('📱') : emo('💻')} ${esc(label)}`,
      info.screen ? `🖥 ${esc(short(info.screen, 20))} · ${esc(short(info.lang, 20))}` : '',
      ip || place ? `${emo('🌐')} ${esc(place)}${ip ? ` · <code>${esc(ip)}</code>` : ''}` : '',
      `${emo('⏰')} ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)`,
      `${emo('🔢')} Устройств у пользователя: ${known.length + 1}`
    ].filter(Boolean).join('\n');

    const token = process.env.BOT_TOKEN;
    const chats = (process.env.LOG_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
    const targets = chats.length ? chats : [...ADMIN_IDS];
    await Promise.allSettled(targets.map(chat_id => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(6000)
    })));
    return res.status(200).json({ ok: true, isNew: true, notified: true });
  } catch (error) {
    console.error('Device API error:', error);
    return res.status(200).json({ ok: false });
  }
}
