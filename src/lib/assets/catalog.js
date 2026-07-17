/**
 * Seed (built-in) frames & stickers shipped with the app.
 * Custom art is added via the Admin UI (IndexedDB) — see assetStore.js.
 * Edit this file only when shipping new defaults in the repo.
 */

/** @typedef {{ id: string; name: string; src: string; motif?: string; thumb?: string }} FrameAsset */
/** @typedef {{ id: string; name: string; src: string }} StickerAsset */

/** @type {FrameAsset[]} */
export const FRAMES = [
	{
		id: 'olympus',
		name: 'OLYMPUS',
		motif: 'Columns',
		src: '/assets/frames/olympus.svg',
		thumb: '/assets/frames/olympus.svg'
	},
	{
		id: 'laurel',
		name: 'LAUREL',
		motif: 'Victory wreath',
		src: '/assets/frames/laurel.svg',
		thumb: '/assets/frames/laurel.svg'
	},
	{
		id: 'trident',
		name: 'POSEIDON',
		motif: 'Wave border',
		src: '/assets/frames/trident.svg',
		thumb: '/assets/frames/trident.svg'
	},
	{
		id: 'lyre',
		name: 'LYRE',
		motif: 'Golden lyre',
		src: '/assets/frames/lyre.svg',
		thumb: '/assets/frames/lyre.svg'
	},
	{
		id: 'owl',
		name: 'ATHENA',
		motif: 'Owl crest',
		src: '/assets/frames/owl.svg',
		thumb: '/assets/frames/owl.svg'
	}
];

/** @type {StickerAsset[]} */
export const STICKERS = [
	{ id: 'lightning', name: 'ZEUS BOLT', src: '/assets/stickers/lightning.svg' },
	{ id: 'laurel', name: 'LAUREL', src: '/assets/stickers/laurel.svg' },
	{ id: 'lyre', name: 'LYRE', src: '/assets/stickers/lyre.svg' },
	{ id: 'owl', name: 'OWL', src: '/assets/stickers/owl.svg' },
	{ id: 'trident', name: 'TRIDENT', src: '/assets/stickers/trident.svg' },
	{ id: 'sun', name: 'SOLAR', src: '/assets/stickers/sun.svg' },
	{ id: 'star', name: 'STAR', src: '/assets/stickers/star.svg' },
	{ id: 'heart', name: 'AEGIS', src: '/assets/stickers/heart.svg' }
];

/**
 * @param {string | null} id
 * @returns {FrameAsset | undefined}
 */
export function getFrameById(id) {
	if (!id) return undefined;
	return FRAMES.find((f) => f.id === id);
}
