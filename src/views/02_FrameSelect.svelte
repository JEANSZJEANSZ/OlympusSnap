<section class="view">
	<header class="head">
		<h1>CHOOSE THY FRAME</h1>
		<p>Marble relics, pixel-perfect</p>
	</header>

	<div class="carousel">
		<button class="nav" type="button" onclick={prev} aria-label="Previous frame">◀</button>

		<div class="frame-stage pixel-panel" data-motif={frame?.id ?? 'none'}>
			<div class="frame-art">
				<div class="inner-photo">
					<span class="silhouette">👤</span>
				</div>
				{#if frame && !imgFailed}
					<img
						class="frame-overlay"
						src={frame.src}
						alt=""
						onerror={() => (imgFailed = true)}
					/>
				{/if}
				{#if frame?.motif}
					<div class="ornament top">{frame.motif}</div>
				{/if}
				{#if frame}
					<div class="ornament bottom">{frame.name}</div>
				{/if}
			</div>
			<p class="meta">{list.length ? index + 1 : 0} / {list.length}</p>
		</div>

		<button class="nav" type="button" onclick={next} aria-label="Next frame">▶</button>
	</div>

	<div class="dots" role="tablist" aria-label="Frames">
		{#each list as f, i (f.id)}
			<button
				type="button"
				class="dot"
				class:active={i === index}
				aria-label={f.name}
				onclick={() => (index = i)}
			></button>
		{/each}
	</div>

	<div class="footer">
		<DialogBox
			speaker="HEPHAESTUS"
			text={frame
				? `Forge selected: ${frame.name}. Confirm to arm the camera.`
				: 'No frames loaded. Open Admin to upload one.'}
			typewriter={false}
		/>
		<div class="actions">
			<PixelButton label="BACK" variant="ghost" onclick={() => go('landing')} />
			<PixelButton
				label="ARM CAMERA"
				variant="primary"
				disabled={!frame}
				onclick={confirmFrame}
			/>
		</div>
	</div>
</section>

<script>
	import { selectedFrameId } from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import { frames } from '../lib/assets/assetStore.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';

	let index = $state(0);
	let imgFailed = $state(false);
	const list = $derived($frames);
	const frame = $derived(list[Math.min(index, Math.max(0, list.length - 1))]);

	$effect(() => {
		frame;
		imgFailed = false;
	});

	$effect(() => {
		if (index >= list.length && list.length > 0) index = list.length - 1;
	});

	function prev() {
		if (!list.length) return;
		index = (index - 1 + list.length) % list.length;
	}

	function next() {
		if (!list.length) return;
		index = (index + 1) % list.length;
	}

	function confirmFrame() {
		if (!frame) return;
		selectedFrameId.set(frame.id);
		go('camera');
	}
</script>

<style>
	.view {
		height: 100%;
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		gap: 1rem;
		padding: 1.25rem;
		align-items: center;
	}

	.head {
		text-align: center;
	}

	.head h1 {
		font-size: clamp(0.85rem, 3vw, 1.15rem);
		color: var(--primary);
		text-wrap: balance;
	}

	.head p {
		margin-top: 0.4rem;
		font-size: 0.5rem;
		color: var(--ink-soft);
	}

	.carousel {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.75rem;
		align-items: center;
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
		min-height: 0;
	}

	.nav {
		width: 3rem;
		height: 3rem;
		background: var(--surface);
		box-shadow: var(--shadow-btn);
		font-size: 1rem;
		color: var(--primary);
	}

	.nav:active {
		transform: translate(2px, 2px);
		box-shadow: var(--shadow-btn-press);
	}

	.frame-stage {
		aspect-ratio: 3 / 4;
		max-height: min(52dvh, 480px);
		margin: 0 auto;
		width: 100%;
		max-width: 320px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: var(--marble);
	}

	.frame-art {
		flex: 1;
		position: relative;
		background: var(--bg-base);
		display: grid;
		place-items: center;
		overflow: hidden;
		box-shadow: inset 0 0 0 3px var(--text);
	}

	.inner-photo {
		width: 70%;
		aspect-ratio: 1;
		background: repeating-conic-gradient(var(--surface) 0% 25%, var(--marble) 0% 50%) 50% /
			16px 16px;
		display: grid;
		place-items: center;
		box-shadow: inset 0 0 0 3px var(--text);
		z-index: 0;
	}

	.silhouette {
		font-size: 2.5rem;
		filter: grayscale(1);
		opacity: 0.55;
	}

	.frame-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		pointer-events: none;
		z-index: 1;
	}

	.ornament {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.45rem;
		padding: 0.25rem 0.4rem;
		background: var(--text);
		color: var(--gold-bright);
		white-space: nowrap;
		z-index: 2;
	}

	.ornament.top {
		top: 0.5rem;
	}

	.ornament.bottom {
		bottom: 0.5rem;
	}

	.meta {
		text-align: center;
		font-size: 0.5rem;
		color: var(--ink-soft);
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}

	.dot {
		width: 12px;
		height: 12px;
		background: var(--marble-vein);
		box-shadow: 1px 1px 0 var(--text);
	}

	.dot.active {
		background: var(--accent);
	}

	.footer {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 640px;
		width: 100%;
		margin: 0 auto;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}
</style>
