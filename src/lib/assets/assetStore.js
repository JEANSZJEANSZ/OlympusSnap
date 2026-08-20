/**
 * Live asset catalog: seed frames/stickers + custom uploads (Photobooth API or IndexedDB).
 */
import { get, writable } from 'svelte/store';
import {
	createAsset as apiCreateAsset,
	deleteAsset as apiDeleteAsset,
	fetchAsDataUrl,
	isCloudAssetsEnabled,
	listCustoms,
	patchAsset as apiPatchAsset,
	resolveCloudAssetSrc
} from './assetApi.js';
import { FRAMES as SEED_FRAMES, STICKERS as SEED_STICKERS } from './catalog.js';
import { idbDelete, idbListAll, idbPut, idbReplaceAllCustoms } from './idb.js';
import { measureImage } from '../utils/imageCrop.js';
import { warmFrameImages } from '../utils/loadImageForCanvas.js';

const PIN_KEY = 'olympus-snap-admin-pin';
const DEFAULT_PIN = 'olympus';
const SEED_FRAMES_KEY = 'olympus-snap-show-seed-frames';
const SEED_STICKERS_KEY = 'olympus-snap-show-seed-stickers';
const RANDOM_FRAME_KEY = 'olympus-snap-random-frame';
const ORACLE_SHUFFLE_KEY = 'olympus-snap-oracle-shuffle';
const ORACLE_SHUFFLE_MS_KEY = 'olympus-snap-oracle-shuffle-ms';

export const ORACLE_SHUFFLE_MIN_MS = 800;
export const ORACLE_SHUFFLE_MAX_MS = 5000;
export const ORACLE_SHUFFLE_DEFAULT_MS = 2600;

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
export const frames = writable(SEED_FRAMES.map((f) => ({ ...f, custom: false })));

/** @type {import('svelte/store').Writable<StickerAsset[]>} */
export const stickers = writable(SEED_STICKERS.map((s) => ({ ...s, custom: false })));

/** When false, seed frames are hidden from guests (customs only). Default on for booth testing. */
/** @type {import('svelte/store').Writable<boolean>} */
export const showSeedFrames = writable(readFlag(SEED_FRAMES_KEY, true));

/** When false, seed stickers are hidden from guests (customs only). */
/** @type {import('svelte/store').Writable<boolean>} */
export const showSeedStickers = writable(readFlag(SEED_STICKERS_KEY, true));

/**
 * When true, Frame Select runs a Pythia oracle pick instead of pull-to-select.
 * Session-scoped (survives refresh, clears when the tab closes).
 */
/** @type {import('svelte/store').Writable<boolean>} */
export const randomFrame = writable(readSessionFlag(RANDOM_FRAME_KEY, false));

/** Oracle lot-spin duration in ms. Session-scoped. */
/** @type {import('svelte/store').Writable<number>} */
export const oracleShuffleMs = writable(readOracleShuffleMs());

/** @type {import('svelte/store').Writable<boolean>} */
export const assetsReady = writable(false);

/** Latest customs snapshot so toggles can rebuild without another round-trip. */
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
 * @param {import('./assetApi.js').CloudAsset} asset
 * @returns {import('./idb.js').CustomAsset}
 */
function cloudToCustom(asset) {
	return {
		id: asset.id,
		kind: asset.kind,
		name: asset.name,
		motif: asset.motif,
		src: resolveCloudAssetSrc(asset.src),
		w: asset.w,
		h: asset.h,
		slots: asset.slots,
		custom: true
	};
}

/**
 * @returns {Promise<import('./idb.js').CustomAsset[]>}
 */
async function loadCustoms() {
	if (isCloudAssetsEnabled()) {
		const assets = await listCustoms();
		return assets.map(cloudToCustom);
	}
	return idbListAll();
}

/**
 * @param {import('./idb.js').CustomAsset[]} customs
 */
function rebuildStores(customs) {
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
	const includeStickers = get(showSeedStickers);
	frames.set([...(includeFrames ? seedFrames() : []), ...customFrames]);
	stickers.set([...(includeStickers ? seedStickers() : []), ...customStickers]);
	warmCatalogImages();
}

function warmCatalogImages() {
	void warmFrameImages([
		...get(frames).map((f) => f.src),
		...get(stickers).map((s) => s.src)
	]);
}

warmCatalogImages();

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

