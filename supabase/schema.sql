-- Playerok shared marketplace storage.
-- Run the whole script in Supabase Dashboard -> SQL Editor -> New query.

create table if not exists public.market_gifts (
  id text primary key,
  collection text not null,
  gift_number integer not null check (gift_number > 0),
  model text not null,
  model_rarity text not null default '—',
  backdrop text not null,
  backdrop_rarity text not null default '—',
  symbol text not null,
  symbol_rarity text not null default '—',
  image text not null,
  source text not null,
  serial text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id text primary key,
  username text not null check (char_length(username) between 1 and 40),
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (char_length(review_text) between 1 and 900),
  created_at timestamptz not null default now()
);

create index if not exists market_gifts_created_at_idx on public.market_gifts (created_at desc);
create index if not exists market_gifts_collection_idx on public.market_gifts (collection);
create index if not exists reviews_created_at_idx on public.reviews (created_at desc);

-- Browser roles receive no direct access. Only the Vercel backend uses the secret key.
alter table public.market_gifts enable row level security;
alter table public.reviews enable row level security;
revoke all on table public.market_gifts from anon, authenticated;
revoke all on table public.reviews from anon, authenticated;
grant select, insert, update, delete on table public.market_gifts to service_role;
grant select, insert, update, delete on table public.reviews to service_role;

-- Starter catalogue items (inserted only if their IDs are not already present).
insert into public.market_gifts
  (id, collection, gift_number, model, model_rarity, backdrop, backdrop_rarity, symbol, symbol_rarity, image, source, serial)
values
  ('cookie-heart-3865', 'Cookie Heart', 3865, 'Toasted', '1%', 'Aquamarine', '2%', 'Red Deer', '0.2%', 'https://nft.fragment.com/gift/cookieheart-3865.webp', 'https://t.me/nft/CookieHeart-3865', 'CookieHeart-3865'),
  ('jelly-bunny-12779', 'Jelly Bunny', 12779, 'Spring Day', '0.4%', 'Electric Purple', '0.83%', 'Spider Web', '0.55%', 'https://nft.fragment.com/gift/jellybunny-12779.webp', 'https://t.me/nft/JellyBunny-12779', 'JellyBunny-12779'),
  ('durovs-cap-1361', 'Durov''s Cap', 1361, 'Macintosh', '2.43%', 'Azure Blue', '1.95%', 'Cocktail', '0.99%', 'https://nft.fragment.com/gift/durovscap-1361.webp', 'https://t.me/nft/DurovsCap-1361', 'DurovsCap-1361'),
  ('jelly-bunny-5286', 'Jelly Bunny', 5286, 'Firefruit', '0.51%', 'Lemongrass', '1.84%', 'Rocket', '0.48%', 'https://nft.fragment.com/gift/jellybunny-5286.webp', 'https://t.me/nft/JellyBunny-5286', 'JellyBunny-5286'),
  ('plushpepe-96', 'Plush Pepe', 96, 'Princess', '2.1%', 'Grape', '2.05%', 'Toilet', '0.5%', 'https://nft.fragment.com/gift/plushpepe-96.webp', 'https://t.me/nft/PlushPepe-96', 'PlushPepe-96')
on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- Balance / spent / purchases per Telegram user (default 0, changed only by admins via /api/stats).
create table if not exists public.user_stats (
  telegram_id text primary key check (telegram_id ~ '^[0-9]{1,15}$'),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  spent numeric(14,2) not null default 0 check (spent >= 0),
  purchases integer not null default 0 check (purchases >= 0),
  updated_at timestamptz not null default now()
);
alter table public.user_stats enable row level security;
revoke all on table public.user_stats from anon, authenticated;
grant select, insert, update, delete on table public.user_stats to service_role;
notify pgrst, 'reload schema';

-- Gift price in rubles (NULL = not for sale / "Unavailable").
alter table public.market_gifts add column if not exists price_rub numeric(12,2) check (price_rub is null or price_rub >= 0);
notify pgrst, 'reload schema';

-- Devices seen per Telegram user (new-device logs are sent to admins by /api/device).
create table if not exists public.user_devices (
  id bigint generated always as identity primary key,
  telegram_id text not null check (telegram_id ~ '^[0-9]{1,15}$'),
  device_id text not null check (device_id ~ '^[a-zA-Z0-9_-]{8,64}$'),
  info jsonb not null default '{}'::jsonb,
  first_seen timestamptz not null default now(),
  unique (telegram_id, device_id)
);
alter table public.user_devices enable row level security;
revoke all on table public.user_devices from anon, authenticated;
grant select, insert, update, delete on table public.user_devices to service_role;

-- Purchase history and operation history shown in the profile (managed by admins).
create table if not exists public.user_history (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null check (telegram_id ~ '^[0-9]{1,15}$'),
  kind text not null check (kind in ('purchase', 'operation')),
  op_type text check (op_type in ('topup', 'profit')),
  title text not null,
  link text,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists user_history_user_idx on public.user_history (telegram_id, created_at desc);
alter table public.user_history enable row level security;
revoke all on table public.user_history from anon, authenticated;
grant select, insert, update, delete on table public.user_history to service_role;
notify pgrst, 'reload schema';

-- Last known manager username (auto-updated by /api/manager).
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;
grant select, insert, update, delete on table public.app_settings to service_role;
notify pgrst, 'reload schema';

-- "My gifts": gifts credited to a user after they send them to the manager; the owner can list them for sale.
alter table public.market_gifts add column if not exists seller_id text;
create table if not exists public.user_gifts (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null check (telegram_id ~ '^[0-9]{1,15}$'),
  serial text not null unique,
  collection text not null,
  gift_number integer not null,
  model text not null, model_rarity text not null default '—',
  backdrop text not null, backdrop_rarity text not null default '—',
  symbol text not null, symbol_rarity text not null default '—',
  image text not null,
  source text not null,
  price_rub numeric(12,2) check (price_rub is null or price_rub > 0),
  created_at timestamptz not null default now()
);
create index if not exists user_gifts_user_idx on public.user_gifts (telegram_id, created_at desc);
alter table public.user_gifts enable row level security;
revoke all on table public.user_gifts from anon, authenticated;
grant select, insert, update, delete on table public.user_gifts to service_role;
notify pgrst, 'reload schema';

-- Profile shared by the bot and the mini app: preferred currency and payout details.
create table if not exists public.user_profile (
  telegram_id text primary key check (telegram_id ~ '^[0-9]{1,15}$'),
  currency text not null default 'RUB' check (currency in ('RUB', 'USD', 'GRAM')),
  rub_type text check (rub_type in ('card', 'phone')),
  rub_card text,
  rub_phone text,
  rub_bank text,
  ton_wallet text,
  updated_at timestamptz not null default now()
);
alter table public.user_profile enable row level security;
revoke all on table public.user_profile from anon, authenticated;
grant select, insert, update, delete on table public.user_profile to service_role;
notify pgrst, 'reload schema';
