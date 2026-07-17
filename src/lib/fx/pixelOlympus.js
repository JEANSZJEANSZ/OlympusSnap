/**
 * Hybrid Olympus orchestrator.
 * DOM sky → olympusSkyDom.js
 * Temple / cloud bank → olympusTemple.js
 */
import { createOlympusSky } from './olympusSkyDom.js';
import { createOlympusTemple } from './olympusTemple.js';

/**
 * @param {HTMLElement} skyRoot
 * @param {HTMLCanvasElement} heroCanvas
 * @param {{ reduced?: boolean }} [opts]
 */
export function createPixelOlympus(skyRoot, heroCanvas, opts = {}) {
	const reduced = !!opts.reduced;
	const sky = createOlympusSky(skyRoot, { reduced });
	const hero = createOlympusTemple(heroCanvas, { reduced });

	let raf = 0;
	let last = performance.now();
	let elapsed = 0;

	function frame(now) {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		elapsed += dt;
		sky.tick(dt, elapsed);
		hero.tick(dt, elapsed, sky.getDay());
		raf = requestAnimationFrame(frame);
	}

	const onResize = () => {
		sky.resize();
		hero.resize();
	};

	onResize();
	window.addEventListener('resize', onResize);
	raf = requestAnimationFrame(frame);

	return {
		/** @param {number} d @param {boolean} [immediate] */
		setDay(d, immediate = false) {
			sky.setDay(d, immediate);
		},
		/** @param {number} delta */
		nudgeDay(delta) {
			sky.nudgeDay(delta);
		},
		/** @param {number} x @param {number} y */
		setPointer(x, y) {
			sky.setPointer(x, y);
			hero.setPointer(x, y);
		},
		dispose() {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			sky.dispose();
			hero.dispose();
		}
	};
}

export { lerpDay } from './pixelShared.js';
