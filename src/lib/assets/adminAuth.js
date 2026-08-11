/**
 * Runtime Photobooth Admin `Auth` header value.
 * Prefer session entry over VITE_ADMIN_AUTH so secrets are not baked into the bundle.
 */

const STORAGE_KEY = 'olympus-snap-photobooth-auth';

/** @type {string} */
let memoryAuth = '';

/**
 * @returns {string}
 */
export function getAdminAuth() {
	if (memoryAuth) return memoryAuth;
	try {
		const stored = sessionStorage.getItem(STORAGE_KEY);
		if (stored) {
			memoryAuth = stored;
			return memoryAuth;
		}
	} catch {
		/* private mode */
	}
	return (import.meta.env.VITE_ADMIN_AUTH || '').trim();
}

/**
 * @param {string} value
 * @param {{ persist?: boolean }} [opts]
 */
export function setAdminAuth(value, opts = {}) {
	const next = (value || '').trim();
	memoryAuth = next;
	const persist = opts.persist !== false;
	try {
		if (persist && next) sessionStorage.setItem(STORAGE_KEY, next);
		else sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		/* private mode */
	}
}

export function clearAdminAuth() {
	setAdminAuth('', { persist: false });
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
