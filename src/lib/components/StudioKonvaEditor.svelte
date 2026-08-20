<div bind:this={containerEl} class="konva-mount"></div>

<script>
	import { untrack } from 'svelte';
	import { createStudioEditor } from '../canvas/studioKonva.js';

	/** @type {HTMLDivElement | undefined} */
	let containerEl = $state();

	/** @type {import('../canvas/studioKonva.js').createStudioEditor extends (...args: any[]) => Promise<infer R> ? R : never} */
	let editor = $state(null);

	let {
		compositeUrl = '',
		stickers = [],
		selectedId = null,
		touchMode = false,
		onStickersChange = undefined,
		onSelect = undefined
	} = $props();

	/** @type {ResizeObserver | undefined} */
	let resizeObserver;

	$effect(() => {
		const url = compositeUrl;
		const el = containerEl;
		if (!url || !el) return;

		let cancelled = false;
		let instance = null;

		(async () => {
			const created = await createStudioEditor({
				container: el,
				compositeDataUrl: url,
				stickers: [],
				selectedId: null,
				touchMode: untrack(() => touchMode),
				onStickersChange: (list) => onStickersChange?.(list),
				onSelect: (id) => onSelect?.(id)
			});
			if (cancelled) {
				created.destroy();
				return;
			}
			instance = created;
			editor = created;

			created.fitToContainer(el.clientWidth, el.clientHeight);

			resizeObserver = new ResizeObserver(() => {
				if (el.clientWidth && el.clientHeight) {
					created.fitToContainer(el.clientWidth, el.clientHeight);
				}
			});
			resizeObserver.observe(el);
		})();

		return () => {
			cancelled = true;
			resizeObserver?.disconnect();
			resizeObserver = undefined;
			instance?.destroy();
			editor = null;
		};
	});

	$effect(() => {
		const inst = editor;
		const list = stickers;
		if (!inst) return;
		inst.syncStickers(list);
	});

	$effect(() => {
		const inst = editor;
		const id = selectedId;
		if (!inst) return;
		inst.setSelectedId(id);
	});

	$effect(() => {
		const inst = editor;
		if (!inst) return;
		inst.setTouchMode(touchMode);
	});

	/**
	 * @param {{ id: string; src: string }} item
	 */
	export async function spawnSticker(item) {
		return editor?.spawnSticker(item);
	}

	export function clearStickers() {
		editor?.clearStickers();
	}

	/**
	 * @param {string} id
	 * @returns {boolean}
	 */
	export function removeSticker(id) {
		return editor?.removeSticker(id) ?? false;
	}

	/** @returns {string | null} */
	export function exportDataUrl() {
		return editor?.exportDataUrl() ?? null;
	}

	/**
	 * @param {number} factor
	 * @returns {boolean}
	 */
	export function nudgeScale(factor) {
		return editor?.nudgeScale(factor) ?? false;
	}

	/**
	 * @param {number} degrees
	 * @returns {boolean}
	 */
	export function nudgeRotate(degrees) {
		return editor?.nudgeRotate(degrees) ?? false;
	}
</script>

<style>
	.konva-mount {
		width: 100%;
		height: 100%;
		touch-action: none;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: transparent;
	}

	.konva-mount :global(.konvajs-content) {
		/* Keep hit-testing aligned; stage is already sized by fitToContainer */
		max-width: 100%;
		max-height: 100%;
	}
</style>
