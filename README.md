# Olympus Snap!

Web photobooth — Greek mythology × retro 16-bit pixels.

**Stack:** Vite + Svelte 5 (SPA). No SvelteKit. Hash routing via `src/lib/router.js`.

## Dev

```bash
npm install
npm run dev
```

## Views (URL hash)

| Hash | Screen |
|------|--------|
| `#/landing` | Enter Mount Olympus |
| `#/frame` | Frame carousel |
| `#/camera` | Mirrored webcam + countdown |
| `#/studio` | Stickers (drag / scale / rotate) |
| `#/reveal` | Rope cut + cloth unroll |
| `#/export` | Final image + QR placeholder |
| `#/admin` | Long-press brand → PIN `olympus` |

Custom frames/stickers: Admin UI (IndexedDB). Seeds: `public/assets/` + `src/lib/assets/catalog.js`.
