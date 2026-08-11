# Photobooth Backend — Olympus Snap

Cloud mode talks to **OpenHouse Photobooth** (`/api/photobooth` on SFOpenHouseAPI). There is no Cloudflare Worker in this repo.

## Environment

Copy `.env.example` → `.env` and set:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE` | API host, e.g. `https://sfapi.smartfactory.forum` or `http://localhost:6101` |
| `VITE_ADMIN_AUTH` | Shared `Auth` header for Admin writes + recent captures |
| `VITE_PUBLIC_ORIGIN` | Public origin guests open from QR (not localhost in production) |

Leave `VITE_API_BASE` empty for **offline** mode: IndexedDB customs + in-memory capture stub.

Do not commit real Auth secrets. The local example in `.env.example` comments matches the partner reference only.

## Local vs production

| Mode | `VITE_API_BASE` | Notes |
|------|-----------------|-------|
| Production | `https://sfapi.smartfactory.forum` | Booth tablet + guest phones use live API |
| Local API | `http://localhost:6101` | Run SFOpenHouseAPI locally; Vite proxies `/api` → `:6101` |
| Offline | *(empty)* | No network; same-tab Studio via stub `ses` |

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
