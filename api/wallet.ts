import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ADMIN_IDS, isBotRequest, readRequestBody, verifyTelegramInitData } from '../server/admin.js';
import { databaseIsConfigured, databaseRequest } from '../server/supabase.js';
import { escapeHtml, notify, notifyWithButtons, adminChats } from '../server/notify.js';
import { getRates, isCurrency, setRateOverride, type Currency, type Rates } from '../server/rates.js';

// Payout currencies stored in public.withdrawals: RUB (card / SBP), GRAM (TON coin) and USDT (dollars, to a TON address).
type Pay = 'RUB' | 'GRAM' | 'USDT';
const isPay = (v: unknown): v is Pay => v === 'RUB' || v === 'GRAM' || v === 'USDT';
const PDEC: Record<Pay, number> = { RUB: 2, GRAM: 4, USDT: 2 };
const PSYM: Record<Pay, string> = { RUB: '₽', GRAM: 'GRAM', USDT: 'USDT' };
const payRate = (rates: Rates, c: Pay): number | null => (c === 'RUB' ? 1 : c === 'GRAM' ? rates.GRAM : rates.USD);

type StatsRow = { balance: number | string; spent: number | string; purchases: number | string; frozen?: number | string };
type ProfileRow = { currency: string | null; rub_type: string | null; rub_card: string | null; rub_card_bank: string | null; rub_phone: string | null; rub_bank: string | null; ton_wallet: string | null };
type WdRow = { id: string; telegram_id: string; method: 'card' | 'sbp' | 'ton'; currency: Pay; amount: number | string; amount_rub: number | string; details: string; bank: string | null; status: string; created_at: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
const floorTo = (n: number, d: number) => Math.floor(n * 10 ** d + 1e-9) / 10 ** d;
const METHOD_LABEL = { card: 'Карта', sbp: 'СБП (номер)', ton: 'TON-адрес' } as const;
const money = (n: number, c: Pay) => `${Number(n.toFixed(PDEC[c]))} ${PSYM[c]}`;

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

// ---- validation ----
const cleanText = (v: unknown, min: number, max: number): string | null => {
  const s = String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
  return s.length >= min && s.length <= max ? s : null;
};
const normCard = (v: unknown) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 16 ? d : null; };
function normPhone(v: unknown): string | null {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10 && d.startsWith('9')) d = '7' + d;
  return d.length >= 10 && d.length <= 15 ? `+${d}` : null;
}
// TON: user-friendly (48 chars base64/base64url) or raw "workchain:64hex".
const normTon = (v: unknown) => { const s = String(v ?? '').trim(); return /^[A-Za-z0-9_+/-]{48}$/.test(s) || /^-?[0-9]:[0-9a-fA-F]{64}$/.test(s) ? s : null; };

const toStats = (r?: StatsRow) => ({ balance: Number(r?.balance ?? 0), spent: Number(r?.spent ?? 0), purchases: Number(r?.purchases ?? 0), frozen: Number(r?.frozen ?? 0) });
const toReq = (p?: ProfileRow) => ({ cardNumber: p?.rub_card ?? null, cardBank: p?.rub_card_bank ?? null, sbpPhone: p?.rub_phone ?? null, sbpBank: p?.rub_bank ?? null, tonAddress: p?.ton_wallet ?? null });
const toWd = (w: WdRow) => ({ id: w.id, telegramId: w.telegram_id, method: w.method, currency: w.currency, amount: Number(w.amount), rate: Number(w.amount) > 0 ? Number(w.amount_rub) / Number(w.amount) : 0, amountRub: Number(w.amount_rub), destination: w.details, bank: w.bank, status: w.status, createdAt: Date.parse(w.created_at) });
const publicRates = (r: Rates) => ({ RUB: 1, USD: r.USD, GRAM: r.GRAM, updatedAt: r.updatedAt, manual: { USD: r.source.USD === 'manual', GRAM: r.source.GRAM === 'manual' } });

