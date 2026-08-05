<!-- Shared above-the-clouds Olympus stage for booth views (not Studio). -->
<div class="mount" aria-hidden="true" {@attach attach}></div>

<script>
	import { createBoothOlympusBackdrop } from '../fx/boothOlympusBackdrop.js';

	/** @type {import('svelte').Attachment<HTMLElement>} */
	const attach = (element) => {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const world = createBoothOlympusBackdrop(element, { reduced });
		const host = element.parentElement;

		/** @param {PointerEvent} e */
		const onMove = (e) => {
			if (!host) return;
			const r = host.getBoundingClientRect();
			if (r.width < 1 || r.height < 1) return;
			world.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
		};

		host?.addEventListener('pointermove', onMove, { passive: true });

		return () => {
			host?.removeEventListener('pointermove', onMove);
			world.dispose();
		};
	};
</script>

<style>
	.mount {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
</style>
