/**
 * Seed (built-in) frames & stickers shipped with the app.
 * Custom art is added via the Admin UI (IndexedDB) — see assetStore.js.
 * Edit this file only when shipping new defaults in the repo.
 */

/** @typedef {{ id: string; name: string; src: string; motif?: string; thumb?: string }} FrameAsset */
/** @typedef {{ id: string; name: string; src: string }} StickerAsset */

/** Respect Vite `base` so public assets resolve under IIS subpaths. */
const assetUrl = (/** @type {string} */ path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/** @type {FrameAsset[]} */
export const FRAMES = [
	{
		id: 'olympus',
		name: 'OLYMPUS',
		motif: 'Columns',
		src: assetUrl('assets/frames/olympus.svg'),
		thumb: assetUrl('assets/frames/olympus.svg')
	},
	{
		id: 'laurel',
		name: 'LAUREL',
		motif: 'Victory wreath',
		src: assetUrl('assets/frames/laurel.svg'),
		thumb: assetUrl('assets/frames/laurel.svg')
	},
	{
		id: 'trident',
		name: 'POSEIDON',
		motif: 'Wave border',
		src: assetUrl('assets/frames/trident.svg'),
		thumb: assetUrl('assets/frames/trident.svg')
	},
	{
		id: 'lyre',
		name: 'LYRE',
		motif: 'Golden lyre',
		src: assetUrl('assets/frames/lyre.svg'),
		thumb: assetUrl('assets/frames/lyre.svg')
	},
	{
		id: 'owl',
		name: 'ATHENA',
		motif: 'Owl crest',
		src: assetUrl('assets/frames/owl.svg'),
		thumb: assetUrl('assets/frames/owl.svg')
	}
];

/** @type {StickerAsset[]} */
export const STICKERS = [
	{ id: 'lightning', name: 'ZEUS BOLT', src: assetUrl('assets/stickers/lightning.svg') },
	{ id: 'laurel', name: 'LAUREL', src: assetUrl('assets/stickers/laurel.svg') },
	{ id: 'lyre', name: 'LYRE', src: assetUrl('assets/stickers/lyre.svg') },
	{ id: 'owl', name: 'OWL', src: assetUrl('assets/stickers/owl.svg') },
	{ id: 'trident', name: 'TRIDENT', src: assetUrl('assets/stickers/trident.svg') },
	{ id: 'sun', name: 'SOLAR', src: assetUrl('assets/stickers/sun.svg') },
	{ id: 'star', name: 'STAR', src: assetUrl('assets/stickers/star.svg') },
	{ id: 'heart', name: 'AEGIS', src: assetUrl('assets/stickers/heart.svg') }
];

/**
 * @param {string | null} id
 * @returns {FrameAsset | undefined}
 */
export function getFrameById(id) {
	if (!id) return undefined;
	return FRAMES.find((f) => f.id === id);
}
