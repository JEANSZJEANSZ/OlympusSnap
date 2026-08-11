/**
 * Landing spectacle layer — lightweight embers + divine sky flicker.
 * Canvas 2D only; pauses when tab hidden.
 */

const EMBER_COUNT = 28;
const FLICKER_MIN = 4.2;
const FLICKER_MAX = 9.5;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ reduced?: boolean }} [opts]
 */
export function createLandingEmbers(canvas, opts = {}) {
	const reduced = !!opts.reduced;
	const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
	if (!ctx || reduced) {
		return { resize() {}, setPointer() {}, dispose() {} };
	}

	/** @type {{ x: number, y: number, vx: number, vy: number, life: number, max: number, size: number, warm: number }[]} */
	const pool = [];
	for (let i = 0; i < EMBER_COUNT; i++) {
		pool.push(spawn(Math.random() * 800, Math.random() * 600, true));
	}

	let mx = 0.5;
	let my = 0.4;
	let w = 1;
	let h = 1;
	let raf = 0;
	let last = performance.now();

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {boolean} [anywhere]
	 */
	function spawn(x, y, anywhere = false) {
		return {
			x: anywhere ? x : w * (0.15 + Math.random() * 0.7),
			y: anywhere ? y : h * (0.55 + Math.random() * 0.38),
			vx: (Math.random() - 0.5) * 8,
			vy: -10 - Math.random() * 22,
			life: 0,
			max: 1.6 + Math.random() * 2.4,
			size: 1 + Math.random() * 2.2,
			warm: 0.55 + Math.random() * 0.45
		};
	}

	function resize() {
		const parent = canvas.parentElement;
		if (!parent) return;
		const rect = parent.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		w = rect.width;
		h = rect.height;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function tick(now) {
		if (document.hidden) {
			raf = requestAnimationFrame(tick);
			last = now;
			return;
		}
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;

		ctx.clearRect(0, 0, w, h);
		const ax = (mx - 0.5) * 18;
		const ay = (my - 0.5) * 10;

		for (let i = 0; i < pool.length; i++) {
			const p = pool[i];
			p.life += dt;
			if (p.life >= p.max) {
				pool[i] = spawn(0, 0);
				continue;
			}
			const t = p.life / p.max;
			const fade = t < 0.12 ? t / 0.12 : t > 0.72 ? (1 - t) / 0.28 : 1;
			p.vx += ax * dt * 0.35;
			p.vy += ay * dt * 0.2 - 4 * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vx *= 1 - dt * 0.8;

			const alpha = fade * 0.55 * p.warm;
			const gold = `rgba(255, ${200 + ((p.warm * 40) | 0)}, ${120 + ((p.warm * 30) | 0)}, ${alpha})`;
			ctx.fillStyle = gold;
			const s = p.size;
			ctx.fillRect((p.x + 0.5) | 0, (p.y + 0.5) | 0, s, s);
			if (s > 1.8) {
				ctx.fillStyle = `rgba(255, 248, 220, ${alpha * 0.45})`;
				ctx.fillRect((p.x + 0.5) | 0, (p.y - s) | 0, 1, 1);
			}
		}

		raf = requestAnimationFrame(tick);
	}

	resize();
	raf = requestAnimationFrame(tick);

	return {
		resize,
		/** @param {number} x @param {number} y */
		setPointer(x, y) {
			mx = x;
			my = y;
		},
		dispose() {
			cancelAnimationFrame(raf);
			ctx.clearRect(0, 0, w, h);
		}
	};
}

/**
 * Occasional Zeus flicker on the sky wash + micro camera kick on `.world`.
 * @param {HTMLElement} landing
 * @param {{ reduced?: boolean, world?: HTMLElement | null }} [opts]
 */
export function createLandingSkyFlicker(landing, opts = {}) {
	const reduced = !!opts.reduced;
	const kickTarget = opts.world ?? landing.querySelector('.olympus-sky-mount');
	const flicker = landing.querySelector('.sky-flicker');

	if (reduced || !flicker) {
		return { burst() {}, dispose() {} };
	}

	let nextAt = performance.now() + 2200 + Math.random() * 3000;
	let raf = 0;
	/** @type {number | undefined} */
	let kickTimer;

	function schedule() {
		nextAt = performance.now() + (FLICKER_MIN + Math.random() * (FLICKER_MAX - FLICKER_MIN)) * 1000;
	}

	function burst() {
		flicker.classList.add('active');
		if (kickTarget) kickTarget.classList.add('divine-kick');
		schedule();
		if (kickTimer) window.clearTimeout(kickTimer);
		kickTimer = window.setTimeout(() => {
			flicker.classList.remove('active');
			kickTarget?.classList.remove('divine-kick');
			kickTimer = undefined;
		}, 180);
	}

	function tick(now) {
		if (!document.hidden && now >= nextAt) burst();
		raf = requestAnimationFrame(tick);
	}

	raf = requestAnimationFrame(tick);

	return {
		burst,
		dispose() {
			cancelAnimationFrame(raf);
			if (kickTimer) window.clearTimeout(kickTimer);
			flicker.classList.remove('active');
			kickTarget?.classList.remove('divine-kick');
		}
	};
}
