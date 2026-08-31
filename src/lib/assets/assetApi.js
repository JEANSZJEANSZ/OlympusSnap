/**
 * OpenHouse Photobooth transport for custom frames/stickers.
 */
import { getAdminAuth } from './adminAuth.js';

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
	return forceHttpsIfSecurePage((import.meta.env.VITE_API_BASE || '').replace(/\/+$/, ''));
}

/**
 * When the SPA is on HTTPS, upgrade plain http:// URLs so the browser
 * does not block Mixed Content (API sometimes returns http://sfapi…).
 * @param {string} url
 * @returns {string}
 */
export function forceHttpsIfSecurePage(url) {
	if (!url || typeof url !== 'string') return url;
	if (typeof location === 'undefined' || location.protocol !== 'https:') return url;
	if (/^http:\/\//i.test(url)) return `https://${url.slice('http://'.length)}`;
	return url;
}

/**
 * @returns {boolean}
 */
export function isCloudAssetsEnabled() {
	return !!getApiBase();
}

/**
 * Prefix relative Photobooth file paths with the API host.
 * Absolute / data / blob URLs are left unchanged (except http→https on HTTPS pages).
 * @param {string} src
 * @returns {string}
 */
export function resolveCloudAssetSrc(src) {
	if (!src || typeof src !== 'string') return src;
	if (/^(data:|blob:)/i.test(src)) return src;
	if (/^https?:\/\//i.test(src)) return forceHttpsIfSecurePage(src);
	if (src.startsWith('//')) {
		const proto =
			typeof location !== 'undefined' && location.protocol ? location.protocol : 'https:';
		return `${proto}${src}`;
	}
	if (src.startsWith('/')) {
		const base = getApiBase();
		return base ? `${base}${src}` : src;
	}
	return src;
}

/**
 * @param {Record<string, string>} [extra]
 * @returns {Record<string, string>}
 */
export function adminHeaders(extra = {}) {
	/** @type {Record<string, string>} */
	const headers = { ...extra };
	const auth = getAdminAuth();
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
	const authHint =
		res.status === 401
			? 'Admin Auth missing/invalid — re-enter Auth on the Admin gate'
			: null;
	try {
		const text = await res.text();
		if (!text) return authHint || `HTTP ${res.status}`;
		try {
			const json = JSON.parse(text);
			if (json && typeof json.message === 'string' && json.message) {
				return authHint ? `${authHint}: ${json.message}` : json.message;
			}
		} catch {
			/* not JSON */
		}
		return authHint ? `${authHint}: ${text}` : text;
	} catch {
		return authHint || `HTTP ${res.status}`;
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
 * @param {Blob} blob
 * @param {string} [basename]
 * @returns {string}
 */
function assetUploadFilename(blob, basename = 'asset') {
	const mime = (blob.type || '').toLowerCase();
	const ext = mime.includes('webp') ? 'webp' : 'png';
	return `${basename}.${ext}`;
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
	form.append('File', blob, assetUploadFilename(blob, opts.kind));
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
		form.append('File', blob, assetUploadFilename(blob, 'asset'));
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
	if (!res.ok && res.status !== 204) {
		const err = new Error(await readError(res));
		// @ts-expect-error attach HTTP status for retry logic
		err.status = res.status;
		throw err;
	}
}

/**
 * @returns {Promise<boolean>} true if Auth is accepted
 */
export async function verifyAdminAuth() {
	const res = await fetch(photobooth('/admin/captures/recent'), { headers: adminHeaders() });
	if (res.status === 401 || res.status === 403) return false;
	if (!res.ok) throw new Error(await readError(res));
	return true;
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
