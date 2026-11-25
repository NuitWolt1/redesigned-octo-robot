# Playerok Mini App — shared database release

React + TypeScript + Vite frontend, Vercel serverless API and Supabase Postgres storage.

## What is shared now

- Market gifts are loaded from `GET /api/catalog` and stored in Supabase `market_gifts`.
- Reviews are loaded from `GET /api/reviews` and stored in Supabase `reviews`.
- Both lists refresh on open, when the browser regains focus, and every 20 seconds.
- Only Telegram admins `8491418744` and `9264762756` can create/import/delete gifts and reviews. Every write is checked server-side using the signed Telegram Mini App `initData` and `BOT_TOKEN`.
- The Supabase secret key is used only by Vercel API functions. It is never bundled into frontend code.
- Existing browser-local items can be transferred once from the same Telegram WebView using **Profile → Admin panel → Transfer saved data from this device**.

## 1. Create Supabase project

1. Open https://supabase.com/dashboard and create a project.
2. Open **SQL Editor → New query**.
3. Open `supabase/schema.sql` from this project, copy all of it into the SQL Editor and run it.
4. The script creates the two tables, enables RLS, removes direct browser access, grants server-side access and inserts five starter gifts. Running it again is safe for the starter gift records.

## 2. Get Supabase project URL and secret key

- Project URL: Supabase Dashboard → **Integrations → Data API** (or the project's Connect dialog).
- Secret key: Supabase Dashboard → **Settings → API Keys** → create/copy a `sb_secret_...` key.

Use the secret key, NOT the publishable key. Never put it in `src/`, `VITE_` variables, GitHub or browser code.

## 3. Add variables in Vercel

Open Vercel → Playerok project → **Settings → Environment Variables**. Add these for **Production** (and Preview too, if needed):

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` copied from Supabase |

Keep the existing `BOT_TOKEN` variable. The Telegram bot token is still required to validate admin `initData`; the Supabase secret key is a separate credential for database access.

After saving, redeploy the latest commit. Environment variables apply to new deployments.

## 4. Deploy

Commit and push the contents of this folder to the connected GitHub repository. Vercel should build with:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `./`

Keep `api/`, `server/` and `supabase/` at the repository root next to `package.json` and `src/`. Do not put the API functions under `src/`.

## 5. Verify the shared database

After deployment, open these URLs in a browser:

- `https://YOUR_VERCEL_DOMAIN/api/catalog`
- `https://YOUR_VERCEL_DOMAIN/api/reviews`

They should return JSON objects containing an `items` array. The catalog initially contains five starter items. If the response says the database is not configured, check the Vercel environment variable names and redeploy. If it says a database request failed, check that `schema.sql` ran successfully and that the secret key belongs to the same Supabase project as `SUPABASE_URL`.

## 6. Transfer previously saved browser data

After the new deployment is live:

1. Open the Mini App from `@Playerok_Guarantor_Bot` in the same Telegram account and WebView where the old locally saved gifts/reviews exist.
2. Open Profile → Admin panel.
3. Click **Transfer saved data from this device** once.
4. The app copies the old `playerok.catalog.v3` and `playerok.reviews.v1` entries into Supabase. It uses ID-based upsert, so repeating the transfer will not create duplicate IDs.

If the old LocalStorage was cleared or you are opening from a different Telegram WebView, those local-only records cannot be recovered from this project; re-add them through the admin panel.

## Local development

```bash
npm install
npm run dev
```

Set the environment variables in `.env.local` for local Vercel dev/functions, or use `vercel dev` after linking the project. Do not commit `.env.local`.

## Security notes

- Public users can read only the fields returned by the two public GET endpoints.
- Public users cannot write directly to the Supabase tables; RLS is enabled and `anon`/`authenticated` table privileges are revoked.
- All mutations pass through Vercel API functions, verify Telegram's signed `initData`, and check the fixed admin ID allowlist.
- Supabase secret key and Telegram bot token must remain in Vercel Environment Variables only.
