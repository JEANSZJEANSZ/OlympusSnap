# Storage Model — Frames, Stickers & Capture Handoff

This document explains **what gets saved**, **where**, and **how frame photo-canvas coordinates work**.

The live stack is Cloudflare: Worker API + R2 blobs + D1 metadata. Seeds still ship from [`catalog.js`](../src/lib/assets/catalog.js). Captures fall back to [`sessionStub.js`](../src/lib/session/sessionStub.js) only if the API is down. See [photobooth-backend.md](./photobooth-backend.md) for routes.

---

## Overview

| Data | Image blob | Metadata | Special fields |
|------|------------|----------|----------------|
| **Custom frame** | PNG file | name, motif, w, h | `slots[]` — photo canvas rects |
| **Custom sticker** | PNG file | name | none |
| **Capture (session)** | PNG composite | frameId | reusable capability `id` + `key` for QR |

The app does **not** auto-detect transparent holes in frame PNGs. Seed frames ship with pre-calculated `slots`. Admin crop + slot editors (and the Worker) store the same `{id,x,y,w,h}` array.

---

## Frame slots (photo canvases) — the important part

### What is a slot?

Each slot is one photo window on the frame. A 3-photo strip has **3 slot objects** in an array.

```json
{
  "id": "slot-m2abc123",
  "x": 0.09459,
  "y": 0.06422,
  "w": 0.81081,
  "h": 0.73394
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Stable id for this slot within the frame (UI list key, ordering) |
| `x` | number 0–1 | Left edge as **fraction of frame image width** |
| `y` | number 0–1 | Top edge as **fraction of frame image height** |
| `w` | number 0–1 | Width as **fraction of frame image width** |
| `h` | number 0–1 | Height as **fraction of frame image height** |

**Not pixels.** Coordinates are normalized to the frame PNG’s natural size (`w` × `h` on the asset record).

### Example

Frame PNG is **600 × 800** px. One slot:

```json
{ "id": "slot-1", "x": 0.1, "y": 0.05, "w": 0.8, "h": 0.7 }
```

Pixel rect on export canvas:

```
left   = 0.1  × 600 = 60 px
top    = 0.05 × 800 = 40 px
width  = 0.8  × 600 = 480 px
height = 0.7  × 800 = 560 px
```

Same math at any export resolution — scale multiplies all four.

### How slots are authored

Slots are authored in Admin (`FrameSlotEditor`) or offline for seeds. `normalizeSlots()` in [`assetStore.js`](../src/lib/assets/assetStore.js) clamps values (min size 0.01, inside 0–1). Frames need **at least one slot**.

### How slots are consumed (booth + export)

**Camera preview** — CSS percentages on holes aligned to frame art:

```svelte
style:left="{slot.x * 100}%"
style:top="{slot.y * 100}%"
style:width="{slot.w * 100}%"
style:height="{slot.h * 100}%"
```

Slot index `i` maps to photo `photos[i]`. Slot count = number of snaps required.

**Final composite** — [`canvasRenderer.js`](../src/lib/utils/canvasRenderer.js):

1. Load frame PNG at natural size (× export scale).
2. For each slot `i`, cover-fit photo `i` into pixel rect `(x×W, y×H, w×W, h×H)`.
3. Draw frame PNG on top (borders/overhang in front of photos).
4. `canvas.toDataURL('image/png')`.

**Code:** [`src/views/03_Camera.svelte`](../src/views/03_Camera.svelte), [`src/lib/utils/canvasRenderer.js`](../src/lib/utils/canvasRenderer.js).

### Seed frames use the same format

Built-in frames in [`catalog.js`](../src/lib/assets/catalog.js) ship with pre-calculated `slots` arrays — same JSON shape as customs.

---

## Full frame asset record

### Logical shape (what your API should return)

```json
{
  "id": "frame-abc123",
  "kind": "frame",
  "name": "CUSTOM STRIP",
  "motif": "optional tag",
  "src": "https://cdn.example.com/frames/frame-abc123.png",
  "w": 600,
  "h": 800,
  "slots": [
    { "id": "slot-1", "x": 0.05, "y": 0.08, "w": 0.9, "h": 0.25 },
    { "id": "slot-2", "x": 0.05, "y": 0.38, "w": 0.9, "h": 0.25 },
    { "id": "slot-3", "x": 0.05, "y": 0.68, "w": 0.9, "h": 0.25 }
  ],
  "custom": true
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | UUID or prefixed id |
| `kind` | yes | always `"frame"` |
| `name` | yes | Display name |
| `motif` | no | Optional subtitle/tag |
| `src` | yes | Public URL to PNG (must support CORS for canvas export) |
| `w`, `h` | recommended | Natural pixel dimensions of PNG |
| `slots` | yes for customs | JSON array; min length 1 |
| `custom` | yes | `true` for uploaded frames |

---

## Sticker asset record

Stickers have **no slots** — image + name only.

```json
{
  "id": "sticker-xyz789",
  "kind": "sticker",
  "name": "LIGHTNING",
  "src": "https://cdn.example.com/stickers/sticker-xyz789.png",
  "custom": true
}
```

Admin can upload **multiple PNGs at once**; each file becomes one sticker row.

---

## Capture handoff (QR → Studio)

After Camera/Reveal, the booth stores an **unstickered composite** (JPEG preferred) so Studio can add stickers. The Worker writes `captures/{id}` in R2 and a D1 row with a hashed capability key. Same-tab stub is fallback only.

### Create (booth)

`createSession({ imageDataUrl, frameId })` → `{ id, key, frameId }`.

### Load (guest, reusable)

`loadCapture(id, key)` → `{ imageDataUrl, frameId }`.

- Same `id`+`key` may be opened again (reusable capability, not one-time consume).
- Missing/invalid key → treat as 401/403/404.

QR URL: `{VITE_PUBLIC_ORIGIN}{base}/studio?ses={base64url(`${id}::${key}`)}`

### Capture metadata (logical)

| Field | Type | Meaning |
|-------|------|---------|
| `id` | UUID | Capture id (in QR via `ses`) |
| `key` | string | Capability secret (paired with id) |
| `image` | blob | Composite PNG (photos in slots + frame, no stickers) |
| `frame_id` | string? | Which frame was used (for Studio context) |
| `created_at` | timestamp | TTL / recent-admin ring |

**Code:** [`src/lib/session/sessionClient.js`](../src/lib/session/sessionClient.js).

---

## Current stack

| Piece | Role |
|-------|------|
| Cloudflare Workers + Assets | SPA (`dist`) + `/api/*` |
| R2 `olympus-snap` | Blobs: `frames/`, `stickers/`, `captures/` |
| D1 `olympus-snap` | Asset metadata + capture `{id,key_hash,frame_id}` |
| Cron `0 0 * * *` | `DELETE FROM captures` (metadata only) |
| R2 lifecycle | Expire `captures/` after 1 day |

Seeds remain in the client. Customs persist. Session photos wipe.

---

## Mapping to a production database

Split **blobs** and **metadata** the same way:

### Recommended schema

**`assets`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `kind` | enum | `frame`, `sticker` |
| `name` | varchar | |
| `motif` | varchar nullable | |
| `image_url` | varchar | Object storage / CDN URL |
| `width` | int nullable | PNG natural width |
| `height` | int nullable | PNG natural height |
| `slots` | **JSONB** nullable | Frame only — same array shape |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Option A — JSONB column (simplest):**

```sql
slots JSONB  -- [{"id":"slot-1","x":0.1,"y":0.05,"w":0.8,"h":0.7}, ...]
```

**Option B — normalized table (if you need SQL queries per slot):**

```sql
CREATE TABLE frame_slots (
  id TEXT PRIMARY KEY,
  frame_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  slot_index INT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  w DOUBLE PRECISION NOT NULL,
  h DOUBLE PRECISION NOT NULL,
  UNIQUE (frame_id, slot_index)
);
```

When reading a frame for the app, either return embedded `slots` JSON or `JOIN frame_slots ORDER BY slot_index` and build the array.

**`captures`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `key_hash` | varchar | Store hashed capability key |
| `image_url` | varchar | Or object key in blob storage |
| `frame_id` | UUID FK nullable | |
| `created_at` | timestamptz | |

### API contract the frontend expects

Route names are up to the backend. Payloads must match:

| Job | Notes |
|-----|--------|
| List frames + stickers | Merge into app `assets[]`; `slots` on frames |
| Frame/sticker image URLs | Stream PNG; **CORS** required for canvas |
| Create capture | Body with image + frameId → `{ id, key, frameId }` |
| Load capture | Image + `frameId`; reusable `id`+`key` |

Frontend modules: [`assetStore.js`](../src/lib/assets/assetStore.js), [`sessionClient.js`](../src/lib/session/sessionClient.js).

---

## Validation rules (implement on server)

Copy from [`normalizeSlots()`](../src/lib/assets/assetStore.js):

- `slots` required for `kind = frame`, min 1 entry
- Each slot: `x`, `y`, `w`, `h` finite numbers
- `w`, `h` ≥ 0.01
- `x`, `y` ≥ 0; `x + w` ≤ 1; `y + h` ≤ 1
- `id` string (generate if missing)

Frames and stickers: **PNG only**, transparency expected.

---

## End-to-end flow diagrams

### Frame catalog

```
catalog.js seeds (and later: remote list)
        │
        ▼
initAssets() → frames / stickers stores
        │
        ▼
Camera uses slots for hole CSS + snap count
        │
        ▼
compositeFramePhotos() → Reveal → createSession()
```

### Capture handoff

```
Reveal composites photos + frame (no stickers)
        │
        ▼
createSession({ imageDataUrl, frameId })
        │
        ▼
{ id, key, frameId }  — Worker persist, stub fallback
        │
        ▼
QR → loadCapture(id, key)
        │
        ▼
Studio loads image + frameId → sticker editor
```

---

## Checklist for your real database

- [ ] Store frame PNG in blob storage; URL on asset record
- [ ] Store `slots` as JSONB (or `frame_slots` table) — **same `{id,x,y,w,h}` shape**
- [ ] Store sticker PNG the same way without slots
- [ ] Store capture PNG + `frame_id` + reusable capability key
- [ ] Serve asset URLs with `Access-Control-Allow-Origin` (canvas export breaks without CORS)
- [ ] Keep Admin-only auth on POST/PATCH/DELETE assets and recent captures
- [ ] Return `slots` array on frame list so guest phones load customs in Studio

---

## Related docs

- [photobooth-backend.md](./photobooth-backend.md) — attach points, QR `ses`, Worker + R2 + D1
