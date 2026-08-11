# OlympusSnap ↔ Photobooth API Integration Design

**Date:** 2026-08-11  
**Status:** Approved for planning  
**Repo:** `OlympusSnap`  
**Partner contract:** OpenHouse Photobooth API (`/api/photobooth`) — production host `https://sfapi.smartfactory.forum`  
**Approach:** Full rewrite of cloud transport + delete Cloudflare Worker stack

---

## 1. Goals

- Point OlympusSnap cloud mode at SFOpenHouseAPI Photobooth (`PhotoBoothController`).
- Frames, stickers, capture handoff, and Admin recent-capture peek all use the partner HTTP contract.
- Keep offline/dev mode when `VITE_API_BASE` is empty (IndexedDB customs + in-memory session stub).
- Remove the Cloudflare Worker + D1 + R2 backend from this repo (Approach 3).

Non-goals: server-side composition, sticker persistence API, Cloudflare data migration scripts, changing guest UX/visual design beyond session URL shape and Admin recent panel.

---

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Cloudflare path | **Replace** — Photobooth is the only cloud backend |
| Admin Auth secret | **Env only** — `VITE_ADMIN_AUTH` → header `Auth` |
| Offline | **Keep** IndexedDB + session stub when base unset |
| Recent captures | **Wire Admin UI** — last 5 previews |
| Implementation style | **Full client rewrite + delete `worker/`** |

---

## 3. Architecture

```text
Booth tablet / Admin                Guest phone (Studio)
        │                                    │
        │  frames/stickers CRUD              │  GET capture?key=
        │  POST capture                      │  GET frame/sticker images
        │  GET admin/captures/recent         │
        ▼                                    ▼
   {VITE_API_BASE}/api/photobooth/...
        │
        ▼
   PhotoBoothController
   (enc disk + MySQL asset meta + RAM key ring)
```

| Mode | Trigger | Behavior |
|------|---------|----------|
| Cloud | `VITE_API_BASE` set | Customs + captures via Photobooth |
| Offline | `VITE_API_BASE` empty | IndexedDB customs + in-memory session stub |

### Environment

| Variable | Required (cloud) | Purpose |
|----------|------------------|---------|
| `VITE_API_BASE` | yes | e.g. `https://sfapi.smartfactory.forum` or `http://localhost:6101` |
| `VITE_ADMIN_AUTH` | yes for Admin writes / recent | Exact value for `Auth` header |
| `VITE_PUBLIC_ORIGIN` | yes for guest QR | Public origin used in QR links |

Remove `VITE_BOOTH_KEY` (Worker-era).

Do not hardcode the admin Auth value in source. Do not send `Auth` from guest Studio capture downloads.

---

## 4. Client modules & API mapping

### 4.1 Assets (`assetApi.js` + `assetStore.js` consumers)

Rewrite transport to Photobooth endpoints. Keep `assetStore` orchestration (seeds + customs merge) where practical; only the HTTP shape changes.

| Current (Worker) | Photobooth |
|------------------|------------|
| `GET /api/assets` | `GET /api/photobooth/frames` + `GET /api/photobooth/stickers` (merge `assets`) |
| `POST /api/assets` + `kind` | `POST /api/photobooth/frames` or `.../stickers` |
| `PATCH /api/assets/{id}` | `PATCH .../frames/{id}` or `.../stickers/{id}` |
| `DELETE /api/assets/{id}` | `DELETE` on the matching kind path |
| form `file` / `name` / `slots` / `motif` | form `File` / `Name` / `Slots` / `Motif` (partner field names) |
| `X-Booth-Key` | `Auth: {VITE_ADMIN_AUTH}` on write/delete only |
| Worker image URLs | Use API `src` as returned (CORS on image routes) |

Frame slots remain normalized `{ id, x, y, w, h }` in 0–1 space. Stickers must never send `Slots`.

List/meta/image GETs stay public (no Auth).

### 4.2 Captures / session handoff (`sessionClient.js` + Reveal / Studio)

