<div class="sheet-root">
	<button type="button" class="backdrop" aria-label="Close stickers" onclick={onClose}></button>
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-label="Stickers"
		transition:fly={{ y: 48, duration: reduced ? 0 : 280 }}
	>
		<div class="sheet-head">
			<span class="head-spacer" aria-hidden="true"></span>
			<div class="handle" aria-hidden="true"></div>
			<button type="button" class="close" aria-label="Close stickers" onclick={onClose}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						d="M6 6l12 12M18 6 6 18"
					/>
				</svg>
			</button>
		</div>
		<label class="search">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M10 4a6 6 0 014.47 10.03l4.25 4.25-1.41 1.41-4.25-4.25A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z"
				/>
			</svg>
			<input
				bind:value={query}
				type="search"
				placeholder="Search"
				aria-label="Search stickers"
				autocomplete="off"
				enterkeyhint="search"
			/>
		</label>
		<div class="grid">
			{#each filtered as item (item.id)}
				{@const ready = isStickerReady(item.src)}
				<button
					type="button"
					class="tile"
					class:loading={!ready}
					disabled={disabled}
					onclick={() => onSelect?.(item)}
					aria-label={item.name}
				>
					{#if ready}
						<img
							src={resolveCachedFrameSrc(item.src)}
							alt=""
							draggable="false"
							onerror={() => onStickerImgError(item.src)}
						/>
					{:else}
						<span class="tile-spinner" aria-hidden="true"></span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>

<script>
	import { fly } from 'svelte/transition';
	import {
		frameImageCacheTick,
		invalidateFrameImage,
		isFrameImageCached,
		preloadFrameImage,
		resolveCachedFrameSrc
	} from '../utils/loadImageForCanvas.js';

	/** @typedef {{ id: string; name: string; src: string }} StickerItem */

	/** @type {{
	 *   stickers?: StickerItem[];
	 *   disabled?: boolean;
	 *   onSelect?: (item: StickerItem) => void;
	 *   onClose?: () => void;
	 * }} */
	let { stickers = [], disabled = false, onSelect, onClose } = $props();

	let query = $state('');
	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return stickers;
		return stickers.filter((item) => item.name.toLowerCase().includes(q));
	});

	/** @param {string} src */
	function isStickerReady(src) {
		$frameImageCacheTick;
		return isFrameImageCached(src);
	}

	/** @param {string} src */
	function onStickerImgError(src) {
		if (!src) return;
		invalidateFrameImage(src);
		void preloadFrameImage(src);
	}

	$effect(() => {
		const seen = /** @type {string[]} */ ([]);
		for (const item of stickers) {
			if (!item.src || seen.includes(item.src)) continue;
			seen.push(item.src);
			void preloadFrameImage(item.src);
		}
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onClose?.();
	}}
/>

<style>
	.sheet-root {
		position: absolute;
		inset: 0;
		z-index: 8;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		pointer-events: none;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background: rgba(0, 0, 0, 0.38);
		pointer-events: auto;
		cursor: pointer;
	}

	.sheet {
		position: relative;
		z-index: 1;
		pointer-events: auto;
		height: 75%;
		max-height: 75dvh;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding:
			0.55rem 0.9rem
			max(1rem, env(safe-area-inset-bottom));
		background: #111111;
		border-radius: 1.35rem 1.35rem 0 0;
		box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.35);
		color: #fff8df;
	}

	.sheet-head {
		display: grid;
		grid-template-columns: 2.65rem minmax(0, 1fr) 2.65rem;
		align-items: center;
		min-height: 2.65rem;
	}

	.head-spacer {
		width: 2.65rem;
		height: 2.65rem;
	}

	.handle {
		width: 2.4rem;
		height: 0.28rem;
		margin: 0 auto;
		border-radius: 99px;
		background: color-mix(in srgb, #fff 28%, transparent);
	}

	.close {
		display: grid;
		place-items: center;
		width: 2.65rem;
		height: 2.65rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, #fff 10%, transparent);
		color: #fff8df;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.close svg {
		width: 1.15rem;
		height: 1.15rem;
	}

	.close:active {
		transform: scale(0.94);
	}

	.close:focus-visible {
		outline: 2px solid #fff8df;
		outline-offset: 2px;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 2.55rem;
		padding: 0 0.85rem;
		border-radius: 999px;
		background: #2a2a2a;
		color: color-mix(in srgb, #fff 72%, transparent);
	}

	.search svg {
		width: 1.05rem;
		height: 1.05rem;
		flex: 0 0 auto;
	}

	.search input {
		flex: 1 1 auto;
		min-width: 0;
		border: 0;
		background: transparent;
		color: #fff;
		font: inherit;
		font-size: 1rem;
		outline: none;
	}

	.search input::placeholder {
		color: color-mix(in srgb, #fff 45%, transparent);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.85rem 0.55rem;
		overflow-y: auto;
		min-height: 0;
		padding: 0.15rem 0.1rem 0.5rem;
		-webkit-overflow-scrolling: touch;
	}

	.tile {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		padding: 0.2rem;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.tile.loading {
		background: color-mix(in srgb, #fff 6%, transparent);
		border-radius: 0.45rem;
	}

	.tile:disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	.tile img {
		width: 88%;
		height: 88%;
		object-fit: contain;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
	}

	.tile-spinner {
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, #fff 18%, transparent);
		border-top-color: color-mix(in srgb, #fff 72%, transparent);
		animation: spin 0.75s linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.tile-spinner {
			animation: none;
			border-top-color: color-mix(in srgb, #fff 40%, transparent);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
