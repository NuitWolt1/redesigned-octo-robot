import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Gamepad2, Gift, LockKeyhole, Sparkles, UserRound, Search, ChevronDown,
  Gem, TrendingUp, Activity, Wallet, ShoppingBag, ArrowUpRight, X,
  ExternalLink, ShieldCheck, Moon, Sun, ArrowLeft, Plus, Trash2,
  ImagePlus, CheckCircle2, Upload, UserRoundCheck, Globe2, MessageSquare, Star
} from 'lucide-react';
import './style.css';

type Tab = 'games' | 'market' | 'reviews' | 'gifts' | 'event' | 'profile' | 'admin';
type Lang = 'EN' | 'RU';
type Sort = 'featured' | 'low' | 'high';
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
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: TelegramUser };
        ready?: () => void;
        expand?: () => void;
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

// Коллекционные подарки Telegram. Все изображения ведут на публичные NFT-превью Fragment.
const initialGifts: GiftItem[] = [
  {
    id: 'cookie-heart-3865', collection: 'Cookie Heart', number: 3865,
    model: 'Toasted', modelRarity: '1%', backdrop: 'Aquamarine', backdropRarity: '2%',
    symbol: 'Red Deer', symbolRarity: '0.2%',
    image: 'https://nft.fragment.com/gift/cookieheart-3865.webp',
    source: 'https://t.me/nft/CookieHeart-3865', serial: 'CookieHeart-3865'
  },
  {
    id: 'jelly-bunny-12779', collection: 'Jelly Bunny', number: 12779,
    model: 'Spring Day', modelRarity: '0.4%', backdrop: 'Electric Purple', backdropRarity: '0.83%',
    symbol: 'Spider Web', symbolRarity: '0.55%',
    image: 'https://nft.fragment.com/gift/jellybunny-12779.webp',
    source: 'https://t.me/nft/JellyBunny-12779', serial: 'JellyBunny-12779'
  },
  {
    id: 'durovs-cap-1361', collection: "Durov's Cap", number: 1361,
    model: 'Macintosh', modelRarity: '2.43%', backdrop: 'Azure Blue', backdropRarity: '1.95%',
    symbol: 'Cocktail', symbolRarity: '0.99%',
    image: 'https://nft.fragment.com/gift/durovscap-1361.webp',
    source: 'https://t.me/nft/DurovsCap-1361', serial: 'DurovsCap-1361'
  },
  {
    id: 'jelly-bunny-5286', collection: 'Jelly Bunny', number: 5286,
    model: 'Firefruit', modelRarity: '0.51%', backdrop: 'Lemongrass', backdropRarity: '1.84%',
    symbol: 'Rocket', symbolRarity: '0.48%',
    image: 'https://nft.fragment.com/gift/jellybunny-5286.webp',
    source: 'https://t.me/nft/JellyBunny-5286', serial: 'JellyBunny-5286'
  },
  {
    id: 'plushpepe-96', collection: 'Plush Pepe', number: 96,
    model: 'Princess', modelRarity: '2.1%', backdrop: 'Grape', backdropRarity: '2.05%',
    symbol: 'Toilet', symbolRarity: '0.5%',
    image: 'https://nft.fragment.com/gift/plushpepe-96.webp',
    source: 'https://t.me/nft/PlushPepe-96', serial: 'PlushPepe-96'
  }
];

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
    addReview: 'Add a review', reviewUsername: 'Username / nickname', reviewRating: 'Rating', reviewText: 'Review text', saveReview: 'Publish review',
    reviewAdded: 'Review added', reviewRemoved: 'Review removed', invalidReview: 'Enter a nickname and review text, then choose 1–5 stars.',
    adminReviews: 'Manage reviews', reviewList: 'Published reviews',
    model: 'MODEL', backdrop: 'BACKGROUND', symbol: 'PATTERN', collection: 'COLLECTION',
    bot: 'Open Telegram bot', gamesInfo: 'This section is currently empty.',
    telegramConnect: 'Open this app from Telegram to show your profile.', connect: 'Open Telegram bot',
    account: 'TELEGRAM ACCOUNT', connected: 'Telegram profile connected', notConnected: 'Telegram profile not found',
    premium: 'TELEGRAM PREMIUM', admin: 'Manage catalog', adminTitle: 'Admin panel', adminSub: 'Add and remove collectible gifts from the catalog.', adminDenied: 'Administrator access is required.',
    localOnly: 'Gifts and reviews are saved in this browser only. To show the same catalog and reviews to every visitor, connect a shared database.',
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
    addReview: 'Добавить отзыв', reviewUsername: 'Имя пользователя / ник', reviewRating: 'Оценка', reviewText: 'Текст отзыва', saveReview: 'Опубликовать отзыв',
    reviewAdded: 'Отзыв добавлен', reviewRemoved: 'Отзыв удалён', invalidReview: 'Укажи ник, текст отзыва и оценку от 1 до 5 звёзд.',
    adminReviews: 'Управление отзывами', reviewList: 'Опубликованные отзывы',
    model: 'МОДЕЛЬ', backdrop: 'ФОН', symbol: 'УЗОР', collection: 'КОЛЛЕКЦИЯ',
    bot: 'Открыть Telegram-бота', gamesInfo: 'Раздел пока пуст.',
    telegramConnect: 'Открой приложение через Telegram, чтобы увидеть свой профиль.', connect: 'Открыть Telegram-бота',
    account: 'АККАУНТ TELEGRAM', connected: 'Профиль Telegram подключён', notConnected: 'Профиль Telegram не найден',
    premium: 'TELEGRAM PREMIUM', admin: 'Управление каталогом', adminTitle: 'Панель администратора', adminSub: 'Добавление и удаление коллекционных подарков.', adminDenied: 'Доступ разрешён только администраторам.',
    localOnly: 'Подарки и отзывы сохраняются только в этом браузере. Чтобы каталог и отзывы были одинаковыми у всех посетителей, подключи общую базу данных.',
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

