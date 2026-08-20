/**
 * Pythia oracle rite — Delphi altar spin (no bird / rope).
 */
import { animate } from 'animejs';

/**
 * @param {number} start
 * @param {number} target
 * @param {number} length
 * @param {number} maxSteps
 */
function buildOracleSteps(start, target, length, maxSteps) {
	/** @type {number[]} */
	const steps = [];
	if (length <= 1 || maxSteps <= 0) return steps;

	let idx = ((start % length) + length) % length;
	const forward = (target - idx + length) % length || length;
	let total = forward;
	while (total + length <= maxSteps) total += length;
	if (total > maxSteps) total = Math.max(1, Math.min(maxSteps, forward));

	for (let n = 0; n < total; n++) {
		idx = (idx + 1) % length;
		steps.push(idx);
	}
	if (steps.length) steps[steps.length - 1] = target;
	else steps.push(target);
	return steps;
}

/** @param {number} ms */
function delay(ms) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

/**
 * @param {HTMLElement} el
 * @param {Record<string, unknown>} props
 * @returns {Promise<void>}
 */
function anim(el, props) {
	return new Promise((resolve) => {
		animate(el, {
			...props,
			onComplete: () => resolve()
		});
	});
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   listLength: number;
 *   startIndex: number;
 *   targetIndex: number;
 *   shuffleMs?: number;
 *   reduced?: boolean;
 *   onStep?: (index: number) => void;
 *   onPhase?: (phase: 'weigh' | 'spin' | 'spoken' | 'drop') => void;
 *   onDone?: () => void;
 *   signal?: { cancelled: boolean };
 * }} opts
 * @returns {Promise<void>}
 */
export async function playOracleRite(root, opts) {
	const listLength = Math.max(0, opts.listLength | 0);
	const targetIndex = Math.min(
		Math.max(0, opts.targetIndex | 0),
		Math.max(0, listLength - 1)
	);
	const startIndex = Math.min(
		Math.max(0, opts.startIndex | 0),
		Math.max(0, listLength - 1)
	);
	const reduced = !!opts.reduced;
	const shuffleMs = Math.max(600, Math.min(8000, opts.shuffleMs ?? 2600));
	const signal = opts.signal ?? { cancelled: false };
	const dead = () => signal.cancelled;

	const relic = /** @type {HTMLElement | null} */ (root.querySelector('.oracle-relic'));
	const ring = /** @type {HTMLElement | null} */ (root.querySelector('.oracle-ring'));
	const flame = /** @type {HTMLElement | null} */ (root.querySelector('.oracle-flame'));

	root.classList.add('oracle-rite');
	opts.onPhase?.('weigh');

	if (listLength <= 0) {
		root.classList.remove('oracle-rite');
		opts.onDone?.();
		return;
	}

	const weighMs = Math.round(Math.min(420, shuffleMs * 0.18));
	const spokenMs = Math.round(Math.min(720, shuffleMs * 0.28));
	const blessMs = Math.round(Math.min(480, 280 + shuffleMs * 0.06));

	if (ring && !reduced) {
		animate(ring, {
			rotate: '1turn',
			duration: Math.max(2200, shuffleMs + weighMs + spokenMs),
			ease: 'linear',
			loop: true
		});
	}
	if (flame && !reduced) {
		animate(flame, {
			scale: [1, 1.14, 0.92, 1.1, 1],
			duration: 720,
			ease: 'inOutSine',
			loop: true
		});
	}

	const finishBlessing = async () => {
		opts.onPhase?.('drop');
		if (relic && !reduced) {
			await anim(relic, {
				scale: [1, 1.18],
				y: [0, -48],
				opacity: [1, 0],
				duration: blessMs,
				ease: 'inCubic'
			});
		} else if (relic) {
			relic.style.opacity = '0';
			await delay(100);
		}
		if (dead()) return;
		root.classList.remove('oracle-rite');
		opts.onDone?.();
	};

	if (reduced || listLength === 1) {
		opts.onStep?.(targetIndex);
		opts.onPhase?.('spoken');
		await delay(reduced ? 160 : Math.min(500, spokenMs));
		if (dead()) return;
		await finishBlessing();
		return;
	}

	await delay(weighMs);
	if (dead()) return;

	opts.onPhase?.('spin');
	// ~220–320ms per flip → step count from budget (ease-out still feels lot-like).
	const avgFlip = shuffleMs < 2000 ? 200 : shuffleMs < 3400 ? 260 : 300;
	const maxSteps = Math.max(4, Math.min(listLength * 2 + 2, Math.round(shuffleMs / avgFlip)));
	const steps = buildOracleSteps(startIndex, targetIndex, listLength, maxSteps);
	const n = Math.max(1, steps.length);

	for (let i = 0; i < steps.length; i++) {
		if (dead()) return;
		const progress = i / Math.max(1, n - 1);
		// Ease-out: early flips fast, last ones linger.
		const t = 0.55 + progress * 0.9;
		const slice = (shuffleMs / n) * t;
		const outMs = Math.max(40, Math.round(slice * 0.38));
		const inMs = Math.max(50, Math.round(slice * 0.48));
		const gapMs = Math.max(0, Math.round(slice - outMs - inMs));

		if (relic) {
			await anim(relic, {
				scale: [1, 0.86],
				rotate: [`${(i % 2 === 0 ? -1 : 1) * 5}deg`, `${(i % 2 === 0 ? 1 : -1) * 6}deg`],
				opacity: [1, 0.2],
				duration: outMs,
				ease: 'inQuad'
			});
		}
		if (dead()) return;
		opts.onStep?.(steps[i]);
		if (relic) {
			await anim(relic, {
				scale: [0.86, 1],
				rotate: ['0deg', '0deg'],
				opacity: [0.2, 1],
				duration: inMs,
				ease: 'outCubic'
			});
		}
		if (gapMs) await delay(gapMs);
	}

	opts.onStep?.(targetIndex);
	opts.onPhase?.('spoken');

	if (relic && !reduced) {
		await anim(relic, {
			scale: [1, 1.05, 1],
			duration: Math.min(360, spokenMs * 0.45),
			ease: 'outElastic(1, 0.65)'
		});
	}
	await delay(spokenMs);
	if (dead()) return;
	await finishBlessing();
}
