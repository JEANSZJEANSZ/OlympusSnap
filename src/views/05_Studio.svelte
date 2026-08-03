<section
	class="studio-view booth-view"
	class:handoff-pending={$imageHandoffBusy}
	class:mobile-session={mobileSession}
	class:session-error={!!sessionError}
	class:exiting
>
	{#if !mobileSession}
		<div class="sky-wash" aria-hidden="true"></div>
		<div class="stars" aria-hidden="true">
			<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
		</div>
		<div class="mountains mountains-far" aria-hidden="true"></div>
		<div class="mountains mountains-near" aria-hidden="true"></div>
	{/if}

	{#if sessionLoading}
		<div class="session-loading" aria-live="polite">
			<p>OPENING YOUR RELIC…</p>
		</div>
	{:else if sessionError}
		<div class="session-empty">
			<p class="session-empty-title">
				{sessionError === 'consumed' ? 'LINK ALREADY USED' : 'LINK NOT FOUND'}
			</p>
			<p class="session-empty-sub">
				{sessionError === 'consumed'
					? 'This studio link was already opened. Scan a fresh QR at the booth.'
					: 'This link is invalid or expired. Scan the QR on the booth screen.'}
			</p>
		</div>
	{:else if mobileSession || $capturedImageData}
		<div class="studio-body">
			<main class="stage">
				<aside class="dock-column">
					<div class="frame-pedestal">
						<div
							bind:this={shellEl}
							class="editor-shell pixel-panel"
							class:entry-busy={entryBusy || $imageHandoffBusy}
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
					{#if mobileSession}
						<header class="mobile-head">
							<p class="eyebrow">MOBILE STUDIO</p>
							<h1>DECORATE YOUR RELIC</h1>
						</header>
					{/if}

					<div class="gallery">
						{#each $stickers as item (item.id)}
							<button
								type="button"
								class="tile"
								disabled={entryBusy || exiting || saving}
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
							disabled={!selectedId || entryBusy || exiting || saving}
							onclick={removeSelected}
						/>
						<PixelButton
							label="CLEAR"
							variant="ghost"
							disabled={entryBusy || exiting || saving}
							onclick={clearStickers}
						/>
						{#if mobileSession}
							<PixelButton
								label="SAVE MY SNAP"
								variant="gold"
								disabled={entryBusy || exiting || saving || !$capturedImageData}
								onclick={saveMySnap}
							/>
						{/if}
					</div>
				</aside>
			</main>
		</div>
	{/if}
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
	import { consumeSession, getSessionIdFromUrl } from '../lib/session/sessionClient.js';
	import { imageHandoffBusy } from '../lib/fx/imageHandoff.js';
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
	let exiting = $state(false);
	let saving = $state(false);
	let mobileSession = $state(false);
	let sessionLoading = $state(false);
	/** @type {'consumed' | 'not_found' | null} */
	let sessionError = $state(null);
	/** @type {Record<string, { w: number; h: number }>} */
	let measuredDims = $state({});

	const frame = $derived(getLiveFrameById($selectedFrameId));

	function measureComposite(url) {
		const img = new Image();
		img.onload = () => {
			if (!img.naturalWidth || !img.naturalHeight) return;
			const key = $selectedFrameId || '__session__';
			measuredDims = {
				...measuredDims,
				[key]: { w: img.naturalWidth, h: img.naturalHeight }
			};
		};
		img.src = url;
	}

	const frameAspect = $derived.by(() => {
		const f = frame;
		if (f?.w && f?.h && f.h > 0) return f.w / f.h;
		const key = $selectedFrameId || '__session__';
		const m = measuredDims[key];
		if (m?.w && m?.h) return m.w / m.h;
		return 3 / 4;
	});

	const dialogText = $derived(
		mobileSession
			? 'Tap a sticker, drag it into place, then SAVE MY SNAP when your relic is ready.'
			: 'Scan the QR at the booth to open mobile studio.'
	);

	async function initEditorEntry() {
		await tick();
		entryBusy = true;
		try {
			/* Mobile session: minimal fade — no booth Z-fall entry motion. */
			if (shellEl && !reduced) {
				shellEl.style.opacity = '0';
				shellEl.style.transition = 'opacity 320ms ease';
				await tick();
				shellEl.style.opacity = '1';
				await new Promise((r) => setTimeout(r, 340));
			}
		} finally {
			entryBusy = false;
		}
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		activeStickers.set([]);
		selectedId = null;

		const sessionId = getSessionIdFromUrl();
		if (sessionId) {
			mobileSession = true;
			sessionLoading = true;
			entryBusy = true;

			(async () => {
				try {
					const payload = await consumeSession(sessionId);
					capturedImageData.set(payload.imageDataUrl);
					if (payload.frameId) selectedFrameId.set(payload.frameId);
					activeStickers.set([]);
					measureComposite(payload.imageDataUrl);
					sessionLoading = false;
					await initEditorEntry();
				} catch (err) {
					/* Same-device booth click: image may already live in the store. */
					const existing = get(capturedImageData);
					if (existing && err?.code !== 'CONSUMED') {
						activeStickers.set([]);
						measureComposite(existing);
						sessionLoading = false;
						await initEditorEntry();
						return;
					}
					sessionLoading = false;
					entryBusy = false;
					sessionError = err?.code === 'CONSUMED' ? 'consumed' : 'not_found';
				}
			})();

			return;
		}

		if (!$capturedImageData) {
			go('camera');
			return;
		}

		measureComposite($capturedImageData);
		entryBusy = false;
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
		if (entryBusy || exiting || saving) return;
		const id = `${item.id}-${Date.now()}`;
		await editorRef?.spawnSticker({ id, src: item.src });
	}

	function clearStickers() {
		if (entryBusy || exiting || saving) return;
		editorRef?.clearStickers();
		selectedId = null;
	}

	function removeSelected() {
		if (!selectedId || entryBusy || exiting || saving) return;
		const removed = editorRef?.removeSticker(selectedId) ?? false;
		if (removed) selectedId = null;
	}

	async function saveMySnap() {
		if (saving || entryBusy || exiting) return;
		saving = true;
		try {
			const url = await editorRef?.exportDataUrl();
			if (!url) return;
			const a = document.createElement('a');
			a.href = url;
			a.download = 'olympus-snap.png';
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
		} finally {
			saving = false;
		}
	}
</script>

<style>
	.studio-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
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

	.studio-view.mobile-session {
		--mobile-col-max: min(26.5rem, 100%);
		--sheet-pad: max(0.75rem, env(safe-area-inset-bottom));
		padding: 0;
		height: 100%;
		min-height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: stretch;
		background: #071936;
		overflow: hidden;
		touch-action: manipulation;
		overscroll-behavior: none;
		z-index: 1;
	}

	/* Full-bleed opaque veil — covers App marble / leftover FX on wide screens */
	.studio-view.mobile-session::before {
		content: '';
		position: absolute;
		inset: 0;
		background: #071936;
		z-index: 0;
		pointer-events: none;
	}

	.studio-body {
		min-height: 0;
		height: 100%;
		width: 100%;
	}

	.mobile-session .studio-body {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		width: 100%;
		max-width: var(--mobile-col-max);
		min-height: 0;
		margin-inline: auto;
		padding:
			max(0.4rem, env(safe-area-inset-top))
			max(0.65rem, env(safe-area-inset-right))
			0
			max(0.65rem, env(safe-area-inset-left));
	}

	.mobile-session .stage {
		display: flex;
		flex-direction: column;
		grid-template-columns: unset;
		grid-template-rows: unset;
		align-items: stretch;
		gap: 0;
		flex: 1 1 auto;
		min-height: 0;
		height: 100%;
		width: 100%;
		touch-action: manipulation;
		overscroll-behavior: contain;
	}

	.mobile-session .dock-column {
		flex: 1 1 0;
		min-height: 12rem;
		max-height: none;
		height: auto;
		padding: 0.5rem 0.35rem;
		background: #071936;
		touch-action: none;
		overscroll-behavior: contain;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mobile-session .frame-pedestal {
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mobile-session .frame-pedestal::after {
		display: none;
	}

	.mobile-session .editor-shell,
	.mobile-session .editor-shell.is-narrow {
		/* Fit dock: height-first, keep frame aspect, never overflow */
		width: min(100%, calc(100cqh * var(--frame-ar)));
		height: auto;
		max-width: 100%;
		max-height: 100%;
		aspect-ratio: var(--frame-ar);
		margin: 0 auto;
		filter: drop-shadow(0 8px 16px rgba(3, 12, 27, 0.45));
		background: #0a1220;
	}

	.mobile-session .sticker-rail {
		flex: 0 0 auto;
		height: auto;
		max-height: none;
		min-height: 0;
		overflow: visible;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding:
			0.65rem 0.75rem
			var(--sheet-pad);
		background: linear-gradient(180deg, #102f56 0%, #071936 100%);
		border-top: 2px solid color-mix(in srgb, var(--gold) 45%, transparent);
		box-shadow: 0 -8px 24px rgba(3, 12, 27, 0.35);
	}

	.mobile-session .gallery {
		display: flex;
		flex-direction: row;
		overflow-x: auto;
		overflow-y: hidden;
		gap: 0.55rem;
		padding-bottom: 0.25rem;
		flex: 0 0 auto;
		min-height: calc(var(--booth-swatch) + var(--booth-sticker-label-h) + 1.1rem);
		-webkit-overflow-scrolling: touch;
		scroll-snap-type: x proximity;
	}

	.mobile-session .tile {
		flex: 0 0 auto;
		width: 4.75rem;
		scroll-snap-align: start;
	}

	.mobile-session .actions {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		flex-shrink: 0;
		padding: 0.15rem 0 0;
		background: transparent;
	}

	.mobile-session .actions :global(.pixel-btn) {
		flex: unset;
		min-width: 0;
		width: 100%;
		min-height: max(44px, var(--booth-touch));
		justify-content: center;
		padding: 0.65rem 0.5rem;
		font-size: clamp(0.55rem, 2.8vw, var(--booth-text-sm));
	}

	.mobile-session .actions :global(.pixel-btn:last-child) {
		grid-column: 1 / -1;
	}

	.mobile-session .sticker-rail :global(.dialog) {
		display: none;
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

	.session-loading,
	.session-empty {
		display: grid;
		place-content: center;
		gap: 0.75rem;
		height: 100%;
		text-align: center;
		padding: 1.5rem;
	}

	.session-empty-title {
		font-size: var(--booth-text-md);
		color: var(--gold-bright);
		letter-spacing: 0.06em;
	}

	.session-empty-sub {
		font-size: var(--booth-text-sm);
		color: color-mix(in srgb, #fff8df 72%, transparent);
		line-height: 1.7;
		max-width: 22rem;
		margin: 0 auto;
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
		width: 100%;
		height: 100%;
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
		touch-action: none;
	}

	.editor-shell.is-narrow {
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 340px);
	}

	.editor-shell.entry-busy {
		pointer-events: none;
	}

	.studio-view.handoff-pending .editor-shell {
		opacity: 0;
	}

	.sticker-rail {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-height: 0;
		height: 100%;
		max-height: 100%;
		width: 100%;
		overflow: visible;
		padding: 0.5rem 0.35rem 0.65rem 0.65rem;
		box-sizing: border-box;
	}

	.mobile-head {
		flex-shrink: 0;
	}

	.mobile-head .eyebrow {
		font-size: var(--booth-text-xs);
		color: var(--gold-bright);
		letter-spacing: 0.08em;
		margin-bottom: 0.25rem;
	}

	.mobile-head h1 {
		font-size: var(--booth-text-sm);
		color: #fff8df;
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
		min-width: var(--booth-touch);
		min-height: var(--booth-touch);
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
		padding: 0.15rem 0.35rem 0.35rem 0.15rem;
	}

	.sticker-rail :global(.dialog) {
		flex-shrink: 0;
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
		.studio-view:not(.mobile-session) .stage {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			align-items: start;
		}

		.studio-view:not(.mobile-session) .dock-column {
			justify-content: center;
			min-height: min(52dvh, 560px);
			max-height: min(52dvh, 560px);
		}
	}
</style>
