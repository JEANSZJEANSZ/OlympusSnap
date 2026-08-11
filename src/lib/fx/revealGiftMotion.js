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
			{
				opacity: [0, 1],
				y: ['1.4rem', '0'],
				scale: [0.58, 1.06, 1],
				rotate: ['-3deg', '1.5deg', '0deg'],
				duration: 920,
				ease: 'outElastic(1, 0.72)'
			},
			0
		);
	}
	if (head) {
		tl.add(head, { opacity: [0, 1], y: ['0.85rem', '0'], scale: [0.94, 1], duration: 620 }, 120);
	}
	if (qr) {
		tl.add(qr, { opacity: [0, 1], y: ['0.95rem', '0'], scale: [0.88, 1], duration: 580 }, 240);
	}
	if (dialog) {
		tl.add(dialog, { opacity: [0, 1], y: ['0.7rem', '0'], duration: 520 }, 360);
	}
	if (actions) {
		const kids = actions.children;
		if (kids.length) {
			tl.add(
				kids,
				{ opacity: [0, 1], y: ['0.55rem', '0'], scale: [0.92, 1], delay: stagger(85), duration: 440 },
				480
			);
		}
	}

	return () => {
		tl.pause();
	};
}
