# Frames & stickers

## Seeds

Built-in frames live in [`catalog.js`](./catalog.js) and `public/assets/frames/`. Guest flow reads the live stores from [`assetStore.js`](./assetStore.js).

`STICKERS` is empty until Admin uploads customs (or a catalog seed is added). Studio still works.

## Admin

Long-press `OLYMPUS_SNAP` → type the Worker `ADMIN_PIN` at Cerberus (production). Guest landing / frame / camera never ask. Dev (`npm run dev`) skips the Admin gate.

Admin uploads frames (crop + photo canvases) and stickers to the Worker. Seeds stay read-only. Session photos are not managed here — they wipe nightly.

## Cloudflare catalog

`initAssets()` merges `GET /api/frames` and `GET /api/stickers` with seeds. Record shapes: [docs/storage-model.md](../../../docs/storage-model.md).
