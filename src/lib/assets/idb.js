/**
 * Thin IndexedDB helper for custom frame/sticker assets.
 * Record: { id, kind, name, motif?, src (data URL), w?, h?, slots?, custom: true }
 */

const DB_NAME = 'olympus-snap-assets';
const DB_VERSION = 1;
const STORE = 'assets';

/**
 * Normalized photo region on a frame image (0–1 of natural width/height).
 * @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot
 */

/**
 * @typedef {{
 *   id: string;
 *   kind: 'frame' | 'sticker';
 *   name: string;
 *   motif?: string;
 *   src: string;
 *   w?: number;
 *   h?: number;
 *   slots?: FrameSlot[];
 *   custom: true;
 * }} CustomAsset
 */

/** @returns {Promise<IDBDatabase>} */
function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
		req.onsuccess = () => resolve(req.result);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const os = db.createObjectStore(STORE, { keyPath: 'id' });
				os.createIndex('kind', 'kind', { unique: false });
			}
		};
	});
}

/**
 * @template T
 * @param {IDBRequest<T>} req
 * @returns {Promise<T>}
 */
function reqToPromise(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
	});
}

/**
 * @returns {Promise<CustomAsset[]>}
 */
export async function idbListAll() {
	const db = await openDb();
	const tx = db.transaction(STORE, 'readonly');
	const store = tx.objectStore(STORE);
	const rows = await reqToPromise(store.getAll());
	db.close();
	return /** @type {CustomAsset[]} */ (rows ?? []);
}

/**
 * @param {CustomAsset} asset
 * @returns {Promise<void>}
 */
export async function idbPut(asset) {
	const db = await openDb();
	const tx = db.transaction(STORE, 'readwrite');
	await reqToPromise(tx.objectStore(STORE).put(asset));
	db.close();
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function idbDelete(id) {
	const db = await openDb();
	const tx = db.transaction(STORE, 'readwrite');
	await reqToPromise(tx.objectStore(STORE).delete(id));
	db.close();
}

/**
 * @param {CustomAsset[]} assets
 * @returns {Promise<void>}
 */
export async function idbReplaceAllCustoms(assets) {
	const db = await openDb();
	const tx = db.transaction(STORE, 'readwrite');
	const store = tx.objectStore(STORE);
	await reqToPromise(store.clear());
	for (const asset of assets) {
		await reqToPromise(store.put(asset));
	}
	db.close();
}
