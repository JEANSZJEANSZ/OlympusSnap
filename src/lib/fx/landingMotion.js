/**
 * Landing UI motion — anime.js v4 entrance, ambient pulse, cinematic tap-exit.
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
	/** @type {ReturnType<typeof animate> | null} */
	let worldFloat = null;
	/** @type {ReturnType<typeof animate> | null} */
	let hintGlow = null;
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
		const world = root.querySelector('.world');

		entrance = createTimeline({
			defaults: { ease: 'outExpo' },
			onComplete: () => {
				// Hero position is owned by applyCoverFitCanvas (bottom-anchored translateX).
				if (hero) hero.style.filter = '';
			}
		});

		if (world) {
			entrance.add(
				world,
				{
					scale: [1.06, 1],
					y: ['3%', '0%'],
					filter: ['brightness(1.22) saturate(1.08)', 'brightness(1) saturate(1)'],
					duration: 1400,
					ease: 'outExpo'
				},
				0
			);
		}

		if (plaque) {
			entrance.add(
				plaque,
				{ opacity: [0, 1], y: ['-1.6rem', '0'], scale: [0.86, 1], rotate: [-2.5, 0], duration: 820 },
				120
			);
		}
		if (words.length) {
			entrance.add(
				words,
				{
					opacity: [0, 1],
					y: ['1.2rem', '0'],
					scale: [0.82, 1],
					rotate: (/** @type {number} */ i) => (i === 0 ? -4 : 4),
					delay: stagger(140),
					duration: 720,
					ease: 'outBack'
				},
				260
			);
		}
		if (hero) {
			entrance.add(
				hero,
				{
					opacity: [0, 1],
					filter: ['brightness(1.35) blur(3px)', 'brightness(1) blur(0px)'],
					duration: 1100,
					ease: 'outExpo'
				},
				180
			);
		}
		if (tagline) {
			entrance.add(tagline, { opacity: [0, 1], y: ['0.55rem', '0'], duration: 520 }, 520);
		}
		if (hint) {
			entrance.add(
				hint,
				{ opacity: [0, 1], y: ['0.85rem', '0'], scale: [0.88, 1], duration: 620, ease: 'outBack' },
				640
			);
		}
		if (oracle) {
			entrance.add(oracle, { opacity: [0, 1], y: ['1.35rem', '0'], duration: 580 }, 720);
		}

		const pulseEl = root.querySelector('.pulse');
		if (pulseEl) {
			pulseLoop = animate(pulseEl, {
				opacity: [1, 0.38, 1],
				scale: [1, 1.04, 1],
				duration: 1800,
				loop: true,
				ease: 'inOutSine'
			});
		}

		if (plaque) {
			shimmerLoop = animate(plaque, {
				filter: ['brightness(1)', 'brightness(1.12)', 'brightness(1)'],
				duration: 3600,
				loop: true,
				ease: 'inOutSine',
				delay: 1100
			});
		}

		if (world) {
			worldFloat = animate(world, {
				y: ['0%', '-0.65%'],
				duration: 5200,
				loop: true,
				alternate: true,
				ease: 'inOutSine'
			});
		}

		if (hint) {
			hintGlow = animate(hint, {
				boxShadow: [
					'3px 3px 0 #081424, 0 0 0 rgba(210,193,165,0)',
					'3px 3px 0 #081424, 0 0 28px rgba(210,193,165,0.35)',
					'3px 3px 0 #081424, 0 0 0 rgba(210,193,165,0)'
				],
				duration: 2800,
				loop: true,
				ease: 'inOutSine',
				delay: 900
			});
		}
	}

	/**
	 * UI chrome floats opposite the pointer — world keeps its own parallax.
	 * @param {number} x 0..1
	 * @param {number} y 0..1
	 */
	function setPointerParallax(x, y) {
		if (reduced) return;
		const stage = root.querySelector('.stage');
		if (!stage || root.classList.contains('exiting')) return;
		const px = (x - 0.5) * 2;
		const py = (y - 0.5) * 2;
		stage.style.transform = `translate(${px * -6}px, ${py * -4}px)`;
	}

	/**
	 * Rush into the temple — Zeus strike, zoom, whiteout.
	 * @param {() => void} onDone
	 * @param {{ burstSky?: () => void }} [hooks]
	 */
	function playExit(onDone, hooks = {}) {
		root.classList.add('exiting');
		entrance?.pause();
		pulseLoop?.pause();
		shimmerLoop?.pause();
		worldFloat?.pause();
		hintGlow?.pause();

		const flash = root.querySelector('.exit-flash');
		const bolt = root.querySelector('.exit-bolt');
		const flicker = root.querySelector('.sky-flicker');

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
		hooks.burstSky?.();
		flicker?.classList.add('active');

		if (chrome.length) {
			hasStep = true;
			exitTl.add(
				chrome,
				{ opacity: 0, y: '-1rem', scale: 0.96, duration: 320, delay: stagger(40) },
				0
			);
		}
		if (world) {
			hasStep = true;
			exitTl.add(
				world,
				{
					scale: [1, 2.65],
					y: ['0%', '10%'],
					rotate: [0, 0.8],
					filter: ['brightness(1)', 'brightness(1.28) saturate(1.15)'],
					duration: 980,
					ease: 'inExpo'
				},
				0
			);
		}
		if (bolt) {
			hasStep = true;
			exitTl.add(
				bolt,
				{
					opacity: [0, 1, 0.85, 0],
					scaleX: [0.5, 1.25, 1.05, 0.7],
					scaleY: [0.55, 1.35, 1.2, 1.65],
					duration: 420,
					ease: 'outQuad'
				},
				520
			);
			exitTl.add(
				bolt,
				{
					opacity: [0, 0.9, 0],
					scaleX: [0.6, 1.1],
					scaleY: [0.65, 1.45],
					duration: 260,
					ease: 'outQuad'
				},
				780
			);
		}
		if (flash) {
			hasStep = true;
			exitTl.add(flash, { opacity: [0, 0.75], duration: 220, ease: 'inQuad' }, 720);
			exitTl.add(flash, { opacity: [0.75, 1], duration: 280, ease: 'inExpo' }, 940);
			exitTl.add(flash, { opacity: 1, duration: 140, ease: 'linear' }, 1220);
		}
		if (!hasStep) onDone();
	}

	function dispose() {
		entrance?.pause();
		pulseLoop?.pause();
		shimmerLoop?.pause();
		worldFloat?.pause();
		hintGlow?.pause();
		exitTl?.pause();
		entrance = null;
		pulseLoop = null;
		shimmerLoop = null;
		worldFloat = null;
		hintGlow = null;
		exitTl = null;
		root.classList.remove('fx-anime');
		root.classList.remove('exiting');
		const stage = root.querySelector('.stage');
		if (stage) stage.style.transform = '';
		const world = root.querySelector('.world');
		if (world) {
			world.style.transform = '';
			world.style.filter = '';
		}
		const hero = root.querySelector('.pixel-canvas.hero');
		if (hero) hero.style.filter = '';
	}

	return { playExit, setPointerParallax, dispose };
}
