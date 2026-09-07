/**
 * Booth operator session — locks the app except Studio (QR guests).
 */
import { writable } from 'svelte/store';
import { clearAdminAuth, getAdminAuth, setAdminAuth } from './adminAuth.js';
import { isCloudAssetsEnabled, verifyAdminAuth } from './assetApi.js';
import { verifyAdminPin } from './assetStore.js';

const UNLOCKED_KEY = 'olympus-snap-booth-unlocked';

/**
 * Vite `npm run dev` — skip Cerberus gate so frontend work needs no Photobooth Auth.
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
	if (!readSessionFlag(UNLOCKED_KEY, false)) return false;
	if (isCloudAssetsEnabled()) return !!getAdminAuth();
	return true;
}

/** @type {import('svelte/store').Writable<boolean>} */
export const boothUnlocked = writable(initialUnlocked());

if (
	typeof window !== 'undefined' &&
	!isBoothAuthBypassed() &&
	initialUnlocked() &&
	isCloudAssetsEnabled()
) {
	void verifyAdminAuth()
		.then((ok) => {
			if (!ok) lockBooth();
		})
		.catch(() => {
			/* keep session on transient network errors */
		});
}

/**
 * @param {{ auth?: string; pin?: string }} creds
 * @returns {Promise<void>}
 */
export async function unlockBooth(creds = {}) {
	if (isBoothAuthBypassed()) {
		writeSessionFlag(UNLOCKED_KEY, true);
		boothUnlocked.set(true);
		return;
	}

	if (isCloudAssetsEnabled()) {
		const auth = (creds.auth || '').trim();
		if (!auth) {
			throw new Error('Photobooth Auth required.');
		}
		setAdminAuth(auth);
		let ok = false;
		try {
			ok = await verifyAdminAuth();
		} catch (err) {
			clearAdminAuth();
			writeSessionFlag(UNLOCKED_KEY, false);
			boothUnlocked.set(false);
			throw err instanceof Error ? err : new Error('Could not reach the forge.');
		}
		if (!ok) {
			clearAdminAuth();
			writeSessionFlag(UNLOCKED_KEY, false);
			boothUnlocked.set(false);
			throw new Error('Auth rejected by the forge.');
		}
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
	clearAdminAuth();
	writeSessionFlag(UNLOCKED_KEY, false);
	boothUnlocked.set(false);
}
