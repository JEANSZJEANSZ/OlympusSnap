/**
 * Cloudflare Worker transport for custom frames/stickers.
 */

/**
 * @returns {string}
 */
export function getApiBase() {
	return (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
}

/**
 * @returns {boolean}
 */
export function isCloudAssetsEnabled() {
	return !!getApiBase();
}

/**
 * @param {Record<string, string>} [extra]
 */
export function boothHeaders(extra = {}) {
	/** @type {Record<string, string>} */
	const headers = { ...extra };
	const key = import.meta.env.VITE_BOOTH_KEY;
	if (key) headers['X-Booth-Key'] = key;
	return headers;
}

/**
 * @param {Response} res
 */
async function readError(res) {
	try {
		const text = await res.text();
		return text || `HTTP ${res.status}`;
	} catch {
		return `HTTP ${res.status}`;
	}
}

/**
 * @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot
 * @typedef {{
 *   id: string;
 *   kind: 'frame' | 'sticker';
 *   name: string;
 *   motif?: string;
 *   src: string;
 *   w?: number;
 *   h?: number;
 *   slots?: FrameSlot[];
 *   custom?: boolean;
 * }} CloudAsset
 */

/**
 * @returns {Promise<CloudAsset[]>}
 */
export async function listCustoms() {
	const res = await fetch(`${getApiBase()}/api/assets`);
	if (!res.ok) throw new Error(await readError(res));
	const data = await res.json();
	return Array.isArray(data.assets) ? data.assets : [];
}

/**
 * @param {string} dataUrl
 * @returns {Promise<Blob>}
 */
export async function dataUrlToBlob(dataUrl) {
	const res = await fetch(dataUrl);
	return res.blob();
}

/**
 * @param {{
 *   id?: string;
 *   kind: 'frame' | 'sticker';
 *   name: string;
 *   motif?: string;
 *   src: string;
 *   w?: number;
 *   h?: number;
 *   slots?: FrameSlot[];
 * }} opts
 * @returns {Promise<CloudAsset>}
 */
export async function createAsset(opts) {
	const blob = await dataUrlToBlob(opts.src);
	const form = new FormData();
	form.append('file', blob, `${opts.kind}.png`);
	form.append('kind', opts.kind);
	form.append('name', opts.name);
	if (opts.motif) form.append('motif', opts.motif);
	if (opts.w != null) form.append('w', String(opts.w));
	if (opts.h != null) form.append('h', String(opts.h));
	if (opts.slots?.length) form.append('slots', JSON.stringify(opts.slots));
	if (opts.id) form.append('id', opts.id);

	const res = await fetch(`${getApiBase()}/api/assets`, {
		method: 'POST',
		headers: boothHeaders(),
		body: form
	});
	if (!res.ok) throw new Error(await readError(res));
	return res.json();
}

/**
 * @param {string} id
 * @param {{
 *   name?: string;
 *   motif?: string;
 *   src?: string;
 *   w?: number;
 *   h?: number;
 *   slots?: FrameSlot[];
 * }} patch
 * @returns {Promise<CloudAsset>}
 */
export async function patchAsset(id, patch) {
	if (patch.src) {
		const blob = await dataUrlToBlob(patch.src);
		const form = new FormData();
		form.append('file', blob, 'asset.png');
		if (patch.name != null) form.append('name', patch.name);
		if (patch.motif != null) form.append('motif', patch.motif);
		if (patch.w != null) form.append('w', String(patch.w));
		if (patch.h != null) form.append('h', String(patch.h));
		if (patch.slots) form.append('slots', JSON.stringify(patch.slots));

		const res = await fetch(`${getApiBase()}/api/assets/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			headers: boothHeaders(),
			body: form
		});
		if (!res.ok) throw new Error(await readError(res));
		return res.json();
	}

	const body = /** @type {Record<string, unknown>} */ ({});
	if (patch.name != null) body.name = patch.name;
	if (patch.motif != null) body.motif = patch.motif;
	if (patch.w != null) body.w = patch.w;
	if (patch.h != null) body.h = patch.h;
	if (patch.slots) body.slots = patch.slots;

	const res = await fetch(`${getApiBase()}/api/assets/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: boothHeaders({ 'Content-Type': 'application/json' }),
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(await readError(res));
	return res.json();
}

/**
 * @param {string} id
 */
export async function deleteAsset(id) {
	const res = await fetch(`${getApiBase()}/api/assets/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		headers: boothHeaders()
	});
	if (!res.ok && res.status !== 204) throw new Error(await readError(res));
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchAsDataUrl(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}`);
	const blob = await res.blob();
	return blobToDataUrl(blob);
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(/** @type {string} */ (reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('Blob read failed'));
		reader.readAsDataURL(blob);
	});
}

/**
 * @param {string} dataUrl
 * @returns {string}
 */
export function stripDataUrl(dataUrl) {
	return dataUrl.replace(/^data:[^;]+;base64,/, '');
}
