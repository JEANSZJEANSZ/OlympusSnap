<!--
  DOM cursor so the hand stays partially visible at screen edges.
  Native CSS cursors are fully hidden when they would clip off-viewport.
-->
{#if visible}
	<div
		class="booth-cursor"
		style:transform="translate3d({x - HOT_X}px, {y - HOT_Y}px, 0)"
		aria-hidden="true"
	>
		<img src={cursorUrl} alt="" draggable="false" width={SIZE} height={SIZE} />
	</div>
{/if}

<script>
	import { onMount } from 'svelte';
	import cursorUrl from '../../assets/Pixelate_cursor.png';

	/** Fingertip hotspot in the 128×128 asset */
	const HOT_X = 32;
	const HOT_Y = 4;
	const SIZE = 128;

	let x = $state(0);
	let y = $state(0);
	let visible = $state(false);
	let enabled = $state(false);

	onMount(() => {
		const fine = window.matchMedia('(pointer: fine)');
		const syncEnabled = () => {
			enabled = fine.matches;
			if (!enabled) visible = false;
			document.documentElement.classList.toggle('booth-cursor-on', enabled);
		};
		syncEnabled();
		fine.addEventListener('change', syncEnabled);

		/** @param {PointerEvent} e */
		const onMove = (e) => {
			if (!enabled || e.pointerType === 'touch') {
				visible = false;
				return;
			}
			x = e.clientX;
			y = e.clientY;
			visible = true;
		};

		const onLeave = () => {
			visible = false;
		};

		window.addEventListener('pointermove', onMove, { passive: true });
		window.addEventListener('blur', onLeave);
		document.addEventListener('mouseleave', onLeave);

		return () => {
			fine.removeEventListener('change', syncEnabled);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('blur', onLeave);
			document.removeEventListener('mouseleave', onLeave);
			document.documentElement.classList.remove('booth-cursor-on');
		};
	});
</script>

<style>
	.booth-cursor {
		position: fixed;
		left: 0;
		top: 0;
		width: 128px;
		height: 128px;
		pointer-events: none;
		z-index: 2147483646;
		image-rendering: pixelated;
		image-rendering: crisp-edges;
		will-change: transform;
	}

	.booth-cursor img {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
		user-select: none;
	}
</style>