const q = (o: Record<string, string>) => new URLSearchParams(o);
const loadStats = async (id: string) => toStats((await databaseRequest<StatsRow[]>('user_stats', q({ select: '*', telegram_id: `eq.${id}` }), 'GET'))[0]);
const loadProfile = async (id: string) => (await databaseRequest<ProfileRow[]>('user_profile', q({ select: '*', telegram_id: `eq.${id}` }), 'GET'))[0];
const upsertProfile = (row: Record<string, unknown>) =>
  databaseRequest<unknown[]>('user_profile', q({ select: '*', on_conflict: 'telegram_id' }), 'POST', { ...row, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');

async function snapshot(id: string) {
  const [stats, profile, rates, wds] = await Promise.all([
    loadStats(id), loadProfile(id), getRates(),
    databaseRequest<WdRow[]>('withdrawals', q({ select: '*', telegram_id: `eq.${id}`, order: 'created_at.desc', limit: '5' }), 'GET')
  ]);
  const currency: Currency = isCurrency(profile?.currency) ? profile!.currency as Currency : 'RUB';
  return { stats, currency, requisites: toReq(profile), rates: publicRates(rates), withdrawals: wds.map(toWd) };
}

function destinationOf(method: string, p?: ProfileRow): { destination: string; bank: string | null } | null {
  if (method === 'card' && p?.rub_card) return { destination: p.rub_card, bank: p.rub_card_bank };
  if (method === 'sbp' && p?.rub_phone) return { destination: p.rub_phone, bank: p.rub_bank };
  if (method === 'ton' && p?.ton_wallet) return { destination: p.ton_wallet, bank: null };
  return null;
}

async function withdraw(id: string, body: Record<string, unknown>) {
  const method = String(body.method ?? '');
  if (!['card', 'sbp', 'ton'].includes(method)) throw new HttpError(400, 'Unknown withdrawal method.');
  const currency = body.currency;
  if (!isPay(currency)) throw new HttpError(400, 'Unknown currency.');
  // Card / SBP pay out rubles; a TON address receives GRAM or USDT.
  if (method === 'ton' ? currency === 'RUB' : currency !== 'RUB') throw new HttpError(400, method === 'ton' ? 'TON address withdrawals are paid in GRAM or USDT.' : 'Card and SBP withdrawals are paid in RUB.');

  const [profile, stats, rates] = await Promise.all([loadProfile(id), loadStats(id), getRates()]);
  const target = destinationOf(method, profile);
  if (!target) throw new HttpError(400, 'Add the requisites for this method first.');
  if (method !== 'ton' && !target.bank) throw new HttpError(400, 'Select the bank in your requisites first.');
  const rate = payRate(rates, currency);
  if (!rate) throw new HttpError(503, `The ${currency === 'USDT' ? 'USD' : currency} rate is unavailable right now. Try again later.`);

  const amount = body.all === true ? floorTo(stats.balance / rate, PDEC[currency]) : Number(String(body.amount ?? '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new HttpError(400, 'Invalid amount.');
  const amountRub = body.all === true && currency === 'RUB' ? stats.balance : round2(amount * rate);
  if (amountRub < 0.01) throw new HttpError(400, 'Amount is too small.');
  if (amountRub > stats.balance + 1e-9) throw new HttpError(400, 'Insufficient balance.');

  let wd: WdRow;
  try {
    wd = await databaseRequest<WdRow>('rpc/create_withdrawal', q({}), 'POST', {
      p_telegram_id: id, p_method: method, p_currency: currency, p_amount: Number(amount.toFixed(PDEC[currency])),
      p_amount_rub: amountRub, p_details: target.destination, p_bank: target.bank });
  } catch { throw new HttpError(409, 'Could not reserve the funds. Refresh the balance and try again.'); }

  const text = `💸 <b>Заявка на вывод</b>\nПользователь: <code>${id}</code>\nСпособ: ${METHOD_LABEL[method as 'card']}\nСумма: <b>${money(Number(wd.amount), currency)}</b> (${money(Number(wd.amount_rub), 'RUB')}, курс ${Number(rate.toFixed(4))} ₽)\n`
    + `Реквизиты: <code>${escapeHtml(target.destination)}</code>${target.bank ? `\nБанк: ${escapeHtml(target.bank)}` : ''}\nID: <code>${wd.id}</code>\n\nСредства заморожены на балансе до решения.`;
  const buttons = [[{ text: '✅ Выплачено', callback_data: `wd:done:${wd.id}` }, { text: '↩️ Отклонить и вернуть', callback_data: `wd:no:${wd.id}` }]];
  await Promise.all(adminChats().map(chat => notifyWithButtons(chat, text, buttons)));
  return { withdrawal: toWd(wd), stats: await loadStats(id) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!databaseIsConfigured()) return res.status(503).json({ error: 'Database is not configured. Add Supabase environment variables in Vercel.' });

  try {
    const body = readRequestBody(req.body);
    const bot = isBotRequest(req.headers['x-bot-auth']);
    const user = bot ? null : verifyTelegramInitData(typeof body.initData === 'string' ? body.initData : '');
    if (!bot && !user) return res.status(403).json({ error: 'Open the Mini App inside Telegram.' });
    const isAdmin = bot || (user ? ADMIN_IDS.has(user.id) : false);
    const action = String(body.action ?? '');

    // ---- admin / bot-only actions ----
    if (action === 'pending') {
      if (!isAdmin) return res.status(403).json({ error: 'Administrator access required.' });
      const rows = await databaseRequest<WdRow[]>('withdrawals', q({ select: '*', status: 'eq.pending', order: 'created_at.asc', limit: '20' }), 'GET');
      return res.status(200).json({ items: rows.map(toWd) });
    }
    if (action === 'resolve') {
      if (!isAdmin) return res.status(403).json({ error: 'Administrator access required.' });
      const wid = String(body.id ?? ''); const status = body.status === 'paid' || body.status === 'done' ? 'paid' : body.status === 'rejected' ? 'rejected' : '';
      if (!/^[0-9a-f-]{36}$/i.test(wid) || !status) return res.status(400).json({ error: 'Invalid request.' });
      let wd: WdRow;
      try { wd = await databaseRequest<WdRow>('rpc/resolve_withdrawal', q({}), 'POST', { p_id: wid, p_status: status }); }
      catch { return res.status(409).json({ error: 'Request not found or already processed.' }); }
      await notify(wd.telegram_id, status === 'paid'
        ? `✅ Вывод <b>${money(Number(wd.amount), wd.currency)}</b> выполнен.`
        : `↩️ Заявка на вывод <b>${money(Number(wd.amount), wd.currency)}</b> отклонена, <b>${money(Number(wd.amount_rub), 'RUB')}</b> возвращены на баланс.`);
      return res.status(200).json({ withdrawal: toWd(wd) });
    }
    if (action === 'set_rate') {
      if (!isAdmin) return res.status(403).json({ error: 'Administrator access required.' });
      const currency = body.currency;
      if (currency !== 'USD' && currency !== 'GRAM') return res.status(400).json({ error: 'Only USD and GRAM rates can be set.' });
      const value = body.value === null || body.value === 'auto' ? null : Number(body.value);
      if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 1e7)) return res.status(400).json({ error: 'Invalid rate.' });
      await setRateOverride(currency, value);
      return res.status(200).json({ rates: publicRates(await getRates()) });
    }
    if (action === 'rates') return res.status(200).json({ rates: publicRates(await getRates()) });

    // ---- per-user actions: Mini App user = self, bot passes telegramId ----
    const id = bot ? String(body.telegramId ?? '').trim() : user!.id;
    if (!/^[0-9]{1,15}$/.test(id)) return res.status(400).json({ error: 'Invalid Telegram ID.' });

    if (action === 'get') return res.status(200).json(await snapshot(id));

    if (action === 'set_currency') {
      if (!isCurrency(body.currency)) return res.status(400).json({ error: 'Unknown currency.' });
      await upsertProfile({ telegram_id: id, currency: body.currency });
      return res.status(200).json({ currency: body.currency });
    }

    if (action === 'set_requisites') {
      const section = String(body.section ?? '');
      let patch: Record<string, string | null>;
      if (section === 'clear_all') {
        // Keep the row: it also stores the preferred currency and language.
        patch = { rub_type: null, rub_card: null, rub_card_bank: null, rub_phone: null, rub_bank: null, ton_wallet: null };
      } else if (body.clear === true) {
        const p = await loadProfile(id);
        if (section === 'card') patch = { rub_card: null, rub_card_bank: null, ...(p?.rub_type === 'card' ? { rub_type: p.rub_phone ? 'phone' : null } : {}) };
        else if (section === 'sbp') patch = { rub_phone: null, rub_bank: null, ...(p?.rub_type === 'phone' ? { rub_type: p.rub_card ? 'card' : null } : {}) };
        else if (section === 'ton') patch = { ton_wallet: null };
        else return res.status(400).json({ error: 'Unknown requisites section.' });
      } else if (section === 'card') {
        const number = normCard(body.number), bank = cleanText(body.bank, 2, 40);
        if (!number) return res.status(400).json({ error: 'Card number must be exactly 16 digits.' });
        if (!bank) return res.status(400).json({ error: 'Enter the bank name (2–40 characters).' });
        patch = { rub_card: number, rub_card_bank: bank, rub_type: 'card' };
      } else if (section === 'sbp') {
        const phone = normPhone(body.phone), bank = cleanText(body.bank, 2, 40);
        if (!phone) return res.status(400).json({ error: 'Check the phone number (10–15 digits with country code).' });
        if (!bank) return res.status(400).json({ error: 'Enter the bank name (2–40 characters).' });
        patch = { rub_phone: phone, rub_bank: bank, rub_type: 'phone' };
      } else if (section === 'ton') {
        const address = normTon(body.address);
        if (!address) return res.status(400).json({ error: 'Invalid TON address (48 characters, e.g. UQ…).' });
        patch = { ton_wallet: address };
      } else return res.status(400).json({ error: 'Unknown requisites section.' });
      await upsertProfile({ telegram_id: id, ...patch });
      return res.status(200).json({ requisites: toReq(await loadProfile(id)) });
    }

    if (action === 'withdraw') return res.status(200).json(await withdraw(id, body));

    // One-time migration from the bot's old local SQLite (bot only; the bot zeroes migrated balances so re-runs are harmless).
    if (action === 'import') {
      if (!bot) return res.status(403).json({ error: 'Bot access required.' });
      const result = { balance: 'skipped', requisites: [] as string[] };
      const balance = round2(Number(body.balance ?? 0));
      if (Number.isFinite(balance) && balance > 0) {
        const stats = await loadStats(id);
        if (stats.balance === 0) {
          await databaseRequest<unknown[]>('user_stats', q({ select: '*', on_conflict: 'telegram_id' }), 'POST', { telegram_id: id, balance, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=representation');
          result.balance = 'imported';
        } else result.balance = 'web-balance-not-empty';
      }
      const existing = await loadProfile(id); const patch: Record<string, string> = {};
      const card = normCard(body.card), phone = normPhone(body.phone), phoneBank = cleanText(body.phoneBank, 2, 40), ton = normTon(body.ton);
      if (card && !existing?.rub_card) { patch.rub_card = card; patch.rub_card_bank = cleanText(body.cardBank, 2, 40) ?? 'Другой банк'; result.requisites.push('card'); }
      if (phone && !existing?.rub_phone) { patch.rub_phone = phone; patch.rub_bank = phoneBank ?? 'Другой банк'; result.requisites.push('sbp'); }
      if (ton && !existing?.ton_wallet) { patch.ton_wallet = ton; result.requisites.push('ton'); }
      if (patch.rub_card && !existing?.rub_type) patch.rub_type = 'card'; else if (patch.rub_phone && !existing?.rub_type) patch.rub_type = 'phone';
      if (Object.keys(patch).length) await upsertProfile({ telegram_id: id, ...patch });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error('Wallet API error:', error);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}
