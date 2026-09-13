/**
 * Live asset catalog: seed frames/stickers + Cloudflare customs.
 */
import { get, writable } from 'svelte/store';
import {
	createAsset as apiCreateAsset,
	deleteAsset as apiDeleteAsset,
	listCustoms,
	patchAsset as apiPatchAsset,
	resolveCloudAssetSrc
} from './assetApi.js';
import { FRAMES as SEED_FRAMES, STICKERS as SEED_STICKERS } from './catalog.js';
import { measureImage } from '../utils/imageCrop.js';
import { warmFrameImages } from '../utils/loadImageForCanvas.js';

const SEED_FRAMES_KEY = 'olympus-snap-show-seed-frames';
const RANDOM_FRAME_KEY = 'olympus-snap-random-frame';
const GESTURE_SNAP_KEY = 'olympus-snap-gesture-snap';
const GESTURE_FRAME_KEY = 'olympus-snap-gesture-frame';
const ORACLE_SHUFFLE_KEY = 'olympus-snap-oracle-shuffle';
const ORACLE_SHUFFLE_MS_KEY = 'olympus-snap-oracle-shuffle-ms';

export const ORACLE_SHUFFLE_MIN_MS = 800;
export const ORACLE_SHUFFLE_MAX_MS = 5000;
export const ORACLE_SHUFFLE_DEFAULT_MS = 2600;

/** Canonical Camera shutter poses — playlist cycles this order across canvases. */
export const GESTURE_SNAP_KINDS = /** @type {const} */ ([
	{ id: 'Victory', label: 'VICTORY', hint: 'peace' },
	{ id: 'Open_Palm', label: 'STOP', hint: 'open palm' },
	{ id: 'Thumb_Up', label: 'THUMB', hint: 'thumbs up' }
]);

/** @typedef {'Victory' | 'Open_Palm' | 'Thumb_Up'} GestureSnapKind */

/** Legacy preset → ms (one-time migrate). */
const ORACLE_SHUFFLE_PRESET_MS = /** @type {const} */ ({
	short: 1400,
	medium: 2600,
	long: 4200
});

/** @param {string} key @param {boolean} fallback */
function readFlag(key, fallback = true) {
	try {
		const v = localStorage.getItem(key);
		if (v === null) return fallback;
		return v === '1' || v === 'true';
	} catch {
		return fallback;
	}
}

/** @param {string} key @param {boolean} on */
function writeFlag(key, on) {
	try {
		localStorage.setItem(key, on ? '1' : '0');
	} catch {
		/* ignore quota / private mode */
	}
}

/** @param {string} key @param {boolean} fallback */
function readSessionFlag(key, fallback = false) {
	try {
		const v = sessionStorage.getItem(key);
		if (v === null) return fallback;
		return v === '1' || v === 'true';
	} catch {
		return fallback;
	}
}

/** @param {string} key @param {boolean} on */
function writeSessionFlag(key, on) {
	try {
		sessionStorage.setItem(key, on ? '1' : '0');
	} catch {
		/* ignore quota / private mode */
	}
}

/** @param {number} ms */
function clampShuffleMs(ms) {
	const n = Math.round(Number(ms) || ORACLE_SHUFFLE_DEFAULT_MS);
	const stepped = Math.round(n / 100) * 100;
	return Math.min(ORACLE_SHUFFLE_MAX_MS, Math.max(ORACLE_SHUFFLE_MIN_MS, stepped));
}

/** @returns {number} */
function readOracleShuffleMs() {
	try {
		const raw = sessionStorage.getItem(ORACLE_SHUFFLE_MS_KEY);
		if (raw != null && raw !== '') {
			const n = Number(raw);
			if (Number.isFinite(n)) return clampShuffleMs(n);
		}
		const legacy = sessionStorage.getItem(ORACLE_SHUFFLE_KEY);
		if (legacy === 'short' || legacy === 'medium' || legacy === 'long') {
			const migrated = ORACLE_SHUFFLE_PRESET_MS[legacy];
			sessionStorage.setItem(ORACLE_SHUFFLE_MS_KEY, String(migrated));
			return migrated;
		}
	} catch {
		/* ignore */
	}
	return ORACLE_SHUFFLE_DEFAULT_MS;
}

/**
 * @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot
 * @typedef {{ id: string; name: string; src: string; motif?: string; thumb?: string; w?: number; h?: number; slots?: FrameSlot[]; custom?: boolean }} FrameAsset
 * @typedef {{ id: string; name: string; src: string; custom?: boolean }} StickerAsset
 */

/** @type {import('svelte/store').Writable<FrameAsset[]>} */
export const frames = writable(readFlag(SEED_FRAMES_KEY, true) ? seedFrames() : []);

/** @type {import('svelte/store').Writable<StickerAsset[]>} */
export const stickers = writable(seedStickers());

