/**
 * Live asset catalog: seed frames/stickers + custom IndexedDB uploads.
 */
import { get, writable } from 'svelte/store';
import { FRAMES as SEED_FRAMES, STICKERS as SEED_STICKERS } from './catalog.js';
import { idbDelete, idbListAll, idbPut, idbReplaceAllCustoms } from './idb.js';

const PIN_KEY = 'olympus-snap-admin-pin';
const DEFAULT_PIN = 'olympus';

/**
 * @typedef {{ id: string; name: string; src: string; motif?: string; thumb?: string; custom?: boolean }} FrameAsset
 * @typedef {{ id: string; name: string; src: string; custom?: boolean }} StickerAsset
 */

/** @type {import('svelte/store').Writable<FrameAsset[]>} */
export const frames = writable(SEED_FRAMES.map((f) => ({ ...f, custom: false })));

/** @type {import('svelte/store').Writable<StickerAsset[]>} */
export const stickers = writable(SEED_STICKERS.map((s) => ({ ...s, custom: false })));

/** @type {import('svelte/store').Writable<boolean>} */
export const assetsReady = writable(false);

function seedFrames() {
	return SEED_FRAMES.map((f) => ({ ...f, custom: false }));
}

function seedStickers() {
	return SEED_STICKERS.map((s) => ({ ...s, custom: false }));
}

/**
 * @param {import('./idb.js').CustomAsset[]} customs
 */
function rebuildStores(customs) {
	const customFrames = customs
		.filter((a) => a.kind === 'frame')
		.map((a) => ({
			id: a.id,
			name: a.name,
			src: a.src,
			motif: a.motif,
			thumb: a.src,
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

	frames.set([...seedFrames(), ...customFrames]);
	stickers.set([...seedStickers(), ...customStickers]);
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
function fileToDataUrl(file) {
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
 * @param {{ name: string; motif?: string; file: File }} opts
 */
export async function addFrame({ name, motif, file }) {
	const src = await fileToDataUrl(file);
	/** @type {import('./idb.js').CustomAsset} */
	const record = {
		id: makeId('frame'),
		kind: 'frame',
		name: name.trim() || 'CUSTOM FRAME',
		motif: motif?.trim() || undefined,
		src,
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
 * Rename a custom asset (seeds are read-only).
 * @param {string} id
 * @param {{ name?: string; motif?: string }} patch
 */
export async function updateAsset(id, patch) {
	const customs = await idbListAll();
	const row = customs.find((a) => a.id === id);
	if (!row) throw new Error('Only custom assets can be edited');
	if (patch.name !== undefined) row.name = patch.name.trim() || row.name;
	if (patch.motif !== undefined) row.motif = patch.motif.trim() || undefined;
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
		version: 1,
		exportedAt: new Date().toISOString(),
		pin: getAdminPin(),
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
		cleaned.push({
			id: a.id,
			kind: a.kind,
			name: a.name,
			motif: typeof a.motif === 'string' ? a.motif : undefined,
			src: a.src,
			custom: true
		});
	}
	await idbReplaceAllCustoms(cleaned);
	if (typeof raw.pin === 'string' && raw.pin.length > 0) {
		setAdminPin(raw.pin);
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

export { DEFAULT_PIN };
