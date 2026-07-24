<script>
	/**
	 * Full-bleed Three.js marble reveal canvas — god crack → gift handoff.
	 */
	import { onMount } from 'svelte';
	import { createGiftMarbleReveal } from '../fx/giftMarbleReveal.js';

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
		const api = createGiftMarbleReveal(canvasEl, {
			portraitUrl,
			seed,
			reduced,
			onPhaseChange,
			onRevealed
		});
		return () => api.destroy();
	});
</script>

<canvas
	bind:this={canvasEl}
	class="marble-canvas"
	aria-label="Strike the marble to reveal your gift"
></canvas>

<style>
	.marble-canvas {
		position: absolute;
		inset: 0;
		z-index: 2;
		width: 100%;
		height: 100%;
		display: block;
		cursor: pointer;
		touch-action: none;
		background: transparent;
		/* Sit above scenic layers; stage stays pointer-events:none until revealed */
		pointer-events: auto;
	}
</style>
