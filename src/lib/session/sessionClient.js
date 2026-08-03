/**
 * Booth → phone session handoff. Stub today; swap transport for Cloudflare Workers + R2.
 */
import { toFullPath } from '../../router/index.js';
import { stubCreateSession, stubConsumeSession } from './sessionStub.js';

/** @typedef {'NOT_FOUND' | 'CONSUMED' | 'NETWORK'} SessionErrorCode */

/**
 * @param {{ imageDataUrl: string; frameId: string | null }} payload
 * @returns {Promise<{ sessionId: string }>}
 */
export async function createSession(payload) {
	// Future: POST /api/sessions with imageBase64 + frameId
	return stubCreateSession(payload);
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
	// Future: GET /api/sessions/:id
	return stubConsumeSession(sessionId.trim());
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
