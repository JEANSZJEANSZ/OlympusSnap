/**
 * Seed (built-in) frames & stickers shipped with the app.
 * Custom art is added via the Admin UI (IndexedDB) — see assetStore.js.
 * Photobooth blank templates: regenerate SVGs with `node scripts/generate-seed-frames.mjs`.
 */

/** @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot */
/** @typedef {{ id: string; name: string; src: string; motif?: string; thumb?: string; w?: number; h?: number; slots?: FrameSlot[] }} FrameAsset */
/** @typedef {{ id: string; name: string; src: string }} StickerAsset */

/** Respect Vite `base` so public assets resolve under IIS subpaths. */
const assetUrl = (/** @type {string} */ path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/** @type {FrameAsset[]} */
export const FRAMES = [
	{
		id: 'strip-4',
		name: 'STRIP 4',
		motif: '4-up booth strip',
		src: assetUrl('assets/frames/strip-4.svg'),
		thumb: assetUrl('assets/frames/strip-4.svg'),
		w: 220,
		h: 828,
		slots: [
			{ id: 'slot-1', x: 0.09091, y: 0.02415, w: 0.81818, h: 0.21739 },
			{ id: 'slot-2', x: 0.09091, y: 0.25604, w: 0.81818, h: 0.21739 },
			{ id: 'slot-3', x: 0.09091, y: 0.48792, w: 0.81818, h: 0.21739 },
			{ id: 'slot-4', x: 0.09091, y: 0.71981, w: 0.81818, h: 0.21739 }
		]
	},
	{
		id: 'strip-3',
		name: 'STRIP 3',
		motif: '3-up booth strip',
		src: assetUrl('assets/frames/strip-3.svg'),
		thumb: assetUrl('assets/frames/strip-3.svg'),
		w: 268,
		h: 768,
		slots: [
			{ id: 'slot-1', x: 0.08955, y: 0.02865, w: 0.8209, h: 0.28646 },
			{ id: 'slot-2', x: 0.08955, y: 0.33333, w: 0.8209, h: 0.28646 },
			{ id: 'slot-3', x: 0.08955, y: 0.63802, w: 0.8209, h: 0.28646 }
		]
	},
	{
		id: 'strip-2',
		name: 'STRIP 2',
		motif: '2-up booth strip',
		src: assetUrl('assets/frames/strip-2.svg'),
		thumb: assetUrl('assets/frames/strip-2.svg'),
		w: 332,
		h: 504,
		slots: [
			{ id: 'slot-1', x: 0.07831, y: 0.04762, w: 0.84337, h: 0.39683 },
			{ id: 'slot-2', x: 0.07831, y: 0.47619, w: 0.84337, h: 0.39683 }
		]
	},
	{
		id: 'polaroid-portrait',
		name: 'POLAROID TALL',
		motif: 'Portrait polaroid',
		src: assetUrl('assets/frames/polaroid-portrait.svg'),
		thumb: assetUrl('assets/frames/polaroid-portrait.svg'),
		w: 296,
		h: 436,
		slots: [{ id: 'slot-1', x: 0.09459, y: 0.06422, w: 0.81081, h: 0.73394 }]
	},
	{
		id: 'polaroid-square',
		name: 'POLAROID SQUARE',
		motif: 'Square polaroid',
		src: assetUrl('assets/frames/polaroid-square.svg'),
		thumb: assetUrl('assets/frames/polaroid-square.svg'),
		w: 336,
		h: 396,
		slots: [{ id: 'slot-1', x: 0.08333, y: 0.07071, w: 0.83333, h: 0.70707 }]
	},
	{
		id: 'polaroid-landscape',
		name: 'POLAROID WIDE',
		motif: 'Landscape polaroid',
		src: assetUrl('assets/frames/polaroid-landscape.svg'),
		thumb: assetUrl('assets/frames/polaroid-landscape.svg'),
		w: 416,
		h: 356,
		slots: [{ id: 'slot-1', x: 0.06731, y: 0.07865, w: 0.86538, h: 0.67416 }]
	},
	{
		id: 'classic-portrait',
		name: 'CLASSIC TALL',
		motif: 'Portrait matte',
		src: assetUrl('assets/frames/classic-portrait.svg'),
		thumb: assetUrl('assets/frames/classic-portrait.svg'),
		w: 304,
		h: 384,
		slots: [{ id: 'slot-1', x: 0.10526, y: 0.08333, w: 0.78947, h: 0.83333 }]
	},
	{
		id: 'classic-square',
		name: 'CLASSIC SQUARE',
		motif: 'Square matte',
		src: assetUrl('assets/frames/classic-square.svg'),
		thumb: assetUrl('assets/frames/classic-square.svg'),
		w: 344,
		h: 344,
		slots: [{ id: 'slot-1', x: 0.09302, y: 0.09302, w: 0.81395, h: 0.81395 }]
	},
	{
		id: 'classic-landscape',
		name: 'CLASSIC WIDE',
		motif: 'Landscape matte',
		src: assetUrl('assets/frames/classic-landscape.svg'),
		thumb: assetUrl('assets/frames/classic-landscape.svg'),
		w: 424,
		h: 304,
		slots: [{ id: 'slot-1', x: 0.07547, y: 0.10526, w: 0.84906, h: 0.78947 }]
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
