{#snippet frameImg()}
	<img
		src={resolveCachedFrameSrc(src)}
		{alt}
		draggable="false"
		onerror={onImgError}
	/>
{/snippet}

{#if !src}
	<div class="asset-thumb"></div>
{:else if ready}
	<div class="asset-thumb">
		{@render frameImg()}
	</div>
{:else}
	{#key retryNonce}
		{#await preloadFrameImage(src)}
			<div class="asset-thumb" aria-busy="true">
				<span class="spinner" aria-hidden="true"></span>
				<span class="sr-only">Loading</span>
			</div>
		{:then img}
			{#if img}
				<div class="asset-thumb">
					{@render frameImg()}
				</div>
			{:else}
				<div class="asset-thumb">
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<span class="fail" onclick={onRetry}>RETRY</span>
				</div>
			{/if}
		{/await}
	{/key}
{/if}

<script>
	import {
		frameImageCacheTick,
		invalidateFrameImage,
		isFrameImageCached,
		preloadFrameImage,
		resolveCachedFrameSrc
	} from '../utils/loadImageForCanvas.js';

	/** @type {{
	 *   src: string;
	 *   alt?: string;
	 * }} */
	let { src, alt = '' } = $props();

	let retryNonce = $state(0);

	const ready = $derived.by(() => {
		$frameImageCacheTick;
		return isFrameImageCached(src);
	});

	function onImgError() {
		if (!src) return;
		invalidateFrameImage(src);
		retryNonce += 1;
		void preloadFrameImage(src);
	}

	/** @param {MouseEvent} e */
	function onRetry(e) {
		e.preventDefault();
		e.stopPropagation();
		if (!src) return;
		invalidateFrameImage(src);
		retryNonce += 1;
		void preloadFrameImage(src);
	}
</script>

<style>
	.asset-thumb {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 1;
	}

	.asset-thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.spinner {
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		border: 2px solid #102f56;
		border-top-color: var(--gold-bright, #e8c36a);
		animation: spin 0.75s linear infinite;
	}

	.fail {
		font-family: var(--font-pixel);
		font-size: 0.42rem;
		letter-spacing: 0.14em;
		color: #1a2438;
		cursor: pointer;
		user-select: none;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
			border-top-color: color-mix(in srgb, var(--gold-bright, #e8c36a) 55%, #102f56);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
