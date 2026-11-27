import { ADMIN_IDS } from './admin.js';

export const escapeHtml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function notify(chatId: string | number, text: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(6000),
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  }).catch(() => undefined);
}

export function adminChats(): string[] {
  const custom = (process.env.LOG_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  return custom.length ? custom : [...ADMIN_IDS];
}
export const notifyAdmins = (text: string) => Promise.all(adminChats().map(id => notify(id, text))).then(() => undefined);
