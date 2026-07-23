{#if open}
	<div class="snap-overlay" aria-hidden="true">
		<div class="veil" class:on={phase !== 'idle'}></div>

		<div bind:this={portalEl} class="portal">
			<canvas bind:this={portalCanvasEl} class="portal-live"></canvas>
		</div>

		{#if phase === 'countdown'}
			<div
				class="ritual-ui"
				style:top={countdownTop}
				style:left={countdownLeft}
				style:transform={countdownTransform}
			>
				<p class="countdown" aria-live="assertive">{count}</p>
			</div>
		{/if}

		{#if flashing}
			<div class="flash" aria-hidden="true"></div>
		{/if}
	</div>
{/if}

<script>
	import { tick } from 'svelte';
	import { animate } from 'animejs';
	import { getContainedFullscreenRect } from '../fx/cameraLayout.js';
	import { startLivePreview, stopLivePreview, processCaptureFrame } from '../vision/livePreview.js';

	/** @type {HTMLDivElement | undefined} */
	let portalEl = $state();
	/** @type {HTMLCanvasElement | undefined} */
	let portalCanvasEl = $state();

	let count = $state(3);
	let flashing = $state(false);
	let running = $state(false);
	/** @type {'idle' | 'expand' | 'countdown' | 'flash' | 'settle'} */
	let phase = $state('idle');
	let countdownTop = $state('');
	let countdownLeft = $state('50%');
	let countdownTransform = $state('translateX(-50%)');

	let {
		open = false,
		ritualKey = 0,
		fromRect = null,
		videoEl = undefined,
		reduced = false,
		filterPreset = /** @type {import('../canvas/photoKonva.js').FilterPresetId} */ ('natural'),
		onCaptured = undefined,
		onSettled = undefined
	} = $props();

	/**
	 * @param {DOMRect} rect
	 * @param {HTMLElement} el
	 */
	function placePortal(rect, el) {
		el.style.position = 'fixed';
		el.style.left = `${rect.left}px`;
		el.style.top = `${rect.top}px`;
		el.style.width = `${rect.width}px`;
		el.style.height = `${rect.height}px`;
		el.style.opacity = '1';
		el.style.zIndex = '76';
	}

	/** @param {HTMLElement} el */
	function positionCountdownOnPortal(el) {
		const r = el.getBoundingClientRect();
		const pad = Math.max(20, Math.min(48, r.height * 0.06));
		countdownLeft = `${r.left + r.width / 2}px`;
		/* Anchor above the portal bottom so the digit stays inside the frame/viewport */
		countdownTop = `${r.bottom - pad}px`;
		countdownTransform = 'translate(-50%, -100%)';
	}

	/**
	 * @param {DOMRect} from
	 * @param {DOMRect} to
	 * @param {HTMLElement} el
	 */
	async function tweenPortal(from, to, el) {
		placePortal(from, el);
		if (reduced) {
			placePortal(to, el);
			positionCountdownOnPortal(el);
			return;
		}
		await animate(el, {
			left: `${to.left}px`,
			top: `${to.top}px`,
			width: `${to.width}px`,
			height: `${to.height}px`,
			duration: 460,
			ease: 'inOutCubic',
			onUpdate: () => {
				if (phase === 'countdown') positionCountdownOnPortal(el);
			}
		});
		positionCountdownOnPortal(el);
	}

	async function runRitual() {
		if (!fromRect || !videoEl || running) return;
		const portal = portalEl;
		if (!portal) return;

		running = true;
		phase = 'expand';
		flashing = false;

		const full = getContainedFullscreenRect(fromRect, 14);
		await tweenPortal(fromRect, full, portal);

		phase = 'countdown';
		positionCountdownOnPortal(portal);
		count = 3;
		for (let i = 3; i >= 1; i--) {
			count = i;
			await new Promise((r) => setTimeout(r, 900));
		}

		phase = 'flash';
		flashing = true;
		stopLivePreview();
		const raw = await processCaptureFrame(videoEl, filterPreset);
		if (raw) onCaptured?.(raw);
		await new Promise((r) => setTimeout(r, 320));
		flashing = false;

		phase = 'settle';
		await tweenPortal(full, fromRect, portal);
		portal.style.opacity = '0';

		phase = 'idle';
		running = false;
		onSettled?.();
	}

	$effect(() => {
		const p = phase;
		if (!open || !portalCanvasEl || !videoEl || p === 'flash') {
			stopLivePreview();
			return;
		}

		startLivePreview({
			video: videoEl,
			canvas: portalCanvasEl,
			getPreset: () => filterPreset
		});

		return () => stopLivePreview();
	});

	$effect(() => {
		const key = ritualKey;
		const rect = fromRect;
		if (!open || !key || !rect || !videoEl) return;

		let cancelled = false;
		(async () => {
			await tick();
			if (cancelled || !portalEl) return;
			await runRitual();
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<style>
	.snap-overlay {
		position: fixed;
		inset: 0;
		z-index: 75;
		pointer-events: none;
	}

	.veil {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at center,
			rgba(7, 21, 45, 0.2),
			rgba(7, 21, 45, 0.82)
		);
		opacity: 0;
		transition: opacity 200ms steps(3);
	}

	.veil.on {
		opacity: 1;
	}

	.portal {
		position: fixed;
		overflow: hidden;
		background: #111;
		box-shadow:
			0 0 0 4px var(--gold),
			0 0 0 8px var(--text),
			12px 12px 0 var(--primary);
		opacity: 0;
	}

	.portal-live {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	.ritual-ui {
		position: fixed;
		z-index: 77;
	}

	.countdown {
		margin: 0;
		line-height: 1;
		text-align: center;
		font-size: clamp(2.5rem, 10vw, 5rem);
		color: var(--gold-bright);
		text-shadow: 4px 4px 0 var(--text);
		animation: countdown-pop 0.85s steps(3) both;
	}

	.flash {
		position: fixed;
		inset: 0;
		background: var(--flash);
		z-index: 78;
		animation: flash-white 0.35s ease-out forwards;
		pointer-events: none;
	}

	@keyframes countdown-pop {
		from {
			transform: scale(0.85);
			opacity: 0.6;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes flash-white {
		from {
			opacity: 0.95;
		}
		to {
			opacity: 0;
		}
	}
</style>
