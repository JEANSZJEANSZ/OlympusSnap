import { get, writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<string | null>} */
export const selectedFrameId = writable(null);

/**
 * Captures in slot order (data URLs). Empty until camera session fills them.
 * @type {import('svelte/store').Writable<string[]>}
 */
export const capturedPhotos = writable([]);

/**
 * Primary / studio preview image — usually first snap or a pre-sticker composite.
 * @type {import('svelte/store').Writable<string | null>}
 */
export const capturedImageData = writable(null);

/**
 * @typedef {{
 *   id: string;
 *   src: string;
 *   x: number;
 *   y: number;
 *   scale: number;
 *   rotation: number;
 * }} ActiveSticker
 * @type {import('svelte/store').Writable<ActiveSticker[]>}
 */
export const activeStickers = writable([]);

/** @type {import('svelte/store').Writable<string | null>} */
export const finalCompositedImage = writable(null);

/** Clear capture session (camera back / export restart). */
export function clearCaptures() {
	capturedPhotos.set([]);
	capturedImageData.set(null);
}

/**
 * @param {string} dataUrl
 */
export function appendCapture(dataUrl) {
	capturedPhotos.update((list) => [...list, dataUrl]);
	const list = get(capturedPhotos);
	if (!get(capturedImageData)) capturedImageData.set(list[0] ?? null);
}
