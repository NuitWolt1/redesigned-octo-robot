export const SERIAL = /^([A-Za-z0-9_-]+)-(\d{1,9})$/;

function clean(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export type Parsed = { collection: string; model: string; modelRarity: string; backdrop: string; backdropRarity: string; symbol: string; symbolRarity: string };

// Разбор публичной страницы https://t.me/nft/<Collection>-<N>: таблица Model / Backdrop / Symbol с редкостью в <mark>.
export function parsePage(html: string): Parsed | null {
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

export async function lookupGift(serial: string) {
  try {
    const response = await fetch(`https://t.me/nft/${serial}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PlayerokBot/1.0)', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return { serial, ok: false as const, error: `HTTP ${response.status}` };
    const parsed = parsePage(await response.text());
    return parsed ? { serial, ok: true as const, ...parsed } : { serial, ok: false as const, error: 'Gift details not found on the page.' };
  } catch {
    return { serial, ok: false as const, error: 'Could not load the gift page.' };
  }
}

export const titleFromSlug = (slug: string) => slug.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();

// Строка таблицы market_gifts по найденным данным подарка.
export function giftRow(serial: string, data: Parsed, price?: number) {
  const m = serial.match(SERIAL)!;
  const slugId = m[1].toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    ...(price !== undefined ? { price_rub: price } : {}),
    id: serial.toLowerCase().replace(/[^a-z0-9_-]/g, ''), collection: data.collection || titleFromSlug(m[1]), gift_number: Number(m[2]),
    model: data.model, model_rarity: data.modelRarity, backdrop: data.backdrop, backdrop_rarity: data.backdropRarity,
    symbol: data.symbol, symbol_rarity: data.symbolRarity, image: `https://nft.fragment.com/gift/${slugId}-${m[2]}.webp`,
    source: `https://t.me/nft/${serial}`, serial
  };
}
