# Storage Model — Frames, Stickers & Capture Handoff

This document explains **what gets saved**, **where**, and **how frame photo-canvas coordinates work**, so you can implement the same contract against **OpenHouse Photobooth** (or another production API) instead of local-only IndexedDB.

Cloud backend for this app: **Photobooth** (`/api/photobooth` on SFOpenHouseAPI). See [photobooth-backend.md](./photobooth-backend.md).

---

## Overview

| Data | Image blob | Metadata | Special fields |
|------|------------|----------|----------------|
| **Custom frame** | PNG file | name, motif, w, h | `slots[]` — photo canvas rects |
| **Custom sticker** | PNG file | name | none |
| **Capture (session)** | PNG composite | frameId | reusable capability `id` + `key` for QR |

The app does **not** auto-detect transparent holes in frame PNGs. An admin **draws rectangles** on the frame in Admin → those become `slots`.

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

### How slots are created (Admin)

1. Admin uploads/crops a frame PNG.
2. `FrameSlotEditor` overlays the image; pointer positions convert to 0–1:

   ```
   x = (clientX - overlayLeft) / overlayWidth
   y = (clientY - overlayTop)  / overlayHeight
   ```

3. Admin drag-draws one or more rectangles.
4. On save, `normalizeSlots()` clamps values into valid ranges (min size 0.01, inside 0–1).
5. Frame must have **at least one slot** before save.

**Code:** [`src/lib/components/FrameSlotEditor.svelte`](../src/lib/components/FrameSlotEditor.svelte), [`src/lib/assets/assetStore.js`](../src/lib/assets/assetStore.js) (`normalizeSlots`).

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

After Camera/Reveal, the booth uploads an **unstickered composite PNG** so the guest phone can open Studio and add stickers.

### Create (booth)

**Request:** `POST /api/photobooth/captures`

```json
{
  "imageBase64": "<base64 PNG without data: prefix, or data-URL>",
  "frameId": "frame-abc123",
  "contentType": "image/png"
}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "<capability-secret>",
  "frameId": "frame-abc123"
}
```

### Load (guest phone, reusable)

**Request:** `GET /api/photobooth/captures/:id?key=...`

**Response:** raw PNG body + header `X-Frame-Id: frame-abc123`

- Same `id`+`key` may be opened again (reusable capability, not one-time consume).
- Missing/invalid key → 401/403/404.

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

## Current cloud stack (Photobooth)

```
┌──────────────────┐     meta + enc blobs     ┌────────────────────┐
│  Photobooth API  │◄─────────────────────────│  Booth / Admin /   │
│  /api/photobooth │                          │  guest Studio      │
│  frames/stickers │                          └────────────────────┘
│  captures        │
└──────────────────┘
```

| Mode | Trigger | Customs | Captures |
|------|---------|---------|----------|
| Cloud | `VITE_API_BASE` set | Photobooth frames/stickers | Photobooth captures (`id`+`key`) |
| Offline | `VITE_API_BASE` empty | IndexedDB (data URL `src`) | In-memory stub (same `ses` shape) |

Admin writes and recent-capture peek send header `Auth: {VITE_ADMIN_AUTH}`. Public GETs do not.

### Offline fallback (no cloud)

When `VITE_API_BASE` is unset:

- **Assets:** IndexedDB, same JSON shape; `src` is a data URL instead of HTTP URL.
- **Captures:** in-memory Map on the booth tab (same-machine / same-tab Studio).

---

## Mapping to a production database

Photobooth is the production-facing API for this app. If you host your own store, split **blobs** and **metadata** the same way:

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

### API contract the frontend expects (Photobooth)

| Endpoint | Notes |
|----------|-------|
| `GET /api/photobooth/frames` + `.../stickers` | Merge into app `assets[]`; `slots` on frames |
| `GET` frame/sticker image URLs | Stream PNG; **CORS** required for canvas |
| `POST /api/photobooth/frames` or `.../stickers` | Multipart: `File`, `Name`, `Slots` / `Motif` (PascalCase) |
| `PATCH` / `DELETE` on kind paths | Admin `Auth` header |
| `POST /api/photobooth/captures` | Body with image + frameId → `{ id, key, frameId }` |
| `GET /api/photobooth/captures/:id?key=` | PNG body + `X-Frame-Id`; reusable |
| `GET /api/photobooth/admin/captures/recent` | Admin Auth; last few previews |

Frontend modules: [`assetApi.js`](../src/lib/assets/assetApi.js), [`assetStore.js`](../src/lib/assets/assetStore.js), [`sessionClient.js`](../src/lib/session/sessionClient.js).

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

### Custom frame save

```
Admin draws slots on PNG
        │
        ▼
slots[] normalized 0–1
        │
        ├── Cloud: POST /api/photobooth/frames (multipart)
        │         → encrypted blob + meta on Photobooth
        │
        └── Local: IndexedDB record (src = data URL, slots inline)
        │
        ▼
initAssets() → frames store
        │
        ▼
Camera uses slots for hole CSS + snap count
        │
        ▼
compositeFramePhotos() → Reveal → capture upload
```

### Capture handoff

```
Reveal composites photos + frame (no stickers)
        │
        ▼
POST /api/photobooth/captures { imageBase64, frameId }
        │
        ▼
{ id, key, frameId }
        │
        ▼
QR → guest phone GET .../captures/{id}?key=...
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

- [photobooth-backend.md](./photobooth-backend.md) — env, QR `ses`, offline vs cloud
- [Photobooth API integration design](./superpowers/specs/2026-08-11-photobooth-api-integration-design.md)
