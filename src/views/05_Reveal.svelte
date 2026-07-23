<section class="gift-view booth-view">
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
			<p class="marble-hint">STRIKE THE MARBLE</p>
		{/if}
	{/if}

	<main class="stage" class:revealed={phase === 'revealed'} {@attach attachStage}>
		<aside class="dock-column">
			<div class="frame-dock" style:--frame-ar={frameAspect}>
				{#if forging}
					<div class="forge">
						<p>FORGING RELIC…</p>
					</div>
				{:else if giftImage}
					<img class="frame-art" src={giftImage} alt="Your Olympus Snap portrait" />
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
				<div class="qr-box pixel-panel" aria-label="QR code placeholder">
					<svg viewBox="0 0 29 29" class="qr-svg" aria-hidden="true">
						{#each Array(29) as _, y (y)}
							{#each Array(29) as _, x (`${y}-${x}`)}
								{#if (x * 7 + y * 3 + x * y) % 5 === 0 || (x < 7 && y < 7) || (x > 21 && y < 7) || (x < 7 && y > 21)}
									<rect {x} {y} width="1" height="1" fill="currentColor" />
								{/if}
							{/each}
						{/each}
					</svg>
				</div>
				<p class="qr-caption">QR · DOWNLOAD LINK</p>
				<p class="qr-note">(generator hooks in next pass)</p>
			</aside>

			<DialogBox
				speaker="MUSES"
				text="Behold your mythic portrait! Scan the tablet glyph to claim your Olympus Snap."
				typewriter={false}
			/>

			<div class="actions">
				<PixelButton label="NEW RITUAL" variant="gold" onclick={restart} />
				<a
					class="download"
					href={giftImage || '#'}
					download="olympus-snap.png"
					class:disabled={!giftImage}
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
	import {
		activeStickers,
		capturedImageData,
		clearCaptures,
		finalCompositedImage,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import { compositeWithStickers } from '../lib/utils/canvasRenderer.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import GiftMarbleCanvas from '../lib/components/GiftMarbleCanvas.svelte';
	import { playRevealGiftMotion } from '../lib/fx/revealGiftMotion.js';
	import { clearMarbleSeed, mintMarbleSeed } from '../lib/fx/marbleSeed.js';

	/** @typedef {'forging' | 'marble' | 'revealed'} RevealPhase */

	let forging = $state(true);
	let giftImage = $state(/** @type {string | null} */ (null));
	let reduced = $state(false);
	let showMarbleHint = $state(true);
	/** Fresh seed minted when gift is ready — unique boulder every ritual */
	let marbleSeed = $state(/** @type {number | null} */ (null));
	/** @type {RevealPhase} */
	let phase = $state('forging');
	/** @type {HTMLElement | undefined} */
	let stageEl = $state();
	/** @type {(() => void) | null} */
	let stopGiftMotion = null;
	let giftMotionPlayed = false;

	let frameNatW = $state(300);
	let frameNatH = $state(400);
	const frameAspect = $derived(`${frameNatW} / ${frameNatH}`);

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

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (!get(capturedImageData)) {
			go('camera');
			return;
		}

		let cancelled = false;
		(async () => {
			const base = get(capturedImageData);
			const stickers = get(activeStickers);
			const composited = await compositeWithStickers(base || '', stickers);
			if (cancelled) return;
			finalCompositedImage.set(composited || base);
			giftImage = composited || base;
			marbleSeed = mintMarbleSeed(giftImage || undefined);
			forging = false;
			phase = reduced ? 'revealed' : 'marble';
		})();

		return () => {
			cancelled = true;
			stopGiftMotion?.();
			stopGiftMotion = null;
		};
	});

	function restart() {
		selectedFrameId.set(null);
		clearCaptures();
		activeStickers.set([]);
		finalCompositedImage.set(null);
		clearMarbleSeed();
		marbleSeed = null;
		go('landing');
	}
</script>

<style>
	.gift-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		padding: clamp(0.65rem, 1.5vh, 1rem) clamp(0.75rem, 2vw, 1.25rem);
		color: #fff8df;
		background: var(--sky-top);
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
		bottom: clamp(1.25rem, 4vh, 2.5rem);
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
		transition: opacity 0.55s ease;
	}

	.stage.revealed {
		opacity: 1;
		pointer-events: auto;
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
		/* Height-first like Studio/Camera — tall strips fill the dock */
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 560px);
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
		image-rendering: auto;
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
	}

	.qr-svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.qr-caption {
		font-size: var(--booth-text-sm);
		color: var(--gold-bright);
		letter-spacing: 0.06em;
	}

	.qr-note {
		font-size: var(--booth-text-xs);
		color: color-mix(in srgb, #fff8df 55%, transparent);
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

		.frame-dock {
			width: min(78vw, calc(min(52dvh, 560px) * var(--frame-ar)));
			max-height: min(52dvh, 560px);
			margin: 0 auto;
		}

		.dock-column {
			justify-content: center;
		}

		.detail-panel {
			max-width: none;
		}
	}
</style>
