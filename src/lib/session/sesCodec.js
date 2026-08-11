// src/lib/session/sesCodec.js
/** @param {string} raw */
function encodeBase64Url(raw) {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(raw, 'utf8').toString('base64url');
	}
	const bytes = new TextEncoder().encode(raw);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} s */
function decodeBase64Url(s) {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
	const bin = atob(b64);
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

/**
 * @param {{ id: string; key: string }} parts
 * @returns {string}
 */
export function encodeSes({ id, key }) {
	return encodeBase64Url(`${id}::${key}`);
}

/**
 * @param {string} ses
 * @returns {{ id: string; key: string } | null}
 */
export function decodeSes(ses) {
	if (!ses?.trim()) return null;
	try {
		const raw =
			typeof Buffer !== 'undefined'
				? Buffer.from(ses, 'base64url').toString('utf8')
				: decodeBase64Url(ses);
		const idx = raw.indexOf('::');
		if (idx <= 0) return null;
		const id = raw.slice(0, idx);
		const key = raw.slice(idx + 2);
		if (!id || !key) return null;
		return { id, key };
	} catch {
		return null;
	}
}
