/**
 * Live asset catalog: seed frames/stickers + custom IndexedDB uploads.
 */
import { get, writable } from 'svelte/store';
import { FRAMES as SEED_FRAMES, STICKERS as SEED_STICKERS } from './catalog.js';
import { idbDelete, idbListAll, idbPut, idbReplaceAllCustoms } from './idb.js';

const PIN_KEY = 'olympus-snap-admin-pin';
const DEFAULT_PIN = 'olympus';
const SEED_FRAMES_KEY = 'olympus-snap-show-seed-frames';
const SEED_STICKERS_KEY = 'olympus-snap-show-seed-stickers';

/**
 * @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot
 * @typedef {{ id: string; name: string; src: string; motif?: string; thumb?: string; w?: number; h?: number; slots?: FrameSlot[]; custom?: boolean }} FrameAsset
 * @typedef {{ id: string; name: string; src: string; custom?: boolean }} StickerAsset
 */

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

/** @type {import('svelte/store').Writable<FrameAsset[]>} */
export const frames = writable(SEED_FRAMES.map((f) => ({ ...f, custom: false })));

/** @type {import('svelte/store').Writable<StickerAsset[]>} */
export const stickers = writable(SEED_STICKERS.map((s) => ({ ...s, custom: false })));

/** When false, seed frames are hidden from guests (customs only). Default on for booth testing. */
/** @type {import('svelte/store').Writable<boolean>} */
export const showSeedFrames = writable(readFlag(SEED_FRAMES_KEY, true));

/** When false, seed stickers are hidden from guests (customs only). */
/** @type {import('svelte/store').Writable<boolean>} */
export const showSeedStickers = writable(readFlag(SEED_STICKERS_KEY, true));

/** @type {import('svelte/store').Writable<boolean>} */
export const assetsReady = writable(false);

/** Latest customs snapshot so toggles can rebuild without another IDB round-trip. */
/** @type {import('./idb.js').CustomAsset[]} */
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
 * @param {import('./idb.js').CustomAsset[]} customs
 */
function rebuildStores(customs) {
	cachedCustoms = customs;
	const customFrames = customs
		.filter((a) => a.kind === 'frame')
		.map((a) => ({
			id: a.id,
			name: a.name,
			src: a.src,
			motif: a.motif,
			thumb: a.src,
			slots: normalizeSlots(a.slots),
			custom: true
		}));
	const customStickers = customs
		.filter((a) => a.kind === 'sticker')
		.map((a) => ({
			id: a.id,
			name: a.name,
			src: a.src,
			custom: true
		}));

	const includeFrames = get(showSeedFrames);
	const includeStickers = get(showSeedStickers);
	frames.set([...(includeFrames ? seedFrames() : []), ...customFrames]);
	stickers.set([...(includeStickers ? seedStickers() : []), ...customStickers]);
}

/** @param {boolean} on */
export function setShowSeedFrames(on) {
	showSeedFrames.set(!!on);
	writeFlag(SEED_FRAMES_KEY, !!on);
	rebuildStores(cachedCustoms);
}

/** @param {boolean} on */
export function setShowSeedStickers(on) {
	showSeedStickers.set(!!on);
	writeFlag(SEED_STICKERS_KEY, !!on);
	rebuildStores(cachedCustoms);
}

/** Load customs from IndexedDB and merge with seeds. */
export async function initAssets() {
	try {
		const customs = await idbListAll();
		rebuildStores(customs);
	} catch (err) {
		console.warn('[assets] IndexedDB unavailable, using seeds only', err);
		rebuildStores([]);
	} finally {
		assetsReady.set(true);
	}
}

/**
 * @param {string | null} id
 * @returns {FrameAsset | undefined}
 */
export function getLiveFrameById(id) {
	if (!id) return undefined;
	return get(frames).find((f) => f.id === id);
}

/**
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function fileToDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(/** @type {string} */ (reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
		reader.readAsDataURL(file);
	});
}

