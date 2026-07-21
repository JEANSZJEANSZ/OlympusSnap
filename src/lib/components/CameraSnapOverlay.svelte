{#if open}
	<div class="snap-overlay" aria-hidden="true">
		<div class="veil" class:on={phase !== 'idle'}></div>

		<div bind:this={portalEl} class="portal">
			<canvas bind:this={portalCanvasEl} class="portal-canvas"></canvas>
		</div>

		{#if phase === 'countdown'}
			<div class="ritual-ui">
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

	/**
	 * @param {DOMRect} from
	 * @param {DOMRect} to
	 * @param {HTMLElement} el
	 */
	async function tweenPortal(from, to, el) {
		placePortal(from, el);
		if (reduced) {
			placePortal(to, el);
			return;
		}
		await animate(el, {
			left: `${to.left}px`,
			top: `${to.top}px`,
			width: `${to.width}px`,
			height: `${to.height}px`,
			duration: 460,
			ease: 'inOutCubic'
		});
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
		box-shadow:
			0 0 0 4px var(--gold),
			0 0 0 8px var(--text),
			12px 12px 0 var(--primary);
		opacity: 0;
		background: #0a1220;
	}

	.portal-canvas {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.ritual-ui {
		position: fixed;
		left: 50%;
		bottom: clamp(1rem, 4vh, 2.5rem);
		transform: translateX(-50%);
		z-index: 77;
	}

	.countdown {
		text-align: center;
		font-size: clamp(4rem, 18vw, 8rem);
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
</style>
