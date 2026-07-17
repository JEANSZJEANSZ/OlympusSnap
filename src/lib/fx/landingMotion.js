/**
 * Landing UI motion — anime.js v4 entrance, ambient pulse, short tap-exit flash.
 */
import { animate, createTimeline, stagger } from 'animejs';

/**
 * @param {HTMLElement} root `.landing` element
 * @param {{ reduced?: boolean }} [opts]
 */
export function createLandingMotion(root, opts = {}) {
	const reduced = !!opts.reduced;
	/** @type {ReturnType<typeof createTimeline> | null} */
	let entrance = null;
	/** @type {ReturnType<typeof animate> | null} */
	let pulseLoop = null;
	/** @type {ReturnType<typeof animate> | null} */
	let shimmerLoop = null;
	/** @type {ReturnType<typeof createTimeline> | null} */
	let exitTl = null;

	if (!reduced) {
		root.classList.add('fx-anime');
		const plaque = root.querySelector('.plaque');
		const words = root.querySelectorAll('.word');
		const tagline = root.querySelector('.tagline');
		const hint = root.querySelector('.ascend-hint');
		const oracle = root.querySelector('.oracle');
		const hero = root.querySelector('.pixel-canvas.hero');

		entrance = createTimeline({
			defaults: { ease: 'outExpo' }
		});
		if (plaque) {
			entrance.add(plaque, { opacity: [0, 1], y: ['-1.2rem', '0'], scale: [0.92, 1], duration: 700 }, 0);
		}
		if (words.length) {
			entrance.add(words, { opacity: [0, 1], y: ['0.8rem', '0'], delay: stagger(120), duration: 650 }, 180);
		}
		if (tagline) {
			entrance.add(tagline, { opacity: [0, 1], y: ['0.4rem', '0'], duration: 500 }, 380);
		}
		if (hint) {
			entrance.add(hint, { opacity: [0, 1], y: ['0.5rem', '0'], duration: 500 }, 400);
		}
		if (oracle) {
			entrance.add(oracle, { opacity: [0, 1], y: ['1rem', '0'], duration: 550 }, 500);
		}
		if (hero) {
			entrance.add(hero, { opacity: [0, 1], duration: 900 }, 80);
		}

		const pulseEl = root.querySelector('.pulse');
		if (pulseEl) {
			pulseLoop = animate(pulseEl, {
				opacity: [1, 0.45, 1],
				duration: 1600,
				loop: true,
				ease: 'inOutSine'
			});
		}

		if (plaque) {
			shimmerLoop = animate(plaque, {
				filter: ['brightness(1)', 'brightness(1.08)', 'brightness(1)'],
				duration: 3200,
				loop: true,
				ease: 'inOutSine',
				delay: 900
			});
		}
	}

	/**
	 * Short cart-insert flash, then run `onDone`.
	 * @param {() => void} onDone
	 */
	function playExit(onDone) {
		if (reduced) {
			onDone();
			return;
		}
		pulseLoop?.pause();
		shimmerLoop?.pause();
		const plaque = root.querySelector('.plaque');
		const veil = root.querySelector('.light-veil');
		const hero = root.querySelector('.pixel-canvas.hero');
		const hint = root.querySelector('.ascend-hint');
		exitTl = createTimeline({
			defaults: { ease: 'inQuad' },
			onComplete: onDone
		});
		if (plaque) exitTl.add(plaque, { scale: 0.94, opacity: 0.35, duration: 160 }, 0);
		if (hint) exitTl.add(hint, { opacity: 0, y: '0.3rem', duration: 140 }, 0);
		if (veil) exitTl.add(veil, { opacity: [0.55, 1.2, 0.2], duration: 180 }, 0);
		if (hero) exitTl.add(hero, { opacity: 0.25, duration: 160 }, 20);
		if (!plaque && !hint && !veil && !hero) onDone();
	}

	function dispose() {
		entrance?.pause();
		pulseLoop?.pause();
		shimmerLoop?.pause();
		exitTl?.pause();
		entrance = null;
		pulseLoop = null;
		shimmerLoop = null;
		exitTl = null;
		root.classList.remove('fx-anime');
	}

	return { playExit, dispose };
}
