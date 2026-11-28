import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  createRoot } from 'react-dom/client';
import {
  Gamepad2, Gift, LockKeyhole, Sparkles, UserRound, Search, ChevronDown, Gem, TrendingUp, Activity, Wallet, ShoppingBag, ArrowUpRight, X, ExternalLink, ShieldCheck, Moon, Sun, ArrowLeft, Plus, Trash2, ImagePlus, CheckCircle2, Upload, UserRoundCheck, Globe2, MessageSquare, Star, CreditCard, Phone, Banknote, RefreshCw, SlidersHorizontal, Share2
} from 'lucide-react';
import './style.css';
import './design.css';

type Tab = 'games' | 'market' | 'reviews' | 'gifts' | 'event' | 'profile' | 'admin';
type Lang = 'EN' | 'RU';
type Currency = 'RUB' | 'USD' | 'GRAM';
const BANKS = ['Сбербанк', 'Т-Банк', 'Альфа-Банк', 'ВТБ', 'Райффайзенбанк', 'Газпромбанк', 'Открытие', 'Совкомбанк', 'Россельхозбанк', 'МКБ'];
type Sort = 'featured' | 'low' | 'high' | 'cheap' | 'expensive';
type HistoryItem = { id: string; kind: 'purchase' | 'operation'; title: string; link: string | null; opType: 'topup' | 'profit' | null; amount: number; createdAt: number };
type Theme = 'light' | 'dark';
type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
};
type ReviewItem = {
  id: string;
  username: string;
  rating: number;
  text: string;
  createdAt: number;
};
type GiftItem = {
  id: string;
  collection: string;
  number: number;
  model: string;
  modelRarity: string;
  backdrop: string;
  backdropRarity: string;
  symbol: string;
  symbolRarity: string;
  image: string;
  source: string;
  serial: string;
  price?: number | null;
  sellerId?: string | null;
};
type MyGift = Omit<GiftItem, 'id' | 'createdAt'> & { id: string; price: number | null };

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: TelegramUser };
        ready?: () => void;
        expand?: () => void;
        openTelegramLink?: (url: string) => void;
        onEvent?: (event: string, handler: () => void) => void;
        offEvent?: (event: string, handler: () => void) => void;
        HapticFeedback?: { impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void; notificationOccurred?: (type: 'error' | 'success' | 'warning') => void };
        platform?: string;
        version?: string;
        colorScheme?: 'light' | 'dark';
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
      };
    };
  }
}

const STORAGE_KEY = 'playerok.catalog.v3';
const THEME_KEY = 'playerok.theme.v2';
const REVIEWS_STORAGE_KEY = 'playerok.reviews.v1';
const botUrl = 'https://t.me/Playerok_Guarantor_Bot';
const managerUrl = 'https://t.me/Mananger_Playerok';

// Коллекционные подарки Telegram. Все изображения ведут на публичные NFT-превью Fragment.
const nav: { id: Exclude<Tab, 'admin'>; label: string; ru: string; icon: typeof Gamepad2 }[] = [
  { id: 'games', label: 'Games', ru: 'Игры', icon: Gamepad2 },
  { id: 'market', label: 'Market', ru: 'Маркет', icon: Gift },
  { id: 'reviews', label: 'Reviews', ru: 'Отзывы', icon: MessageSquare },
  { id: 'gifts', label: 'My gifts', ru: 'Мои подарки', icon: LockKeyhole },
  { id: 'event', label: 'Event', ru: 'События', icon: Sparkles },
  { id: 'profile', label: 'Profile', ru: 'Профиль', icon: UserRound }
];

const copy = {
  EN: {
    games: 'Games are unavailable', gamesSub: 'Available games will appear here.', market: 'Telegram gifts',
    marketSub: 'Collectible Telegram gifts', my: 'My gifts', mySub: 'Your gifts, offers and purchase history in one place.',
    event: 'Events are unavailable', eventSub: 'New events and special offers will appear here.', profile: 'Profile',
    balance: 'BALANCE', spent: 'SPENT', purchases: 'PURCHASES', language: 'LANGUAGE', add: 'Add funds',
    fundSub: 'Deposits and withdrawals are currently unavailable.', search: 'Search gifts', featured: 'Featured',
    low: 'Lowest number', high: 'Highest number', listed: 'GIFTS IN CATALOG', floor: 'LOWEST NUMBER', volume: 'COLLECTIONS',
    openNumbers: 'Gift numbers', openDeals: 'Gift collections', unavailable: 'Unavailable', retry: 'Retry',
    offers: 'Offers', history: 'History', marketButton: 'Go to market',
    noPersonalGifts: 'You do not have any gifts yet.', noOffers: 'You do not have any offers yet.', noHistory: 'Your purchase history is empty.',
    reviews: 'Reviews', reviewsSub: 'Feedback from Playerok users', noReviews: 'No reviews yet', noReviewsSub: 'Reviews will appear here.', reviewCount: 'REVIEWS', averageRating: 'AVERAGE RATING',
    addReview: 'Add a review', reviewDate: 'Review date and time', statsTitle: 'User balance', userId: 'Telegram ID', modeAdd: 'Add', modeSet: 'Set', statsSave: 'Apply', statsDone: 'Saved', statsInvalid: 'Check the ID and values.', reviewUsername: 'Username / nickname', reviewRating: 'Rating', reviewText: 'Review text', saveReview: 'Publish review',
    reviewAdded: 'Review added', reviewRemoved: 'Review removed', invalidReview: 'Enter a nickname and review text, then choose 1–5 stars.',
    adminReviews: 'Manage reviews', reviewList: 'Published reviews',
    model: 'MODEL', backdrop: 'BACKGROUND', symbol: 'PATTERN', collection: 'COLLECTION',
    bot: 'Open Telegram bot', gamesInfo: 'This section is currently empty.',
    telegramConnect: 'Open this app from Telegram to show your profile.', connect: 'Open Telegram bot',
    account: 'TELEGRAM ACCOUNT', connected: 'Telegram profile connected', notConnected: 'Telegram profile not found',
    premium: 'TELEGRAM PREMIUM', admin: 'Manage catalog', adminTitle: 'Admin panel', adminSub: 'Add and remove collectible gifts from the catalog.', adminDenied: 'Administrator access is required.',
    localOnly: 'Shared database connected. Gifts and reviews are visible to every visitor; only authorized administrators can change them.',
    databaseUnavailable: 'Shared database is not connected yet. Add the Supabase environment variables in Vercel and run the SQL setup.',
    importLocal: 'Transfer saved data from this device', importDone: 'Local data transferred to the shared database.',
    addGift: 'Add a gift', collectionName: 'Gift collection', number: 'Gift number', modelName: 'Model', modelRarity: 'Model rarity',
    background: 'Background', backgroundRarity: 'Background rarity', pattern: 'Pattern', patternRarity: 'Pattern rarity',
    imageUrl: 'Custom image URL (optional)', nftUrl: 'Paste Telegram NFT link', imageHint: 'Just paste a Telegram NFT link, for example https://t.me/nft/JellyBunny-12779. Collection, number and gift image will fill in automatically — no image URL needed.', imagePreview: 'Image preview',
    saveGift: 'Add to market', catalogList: 'Catalog items', delete: 'Delete',
    added: 'Gift added to catalog', removed: 'Gift removed', invalid: 'Fill in the NFT link (or collection and number), model, background and pattern.',
    openNft: 'View on Telegram', photo: 'Telegram avatar', notInTelegram: 'Not opened from Telegram',
    dark: 'Dark theme', light: 'Light theme', back: 'Back', id: 'TELEGRAM ID', username: 'USERNAME',
    userName: 'NAME', total: 'ITEMS'
  },
  RU: {
    games: 'Игры недоступны', gamesSub: 'Здесь появятся доступные игры.', market: 'Подарки Telegram',
    marketSub: 'Коллекционные подарки Telegram', my: 'Мои подарки', mySub: 'Подарки, предложения и история покупок в одном месте.',
    event: 'События недоступны', eventSub: 'Здесь появятся события и специальные предложения.', profile: 'Профиль',
    balance: 'БАЛАНС', spent: 'ПОТРАЧЕНО', purchases: 'ПОКУПКИ', language: 'ЯЗЫК', add: 'Пополнить баланс',
    fundSub: 'Пополнение и вывод средств пока недоступны.', search: 'Поиск подарков', featured: 'Рекомендуемые',
    low: 'Сначала меньший номер', high: 'Сначала больший номер', listed: 'ПОДАРКОВ В КАТАЛОГЕ', floor: 'МИНИМАЛЬНЫЙ НОМЕР', volume: 'КОЛЛЕКЦИИ',
    openNumbers: 'Номера подарков', openDeals: 'Коллекции подарков', unavailable: 'Недоступно', retry: 'Повторить',
    offers: 'Предложения', history: 'История', marketButton: 'Перейти в маркет',
    noPersonalGifts: 'У вас пока нет подарков.', noOffers: 'Пока нет предложений.', noHistory: 'История покупок пока пуста.',
    reviews: 'Отзывы', reviewsSub: 'Отзывы пользователей Playerok', noReviews: 'Отзывов пока нет', noReviewsSub: 'Здесь будут опубликованы отзывы.', reviewCount: 'ОТЗЫВОВ', averageRating: 'СРЕДНЯЯ ОЦЕНКА',
    addReview: 'Добавить отзыв', reviewDate: 'Дата и время отзыва', statsTitle: 'Баланс пользователя', userId: 'Telegram ID', modeAdd: 'Добавить', modeSet: 'Установить', statsSave: 'Применить', statsDone: 'Сохранено', statsInvalid: 'Проверьте ID и значения.', reviewUsername: 'Имя пользователя / ник', reviewRating: 'Оценка', reviewText: 'Текст отзыва', saveReview: 'Опубликовать отзыв',
    reviewAdded: 'Отзыв добавлен', reviewRemoved: 'Отзыв удалён', invalidReview: 'Укажи ник, текст отзыва и оценку от 1 до 5 звёзд.',
    adminReviews: 'Управление отзывами', reviewList: 'Опубликованные отзывы',
    model: 'МОДЕЛЬ', backdrop: 'ФОН', symbol: 'УЗОР', collection: 'КОЛЛЕКЦИЯ',
    bot: 'Открыть Telegram-бота', gamesInfo: 'Раздел пока пуст.',
    telegramConnect: 'Открой приложение через Telegram, чтобы увидеть свой профиль.', connect: 'Открыть Telegram-бота',
    account: 'АККАУНТ TELEGRAM', connected: 'Профиль Telegram подключён', notConnected: 'Профиль Telegram не найден',
    premium: 'TELEGRAM PREMIUM', admin: 'Управление каталогом', adminTitle: 'Панель администратора', adminSub: 'Добавление и удаление коллекционных подарков.', adminDenied: 'Доступ разрешён только администраторам.',
    localOnly: 'Общая база подключена. Подарки и отзывы видны всем посетителям; изменять их могут только администраторы.',
    databaseUnavailable: 'Общая база ещё не подключена. Добавь переменные Supabase в Vercel и выполни SQL-настройку.',
    importLocal: 'Перенести данные с этого устройства', importDone: 'Локальные данные перенесены в общую базу.',
    addGift: 'Добавить подарок', collectionName: 'Коллекция подарка', number: 'Номер подарка', modelName: 'Модель', modelRarity: 'Редкость модели',
    background: 'Фон', backgroundRarity: 'Редкость фона', pattern: 'Узор', patternRarity: 'Редкость узора',
    imageUrl: 'Своя ссылка на изображение (необязательно)', nftUrl: 'Вставь ссылку на Telegram NFT', imageHint: 'Просто вставь ссылку на подарок, например https://t.me/nft/JellyBunny-12779. Коллекция, номер и изображение заполнятся автоматически — искать ссылку на картинку не нужно.', imagePreview: 'Предпросмотр изображения',
    saveGift: 'Добавить в маркет', catalogList: 'Подарки в каталоге', delete: 'Удалить',
    added: 'Подарок добавлен в каталог', removed: 'Подарок удалён', invalid: 'Заполни ссылку на NFT (или коллекцию и номер), модель, фон и узор.',
    openNft: 'Открыть в Telegram', photo: 'Аватар Telegram', notInTelegram: 'Приложение открыто не из Telegram',
    dark: 'Тёмная тема', light: 'Светлая тема', back: 'Назад', id: 'TELEGRAM ID', username: 'ИМЯ ПОЛЬЗОВАТЕЛЯ',
    userName: 'ИМЯ', total: 'ЛОТОВ'
  }
};

