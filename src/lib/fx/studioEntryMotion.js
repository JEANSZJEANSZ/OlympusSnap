/**
 * Studio frame entry — fall from Z with tilt settle (presentation only).
 */
import { animate } from 'animejs';

/** CSS rest tilt breaks Konva hit testing on Transformer anchors — must stay 0. */
export const STUDIO_REST_TILT = 0;

/**
 * @param {HTMLElement | null | undefined} shellEl
 * @param {{ reduced?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export async function playStudioEntry(shellEl, opts = {}) {
	if (!shellEl) return;

	const reduced = !!opts.reduced;
	shellEl.style.pointerEvents = 'none';
	shellEl.style.transformOrigin = '50% 80%';

	const applyRest = () => {
		shellEl.style.setProperty('--entry-y', '0px');
		shellEl.style.setProperty('--entry-z', '0px');
		shellEl.style.setProperty('--entry-rx', '0deg');
		shellEl.style.setProperty('--entry-rz', `${STUDIO_REST_TILT}deg`);
		shellEl.style.setProperty('--entry-scale', '1');
		shellEl.style.opacity = '1';
	};

	if (reduced) {
		applyRest();
		return;
	}

	try {
		shellEl.style.opacity = '0';
		shellEl.style.setProperty('--entry-y', '-120px');
		shellEl.style.setProperty('--entry-z', '180px');
		shellEl.style.setProperty('--entry-rx', '18deg');
		shellEl.style.setProperty('--entry-rz', '-8deg');
		shellEl.style.setProperty('--entry-scale', '0.88');

		await animate(shellEl, {
			opacity: [0, 1],
			'--entry-y': ['-120px', '0px'],
			'--entry-z': ['180px', '0px'],
			'--entry-rx': ['18deg', '0deg'],
			'--entry-rz': ['-8deg', `${STUDIO_REST_TILT}deg`],
			'--entry-scale': [0.88, 1],
			duration: 680,
			ease: 'outCubic'
		});

		await animate(shellEl, {
			'--entry-y': ['0px', '7px', '0px'],
			duration: 140,
			ease: 'outQuad'
		});
	} finally {
		shellEl.style.pointerEvents = '';
	}
}
