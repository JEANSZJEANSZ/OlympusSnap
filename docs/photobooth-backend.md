# Frontend attach contract — Olympus Snap

The SPA talks to a **Cloudflare Worker** at same-origin `/api` (Vite proxies to `wrangler dev` on `:8787`). Seed frames still ship from `src/lib/assets/catalog.js`. If the Worker is down, seeds stay usable and capture QR falls back to the same-tab stub.

## Environment

| Var | Where | Role |
|-----|--------|------|
| `ADMIN_PIN` | Worker secret / `.dev.vars` | Real lock. Header `Auth` must match. Never put this in Vite or source. |
| `VITE_API_BASE` | Optional `.env` | Empty = same-origin `/api`. Set only if the API is on another host. |
| `VITE_PUBLIC_ORIGIN` | Optional `.env` | QR origin when guests scan a different host than the tablet |

Frontend PIN is whatever the operator types at Admin (Cerberus). That value is stored in `sessionStorage` and sent as `Auth`. It is **not** a compile-time `VITE_*` secret. Guest booth routes never ask for it.

## Attach points

| Client API | Implementation |
|------------|----------------|
| `initAssets()` in [`assetStore.js`](../src/lib/assets/assetStore.js) | Seeds + `GET /api/frames` + `GET /api/stickers` |
| `createSession()` in [`sessionClient.js`](../src/lib/session/sessionClient.js) | `POST /api/captures` → `{ id, key, frameId }` (stub if API fails) |
| `loadCapture(id, key)` | `GET /api/captures/:id?key=` (stub if API fails) |

Admin writes (`POST`/`PATCH`/`DELETE` frames and stickers, `GET /api/admin/verify`) require `Auth`.

## Worker API

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/api/health` | no | `{ ok: true }` |
| `GET` | `/api/admin/verify` | `Auth` | Booth unlock |
| `GET` | `/api/frames` `/api/stickers` | no | `{ assets: [...] }` |
| `GET` | `/api/files/{frames\|stickers}/:id` | no | PNG/WebP from R2 |
| `POST` | `/api/frames` `/api/stickers` | `Auth` | multipart `File`, `Name`, `Motif`, `Width`, `Height`, `Slots` (frames) |
| `PATCH`/`DELETE` | `/api/frames/:id` `/api/stickers/:id` | `Auth` | |
| `POST` | `/api/captures` | no | JSON `{ imageBase64, frameId, contentType }` — **no Worker transcode** |
| `GET` | `/api/captures/:id?key=` | capability | Image + `X-Frame-Id` |

Blobs live in R2 (`frames/`, `stickers/`, `captures/`). Metadata lives in D1.

## Nightly wipe (session photos only)

- R2 lifecycle expires `captures/` after 1 day (`worker/r2-lifecycle.json`).
- Cron `0 0 * * *` (00:00 UTC) runs `DELETE FROM captures` in D1 — one SQL, stays under Free 10 ms CPU.

Frames and stickers are **not** wiped.

## QR session (`ses`)

Reveal creates a capture → `{ id, key, frameId }`.

QR URL:

```text
{VITE_PUBLIC_ORIGIN}{base}/studio?ses={base64url(`${id}::${key}`)}
```

Example at site root: `/studio?ses=...`

Guest Studio decodes `ses`, then `loadCapture(id, key)`. Captures are **reusable** (`id`+`key`), not one-time tokens.

## Related docs

- [storage-model.md](./storage-model.md) — frame/sticker/capture record shapes + slot math
- [README.md](../README.md) — local + Cloudflare deploy
