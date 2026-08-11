/**
 * Dev stub — in-memory capture handoff until Photobooth API (Task 5 wires sessionClient).
 * Same-tab Map store holds full PNG data-URLs (localStorage quota cannot).
 */
/** @typedef {{ imageDataUrl: string; frameId: string | null; key: string; createdAt: number }} StubCapture */

/** @type {Map<string, StubCapture>} */
const memory = new Map();

function randomKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {{ imageDataUrl: string; frameId: string | null }} payload
 * @returns {Promise<{ id: string; key: string; frameId: string | null }>}
 */
export async function stubCreateSession({ imageDataUrl, frameId }) {
	if (!imageDataUrl) {
		const err = new Error('Missing image');
		err.code = 'NOT_FOUND';
		throw err;
	}
	const id = crypto.randomUUID();
	const key = randomKey();
	memory.set(id, { imageDataUrl, frameId, key, createdAt: Date.now() });
	return { id, key, frameId };
}

/**
 * @param {string} id
 * @param {string} key
 * @returns {Promise<{ imageDataUrl: string; frameId: string | null }>}
 */
export async function stubLoadCapture(id, key) {
	const record = memory.get(id);
	if (!record) {
		const err = new Error('Session not found');
		err.code = 'NOT_FOUND';
		throw err;
	}
	if (record.key !== key) {
		const err = new Error('Forbidden');
		err.code = 'FORBIDDEN';
		throw err;
	}
	return { imageDataUrl: record.imageDataUrl, frameId: record.frameId };
}

/**
 * @deprecated Removed in Task 4 — sessionClient still imports until Task 5.
 * Offline consume-by-id alone is unsupported; use stubLoadCapture(id, key).
 * @param {string} _sessionId
 */
export async function stubConsumeSession(_sessionId) {
	const err = new Error('stubConsumeSession removed — use stubLoadCapture(id, key) (Task 5)');
	err.code = 'NOT_FOUND';
	throw err;
}
