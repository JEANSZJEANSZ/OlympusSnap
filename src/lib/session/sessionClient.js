/**
 * Booth → phone session handoff. Cloudflare Workers + R2 when configured; stub otherwise.
 */
import { toFullPath } from '../../router/index.js';
import {
	blobToDataUrl,
	boothHeaders,
	getApiBase,
	stripDataUrl
} from '../assets/assetApi.js';
import { stubCreateSession, stubConsumeSession } from './sessionStub.js';

/** @typedef {'NOT_FOUND' | 'CONSUMED' | 'NETWORK'} SessionErrorCode */

function useCloud() {
	return !!getApiBase();
}

/**
 * @param {{ imageDataUrl: string; frameId: string | null }} payload
 * @returns {Promise<{ sessionId: string }>}
 */
export async function createSession(payload) {
	if (!useCloud()) {
		return stubCreateSession(payload);
	}

	const res = await fetch(`${getApiBase()}/api/sessions`, {
		method: 'POST',
		headers: boothHeaders({ 'Content-Type': 'application/json' }),
		body: JSON.stringify({
			imageBase64: stripDataUrl(payload.imageDataUrl),
			frameId: payload.frameId,
			contentType: 'image/png'
		})
	});

	if (!res.ok) {
		const err = new Error('Session create failed');
		err.code = 'NETWORK';
		throw err;
	}

	return res.json();
}

/**
 * One-time consume — second open throws CONSUMED.
 * @param {string} sessionId
 * @returns {Promise<{ imageDataUrl: string; frameId: string | null }>}
 */
export async function consumeSession(sessionId) {
	if (!sessionId?.trim()) {
		const err = new Error('Missing session id');
		err.code = 'NOT_FOUND';
		throw err;
	}

	const id = sessionId.trim();

	if (!useCloud()) {
		return stubConsumeSession(id);
	}

	const res = await fetch(`${getApiBase()}/api/sessions/${encodeURIComponent(id)}`);

	if (res.status === 410) {
		const err = new Error('Session already used');
		err.code = 'CONSUMED';
		throw err;
	}
	if (!res.ok) {
		const err = new Error('Session not found');
		err.code = 'NOT_FOUND';
		throw err;
	}

	const frameId = res.headers.get('X-Frame-Id');
	const blob = await res.blob();
	const imageDataUrl = await blobToDataUrl(blob);

	return {
		imageDataUrl,
		frameId: frameId || null
	};
}

/**
 * @returns {string | null}
 */
export function getSessionIdFromUrl() {
	if (typeof location === 'undefined') return null;
	return new URLSearchParams(location.search).get('s');
}

/**
 * Public URL for QR — use LAN hostname in production booths (VITE_PUBLIC_ORIGIN).
 * @param {string} sessionId
 * @returns {string}
 */
export function buildStudioSessionUrl(sessionId) {
	const origin =
		(import.meta.env.VITE_PUBLIC_ORIGIN || '').replace(/\/+$/, '') ||
		(typeof location !== 'undefined' ? location.origin : '');
	const path = `${toFullPath('/studio')}?s=${encodeURIComponent(sessionId)}`;
	return `${origin}${path}`;
}
