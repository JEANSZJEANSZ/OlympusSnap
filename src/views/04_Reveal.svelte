<section
	class="gift-view booth-view"
	class:handoff-pending={$imageHandoffBusy}
>
	<div class="sky-wash" aria-hidden="true"></div>
	<div class="stars" aria-hidden="true">
		<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
	</div>
	<div class="mountains mountains-far" aria-hidden="true"></div>
	<div class="mountains mountains-near" aria-hidden="true"></div>

	{#if phase === 'forging'}
		<div class="forge-overlay">
			<p>FORGING RELIC…</p>
		</div>
	{/if}

	{#if phase === 'marble' && giftImage && marbleSeed != null}
		<GiftMarbleCanvas
			portraitUrl={giftImage}
			seed={marbleSeed}
			{reduced}
			onPhaseChange={(p) => {
				if (p === 'crack' || p === 'revealed') showMarbleHint = false;
			}}
			onRevealed={() => (phase = 'revealed')}
		/>
		{#if showMarbleHint}
			<p class="marble-hint">STRIKE THE RELIC</p>
		{/if}
	{/if}

	<main class="stage" class:revealed={phase === 'revealed'} {@attach attachStage}>
		<aside class="dock-column">
			<div
				class="frame-dock"
				style:--frame-ar={frameAspect}
				style:--frame-ar-num={frameAspectNum}
				data-reveal-handoff-target
				bind:this={dockEl}
			>
				{#if forging}
					<div class="forge">
						<p>FORGING RELIC…</p>
					</div>
				{:else if giftImage}
					<img
						class="frame-art photo-smooth"
						src={giftImage}
						alt="Your Olympus Snap portrait"
						draggable="false"
					/>
				{:else}
					<div class="empty">
						<p>NO IMAGE YET</p>
						<p class="empty-sub">Walk the ritual — capture will appear here.</p>
					</div>
				{/if}
			</div>
		</aside>

		<div class="detail-panel">
			<header class="head">
				<p class="eyebrow">OLYMPUS SNAP!</p>
				<h1>THE CRACKED RELIC</h1>
				<p class="sub">Strike · Scan · Ascend — your mythic portrait awaits.</p>
			</header>

			<aside class="qr-side">
				{#if sessionId && qrDataUrl}
					<button
						type="button"
						class="qr-box pixel-panel qr-link"
						aria-label="Open studio on this device (or scan with your phone)"
						onclick={openStudioFromQr}
					>
						<img class="qr-img" src={qrDataUrl} alt="" draggable="false" />
					</button>
				{:else}
					<div class="qr-box pixel-panel" aria-label="Studio QR code">
						<p class="qr-loading">PREPARING GLYPH…</p>
					</div>
				{/if}
				<p class="qr-caption">QR · SCAN OR TAP TO OPEN STUDIO</p>
			</aside>

			<DialogBox
				speaker="MUSES"
				text="Behold your mythic portrait! Scan the glyph on your phone — or tap it here to open Studio on this booth."
				typewriter={false}
			/>

			<div class="actions">
				<PixelButton label="NEW RITUAL" variant="gold" onclick={restart} />
				<a
					class="download staff-fallback"
					href={giftImage || '#'}
					download="olympus-snap.png"
					class:disabled={!giftImage}
					title="Staff fallback — guests use the QR"
				>
					SAVE PNG
				</a>
			</div>
		</div>
	</main>
</section>

<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import QRCode from 'qrcode';
	import {
		activeStickers,
		capturedImageData,
		clearCaptures,
		finalCompositedImage,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import {
		buildStudioSessionUrl,
		createSession
	} from '../lib/session/sessionClient.js';
	import { imageHandoffBusy } from '../lib/fx/imageHandoff.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import GiftMarbleCanvas from '../lib/components/GiftMarbleCanvas.svelte';
	import { playRevealGiftMotion } from '../lib/fx/revealGiftMotion.js';
	import { clearMarbleSeed, mintMarbleSeed } from '../lib/fx/marbleSeed.js';

	/** @typedef {'forging' | 'marble' | 'revealed'} RevealPhase */

	let forging = $state(true);
	let giftImage = $state(/** @type {string | null} */ (null));
	let qrDataUrl = $state(/** @type {string | null} */ (null));
	let sessionId = $state(/** @type {string | null} */ (null));
	let reduced = $state(false);
	let showMarbleHint = $state(true);
	let marbleSeed = $state(/** @type {number | null} */ (null));
	/** @type {RevealPhase} */
	let phase = $state('forging');
	/** @type {HTMLElement | undefined} */
	let stageEl = $state();
	/** @type {HTMLElement | undefined} */
	let dockEl = $state();
	/** @type {(() => void) | null} */
	let stopGiftMotion = null;
	let giftMotionPlayed = false;

	let frameNatW = $state(300);
	let frameNatH = $state(400);
	const frameAspect = $derived(`${frameNatW} / ${frameNatH}`);
	const frameAspectNum = $derived(frameNatH > 0 ? frameNatW / frameNatH : 0.75);

	/** @param {string | null} src */
	function loadGiftMetrics(src) {
		if (!src) return;
		const img = new Image();
		img.onload = () => {
			frameNatW = img.naturalWidth || 300;
			frameNatH = img.naturalHeight || 400;
		};
		img.src = src;
	}

	$effect(() => {
		if (giftImage) loadGiftMetrics(giftImage);
	});

	/** @type {import('svelte/attachments').Attachment<HTMLElement>} */
	const attachStage = (element) => {
		stageEl = element;
		return () => {
			if (stageEl === element) stageEl = undefined;
		};
	};

	$effect(() => {
		if (phase === 'revealed' && stageEl && !giftMotionPlayed) {
			giftMotionPlayed = true;
			stopGiftMotion?.();
			stopGiftMotion = playRevealGiftMotion(stageEl, { reduced }) || null;
		}
	});

	/**
	 * @param {string} studioUrl
	 */
	async function renderQr(studioUrl) {
		try {
			qrDataUrl = await QRCode.toDataURL(studioUrl, {
				margin: 1,
				width: 280,
				color: { dark: '#071936', light: '#fff8df' }
			});
		} catch (err) {
			console.warn('[reveal] QR render failed', err);
		}
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const base = get(capturedImageData);
		if (!base) {
			go('camera');
			return;
		}

		let cancelled = false;
		(async () => {
			/* Marble uses raw booth capture — no stickers on the relic yet. */
			activeStickers.set([]);
			const unstickered = base;
			if (cancelled) return;

			finalCompositedImage.set(unstickered);
			giftImage = unstickered;
			marbleSeed = mintMarbleSeed(giftImage || undefined);

			try {
				const created = await createSession({
					imageDataUrl: unstickered,
					frameId: get(selectedFrameId)
				});
				if (!cancelled) {
					sessionId = created.sessionId;
					await renderQr(buildStudioSessionUrl(created.sessionId));
				}
			} catch (err) {
				console.warn('[reveal] session create failed', err);
			}

			if (cancelled) return;
			forging = false;
			phase = reduced ? 'revealed' : 'marble';
		})();

		return () => {
			cancelled = true;
			stopGiftMotion?.();
			stopGiftMotion = null;
		};
	});

	/** Same-device / booth test — click QR instead of scanning. */
	function openStudioFromQr() {
		if (!sessionId) return;
		go('studio', `?s=${encodeURIComponent(sessionId)}`);
	}

	function restart() {
		selectedFrameId.set(null);
		clearCaptures();
		activeStickers.set([]);
		finalCompositedImage.set(null);
		clearMarbleSeed();
		marbleSeed = null;
		qrDataUrl = null;
		sessionId = null;
		go('landing');
	}
</script>

<style>
	.gift-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		--gift-pad-y: clamp(0.65rem, 1.5vh, 1rem);
		--gift-pad-x: clamp(0.75rem, 2vw, 1.25rem);
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		padding: var(--gift-pad-y) var(--gift-pad-x);
		color: #fff8df;
		background: var(--sky-top);
	}

	.gift-view.handoff-pending .frame-dock {
		opacity: 0;
		visibility: hidden;
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
		right: 0;
		bottom: 0;
		left: 0;
		z-index: -2;
		height: 46%;
		clip-path: polygon(0 72%, 8% 48%, 15% 62%, 25% 25%, 36% 58%, 47% 35%, 58% 67%, 70% 30%, 80% 56%, 91% 22%, 100% 61%, 100% 100%, 0 100%);
		background: #102f56;
	}

	.mountains-far {
		opacity: 0.55;
		filter: brightness(0.85);
	}

	.mountains-near {
		height: 38%;
		background: #31577a;
		clip-path: polygon(0 100%, 0 68%, 12% 52%, 22% 72%, 34% 40%, 48% 64%, 60% 34%, 72% 58%, 84% 28%, 100% 55%, 100% 100%);
	}

	.marble-hint {
		position: fixed;
		left: 50%;
		bottom: max(1.25rem, env(safe-area-inset-bottom));
		z-index: 3;
		transform: translateX(-50%);
		font-size: var(--booth-text-sm);
		color: var(--gold-bright);
		letter-spacing: 0.1em;
		text-shadow: 2px 2px 0 #071936;
		pointer-events: none;
		animation: marble-pulse 1.6s steps(4) infinite;
	}

	@keyframes marble-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	.forge-overlay {
		position: fixed;
		inset: 0;
		z-index: 2;
		display: grid;
		place-content: center;
		pointer-events: none;
		font-size: var(--booth-text-sm);
		color: var(--gold-bright);
		letter-spacing: 0.08em;
		text-shadow: 2px 2px 0 #071936;
	}

	.stage {
		position: relative;
		z-index: 1;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(240px, 1fr);
		gap: clamp(0.65rem, 1.5vw, 1.25rem);
		align-items: center;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.5s ease;
	}

	.stage.revealed {
		opacity: 1;
		pointer-events: auto;
	}

	.stage:global(.fx-anime) .frame-dock,
	.stage:global(.fx-anime) .head,
	.stage:global(.fx-anime) .qr-side,
	.stage:global(.fx-anime) :global(.dialog),
	.stage:global(.fx-anime) .actions :global(.pixel-btn),
	.stage:global(.fx-anime) .actions .download {
		opacity: 0;
	}

	.dock-column {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		height: 100%;
		position: relative;
		container-type: size;
		container-name: gift-dock;
	}

	.frame-dock {
		position: relative;
		width: min(100cqw, calc(100cqh * var(--frame-ar-num, 0.75)), 720px);
		max-height: 100cqh;
		aspect-ratio: var(--frame-ar);
		background: transparent;
		filter: drop-shadow(6px 8px 0 color-mix(in srgb, var(--primary) 35%, transparent));
	}

	.frame-art {
		width: 100%;
		height: 100%;
		object-fit: fill;
		display: block;
		/* Beat global img { image-rendering: pixelated } — keep photo sharp */
		image-rendering: auto !important;
		image-rendering: smooth !important;
	}

	.forge,
	.empty {
		width: 100%;
		height: 100%;
		display: grid;
		place-content: center;
		gap: 0.5rem;
		text-align: center;
		font-size: var(--booth-text-sm);
		color: var(--gold-bright);
		background: #111;
	}

	.empty-sub {
		font-size: var(--booth-text-xs);
		opacity: 0.75;
		line-height: 1.7;
	}

	.detail-panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: var(--booth-panel-max);
		width: 100%;
		justify-self: center;
	}

	.head .eyebrow {
		font-size: var(--booth-text-xs);
		color: var(--gold-bright);
		letter-spacing: 0.08em;
		margin-bottom: 0.35rem;
	}

	.head h1 {
		font-family: var(--font-greek);
		font-size: var(--booth-text-md);
		color: #fff8df;
		text-shadow: 2px 2px 0 color-mix(in srgb, var(--gold) 40%, transparent);
	}

	.sub {
		margin-top: 0.4rem;
		font-size: var(--booth-text-sm);
		color: color-mix(in srgb, #fff8df 72%, transparent);
		line-height: 1.6;
	}

	.qr-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55rem;
	}

	.qr-box {
		width: clamp(8.5rem, 22vw, 10rem);
		height: clamp(8.5rem, 22vw, 10rem);
		padding: 0.55rem;
		background: color-mix(in srgb, var(--surface) 90%, #071936);
		color: var(--text);
		box-shadow:
			0 0 0 3px var(--gold),
			0 0 0 6px var(--text),
			6px 6px 0 var(--primary);
		display: grid;
		place-items: center;
	}

	button.qr-link {
		border: none;
		cursor: pointer;
		font: inherit;
		color: inherit;
		transition:
			transform 60ms steps(2),
			box-shadow 60ms steps(2),
			filter 80ms;
	}

	button.qr-link:hover {
		filter: brightness(1.06);
	}

	button.qr-link:active {
		transform: translate(3px, 3px);
		box-shadow:
			0 0 0 3px var(--gold),
			0 0 0 6px var(--text),
			3px 3px 0 var(--primary);
	}

	button.qr-link:focus-visible {
		outline: 3px solid var(--gold-bright);
		outline-offset: 4px;
	}

	.qr-img {
		width: 100%;
		height: 100%;
		display: block;
		image-rendering: pixelated;
	}

	.qr-loading {
		font-size: var(--booth-text-xs);
		color: color-mix(in srgb, #fff8df 65%, transparent);
		text-align: center;
		line-height: 1.5;
	}

	.qr-caption {
		font-size: var(--booth-text-sm);
		color: var(--gold-bright);
		letter-spacing: 0.06em;
		text-align: center;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
		align-items: center;
	}

	.download {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.85rem 1.35rem;
		min-height: var(--booth-touch);
		background: var(--accent);
		color: var(--bg-base);
		text-decoration: none;
		font-size: var(--booth-text-sm);
		box-shadow: var(--shadow-btn);
		transition:
			transform 60ms steps(2),
			box-shadow 60ms steps(2),
			filter 80ms;
	}

	.download.staff-fallback {
		opacity: 0.55;
		font-size: var(--booth-text-xs);
		padding: 0.65rem 1rem;
		min-height: auto;
	}

	.download:not(.disabled):hover {
		filter: brightness(1.08);
	}

	.download:active:not(.disabled) {
		transform: translate(3px, 3px);
		box-shadow: var(--shadow-btn-press);
	}

	.download.disabled {
		pointer-events: none;
		opacity: 0.45;
	}

	.booth-view :global(.pixel-btn) {
		min-height: var(--booth-touch);
		font-size: var(--booth-text-sm);
		padding: 0.85rem 1.35rem;
	}

	.detail-panel :global(.dialog) {
		max-width: 100%;
		margin: 0;
	}

	.detail-panel :global(.dialog .speaker),
	.detail-panel :global(.dialog .body) {
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
			container-type: normal;
			height: auto;
			justify-content: center;
		}

		.frame-dock {
			width: min(84vw, calc(min(56dvh, 640px) * var(--frame-ar-num, 0.75)));
			max-height: min(56dvh, 640px);
			margin: 0 auto;
		}

		.detail-panel {
			max-width: none;
			align-items: center;
		}

		.head {
			text-align: center;
			width: 100%;
		}
	}

	@media (max-width: 640px) {
		.gift-view {
			--gift-pad-y: max(0.4rem, env(safe-area-inset-top));
			--gift-pad-x: max(0.5rem, env(safe-area-inset-right));
			padding:
				var(--gift-pad-y)
				max(0.5rem, env(safe-area-inset-right))
				max(0.35rem, env(safe-area-inset-bottom))
				max(0.5rem, env(safe-area-inset-left));
			overflow: hidden;
			touch-action: manipulation;
		}

		.marble-hint {
			bottom: max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem));
			font-size: var(--booth-text-xs);
		}

		.stage.revealed {
			display: flex;
			flex-direction: column;
			height: 100%;
			min-height: 0;
			overflow: hidden;
			gap: 0;
			align-items: stretch;
		}

		.dock-column {
			flex: 0 1 auto;
			width: 100%;
			min-height: 0;
			max-height: min(45dvh, 400px);
			height: auto;
			align-items: center;
			justify-content: center;
		}

		.frame-dock {
			width: min(92vw, calc(min(42dvh, 360px) * var(--frame-ar-num, 0.75)));
			max-height: min(42dvh, 360px);
			margin-inline: auto;
		}

		.detail-panel {
			flex: 1 1 auto;
			width: 100%;
			min-height: 0;
			max-width: none;
			align-items: center;
			overflow-y: auto;
			overflow-x: hidden;
			overscroll-behavior: contain;
			gap: 0.55rem;
			padding-bottom: 0.25rem;
		}

		.head {
			width: 100%;
			text-align: center;
		}

		.detail-panel :global(.dialog) {
			width: 100%;
			text-align: left;
		}

		.qr-box {
			width: min(72vw, 9rem);
			height: min(72vw, 9rem);
		}

		.detail-panel :global(.dialog .body) {
			line-height: 1.55;
		}

		.actions {
			position: sticky;
			bottom: 0;
			z-index: 2;
			display: grid;
			grid-template-columns: 1fr;
			gap: 0.5rem;
			width: 100%;
			padding:
				0.45rem 0
				max(0.35rem, env(safe-area-inset-bottom));
			background: linear-gradient(180deg, transparent, #071936 30%);
		}

		.actions :global(.pixel-btn),
		.actions .download {
			width: 100%;
			min-height: max(44px, var(--booth-touch));
			justify-content: center;
		}
	}

	@media (max-width: 640px) and (max-height: 580px) {
		.dock-column {
			max-height: min(36dvh, 280px);
		}

		.frame-dock {
			width: min(88vw, calc(min(34dvh, 240px) * var(--frame-ar-num, 0.75)));
			max-height: min(34dvh, 240px);
		}

		.head .sub {
			display: none;
		}

		.qr-side {
			gap: 0.35rem;
		}
	}

	@media (max-width: 640px) and (max-height: 430px) {
		.head .eyebrow {
			display: none;
		}

		.head h1 {
			font-size: var(--booth-text-sm);
		}
	}
</style>