function getTelegramUser(): TelegramUser | null {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  return user && typeof user.id === 'number' ? user : null;
}

function titleFromGiftSlug(slug: string): string {
  const known: Record<string, string> = {
    cookieheart: 'Cookie Heart', jellybunny: 'Jelly Bunny', durovscap: "Durov's Cap",
    plushpepe: 'Plush Pepe', lovecandle: 'Love Candle', starnotepad: 'Star Notepad'
  };
  const normalized = slug.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (known[normalized]) return known[normalized];
  return slug.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim();
}

function parseGiftLink(value: string): { collection: string; number: string; slug: string; source: string; image: string } | null {
  try {
    const url = new URL(value.trim());
    const match = url.pathname.match(/^\/(?:nft|gift)\/([A-Za-z0-9_-]+)-(\d+)(?:\.webp)?\/?$/i);
    if (!match) return null;
    const slug = match[1];
    const number = match[2];
    const collection = titleFromGiftSlug(slug);
    const serial = `${slug}-${number}`;
    return {
      collection,
      number,
      slug: slug.toLowerCase().replace(/[^a-z0-9]/g, ''),
      source: `https://t.me/nft/${serial}`,
      image: `https://nft.fragment.com/gift/${slug.toLowerCase().replace(/[^a-z0-9]/g, '')}-${number}.webp`
    };
  } catch {
    return null;
  }
}

type GiftLookup = { serial: string; ok: boolean; error?: string; collection?: string; model?: string; modelRarity?: string; backdrop?: string; backdropRarity?: string; symbol?: string; symbolRarity?: string };
const lookupGifts = (serials: string[]) => adminPost<{ results: GiftLookup[] }>('/api/gift-lookup', { serials }).then(r => r.results);

