/**
 * Admin forge retreat — panels seal, ember glow fades, sky veil before route change.
 */
import { createTimeline, stagger } from 'animejs';

/**
 * @param {HTMLElement} root `.admin-view`
 * @param {{ reduced?: boolean }} [opts]
 */
export function createAdminExitMotion(root, opts = {}) {
	const reduced = !!opts.reduced;
	/** @type {ReturnType<typeof createTimeline> | null} */
	let exitTl = null;

	/**
	 * @param {() => void} onDone
	 */
	function playExit(onDone) {
		root.classList.add('exiting');

		const content = root.querySelector('.content');
		const forgeGlow = root.querySelector('.forge-glow');
		const veil = root.querySelector('.back-veil');
		const backdrop = root.querySelector('.mount');

		if (reduced) {
			exitTl = createTimeline({
				defaults: { ease: 'linear' },
				onComplete: onDone
			});
			if (veil) exitTl.add(veil, { opacity: [0, 1], duration: 180 }, 0);
			else exitTl.add(root, { opacity: [1, 0], duration: 180 }, 0);
			return;
		}

		exitTl = createTimeline({
			defaults: { ease: 'inCubic' },
			onComplete: onDone
		});

		const panels = root.querySelectorAll('.forge-panel, .tabs, .footer-actions, .hint');
		if (panels.length) {
			exitTl.add(
				panels,
				{
					opacity: [1, 0],
					y: ['0px', '18px'],
					scale: [1, 0.97],
					duration: 360,
					delay: stagger(24)
				},
				0
			);
		}
		if (content) {
			exitTl.add(
				content,
				{
					opacity: [1, 0],
					y: ['0px', '28px'],
					duration: 420,
					ease: 'inExpo'
				},
				40
			);
		}
		if (forgeGlow) {
			exitTl.add(
				forgeGlow,
				{
					opacity: [0.75, 0],
					scale: [1, 1.14],
					duration: 520,
					ease: 'inQuad'
				},
				20
			);
		}
		if (backdrop) {
			exitTl.add(
				backdrop,
				{
					filter: ['brightness(1)', 'brightness(0.58) saturate(0.85)'],
					y: ['0%', '5%'],
					duration: 480,
					ease: 'inQuad'
				},
				60
			);
		}
		if (veil) {
			exitTl.add(veil, { opacity: [0, 1], duration: 380, ease: 'inQuad' }, 300);
		} else {
			exitTl.add(root, { opacity: [1, 0], duration: 320, ease: 'inQuad' }, 340);
		}
	}

	function dispose() {
		exitTl?.pause();
		exitTl = null;
		root.classList.remove('exiting');
		const veil = root.querySelector('.back-veil');
		if (veil) veil.style.opacity = '';
	}

	return { playExit, dispose };
}

/**
 * One-shot exit when motion controller is not mounted yet.
 * @param {HTMLElement | null | undefined} rootEl
 * @param {{ reduced?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export function playAdminExitOnce(rootEl, opts = {}) {
	if (!rootEl) return Promise.resolve();
	return new Promise((resolve) => {
		const motion = createAdminExitMotion(rootEl, opts);
		motion.playExit(() => {
			motion.dispose();
			resolve();
		});
	});
}
