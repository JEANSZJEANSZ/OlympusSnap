/**
 * Dev stub — one-time session handoff until Cloudflare Workers + R2.
 *
 * Primary store is an in-memory Map so full PNG data-URLs work on the same
 * booth tab (localStorage quota (~5MB) cannot hold photobooth composites).
 * A tiny localStorage index tracks consumed IDs for same-origin refresh UX.
 */
const INDEX_KEY = 'olympus-snap-session-index';

/**
 * @typedef {{
 *   imageDataUrl: string;
 *   frameId: string | null;
 *   createdAt: number;
 *   consumed: boolean;
 * }} SessionRecord
 */

/** @type {Map<string, SessionRecord>} */
const memory = new Map();

/** @type {Set<string>} */
const consumedIds = new Set();

/** @returns {Storage | null} */
function store() {
	try {
		return localStorage;
	} catch {
		return null;
	}
}

/**
 * Lightweight index — ids + consumed flags only (no image payloads).
 * @returns {Record<string, { createdAt: number; consumed: boolean }>}
 */
function readIndex() {
	const s = store();
	if (!s) return {};
	try {
		const raw = s.getItem(INDEX_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

/** @param {Record<string, { createdAt: number; consumed: boolean }>} index */
function writeIndex(index) {
	const s = store();
	if (!s) return;
	try {
		s.setItem(INDEX_KEY, JSON.stringify(index));
	} catch {
		/* quota / private mode */
	}
}

/**
 * @param {string} sessionId
 * @param {{ createdAt: number; consumed: boolean }} meta
 */
function markIndex(sessionId, meta) {
	if (meta.consumed) consumedIds.add(sessionId);
	const index = readIndex();
	index[sessionId] = meta;
	writeIndex(index);
}

/**
 * @param {{ imageDataUrl: string; frameId: string | null }} payload
 * @returns {Promise<{ sessionId: string }>}
 */
export async function stubCreateSession({ imageDataUrl, frameId }) {
	if (!imageDataUrl) {
		const err = new Error('Missing image');
		err.code = 'NOT_FOUND';
		throw err;
	}
	const sessionId = crypto.randomUUID();
	const record = {
		imageDataUrl,
		frameId,
		createdAt: Date.now(),
		consumed: false
	};
	memory.set(sessionId, record);
	markIndex(sessionId, { createdAt: record.createdAt, consumed: false });
	return { sessionId };
}

/**
 * @param {string} sessionId
 * @returns {Promise<{ imageDataUrl: string; frameId: string | null }>}
 */
export async function stubConsumeSession(sessionId) {
	const record = memory.get(sessionId);
	const index = readIndex();
	const alreadyUsed = consumedIds.has(sessionId) || !!index[sessionId]?.consumed;

	if (!record) {
		if (alreadyUsed) {
			const err = new Error('Session already used');
			err.code = 'CONSUMED';
			throw err;
		}
		const err = new Error('Session not found');
		err.code = 'NOT_FOUND';
		throw err;
	}
	if (record.consumed || alreadyUsed) {
		const err = new Error('Session already used');
		err.code = 'CONSUMED';
		throw err;
	}

	record.consumed = true;
	memory.delete(sessionId);
	markIndex(sessionId, { createdAt: record.createdAt, consumed: true });

	return { imageDataUrl: record.imageDataUrl, frameId: record.frameId };
}
