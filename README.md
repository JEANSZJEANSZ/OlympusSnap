# Olympus Snap!

Web photobooth — Greek mythology × retro 16-bit pixels.

**Stack:** Vite + Svelte 5 (SPA). No SvelteKit. History routing via `src/router/index.js`.

**Backend:** None wired. Guest flow uses seed frames. Capture QR is same-tab stub until a Cloudflare adapter attaches. See [docs/photobooth-backend.md](./docs/photobooth-backend.md).

## Dev

```bash
npm install
npm run dev
```

Copy `.env.example` → `.env`. Set `VITE_ADMIN_PIN` (required for production / `vite preview`). Optional: `VITE_PUBLIC_ORIGIN` if the QR origin must differ from the tablet origin. Never commit `.env`.

## Views (URL path)

| Path | Screen |
|------|--------|
| `/landing` | Enter Mount Olympus |
| `/frame` | Frame carousel |
| `/camera` | Mirrored webcam + countdown |
| `/studio` | Stickers (drag / scale / rotate) — guest QR uses `?ses=` |
| `/reveal` | Rope cut + cloth unroll + QR |
| `/admin` | Long-press brand → PIN from `.env` (booth flags only) |

App is served under Vite `base` `/olympussnap/`. Seeds: `public/assets/` + `src/lib/assets/catalog.js`.
