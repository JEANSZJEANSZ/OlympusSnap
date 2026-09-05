<div class="asset-thumb" aria-busy={loading || undefined}>
	{#if src}
		{#key `${src}:${retryNonce}`}
			<img
				class={['thumb-img', !loaded && 'pending']}
				src={src}
				{alt}
				draggable="false"
				onload={onLoad}
				onerror={onError}
				{@attach checkCached}
			/>
		{/key}
		{#if loading}
			<span class="spinner" aria-hidden="true"></span>
			<span class="sr-only">Loading</span>
		{/if}
		{#if failed}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="fail" onclick={onRetry}>RETRY</span>
		{/if}
	{/if}
</div>

<script>
	/** @type {{
	 *   src: string;
	 *   alt?: string;
	 * }} */
	let { src, alt = '' } = $props();

	let retryNonce = $state(0);
	/** Key of the img generation that last settled (load or error). */
	let settledKey = $state('');
	let settledOk = $state(false);

	const imgKey = $derived(`${src}:${retryNonce}`);
	const loaded = $derived(settledKey === imgKey && settledOk);
	const failed = $derived(settledKey === imgKey && !settledOk);
	const loading = $derived(!!src && !loaded && !failed);

	/** @param {HTMLImageElement} img */
	function checkCached(img) {
		if (!img.complete) return;
		if (img.naturalWidth > 0) {
			settledKey = imgKey;
			settledOk = true;
		} else {
			settledKey = imgKey;
			settledOk = false;
		}
	}

	function onLoad() {
		settledKey = imgKey;
		settledOk = true;
	}

	function onError() {
		settledKey = imgKey;
		settledOk = false;
	}

	/** @param {MouseEvent} e */
	function onRetry(e) {
		e.preventDefault();
		e.stopPropagation();
		retryNonce += 1;
	}
</script>

<style>
	.asset-thumb {
		position: relative;
		width: 100%;
	}

	.thumb-img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
	}

	.thumb-img.pending {
		opacity: 0;
	}

	.spinner {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		border: 2px solid #102f56;
		border-top-color: var(--gold-bright, #e8c36a);
		animation: spin 0.75s linear infinite;
	}

	.fail {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-family: var(--font-pixel);
		font-size: 0.5rem;
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
