<section
	class="studio-view booth-view"
	class:handoff-pending={$imageHandoffBusy}
	class:timer-warn={secsLeft <= 30 && secsLeft > 0 && timerArmed}
	class:timer-up={timeUp}
	class:exiting
>
	<div class="sky-wash" aria-hidden="true"></div>
	<div class="stars" aria-hidden="true">
		<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
	</div>
	<div class="mountains mountains-far" aria-hidden="true"></div>
	<div class="mountains mountains-near" aria-hidden="true"></div>

	{#if timeUp}
		<div class="time-up-flash" aria-live="assertive">TIME'S UP</div>
	{/if}

	<main class="stage">
		<aside class="dock-column">
			<div class="frame-pedestal">
				<div
					bind:this={shellEl}
					class="editor-shell pixel-panel"
					class:entry-busy={entryBusy || timeUp || $imageHandoffBusy}
					class:is-narrow={frameAspect < 0.42}
					style:--frame-ar={frameAspect}
					data-studio-handoff-target
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
			<div class="timer-row" aria-live="polite">
				<span class="timer-label">EDIT WINDOW</span>
				<span class="timer-chip" class:warn={secsLeft <= 30 && timerArmed}>{timerLabel}</span>
			</div>

			<div class="gallery">
				{#each $stickers as item (item.id)}
					<button
						type="button"
						class="tile"
						disabled={entryBusy || timeUp || exiting}
						onclick={() => addSticker(item)}
					>
						<span class="swatch">
							<img src={item.src} alt="" draggable="false" />
						</span>
						<span class="label">{item.name}</span>
					</button>
				{/each}
			</div>

			<DialogBox speaker="DIONYSUS" text={dialogText} typewriter={false} />

			<div class="actions">
				<PixelButton
					label="REMOVE"
					variant="ghost"
					disabled={!selectedId || entryBusy || timeUp || exiting}
					onclick={removeSelected}
				/>
				<PixelButton
					label="CLEAR"
					variant="ghost"
					disabled={entryBusy || timeUp || exiting}
					onclick={clearStickers}
				/>
				<PixelButton
					label="CRACK THE MARBLE"
					variant="gold"
					disabled={entryBusy || timeUp || exiting}
					onclick={goReveal}
				/>
			</div>
		</aside>
	</main>
</section>

<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import {
		activeStickers,
		capturedImageData,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { getLiveFrameById } from '../lib/assets/assetStore.js';
	import { stickers } from '../lib/assets/assetStore.js';
	import { go } from '../router/index.js';
	import { playStudioEntry, playStudioSettle } from '../lib/fx/studioEntryMotion.js';
	import { imageHandoffBusy } from '../lib/fx/imageHandoff.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import StudioKonvaEditor from '../lib/components/StudioKonvaEditor.svelte';

	const STUDIO_EDIT_SECS = 180;
	const WARN_SECS = 30;

	/** @type {StudioKonvaEditor | undefined} */
	let editorRef = $state();
	/** @type {HTMLDivElement | undefined} */
	let shellEl = $state();

	let selectedId = $state(/** @type {string | null} */ (null));
	let entryBusy = $state(true);
	let reduced = $state(false);
	let exiting = $state(false);
	let timerArmed = $state(false);
	let secsLeft = $state(STUDIO_EDIT_SECS);
	let timeUp = $state(false);
	/** @type {ReturnType<typeof setInterval> | null} */
	let tickTimer = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let timeUpNav = null;
	/** @type {Record<string, { w: number; h: number }>} */
	let measuredDims = $state({});

	const frame = $derived(getLiveFrameById($selectedFrameId));

	const frameAspect = $derived.by(() => {
		const f = frame;
		if (f?.w && f?.h && f.h > 0) return f.w / f.h;
		const m = f?.id ? measuredDims[f.id] : null;
		if (m?.w && m?.h) return m.w / m.h;
		return 3 / 4;
	});

	const timerLabel = $derived.by(() => {
		const s = Math.max(0, secsLeft);
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
	});

	const dialogText = $derived(
		timeUp
			? 'The marble calls — seals are set!'
			: secsLeft <= WARN_SECS && timerArmed
				? 'Hurry, mortal — marble awaits!'
				: 'Tap a sticker, then drag, stretch corners, or spin the gold handle. REMOVE banishes one.'
	);

	function clearTimers() {
		if (tickTimer != null) {
			clearInterval(tickTimer);
			tickTimer = null;
		}
		if (timeUpNav != null) {
			clearTimeout(timeUpNav);
			timeUpNav = null;
		}
	}

	function startEditTimer() {
		clearTimers();
		timerArmed = true;
		secsLeft = STUDIO_EDIT_SECS;
		timeUp = false;
		tickTimer = setInterval(() => {
			secsLeft = Math.max(0, secsLeft - 1);
			if (secsLeft <= 0) {
				clearTimers();
				onTimerExpired();
			}
		}, 1000);
	}

	function onTimerExpired() {
		if (exiting || timeUp) return;
		timeUp = true;
		selectedId = null;
		const delay = reduced ? 400 : 1000;
		timeUpNav = setTimeout(() => {
			goReveal();
		}, delay);
	}

	/**
	 * Wait until image handoff finishes (or skip if none).
	 * @returns {Promise<boolean>} true if a handoff was active
	 */
	function waitForHandoffClear() {
		return new Promise((resolve) => {
			if (!get(imageHandoffBusy)) {
				resolve(false);
				return;
			}
			const unsub = imageHandoffBusy.subscribe((busy) => {
				if (!busy) {
					unsub();
					resolve(true);
				}
			});
			window.setTimeout(() => {
				unsub();
				resolve(true);
			}, 2800);
		});
	}

	onMount(() => {
		if (!$capturedImageData) {
			go('camera');
			return;
		}

		/* Fresh edit session — never carry stickers from a prior strip. */
		activeStickers.set([]);
		selectedId = null;

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
				const hadHandoff = await waitForHandoffClear();
				if (hadHandoff) {
					await playStudioSettle(shellEl, { reduced });
				} else {
					await playStudioEntry(shellEl, { reduced });
				}
			} finally {
				entryBusy = false;
				startEditTimer();
			}
		})();

		return () => {
			clearTimers();
		};
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
		if (entryBusy || timeUp || exiting) return;
		const id = `${item.id}-${Date.now()}`;
		await editorRef?.spawnSticker({ id, src: item.src });
	}

	function clearStickers() {
		if (entryBusy || timeUp || exiting) return;
		editorRef?.clearStickers();
		selectedId = null;
	}

	function removeSelected() {
		if (!selectedId || entryBusy || timeUp || exiting) return;
		const removed = editorRef?.removeSticker(selectedId) ?? false;
		if (removed) selectedId = null;
	}

	function goReveal() {
		if (exiting) return;
		exiting = true;
		clearTimers();
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
		grid-template-rows: 1fr;
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

	.time-up-flash {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		pointer-events: none;
		font-size: clamp(1.4rem, 4vw, 2.4rem);
		color: #fff8df;
		text-shadow: 3px 3px 0 #071936, 0 0 24px rgba(255, 90, 31, 0.55);
		background: radial-gradient(ellipse at center, rgba(7, 21, 45, 0.35), rgba(7, 21, 45, 0.78));
		animation: time-up-in 280ms steps(4) forwards;
	}

	@keyframes time-up-in {
		from {
			opacity: 0;
			transform: scale(1.08);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.stage {
		position: relative;
		z-index: 1;
		min-height: 0;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(var(--booth-rail-width), 1fr);
		gap: clamp(0.65rem, 1.5vw, 1.25rem);
		align-items: center;
	}

	.dock-column {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		height: 100%;
		position: relative;
		padding: clamp(0.25rem, 1vh, 0.75rem) clamp(0.25rem, 1vw, 0.65rem);
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
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 520px);
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
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 340px);
	}

	.editor-shell.entry-busy {
		pointer-events: none;
	}

	.studio-view.handoff-pending .editor-shell {
		opacity: 0;
	}

	.timer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		flex-shrink: 0;
	}

	.timer-label {
		font-size: var(--booth-text-xs);
		letter-spacing: 0.08em;
		color: color-mix(in srgb, #fff8df 70%, transparent);
	}

	.timer-chip {
		font-size: var(--booth-text-sm);
		padding: 0.35rem 0.55rem;
		background: #102f56;
		color: var(--gold-bright);
		box-shadow: 2px 2px 0 #071936;
		border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
		min-width: 4.5rem;
		text-align: center;
	}

	.timer-chip.warn {
		color: #fff8df;
		background: #7a2a18;
		border-color: #ff9a3c;
		animation: timer-pulse 900ms steps(2) infinite;
	}

	@keyframes timer-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.72;
		}
	}

	.sticker-rail {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-height: 0;
		height: 100%;
		max-height: 100%;
		width: 100%;
		/* Keep gallery scrollable; don't clip DialogBox/button box-shadow borders. */
		overflow: visible;
		/* Dialog outline is 8px; buttons need ~4px — inset so left/bottom edges paint. */
		padding: 0.5rem 0.35rem 0.65rem 0.65rem;
		box-sizing: border-box;
	}

	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--booth-tile-min), 1fr));
		grid-auto-rows: calc(var(--booth-swatch) + var(--booth-sticker-label-h) + 0.85rem);
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
		justify-content: flex-start;
		align-self: stretch;
		height: 100%;
		min-height: 0;
		gap: 0.35rem;
		padding: 0.45rem 0.35rem;
		background: #102f56;
		border: 2px solid color-mix(in srgb, var(--gold) 45%, transparent);
		box-shadow: 2px 2px 0 #071936;
		color: #fff8df;
		font-size: var(--booth-text-xs);
		text-align: center;
	}

	.tile:disabled {
		opacity: 0.45;
		pointer-events: none;
	}

	.tile:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 #071936;
	}

	.swatch {
		width: var(--booth-swatch);
		height: var(--booth-swatch);
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, #fff 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--gold-bright) 35%, transparent);
	}

	.swatch img {
		width: calc(var(--booth-swatch) * 0.64);
		height: calc(var(--booth-swatch) * 0.64);
		object-fit: contain;
	}

	.label {
		flex: 0 0 var(--booth-sticker-label-h);
		height: var(--booth-sticker-label-h);
		width: 100%;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
		letter-spacing: 0.02em;
		line-height: 1.35;
		align-content: center;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: flex-start;
		flex-shrink: 0;
		/* Room for pixel-btn hard shadows (3px ring + 4px offset). */
		padding: 0.15rem 0.35rem 0.35rem 0.15rem;
	}

	.sticker-rail :global(.dialog) {
		flex-shrink: 0;
		/* Dialog uses 8px outer gold ring — keep it inside the rail padding box. */
		max-width: calc(100% - 0.25rem);
	}

	.booth-view :global(.pixel-btn) {
		min-height: var(--booth-touch);
		font-size: var(--booth-text-sm);
		padding: 0.85rem 1.35rem;
	}

	.booth-view :global(.dialog) {
		max-width: var(--booth-panel-max);
	}

	.booth-view :global(.dialog .speaker),
	.booth-view :global(.dialog .body) {
		font-size: var(--booth-text-sm);
		line-height: 1.75;
	}

	@media (max-width: 980px) {
		.stage {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			align-items: start;
		}

		.dock-column {
			justify-content: center;
			min-height: min(52dvh, 560px);
			max-height: min(52dvh, 560px);
		}

		.editor-shell {
			width: min(100cqw, calc(100cqh * var(--frame-ar)), 520px);
		}

		.editor-shell.is-narrow {
			width: min(100cqw, calc(100cqh * var(--frame-ar)), 340px);
		}

		.sticker-rail {
			height: auto;
			max-height: none;
			overflow: visible;
		}

		.gallery {
			grid-template-columns: repeat(auto-fill, minmax(clamp(4.75rem, 14vw, var(--booth-tile-min)), 1fr));
			max-height: min(28dvh, 220px);
			overflow-x: auto;
			overflow-y: auto;
			grid-auto-flow: column;
			grid-auto-columns: minmax(clamp(4.75rem, 14vw, var(--booth-tile-min)), 1fr);
			padding-bottom: 0.25rem;
			flex: 0 1 auto;
		}
	}
</style>
