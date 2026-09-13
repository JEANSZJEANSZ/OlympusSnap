# Frames & stickers

## Seeds (no backend)

Built-in frames live in [`catalog.js`](./catalog.js) and `public/assets/frames/`. Guest flow reads the live stores from [`assetStore.js`](./assetStore.js).

`STICKERS` is empty until a catalog or Cloudflare backend supplies them. Studio still works.

## Admin

Long-press `OLYMPUS_SNAP` → PIN `olympus`. Settings only: seed-frame toggle, booth-flow flags, PIN. No upload.

## Future Cloudflare catalog

Merge remote frames/stickers in `initAssets()`. Keep the record shapes in [docs/storage-model.md](../../../docs/storage-model.md).
