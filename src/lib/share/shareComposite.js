/**
 * Share a studio composite from mobile web.
 * Native Meta Stories APIs are iOS/Android app-only; Graph publishing is Business-only.
 * Guests get Web Share (files) plus Instagram/Facebook helpers and download.
 */

const PNG_MIME = 'image/png';
const JPEG_MIME = 'image/jpeg';

/**
 * @param {Blob | null | undefined} blob
 * @param {string} [base]
 * @returns {string}
 */
export function blobFilename(blob, base = 'olympus-snap') {
	const type = (blob?.type || '').toLowerCase();
	const ext = type === JPEG_MIME || type === 'image/jpg' ? 'jpg' : 'png';
	return `${base}.${ext}`;
}

/**
 * @param {Blob} blob
 * @param {string} [filename]
 * @returns {File | null}
 */
export function blobToFile(blob, filename) {
	if (!blob) return null;
	const name = filename ?? blobFilename(blob);
	return new File([blob], name, {
		type: blob.type || PNG_MIME,
		lastModified: Date.now()
	});
}

/**
 * @param {string} dataUrl
 * @returns {Blob | null}
 */
export function dataUrlToBlob(dataUrl) {
	if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
	const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
	if (!match) return null;
	const mime = match[1] || PNG_MIME;
	const binary = atob(match[2]);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return new Blob([bytes], { type: mime });
}

/**
 * Guest blob URL or booth data URL — the already-uploaded (or in-memory) snap.
 * @param {string | null | undefined} url
 * @returns {Promise<Blob | null>}
 */
export async function captureSourceBlob(url) {
	if (typeof url !== 'string' || !url) return null;
	if (url.startsWith('blob:')) {
		try {
			const res = await fetch(url);
			if (!res.ok) return null;
			return await res.blob();
		} catch {
			return null;
		}
	}
	return dataUrlToBlob(url);
}

/**
 * @param {string} dataUrl
 * @param {string} [filename]
 * @returns {File | null}
 */
export function dataUrlToFile(dataUrl, filename = 'olympus-snap.png') {
	const blob = dataUrlToBlob(dataUrl);
	if (!blob) return null;
	return blobToFile(blob, filename);
}

/**
 * @param {string} dataUrl
 * @returns {boolean}
 */
export function canShareCompositeFile(dataUrl) {
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
	const file = dataUrlToFile(dataUrl);
	if (!file) return false;
	if (typeof navigator.canShare !== 'function') return true;
	try {
		return navigator.canShare({ files: [file] });
	} catch {
		return false;
	}
}

/**
 * @param {string} dataUrl
 * @param {{ filename?: string }} [opts]
 * @returns {Promise<'shared' | 'cancelled' | 'unsupported' | 'failed'>}
 */
export async function shareCompositeFile(dataUrl, opts = {}) {
	const file = dataUrlToFile(dataUrl, opts.filename ?? 'olympus-snap.png');
	if (!file) return 'failed';
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
		return 'unsupported';
	}

	const payload = { files: [file], title: '' };
	try {
		if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
			return 'unsupported';
		}
		await navigator.share(payload);
		return 'shared';
	} catch (err) {
		if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
			return 'cancelled';
		}
		return 'failed';
	}
}

/**
 * @param {Blob} blob
 * @param {{ filename?: string }} [opts]
 * @returns {Promise<'shared' | 'cancelled' | 'unsupported' | 'failed'>}
 */
export async function shareCompositeBlob(blob, opts = {}) {
	const file = blobToFile(blob, opts.filename);
	if (!file) return 'failed';
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
		return 'unsupported';
	}

	const payload = { files: [file], title: '' };
	try {
		if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
			return 'unsupported';
		}
		await navigator.share(payload);
		return 'shared';
	} catch (err) {
		if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
			return 'cancelled';
		}
		return 'failed';
	}
}

/**
 * @param {string} dataUrl
 * @returns {Promise<boolean>}
 */
export async function copyImageToClipboard(dataUrl) {
	if (typeof navigator === 'undefined' || !navigator.clipboard?.write) return false;
	if (typeof ClipboardItem === 'undefined') return false;
	try {
		const file = dataUrlToFile(dataUrl);
		if (!file) return false;
		await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
		return true;
	} catch {
		return false;
	}
}

export function instagramHomeUrl() {
	return 'https://www.instagram.com/';
}

export function facebookHomeUrl() {
	return 'https://www.facebook.com/';
}

/** @type {{ url: string; timer: ReturnType<typeof setTimeout> } | null} */
let pendingDownloadRevoke = null;

function clearPendingDownloadRevoke() {
	if (!pendingDownloadRevoke) return;
	clearTimeout(pendingDownloadRevoke.timer);
	URL.revokeObjectURL(pendingDownloadRevoke.url);
	pendingDownloadRevoke = null;
}

/**
 * @param {Blob} blob
 * @param {string} [filename] When omitted, derived from blob.type (.jpg / .png).
 */
export function downloadBlob(blob, filename) {
	if (typeof document === 'undefined' || !blob) return;
	const name = filename ?? blobFilename(blob);
	clearPendingDownloadRevoke();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	const timer = setTimeout(() => {
		URL.revokeObjectURL(url);
		if (pendingDownloadRevoke?.url === url) pendingDownloadRevoke = null;
	}, 40_000);
	pendingDownloadRevoke = { url, timer };
}

/**
 * @param {string} dataUrl
 * @param {string} [filename]
 */
export function downloadDataUrl(dataUrl, filename = 'olympus-snap.png') {
	const blob = dataUrlToBlob(dataUrl);
	if (!blob) return;
	downloadBlob(blob, filename);
}
