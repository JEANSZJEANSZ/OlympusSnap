# Olympus Snap!

Web photobooth — Greek mythology × retro 16-bit pixels.

**Stack:** Vite + Svelte 5 (SPA) on Cloudflare Workers static assets. API is the same Worker: R2 blobs + D1 metadata. History routing via `src/router/index.js`.

**Backend:** [docs/photobooth-backend.md](./docs/photobooth-backend.md). Session photos expire nightly; custom frames and stickers stay.

## Dev (frontend only)

```bash
npm install
npm run dev
```

Vite is at `http://127.0.0.1:5173` and proxies `/api` → `http://127.0.0.1:8787`.

Copy `.env.example` → `.env` if you need `VITE_API_BASE` or `VITE_PUBLIC_ORIGIN`. Never commit `.env`.

`npm run dev` skips the Admin PIN. Production asks for the Worker secret only when you long-press into Admin.

## Dev (API + SPA)

```bash
copy .dev.vars.example .dev.vars
# set ADMIN_PIN= in .dev.vars (same value you type at Admin)
npm run build
npm run cf:d1:local
npm run cf:dev
```

`wrangler dev` serves `dist` plus `/api`. Build first so the assets directory exists.

## Cloudflare first-time setup

You need a Cloudflare account (Free is enough). Then:

```bash
npx wrangler login
npx wrangler d1 create olympus-snap
npx wrangler r2 bucket create olympus-snap
npx wrangler secret put ADMIN_PIN
```

Paste the D1 `database_id` into `wrangler.toml`. Apply schema and the captures lifecycle:

```bash
npm run cf:d1:remote
npm run cf:lifecycle
npm run cf:deploy
```

GitHub Actions (`.github/workflows/deploy.yml`) needs repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The workflow builds `dist`, applies D1 migrations, and deploys the Worker (SPA + API).

Do **not** store the Admin PIN in Vite (`VITE_*` ships in the JS bundle). The Worker secret is the lock; long-press Admin is the gate.

## Views (URL path)

| Path | Screen |
|------|--------|
| `/landing` | Enter Mount Olympus |
| `/frame` | Frame carousel |
| `/camera` | Mirrored webcam + countdown |
| `/studio` | Stickers (drag / scale / rotate) — guest QR uses `?ses=` |
| `/reveal` | Rope cut + cloth unroll + QR |
| `/admin` | Long-press brand → operator PIN (catalog + booth flags) |

App is served at `/`. Seeds: `public/assets/` + `src/lib/assets/catalog.js`.
