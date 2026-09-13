/**
 * Booth → phone session handoff via Cloudflare Worker; same-tab stub if API is down.
 */
import { toFullPath } from '../../router/index.js';
import { getApiBase, stripDataUrl } from '../assets/assetApi.js';
import { encodeHandoffImage } from '../utils/canvasRenderer.js';
import { encodeSes, decodeSes } from './sesCodec.js';
import { stubCreateSession, stubLoadCapture } from './sessionStub.js';

/** @typedef {'NOT_FOUND' | 'FORBIDDEN' | 'NETWORK'} SessionErrorCode */

/**
 * @typedef {{
 *   imageDataUrl: string;
 *   contentType: 'image/jpeg' | 'image/png';
 *   toPng: () => string;
 * }} HandoffEncoded
 */

/** @type {{ src: string; promise: Promise<HandoffEncoded> } | null} */
let primedHandoff = null;

/**
 * Start JPEG encode as soon as Camera has the composite so Reveal does not wait on it.
 * @param {string} imageDataUrl
 * @returns {Promise<HandoffEncoded> | undefined}
 */
export function primeHandoffEncode(imageDataUrl) {
	if (!imageDataUrl) return;
	if (primedHandoff?.src === imageDataUrl) return primedHandoff.promise;
	const promise = encodeHandoffImage(imageDataUrl);
	primedHandoff = { src: imageDataUrl, promise };
	return promise;
}

/**
 * @param {string} imageDataUrl
 * @returns {Promise<HandoffEncoded>}
 */
function takePrimedHandoffEncode(imageDataUrl) {
	if (primedHandoff?.src === imageDataUrl) {
		const { promise } = primedHandoff;
		primedHandoff = null;
		return promise;
	}
	return encodeHandoffImage(imageDataUrl);
}

/**
 * @param {{ imageDataUrl: string; frameId: string | null }} payload
 * @returns {Promise<{ id: string; key: string; frameId: string | null }>}
 */
export async function createSession(payload) {
	const encoded = await takePrimedHandoffEncode(payload.imageDataUrl);
	try {
		const res = await fetch(`${getApiBase()}/api/captures`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				imageBase64: stripDataUrl(encoded.imageDataUrl),
				frameId: payload.frameId,
				contentType: encoded.contentType
			})
		});
		if (!res.ok) throw new Error('Capture create failed');
		const data = await res.json();
		return { id: data.id, key: data.key, frameId: data.frameId ?? payload.frameId ?? null };
	} catch {
		return stubCreateSession({
			imageDataUrl: encoded.imageDataUrl,
			frameId: payload.frameId
		});
	}
}

/**
 * @param {string} id
 * @param {string} key
 * @returns {Promise<{ imageDataUrl: string; frameId: string | null }>}
 */
export async function loadCapture(id, key) {
	if (!id?.trim() || !key?.trim()) {
		const err = new Error('Missing session');
		err.code = 'NOT_FOUND';
		throw err;
	}
	try {
		const url = `${getApiBase()}/api/captures/${encodeURIComponent(id.trim())}?key=${encodeURIComponent(key.trim())}`;
		const res = await fetch(url);
		if (res.status === 401 || res.status === 403) {
			const err = new Error('Forbidden');
			err.code = 'FORBIDDEN';
			throw err;
		}
		if (!res.ok) {
			const err = new Error('Session not found');
			err.code = 'NOT_FOUND';
			throw err;
		}
		const frameId = res.headers.get('X-Frame-Id');
		const blob = await res.blob();
		return { imageDataUrl: URL.createObjectURL(blob), frameId: frameId || null };
	} catch (err) {
		if (err && typeof err === 'object' && 'code' in err) throw err;
		return stubLoadCapture(id.trim(), key.trim());
	}
}

/**
 * @returns {{ id: string; key: string } | null}
 */
export function getSessionFromUrl() {
	if (typeof location === 'undefined') return null;
	const ses = new URLSearchParams(location.search).get('ses');
	return decodeSes(ses || '');
}

/**
 * @param {{ id: string; key: string; showSeedFrames?: boolean }} parts
 * @returns {string} query string (no leading ?)
 */
export function studioSessionQuery(parts) {
	const q = new URLSearchParams();
	q.set('ses', encodeSes({ id: parts.id, key: parts.key }));
	if (parts.showSeedFrames === false) q.set('sf', '0');
	return q.toString();
}

/**
 * Public URL for QR — use LAN hostname in production booths (VITE_PUBLIC_ORIGIN).
 * @param {{ id: string; key: string; showSeedFrames?: boolean }} parts
 * @returns {string}
 */
export function buildStudioSessionUrl(parts) {
	const origin =
		(import.meta.env.VITE_PUBLIC_ORIGIN || '').replace(/\/+$/, '') ||
		(typeof location !== 'undefined' ? location.origin : '');
	const path = `${toFullPath('/studio')}?${studioSessionQuery(parts)}`;
	return `${origin}${path}`;
}
