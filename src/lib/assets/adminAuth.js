/**
 * Operator PIN for this tab only — never from env, never in source.
 */
const STORAGE_KEY = 'olympus-snap-admin-auth';

/** @returns {string} */
export function getAdminAuth() {
	try {
		return sessionStorage.getItem(STORAGE_KEY) || '';
	} catch {
		return '';
	}
}

/** @param {string} pin */
export function setAdminAuth(pin) {
	try {
		if (pin) sessionStorage.setItem(STORAGE_KEY, pin);
		else sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}

export function clearAdminAuth() {
	setAdminAuth('');
}