| Current | Photobooth |
|---------|------------|
| `POST /api/sessions` → `{ sessionId }` | `POST /api/photobooth/captures` → `{ id, key, frameId }` |
| Body `imageBase64`, `frameId`, `contentType` | Same fields (accept data-URL or raw base64) |
| QR `?s={sessionId}` | QR `?ses={base64url(`${id}::${key}`)}` |
| `GET /api/sessions/{id}` one-time (410) | `GET /api/photobooth/captures/{id}?key=` reusable |
| Header `X-Frame-Id` | Keep reading `X-Frame-Id` for Studio frame context |
| Error `CONSUMED` as primary | Not primary; map 401/403/404 → invalid/missing session |
| Stub when no base | Keep stub; expose the same `ses` encoding so Studio has one parse path |

Public helpers:

- `createSession` → create capture; return `{ id, key, frameId }` (update Reveal/Studio call sites; no Worker `sessionId`-only shape).
- `buildStudioSessionUrl({ id, key })` → `{PUBLIC_ORIGIN}{toFullPath('/studio')}?ses=...` (history router + Vite `base`, e.g. `/olympussnap/studio?ses=`).
- `getSessionFromUrl()` → decode `ses`, split on `::`.
- `consumeSession` / `loadCapture` → GET PNG + `frameId` (rename allowed; update imports).

Reveal same-device QR click must open Studio with `?ses=`, not `?s=`.

Cloud mode: drop legacy `?s=` Worker session ids. Offline stub may still mint local id/key and encode as `ses`.

### 4.3 Admin recent captures

Cloud mode only. New Admin panel:

- `GET /api/photobooth/admin/captures/recent` with `Auth`
- Show up to 5 items: thumbnail from `previewBase64`, `createdAt`, `frameId`
- Empty copy: no recent captures, or API process restarted (ring is memory-only)
- v1: preview only (no delete / re-issue QR)

### 4.4 Error surfacing

| Case | UI |
|------|----|
| 401 on admin routes | Admin status: Auth missing/invalid — check `VITE_ADMIN_AUTH` |
| 400 validation | Show API `message` |
| Capture GET 401/403/404 | Studio invalid/missing link |
| Network on Reveal create | Warn; omit/fail QR gracefully (existing pattern) |

---

## 5. Cleanup (Approach 3)

- Delete `worker/` tree entirely.
- Remove root `package.json` scripts: `worker:dev`, `worker:deploy`, `worker:db:*`.
- Replace Cloudflare docs with a short Photobooth integration note (base URL, env, QR `ses`, offline mode).
- Update Admin UI copy that mentions Cloudflare R2/D1.
- Update `.env.example`, README, and any Worker-era comments in `sessionStub` / asset README.
- Leave seed assets under `public/assets/` and IndexedDB offline path intact.

---

## 6. Data flow (happy path)

```text
1. Admin uploads frame/sticker → POST Photobooth (Auth) → catalog refresh
2. Guest picks frame → camera snaps into slots → client composites PNG (no stickers)
3. Reveal POST /captures → { id, key, frameId }
4. QR: {VITE_PUBLIC_ORIGIN}{base}/studio?ses=base64url(id::key)
5. Phone opens Studio → decode ses → GET capture PNG + X-Frame-Id
6. Guest adds stickers client-side → reveal/export on phone
7. Operator opens Admin → recent panel shows last captures (RAM ring)
```

---

## 7. Verification

1. Empty `VITE_API_BASE` → offline booth still works (IDB + stub `ses` QR, same-tab Studio).
2. Cloud base → Admin list/create/patch/delete frames and stickers.
3. Reveal → QR with `ses` → phone Studio loads PNG + correct frame.
4. Re-open same QR → still loads (reusable capability).
5. Admin recent panel shows the new capture after POST; empty after explaining process restart is acceptable.
6. Missing/wrong `VITE_ADMIN_AUTH` → Admin writes fail with clear message; public GETs still work.

---

## 8. Out of scope / later

- Deleting the Worker from Cloudflare dashboards / DNS (ops outside this repo).
- Migrating existing R2/D1 custom assets into Photobooth (manual re-upload via Admin is acceptable).
- Guest sticker save-back API.
- Hardening Auth beyond shared header (product uses fixed Admin Auth today).
---