/** When false, seed frames are hidden from guests. Default on for booth testing. */
/** @type {import('svelte/store').Writable<boolean>} */
export const showSeedFrames = writable(readFlag(SEED_FRAMES_KEY, true));

/**
 * When true, Frame Select runs a Pythia oracle pick instead of pull-to-select.
 * Session-scoped (survives refresh, clears when the tab closes).
 */
/** @type {import('svelte/store').Writable<boolean>} */
export const randomFrame = writable(readSessionFlag(RANDOM_FRAME_KEY, false));

/**
 * When true, Camera Temple arms per-canvas gesture shutter (SNAP button still works).
 * Session-scoped; default on for booth guests.
 */
/** @type {import('svelte/store').Writable<boolean>} */
export const gestureSnap = writable(readSessionFlag(GESTURE_SNAP_KEY, true));

/**
 * When true, Frame Select arms air-swipe / rope-tug (camera PIP).
 * Session-scoped; default off so mouse booths do not open the camera early.
 */
/** @type {import('svelte/store').Writable<boolean>} */
export const gestureFrame = writable(readSessionFlag(GESTURE_FRAME_KEY, false));

/** Oracle lot-spin duration in ms. Session-scoped. */
/** @type {import('svelte/store').Writable<number>} */
export const oracleShuffleMs = writable(readOracleShuffleMs());

/** @type {import('svelte/store').Writable<boolean>} */
export const assetsReady = writable(false);

/** Last remote catalog failure; null when load succeeded. */
/** @type {import('svelte/store').Writable<string | null>} */
export const catalogError = writable(null);

/** @type {import('./assetApi.js').CloudAsset[]} */
let cachedCustoms = [];

function seedFrames() {
	return SEED_FRAMES.map((f) => ({ ...f, custom: false }));
}

function seedStickers() {
	return SEED_STICKERS.map((s) => ({ ...s, custom: false }));
}

/**
 * @param {unknown} raw
 * @returns {FrameSlot[] | undefined}
 */
function normalizeSlots(raw) {
	if (!Array.isArray(raw) || raw.length === 0) return undefined;
	/** @type {FrameSlot[]} */
	const out = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const s = /** @type {Record<string, unknown>} */ (item);
		const x = Number(s.x);
		const y = Number(s.y);
		const w = Number(s.w);
		const h = Number(s.h);
		if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
		if (w < 0.01 || h < 0.01) continue;
		out.push({
			id: typeof s.id === 'string' ? s.id : `slot-${out.length + 1}`,
			x: Math.min(1, Math.max(0, x)),
			y: Math.min(1, Math.max(0, y)),
			w: Math.min(1, Math.max(0.01, w)),
			h: Math.min(1, Math.max(0.01, h))
		});
	}
	return out.length ? out : undefined;
}

/**
 * @param {import('./assetApi.js').CloudAsset[]} [customs]
 */
function rebuildStores(customs = cachedCustoms) {
	cachedCustoms = customs;
	const customFrames = customs
		.filter((a) => a.kind === 'frame')
		.map((a) => {
			const src = resolveCloudAssetSrc(a.src);
			return {
				id: a.id,
				name: a.name,
				src,
				motif: a.motif,
				thumb: src,
				w: a.w,
				h: a.h,
				slots: normalizeSlots(a.slots),
				custom: true
			};
		});
	const customStickers = customs
		.filter((a) => a.kind === 'sticker')
		.map((a) => ({
			id: a.id,
			name: a.name,
			src: resolveCloudAssetSrc(a.src),
			custom: true
		}));

	const includeFrames = get(showSeedFrames);
	frames.set([...(includeFrames ? seedFrames() : []), ...customFrames]);
	stickers.set([...seedStickers(), ...customStickers]);
	warmCatalogImages();
}

function warmCatalogImages() {
	void warmFrameImages([
		...get(frames).map((f) => f.src),
		...get(stickers).map((s) => s.src)
	]);
}

rebuildStores();

/** @param {boolean} on */
export function setShowSeedFrames(on) {
	showSeedFrames.set(!!on);
	writeFlag(SEED_FRAMES_KEY, !!on);
	rebuildStores(cachedCustoms);
}

/**
 * Apply booth frame catalog flag from a guest Studio URL (`sf` query param).
 */
export function applyGuestCatalogFlagsFromUrl() {
	if (typeof location === 'undefined') return;
	const params = new URLSearchParams(location.search);
	if (params.has('sf')) {
		setShowSeedFrames(params.get('sf') !== '0');
	}
}

/** @param {boolean} on */
export function setRandomFrame(on) {
	randomFrame.set(!!on);
	writeSessionFlag(RANDOM_FRAME_KEY, !!on);
}

/** @param {boolean} on */
export function setGestureSnap(on) {
	gestureSnap.set(!!on);
	writeSessionFlag(GESTURE_SNAP_KEY, !!on);
}

