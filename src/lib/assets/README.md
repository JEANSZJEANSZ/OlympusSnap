# Adding frames & stickers

## Preferred: Admin UI (no code)

1. On the booth, **long-press** the `OLYMPUS_SNAP` brand in the top bar (~1s).
2. Enter the Admin PIN (default: `olympus` — changeable in Admin).
3. Pick **Frames** or **Stickers** → set a name → **Choose Image** (PNG / SVG / WebP).
4. Customs are stored in this tablet’s **IndexedDB**. Seeds stay read-only.
5. Use **Export JSON** / **Import JSON** to move a catalog between tablets.

## Repo seeds only

Edit [`catalog.js`](./catalog.js) when you want new **built-in** art shipped with the app (files under `public/assets/…`). Guest flow reads the live stores from [`assetStore.js`](./assetStore.js) (seeds + customs).
