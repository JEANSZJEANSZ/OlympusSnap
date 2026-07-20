<script>
	import { animate } from 'animejs';
	import { frameHandoff, clearFrameHandoff } from '../fx/frameHandoff.js';

	/** @type {HTMLImageElement | undefined} */
	let flyerEl = $state();
	let flashing = $state(false);
	let veilOn = $state(false);

	const TARGET_SEL = '[data-frame-handoff-target]';
	const FIND_MS = 900;
	const SETTLE_MS = 560;
	const REDUCED_MS = 220;

	/**
	 * @param {number} budgetMs
	 * @returns {Promise<DOMRect | null>}
	 */
	function waitForTarget(budgetMs) {
		const start = performance.now();
		return new Promise((resolve) => {
			const tick = () => {
				const el = document.querySelector(TARGET_SEL);
				if (el) {
					const r = el.getBoundingClientRect();
					if (r.width > 2 && r.height > 2) {
						resolve(r);
						return;
					}
				}
				if (performance.now() - start > budgetMs) {
					resolve(null);
					return;
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
	}

	/** @returns {Promise<HTMLImageElement | null>} */
	async function waitForFlyer() {
		for (let i = 0; i < 40; i++) {
			if (flyerEl) return flyerEl;
			await new Promise((r) => requestAnimationFrame(r));
		}
		return null;
	}

	/**
	 * @param {{
	 *   src: string;
	 *   from: { left: number; top: number; width: number; height: number };
	 *   reduced: boolean;
	 * }} payload
	 * @param {() => boolean} isCancelled
	 */
	async function runFlight(payload, isCancelled) {
		veilOn = true;
		flashing = false;

		const flyer = await waitForFlyer();
		const to = await waitForTarget(FIND_MS);
		if (isCancelled()) return;
		if (!flyer) {
			clearFrameHandoff();
			veilOn = false;
			return;
		}

		const from = payload.from;
		flyer.style.left = `${from.left}px`;
		flyer.style.top = `${from.top}px`;
		flyer.style.width = `${from.width}px`;
		flyer.style.height = `${from.height}px`;
		flyer.style.opacity = '1';

		if (!to || payload.reduced) {
			await animate(flyer, {
				opacity: [1, 0],
				duration: REDUCED_MS,
				ease: 'outQuad'
			});
			if (!isCancelled()) {
				clearFrameHandoff();
				veilOn = false;
			}
			return;
		}

		await animate(flyer, {
			left: `${to.left}px`,
			top: `${to.top}px`,
			width: `${to.width}px`,
			height: `${to.height}px`,
			duration: SETTLE_MS,
			ease: 'inOutCubic'
		});
		if (isCancelled()) return;

		flashing = true;
		await animate(flyer, {
			opacity: [1, 0],
			duration: 140,
			ease: 'outQuad',
			delay: 40
		});
		if (isCancelled()) return;

		clearFrameHandoff();
		flashing = false;
		veilOn = false;
	}

	$effect(() => {
		const payload = $frameHandoff;
		if (!payload) return;

		let cancelled = false;
		const safety = window.setTimeout(() => {
			if (!cancelled) clearFrameHandoff();
		}, 2500);

		queueMicrotask(() => {
			if (!cancelled) runFlight(payload, () => cancelled);
		});

		return () => {
			cancelled = true;
			window.clearTimeout(safety);
		};
	});
</script>

{#if $frameHandoff}
	<div class="handoff" class:veil-on={veilOn} aria-hidden="true">
		<div class="veil"></div>
		<img
			bind:this={flyerEl}
			class="flyer"
			src={$frameHandoff.src}
			alt=""
			draggable="false"
		/>
		<div class="flash" class:on={flashing}></div>
	</div>
{/if}

<style>
	.handoff {
		position: fixed;
		inset: 0;
		z-index: 80;
		pointer-events: none;
	}

	.veil {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center, rgba(7, 21, 45, 0.15), rgba(7, 21, 45, 0.72));
		opacity: 0;
		transition: opacity 180ms steps(3);
	}

	.handoff.veil-on .veil {
		opacity: 1;
	}

	.flyer {
		position: fixed;
		z-index: 2;
		display: block;
		object-fit: fill;
		opacity: 0;
		pointer-events: none;
		-webkit-user-drag: none;
		filter: drop-shadow(0 12px 18px rgba(3, 12, 27, 0.55));
		will-change: left, top, width, height, opacity;
	}

	.flash {
		position: absolute;
		inset: 0;
		z-index: 3;
		background: #fff8df;
		opacity: 0;
		pointer-events: none;
	}

	.flash.on {
		animation: handoff-flash 220ms steps(4) forwards;
	}

	@keyframes handoff-flash {
		0% {
			opacity: 0;
		}
		35% {
			opacity: 0.85;
		}
		100% {
			opacity: 0;
		}
	}
</style>
