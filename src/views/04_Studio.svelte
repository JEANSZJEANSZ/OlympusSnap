<section class="view">
	<header class="head">
		<h1>STICKER STUDIO</h1>
		<p>Drag · scale corners · rotate top handle</p>
	</header>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="canvas-wrap pixel-panel"
		onpointerdown={onCanvasPointerDown}
	>
		{#if $capturedImageData}
			<img class="capture" src={$capturedImageData} alt="" />
		{:else}
			<div class="mock-capture" aria-label="Placeholder capture">
				<span>FROZEN FRAME</span>
				<span class="sub">Webcam capture lands here</span>
			</div>
		{/if}

		{#each $activeStickers as sticker (sticker.id)}
			<DraggableSticker
				src={sticker.src}
				x={sticker.x}
				y={sticker.y}
				scale={sticker.scale}
				rotation={sticker.rotation}
				selected={selectedId === sticker.id}
				onSelect={() => (selectedId = sticker.id)}
				onTransform={(t) => transformSticker(sticker.id, t)}
			/>
		{/each}
	</div>

	<div class="tray" aria-label="Sticker tray">
		{#each $stickers as item (item.id)}
			<button type="button" class="tray-item" onclick={() => addSticker(item)}>
				<img class="icon" src={item.src} alt="" />
				<span class="name">{item.name}</span>
			</button>
		{/each}
	</div>

	<div class="footer">
		<DialogBox
			speaker="DIONYSUS"
			text="Decorate thine likeness! Tap a sticker, then drag, stretch corners, or spin the gold handle."
			typewriter={false}
		/>
		<div class="actions">
			<PixelButton label="CLEAR" variant="ghost" onclick={clearStickers} />
			<PixelButton label="RETAKE" variant="ghost" onclick={() => go('camera')} />
			<PixelButton label="HANG THE GIFT" variant="gold" onclick={goReveal} />
		</div>
	</div>
</section>

<script>
	import {
		capturedImageData,
		activeStickers
	} from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import { stickers } from '../lib/assets/assetStore.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import DraggableSticker from '../lib/components/DraggableSticker.svelte';

	let selectedId = $state(/** @type {string | null} */ (null));

	/** @param {{ id: string; name: string; src: string }} item */
	function addSticker(item) {
		const id = `${item.id}-${Date.now()}`;
		activeStickers.update((list) => [
			...list,
			{
				id,
				src: item.src,
				x: 48 + Math.random() * 100,
				y: 40 + Math.random() * 70,
				scale: 1,
				rotation: 0
			}
		]);
		selectedId = id;
	}

	/**
	 * @param {string} id
	 * @param {{ x: number; y: number; scale: number; rotation: number }} t
	 */
	function transformSticker(id, t) {
		activeStickers.update((list) =>
			list.map((s) =>
				s.id === id
					? { ...s, x: t.x, y: t.y, scale: t.scale, rotation: t.rotation }
					: s
			)
		);
	}

	function clearStickers() {
		activeStickers.set([]);
		selectedId = null;
	}

	function goReveal() {
		selectedId = null;
		go('reveal');
	}

	/** @param {PointerEvent} e */
	function onCanvasPointerDown(e) {
		if (e.target === e.currentTarget) selectedId = null;
	}
</script>

<style>
	.view {
		height: 100%;
		display: grid;
		grid-template-rows: auto 1fr auto auto;
		gap: 0.75rem;
		padding: 1rem;
		min-height: 0;
	}

	.head {
		text-align: center;
	}

	.head h1 {
		font-size: clamp(0.8rem, 2.8vw, 1.05rem);
		color: var(--primary);
	}

	.head p {
		margin-top: 0.3rem;
		font-size: 0.48rem;
		color: var(--ink-soft);
	}

	.canvas-wrap {
		position: relative;
		width: min(100%, 560px);
		margin: 0 auto;
		aspect-ratio: 4 / 3;
		max-height: min(42dvh, 360px);
		overflow: visible;
		background: var(--text);
		padding: 0;
	}

	.capture,
	.mock-capture {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		pointer-events: none;
	}

	.mock-capture {
		display: grid;
		place-content: center;
		gap: 0.5rem;
		text-align: center;
		background:
			linear-gradient(135deg, var(--primary), #1e3a5f),
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 7px,
				color-mix(in srgb, #000 15%, transparent) 7px,
				color-mix(in srgb, #000 15%, transparent) 8px
			);
		color: var(--bg-base);
		font-size: 0.7rem;
	}

	.sub {
		font-size: 0.45rem;
		opacity: 0.75;
	}

	.tray {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.5rem 0.25rem;
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
		scrollbar-width: thin;
	}

	.tray-item {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		width: 4.5rem;
		padding: 0.55rem 0.35rem;
		background: var(--surface);
		box-shadow: var(--shadow-btn);
		font-size: 0.4rem;
		color: var(--text);
	}

	.tray-item:active {
		transform: translate(2px, 2px);
		box-shadow: var(--shadow-btn-press);
	}

	.icon {
		width: 1.75rem;
		height: 1.75rem;
		object-fit: contain;
	}

	.name {
		letter-spacing: 0.02em;
	}

	.footer {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: center;
	}
</style>
