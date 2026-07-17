import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<string | null>} */
export const selectedFrameId = writable(null);

/** @type {import('svelte/store').Writable<string | null>} */
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
