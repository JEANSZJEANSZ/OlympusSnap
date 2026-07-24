/**
 * Short view exit — fade + directional slide before route change.
 */
import { animate } from 'animejs';

/**
 * @param {HTMLElement | null | undefined} rootEl
 * @param {{
 *   reduced?: boolean;
 *   direction?: 'left' | 'right' | 'down' | 'up';
 *   duration?: number;
 * }} [opts]
 * @returns {Promise<void>}
 */
export async function playViewExit(rootEl, opts = {}) {
	if (!rootEl) return;

	const reduced = !!opts.reduced;
	const direction = opts.direction ?? 'left';
	const duration = opts.duration ?? 380;

	if (reduced) {
		await animate(rootEl, {
			opacity: [1, 0],
			duration: 180,
			ease: 'outQuad'
		});
		return;
	}

	const dx = direction === 'left' ? -48 : direction === 'right' ? 48 : 0;
	const dy = direction === 'up' ? -36 : direction === 'down' ? 36 : 0;

	rootEl.style.willChange = 'opacity, transform';
	try {
		await animate(rootEl, {
			opacity: [1, 0],
			x: [0, dx],
			y: [0, dy],
			duration,
			ease: 'inCubic'
		});
	} finally {
		rootEl.style.willChange = '';
	}
}
