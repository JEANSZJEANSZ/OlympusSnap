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
	 * Rush into the temple, strike lightning, then route under a whiteout.
	 * @param {() => void} onDone
	 */
	function playExit(onDone) {
		root.classList.add('exiting');
		entrance?.pause();
		pulseLoop?.pause();
		shimmerLoop?.pause();

		const flash = root.querySelector('.exit-flash');
		const bolt = root.querySelector('.exit-bolt');

		if (reduced) {
			if (!flash) {
				onDone();
				return;
			}
			exitTl = createTimeline({
				defaults: { ease: 'linear' },
				onComplete: onDone
			});
			exitTl.add(flash, { opacity: [0, 1], duration: 120 }, 0);
			return;
		}

		const world = root.querySelector('.world');
		const chrome = root.querySelectorAll('.plaque, .ascend-hint, .oracle');
		exitTl = createTimeline({
			defaults: { ease: 'inQuad' },
			onComplete: onDone
		});

		let hasStep = false;
		if (chrome.length) {
			hasStep = true;
			exitTl.add(
				chrome,
				{ opacity: 0, y: '-0.7rem', duration: 280, delay: stagger(35) },
				0
			);
		}
		if (world) {
			hasStep = true;
			exitTl.add(
				world,
				{
					scale: [1, 2.35],
					y: ['0%', '8%'],
					filter: ['brightness(1)', 'brightness(1.18)'],
					duration: 900,
					ease: 'inExpo'
				},
				0
			);
		}
		if (flash) {
			hasStep = true;
			exitTl.add(flash, { opacity: [0, 1], duration: 260, ease: 'inExpo' }, 680);
			exitTl.add(flash, { opacity: 1, duration: 160, ease: 'linear' }, 940);
		}
		if (bolt) {
			hasStep = true;
			exitTl.add(
				bolt,
				{
					opacity: [0, 1, 0],
					scaleX: [0.65, 1.15, 0.85],
					scaleY: [0.7, 1.25, 1.55],
					duration: 300,
					ease: 'outQuad'
				},
				650
			);
		}
		if (!hasStep) onDone();
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
		root.classList.remove('exiting');
	}

	return { playExit, dispose };
}
