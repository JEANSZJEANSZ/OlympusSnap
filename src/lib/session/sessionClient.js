/**
 * Booth → phone session handoff via Photobooth captures API; stub when offline.
 */
import { toFullPath } from '../../router/index.js';
import { blobToDataUrl, getApiBase, stripDataUrl } from '../assets/assetApi.js';
import { encodeSes, decodeSes } from './sesCodec.js';
import { stubCreateSession, stubLoadCapture } from './sessionStub.js';

/** @typedef {'NOT_FOUND' | 'FORBIDDEN' | 'NETWORK'} SessionErrorCode */

function useCloud() {
	return !!getApiBase();
}

/**
 * @param {{ imageDataUrl: string; frameId: string | null }} payload
 * @returns {Promise<{ id: string; key: string; frameId: string | null }>}
 */
export async function createSession(payload) {
	if (!useCloud()) return stubCreateSession(payload);

	const res = await fetch(`${getApiBase()}/api/photobooth/captures`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			imageBase64: stripDataUrl(payload.imageDataUrl),
			frameId: payload.frameId,
			contentType: 'image/png'
		})
	});
	if (!res.ok) {
		const err = new Error('Capture create failed');
		err.code = 'NETWORK';
		throw err;
	}
	const data = await res.json();
	return { id: data.id, key: data.key, frameId: data.frameId ?? payload.frameId ?? null };
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
	if (!useCloud()) return stubLoadCapture(id.trim(), key.trim());

	const url = `${getApiBase()}/api/photobooth/captures/${encodeURIComponent(id.trim())}?key=${encodeURIComponent(key.trim())}`;
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
	const imageDataUrl = await blobToDataUrl(await res.blob());
	return { imageDataUrl, frameId: frameId || null };
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
 * Public URL for QR — use LAN hostname in production booths (VITE_PUBLIC_ORIGIN).
 * @param {{ id: string; key: string }} parts
 * @returns {string}
 */
export function buildStudioSessionUrl({ id, key }) {
	const origin =
		(import.meta.env.VITE_PUBLIC_ORIGIN || '').replace(/\/+$/, '') ||
		(typeof location !== 'undefined' ? location.origin : '');
	const path = `${toFullPath('/studio')}?ses=${encodeURIComponent(encodeSes({ id, key }))}`;
	return `${origin}${path}`;
}

/**
 * @deprecated Removed in Task 5 — Reveal/Studio migrate in Task 6.
 * @param {string} _sessionId
 */
export async function consumeSession(_sessionId) {
	const err = new Error('consumeSession removed — use loadCapture(id, key) (Task 6)');
	err.code = 'NOT_FOUND';
	throw err;
}

/**
 * @deprecated Removed in Task 5 — use getSessionFromUrl() (Task 6).
 * @returns {never}
 */
export function getSessionIdFromUrl() {
	const err = new Error('getSessionIdFromUrl removed — use getSessionFromUrl() (Task 6)');
	err.code = 'NOT_FOUND';
	throw err;
}
