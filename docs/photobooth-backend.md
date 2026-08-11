# Photobooth Backend — Olympus Snap

Cloud mode talks to **OpenHouse Photobooth** (`/api/photobooth` on SFOpenHouseAPI). There is no Cloudflare Worker in this repo.

## Environment

**Defaults are in `vite.config.js`** — no `.env` required:

| Mode | API base |
|------|----------|
| `npm run dev` | `http://localhost:6101` |
| `npm run build` / production | `https://sfapi.smartfactory.forum` |

Optional override: set `VITE_API_BASE` in the shell or a local `.env`.

**Admin Auth (runtime):** Unlock Admin with PIN + Photobooth `Auth` header value (session storage). Not configured via env.

**QR origin:** Uses `location.origin` unless you set optional `VITE_PUBLIC_ORIGIN` (needed when the booth URL guests scan must differ from the tablet’s origin).

**Security notes**

- Production booth/guest origins must be on the API CORS allowlist.
- Capture responses expose `X-Frame-Id`; the API CORS policy must use `WithExposedHeaders("X-Frame-Id")` so Studio can read frame context cross-origin.

## Local vs production

| Mode | `VITE_API_BASE` | Notes |
|------|-----------------|-------|
| Production build | *(default sfapi)* | From `vite.config.js` when `mode !== 'development'` |
| Local `npm run dev` | *(default :6101)* | From `vite.config.js`; run SFOpenHouseAPI locally |
| Override | set `VITE_API_BASE` | Shell or optional `.env` |

```bash
npm install
npm run dev
```

## QR session (`ses`)

Reveal creates a capture → `{ id, key, frameId }`.

QR URL shape:

```text
{VITE_PUBLIC_ORIGIN}{base}/studio?ses={base64url(`${id}::${key}`)}
```

Example path with Vite base: `/olympussnap/studio?ses=...`

- Guest Studio decodes `ses`, then `GET /api/photobooth/captures/{id}?key=...`
- Captures are **reusable** (capability `id`+`key`), not one-time consume tokens
- Offline stub mints local id/key and uses the same `ses` encoding

## Related docs

- [storage-model.md](./storage-model.md) — frames, stickers, slots, capture handoff
- [Photobooth API integration design](./superpowers/specs/2026-08-11-photobooth-api-integration-design.md)
- Partner live API: `https://sfapi.smartfactory.forum/`
