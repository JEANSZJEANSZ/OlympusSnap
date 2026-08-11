/**
 * OpenHouse Photobooth transport for custom frames/stickers.
 */

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
 * @typedef {{
 *   id: string;
 *   frameId: string;
 *   createdAt: string;
 *   previewBase64: string | null;
 * }} RecentCapture
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
 * @returns {Record<string, string>}
 */
export function adminHeaders(extra = {}) {
	/** @type {Record<string, string>} */
	const headers = { ...extra };
	const auth = import.meta.env.VITE_ADMIN_AUTH;
	if (auth) headers['Auth'] = auth;
	return headers;
}

/**
 * @param {string} path
 */
function photobooth(path) {
	return `${getApiBase()}/api/photobooth${path}`;
}

/**
 * @param {Response} res
 */
async function readError(res) {
	try {
		const text = await res.text();
		if (!text) return `HTTP ${res.status}`;
		try {
			const json = JSON.parse(text);
			if (json && typeof json.message === 'string' && json.message) return json.message;
		} catch {
			/* not JSON */
		}
		return text;
	} catch {
		return `HTTP ${res.status}`;
	}
}

/**
 * @returns {Promise<CloudAsset[]>}
 */
export async function listCustoms() {
	const [framesRes, stickersRes] = await Promise.all([
		fetch(photobooth('/frames')),
		fetch(photobooth('/stickers'))
	]);
	if (!framesRes.ok) throw new Error(await readError(framesRes));
	if (!stickersRes.ok) throw new Error(await readError(stickersRes));
	const frames = await framesRes.json();
	const stickers = await stickersRes.json();
	const a = Array.isArray(frames.assets) ? frames.assets : [];
	const b = Array.isArray(stickers.assets) ? stickers.assets : [];
	return [...a, ...b];
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
	form.append('File', blob, `${opts.kind}.png`);
	form.append('Name', opts.name);
	if (opts.motif) form.append('Motif', opts.motif);
	if (opts.kind === 'frame') {
		if (!opts.slots?.length) throw new Error('Frames require slots');
		form.append('Slots', JSON.stringify(opts.slots));
		const res = await fetch(photobooth('/frames'), { method: 'POST', headers: adminHeaders(), body: form });
		if (!res.ok) throw new Error(await readError(res));
		return res.json();
	}
	const res = await fetch(photobooth('/stickers'), { method: 'POST', headers: adminHeaders(), body: form });
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
 * @param {'frame' | 'sticker'} kind
 * @returns {Promise<CloudAsset>}
 */
export async function patchAsset(id, patch, kind) {
	const form = new FormData();
	if (patch.src) {
		const blob = await dataUrlToBlob(patch.src);
		form.append('File', blob, 'asset.png');
	}
	if (patch.name != null) form.append('Name', patch.name);
	if (patch.motif != null) form.append('Motif', patch.motif);
	if (kind === 'frame' && patch.slots) form.append('Slots', JSON.stringify(patch.slots));
	const path = kind === 'frame' ? `/frames/${encodeURIComponent(id)}` : `/stickers/${encodeURIComponent(id)}`;
	const res = await fetch(photobooth(path), { method: 'PATCH', headers: adminHeaders(), body: form });
	if (!res.ok) throw new Error(await readError(res));
	return res.json();
}

/**
 * @param {string} id
 * @param {'frame' | 'sticker'} kind
 */
export async function deleteAsset(id, kind) {
	const path = kind === 'frame' ? `/frames/${encodeURIComponent(id)}` : `/stickers/${encodeURIComponent(id)}`;
	const res = await fetch(photobooth(path), { method: 'DELETE', headers: adminHeaders() });
	if (!res.ok && res.status !== 204) throw new Error(await readError(res));
}

/**
 * @returns {Promise<RecentCapture[]>}
 */
export async function listRecentCaptures() {
	const res = await fetch(photobooth('/admin/captures/recent'), { headers: adminHeaders() });
	if (!res.ok) throw new Error(await readError(res));
	const data = await res.json();
	return Array.isArray(data.items) ? data.items : [];
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
