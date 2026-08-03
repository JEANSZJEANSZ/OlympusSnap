<script>
	/**
	 * Full-bleed Three.js limestone plaque reveal — strike → split → gift handoff.
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
	 */

	/** @type {Props} */
	let {
		portraitUrl,
		seed,
		reduced = false,
		onPhaseChange,
		onRevealed
	} = $props();

	/** @type {HTMLCanvasElement | undefined} */
	let canvasEl = $state();

	onMount(() => {
		if (!canvasEl || !portraitUrl) return;
		const api = createGiftLimestoneReveal(canvasEl, {
			portraitUrl,
			seed,
			reduced,
			onPhaseChange,
			onRevealed
		});
		return () => api.destroy();
	});
</script>

<div class="marble-stage">
	<canvas
		bind:this={canvasEl}
		class="marble-canvas"
		aria-label="Strike the limestone relic to reveal your gift"
	></canvas>
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
		display: block;
		width: 100%;
		height: 100%;
		cursor: pointer;
		touch-action: none;
		/* Transparent — gift-view sky / mountains / stars show through */
		background: transparent;
	}
</style>
