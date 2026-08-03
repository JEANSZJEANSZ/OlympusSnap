# Cloudflare Backend — Deploy Guide

Olympus Snap uses a Cloudflare **Worker + D1 + R2** stack for:

- **Custom frames** (PNG in R2 + `slots[]` JSON in D1)
- **Custom stickers** (PNG in R2)
- **Studio session photos** (one-time QR handoff from booth → guest phone)

When `VITE_API_BASE` is unset, the app falls back to **IndexedDB + session stub** (same-machine dev).

---

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/)
- Node.js 18+
- `npm install` in `OlympusSnap/worker/`

---

## 1. Enable R2 (required once per account)

R2 must be enabled in the Cloudflare Dashboard before bucket creation works:

1. Open [Cloudflare Dashboard → R2](https://dash.cloudflare.com/?to=/:account/r2/overview)
2. Accept terms / enable R2 for your account
3. Then create the bucket:

```bash
cd OlympusSnap/worker
npx wrangler r2 bucket create olympus-snap-media
```

If you see error `10042` ("Please enable R2 through the Cloudflare Dashboard"), complete step 1–2 first.

---

## 2. Create R2 bucket

```bash
cd OlympusSnap/worker
npx wrangler r2 bucket create olympus-snap-media
```

---

## 3. D1 database

**Already provisioned** for this project:

| Resource | Value |
|----------|-------|
| Database name | `olympus-snap` |
| Database ID | `d29a4739-482d-48ec-afd8-df51fa94a679` |
| Remote migration | Applied (`0001_init.sql`) |

The ID is set in [`worker/wrangler.toml`](./worker/wrangler.toml). To create on a new account:

```bash
npx wrangler d1 create olympus-snap
```

Copy the returned `database_id` into `wrangler.toml`.

---

## 4. Apply migrations

**Local (wrangler dev):**

```bash
npm run db:migrate:local
```

**Production:**

```bash
npm run db:migrate:remote
```

---

## 5. Set booth secret

```bash
npx wrangler secret put BOOTH_KEY
```

Use the same value in the booth `.env` as `VITE_BOOTH_KEY`.

---

## 6. Deploy Worker

```bash
npm run worker:deploy
```

Note the deployed URL, e.g. `https://olympus-snap-api.<account>.workers.dev`.

---

## 7. Configure booth frontend

Copy [`.env.example`](./.env.example) to `.env` and set:

```env
VITE_API_BASE=https://olympus-snap-api.<account>.workers.dev
VITE_BOOTH_KEY=<same as BOOTH_KEY secret>
VITE_PUBLIC_ORIGIN=https://your-booth-hostname.example.com
```

Rebuild the booth app after changing env vars.

Add your public booth origin to `CORS_ORIGINS` in `worker/wrangler.toml` if it is not localhost.

---

## Local development

Terminal 1 — Worker:

```bash
cd OlympusSnap/worker
npm install
npm run db:migrate:local
echo BOOTH_KEY=dev-secret > .dev.vars
npm run dev
```

Terminal 2 — Vite:

```bash
cd OlympusSnap
# .env:
# VITE_API_BASE=http://127.0.0.1:8787
# VITE_BOOTH_KEY=dev-secret
# VITE_PUBLIC_ORIGIN=http://localhost:5173
npm run dev
```

Vite also proxies `/api` → `8787` for optional same-origin testing.

---

## API reference

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/assets` | List custom frames/stickers |
| GET | `/api/assets/:id/file` | PNG blob |
| GET | `/api/sessions/:id` | One-time consume → PNG body + `X-Frame-Id` |

### Booth-only (`X-Booth-Key`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/assets` | Multipart or JSON create |
| PATCH | `/api/assets/:id` | Update metadata / image / slots |
| DELETE | `/api/assets/:id` | Remove asset |
| POST | `/api/sessions` | JSON `{ imageBase64, frameId, contentType }` |

### Frame slots shape (stored in D1 `slots_json`)

```json
[
  { "id": "slot-1", "x": 0.09, "y": 0.06, "w": 0.81, "h": 0.73 }
]
```

Coordinates are **0–1 fractions** of the frame PNG natural size.

---

## R2 key layout

```
frames/{assetId}.png
stickers/{assetId}.png
sessions/{sessionId}.png
```

Recommended R2 lifecycle rule: delete `sessions/` objects after 24 hours.

---

## Frontend integration

| Module | Role |
|--------|------|
| [`src/lib/assets/assetApi.js`](./src/lib/assets/assetApi.js) | HTTP transport |
| [`src/lib/assets/assetStore.js`](./src/lib/assets/assetStore.js) | Cloud vs IDB switch |
| [`src/lib/session/sessionClient.js`](./src/lib/session/sessionClient.js) | QR session handoff |

Admin → **UPLOAD LOCAL → CLOUD** pushes existing IndexedDB customs without overwriting cloud ids.

---

## Local vs production

| | Offline (`VITE_API_BASE` empty) | Cloud |
|--|--------------------------------|-------|
| Customs | IndexedDB | R2 + D1 |
| Sessions | In-memory stub | R2 + D1 |
| Cross-device QR | Same machine only | Guest phones on event Wi‑Fi |
| Admin cutover | N/A | Upload local → cloud button |

See also: [`cloudflare-session-draft.md`](./cloudflare-session-draft.md) for original session design notes.
