<div class="shell marble-floor">
	<header class="chrome">
		<button
			type="button"
			class="brand"
			aria-label="Long-press for Admin"
			onpointerdown={onBrandPointerDown}
			onpointerup={clearPress}
			onpointerleave={clearPress}
			onpointercancel={clearPress}
		>
			OLYMPUS_SNAP
		</button>
		<span class="cart" aria-hidden="true">CART ◆ 01</span>
	</header>

	<main class="stage">
		{#key $currentRoute.path}
			{@const View = $currentRoute.component}
			<View />
		{/key}
	</main>
</div>

<script>
	import { onMount } from 'svelte';
	import { currentRoute, go } from './router/index.js';
	import { initAssets } from './lib/assets/assetStore.js';

	/** @type {ReturnType<typeof setTimeout> | null} */
	let pressTimer = null;

	onMount(() => {
		initAssets();
	});

	function onBrandPointerDown() {
		pressTimer = setTimeout(() => {
			pressTimer = null;
			go('admin');
		}, 900);
	}

	function clearPress() {
		if (pressTimer !== null) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}
</script>

<style>
	.shell {
		height: 100%;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.chrome {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--primary);
		color: var(--bg-base);
		font-size: clamp(0.55rem, 1.4vw, 0.7rem);
		letter-spacing: 0.08em;
		box-shadow: 0 4px 0 var(--text);
		z-index: 10;
	}

	.brand {
		color: var(--gold-bright);
		font-family: inherit;
		font-size: inherit;
		letter-spacing: inherit;
		padding: 0.25rem 0;
		background: none;
		border: none;
		cursor: pointer;
		-webkit-touch-callout: none;
		user-select: none;
	}

	.cart {
		opacity: 0.85;
	}

	.stage {
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: auto;
	}
</style>
