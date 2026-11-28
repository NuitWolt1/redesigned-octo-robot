import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Gem, Phone, Trash2, Wallet } from 'lucide-react';

export type Currency = 'RUB' | 'USD' | 'GRAM';
export type Method = 'card' | 'sbp' | 'ton';
export type Requisites = { cardNumber: string | null; cardBank: string | null; sbpPhone: string | null; sbpBank: string | null; tonAddress: string | null };
export type Rates = { RUB: 1; USD: number | null; GRAM: number | null; updatedAt: number; manual: { USD: boolean; GRAM: boolean } };
export type Pay = 'RUB' | 'GRAM' | 'USDT';
export type WithdrawalItem = { id: string; method: Method; currency: Pay; amount: number; amountRub: number; status: string; createdAt: number };
export type Wallet = { stats: { balance: number; spent: number; purchases: number; frozen?: number }; currency: Currency; requisites: Requisites; rates: Rates; withdrawals: WithdrawalItem[] };

export const CURRENCIES: Currency[] = ['RUB', 'USD', 'GRAM'];
export const SYMBOL: Record<Currency, string> = { RUB: '₽', USD: '$', GRAM: 'GRAM' };
// Same list is used by the bot (bot.py BANKS). "Own bank" is typed in manually.
export const BANKS = ['Сбербанк', 'Т-Банк', 'Альфа-Банк', 'ВТБ', 'Газпромбанк', 'Райффайзенбанк', 'Совкомбанк', 'Росбанк', 'Россельхозбанк', 'Ozon Банк', 'МТС Банк'];
const PDEC: Record<Pay, number> = { RUB: 2, GRAM: 4, USDT: 2 };
const PSYM: Record<Pay, string> = { RUB: '₽', GRAM: 'GRAM', USDT: 'USDT' };
const locale = (lang: string) => (lang === 'RU' ? 'ru-RU' : 'en-US');

export async function walletPost<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const initData = window.Telegram?.WebApp?.initData ?? '';
  const response = await fetch('/api/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, initData, ...extra }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data as T;
}

const floorTo = (n: number, d: number) => Math.floor(n * 10 ** d + 1e-9) / 10 ** d;
// All amounts in the app are stored in RUB; this renders them in the chosen currency at the current rate.
export function convert(rub: number, currency: Currency, rates: Rates | undefined): number | null {
  if (currency === 'RUB') return rub;
  const rate = rates?.[currency];
  return rate ? rub / rate : null;
}
export function formatMoney(rub: number, currency: Currency, rates: Rates | undefined, lang: string): string {
  const value = convert(rub, currency, rates);
  const shown: Currency = value === null ? 'RUB' : currency;
  const n = value ?? rub;
  const digits = shown === 'GRAM' ? (Math.abs(n) >= 100 ? 2 : 4) : 2;
  return `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(n)} ${SYMBOL[shown]}`;
}

export function CurrencySwitch({ value, rates, lang, onChange }: { value: Currency; rates?: Rates; lang: string; onChange: (c: Currency) => void }) {
  return <div className="cur-block">
    <div className="cur-switch" role="tablist">{CURRENCIES.map(c => {
      const off = c !== 'RUB' && !rates?.[c];
      return <button key={c} type="button" role="tab" aria-selected={value === c} disabled={off} className={value === c ? 'on' : ''} onClick={() => onChange(c)}>{SYMBOL[c] === c ? c : `${SYMBOL[c]} ${c}`}</button>;
    })}</div>
    {rates && <small className="cur-rates">{(['USD', 'GRAM'] as const).map(c => rates[c] ? `1 ${c} = ${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 2 }).format(rates[c]!)} ₽` : `${c}: ${lang === 'RU' ? 'курс недоступен' : 'rate unavailable'}`).join(' · ')}</small>}
  </div>;
}

function BankPicker({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: string }) {
  const preset = BANKS.includes(value);
  const [custom, setCustom] = useState(Boolean(value) && !preset);
  useEffect(() => { if (preset) setCustom(false); else if (value) setCustom(true); }, [value, preset]);
  return <>
    <select className="wd-field" value={custom ? '__custom' : preset ? value : ''} onChange={e => { if (e.target.value === '__custom') { setCustom(true); onChange(''); } else { setCustom(false); onChange(e.target.value); } }}>
      <option value="" disabled>{lang === 'RU' ? 'Выберите банк' : 'Select bank'}</option>
      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
      <option value="__custom">{lang === 'RU' ? '✍️ Свой банк…' : '✍️ Other bank…'}</option>
    </select>
    {custom && <input className="wd-field" maxLength={40} value={value} onChange={e => onChange(e.target.value)} placeholder={lang === 'RU' ? 'Название вашего банка' : 'Your bank name'}/>}
  </>;
}

const groupCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');

