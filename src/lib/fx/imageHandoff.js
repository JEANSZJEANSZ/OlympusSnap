/**
 * Shared-element image handoff between views (Camera ↔ Studio, reverse exits).
 */
import { writable } from 'svelte/store';

/**
 * @typedef {{ left: number; top: number; width: number; height: number }} HandoffRect
 * @typedef {{
 *   src: string;
 *   from: HandoffRect;
 *   targetSel: string;
 *   reduced: boolean;
 * }} ImageHandoffPayload
 */

/** @type {import('svelte/store').Writable<ImageHandoffPayload | null>} */
export const imageHandoff = writable(null);

/** True while the overlay is flying / settling. */
/** @type {import('svelte/store').Writable<boolean>} */
export const imageHandoffBusy = writable(false);

/**
 * @param {{
 *   src: string;
 *   fromEl: Element;
 *   targetSel: string;
 *   reduced?: boolean;
 * }} opts
 */
export function beginImageHandoff({ src, fromEl, targetSel, reduced = false }) {
	if (!src || !fromEl || !targetSel) return;
	const r = fromEl.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return;
	imageHandoffBusy.set(true);
	imageHandoff.set({
		src,
		from: {
			left: r.left,
			top: r.top,
			width: r.width,
			height: r.height
		},
		targetSel,
		reduced: !!reduced
	});
}

export function clearImageHandoff() {
	imageHandoff.set(null);
	imageHandoffBusy.set(false);
}