/** @param {boolean} on */
export function setGestureFrame(on) {
	gestureFrame.set(!!on);
	writeSessionFlag(GESTURE_FRAME_KEY, !!on);
}

/** @param {number} ms */
export function setOracleShuffleMs(ms) {
	const next = clampShuffleMs(ms);
	oracleShuffleMs.set(next);
	try {
		sessionStorage.setItem(ORACLE_SHUFFLE_MS_KEY, String(next));
	} catch {
		/* ignore */
	}
}

/**
 * Load seed catalog + remote customs. Seeds still work if the Worker is down.
 */
export async function initAssets() {
	try {
		const customs = await listCustoms();
		rebuildStores(customs);
		catalogError.set(null);
	} catch (err) {
		console.warn('[assets] Custom catalog unavailable, using seeds only', err);
		catalogError.set(err instanceof Error ? err.message : String(err));
		rebuildStores([]);
	} finally {
		assetsReady.set(true);
	}
}

/**
 * @param {File} file
 * @returns {boolean}
 */
export function isAssetImageFile(file) {
	if (file.type === 'image/png' || file.type === 'image/webp') return true;
	if (!file.type && /\.(png|webp)$/i.test(file.name)) return true;
	return false;
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(/** @type {string} */ (reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
		reader.readAsDataURL(file);
	});
}

/**
 * @param {{ name: string; motif?: string; file?: File; src?: string; slots: import('./assetApi.js').FrameSlot[]; w?: number; h?: number }} opts
 */
export async function addFrame({ name, motif, file, src: srcIn, slots, w, h }) {
	const cleaned = normalizeSlots(slots);
	if (!cleaned?.length) throw new Error('Add at least one photo canvas');
	let src = srcIn;
	if (!src) {
		if (!file) throw new Error('Frame image required');
		if (!isAssetImageFile(file)) throw new Error('Frames must be PNG or WebP.');
		src = await fileToDataUrl(file);
	}
	let frameW = w;
	let frameH = h;
	if (!frameW || !frameH) {
		const dims = await measureImage(src);
		frameW = dims.w;
		frameH = dims.h;
	}
	await apiCreateAsset({
		kind: 'frame',
		name: name.trim() || 'CUSTOM FRAME',
		motif: motif?.trim() || undefined,
		src,
		w: frameW,
		h: frameH,
		slots: cleaned
	});
	await initAssets();
}

/**
 * @param {Array<{ name: string; file: File }>} items
 */
export async function addStickers(items) {
	if (!items.length) return;
	for (const { file } of items) {
		if (!isAssetImageFile(file)) throw new Error('Stickers must be PNG or WebP.');
	}
	for (const { name, file } of items) {
		const src = await fileToDataUrl(file);
		await apiCreateAsset({
			kind: 'sticker',
			name: name.trim() || 'CUSTOM STICKER',
			src
		});
	}
	await initAssets();
}

/**
 * @param {string} id
 * @param {{ name?: string; motif?: string; src?: string; w?: number; h?: number; slots?: import('./assetApi.js').FrameSlot[] }} patch
 */
export async function updateAsset(id, patch) {
	const hit = [...get(frames), ...get(stickers)].find((a) => a.id === id);
	if (!hit?.custom) throw new Error('Only custom assets can be edited');
	/** @type {Parameters<typeof apiPatchAsset>[1]} */
	const apiPatch = {};
	if (patch.name !== undefined) apiPatch.name = patch.name.trim() || hit.name;
	if (patch.motif !== undefined) apiPatch.motif = patch.motif.trim() || undefined;
	if (patch.src !== undefined) apiPatch.src = patch.src;
	if (patch.w !== undefined) apiPatch.w = patch.w;
	if (patch.h !== undefined) apiPatch.h = patch.h;
	if (patch.slots !== undefined) {
		const cleaned = normalizeSlots(patch.slots);
		if (!cleaned?.length) throw new Error('Add at least one photo canvas');
		apiPatch.slots = cleaned;
	}
	const kind = get(stickers).some((s) => s.id === id) ? 'sticker' : 'frame';
	await apiPatchAsset(id, apiPatch, kind);
	await initAssets();
}

/** @param {string} id */
export async function removeCustomAsset(id) {
	const hit = [...get(frames), ...get(stickers)].find((a) => a.id === id);
	if (!hit?.custom) throw new Error('Seed assets cannot be deleted');
	const kind = get(stickers).some((s) => s.id === id) ? 'sticker' : 'frame';
	await apiDeleteAsset(id, kind);
	await initAssets();
}

/**
 * @param {string | null} id
 * @returns {FrameAsset | undefined}
 */
export function getLiveFrameById(id) {
	if (!id) return undefined;
	return get(frames).find((f) => f.id === id);
}

export { normalizeSlots };
