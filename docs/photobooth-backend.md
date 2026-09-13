# Frontend attach contract — Olympus Snap

The SPA ships with **no API**. Seed frames come from `src/lib/assets/catalog.js`. Capture QR is a **same-tab stub** (`sessionStub.js`). Phone scan fails until a backend (planned: Cloudflare) implements this contract.

## Environment

| Var | Role |
|-----|------|
| `VITE_PUBLIC_ORIGIN` | Optional QR origin when guests must scan a different host than the tablet |

No `VITE_API_BASE`. Admin is a local PIN (`olympus` default).

## Attach points

| Client API | Today | Next backend |
|------------|--------|----------------|
| `initAssets()` in [`assetStore.js`](../src/lib/assets/assetStore.js) | Seeds only | Merge remote frames/stickers |
| `createSession()` in [`sessionClient.js`](../src/lib/session/sessionClient.js) | In-memory stub | Persist capture PNG |
| `loadCapture(id, key)` | Same-tab Map | Fetch capture by capability |

Keep names. Swap the stub body.

## QR session (`ses`)

Reveal creates a capture → `{ id, key, frameId }`.

QR URL:

```text
{VITE_PUBLIC_ORIGIN}{base}/studio?ses={base64url(`${id}::${key}`)}
```

Example: `/olympussnap/studio?ses=...`

Guest Studio decodes `ses`, then `loadCapture(id, key)`. Captures are **reusable** (`id`+`key`), not one-time tokens.

## Related docs

- [storage-model.md](./storage-model.md) — frame/sticker/capture record shapes + slot math
