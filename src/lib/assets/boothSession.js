/**
 * Booth operator session — locks the app except Studio (QR guests).
 */
import { writable } from 'svelte/store';
import { verifyAdminPin } from './assetStore.js';

const UNLOCKED_KEY = 'olympus-snap-booth-unlocked';

/**
 * Vite `npm run dev` — skip Cerberus gate so frontend work needs no PIN.
 * Production / preview builds still require unlock.
 * @returns {boolean}
 */
export function isBoothAuthBypassed() {
	return !!import.meta.env.DEV;
}

/** @param {string} key @param {boolean} fallback */
function readSessionFlag(key, fallback = false) {
	try {
		const v = sessionStorage.getItem(key);
		if (v === null) return fallback;
		return v === '1' || v === 'true';
	} catch {
		return fallback;
	}
}

/** @param {string} key @param {boolean} on */
function writeSessionFlag(key, on) {
	try {
		sessionStorage.setItem(key, on ? '1' : '0');
	} catch {
		/* ignore */
	}
}

/**
 * @param {string} nameOrPath route name or path
 * @returns {boolean}
 */
export function isBoothPublicRoute(nameOrPath) {
	const raw = (nameOrPath || '').trim();
	if (!raw) return false;
	const name = raw.startsWith('/') ? raw.replace(/^\//, '').split(/[?#]/)[0] : raw;
	return name === 'studio';
}

function initialUnlocked() {
	if (isBoothAuthBypassed()) return true;
	return readSessionFlag(UNLOCKED_KEY, false);
}

/** @type {import('svelte/store').Writable<boolean>} */
export const boothUnlocked = writable(initialUnlocked());

/**
 * @param {{ pin?: string }} creds
 * @returns {Promise<void>}
 */
export async function unlockBooth(creds = {}) {
	if (isBoothAuthBypassed()) {
		writeSessionFlag(UNLOCKED_KEY, true);
		boothUnlocked.set(true);
		return;
	}

	const pin = (creds.pin || '').trim();
	if (!verifyAdminPin(pin)) {
		writeSessionFlag(UNLOCKED_KEY, false);
		boothUnlocked.set(false);
		throw new Error('Wrong PIN. Default seed: olympus');
	}
	writeSessionFlag(UNLOCKED_KEY, true);
	boothUnlocked.set(true);
}

export function lockBooth() {
	if (isBoothAuthBypassed()) {
		boothUnlocked.set(true);
		return;
	}
	writeSessionFlag(UNLOCKED_KEY, false);
	boothUnlocked.set(false);
}