function makeId(prefix) {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {{ name: string; motif?: string; file?: File; src?: string; slots: FrameSlot[] }} opts
 */
export async function addFrame({ name, motif, file, src: srcIn, slots }) {
	const cleaned = normalizeSlots(slots);
	if (!cleaned?.length) throw new Error('Add at least one photo canvas');
	let src = srcIn;
	if (!src) {
		if (!file) throw new Error('Frame image required');
		src = await fileToDataUrl(file);
	}
	/** @type {import('./idb.js').CustomAsset} */
	const record = {
		id: makeId('frame'),
		kind: 'frame',
		name: name.trim() || 'CUSTOM FRAME',
		motif: motif?.trim() || undefined,
		src,
		slots: cleaned,
		custom: true
	};
	await idbPut(record);
	const customs = await idbListAll();
	rebuildStores(customs);
	return record.id;
}

/**
 * @param {{ name: string; file: File }} opts
 */
export async function addSticker({ name, file }) {
	const src = await fileToDataUrl(file);
	/** @type {import('./idb.js').CustomAsset} */
	const record = {
		id: makeId('sticker'),
		kind: 'sticker',
		name: name.trim() || 'CUSTOM STICKER',
		src,
		custom: true
	};
	await idbPut(record);
	const customs = await idbListAll();
	rebuildStores(customs);
	return record.id;
}

/**
 * Rename / update slots on a custom asset (seeds are read-only).
 * @param {string} id
 * @param {{ name?: string; motif?: string; slots?: FrameSlot[] }} patch
 */
export async function updateAsset(id, patch) {
	const customs = await idbListAll();
	const row = customs.find((a) => a.id === id);
	if (!row) throw new Error('Only custom assets can be edited');
	if (patch.name !== undefined) row.name = patch.name.trim() || row.name;
	if (patch.motif !== undefined) row.motif = patch.motif.trim() || undefined;
	if (patch.slots !== undefined) {
		if (row.kind !== 'frame') throw new Error('Only frames have canvases');
		const cleaned = normalizeSlots(patch.slots);
		if (!cleaned?.length) throw new Error('Add at least one photo canvas');
		row.slots = cleaned;
	}
	await idbPut(row);
	rebuildStores(await idbListAll());
}

/**
 * Delete a custom asset by id.
 * @param {string} id
 */
export async function removeCustomAsset(id) {
	const hit = [...get(frames), ...get(stickers)].find((a) => a.id === id);
	if (!hit?.custom) throw new Error('Seed assets cannot be deleted');
	await idbDelete(id);
	rebuildStores(await idbListAll());
}

/** @returns {Promise<object>} */
export async function exportCatalog() {
	const customs = await idbListAll();
	return {
		version: 2,
		exportedAt: new Date().toISOString(),
		pin: getAdminPin(),
		showSeedFrames: get(showSeedFrames),
		showSeedStickers: get(showSeedStickers),
		assets: customs
	};
}

/**
 * Replace all custom assets from an exported JSON payload.
 * @param {object} payload
 */
export async function importCatalog(payload) {
	if (!payload || typeof payload !== 'object') throw new Error('Invalid catalog file');
	const raw = /** @type {{ assets?: unknown; pin?: string }} */ (payload);
	const assets = Array.isArray(raw.assets) ? raw.assets : [];
	/** @type {import('./idb.js').CustomAsset[]} */
	const cleaned = [];
	for (const item of assets) {
		if (!item || typeof item !== 'object') continue;
		const a = /** @type {Record<string, unknown>} */ (item);
		if (a.kind !== 'frame' && a.kind !== 'sticker') continue;
		if (typeof a.id !== 'string' || typeof a.src !== 'string' || typeof a.name !== 'string')
			continue;
		/** @type {import('./idb.js').CustomAsset} */
		const row = {
			id: a.id,
			kind: a.kind,
			name: a.name,
			motif: typeof a.motif === 'string' ? a.motif : undefined,
			src: a.src,
			custom: true
		};
		if (a.kind === 'frame') {
			const slots = normalizeSlots(a.slots);
			if (slots) row.slots = slots;
		}
		cleaned.push(row);
	}
	await idbReplaceAllCustoms(cleaned);
	if (typeof raw.pin === 'string' && raw.pin.length > 0) {
		setAdminPin(raw.pin);
	}
	const payloadRec = /** @type {{ showSeedFrames?: unknown; showSeedStickers?: unknown }} */ (
		payload
	);
	if (typeof payloadRec.showSeedFrames === 'boolean') {
		showSeedFrames.set(payloadRec.showSeedFrames);
		writeFlag(SEED_FRAMES_KEY, payloadRec.showSeedFrames);
	}
	if (typeof payloadRec.showSeedStickers === 'boolean') {
		showSeedStickers.set(payloadRec.showSeedStickers);
		writeFlag(SEED_STICKERS_KEY, payloadRec.showSeedStickers);
	}
	rebuildStores(await idbListAll());
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

export { DEFAULT_PIN, normalizeSlots, makeId };
