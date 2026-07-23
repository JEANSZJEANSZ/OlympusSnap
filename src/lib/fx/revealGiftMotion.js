/**
 * Gift reveal UI entrance — anime.js stagger after marble crack.
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
		tl.add(dock, { opacity: [0, 1], y: ['1.2rem', '0'], scale: [0.94, 1], duration: 650 }, 0);
	}
	if (head) {
		tl.add(head, { opacity: [0, 1], y: ['0.8rem', '0'], duration: 550 }, 80);
	}
	if (qr) {
		tl.add(qr, { opacity: [0, 1], y: ['1rem', '0'], duration: 550 }, 180);
	}
	if (dialog) {
		tl.add(dialog, { opacity: [0, 1], y: ['0.8rem', '0'], duration: 500 }, 280);
	}
	if (actions) {
		const kids = actions.children;
		if (kids.length) {
			tl.add(kids, { opacity: [0, 1], y: ['0.5rem', '0'], delay: stagger(80), duration: 400 }, 380);
		}
	}

	return () => {
		tl.pause();
	};
}
