# Olympus Snap!

Web photobooth — Greek mythology × retro 16-bit pixels.

**Stack:** Vite + Svelte 5 (SPA). No SvelteKit. History routing via `src/router/index.js`.

**Backend:** OpenHouse Photobooth API (`/api/photobooth`). See [docs/photobooth-backend.md](./docs/photobooth-backend.md). Offline when `VITE_API_BASE` is empty (IndexedDB + session stub).

## Dev

```bash
npm install
cp .env.example .env   # optional — leave VITE_API_BASE empty for offline
npm run dev
```

Env vars: `VITE_API_BASE`, `VITE_ADMIN_AUTH`, `VITE_PUBLIC_ORIGIN` (see `.env.example`). Vite proxies `/api` → `http://localhost:6101` for local SFOpenHouseAPI.

## Views (URL path)

| Path | Screen |
|------|--------|
| `/landing` | Enter Mount Olympus |
| `/frame` | Frame carousel |
| `/camera` | Mirrored webcam + countdown |
| `/studio` | Stickers (drag / scale / rotate) — guest QR uses `?ses=` |
| `/reveal` | Rope cut + cloth unroll |
| `/export` | Final image + QR |
| `/admin` | Long-press brand → PIN `olympus` |

App is served under Vite `base` `/olympussnap/`. Custom frames/stickers: Admin UI (Photobooth when cloud, else IndexedDB). Seeds: `public/assets/` + `src/lib/assets/catalog.js`.
