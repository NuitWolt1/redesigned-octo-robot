import { databaseRequest } from './supabase.js';

export type Currency = 'RUB' | 'USD' | 'GRAM';
export const CURRENCIES: Currency[] = ['RUB', 'USD', 'GRAM'];
export const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && (CURRENCIES as string[]).includes(v);
// Decimal places used when a currency is shown or paid out.
export const DECIMALS: Record<Currency, number> = { RUB: 2, USD: 2, GRAM: 4 };

// Rate = how many rubles 1 unit of the currency costs. null = unknown (currency disabled).
export type Rates = { RUB: 1; USD: number | null; GRAM: number | null; updatedAt: number; source: { USD: Source; GRAM: Source } };
type Source = 'live' | 'cache' | 'manual' | 'none';

const MEMORY_TTL = 5 * 60 * 1000;
let memory: { at: number; usd: number; gram: number } | null = null;

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// USD/RUB: official Central Bank of Russia rate.
async function fetchUsdRub(): Promise<number> {
  const data = await fetchJson('https://www.cbr-xml-daily.ru/daily_json.js');
  const usd = data?.Valute?.USD;
  const value = Number(usd?.Value) / Number(usd?.Nominal || 1);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Bad CBR response');
  return value;
}

// GRAM (formerly Toncoin / TON) price in USD. CoinGecko id is still "the-open-network".
async function fetchGramUsd(): Promise<number> {
  const data = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
  const value = Number(data?.['the-open-network']?.usd);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Bad CoinGecko response');
  return value;
}

async function readSettings(): Promise<Record<string, string>> {
  try {
    const rows = await databaseRequest<{ key: string; value: string }[]>(
      'app_settings', new URLSearchParams({ select: 'key,value', key: 'in.(rate_override_usd,rate_override_gram,rates_cache)' }), 'GET');
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch { return {}; }
}

const positive = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

export async function getRates(): Promise<Rates> {
  const settings = await readSettings();
  let usd: number | null = null, gram: number | null = null;
  const source = { USD: 'none' as Source, GRAM: 'none' as Source };
  let updatedAt = Date.now();

  if (memory && Date.now() - memory.at < MEMORY_TTL) {
    usd = memory.usd; gram = memory.gram; updatedAt = memory.at; source.USD = source.GRAM = 'live';
  } else {
    const [u, g] = await Promise.allSettled([fetchUsdRub(), fetchGramUsd()]);
    const usdRub = u.status === 'fulfilled' ? u.value : null;
    const gramUsd = g.status === 'fulfilled' ? g.value : null;
    let cached: { usd?: number; gram?: number; at?: number } = {};
    try { cached = JSON.parse(settings.rates_cache || '{}'); } catch { /* ignore */ }
    usd = usdRub ?? positive(cached.usd);
    source.USD = usdRub ? 'live' : usd ? 'cache' : 'none';
    // GRAM in rubles = GRAM/USD * USD/RUB. If only one leg is live, mix with the cached other leg.
    gram = gramUsd && usd ? gramUsd * usd : positive(cached.gram);
    source.GRAM = gramUsd && usd ? (usdRub ? 'live' : 'cache') : gram ? 'cache' : 'none';
    if (usdRub && gramUsd) {
      memory = { at: Date.now(), usd: usdRub, gram: gramUsd * usdRub };
      databaseRequest<unknown[]>('app_settings', new URLSearchParams({ select: 'key', on_conflict: 'key' }), 'POST',
        { key: 'rates_cache', value: JSON.stringify({ usd: usdRub, gram: gramUsd * usdRub, at: Date.now() }), updated_at: new Date().toISOString() },
        'resolution=merge-duplicates,return=representation').catch(() => undefined);
    } else if (cached.at) updatedAt = Number(cached.at) || updatedAt;
  }

  // An admin override (/rate in the bot) wins over live data until it is cleared.
  const manualUsd = positive(settings.rate_override_usd), manualGram = positive(settings.rate_override_gram);
  if (manualUsd) { usd = manualUsd; source.USD = 'manual'; }
  if (manualGram) { gram = manualGram; source.GRAM = 'manual'; }
  return { RUB: 1, USD: usd, GRAM: gram, updatedAt, source };
}

export const rateOf = (rates: Rates, currency: Currency): number | null => rates[currency];
const roundTo = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
export const toRub = (amount: number, currency: Currency, rates: Rates): number | null => {
  const rate = rateOf(rates, currency);
  return rate ? roundTo(amount * rate, 2) : null;
};

export async function setRateOverride(currency: 'USD' | 'GRAM', value: number | null): Promise<void> {
  const key = `rate_override_${currency.toLowerCase()}`;
  if (value === null) { await databaseRequest<unknown[]>('app_settings', new URLSearchParams({ key: `eq.${key}`, select: 'key' }), 'DELETE'); return; }
  await databaseRequest<unknown[]>('app_settings', new URLSearchParams({ select: 'key', on_conflict: 'key' }), 'POST',
    { key, value: String(value), updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
}