function loadCatalog(): GiftItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialGifts;
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed as GiftItem[];
  } catch (error) {
    console.warn('Could not read the saved catalog:', error);
  }
  return initialGifts;
}

function loadReviews(): ReviewItem[] {
  try {
    const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is ReviewItem => Boolean(
        item && typeof item === 'object' &&
        typeof (item as ReviewItem).id === 'string' &&
        typeof (item as ReviewItem).username === 'string' &&
        Number.isInteger((item as ReviewItem).rating) &&
        (item as ReviewItem).rating >= 1 && (item as ReviewItem).rating <= 5 &&
        typeof (item as ReviewItem).text === 'string'
      ));
    }
  } catch (error) {
    console.warn('Could not read saved reviews:', error);
  }
  return [];
}

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

function App() {
  const [tab, setTab] = useState<Tab>('market');
  const [lang, setLang] = useState<Lang>(() => {
    const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code?.toLowerCase();
    return tgLang?.startsWith('ru') ? 'RU' : 'EN';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' ? 'light' : 'dark';
  });
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(() => getTelegramUser());
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('featured');
  const [sub, setSub] = useState<'gifts' | 'offers' | 'history'>('gifts');
  const [langOpen, setLangOpen] = useState(false);
  const [catalog, setCatalog] = useState<GiftItem[]>(loadCatalog);
  const [reviews, setReviews] = useState<ReviewItem[]>(loadReviews);
  const [reviewForm, setReviewForm] = useState({ username: '', rating: 5, text: '' });
  const [toast, setToast] = useState('');
  const [giftForm, setGiftForm] = useState({
    collection: '', number: '', model: '', modelRarity: '', backdrop: '', backdropRarity: '',
    symbol: '', symbolRarity: '', image: '', source: ''
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  }, [catalog]);

  useEffect(() => {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    const color = theme === 'dark' ? '#171a24' : '#f4f7fc';
    window.Telegram?.WebApp?.setHeaderColor?.(theme === 'dark' ? '#171a24' : '#ffffff');
    window.Telegram?.WebApp?.setBackgroundColor?.(color);
  }, [theme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalog.filter(g => [g.collection, g.number, g.model, g.backdrop, g.symbol].join(' ').toLowerCase().includes(q));
    if (sort === 'low') list = [...list].sort((a, b) => a.number - b.number);
    if (sort === 'high') list = [...list].sort((a, b) => b.number - a.number);
    return list;
  }, [catalog, query, sort]);

  const go = (next: Tab) => {
    if (next === 'admin' && !isAdmin) { setTab('profile'); showToast(t.adminDenied); return; }
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };
  const updateForm = (key: keyof typeof giftForm, value: string) => setGiftForm(old => ({ ...old, [key]: value }));
  const updateGiftSource = (value: string) => {
    const parsed = parseGiftLink(value);
    setGiftForm(old => parsed ? ({ ...old, source: parsed.source, collection: parsed.collection, number: parsed.number, image: parsed.image }) : ({ ...old, source: value }));
  };
  const addGift = (event: React.FormEvent<HTMLFormElement>) => {
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
    if (!['https:', 'http:'].includes(imageUrl.protocol)) { showToast(t.invalid); return; }
    let source = giftForm.source.trim();
    if (source) {
      try { const u = new URL(source); if (!['https:', 'http:'].includes(u.protocol)) throw new Error('URL'); }
      catch { showToast(t.invalid); return; }
    }
    const item: GiftItem = {
      id: `gift-${Date.now()}-${number}`, collection: giftForm.collection.trim(), number,
      model: giftForm.model.trim(), modelRarity: giftForm.modelRarity.trim() || '—',
      backdrop: giftForm.backdrop.trim(), backdropRarity: giftForm.backdropRarity.trim() || '—',
      symbol: giftForm.symbol.trim(), symbolRarity: giftForm.symbolRarity.trim() || '—',
      image: imageUrl.href, source: source || `https://t.me/nft/${serial}`, serial
    };
    setCatalog(old => [item, ...old]);
    setGiftForm({ collection: '', number: '', model: '', modelRarity: '', backdrop: '', backdropRarity: '', symbol: '', symbolRarity: '', image: '', source: '' });
    showToast(t.added);
  };
  const deleteGift = (id: string) => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    setCatalog(old => old.filter(g => g.id !== id));
    showToast(t.removed);
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
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed) || !parsed.every(g => g && typeof g.collection === 'string' && typeof g.image === 'string')) throw new Error('Invalid catalog');
        setCatalog(parsed as GiftItem[]); showToast(t.added);
      } catch { showToast(t.invalid); }
    };
    reader.readAsText(file);
  };
  const addReview = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) { showToast(t.adminDenied); return; }
    const username = reviewForm.username.trim();
    const text = reviewForm.text.trim();
    if (!username || !text || !Number.isInteger(reviewForm.rating) || reviewForm.rating < 1 || reviewForm.rating > 5) {
      showToast(t.invalidReview); return;
    }
    const item: ReviewItem = {
      id: `review-${Date.now()}`, username, rating: reviewForm.rating, text, createdAt: Date.now()
    };
    setReviews(old => [item, ...old]);
    setReviewForm({ username: '', rating: 5, text: '' });
    showToast(t.reviewAdded);
  };
  const deleteReview = (id: string) => {
    if (!isAdmin) { showToast(t.adminDenied); return; }
    setReviews(old => old.filter(review => review.id !== id));
    showToast(t.reviewRemoved);
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
        <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? t.dark : t.light} title={theme === 'light' ? t.dark : t.light}>
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
          <div className="sort-tabs">
            <button className={sort === 'featured' ? 'active' : ''} onClick={() => setSort('featured')}>{t.featured}</button>
            <button className={sort === 'low' ? 'active' : ''} onClick={() => setSort('low')}>{t.low}</button>
            <button className={sort === 'high' ? 'active' : ''} onClick={() => setSort('high')}>{t.high}</button>
          </div>
          <div className="gift-grid">
            {filtered.map(g => <article className="gift-card" key={g.id}>
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
                <div className="gift-card-bottom"><a href={g.source} target="_blank" rel="noreferrer">{t.openNft} <ExternalLink size={12}/></a><span className="unavailable"><ShoppingBag size={14}/>{t.unavailable}</span></div>
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
        <div className="personal-empty panel">
          <div className="personal-empty-icon"><Gift size={23}/></div>
          <h3>{sub === 'gifts' ? t.noPersonalGifts : sub === 'offers' ? t.noOffers : t.noHistory}</h3>
        </div>
      </section>}

      {tab === 'reviews' && <section className="reviews-page">
        <div className="page-heading panel"><div><span className="eyebrow">PLAYEROK COMMUNITY</span><h1>{t.reviews}</h1><p>{t.reviewsSub}</p></div><div className="heading-icon"><MessageSquare size={22}/></div></div>
        <div className="reviews-summary panel">
          <div className="review-score"><strong>{reviews.length ? averageRating.toFixed(1) : '—'}</strong><div><div className="review-stars">{[1,2,3,4,5].map(star => <Star key={star} size={16} fill={star <= Math.round(averageRating) ? 'currentColor' : 'none'}/>)}</div><small>{reviews.length} {t.reviewCount.toLowerCase()}</small></div></div>
          <div className="review-summary-label">{t.averageRating}</div>
        </div>
        {reviews.length ? <div className="reviews-list">{reviews.map(review => <article className="review-card panel" key={review.id}>
          <div className="review-card-head"><div className="review-avatar">{review.username.trim().slice(0,1).toUpperCase()}</div><div className="review-author"><b>{review.username}</b><small>{new Date(review.createdAt).toLocaleDateString(lang === 'RU' ? 'ru-RU' : 'en-US')}</small></div><div className="review-card-stars" aria-label={`${review.rating} / 5`}>{[1,2,3,4,5].map(star => <Star key={star} size={14} fill={star <= review.rating ? 'currentColor' : 'none'}/>)}</div></div>
          <p>{review.text}</p>
        </article>)}</div> : <div className="reviews-empty panel"><div className="reviews-empty-icon"><MessageSquare size={24}/></div><h3>{t.noReviews}</h3><p>{t.noReviewsSub}</p></div>}
      </section>}

      {tab === 'event' && <section className="empty-hero panel"><div className="hero-icon"><Sparkles size={29}/></div><span className="section-kicker">PLAYEROK EVENTS</span><h1>{t.event}</h1><p>{t.eventSub}</p><button className="primary-btn" disabled>{t.unavailable}</button></section>}

      {tab === 'profile' && <section className="profile-page">
        <div className="profile-card panel">
          <div className="profile-head"><div><span className="eyebrow">{t.account}</span><h1>{t.profile}</h1></div><div className="heading-icon"><Wallet size={22}/></div></div>
          {telegramUser ? <>
            <div className="telegram-status connected"><CheckCircle2 size={15}/>{t.connected}</div>
            <div className="user-row">
              {telegramUser.photo_url ? <img className="avatar avatar-photo" src={telegramUser.photo_url} alt={t.photo} referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }}/>
                : <div className="avatar">{initials}</div>}
              <div className="user-data"><h2>{fullName || telegramUser.username || `ID ${telegramUser.id}`}</h2><b>{telegramUser.username ? `@${telegramUser.username}` : (lang === 'EN' ? 'Username not set' : 'Имя пользователя не задано')}</b><small>TELEGRAM ID&nbsp; {telegramUser.id}</small></div>
            </div>
            <div className="profile-stats">
              <div><small>{t.balance}</small><b>—</b></div><div><small>{t.spent}</small><b>—</b></div>
              <div><small>{t.purchases}</small><b>—</b></div>
              <div className="language-stat"><small>{t.language}</small><button onClick={() => setLang(lang === 'EN' ? 'RU' : 'EN')}>{lang}<ChevronDown size={15}/></button></div>
            </div>
            {telegramUser.is_premium && <div className="premium-chip"><Gem size={14}/>{t.premium}</div>}
          </> : <div className="telegram-connect">
            <div className="connect-icon"><UserRoundCheck size={26}/></div><h3>{t.notConnected}</h3><p>{t.telegramConnect}</p><a className="primary-btn connect-button" href={botUrl} target="_blank" rel="noreferrer">{t.connect} <ExternalLink size={14}/></a>
          </div>}
          <div className="funds-box"><h3>{t.add}</h3><p>{t.fundSub}</p><div className="fund-actions"><button disabled>＋ Deposit</button><button disabled>↗ Withdraw</button></div></div>
          <a className="bot-card-link" href={botUrl} target="_blank" rel="noreferrer"><span className="bot-avatar"><ShieldCheck size={19}/></span><span><b>@Playerok_Guarantor_Bot</b><small>{t.bot}</small></span><ExternalLink size={15}/></a>
          {isAdmin && <button className="admin-entry" onClick={() => go('admin')}><ShieldCheck size={17}/>{t.admin}<ArrowUpRight size={15}/></button>}
        </div>
      </section>}

      {tab === 'admin' && isAdmin && <section className="admin-page">
        <div className="admin-header"><button className="back-button" onClick={() => go('profile')}><ArrowLeft size={17}/>{t.back}</button><div className="admin-title"><div><span className="eyebrow">PLAYEROK</span><h1>{t.adminTitle}</h1><p>{t.adminSub}</p></div><div className="heading-icon"><ShieldCheck size={22}/></div></div></div>
        <div className="admin-notice"><Globe2 size={17}/><span>{t.localOnly}</span></div>
        <form className="admin-form panel" onSubmit={addGift}>
          <h2><Plus size={19}/>{t.addGift}</h2>
          <label>{t.nftUrl}<input type="url" value={giftForm.source} onChange={e => updateGiftSource(e.target.value)} placeholder="https://t.me/nft/JellyBunny-12779"/><small className="admin-hint">{t.imageHint}</small></label>
          <label>{t.collectionName}<input required value={giftForm.collection} onChange={e => updateForm('collection', e.target.value)} placeholder="Jelly Bunny"/></label>
          <label>{t.number}<input required type="number" min="1" step="1" value={giftForm.number} onChange={e => updateForm('number', e.target.value)} placeholder="12779"/></label>
          <div className="admin-field-row"><label>{t.model}<input required value={giftForm.model} onChange={e => updateForm('model', e.target.value)} placeholder="Spring Day"/></label><label>{t.modelRarity}<input value={giftForm.modelRarity} onChange={e => updateForm('modelRarity', e.target.value)} placeholder="0.4%"/></label></div>
          <div className="admin-field-row"><label>{t.background}<input required value={giftForm.backdrop} onChange={e => updateForm('backdrop', e.target.value)} placeholder="Electric Purple"/></label><label>{t.backgroundRarity}<input value={giftForm.backdropRarity} onChange={e => updateForm('backdropRarity', e.target.value)} placeholder="0.83%"/></label></div>
          <div className="admin-field-row"><label>{t.pattern}<input required value={giftForm.symbol} onChange={e => updateForm('symbol', e.target.value)} placeholder="Spider Web"/></label><label>{t.patternRarity}<input value={giftForm.symbolRarity} onChange={e => updateForm('symbolRarity', e.target.value)} placeholder="0.55%"/></label></div>
          <details className="admin-advanced"><summary>{lang === 'RU' ? 'Дополнительные настройки изображения' : 'Advanced image settings'}</summary><label>{t.imageUrl}<input type="url" value={giftForm.image} onChange={e => updateForm('image', e.target.value)} placeholder="https://.../gift.webp"/></label></details>
          {giftForm.image && <div className="admin-image-preview"><small>{t.imagePreview}</small><img src={giftForm.image} alt="Gift preview" onError={e => { e.currentTarget.style.opacity = '0.25'; }}/></div>}
          <button className="primary-btn admin-submit" type="submit"><Plus size={17}/>{t.saveGift}</button>
        </form>
        <section className="admin-list panel">
          <div className="admin-list-title"><h2>{t.catalogList}</h2><span className="count-pill">{catalog.length}</span></div>
          <div className="admin-tools"><button onClick={exportCatalog}><Upload size={15}/>Export JSON</button><label className="import-button"><ImagePlus size={15}/>Import JSON<input type="file" accept="application/json,.json" onChange={e => { importCatalog(e.target.files?.[0]); e.currentTarget.value = ''; }}/></label></div>
          {catalog.map(g => <div className="admin-gift-row" key={g.id}><img src={g.image} alt=""/><span><b>{g.collection} #{g.number}</b><small>{g.model} · {g.backdrop} · {g.symbol}</small></span><button aria-label={`${t.delete} ${g.collection} ${g.number}`} onClick={() => deleteGift(g.id)}><Trash2 size={16}/></button></div>)}
        </section>
        <form className="admin-form panel review-admin-form" onSubmit={addReview}>
          <h2><MessageSquare size={19}/>{t.addReview}</h2>
          <label>{t.reviewUsername}<input required maxLength={40} value={reviewForm.username} onChange={e => setReviewForm(old => ({ ...old, username: e.target.value }))} placeholder={lang === 'RU' ? 'Например, Alex' : 'For example, Alex'}/></label>
          <div className="admin-rating-field"><span>{t.reviewRating}</span><div className="admin-rating-picker" role="radiogroup" aria-label={t.reviewRating}>{[1,2,3,4,5].map(star => <button key={star} type="button" role="radio" aria-checked={reviewForm.rating === star} aria-label={`${star} / 5`} className={star <= reviewForm.rating ? 'rating-star selected' : 'rating-star'} onClick={() => setReviewForm(old => ({ ...old, rating: star }))}><Star size={25} fill={star <= reviewForm.rating ? 'currentColor' : 'none'}/></button>)}</div></div>
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
    {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
