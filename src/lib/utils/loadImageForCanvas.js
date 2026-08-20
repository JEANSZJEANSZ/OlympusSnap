/**
 * Load images for canvas compositing without tainting the canvas.
 * Cross-origin URLs (e.g. Photobooth asset files) require
 * crossOrigin="anonymous" and CORS headers on the response.
 *
 * Frame/sticker art is also warmed into blob URLs so <img> display
 * never depends on a cold network GET at carousel time.
 */
import { writable } from 'svelte/store';

const WARM_CONCURRENCY = 5;

/** @type {Map<string, { img: HTMLImageElement; blobUrl: string }>} */
const readyCache = new Map();

/** @type {Map<string, Promise<HTMLImageElement | null>>} */
const inflight = new Map();

/** Bumps when a blob URL is stored so Svelte derived src can update. */
export const frameImageCacheTick = writable(0);

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
function decodeImage(src) {
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

/**
 * @param {string} src
 * @returns {string}
 */
export function resolveCachedFrameSrc(src) {
	if (!src) return '';
	return readyCache.get(src)?.blobUrl || src;
}

/**
 * True when `src` is already display-safe (data/blob) or warmed into the blob cache.
 * @param {string} src
 * @returns {boolean}
 */
export function isFrameImageCached(src) {
	if (!src) return false;
	if (src.startsWith('data:') || src.startsWith('blob:')) return true;
	return readyCache.has(src);
}

/**
 * @param {string} src
 */
export function invalidateFrameImage(src) {
	if (!src) return;
	inflight.delete(src);
	const hit = readyCache.get(src);
	if (!hit) return;
	if (hit.blobUrl.startsWith('blob:') && hit.blobUrl !== src) {
		URL.revokeObjectURL(hit.blobUrl);
	}
	readyCache.delete(src);
	frameImageCacheTick.update((n) => n + 1);
}

/**
 * Load images for canvas compositing. Uses a warmed blob URL when present.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageForCanvas(src) {
	const hit = readyCache.get(src);
	if (hit) return Promise.resolve(hit.img);
	const pending = inflight.get(src);
	if (pending) {
		return pending.then((img) => {
			if (img) return img;
			return decodeImage(src);
		});
	}
	return decodeImage(resolveCachedFrameSrc(src));
}

/**
 * @param {string} src
 * @returns {Promise<{ img: HTMLImageElement; blobUrl: string }>}
 */
async function fetchAndDecode(src) {
	let blobUrl = src;
	if (!src.startsWith('data:') && !src.startsWith('blob:')) {
		const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
		if (!res.ok) throw new Error(`Failed to load ${src}`);
		blobUrl = URL.createObjectURL(await res.blob());
	}
	try {
		const img = await decodeImage(blobUrl);
		return { img, blobUrl };
	} catch (err) {
		if (blobUrl !== src && blobUrl.startsWith('blob:')) {
			URL.revokeObjectURL(blobUrl);
		}
		throw err;
	}
}

/**
 * Warm a frame image (deduped). Resolves null on failure so UI can still proceed.
 * Failed loads are not cached — a later call retries.
 * @param {string | undefined | null} src
 * @returns {Promise<HTMLImageElement | null>}
 */
export function preloadFrameImage(src) {
	if (!src) return Promise.resolve(null);
	const ready = readyCache.get(src);
	if (ready) return Promise.resolve(ready.img);

	let pending = inflight.get(src);
	if (!pending) {
		pending = fetchAndDecode(src)
			.then((entry) => {
				readyCache.set(src, entry);
				frameImageCacheTick.update((n) => n + 1);
				return entry.img;
			})
			.catch(() => {
				inflight.delete(src);
				return null;
			});
		inflight.set(src, pending);
	}
	return pending;
}

/**
 * Prefetch many images with a small concurrency cap.
 * @param {Array<string | undefined | null>} srcs
 * @returns {Promise<void>}
 */
export async function warmFrameImages(srcs) {
	const unique = [...new Set(srcs.filter((s) => typeof s === 'string' && s.length > 0))];
	if (!unique.length) return;

	let cursor = 0;
	const worker = async () => {
		while (cursor < unique.length) {
			const src = unique[cursor++];
			await preloadFrameImage(src);
		}
	};
	const n = Math.min(WARM_CONCURRENCY, unique.length);
	await Promise.all(Array.from({ length: n }, () => worker()));
}