/** @param {boolean} on */
export function setRandomFrame(on) {
	randomFrame.set(!!on);
	writeSessionFlag(RANDOM_FRAME_KEY, !!on);
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

/** Load customs from cloud or IndexedDB and merge with seeds. */
export async function initAssets() {
	try {
		const customs = await loadCustoms();
		rebuildStores(customs);
	} catch (err) {
		console.warn('[assets] Custom catalog unavailable, using seeds only', err);
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
 * @returns {boolean}
 */
export function isPngFile(file) {
	if (file.type === 'image/png') return true;
	if (!file.type && /\.png$/i.test(file.name)) return true;
	return false;
}

/**
 * @param {File} file
 */
function assertPngFile(file) {
	if (!isPngFile(file)) {
		throw new Error('Frames and stickers must be PNG with transparency.');
	}
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
 * @param {{ name: string; motif?: string; file?: File; src?: string; slots: FrameSlot[]; w?: number; h?: number }} opts
 */
export async function addFrame({ name, motif, file, src: srcIn, slots, w, h }) {
	const cleaned = normalizeSlots(slots);
	if (!cleaned?.length) throw new Error('Add at least one photo canvas');
	let src = srcIn;
	if (!src) {
		if (!file) throw new Error('Frame image required');
		assertPngFile(file);
		src = await fileToDataUrl(file);
	}
	let frameW = w;
	let frameH = h;
	if (!frameW || !frameH) {
		const dims = await measureImage(src);
		frameW = dims.w;
		frameH = dims.h;
	}

	if (isCloudAssetsEnabled()) {
		const created = await apiCreateAsset({
			kind: 'frame',
			name: name.trim() || 'CUSTOM FRAME',
			motif: motif?.trim() || undefined,
			src,
			w: frameW,
			h: frameH,
			slots: cleaned
		});
		rebuildStores(await loadCustoms());
		return created.id;
	}

	/** @type {import('./idb.js').CustomAsset} */
	const record = {
		id: makeId('frame'),
		kind: 'frame',
		name: name.trim() || 'CUSTOM FRAME',
		motif: motif?.trim() || undefined,
		src,
		w: frameW,
		h: frameH,
		slots: cleaned,
		custom: true
	};
	await idbPut(record);
	rebuildStores(await idbListAll());
	return record.id;
}

/**
 * @param {{ name: string; file: File }} opts
 */
export async function addSticker({ name, file }) {
	const [id] = await addStickers([{ name, file }]);
	return id;
}

/**
 * @param {Array<{ name: string; file: File }>} items
 * @returns {Promise<string[]>}
 */
export async function addStickers(items) {
	if (!items.length) return [];

	for (const { file } of items) {
		assertPngFile(file);
	}

	if (isCloudAssetsEnabled()) {
		const ids = [];
		for (const { name, file } of items) {
			const src = await fileToDataUrl(file);
			const created = await apiCreateAsset({
				kind: 'sticker',
				name: name.trim() || 'CUSTOM STICKER',
				src
			});
			ids.push(created.id);
		}
		rebuildStores(await loadCustoms());
		return ids;
	}

	const ids = [];
	for (const { name, file } of items) {
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
		ids.push(record.id);
	}
	rebuildStores(await idbListAll());
	return ids;
}

/**
 * Rename / update slots on a custom asset (seeds are read-only).
 * @param {string} id
 * @param {{ name?: string; motif?: string; src?: string; w?: number; h?: number; slots?: FrameSlot[] }} patch
 */
export async function updateAsset(id, patch) {
	const hit = [...get(frames), ...get(stickers)].find((a) => a.id === id);
	if (!hit?.custom) throw new Error('Only custom assets can be edited');

	if (isCloudAssetsEnabled()) {
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
		rebuildStores(await loadCustoms());
		return;
	}

	const customs = await idbListAll();
	const row = customs.find((a) => a.id === id);
	if (!row) throw new Error('Only custom assets can be edited');
	if (patch.name !== undefined) row.name = patch.name.trim() || row.name;
	if (patch.motif !== undefined) row.motif = patch.motif.trim() || undefined;
	if (patch.src !== undefined) row.src = patch.src;
	if (patch.w !== undefined) row.w = patch.w;
	if (patch.h !== undefined) row.h = patch.h;
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

	if (isCloudAssetsEnabled()) {
		const kind = get(stickers).some((s) => s.id === id) ? 'sticker' : 'frame';
		await apiDeleteAsset(id, kind);
		rebuildStores(await loadCustoms());
		return;
	}

	await idbDelete(id);
	rebuildStores(await idbListAll());
}

/**
 * Push IndexedDB customs to cloud (skips name+kind already present remotely).
 * @returns {Promise<{ uploaded: number; skipped: number }>}
 */
export async function uploadLocalCustomsToCloud() {
	if (!isCloudAssetsEnabled()) {
		throw new Error('Set VITE_API_BASE to enable cloud storage.');
	}

	const local = await idbListAll();
	if (!local.length) return { uploaded: 0, skipped: 0 };

	const missingSlots = local.filter(
		(row) => row.kind === 'frame' && !normalizeSlots(row.slots)?.length
	);
	if (missingSlots.length) {
		const names = missingSlots.map((r) => r.name).join(', ');
		throw new Error(`Cannot upload: frame(s) missing slots — ${names}`);
	}

	const cloud = await listCustoms();

	let uploaded = 0;
	let skipped = 0;

	for (const row of local) {
		if (cloud.some((c) => c.kind === row.kind && c.name === row.name)) {
			skipped++;
			continue;
		}
		try {
			await apiCreateAsset({
				kind: row.kind,
				name: row.name,
				motif: row.motif,
				src: row.src,
				w: row.w,
				h: row.h,
				slots: row.slots
			});
			uploaded++;
		} catch (err) {
			rebuildStores(await loadCustoms());
			const detail = err instanceof Error ? err.message : String(err);
			throw new Error(
				`Upload stopped after ${uploaded} uploaded, ${skipped} skipped (failed on "${row.name}"): ${detail}`
			);
		}
	}

	rebuildStores(await loadCustoms());
	return { uploaded, skipped };
}

/** @returns {Promise<object>} */
export async function exportCatalog() {
	const customs = await loadCustoms();
	const assets = await Promise.all(
		customs.map(async (a) => {
			let src = a.src;
			if (!src.startsWith('data:')) {
				src = await fetchAsDataUrl(src);
			}
			return { ...a, src };
		})
	);

	return {
		version: 2,
		exportedAt: new Date().toISOString(),
		pin: getAdminPin(),
		showSeedFrames: get(showSeedFrames),
		showSeedStickers: get(showSeedStickers),
		assets
	};
}

/**
 * @param {object} payload
 * @returns {import('./idb.js').CustomAsset[]}
 */
function parseImportAssets(payload) {
	if (!payload || typeof payload !== 'object') throw new Error('Invalid catalog file');
	const raw = /** @type {{ assets?: unknown }} */ (payload);
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
			if (typeof a.w === 'number' && typeof a.h === 'number') {
				row.w = a.w;
				row.h = a.h;
			}
		}
		cleaned.push(row);
	}
	return cleaned;
}

/**
 * Replace all custom assets from an exported JSON payload.
 * @param {object} payload
 */
export async function importCatalog(payload) {
	const cleaned = parseImportAssets(payload);

	if (isCloudAssetsEnabled()) {
		const missingSlots = cleaned.filter(
			(row) => row.kind === 'frame' && !normalizeSlots(row.slots)?.length
		);
		if (missingSlots.length) {
			const names = missingSlots.map((r) => r.name).join(', ');
			throw new Error(
				`Import aborted: frame(s) missing slots — ${names}. Remote catalog was not deleted.`
			);
		}

		const existing = await listCustoms();
		for (const asset of existing) {
			const kind = asset.kind === 'sticker' ? 'sticker' : 'frame';
			await apiDeleteAsset(asset.id, kind);
		}
		for (const row of cleaned) {
			await apiCreateAsset({
				kind: row.kind,
				name: row.name,
				motif: row.motif,
				src: row.src,
				w: row.w,
				h: row.h,
				slots: row.slots
			});
		}
	} else {
		await idbReplaceAllCustoms(cleaned);
	}

	const raw = /** @type {{ pin?: string; showSeedFrames?: unknown; showSeedStickers?: unknown }} */ (
		payload
	);
	if (typeof raw.pin === 'string' && raw.pin.length > 0) {
		setAdminPin(raw.pin);
	}
	if (typeof raw.showSeedFrames === 'boolean') {
		showSeedFrames.set(raw.showSeedFrames);
		writeFlag(SEED_FRAMES_KEY, raw.showSeedFrames);
	}
	if (typeof raw.showSeedStickers === 'boolean') {
		showSeedStickers.set(raw.showSeedStickers);
		writeFlag(SEED_STICKERS_KEY, raw.showSeedStickers);
	}
	rebuildStores(await loadCustoms());
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

export { DEFAULT_PIN, normalizeSlots, makeId, isCloudAssetsEnabled };