// Открывает подарок в самом Telegram (нативно); вне Telegram — обычная ссылка.
function openGift(url: string) {
  const app = window.Telegram?.WebApp;
  if (app?.openTelegramLink && /^https:\/\/t\.me\//i.test(url)) app.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { method: 'GET', cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`);
  return data as T;
}

async function adminPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const initData = window.Telegram?.WebApp?.initData || '';
  if (!initData) throw new Error('Open the Mini App inside Telegram as an administrator.');
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, initData })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`);
  return data as T;
}

function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    return (['games', 'market', 'reviews', 'gifts', 'event', 'profile'] as Tab[]).find(id => id === wanted) ?? 'market';
  });
  const [lang, setLang] = useState<Lang>(() => {
    const fromBot = new URLSearchParams(window.location.search).get('lang')?.toLowerCase();
    if (fromBot === 'ru' || fromBot === 'en') return fromBot === 'ru' ? 'RU' : 'EN';
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code?.toLowerCase();
    return tgLang?.startsWith('ru') ? 'RU' : 'EN';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.Telegram?.WebApp?.colorScheme === 'light' ? 'light' : 'dark';
  });
  const themeManual = useRef(localStorage.getItem(THEME_KEY) !== null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(() => getTelegramUser());
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [sort, setSort] = useState<Sort>('featured');
  const [sub, setSub] = useState<'gifts' | 'offers' | 'history'>('gifts');
  const [langOpen, setLangOpen] = useState(false);
  const [catalog, setCatalog] = useState<GiftItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState('');
  const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const [reviewForm, setReviewForm] = useState({ username: '', rating: 5, text: '', date: nowLocal() });
  const [minWait, setMinWait] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchPrice, setBatchPrice] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [buyGift, setBuyGift] = useState<GiftItem | null>(null);
  const [batchReport, setBatchReport] = useState('');
  const [wdMethod, setWdMethod] = useState<'card' | 'sbp' | 'ton'>('card');
  const [stats, setStats] = useState({ balance: 0, spent: 0, purchases: 0 });
  const [statsForm, setStatsForm] = useState({ telegramId: '', mode: 'add', balance: '', spent: '', purchases: '' });
  const [manager, setManager] = useState({ username: 'Mananger_Playerok', url: managerUrl });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [adminHist, setAdminHist] = useState<HistoryItem[]>([]);
  const [histForm, setHistForm] = useState({ telegramId: '', type: 'purchase', link: '', amount: '', date: nowLocal() });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fMin, setFMin] = useState('');
  const [fMax, setFMax] = useState('');
  const [fRarity, setFRarity] = useState(0);
  const [fOnSale, setFOnSale] = useState(false);
  const [pct, setPct] = useState(0);
  const [fx, setFx] = useState(() => { try { return { haptics: localStorage.getItem('playerok.haptics') !== '0', sounds: localStorage.getItem('playerok.sounds') === '1' }; } catch { return { haptics: true, sounds: false }; } });
  const fxRef = useRef(fx);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [userCard, setUserCard] = useState<Record<string, string | number> | null>(null);
  const [cardId, setCardId] = useState('');
  const [myGifts, setMyGifts] = useState<MyGift[]>([]);
  const [sell, setSell] = useState<{ id: string; price: string } | null>(null);
  const [ugForm, setUgForm] = useState({ telegramId: '', links: '' });
  const [ugList, setUgList] = useState<MyGift[]>([]);
  const [wd, setWd] = useState({ bank: 'Сбербанк', custom: '', req: '', amount: '', cur: 'RUB' as Currency, result: 'idle' as 'idle' | 'ok' | 'low' });
  const [currency, setCurrency] = useState<Currency>(() => { try { const c = localStorage.getItem('playerok.currency'); return c === 'USD' || c === 'GRAM' ? c : 'RUB'; } catch { return 'RUB'; } });
  const [rates, setRates] = useState<{ usd: number; gram: number } | null>(null);
  const [reqForm, setReqForm] = useState({ rubType: '', rubCard: '', rubPhone: '', rubBank: '', tonWallet: '' });
  const [bankCustom, setBankCustom] = useState(false);
  const [toast, setToast] = useState('');
  const [giftForm, setGiftForm] = useState({
    collection: '', number: '', model: '', modelRarity: '', backdrop: '', backdropRarity: '',
    symbol: '', symbolRarity: '', image: '', source: '', price: ''
  });
  const t = copy[lang];

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    const user = getTelegramUser();
    if (user) {
      setTelegramUser(user);
      if (user.language_code?.toLowerCase().startsWith('ru')) setLang('RU');
    }

    // Admin status is granted only by the server after validating Telegram's signed initData.
    let active = true;
    const initData = webApp?.initData;
    if (!initData) {
      setIsAdmin(false);
      return () => { active = false; };
    }
    fetch('/api/admin-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    })
      .then(async response => {
        if (!response.ok) return false;
        const result: unknown = await response.json();
        return Boolean(result && typeof result === 'object' && 'isAdmin' in result && (result as { isAdmin?: unknown }).isAdmin === true);
      })
      .then(allowed => { if (active) setIsAdmin(allowed); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (tab === 'admin' && !isAdmin) setTab('profile');
  }, [tab, isAdmin]);

  useEffect(() => {
    let active = true;
    const refreshSharedData = async () => {
      try {
        const [giftResult, reviewResult] = await Promise.all([
          apiGet<{ items: GiftItem[] }>('/api/catalog'),
          apiGet<{ items: ReviewItem[] }>('/api/reviews')
        ]);
        if (!active) return;
        setCatalog(Array.isArray(giftResult.items) ? giftResult.items : []);
        setReviews(Array.isArray(reviewResult.items) ? reviewResult.items : []);
        setDatabaseReady(true);
        setDatabaseError('');
      } catch (error) {
        if (!active) return;
        setDatabaseReady(false);
        setDatabaseError(error instanceof Error ? error.message : 'Shared database is unavailable.');
      }
    };
    void refreshSharedData().finally(() => setDataLoaded(true));
    const interval = window.setInterval(refreshSharedData, 20000);
    window.addEventListener('focus', refreshSharedData);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshSharedData);
    };
  }, []);

  useEffect(() => {
    if (themeManual.current) localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    const color = theme === 'dark' ? '#171a24' : '#f4f7fc';
    window.Telegram?.WebApp?.setHeaderColor?.(theme === 'dark' ? '#171a24' : '#ffffff');
    window.Telegram?.WebApp?.setBackgroundColor?.(color);
  }, [theme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rarityOf = (g: GiftItem) => Math.min(...[g.modelRarity, g.backdropRarity, g.symbolRarity].map(r => { const n = parseFloat(String(r).replace(',', '.')); return Number.isFinite(n) ? n : Infinity; }));
    const min = fMin.trim() === '' ? null : Number(fMin), max = fMax.trim() === '' ? null : Number(fMax);
    // Поиск не зависит от пробелов, дефисов и запятых: «IceCream-274200», «ice cream 274 200» и «#274,200» находят один подарок.
    const norm = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const nq = norm(q);
    let list = catalog.filter(g => { const hay = [g.collection, g.number, g.model, g.backdrop, g.symbol, g.serial].join(' ').toLowerCase(); return !q || hay.includes(q) || norm(hay).includes(nq); });
    if (fOnSale || min !== null || max !== null || sort === 'cheap' || sort === 'expensive') list = list.filter(g => g.price != null);
    if (min !== null && Number.isFinite(min)) list = list.filter(g => (g.price ?? 0) >= min);
    if (max !== null && Number.isFinite(max)) list = list.filter(g => (g.price ?? 0) <= max);
    if (fRarity > 0) list = list.filter(g => rarityOf(g) <= fRarity);
    if (sort === 'low') list = [...list].sort((a, b) => a.number - b.number);
    if (sort === 'high') list = [...list].sort((a, b) => b.number - a.number);
    if (sort === 'cheap') list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sort === 'expensive') list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return list;
  }, [catalog, query, sort, fMin, fMax, fRarity, fOnSale]);
  const activeFilters = (fOnSale ? 1 : 0) + (fMin || fMax ? 1 : 0) + (fRarity ? 1 : 0) + (sort === 'cheap' || sort === 'expensive' ? 1 : 0);
  const resetFilters = () => { setFMin(''); setFMax(''); setFRarity(0); setFOnSale(false); if (sort === 'cheap' || sort === 'expensive') setSort('featured'); };

  const go = (next: Tab) => {
    if (next === 'admin' && !isAdmin) { setTab('profile'); showToast(t.adminDenied); return; }
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const showToast = (message: string) => {
    setToast(message);
    if (fxRef.current.haptics) window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(/недостаточно|insufficient|invalid|error|ошиб|неверн|denied|доступ/i.test(message) ? 'error' : 'success');
    window.setTimeout(() => setToast(''), 2600);
  };
  const updateForm = (key: keyof typeof giftForm, value: string) => setGiftForm(old => ({ ...old, [key]: value }));
  const updateGiftSource = (value: string) => {
    const parsed = parseGiftLink(value);
    setGiftForm(old => parsed ? ({ ...old, source: parsed.source, collection: parsed.collection, number: parsed.number, image: parsed.image }) : ({ ...old, source: value }));
    if (parsed && isAdmin) {
      lookupGifts([`${parsed.source.split('/nft/')[1]}`]).then(([r]) => {
        if (r?.ok) setGiftForm(old => old.source !== parsed.source ? old : ({ ...old, collection: r.collection || old.collection, model: r.model || '', modelRarity: r.modelRarity || '', backdrop: r.backdrop || '', backdropRarity: r.backdropRarity || '', symbol: r.symbol || '', symbolRarity: r.symbolRarity || '' }));
      }).catch(() => {});
    }
  };
  const addBatch = async () => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    // Формат строки: ссылка и цена через пробел, например «https://t.me/nft/MoodPack-112928 1900»
    const priceMap = new Map<string, number>();
    const order: string[] = [];
    for (const line of batchText.split(/\r?\n/)) {
      const hits = [...line.matchAll(/(?:https?:\/\/)?t\.me\/nft\/([A-Za-z0-9_-]+-\d+)/gi)];
      hits.forEach((hit, i) => {
        const serial = hit[1];
        if (!order.includes(serial)) order.push(serial);
        const tail = line.slice(hit.index! + hit[0].length, hits[i + 1]?.index ?? line.length);
        const num = tail.match(/^[\s\-–—:,;|=]*(\d+(?:[ \u00a0]\d{3})*(?:[.,]\d{1,2})?)(?![\d])/);
        if (num) { const value = Number(num[1].replace(/[ \u00a0]/g, '').replace(',', '.')); if (Number.isFinite(value) && value > 0) priceMap.set(serial, value); }
      });
    }
    const found = order;
    const withPrice = (serial: string) => `https://t.me/nft/${serial}${priceMap.has(serial) ? ' ' + priceMap.get(serial) : ''}`;
    if (!found.length) { setBatchReport(lang === 'RU' ? 'Ссылки на подарки не найдены.' : 'No gift links found.'); return; }
    const chunk = found.slice(0, 25), rest = found.slice(25);
    setBatchBusy(true); setBatchReport('');
    try {
      const results = await lookupGifts(chunk);
      const good = results.filter(r => r.ok);
      const items = good.map(r => {
        const m = r.serial.match(/^(.*)-(\d+)$/)!;
        const slug = m[1].toLowerCase().replace(/[^a-z0-9]/g, '');
        return { id: r.serial.toLowerCase().replace(/[^a-z0-9_-]/g, ''), collection: r.collection || titleFromGiftSlug(m[1]), number: Number(m[2]), model: r.model, modelRarity: r.modelRarity, backdrop: r.backdrop, backdropRarity: r.backdropRarity, symbol: r.symbol, symbolRarity: r.symbolRarity, image: `https://nft.fragment.com/gift/${slug}-${m[2]}.webp`, source: `https://t.me/nft/${r.serial}`, serial: r.serial, price: priceMap.get(r.serial) ?? (batchPrice.trim() ? Number(batchPrice) : undefined) };
      });
      if (items.length) {
        await adminPost('/api/catalog', { action: 'import', items });
        const fresh = await apiGet<{ items: GiftItem[] }>('/api/catalog');
        setCatalog(Array.isArray(fresh.items) ? fresh.items : []);
      }
      const bad = results.filter(r => !r.ok);
      setBatchReport((lang === 'RU' ? `Добавлено: ${items.length}. Не удалось: ${bad.length}.` : `Added: ${items.length}. Failed: ${bad.length}.`) + (bad.length ? '\n' + bad.map(b => `${b.serial} — ${b.error}`).join('\n') : '') + (rest.length ? (lang === 'RU' ? `\nОсталось в списке: ${rest.length} (нажмите ещё раз).` : `\nRemaining: ${rest.length} (press again).`) : ''));
      setBatchText([...bad.map(b => withPrice(b.serial)), ...rest.map(withPrice)].join('\n'));
      showToast(`${t.added}: ${items.length}`);
    } catch (error) { setBatchReport(error instanceof Error ? error.message : 'Error'); }
    setBatchBusy(false);
  };
  const saveHistory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) { showToast(t.adminDenied); return; }
    const when = new Date(histForm.date).getTime();
    try {
      await adminPost('/api/history', { action: 'add', telegramId: histForm.telegramId, kind: histForm.type === 'purchase' ? 'purchase' : 'operation', opType: histForm.type === 'purchase' ? undefined : histForm.type, nftLink: histForm.link, amount: histForm.amount, createdAt: Number.isFinite(when) ? when : Date.now() });
      setHistForm(old => ({ ...old, link: '', amount: '', date: nowLocal() }));
      showToast(t.statsDone);
      void loadAdminHist();
    } catch (error) { showToast(error instanceof Error ? error.message : t.statsInvalid); }
  };
  const loadAdminHist = async () => {
    if (!isAdmin || !histForm.telegramId) return;
    try { const r = await adminPost<{ items: HistoryItem[] }>('/api/history', { action: 'list', telegramId: histForm.telegramId }); setAdminHist(r.items); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  const deleteHistory = async (id: string) => {
    try { await adminPost('/api/history', { action: 'delete', id }); setAdminHist(old => old.filter(h => h.id !== id)); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  const submitWithdraw = () => {
    const amount = Number(wd.amount.replace(',', '.'));
    const digits = wd.req.replace(/[\s()-]/g, '');
    const reqOk = wdMethod === 'card' ? /^\d{16,19}$/.test(digits) : wdMethod === 'sbp' ? /^\+?\d{10,15}$/.test(digits) : /^[A-Za-z0-9_:-]{20,128}$/.test(wd.req.trim());
    if (!(amount > 0) || !reqOk) { showToast(lang === 'RU' ? 'Проверьте реквизиты и сумму' : 'Check the details and amount'); return; }
    const rub = toRub(amount, wd.cur);
    if (!Number.isFinite(rub)) { showToast(lang === 'RU' ? 'Курс сейчас недоступен' : 'Rate is unavailable'); return; }
    setWd(old => ({ ...old, result: rub > stats.balance + 1e-9 ? 'low' : 'ok' }));
  };
  const savePrice = async (id: string) => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    try {
      const result = await adminPost<{ item: GiftItem }>('/api/catalog', { action: 'set_price', id, price: (priceEdits[id] ?? '').trim() });
      setCatalog(old => old.map(g => g.id === id ? { ...g, price: result.item.price ?? null } : g));
      setPriceEdits(old => { const next = { ...old }; delete next[id]; return next; });
      showToast(lang === 'RU' ? 'Цена сохранена' : 'Price saved');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  const shareGift = (g: GiftItem) => {
    const text = `${g.collection} #${g.number}${g.price != null ? ` — ${money(g.price)}` : ''}`;
    openGift(`https://t.me/share/url?url=${encodeURIComponent(`${botUrl}?start=g_${g.id}`)}&text=${encodeURIComponent(text)}`);
  };
  const findUser = async () => {
    if (!isAdmin || !cardId) return;
    try {
      const d = await adminPost<Record<string, string | number>>('/api/admin-stats', { action: 'user', telegramId: cardId });
      setUserCard(d);
      setStatsForm(o => ({ ...o, telegramId: cardId })); setHistForm(o => ({ ...o, telegramId: cardId })); setUgForm(o => ({ ...o, telegramId: cardId }));
    } catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  const buyNow = (g: GiftItem) => {
    if (g.price == null) return;
    if (g.sellerId && telegramUser && String(telegramUser.id) === g.sellerId) { showToast(lang === 'RU' ? 'Это ваш подарок' : 'This is your gift'); return; }
    if (stats.balance < g.price) { setBuyGift(g); return; }
    showToast(lang === 'RU' ? 'Покупка пока недоступна' : 'Purchase is not available yet');
  };
  const addGift = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) { showToast(t.adminDenied); return; }
    const required = ['collection', 'number', 'model', 'backdrop', 'symbol'] as const;
    if (required.some(key => !giftForm[key].trim()) || !Number.isSafeInteger(Number(giftForm.number))) {
      showToast(t.invalid); return;
    }
    const number = Number(giftForm.number);
    const slug = giftForm.collection.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const serial = `${slug}-${number}`;
    const imageValue = giftForm.image.trim() || `https://nft.fragment.com/gift/${serial}.webp`;
    let imageUrl: URL;
    try { imageUrl = new URL(imageValue); } catch { showToast(t.invalid); return; }
    if (imageUrl.protocol !== 'https:') { showToast(t.invalid); return; }
    let source = giftForm.source.trim();
    if (source) {
      try { const u = new URL(source); if (u.protocol !== 'https:') throw new Error('URL'); }
      catch { showToast(t.invalid); return; }
    }
    const item: GiftItem = {
      id: `gift-${Date.now()}-${number}`, collection: giftForm.collection.trim(), number,
      model: giftForm.model.trim(), modelRarity: giftForm.modelRarity.trim() || '—',
      backdrop: giftForm.backdrop.trim(), backdropRarity: giftForm.backdropRarity.trim() || '—',
      symbol: giftForm.symbol.trim(), symbolRarity: giftForm.symbolRarity.trim() || '—',
      image: imageUrl.href, source: source || `https://t.me/nft/${serial}`, serial, price: giftForm.price.trim() === '' ? null : Number(giftForm.price)
    };
    try {
      const result = await adminPost<{ item: GiftItem }>('/api/catalog', { action: 'create', gift: item });
      setCatalog(old => [result.item, ...old.filter(g => g.id !== result.item.id)]);
      setGiftForm({ collection: '', number: '', model: '', modelRarity: '', backdrop: '', backdropRarity: '', symbol: '', symbolRarity: '', image: '', source: '', price: '' });
      showToast(t.added);
    } catch (error) { showToast(error instanceof Error ? error.message : t.invalid); }
  };
  const deleteGift = async (id: string) => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    try {
      await adminPost('/api/catalog', { action: 'delete', id });
      setCatalog(old => old.filter(g => g.id !== id));
      showToast(t.removed);
    } catch (error) { showToast(error instanceof Error ? error.message : t.adminDenied); }
  };
  const exportCatalog = () => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'playerok-catalog.json'; anchor.click();
    URL.revokeObjectURL(url);
  };
  const importCatalog = (file?: File) => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed) || !parsed.every(g => g && typeof g.collection === 'string' && typeof g.image === 'string')) throw new Error('Invalid catalog');
        const result = await adminPost<{ imported: number }>('/api/catalog', { action: 'import', items: parsed });
        const refreshed = await apiGet<{ items: GiftItem[] }>('/api/catalog');
        setCatalog(refreshed.items);
        showToast(`${t.added}: ${result.imported}`);
      } catch (error) { showToast(error instanceof Error ? error.message : t.invalid); }
    };
    reader.readAsText(file);
  };
  // Стартовая загрузка: минимум 3 секунды, пока придут данные и прогрузятся картинки (но не дольше 7 секунд).
  useEffect(() => {
    const a = window.setTimeout(() => setMinWait(true), 3000);
    const b = window.setTimeout(() => { setDataLoaded(true); setImagesReady(true); }, 7000);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);
  useEffect(() => {
    if (!dataLoaded || imagesReady) return;
    let live = true;
    const loads = catalog.slice(0, 24).map(g => new Promise<void>(resolve => { const img = new Image(); img.onload = img.onerror = () => resolve(); img.src = g.image; }));
    Promise.race([Promise.all(loads), new Promise(resolve => window.setTimeout(resolve, 2500))]).then(() => { if (live) setImagesReady(true); });
    return () => { live = false; };
  }, [dataLoaded, catalog, imagesReady]);
  const splashVisible = !(minWait && dataLoaded && imagesReady);
  useEffect(() => {
    if (!splashVisible) { setPct(100); return; }
    const start = performance.now();
    const pts: [number, number][] = [[0, 0], [.4, 18], [.8, 27], [1.4, 58], [1.9, 64], [2.6, 90], [3, 97], [8, 99]];
    const id = window.setInterval(() => {
      const sec = (performance.now() - start) / 1000;
      let v = 99;
      for (let i = 1; i < pts.length; i++) if (sec <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; v = v0 + (v1 - v0) * ((sec - t0) / (t1 - t0)); break; }
      setPct(old => Math.max(old, v));
    }, 60);
    return () => window.clearInterval(id);
  }, [splashVisible]);
  // Лог нового устройства уходит админам в Telegram (сервер сам решает, новое ли оно).
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    if (!app?.initData) return;
    let id = '';
    try {
      id = localStorage.getItem('playerok.device') || '';
      if (!id) { id = ((window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)) + '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40); localStorage.setItem('playerok.device', id); }
    } catch { return; }
    if (id.length < 8) return;
    fetch('/api/device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: app.initData, deviceId: id, info: { platform: app.platform, version: app.version, screen: `${window.screen.width}x${window.screen.height}`, lang: navigator.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }) }).catch(() => {});
  }, []);
  const userPost = async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, initData: window.Telegram?.WebApp?.initData || '' }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data as T;
  };
  useEffect(() => {
    if (!window.Telegram?.WebApp?.initData) return;
    let active = true;
    const load = () => userPost<{ items: MyGift[] }>('/api/mygifts', { action: 'me' }).then(d => { if (active) setMyGifts(d.items); }).catch(() => {});
    void load();
    const timer = window.setInterval(load, 20000);
    return () => { active = false; window.clearInterval(timer); };
  }, [telegramUser?.id]);
  const refreshCatalog = () => apiGet<{ items: GiftItem[] }>('/api/catalog').then(d => { if (Array.isArray(d.items)) setCatalog(d.items); }).catch(() => {});
  const listMine = async (id: string) => {
    try {
      const r = await userPost<{ item: MyGift }>('/api/mygifts', { action: 'list_item', id, price: sell?.price });
      setMyGifts(old => old.map(g => g.id === id ? r.item : g)); setSell(null); showToast(lang === 'RU' ? 'Выставлено на продажу' : 'Listed for sale'); void refreshCatalog();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  const unlistMine = async (id: string) => {
    try {
      const r = await userPost<{ item: MyGift }>('/api/mygifts', { action: 'unlist', id });
      setMyGifts(old => old.map(g => g.id === id ? r.item : g)); showToast(lang === 'RU' ? 'Снято с продажи' : 'Removed from sale'); void refreshCatalog();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  const addUserGifts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) { showToast(t.adminDenied); return; }
    const links = [...new Set((ugForm.links.match(/(?:https?:\/\/)?t\.me\/nft\/([A-Za-z0-9_-]+-\d+)/gi) || []).map(l => l.split('/nft/')[1]))];
    try {
      const r = await adminPost<{ added: string[]; failed: { serial: string; error: string }[] }>('/api/mygifts', { action: 'add', telegramId: ugForm.telegramId, links });
      showToast(`${lang === 'RU' ? 'Зачислено' : 'Credited'}: ${r.added.length}${r.failed.length ? ` · ${lang === 'RU' ? 'ошибок' : 'errors'}: ${r.failed.length}` : ''}`);
      if (r.failed.length) setUgForm(old => ({ ...old, links: r.failed.map(f => `https://t.me/nft/${f.serial}`).join('\n') })); else setUgForm(old => ({ ...old, links: '' }));
      const l = await adminPost<{ items: MyGift[] }>('/api/mygifts', { action: 'admin_list', telegramId: ugForm.telegramId }); setUgList(l.items);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  const removeUserGift = async (id: string) => {
    try { await adminPost('/api/mygifts', { action: 'remove', id }); setUgList(old => old.filter(g => g.id !== id)); } catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  // Вибрация и звуки на нажатия; тема из Telegram, пока пользователь не выбрал свою.
  useEffect(() => { fxRef.current = fx; try { localStorage.setItem('playerok.haptics', fx.haptics ? '1' : '0'); localStorage.setItem('playerok.sounds', fx.sounds ? '1' : '0'); } catch { /* ignore */ } }, [fx]);
  useEffect(() => {
    let audio: AudioContext | null = null;
    const tick = () => {
      try {
        audio = audio ?? new AudioContext();
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(920, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(620, audio.currentTime + .05);
        gain.gain.setValueAtTime(.05, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .06);
        osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .07);
      } catch { /* ignore */ }
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('button, a, [role="button"], select')) return;
      if (fxRef.current.haptics) window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
      if (fxRef.current.sounds) tick();
    };
    document.addEventListener('click', onClick, true);
    const app = window.Telegram?.WebApp;
    const onTheme = () => { if (!themeManual.current) setTheme(app?.colorScheme === 'light' ? 'light' : 'dark'); };
    app?.onEvent?.('themeChanged', onTheme);
    return () => { document.removeEventListener('click', onClick, true); app?.offEvent?.('themeChanged', onTheme); };
  }, []);
  useEffect(() => {
    if (tab !== 'admin' || !isAdmin) return;
    adminPost<Record<string, number>>('/api/admin-stats', { action: 'summary' }).then(setSummary).catch(() => {});
  }, [tab, isAdmin]);
  // Курсы валют (GRAM = Toncoin), валюта и реквизиты, общие с ботом.
  const applyProfile = (p: { currency?: string; rubType?: string; rubCard?: string; rubPhone?: string; rubBank?: string; tonWallet?: string }) => {
    const next = { rubType: p.rubType || '', rubCard: p.rubCard || '', rubPhone: p.rubPhone || '', rubBank: p.rubBank || '', tonWallet: p.tonWallet || '' };
    setReqForm(next); setBankCustom(!!next.rubBank && !BANKS.includes(next.rubBank));
  };
  useEffect(() => {
    let active = true;
    const loadRates = () => fetch('/api/rates').then(r => r.ok ? r.json() : null).then(d => { if (active && d?.usd > 0 && d?.gram > 0) setRates({ usd: d.usd, gram: d.gram }); }).catch(() => {});
    void loadRates();
    const timer = window.setInterval(loadRates, 300000);
    if (window.Telegram?.WebApp?.initData) {
      userPost<{ currency: string; rubType: string; rubCard: string; rubPhone: string; rubBank: string; tonWallet: string }>('/api/profile', { action: 'me' })
        .then(p => { if (!active) return; if (p.currency === 'USD' || p.currency === 'GRAM' || p.currency === 'RUB') { setCurrency(p.currency); setWd(o => ({ ...o, cur: p.currency as Currency })); } applyProfile(p); }).catch(() => {});
    }
    return () => { active = false; window.clearInterval(timer); };
  }, [telegramUser?.id]);
  const rateOf = (c: Currency) => c === 'USD' ? rates?.usd : c === 'GRAM' ? rates?.gram : 1;
  const toRub = (amount: number, c: Currency) => { const r = rateOf(c); return r ? amount * r : NaN; };
  const fmtCur = (amount: number, c: Currency) => {
    const locale = lang === 'RU' ? 'ru-RU' : 'en-US';
    if (c === 'USD') return `$${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
    if (c === 'GRAM') return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(amount)} GRAM`;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)} ₽`;
  };
  // Все суммы хранятся в рублях; показываем в выбранной валюте по курсу.
  const money = (rub: number) => { const r = rateOf(currency); return currency === 'RUB' || !r ? fmtCur(rub, 'RUB') : fmtCur(rub / r, currency); };
  const changeCurrency = (c: Currency) => {
    setCurrency(c); setWd(o => ({ ...o, cur: c, result: 'idle' }));
    try { localStorage.setItem('playerok.currency', c); } catch { /* ignore */ }
    if (window.Telegram?.WebApp?.initData) userPost('/api/profile', { action: 'save', currency: c }).catch(() => {});
  };
  const saveReq = async (patch?: Partial<typeof reqForm>) => {
    const body = { ...reqForm, ...patch };
    try { const p = await userPost<Parameters<typeof applyProfile>[0]>('/api/profile', { action: 'save', ...body }); applyProfile(p); showToast(lang === 'RU' ? 'Реквизиты сохранены' : 'Details saved'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Error'); }
  };
  useEffect(() => {
    const rb = reqForm.rubBank;
    setWd(o => ({ ...o, req: wdMethod === 'card' ? reqForm.rubCard : wdMethod === 'sbp' ? reqForm.rubPhone : reqForm.tonWallet,
      bank: !rb ? o.bank : BANKS.includes(rb) ? rb : '__custom', custom: rb && !BANKS.includes(rb) ? rb : o.custom, result: 'idle' }));
  }, [wdMethod, reqForm]);
  const saveWdReq = () => {
    const bank = wd.bank === '__custom' ? wd.custom.trim() : wd.bank;
    void saveReq(wdMethod === 'card' ? { rubCard: wd.req, rubBank: bank } : wdMethod === 'sbp' ? { rubPhone: wd.req, rubType: 'phone', rubBank: bank } : { tonWallet: wd.req });
  };
  // История покупок/операций и актуальный юзернейм менеджера.
  useEffect(() => {
    let active = true;
    const initData = window.Telegram?.WebApp?.initData;
    const loadHistory = () => { if (!initData) return; fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me', initData }) }).then(r => r.ok ? r.json() : null).then(d => { if (active && d && Array.isArray(d.items)) setHistory(d.items); }).catch(() => {}); };
    const loadManager = () => fetch('/api/manager').then(r => r.ok ? r.json() : null).then(d => { if (active && d?.username) setManager({ username: d.username, url: `https://t.me/${d.username}` }); }).catch(() => {});
    loadHistory(); loadManager();
    const a = window.setInterval(loadHistory, 20000), b = window.setInterval(loadManager, 300000);
    return () => { active = false; window.clearInterval(a); window.clearInterval(b); };
  }, [telegramUser?.id]);
  useEffect(() => {
    if (splashVisible) return;
    const id = window.setTimeout(() => setSplashGone(true), 600);
    return () => window.clearTimeout(id);
  }, [splashVisible]);
  const dt = (ms: number) => new Date(ms).toLocaleString(lang === 'RU' ? 'ru-RU' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const opLabel = (type: string | null) => type === 'profit' ? (lang === 'RU' ? 'Прибыль с продаж' : 'Sales profit') : (lang === 'RU' ? 'Пополнение через менеджера' : 'Top-up via manager');
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'RU' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 }).format(n);
  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    let active = true;
    const load = () => fetch('/api/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me', initData }) })
      .then(r => r.ok ? r.json() : null).then(d => { if (active && d) setStats({ balance: Number(d.balance) || 0, spent: Number(d.spent) || 0, purchases: Number(d.purchases) || 0 }); }).catch(() => {});
    void load();
    const timer = window.setInterval(load, 20000);
    window.addEventListener('focus', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [telegramUser?.id]);
  const saveStats = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) { showToast(t.adminDenied); return; }
    try {
      await adminPost('/api/stats', { action: 'adjust', ...statsForm });
      setStatsForm(old => ({ ...old, balance: '', spent: '', purchases: '' }));
      showToast(t.statsDone);
    } catch (error) { showToast(error instanceof Error ? error.message : t.statsInvalid); }
  };
  const addReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) { showToast(t.adminDenied); return; }
    const username = reviewForm.username.trim();
    const text = reviewForm.text.trim();
    if (!username || !text || !Number.isInteger(reviewForm.rating) || reviewForm.rating < 1 || reviewForm.rating > 5) {
      showToast(t.invalidReview); return;
    }
    const item: ReviewItem = { id: `review-${Date.now()}`, username, rating: reviewForm.rating, text, createdAt: Number.isFinite(new Date(reviewForm.date).getTime()) ? new Date(reviewForm.date).getTime() : Date.now() };
    try {
      const result = await adminPost<{ item: ReviewItem }>('/api/reviews', { action: 'create', review: item });
      setReviews(old => [result.item, ...old.filter(review => review.id !== result.item.id)].sort((a, b) => b.createdAt - a.createdAt));
      setReviewForm({ username: '', rating: 5, text: '', date: nowLocal() });
      showToast(t.reviewAdded);
    } catch (error) { showToast(error instanceof Error ? error.message : t.invalidReview); }
  };
  const deleteReview = async (id: string) => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    try {
      await adminPost('/api/reviews', { action: 'delete', id });
      setReviews(old => old.filter(review => review.id !== id));
      showToast(t.reviewRemoved);
    } catch (error) { showToast(error instanceof Error ? error.message : t.adminDenied); }
  };
  const migrateLocalData = async () => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    try {
      const savedGifts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as GiftItem[];
      const savedReviews = JSON.parse(localStorage.getItem(REVIEWS_STORAGE_KEY) || '[]') as ReviewItem[];
      if (savedGifts.length) await adminPost('/api/catalog', { action: 'import', items: savedGifts });
      if (savedReviews.length) await adminPost('/api/reviews', { action: 'import', items: savedReviews });
      const [giftResult, reviewResult] = await Promise.all([
        apiGet<{ items: GiftItem[] }>('/api/catalog'), apiGet<{ items: ReviewItem[] }>('/api/reviews')
      ]);
      setCatalog(giftResult.items);
      setReviews(reviewResult.items);
      showToast(t.importDone);
    } catch (error) { showToast(error instanceof Error ? error.message : t.invalid); }
  };

  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const fullName = telegramUser ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') : '';
  const initials = fullName ? fullName.slice(0, 1).toUpperCase() : 'P';

  return <div className="app-shell" data-theme={theme}>
    <header className="topbar">
      <button className="brand" onClick={() => go('market')} aria-label="Playerok home">
        <img className="brand-symbol" src="/playerok-symbol.png" alt="Playerok" />
        <img className="brand-wordmark" src="/playerok-wordmark.png" alt="Playerok" />
      </button>
      <div className="header-actions">
        <a className="bot-link" href={botUrl} target="_blank" rel="noreferrer">@Playerok_Guarantor_Bot <ExternalLink size={12}/></a>
        <button className="theme-toggle" onClick={() => { themeManual.current = true; setTheme(theme === 'light' ? 'dark' : 'light'); }} aria-label={theme === 'light' ? t.dark : t.light} title={theme === 'light' ? t.dark : t.light}>
          {theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}
        </button>
        <div className="lang-wrap">
          <button className="lang-button" onClick={() => setLangOpen(!langOpen)}>{lang}<ChevronDown size={15}/></button>
          {langOpen && <div className="lang-menu">
            <button onClick={() => { setLang('EN'); setLangOpen(false); }}>English</button>
            <button onClick={() => { setLang('RU'); setLangOpen(false); }}>Русский</button>
          </div>}
        </div>
      </div>
    </header>

    <main className="main-content">
      {tab === 'games' && <section className="empty-hero panel">
        <div className="hero-icon"><Gamepad2 size={29}/></div>
        <span className="section-kicker">PLAYEROK</span>
        <h1>{t.games}</h1><p>{t.gamesSub}</p>
        <button className="primary-btn" onClick={() => go('market')}>{t.marketButton}</button>
      </section>}

      {tab === 'market' && <section className="market-page">
        <div className="market-hero panel">
          <div className="banner-art">
            <div className="banner-shine"/><div className="banner-caption"><small>PLAYEROK MARKET</small><strong>Buy <em>&</em><br/>Sell</strong><span>GIFTS · ITEMS · COLLECTIBLES</span></div>
            <div className="banner-gift">✦</div><span className="banner-star">✦</span>
          </div>
          <div className="market-heading">
            <div><span className="eyebrow">PLAYEROK MARKET</span><h1>{t.market}</h1><p>{t.marketSub}</p></div>
            <div className="gem-icon"><Gem size={22}/></div>
          </div>
          <div className="stats-grid">
            <div className="stat"><Activity/><small>{t.listed}</small><b>{catalog.length}</b></div>
            <div className="stat"><Gem/><small>{t.floor}</small><b>{catalog.length ? `#${Math.min(...catalog.map(g => g.number)).toLocaleString('en-US')}` : '—'}</b></div>
            <div className="stat"><TrendingUp/><small>{t.volume}</small><b>{new Set(catalog.map(g => g.collection)).size}</b></div>
          </div>
        </div>

        <div className="quick-actions">
          <button onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>{t.openNumbers}<ArrowUpRight size={15}/></button>
          <button onClick={() => { setQuery('Jelly Bunny'); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }}>{t.openDeals}<ArrowUpRight size={15}/></button>
        </div>

        <section className="catalog panel" id="catalog">
          <div className="catalog-title"><div><span className="eyebrow">COLLECTIBLES</span><h2>{lang === 'EN' ? 'Featured gifts' : 'Популярные подарки'}</h2></div><span className="count-pill">{filtered.length} {t.total}</span></div>
          <div className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}/>{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16}/></button>}</div>
          <div className="filter-bar"><button type="button" className={filtersOpen ? 'filter-toggle on' : 'filter-toggle'} onClick={() => setFiltersOpen(o => !o)}><SlidersHorizontal size={16}/>{lang === 'RU' ? 'Фильтры' : 'Filters'}{activeFilters > 0 && <b>{activeFilters}</b>}</button>{activeFilters > 0 && <button type="button" className="filter-reset" onClick={resetFilters}>{lang === 'RU' ? 'Сбросить' : 'Reset'}</button>}</div>
          {filtersOpen && <div className="filter-panel">
            <div className="f-group"><small>{lang === 'RU' ? 'Цена, ₽' : 'Price, ₽'}</small><div className="f-row"><input type="number" inputMode="decimal" min="0" placeholder={lang === 'RU' ? 'от' : 'from'} value={fMin} onChange={e => setFMin(e.target.value)}/><input type="number" inputMode="decimal" min="0" placeholder={lang === 'RU' ? 'до' : 'to'} value={fMax} onChange={e => setFMax(e.target.value)}/></div></div>
            <div className="f-group"><small>{lang === 'RU' ? 'По цене' : 'By price'}</small><div className="chips"><button type="button" className={sort === 'cheap' ? 'on' : ''} onClick={() => setSort(sort === 'cheap' ? 'featured' : 'cheap')}>{lang === 'RU' ? 'Сначала дешёвые' : 'Cheapest first'}</button><button type="button" className={sort === 'expensive' ? 'on' : ''} onClick={() => setSort(sort === 'expensive' ? 'featured' : 'expensive')}>{lang === 'RU' ? 'Сначала дорогие' : 'Priciest first'}</button></div></div>
            <div className="f-group"><small>{lang === 'RU' ? 'Редкость (по самому редкому признаку)' : 'Rarity (rarest trait)'}</small><div className="chips">{[0, 1, 3, 10].map(v => <button type="button" key={v} className={fRarity === v ? 'on' : ''} onClick={() => setFRarity(v)}>{v === 0 ? (lang === 'RU' ? 'Любая' : 'Any') : `≤ ${v}%`}</button>)}</div></div>
            <div className="chips"><button type="button" className={fOnSale ? 'on' : ''} onClick={() => setFOnSale(v => !v)}>{lang === 'RU' ? 'Только в продаже' : 'For sale only'}</button></div>
          </div>}
          <div className="sort-tabs">
            <button className={sort === 'featured' ? 'active' : ''} onClick={() => setSort('featured')}>{t.featured}</button>
            <button className={sort === 'low' ? 'active' : ''} onClick={() => setSort('low')}>{t.low}</button>
            <button className={sort === 'high' ? 'active' : ''} onClick={() => setSort('high')}>{t.high}</button>
          </div>
          <div className="gift-grid">
            {filtered.map(g => <article className="gift-card" key={g.id} role="button" tabIndex={0} onClick={() => openGift(g.source)} onKeyDown={e => { if (e.key === 'Enter') openGift(g.source); }}>
              <div className="gift-art"><img src={g.image} alt={`${g.collection} #${g.number}`} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('image-error'); }}/>
                <span className="serial-ribbon">#{g.number.toLocaleString('en-US')}</span>
              </div>
              <div className="gift-info">
                <div className="gift-title-row"><div className="gift-name">{g.collection}</div><span className="gift-number">#{g.number.toLocaleString('en-US')}</span></div>
                <div className="attribute-list">
                  <div className="attribute"><small>{t.model}</small><b>{g.model}</b><em>{g.modelRarity}</em></div>
                  <div className="attribute"><small>{t.backdrop}</small><b><i className={`backdrop-dot ${g.backdrop.toLowerCase().replace(/ /g, '-')}`}/>{g.backdrop}</b><em>{g.backdropRarity}</em></div>
                  <div className="attribute"><small>{t.symbol}</small><b>{g.symbol}</b><em>{g.symbolRarity}</em></div>
                </div>
                <div className="gift-card-bottom"><a href={g.source} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); e.stopPropagation(); openGift(g.source); }}>{t.openNft} <ExternalLink size={12}/></a><div className="gift-card-actions">{g.price != null ? <button type="button" className="buy-btn" onClick={e => { e.stopPropagation(); buyNow(g); }}><ShoppingBag size={14}/>{money(g.price)}</button> : <span className="unavailable"><ShoppingBag size={14}/>{t.unavailable}</span>}<button type="button" className="share-btn" aria-label={lang === 'RU' ? 'Поделиться' : 'Share'} title={lang === 'RU' ? 'Поделиться' : 'Share'} onClick={e => { e.stopPropagation(); shareGift(g); }}><Share2 size={15}/></button></div></div>
              </div>
            </article>)}
          </div>
          {filtered.length === 0 && <div className="no-results">{lang === 'EN' ? 'Nothing found' : 'Ничего не найдено'}</div>}
        </section>
      </section>}

      {tab === 'gifts' && <section className="my-page">
        <div className="page-heading panel"><div><span className="eyebrow">PLAYEROK ACCOUNT</span><h1>{t.my}</h1><p>{t.mySub}</p></div><div className="heading-icon"><LockKeyhole size={22}/></div></div>
        <div className="subtabs">
          <button className={sub === 'gifts' ? 'selected' : ''} onClick={() => setSub('gifts')}>{lang === 'EN' ? 'Gifts' : 'Подарки'}</button>
          <button className={sub === 'offers' ? 'selected' : ''} onClick={() => setSub('offers')}>{t.offers}</button>
          <button className={sub === 'history' ? 'selected' : ''} onClick={() => setSub('history')}>{t.history}</button>
        </div>
        {sub === 'gifts' ? <>
          <div className="deposit panel">
            <div className="deposit-ico"><Gift size={20}/></div>
            <div><b>{lang === 'RU' ? 'Пополнить подарки' : 'Deposit gifts'}</b><p>{lang === 'RU' ? `Отправьте подарок на @${manager.username}. После проверки он появится здесь, и вы сможете выставить его на продажу.` : `Send the gift to @${manager.username}. After a check it will appear here and you can list it for sale.`}</p></div>
            <a className="primary-btn" href={manager.url} target="_blank" rel="noreferrer"><UserRound size={16}/>{lang === 'RU' ? 'Отправить подарок' : 'Send a gift'} @{manager.username}</a>
          </div>
          {myGifts.length === 0 ? <div className="personal-empty panel"><div className="personal-empty-icon"><Gift size={23}/></div><h3>{t.noPersonalGifts}</h3></div> : <div className="mg-grid">{myGifts.map(g => <article className="mg-card" key={g.id}>
            <button type="button" className="mg-art" onClick={() => openGift(g.source)}><img src={g.image} alt={`${g.collection} #${g.number}`} loading="lazy"/>{g.price != null && <span className="mg-badge">{lang === 'RU' ? 'В продаже' : 'For sale'} · {money(g.price)}</span>}</button>
            <div className="mg-info"><b>{g.collection} #{g.number}</b><small>{g.model} · {g.backdrop}</small></div>
            {sell?.id === g.id ? <div className="mg-sell"><input type="number" inputMode="decimal" min="0" autoFocus value={sell.price} onChange={e => setSell({ id: g.id, price: e.target.value })} placeholder={lang === 'RU' ? 'Цена, ₽' : 'Price, ₽'}/><button type="button" className="buy-btn" onClick={() => listMine(g.id)}>{lang === 'RU' ? 'Выставить' : 'List'}</button><button type="button" className="mg-x" aria-label="Cancel" onClick={() => setSell(null)}><X size={15}/></button></div>
              : <div className="mg-actions"><button type="button" className="buy-btn" onClick={() => setSell({ id: g.id, price: g.price != null ? String(g.price) : '' })}>{g.price != null ? (lang === 'RU' ? 'Изменить цену' : 'Change price') : (lang === 'RU' ? 'Выставить на продажу' : 'List for sale')}</button>{g.price != null && <button type="button" className="mg-ghost" onClick={() => unlistMine(g.id)}>{lang === 'RU' ? 'Снять' : 'Remove'}</button>}</div>}
          </article>)}</div>}
        </> : <div className="personal-empty panel">
          <div className="personal-empty-icon"><Gift size={23}/></div>
          <h3>{sub === 'offers' ? t.noOffers : t.noHistory}</h3>
        </div>}
      </section>}

      {tab === 'reviews' && <section className="reviews-page">
        <div className="page-heading panel"><div><span className="eyebrow">PLAYEROK COMMUNITY</span><h1>{t.reviews}</h1><p>{t.reviewsSub}</p></div><div className="heading-icon"><MessageSquare size={22}/></div></div>
        <div className="reviews-summary panel">
          <div className="review-score"><strong>{reviews.length ? averageRating.toFixed(1) : '—'}</strong><div><div className="review-stars">{[1,2,3,4,5].map(star => <Star key={star} size={16} fill={star <= Math.round(averageRating) ? 'currentColor' : 'none'}/>)}</div><small>{reviews.length} {t.reviewCount.toLowerCase()}</small></div></div>
          <div className="review-summary-label">{t.averageRating}</div>
        </div>
        {databaseError && <div className="admin-notice"><Globe2 size={17}/><span>{t.databaseUnavailable}</span></div>}
        {reviews.length ? <div className="reviews-list">{reviews.map(review => <article className="review-card panel" key={review.id}>
          <div className="review-card-head"><div className="review-avatar">{review.username.trim().slice(0,1).toUpperCase()}</div><div className="review-author"><b>{review.username}</b><small>{new Date(review.createdAt).toLocaleDateString(lang === 'RU' ? 'ru-RU' : 'en-US')}</small></div><div className="review-card-stars" aria-label={`${review.rating} / 5`}>{[1,2,3,4,5].map(star => <Star key={star} size={14} fill={star <= review.rating ? 'currentColor' : 'none'}/>)}</div></div>
          <p>{review.text}</p>
        </article>)}</div> : <div className="reviews-empty panel"><div className="reviews-empty-icon"><MessageSquare size={24}/></div><h3>{t.noReviews}</h3><p>{t.noReviewsSub}</p></div>}
      </section>}

      {tab === 'event' && <section className="empty-hero panel"><div className="hero-icon"><Sparkles size={29}/></div><span className="section-kicker">PLAYEROK EVENTS</span><h1>{t.event}</h1><p>{t.eventSub}</p><button className="primary-btn" disabled>{t.unavailable}</button></section>}

      {tab === 'profile' && <section className="profile-page">
        <div className="profile-card panel">
          <div className="profile-head"><div><span className="eyebrow">{t.account}</span><h1>{t.profile}</h1></div><div className="head-right">{isAdmin && <button className="admin-mini" aria-label={t.admin} title={t.admin} onClick={() => go('admin')}><ShieldCheck size={16}/></button>}<div className="heading-icon"><Wallet size={22}/></div></div></div>
          {telegramUser ? <>
            <div className="telegram-status connected"><CheckCircle2 size={15}/>{t.connected}</div>
            <div className="user-row">
              {telegramUser.photo_url ? <img className="avatar avatar-photo" src={telegramUser.photo_url} alt={t.photo} referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }}/>
                : <div className="avatar">{initials}</div>}
              <div className="user-data"><h2>{fullName || telegramUser.username || `ID ${telegramUser.id}`}</h2><b>{telegramUser.username ? `@${telegramUser.username}` : (lang === 'EN' ? 'Username not set' : 'Имя пользователя не задано')}</b><small>TELEGRAM ID&nbsp; {telegramUser.id}</small></div>
            </div>
            <div className="profile-stats">
              <div><small>{t.balance}</small><b>{money(stats.balance)}</b></div><div><small>{t.spent}</small><b>{money(stats.spent)}</b></div>
              <div><small>{t.purchases}</small><b>{fmt(stats.purchases)}</b></div>
              <div className="language-stat"><small>{t.language}</small><button onClick={() => setLang(lang === 'EN' ? 'RU' : 'EN')}>{lang}<ChevronDown size={15}/></button></div>
            </div>
            {telegramUser.is_premium && <div className="premium-chip"><Gem size={14}/>{t.premium}</div>}
          </> : <div className="telegram-connect">
            <div className="connect-icon"><UserRoundCheck size={26}/></div><h3>{t.notConnected}</h3><p>{t.telegramConnect}</p><a className="primary-btn connect-button" href={botUrl} target="_blank" rel="noreferrer">{t.connect} <ExternalLink size={14}/></a>
          </div>}
          <div className="cur-card"><small>{lang === 'RU' ? 'Валюта' : 'Currency'}</small><div className="chips">{(['RUB', 'USD', 'GRAM'] as Currency[]).map(c => <button key={c} type="button" className={currency === c ? 'on' : ''} onClick={() => changeCurrency(c)}>{c === 'RUB' ? '₽ RUB' : c === 'USD' ? '$ USD' : 'GRAM'}</button>)}</div>{rates && <p className="cur-rate">1 USD = {fmt(rates.usd)} ₽ · 1 GRAM = {fmt(rates.gram)} ₽</p>}</div>
          <div className="req-card">
            <h3>{lang === 'RU' ? 'Реквизиты' : 'Payout details'}</h3>
            <p className="cur-rate">{lang === 'RU' ? 'Общие для бота и сайта: сохраните один раз.' : 'Shared by the bot and the app: save once.'}</p>
            <label>{lang === 'RU' ? 'Банковская карта' : 'Bank card'}<input inputMode="numeric" value={reqForm.rubCard} onChange={e => setReqForm(o => ({ ...o, rubCard: e.target.value }))} placeholder="2200 0000 0000 0000"/></label>
            <label>{lang === 'RU' ? 'Номер телефона (СБП)' : 'Phone number (SBP)'}<input inputMode="tel" value={reqForm.rubPhone} onChange={e => setReqForm(o => ({ ...o, rubPhone: e.target.value }))} placeholder="+7 900 000-00-00"/></label>
            <label>{lang === 'RU' ? 'Банк' : 'Bank'}<select value={bankCustom ? '__custom' : reqForm.rubBank} onChange={e => { if (e.target.value === '__custom') { setBankCustom(true); setReqForm(o => ({ ...o, rubBank: BANKS.includes(o.rubBank) ? '' : o.rubBank })); } else { setBankCustom(false); setReqForm(o => ({ ...o, rubBank: e.target.value })); } }}><option value="">—</option>{BANKS.map(b => <option key={b} value={b}>{b}</option>)}<option value="__custom">{lang === 'RU' ? 'Другой банк…' : 'Other bank…'}</option></select></label>
            {bankCustom && <label>{lang === 'RU' ? 'Название банка' : 'Bank name'}<input maxLength={40} value={reqForm.rubBank} onChange={e => setReqForm(o => ({ ...o, rubBank: e.target.value }))}/></label>}
            <label>{lang === 'RU' ? 'TON-адрес (GRAM)' : 'TON address (GRAM)'}<input value={reqForm.tonWallet} onChange={e => setReqForm(o => ({ ...o, tonWallet: e.target.value.trim() }))} placeholder="UQ…"/></label>
            <button type="button" className="primary-btn" onClick={() => saveReq()}>{lang === 'RU' ? 'Сохранить реквизиты' : 'Save details'}</button>
          </div>
          <div className="fx-card">
            <label className="fx-row"><span>{lang === 'RU' ? 'Вибрация' : 'Haptics'}</span><input type="checkbox" checked={fx.haptics} onChange={e => setFx(o => ({ ...o, haptics: e.target.checked }))}/><i/></label>
            <label className="fx-row"><span>{lang === 'RU' ? 'Звуки' : 'Sounds'}</span><input type="checkbox" checked={fx.sounds} onChange={e => setFx(o => ({ ...o, sounds: e.target.checked }))}/><i/></label>
          </div>
          <div className="hist"><h3>{lang === 'RU' ? 'История покупок' : 'Purchase history'}</h3>{history.some(h => h.kind === 'purchase') ? <ul className="hist-list">{history.filter(h => h.kind === 'purchase').map(h => <li key={h.id}><button type="button" className="hist-row" onClick={() => h.link && openGift(h.link)}><span className="hist-ico"><Gift size={16}/></span><span className="hist-main"><b>{h.title}</b><small>{dt(h.createdAt)}</small></span><span className="hist-amt">{money(h.amount)}</span></button></li>)}</ul> : <p>{lang === 'RU' ? 'Покупок пока нет.' : 'No purchases yet.'}</p>}</div>
          <div className="hist"><h3>{lang === 'RU' ? 'История операций' : 'Transaction history'}</h3>{history.some(h => h.kind === 'operation') ? <ul className="hist-list">{history.filter(h => h.kind === 'operation').map(h => <li key={h.id}><div className="hist-row"><span className={h.opType === 'profit' ? 'hist-ico profit' : 'hist-ico'}>{h.opType === 'profit' ? <TrendingUp size={16}/> : <Wallet size={16}/>}</span><span className="hist-main"><b>{opLabel(h.opType)}</b><small>{dt(h.createdAt)}</small></span><span className="hist-amt plus">+{money(h.amount)}</span></div></li>)}</ul> : <p>{lang === 'RU' ? 'Операций пока нет.' : 'No transactions yet.'}</p>}</div>
          <div className="wd-card">
            <div className="wd-head"><div><span className="wd-kicker">{lang === 'RU' ? 'ВЫВОД СРЕДСТВ' : 'WITHDRAWAL'}</span><h3>{lang === 'RU' ? 'Вывести средства' : 'Withdraw funds'}</h3><small>{lang === 'RU' ? 'Обработка до 48 часов' : 'Processed within 48 hours'}</small></div><div className="wd-icon"><Banknote size={20}/></div></div>
            <div className="wd-tabs three">
              <button type="button" className={wdMethod === 'card' ? 'on' : ''} onClick={() => setWdMethod('card')}><CreditCard size={14}/>{lang === 'RU' ? 'Карта' : 'Card'}</button>
              <button type="button" className={wdMethod === 'sbp' ? 'on' : ''} onClick={() => setWdMethod('sbp')}><Phone size={14}/>{lang === 'RU' ? 'СБП' : 'SBP'}</button>
              <button type="button" className={wdMethod === 'ton' ? 'on' : ''} onClick={() => setWdMethod('ton')}><Gem size={14}/>TON</button>
            </div>
            {wdMethod !== 'ton' && <select className="wd-field" value={wd.bank} onChange={e => setWd(o => ({ ...o, bank: e.target.value }))}>{BANKS.map(b => <option key={b} value={b}>{b}</option>)}<option value="__custom">{lang === 'RU' ? 'Другой банк…' : 'Other bank…'}</option></select>}
            {wdMethod !== 'ton' && wd.bank === '__custom' && <input className="wd-field" maxLength={40} value={wd.custom} onChange={e => setWd(o => ({ ...o, custom: e.target.value }))} placeholder={lang === 'RU' ? 'Название банка' : 'Bank name'}/>}
            <input className="wd-field" inputMode={wdMethod === 'ton' ? 'text' : 'numeric'} value={wd.req} onChange={e => setWd(o => ({ ...o, req: e.target.value, result: 'idle' }))} placeholder={wdMethod === 'card' ? (lang === 'RU' ? 'Номер карты' : 'Card number') : wdMethod === 'sbp' ? (lang === 'RU' ? 'Номер телефона для СБП' : 'Phone number for SBP') : (lang === 'RU' ? 'Адрес TON-кошелька' : 'TON wallet address')}/>
            <div className="chips wd-cur">{(['RUB', 'USD', 'GRAM'] as Currency[]).map(c => <button type="button" key={c} className={wd.cur === c ? 'on' : ''} onClick={() => setWd(o => ({ ...o, cur: c, amount: '', result: 'idle' }))}>{c === 'RUB' ? '₽ RUB' : c === 'USD' ? '$ USD' : 'GRAM'}</button>)}</div>
            <div className="wd-row"><input className="wd-field" type="number" inputMode="decimal" min="0" value={wd.amount} onChange={e => setWd(o => ({ ...o, amount: e.target.value, result: 'idle' }))} placeholder={lang === 'RU' ? 'Сумма' : 'Amount'}/><button type="button" className="wd-all" onClick={() => { const r = rateOf(wd.cur); if (r) { const d = wd.cur === 'GRAM' ? 1000 : 100; setWd(o => ({ ...o, amount: String(Math.floor(stats.balance / r * d) / d), result: 'idle' })); } }}>{lang === 'RU' ? 'ВСЁ' : 'MAX'}</button></div>
            <div className="wd-receive"><div><small>{lang === 'RU' ? 'ВЫ ПОЛУЧИТЕ' : 'YOU RECEIVE'}</small><b>{fmtCur(Number(wd.amount.replace(',', '.')) || 0, wd.cur)}</b></div><span className="wd-refresh"><RefreshCw size={16}/></span></div>
            {rates && wd.cur !== 'RUB' && <p className="wd-note">1 {wd.cur} = {fmt(wd.cur === 'USD' ? rates.usd : rates.gram)} ₽</p>}
            <button type="button" className="admin-ghost" onClick={saveWdReq}>{lang === 'RU' ? 'Сохранить в реквизиты' : 'Save to my details'}</button>
            <button type="button" className="wd-submit" onClick={submitWithdraw}><Banknote size={16}/>{lang === 'RU' ? 'Вывести' : 'Withdraw'}</button>
            {wd.result === 'low' && <div className="wd-result low">{lang === 'RU' ? `Недостаточно средств на балансе. Ваш баланс: ${money(stats.balance)}.` : `Insufficient balance. Your balance: ${money(stats.balance)}.`}</div>}
            {wd.result === 'ok' && <div className="wd-result ok">{lang === 'RU' ? 'Вывод будет выполнен в течение 48 часов. Для оформления обратитесь к менеджеру: ' : 'Your withdrawal will be completed within 48 hours. To proceed, contact the manager: '}<a href={manager.url} target="_blank" rel="noreferrer">@{manager.username}</a></div>}
            <p className="wd-note">{lang === 'RU' ? 'Вывод обрабатывается до 48 часов после обращения к менеджеру. Выплата по курсу CoinGecko.' : 'Withdrawals are processed within 48 hours after contacting the manager. Payout at the CoinGecko rate.'}</p>
          </div>
          <a className="bot-card-link" href={botUrl} target="_blank" rel="noreferrer"><span className="bot-avatar"><ShieldCheck size={19}/></span><span><b>@Playerok_Guarantor_Bot</b><small>{t.bot}</small></span><ExternalLink size={15}/></a>
        </div>
      </section>}

      {tab === 'admin' && isAdmin && <section className="admin-page">
        <div className="admin-header"><button className="back-button" onClick={() => go('profile')}><ArrowLeft size={17}/>{t.back}</button><div className="admin-title"><div><span className="eyebrow">PLAYEROK</span><h1>{t.adminTitle}</h1><p>{t.adminSub}</p></div><div className="heading-icon"><ShieldCheck size={22}/></div></div></div>
        <div className="admin-notice"><Globe2 size={17}/><span>{databaseReady ? t.localOnly : `${t.databaseUnavailable} ${databaseError}`}</span></div>
        <div className="admin-tools"><button type="button" onClick={migrateLocalData}><Upload size={15}/>{t.importLocal}</button></div>
        <section className="admin-form panel">
          <h2><Gift size={19}/>{lang === 'RU' ? 'Добавить пачкой' : 'Bulk add gifts'}</h2>
          <label>{lang === 'RU' ? 'Ссылки на подарки, цена в ₽ через пробел после ссылки (по одной на строку, до 25 за раз)' : 'Gift links with the ₽ price after a space (one per line, up to 25 at a time)'}<textarea rows={5} value={batchText} onChange={e => setBatchText(e.target.value)} placeholder={'https://t.me/nft/MoodPack-112928 1900\nhttps://t.me/nft/IceCream-145403 780'}/></label>
          <label>{lang === 'RU' ? 'Цена для строк без цены, ₽ (необязательно)' : 'Price for lines without one, ₽ (optional)'}<input type="number" min="0" step="any" value={batchPrice} onChange={e => setBatchPrice(e.target.value)} placeholder="1500"/></label>
          <button className="primary-btn admin-submit" type="button" disabled={batchBusy || !batchText.trim()} onClick={addBatch}><Plus size={17}/>{batchBusy ? (lang === 'RU' ? 'Загружаю…' : 'Loading…') : (lang === 'RU' ? 'Добавить все' : 'Add all')}</button>
          {batchReport && <p className="admin-hint" style={{ whiteSpace: 'pre-line' }}>{batchReport}</p>}
        </section>
        <form className="admin-form panel" onSubmit={addGift}>
          <h2><Plus size={19}/>{t.addGift}</h2>
          <label>{t.nftUrl}<input type="url" value={giftForm.source} onChange={e => updateGiftSource(e.target.value)} placeholder="https://t.me/nft/JellyBunny-12779"/><small className="admin-hint">{t.imageHint}</small></label>
          <label>{t.collectionName}<input required value={giftForm.collection} onChange={e => updateForm('collection', e.target.value)} placeholder="Jelly Bunny"/></label>
          <label>{t.number}<input required type="number" min="1" step="1" value={giftForm.number} onChange={e => updateForm('number', e.target.value)} placeholder="12779"/></label>
          <div className="admin-field-row"><label>{t.model}<input required value={giftForm.model} onChange={e => updateForm('model', e.target.value)} placeholder="Spring Day"/></label><label>{t.modelRarity}<input value={giftForm.modelRarity} onChange={e => updateForm('modelRarity', e.target.value)} placeholder="0.4%"/></label></div>
          <div className="admin-field-row"><label>{t.background}<input required value={giftForm.backdrop} onChange={e => updateForm('backdrop', e.target.value)} placeholder="Electric Purple"/></label><label>{t.backgroundRarity}<input value={giftForm.backdropRarity} onChange={e => updateForm('backdropRarity', e.target.value)} placeholder="0.83%"/></label></div>
          <div className="admin-field-row"><label>{t.pattern}<input required value={giftForm.symbol} onChange={e => updateForm('symbol', e.target.value)} placeholder="Spider Web"/></label><label>{t.patternRarity}<input value={giftForm.symbolRarity} onChange={e => updateForm('symbolRarity', e.target.value)} placeholder="0.55%"/></label></div>
          <label>{lang === 'RU' ? 'Цена в рублях (необязательно)' : 'Price in rubles (optional)'}<input type="number" min="0" step="any" value={giftForm.price} onChange={e => updateForm('price', e.target.value)} placeholder="1500"/></label>
          <details className="admin-advanced"><summary>{lang === 'RU' ? 'Дополнительные настройки изображения' : 'Advanced image settings'}</summary><label>{t.imageUrl}<input type="url" value={giftForm.image} onChange={e => updateForm('image', e.target.value)} placeholder="https://.../gift.webp"/></label></details>
          {giftForm.image && <div className="admin-image-preview"><small>{t.imagePreview}</small><img src={giftForm.image} alt="Gift preview" onError={e => { e.currentTarget.style.opacity = '0.25'; }}/></div>}
          <button className="primary-btn admin-submit" type="submit"><Plus size={17}/>{t.saveGift}</button>
        </form>
        <section className="admin-list panel">
          <div className="admin-list-title"><h2>{t.catalogList}</h2><span className="count-pill">{catalog.length}</span></div>
          <div className="admin-tools"><button onClick={exportCatalog}><Upload size={15}/>Export JSON</button><label className="import-button"><ImagePlus size={15}/>Import JSON<input type="file" accept="application/json,.json" onChange={e => { importCatalog(e.target.files?.[0]); e.currentTarget.value = ''; }}/></label></div>
          {catalog.map(g => <div className="admin-gift-row" key={g.id}><img src={g.image} alt=""/><span><b>{g.collection} #{g.number}</b><small>{g.model} · {g.backdrop} · {g.symbol}</small><span className="price-edit"><input type="number" min="0" step="any" placeholder={lang === 'RU' ? 'Цена ₽' : 'Price ₽'} value={priceEdits[g.id] ?? (g.price ?? '')} onChange={e => setPriceEdits(old => ({ ...old, [g.id]: e.target.value }))}/><button type="button" aria-label="Save price" onClick={() => savePrice(g.id)}><CheckCircle2 size={15}/></button></span></span><button aria-label={`${t.delete} ${g.collection} ${g.number}`} onClick={() => deleteGift(g.id)}><Trash2 size={16}/></button></div>)}
        </section>
        <section className="admin-form panel">
          <h2><Activity size={19}/>{lang === 'RU' ? 'Сводка' : 'Overview'}</h2>
          {summary ? <div className="adm-grid">{([
            [lang === 'RU' ? 'Пользователей' : 'Users', summary.users], [lang === 'RU' ? 'Новых сегодня' : 'New today', summary.newToday], [lang === 'RU' ? 'За 7 дней' : 'Last 7 days', summary.newWeek], [lang === 'RU' ? 'Устройств' : 'Devices', summary.devices],
            [lang === 'RU' ? 'Подарков в маркете' : 'Market gifts', summary.marketGifts], [lang === 'RU' ? 'В продаже' : 'For sale', summary.forSale], [lang === 'RU' ? 'От пользователей' : 'By users', summary.userListed], [lang === 'RU' ? 'Зачислено' : 'Credited', summary.credited],
            [lang === 'RU' ? 'Отзывов' : 'Reviews', summary.reviews], [lang === 'RU' ? 'Записей истории' : 'History rows', summary.history], [lang === 'RU' ? 'Сумма балансов' : 'Total balance', `${fmt(summary.totalBalance)} ₽`], [lang === 'RU' ? 'Потрачено всего' : 'Total spent', `${fmt(summary.totalSpent)} ₽`]
          ] as [string, string | number][]).map(([k, v]) => <div key={k}><small>{k}</small><b>{typeof v === 'number' ? fmt(v) : v}</b></div>)}</div> : <p className="admin-hint">…</p>}
          <button type="button" className="admin-ghost" onClick={() => adminPost<Record<string, number>>('/api/admin-stats', { action: 'summary' }).then(setSummary).catch(() => {})}>{lang === 'RU' ? 'Обновить' : 'Refresh'}</button>
        </section>
        <section className="admin-form panel">
          <h2><UserRound size={19}/>{lang === 'RU' ? 'Карточка пользователя' : 'User card'}</h2>
          <label>{t.userId}<input inputMode="numeric" value={cardId} onChange={e => setCardId(e.target.value.trim())} placeholder="123456789"/></label>
          <button type="button" className="primary-btn admin-submit" onClick={findUser}><Search size={17}/>{lang === 'RU' ? 'Найти' : 'Find'}</button>
          {userCard && <div className="adm-grid">{([
            [lang === 'RU' ? 'Баланс' : 'Balance', `${fmt(Number(userCard.balance))} ₽`], [lang === 'RU' ? 'Потрачено' : 'Spent', `${fmt(Number(userCard.spent))} ₽`], [lang === 'RU' ? 'Покупок' : 'Purchases', fmt(Number(userCard.purchases))], [lang === 'RU' ? 'Устройств' : 'Devices', fmt(Number(userCard.devices))],
            [lang === 'RU' ? 'Подарков' : 'Gifts', fmt(Number(userCard.gifts))], [lang === 'RU' ? 'В продаже' : 'Listed', fmt(Number(userCard.listed))], [lang === 'RU' ? 'Записей истории' : 'History rows', fmt(Number(userCard.history))], [lang === 'RU' ? 'Устройство' : 'Device', String(userCard.lastDevice || '—')]
          ] as [string, string][]).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>}
          {userCard && <p className="admin-hint">{lang === 'RU' ? 'ID подставлен во все формы ниже.' : 'ID was filled into the forms below.'}</p>}
        </section>
        <form className="admin-form panel review-admin-form" onSubmit={addUserGifts}>
          <h2><Gift size={19}/>{lang === 'RU' ? 'Зачислить подарок пользователю' : 'Credit a gift to a user'}</h2>
          <label>{t.userId}<input required inputMode="numeric" pattern="[0-9]{1,15}" value={ugForm.telegramId} onChange={e => setUgForm(old => ({ ...old, telegramId: e.target.value.trim() }))} placeholder="123456789"/></label>
          <label>{lang === 'RU' ? 'Ссылки на подарки (по одной на строку, до 10)' : 'Gift links (one per line, up to 10)'}<textarea rows={3} required value={ugForm.links} onChange={e => setUgForm(old => ({ ...old, links: e.target.value }))} placeholder="https://t.me/nft/MoodPack-112928"/></label>
          <button className="primary-btn admin-submit" type="submit"><Plus size={17}/>{lang === 'RU' ? 'Зачислить' : 'Credit'}</button>
          {ugList.map(g => <div className="admin-hist-row" key={g.id}><span><b>{g.collection} #{g.number}</b><small>{g.price != null ? `${fmt(g.price)} ₽` : (lang === 'RU' ? 'не в продаже' : 'not for sale')}</small></span><button type="button" aria-label="Delete" onClick={() => removeUserGift(g.id)}><Trash2 size={15}/></button></div>)}
        </form>
        <form className="admin-form panel review-admin-form" onSubmit={saveHistory}>
          <h2><ShoppingBag size={19}/>{lang === 'RU' ? 'История пользователя' : 'User history'}</h2>
          <label>{t.userId}<input required inputMode="numeric" pattern="[0-9]{1,15}" value={histForm.telegramId} onChange={e => setHistForm(old => ({ ...old, telegramId: e.target.value.trim() }))} placeholder="123456789"/></label>
          <div className="admin-rating-field"><div className="admin-rating-picker">{(['purchase', 'topup', 'profit'] as const).map(m => <button key={m} type="button" className={histForm.type === m ? 'rating-star selected' : 'rating-star'} style={{ width: 'auto', padding: '0 12px' }} onClick={() => setHistForm(old => ({ ...old, type: m }))}>{m === 'purchase' ? (lang === 'RU' ? 'Покупка' : 'Purchase') : m === 'topup' ? (lang === 'RU' ? 'Пополнение' : 'Top-up') : (lang === 'RU' ? 'Прибыль' : 'Profit')}</button>)}</div></div>
          {histForm.type === 'purchase' && <label>{lang === 'RU' ? 'Ссылка на NFT' : 'NFT link'}<input required value={histForm.link} onChange={e => setHistForm(old => ({ ...old, link: e.target.value }))} placeholder="https://t.me/nft/MoodPack-112928"/></label>}
          <label>{lang === 'RU' ? 'Сумма, ₽' : 'Amount, ₽'}<input required type="number" step="any" min="0" value={histForm.amount} onChange={e => setHistForm(old => ({ ...old, amount: e.target.value }))} placeholder="1900"/></label>
          <label>{t.reviewDate}<input type="datetime-local" required value={histForm.date} onChange={e => setHistForm(old => ({ ...old, date: e.target.value }))}/></label>
          <button className="primary-btn admin-submit" type="submit"><Plus size={17}/>{lang === 'RU' ? 'Добавить запись' : 'Add entry'}</button>
          <button type="button" className="admin-ghost" onClick={loadAdminHist}>{lang === 'RU' ? 'Показать записи этого ID' : 'Show entries for this ID'}</button>
          {adminHist.map(h => <div className="admin-hist-row" key={h.id}><span><b>{h.title}</b><small>{h.kind === 'operation' ? opLabel(h.opType) + ' · ' : ''}{fmt(h.amount)} ₽ · {dt(h.createdAt)}</small></span><button type="button" aria-label="Delete" onClick={() => deleteHistory(h.id)}><Trash2 size={15}/></button></div>)}
        </form>
        <form className="admin-form panel review-admin-form" onSubmit={saveStats}>
          <h2><Wallet size={19}/>{t.statsTitle}</h2>
          <label>{t.userId}<input required inputMode="numeric" pattern="[0-9]{1,15}" value={statsForm.telegramId} onChange={e => setStatsForm(old => ({ ...old, telegramId: e.target.value.trim() }))} placeholder="123456789"/></label>
          <div className="admin-rating-field"><div className="admin-rating-picker">{(['add', 'set'] as const).map(m => <button key={m} type="button" className={statsForm.mode === m ? 'rating-star selected' : 'rating-star'} style={{ width: 'auto', padding: '0 14px' }} onClick={() => setStatsForm(old => ({ ...old, mode: m }))}>{m === 'add' ? t.modeAdd : t.modeSet}</button>)}</div></div>
          <div className="admin-field-row">
            <label>{t.balance}<input type="number" step="any" value={statsForm.balance} onChange={e => setStatsForm(old => ({ ...old, balance: e.target.value }))} placeholder="0"/></label>
            <label>{t.spent}<input type="number" step="any" value={statsForm.spent} onChange={e => setStatsForm(old => ({ ...old, spent: e.target.value }))} placeholder="0"/></label>
            <label>{t.purchases}<input type="number" step="1" value={statsForm.purchases} onChange={e => setStatsForm(old => ({ ...old, purchases: e.target.value }))} placeholder="0"/></label>
          </div>
          <button className="primary-btn admin-submit" type="submit"><Plus size={17}/>{t.statsSave}</button>
        </form>
        <form className="admin-form panel review-admin-form" onSubmit={addReview}>
          <h2><MessageSquare size={19}/>{t.addReview}</h2>
          <label>{t.reviewUsername}<input required maxLength={40} value={reviewForm.username} onChange={e => setReviewForm(old => ({ ...old, username: e.target.value }))} placeholder={lang === 'RU' ? 'Например, Alex' : 'For example, Alex'}/></label>
          <div className="admin-rating-field"><span>{t.reviewRating}</span><div className="admin-rating-picker" role="radiogroup" aria-label={t.reviewRating}>{[1,2,3,4,5].map(star => <button key={star} type="button" role="radio" aria-checked={reviewForm.rating === star} aria-label={`${star} / 5`} className={star <= reviewForm.rating ? 'rating-star selected' : 'rating-star'} onClick={() => setReviewForm(old => ({ ...old, rating: star }))}><Star size={25} fill={star <= reviewForm.rating ? 'currentColor' : 'none'}/></button>)}</div></div>
          <label>{t.reviewDate}<input type="datetime-local" required value={reviewForm.date} onChange={e => setReviewForm(old => ({ ...old, date: e.target.value }))}/></label>
          <label>{t.reviewText}<textarea required maxLength={900} rows={4} value={reviewForm.text} onChange={e => setReviewForm(old => ({ ...old, text: e.target.value }))} placeholder={lang === 'RU' ? 'Напиши текст отзыва…' : 'Write the review…'}/></label>
          <button className="primary-btn admin-submit" type="submit"><Plus size={17}/>{t.saveReview}</button>
        </form>
        <section className="admin-list panel">
          <div className="admin-list-title"><h2>{t.reviewList}</h2><span className="count-pill">{reviews.length}</span></div>
          {reviews.map(review => <div className="admin-review-row" key={review.id}><span className="admin-review-copy"><b>{review.username} · {review.rating}/5 ★</b><small>{review.text}</small></span><button aria-label={`${t.delete} ${review.username}`} onClick={() => deleteReview(review.id)}><Trash2 size={16}/></button></div>)}
          {!reviews.length && <p className="admin-empty-note">{t.noReviews}</p>}
        </section>
      </section>}
    </main>

    {tab !== 'admin' && <nav className="bottom-nav" aria-label="Main navigation">
      {nav.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'nav-item active' : 'nav-item'} onClick={() => go(item.id)}><Icon size={20}/><span>{lang === 'EN' ? item.label : item.ru}</span></button>; })}
    </nav>}
    <footer className="footer">
      <a href={botUrl} target="_blank" rel="noreferrer">@Playerok_Guarantor_Bot <ExternalLink size={11}/></a>
      <span>Playerok</span>
    </footer>
    {!splashGone && <div className={splashVisible ? 'splash' : 'splash out'} aria-hidden="true">
      <i className="sp-orb a"/><i className="sp-orb b"/>
      <div className="splash-mark">
        <span className="sp-halo"/>
        <svg className="splash-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" className="splash-track"/><circle cx="50" cy="50" r="46" className="splash-arc"/></svg>
        <img src="/playerok-symbol.png" alt=""/>
        <span className="sp-dot d1"/><span className="sp-dot d2"/><span className="sp-dot d3"/>
      </div>
      <b className="splash-name">PLAYEROK</b>
      <small className="splash-tag">{lang === 'RU' ? 'Маркетплейс подарков' : 'Gift marketplace'}</small>
      <div className="splash-status"><span>{lang === 'RU' ? 'Подключаемся' : 'Connecting'}</span><span>{lang === 'RU' ? 'Загружаем подарки' : 'Loading gifts'}</span><span>{lang === 'RU' ? 'Почти готово' : 'Almost ready'}</span></div>
      <div className="splash-bar"><i style={{ width: `${pct}%` }}/></div>
      <span className="splash-pct">{Math.round(pct)}%</span>
    </div>}
    {buyGift && <div className="modal-back" onClick={() => setBuyGift(null)}><div className="modal-card" role="dialog" onClick={e => e.stopPropagation()}>
      <button className="modal-x" aria-label="Close" onClick={() => setBuyGift(null)}><X size={16}/></button>
      <div className="modal-icon"><Wallet size={24}/></div>
      <h3>{lang === 'RU' ? 'Недостаточно средств на балансе' : 'Insufficient balance'}</h3>
      <p>{lang === 'RU' ? `Цена: ${money(buyGift.price ?? 0)}, ваш баланс: ${money(stats.balance)}. Пополните баланс через бота или менеджера.` : `Price: ${money(buyGift.price ?? 0)}, your balance: ${money(stats.balance)}. Top up via the bot or the manager.`}</p>
      <a className="primary-btn" href={botUrl} target="_blank" rel="noreferrer"><ShieldCheck size={16}/>{lang === 'RU' ? 'Пополнить через бота' : 'Top up via bot'}</a>
      <a className="primary-btn modal-alt" href={manager.url} target="_blank" rel="noreferrer"><UserRound size={16}/>{lang === 'RU' ? 'Написать менеджеру' : 'Contact manager'} @{manager.username}</a>
    </div></div>}
    {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
