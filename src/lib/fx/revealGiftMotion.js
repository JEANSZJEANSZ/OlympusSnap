/**
 * Gift reveal UI entrance — anime.js stagger after limestone crack settles.
 */
import { createTimeline, stagger } from 'animejs';

/**
 * @param {HTMLElement} root `.stage` element
 * @param {{ reduced?: boolean }} [opts]
 */
export function playRevealGiftMotion(root, opts = {}) {
	const reduced = !!opts.reduced;
	if (reduced || !root) return () => {};

	root.classList.add('fx-anime');

	const dock = root.querySelector('.frame-dock');
	const head = root.querySelector('.head');
	const qr = root.querySelector('.qr-side');
	const dialog = root.querySelector('.dialog');
	const actions = root.querySelector('.actions');

	const tl = createTimeline({
		defaults: { ease: 'outExpo' }
	});

	if (dock) {
		tl.add(
			dock,
			{ opacity: [0, 1], y: ['0.85rem', '0'], scale: [0.72, 1], duration: 720 },
			0
		);
	}
	if (head) {
		tl.add(head, { opacity: [0, 1], y: ['0.65rem', '0'], duration: 520 }, 90);
	}
	if (qr) {
		tl.add(qr, { opacity: [0, 1], y: ['0.75rem', '0'], duration: 520 }, 200);
	}
	if (dialog) {
		tl.add(dialog, { opacity: [0, 1], y: ['0.55rem', '0'], duration: 480 }, 300);
	}
	if (actions) {
		const kids = actions.children;
		if (kids.length) {
			tl.add(kids, { opacity: [0, 1], y: ['0.4rem', '0'], delay: stagger(70), duration: 380 }, 400);
		}
	}

	return () => {
		tl.pause();
	};
}
