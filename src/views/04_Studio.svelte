<section class="studio-view">
	<div class="sky-wash" aria-hidden="true"></div>
	<div class="stars" aria-hidden="true">
		<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
	</div>
	<div class="mountains mountains-far" aria-hidden="true"></div>
	<div class="mountains mountains-near" aria-hidden="true"></div>

	<main class="stage">
		<aside class="dock-column">
			<div class="frame-pedestal">
				<div
					bind:this={shellEl}
					class="editor-shell pixel-panel"
					class:entry-busy={entryBusy}
					class:is-narrow={frameAspect < 0.42}
					style:--frame-ar={frameAspect}
				>
					{#if $capturedImageData}
						<StudioKonvaEditor
							bind:this={editorRef}
							compositeUrl={$capturedImageData}
							stickers={$activeStickers}
							{selectedId}
						onStickersChange={onStickersChange}
						onSelect={onStickerSelect}
						/>
					{/if}
				</div>
			</div>
		</aside>

		<aside class="sticker-rail" aria-label="Sticker tray">
			<header class="head">
				<p class="eyebrow">DECORATE THINE LIKENESS</p>
				<h1>STICKER STUDIO</h1>
				<p class="sub">{frameName}</p>
			</header>

			<p class="rail-title">STICKERS</p>
			<p class="rail-hint">Tap to place · drag · scale corners · spin top handle</p>

			<div class="gallery">
				{#each $stickers as item (item.id)}
					<button type="button" class="tile" onclick={() => addSticker(item)}>
						<span class="swatch">
							<img src={item.src} alt="" draggable="false" />
						</span>
						<span class="label">{item.name}</span>
					</button>
				{/each}
			</div>
		</aside>
	</main>

	<div class="footer">
		<DialogBox
			speaker="DIONYSUS"
			text="Decorate thine likeness! Tap a sticker, then drag, stretch corners, or spin the gold handle."
			typewriter={false}
		/>
		<div class="actions">
			<PixelButton label="CLEAR" variant="ghost" onclick={clearStickers} />
			<PixelButton label="RETAKE" variant="ghost" onclick={retake} />
			<PixelButton label="HANG THE GIFT" variant="gold" onclick={goReveal} />
		</div>
	</div>
</section>

<script>
	import { onMount, tick } from 'svelte';
	import {
		activeStickers,
		capturedImageData,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { getLiveFrameById } from '../lib/assets/assetStore.js';
	import { stickers } from '../lib/assets/assetStore.js';
	import { go } from '../router/index.js';
	import { playStudioEntry } from '../lib/fx/studioEntryMotion.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import StudioKonvaEditor from '../lib/components/StudioKonvaEditor.svelte';

	/** @type {StudioKonvaEditor | undefined} */
	let editorRef = $state();
	/** @type {HTMLDivElement | undefined} */
	let shellEl = $state();

	let selectedId = $state(/** @type {string | null} */ (null));
	let entryBusy = $state(true);
	let reduced = $state(false);
	/** @type {Record<string, { w: number; h: number }>} */
	let measuredDims = $state({});

	const frame = $derived(getLiveFrameById($selectedFrameId));
	const frameName = $derived(frame?.name ?? 'Your relic');

	const frameAspect = $derived.by(() => {
		const f = frame;
		if (f?.w && f?.h && f.h > 0) return f.w / f.h;
		const m = f?.id ? measuredDims[f.id] : null;
		if (m?.w && m?.h) return m.w / m.h;
		return 3 / 4;
	});

	onMount(() => {
		if (!$capturedImageData) {
			go('camera');
			return;
		}

		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const url = $capturedImageData;
		const img = new Image();
		img.onload = () => {
			if (img.naturalWidth && img.naturalHeight && $selectedFrameId) {
				measuredDims = {
					...measuredDims,
					[$selectedFrameId]: { w: img.naturalWidth, h: img.naturalHeight }
				};
			}
		};
		img.src = url;

		(async () => {
			await tick();
			entryBusy = true;
			try {
				await playStudioEntry(shellEl, { reduced });
			} finally {
				entryBusy = false;
			}
		})();
	});

	/** @param {import('../lib/stores/stores.js').ActiveSticker[]} list */
	function onStickersChange(list) {
		activeStickers.set(list);
	}

	/** @param {string | null} id */
	function onStickerSelect(id) {
		selectedId = id;
	}

	/** @param {{ id: string; name: string; src: string }} item */
	async function addSticker(item) {
		const id = `${item.id}-${Date.now()}`;
		await editorRef?.spawnSticker({ id, src: item.src });
	}

	function clearStickers() {
		editorRef?.clearStickers();
		selectedId = null;
	}

	function retake() {
		go('camera');
	}

	function goReveal() {
		selectedId = null;
		go('reveal');
	}
</script>

<style>
	.studio-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		/* Rest tilt on editor-shell breaks Konva hit-testing; keep pedestal shadow only. */
		--studio-tilt: 0deg;
		--pedestal-tilt: -3.5deg;
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
		overflow: hidden;
		padding: clamp(0.65rem, 1.5vh, 1rem) clamp(0.75rem, 2vw, 1.25rem);
		color: #fff8df;
		background: var(--sky-top);
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 0.75rem;
	}

	.sky-wash {
		position: absolute;
		inset: 0;
		z-index: -4;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 18%),
			linear-gradient(180deg, var(--sky-top) 0%, var(--sky-mid) 58%, var(--sky-low) 130%);
	}

	.stars {
		position: absolute;
		inset: 0;
		z-index: -3;
		pointer-events: none;
	}

	.stars i {
		position: absolute;
		width: 3px;
		height: 3px;
		background: #fff4bd;
		box-shadow: 3px 0 #fff4bd, 0 3px #fff4bd, 3px 3px #fff4bd;
	}

	.stars i:nth-child(1) { left: 8%; top: 15%; }
	.stars i:nth-child(2) { left: 21%; top: 34%; transform: scale(0.65); }
	.stars i:nth-child(3) { left: 36%; top: 12%; transform: scale(0.7); }
	.stars i:nth-child(4) { right: 36%; top: 23%; }
	.stars i:nth-child(5) { right: 21%; top: 11%; transform: scale(0.6); }
	.stars i:nth-child(6) { right: 8%; top: 29%; transform: scale(0.8); }
	.stars i:nth-child(7) { right: 14%; top: 51%; transform: scale(0.55); }

	.mountains {
		position: absolute;
		right: -5%;
		bottom: -1px;
		left: -5%;
		z-index: -2;
		height: 46%;
		clip-path: polygon(0 72%, 8% 48%, 15% 62%, 25% 25%, 36% 58%, 47% 35%, 58% 67%, 70% 30%, 80% 56%, 91% 22%, 100% 61%, 100% 100%, 0 100%);
		background: #102f56;
	}

	.mountains-far {
		opacity: 0.55;
		transform: scale(1.08);
		filter: brightness(0.85);
	}

	.mountains-near {
		height: 38%;
		background: #31577a;
		clip-path: polygon(0 100%, 0 68%, 12% 52%, 22% 72%, 34% 40%, 48% 64%, 60% 34%, 72% 58%, 84% 28%, 100% 55%, 100% 100%);
	}

	.stage {
		position: relative;
		z-index: 1;
		min-height: 0;
		height: 100%;
		display: grid;
		/* Dock gets the majority — decorating needs a big canvas. */
		grid-template-columns: minmax(0, 1.55fr) minmax(220px, 0.85fr);
		gap: clamp(0.65rem, 1.5vw, 1.25rem);
		align-items: stretch;
		overflow: hidden;
	}

	.dock-column {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		height: 100%;
		position: relative;
		overflow: hidden;
		padding: clamp(0.25rem, 1vh, 0.75rem) clamp(0.25rem, 1vw, 0.65rem);
		/* Size the frame to this column (above footer), not the full viewport. */
		container-type: size;
		container-name: studio-dock;
	}

	.frame-pedestal {
		position: relative;
		perspective: 1100px;
		perspective-origin: 50% 40%;
		overflow: visible;
		max-width: 100%;
		max-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.frame-pedestal::after {
		content: '';
		position: absolute;
		left: 8%;
		right: 8%;
		bottom: -10px;
		height: 18px;
		background: radial-gradient(
			ellipse at center,
			rgba(3, 12, 27, 0.45),
			transparent 72%
		);
		transform: rotateZ(var(--pedestal-tilt));
		pointer-events: none;
		z-index: -1;
	}

	.editor-shell {
		--entry-y: 0px;
		--entry-z: 0px;
		--entry-rx: 0deg;
		/* Axis-aligned at rest so Konva Transformer anchors receive pointer hits. */
		--entry-rz: 0deg;
		--entry-scale: 1;
		position: relative;
		/*
		 * Fit inside the dock (stage row above footer), larger than Camera's 34vw/640 cap
		 * but never taller than available column height — avoids footer overlap.
		 */
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 480px);
		max-height: 100cqh;
		height: auto;
		aspect-ratio: var(--frame-ar);
		overflow: hidden;
		background: #0a1220;
		padding: 0;
		transform-style: preserve-3d;
		transform-origin: 50% 80%;
		transform: translateY(var(--entry-y)) translateZ(var(--entry-z)) rotateX(var(--entry-rx))
			rotateZ(var(--entry-rz)) scale(var(--entry-scale));
		filter: drop-shadow(0 16px 28px rgba(3, 12, 27, 0.5))
			drop-shadow(6px 8px 0 color-mix(in srgb, var(--primary) 35%, transparent));
		will-change: transform, opacity;
	}

	/* Tall strips: still fill dock height, allow a bit more width within the column. */
	.editor-shell.is-narrow {
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 300px);
	}

	.editor-shell.entry-busy {
		pointer-events: none;
	}

	.sticker-rail {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
		height: 100%;
		max-height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.head {
		text-align: left;
		width: 100%;
		margin-bottom: 0.25rem;
	}

	.head .eyebrow {
		font-size: 0.42rem;
		color: var(--gold-bright);
		letter-spacing: 0.08em;
		margin-bottom: 0.35rem;
	}

	.head h1 {
		font-size: clamp(0.85rem, 2.5vw, 1.1rem);
		color: #fff8df;
		text-shadow: 2px 2px 0 color-mix(in srgb, var(--gold) 40%, transparent);
	}

	.sub {
		margin-top: 0.35rem;
		font-size: 0.45rem;
		color: color-mix(in srgb, #fff8df 72%, transparent);
		line-height: 1.6;
	}

	.rail-title {
		font-size: 0.42rem;
		color: #fff8df;
		letter-spacing: 0.08em;
	}

	.rail-hint {
		font-size: 0.34rem;
		color: color-mix(in srgb, #fff8df 65%, transparent);
		line-height: 1.5;
	}

	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		grid-auto-rows: max-content;
		align-content: start;
		gap: 0.5rem;
		overflow-y: auto;
		min-height: 0;
		flex: 1;
		padding-right: 0.15rem;
		scrollbar-width: thin;
	}

	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		align-self: start;
		height: auto;
		gap: 0.35rem;
		padding: 0.45rem 0.35rem;
		background: #102f56;
		border: 2px solid color-mix(in srgb, var(--gold) 45%, transparent);
		box-shadow: 2px 2px 0 #071936;
		color: #fff8df;
		font-size: 0.34rem;
		text-align: center;
	}

	.tile:active {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 #071936;
	}

	.swatch {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, #fff 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--gold-bright) 35%, transparent);
	}

	.swatch img {
		width: 1.75rem;
		height: 1.75rem;
		object-fit: contain;
	}

	.label {
		letter-spacing: 0.02em;
		line-height: 1.35;
	}

	.footer {
		position: relative;
		z-index: 1;
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

	@media (max-width: 980px) {
		.stage {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			align-items: start;
		}

		.dock-column {
			justify-content: center;
		}

		.dock-column {
			/* Stacked layout: give the frame a bounded band above the sticker rail. */
			min-height: min(52dvh, 420px);
			max-height: min(52dvh, 420px);
		}

		.editor-shell {
			width: min(100cqw, calc(100cqh * var(--frame-ar)), 360px);
		}

		.editor-shell.is-narrow {
			width: min(100cqw, calc(100cqh * var(--frame-ar)), 260px);
		}

		.sticker-rail {
			height: auto;
			max-height: none;
			overflow: visible;
		}

		.gallery {
			grid-template-columns: repeat(auto-fill, minmax(4.75rem, 1fr));
			max-height: none;
			overflow-x: auto;
			overflow-y: hidden;
			grid-auto-flow: column;
			grid-auto-columns: minmax(4.75rem, 1fr);
			padding-bottom: 0.25rem;
		}
	}
</style>
