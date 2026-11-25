# Playerok Telegram Mini App

React + TypeScript + Vite frontend for Vercel.

## Current defaults

- Opens on the **Market** tab.
- Starts in **dark theme**. The visitor can switch to light theme; the choice is stored per browser.
- Playerok blue branding and the supplied logo files are used.
- The profile reads the Telegram Mini App user when opened inside Telegram.
- A Reviews tab is shown in the bottom navigation. Admins can add and delete reviews with a nickname, 1–5 star rating, and text.
- My gifts / Offers / History now show neutral empty states instead of a misleading loading error.

## Local run

```bash
npm install
npm run dev
```

Open the local HTTP URL printed by Vite. Do not double-click `index.html`.

## Deploy to Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `./`

The `api/admin-check.ts` file is a Vercel serverless function. Keep the `api` folder at the project root.

## Telegram setup

Configure the menu button / Mini App URL for `@Playerok_Guarantor_Bot` in BotFather and set it to the deployed Vercel production URL. Open the Mini App through that Telegram button; opening the URL directly in a normal browser does not provide Telegram `initData`.

## Admin access

Only Telegram IDs `8491418744` and `9264762756` are allowlisted in `api/admin-check.ts`.

In Vercel, add an Environment Variable:

- Name: `BOT_TOKEN`
- Value: the bot token from BotFather
- Environment: Production (and Preview if you test Preview URLs)

Save the variable and redeploy. The server verifies Telegram's signed `initData` before returning admin access. Never put the bot token in frontend code, GitHub, or a chat message. If the token is not configured, admin access stays disabled.

## Add gifts

Open the app from Telegram using one of the allowlisted administrator accounts, then go to Profile → Manage catalog.

Paste a Telegram NFT link, for example:

`https://t.me/nft/JellyBunny-12779`

The form fills in the collection, gift number, source link, and Fragment preview image. Enter the Model, Background, Pattern and their rarity values in the remaining fields, then press Add to market. A custom image URL can be entered in Advanced image settings if necessary.

## Important storage limitation

Gift and review additions/deletions currently save in the administrator's browser LocalStorage only. They do **not** sync to other users or devices. The Reviews tab therefore only shows reviews saved in that same browser/WebView until a shared database and API are connected. A shared public catalog requires a database and server-side catalog API; this project does not yet include that shared storage.

Purchases, deposits, and withdrawals are intentionally unavailable.
