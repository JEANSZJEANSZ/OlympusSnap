/**
 * Load images for canvas compositing without tainting the canvas.
 * Cross-origin URLs (e.g. Photobooth asset files) require
 * crossOrigin="anonymous" and CORS headers on the response.
 */

/**
 * @param {string} src
 * @returns {boolean}
 */
export function isCrossOriginImageSrc(src) {
	if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false;
	try {
		const resolved = new URL(src, typeof location !== 'undefined' ? location.href : undefined);
		if (typeof location === 'undefined') return true;
		return resolved.origin !== location.origin;
	} catch {
		return false;
	}
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageForCanvas(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		if (isCrossOriginImageSrc(src)) {
			img.crossOrigin = 'anonymous';
		}
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load ${src}`));
		img.src = src;
	});
}

/** @type {Map<string, Promise<HTMLImageElement | null>>} */
const framePreloadCache = new Map();

/**
 * Warm a frame image (deduped). Resolves null on failure so UI can still proceed.
 * @param {string | undefined | null} src
 * @returns {Promise<HTMLImageElement | null>}
 */
export function preloadFrameImage(src) {
	if (!src) return Promise.resolve(null);
	let pending = framePreloadCache.get(src);
	if (!pending) {
		pending = loadImageForCanvas(src).catch(() => null);
		framePreloadCache.set(src, pending);
	}
	return pending;
}
