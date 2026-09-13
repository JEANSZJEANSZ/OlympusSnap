/**
 * Live asset catalog: seed frames/stickers now.
 * initAssets() is the attach point for a future Cloudflare custom catalog.
 */
import { get, writable } from 'svelte/store';
import { FRAMES as SEED_FRAMES, STICKERS as SEED_STICKERS } from './catalog.js';
import { warmFrameImages } from '../utils/loadImageForCanvas.js';

const PIN_KEY = 'olympus-snap-admin-pin';
const DEFAULT_PIN = 'olympus';
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

function rebuildStores() {
	const includeFrames = get(showSeedFrames);
	frames.set(includeFrames ? seedFrames() : []);
	stickers.set(seedStickers());
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
	rebuildStores();
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
 * Load seed catalog. Future Cloudflare customs merge here.
 */
export async function initAssets() {
	rebuildStores();
	assetsReady.set(true);
}

/**
 * @param {string | null} id
 * @returns {FrameAsset | undefined}
 */
export function getLiveFrameById(id) {
	if (!id) return undefined;
	return get(frames).find((f) => f.id === id);
}

export function getAdminPin() {
	try {
		return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
	} catch {
		return DEFAULT_PIN;
	}
}

/** @param {string} pin */
export function setAdminPin(pin) {
	const next = pin.trim() || DEFAULT_PIN;
	try {
		localStorage.setItem(PIN_KEY, next);
	} catch {
		/* ignore quota / private mode */
	}
}

/** @param {string} attempt */
export function verifyAdminPin(attempt) {
	return attempt === getAdminPin();
}

export { DEFAULT_PIN, normalizeSlots };
