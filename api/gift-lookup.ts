import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRequestBody, verifyAdminInitData } from '../server/admin.js';

const SERIAL = /^([A-Za-z0-9_-]+)-(\d{1,9})$/;
const MAX_LINKS = 25;

function clean(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

type Parsed = { collection: string; model: string; modelRarity: string; backdrop: string; backdropRarity: string; symbol: string; symbolRarity: string };

// Разбор публичной страницы https://t.me/nft/<Collection>-<N>: таблица Model / Backdrop / Symbol с редкостью в <mark>.
function parsePage(html: string): Parsed | null {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    const label = clean(m[1]).toLowerCase();
    const mark = m[2].match(/<mark[^>]*>([\s\S]*?)<\/mark>/i);
    const value = clean(m[2].replace(/<mark[^>]*>[\s\S]*?<\/mark>/gi, ''));
    const rarity = mark ? clean(mark[1]) : '';
    if (label === 'model') { out.model = value; out.modelRarity = rarity; }
    else if (label === 'backdrop') { out.backdrop = value; out.backdropRarity = rarity; }
    else if (label === 'symbol' || label === 'pattern') { out.symbol = value; out.symbolRarity = rarity; }
  }
  if (!out.model || !out.backdrop || !out.symbol) return null;
  const title = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
  const named = title ? clean(title[1]).match(/^(.*?)\s*#\d+/) : null;
  return {
    collection: named?.[1] || '', model: out.model, modelRarity: out.modelRarity || '—',
    backdrop: out.backdrop, backdropRarity: out.backdropRarity || '—', symbol: out.symbol, symbolRarity: out.symbolRarity || '—'
  };
}

async function lookup(serial: string) {
  try {
    const response = await fetch(`https://t.me/nft/${serial}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PlayerokBot/1.0)', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return { serial, ok: false, error: `HTTP ${response.status}` };
    const parsed = parsePage(await response.text());
    return parsed ? { serial, ok: true, ...parsed } : { serial, ok: false, error: 'Gift details not found on the page.' };
  } catch {
    return { serial, ok: false, error: 'Could not load the gift page.' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const body = readRequestBody(req.body);
  if (!verifyAdminInitData(typeof body.initData === 'string' ? body.initData : '')) return res.status(403).json({ error: 'Administrator access required.' });
  const serials = Array.isArray(body.serials) ? body.serials : [];
  if (!serials.length || serials.length > MAX_LINKS) return res.status(400).json({ error: `Send 1 to ${MAX_LINKS} gifts at a time.` });
  // Запросы идут только на t.me/nft/ и только с проверенным именем подарка.
  const valid = [...new Set(serials.filter((s): s is string => typeof s === 'string' && SERIAL.test(s)))];
  const results = await Promise.all(valid.map(lookup));
  return res.status(200).json({ results });
}