export function RequisitesCard({ wallet, lang, toast, onSaved }: { wallet: Wallet | null; lang: string; toast: (m: string) => void; onSaved: (r: Requisites) => void }) {
  const L = (ru: string, en: string) => (lang === 'RU' ? ru : en);
  const r = wallet?.requisites;
  const [card, setCard] = useState({ number: '', bank: '' });
  const [sbp, setSbp] = useState({ phone: '', bank: '' });
  const [ton, setTon] = useState('');
  const [busy, setBusy] = useState('');
  const key = JSON.stringify(r ?? null);
  // Drafts follow the server copy (changed from the bot or another device); typing is kept until the stored value changes.
  useEffect(() => {
    setCard({ number: groupCard(r?.cardNumber ?? ''), bank: r?.cardBank ?? '' });
    setSbp({ phone: r?.sbpPhone ?? '', bank: r?.sbpBank ?? '' });
    setTon(r?.tonAddress ?? '');
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (section: Method, payload: Record<string, unknown>) => {
    setBusy(section);
    try { const d = await walletPost<{ requisites: Requisites }>('set_requisites', { section, ...payload }); onSaved(d.requisites); toast(L('Реквизиты сохранены', 'Requisites saved')); }
    catch (e) { toast(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(''); }
  };
  const clear = (section: Method) => save(section, { clear: true });
  const Actions = ({ section, filled, payload }: { section: Method; filled: boolean; payload: Record<string, unknown> }) =>
    <div className="req-actions"><button type="button" className="wd-submit" disabled={busy === section} onClick={() => save(section, payload)}><CheckCircle2 size={15}/>{L('Сохранить', 'Save')}</button>
      {filled && <button type="button" className="req-del" aria-label={L('Удалить', 'Delete')} disabled={busy === section} onClick={() => clear(section)}><Trash2 size={16}/></button>}</div>;

  return <div className="wd-card req-card">
    <div className="wd-head"><div><span className="wd-kicker">{L('РЕКВИЗИТЫ', 'REQUISITES')}</span><h3>{L('Ваши реквизиты', 'Your requisites')}</h3><small>{L('Общие с ботом: меняете здесь — обновится в боте', 'Shared with the bot: edit here, it updates there')}</small></div><div className="wd-icon"><Wallet size={20}/></div></div>

    <div className="req-sec"><b><CreditCard size={14}/>{L('Банковская карта', 'Bank card')}</b>
      <input className="wd-field" inputMode="numeric" autoComplete="off" value={card.number} onChange={e => setCard(o => ({ ...o, number: groupCard(e.target.value) }))} placeholder="0000 0000 0000 0000"/>
      <BankPicker value={card.bank} onChange={bank => setCard(o => ({ ...o, bank }))} lang={lang}/>
      <Actions section="card" filled={Boolean(r?.cardNumber)} payload={{ number: card.number, bank: card.bank }}/></div>

    <div className="req-sec"><b><Phone size={14}/>{L('СБП — по номеру телефона', 'SBP — by phone number')}</b>
      <input className="wd-field" inputMode="tel" autoComplete="off" value={sbp.phone} onChange={e => setSbp(o => ({ ...o, phone: e.target.value }))} placeholder="+7 900 000-00-00"/>
      <BankPicker value={sbp.bank} onChange={bank => setSbp(o => ({ ...o, bank }))} lang={lang}/>
      <Actions section="sbp" filled={Boolean(r?.sbpPhone)} payload={{ phone: sbp.phone, bank: sbp.bank }}/></div>

    <div className="req-sec"><b><Gem size={14}/>{L('TON-адрес (GRAM)', 'TON address (GRAM)')}</b>
      <input className="wd-field" autoComplete="off" autoCapitalize="off" spellCheck={false} value={ton} onChange={e => setTon(e.target.value.trim())} placeholder="UQ…"/>
      <Actions section="ton" filled={Boolean(r?.tonAddress)} payload={{ address: ton }}/></div>
  </div>;
}

export function WithdrawCard({ wallet, lang, manager, toast, onDone }: { wallet: Wallet | null; lang: string; manager: { username: string; url: string }; toast: (m: string) => void; onDone: () => void }) {
  const L = (ru: string, en: string) => (lang === 'RU' ? ru : en);
  const [method, setMethod] = useState<Method>('card');
  // Card / SBP pay out rubles; a TON address receives GRAM or USDT (dollars).
  const allowed: Pay[] = method === 'ton' ? ['GRAM', 'USDT'] : ['RUB'];
  const [cur, setCur] = useState<Pay>('RUB');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = (m: Method) => {
    setMethod(m); setResult(null); setAmount('');
    setCur(m === 'ton' ? (wallet?.currency === 'USD' ? 'USDT' : 'GRAM') : 'RUB');
  };
  const rates = wallet?.rates; const balance = wallet?.stats.balance ?? 0; const frozen = wallet?.stats.frozen ?? 0;
  const rate = cur === 'RUB' ? 1 : cur === 'GRAM' ? rates?.GRAM ?? null : rates?.USD ?? null;
  const max = rate ? floorTo(balance / rate, PDEC[cur]) : 0;
  const value = Number(amount.replace(',', '.')) || 0;
  const fmt = (n: number, d = 2) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: d }).format(n);
  const r = wallet?.requisites;
  const dest = method === 'card' ? (r?.cardNumber ? `${r.cardNumber.replace(/(.{4})/g, '$1 ').trim()} · ${r.cardBank}` : null)
    : method === 'sbp' ? (r?.sbpPhone ? `${r.sbpPhone} · ${r.sbpBank}` : null)
    : (r?.tonAddress ? `${r.tonAddress.slice(0, 8)}…${r.tonAddress.slice(-6)}` : null);

  const submit = async () => {
    if (!dest) { setResult({ ok: false, text: L('Сначала добавьте реквизиты для этого способа.', 'Add the requisites for this method first.') }); return; }
    if (!(value > 0)) { toast(L('Укажите сумму', 'Enter an amount')); return; }
    if (value > max + 1e-9) { setResult({ ok: false, text: L(`Недостаточно средств. Доступно: ${fmt(max, PDEC[cur])} ${PSYM[cur]}.`, `Insufficient balance. Available: ${fmt(max, PDEC[cur])} ${PSYM[cur]}.`) }); return; }
    setBusy(true);
    try {
      await walletPost('withdraw', { method, currency: cur, amount: value });
      setAmount('');
      setResult({ ok: true, text: L('Заявка создана, сумма заморожена на балансе. Вывод в течение 48 часов — для оформления напишите менеджеру: ', 'Request created and the amount is frozen. Processed within 48 hours — contact the manager to proceed: ') });
      onDone();
    } catch (e) { setResult({ ok: false, text: e instanceof Error ? e.message : 'Error' }); }
    finally { setBusy(false); }
  };

  const status = (s: string) => s === 'paid' ? L('выплачено', 'paid') : s === 'rejected' ? L('отклонено', 'rejected') : L('в обработке', 'pending');
  return <div className="wd-card">
    <div className="wd-head"><div><span className="wd-kicker">{L('ВЫВОД СРЕДСТВ', 'WITHDRAW')}</span><h3>{L('Вывести средства', 'Withdraw funds')}</h3><small>{L('Обработка до 48 часов', 'Processed within 48 hours')}{frozen > 0 ? ` · ${L('заморожено', 'frozen')}: ${fmt(frozen)} ₽` : ''}</small></div><div className="wd-icon"><Banknote size={20}/></div></div>
    <div className="wd-tabs three">
      <button type="button" className={method === 'card' ? 'on' : ''} onClick={() => pick('card')}><CreditCard size={14}/>{L('Карта', 'Card')}</button>
      <button type="button" className={method === 'sbp' ? 'on' : ''} onClick={() => pick('sbp')}><Phone size={14}/>{L('СБП', 'SBP')}</button>
      <button type="button" className={method === 'ton' ? 'on' : ''} onClick={() => pick('ton')}><Gem size={14}/>TON</button>
    </div>
    <div className="wd-dest">{dest ? <><small>{L('НА РЕКВИЗИТЫ', 'TO')}</small><b>{dest}</b></> : <span>{L('Реквизиты не добавлены — заполните блок «Ваши реквизиты» ниже.', 'No requisites yet — fill in the “Your requisites” block below.')}</span>}</div>
    {allowed.length > 1 && <div className="cur-switch small">{allowed.map(c => <button key={c} type="button" className={cur === c ? 'on' : ''} onClick={() => { setCur(c); setAmount(''); setResult(null); }}>{c === 'USDT' ? '$ USDT' : c}</button>)}</div>}
    <div className="wd-row"><input className="wd-field" type="number" inputMode="decimal" min="0" value={amount} onChange={e => { setAmount(e.target.value); setResult(null); }} placeholder={`${L('Сумма', 'Amount')}, ${PSYM[cur]}`}/><button type="button" className="wd-all" onClick={() => { setAmount(max > 0 ? String(max) : ''); setResult(null); }}>{L('ВСЁ', 'MAX')}</button></div>
    <div className="wd-receive"><div><small>{L('ВЫ ПОЛУЧИТЕ', 'YOU RECEIVE')}</small><b>{fmt(value, PDEC[cur])} {PSYM[cur]}</b>{cur !== 'RUB' && rate && <small className="wd-eq">≈ {fmt(value * rate)} ₽ · 1 {cur === 'USDT' ? 'USD' : cur} = {fmt(rate)} ₽</small>}</div></div>
    {cur !== 'RUB' && !rate && <div className="wd-result low">{L('Курс сейчас недоступен, попробуйте позже.', 'The rate is unavailable right now, try again later.')}</div>}
    <button type="button" className="wd-submit" disabled={busy || (cur !== 'RUB' && !rate)} onClick={submit}><Banknote size={16}/>{busy ? '…' : L('Вывести', 'Withdraw')}</button>
    {result && <div className={`wd-result ${result.ok ? 'ok' : 'low'}`}>{result.text}{result.ok && <a href={manager.url} target="_blank" rel="noreferrer">@{manager.username}</a>}</div>}
    {wallet && wallet.withdrawals.length > 0 && <ul className="wd-list">{wallet.withdrawals.map(w => <li key={w.id}><span>{fmt(w.amount, PDEC[w.currency])} {PSYM[w.currency]}<small>{new Date(w.createdAt).toLocaleDateString(locale(lang))}</small></span><em className={w.status}>{status(w.status)}</em></li>)}</ul>}
  </div>;
}
