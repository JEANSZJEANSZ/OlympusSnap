<script>
	/**
	 * Full-bleed Three.js limestone plaque reveal — countdown crack → split → gift handoff.
	 */
	import { onMount } from 'svelte';
	import { createGiftLimestoneReveal } from '../fx/giftLimestoneReveal.js';

	/**
	 * @typedef {Object} Props
	 * @property {string} portraitUrl
	 * @property {number} seed - Unique rock seed for this ritual
	 * @property {boolean} [reduced]
	 * @property {(phase: string) => void} [onPhaseChange]
	 * @property {() => void} [onRevealed]
	 * @property {(api: { setPreCrackProgress: (n: number) => void, triggerCrack: () => void }) => void} [onReady]
	 */

	/** @type {Props} */
	let {
		portraitUrl,
		seed,
		reduced = false,
		onPhaseChange,
		onRevealed,
		onReady
	} = $props();

	/** @type {HTMLCanvasElement | undefined} */
	let canvasEl = $state();
	/** Sharp native-res portrait overlay (WebGL handles plaque + god-rays) */
	let portraitOpacity = $state(0);
	let portraitScale = $state(1);
	let portraitGlow = $state(0);
	let portraitBurst = $state(0);
	let portraitAnchorX = $state(0.5);
	let portraitAnchorY = $state(0.5);

	onMount(() => {
		if (!canvasEl || !portraitUrl) return;
		const api = createGiftLimestoneReveal(canvasEl, {
			portraitUrl,
			seed,
			reduced,
			onPhaseChange,
			onRevealed,
			onPortraitOpacity: (op, meta = {}) => {
				portraitOpacity = op;
				portraitScale = meta.scale ?? 1;
				portraitGlow = meta.glow ?? 0;
				portraitBurst = meta.burst ?? 0;
				if (meta.anchorX != null) portraitAnchorX = meta.anchorX;
				if (meta.anchorY != null) portraitAnchorY = meta.anchorY;
			}
		});
		onReady?.({
			setPreCrackProgress: (n) => api.setPreCrackProgress(n),
			triggerCrack: () => api.triggerCrack()
		});
		return () => api.destroy();
	});
</script>

<div class="marble-stage">
	<canvas
		bind:this={canvasEl}
		class="marble-canvas"
		aria-label="Limestone relic revealing your gift"
	></canvas>
	{#if portraitUrl && portraitOpacity > 0.01}
		<img
			class="sharp-portrait photo-smooth"
			class:bursting={portraitBurst > 0.15}
			src={portraitUrl}
			alt=""
			draggable="false"
			style:opacity={portraitOpacity}
			style:--portrait-scale={portraitScale}
			style:--portrait-glow={portraitGlow}
			style:--portrait-burst={portraitBurst}
			style:--portrait-anchor-x={portraitAnchorX}
			style:--portrait-anchor-y={portraitAnchorY}
			aria-hidden="true"
		/>
	{/if}
</div>

<style>
	/* Full-bleed over gift-view padding — avoids side seam / letterbox bands */
	.marble-stage {
		position: absolute;
		top: calc(-1 * var(--gift-pad-y, 0px));
		right: calc(-1 * var(--gift-pad-x, 0px));
		bottom: calc(-1 * var(--gift-pad-y, 0px));
		left: calc(-1 * var(--gift-pad-x, 0px));
		z-index: 2;
		pointer-events: auto;
	}

	.marble-canvas {
		position: relative;
		z-index: 0;
		display: block;
		width: 100%;
		height: 100%;
		cursor: default;
		touch-action: none;
		background: transparent;
	}

	.sharp-portrait {
		position: absolute;
		left: calc(var(--portrait-anchor-x, 0.5) * 100%);
		top: calc(var(--portrait-anchor-y, 0.5) * 100%);
		width: min(52vw, 52vh * 0.75);
		max-height: min(62vh, 520px);
		transform: translate(-50%, -50%) scale(var(--portrait-scale, 1));
		object-fit: contain;
		pointer-events: none;
		z-index: 1;
		filter:
			brightness(calc(1 + var(--portrait-glow, 0) * 0.45 + var(--portrait-burst, 0) * 0.35))
			drop-shadow(
				0 0 calc(18px + var(--portrait-glow, 0) * 48px + var(--portrait-burst, 0) * 64px)
					rgba(255, 216, 106, calc(0.3 + var(--portrait-glow, 0) * 0.5 + var(--portrait-burst, 0) * 0.4))
			)
			drop-shadow(
				0 0 calc(8px + var(--portrait-burst, 0) * 32px)
					rgba(255, 248, 223, calc(var(--portrait-burst, 0) * 0.85))
			);
		will-change: transform, opacity, filter;
	}

	.sharp-portrait.bursting {
		animation: divine-pulse 0.55s ease-out;
	}

	@keyframes divine-pulse {
		0% {
			filter: brightness(2.2) drop-shadow(0 0 80px rgba(255, 248, 223, 0.95));
		}
		45% {
			filter: brightness(1.35) drop-shadow(0 0 52px rgba(255, 216, 106, 0.75));
		}
		100% {
			filter: brightness(1) drop-shadow(0 0 28px rgba(255, 216, 106, 0.35));
		}
	}
</style>
