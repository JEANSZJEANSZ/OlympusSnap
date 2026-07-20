/**
 * Shared-element handoff: Frame Select → Camera viewfinder.
 */
import { writable } from 'svelte/store';

/**
 * @typedef {{ left: number; top: number; width: number; height: number }} HandoffRect
 * @typedef {{
 *   src: string;
 *   from: HandoffRect;
 *   reduced: boolean;
 * }} FrameHandoffPayload
 */

/** Active flight payload (null when idle). */
/** @type {import('svelte/store').Writable<FrameHandoffPayload | null>} */
export const frameHandoff = writable(null);

/** True while the overlay is flying / settling — Camera keeps the real frame hidden. */
/** @type {import('svelte/store').Writable<boolean>} */
export const frameHandoffBusy = writable(false);

/**
 * @param {{ src: string; fromEl: Element; reduced?: boolean }} opts
 */
export function beginFrameHandoff({ src, fromEl, reduced = false }) {
	if (!src || !fromEl) return;
	const r = fromEl.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return;
	frameHandoffBusy.set(true);
	frameHandoff.set({
		src,
		from: {
			left: r.left,
			top: r.top,
			width: r.width,
			height: r.height
		},
		reduced: !!reduced
	});
}

export function clearFrameHandoff() {
	frameHandoff.set(null);
	frameHandoffBusy.set(false);
}
