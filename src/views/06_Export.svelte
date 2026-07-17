<section class="view">
	<header class="head">
		<h1>OLYMPUS SNAP!</h1>
		<p>Scan · Save · Ascend</p>
	</header>

	<div class="gift-layout">
		<div class="photo-frame pixel-panel">
			{#if giftImage}
				<img src={giftImage} alt="Your Olympus Snap portrait" />
			{:else}
				<div class="empty">
					<p>NO IMAGE YET</p>
					<p class="sub">Walk the ritual — capture will appear here.</p>
				</div>
			{/if}
			<div class="plaque">RELIC CERTIFIED</div>
		</div>

		<div class="qr-side">
			<div class="qr-box" aria-label="QR code placeholder">
				<!-- Layout placeholder until a QR library is wired -->
				<svg viewBox="0 0 29 29" class="qr-svg" aria-hidden="true">
					{#each Array(29) as _, y}
						{#each Array(29) as _, x}
							{#if (x * 7 + y * 3 + x * y) % 5 === 0 || (x < 7 && y < 7) || (x > 21 && y < 7) || (x < 7 && y > 21)}
								<rect {x} {y} width="1" height="1" fill="currentColor" />
							{/if}
						{/each}
					{/each}
				</svg>
			</div>
			<p class="qr-caption">QR · DOWNLOAD LINK</p>
			<p class="qr-note">(generator hooks in next pass)</p>
		</div>
	</div>

	<div class="footer">
		<DialogBox
			speaker="MUSES"
			text="Behold your mythic portrait! Scan the tablet glyph to claim your Olympus Snap."
			typewriter={false}
		/>
		<div class="actions">
			<PixelButton label="NEW RITUAL" variant="primary" onclick={restart} />
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
</section>

<script>
import {
		finalCompositedImage,
		capturedImageData,
		activeStickers,
		selectedFrameId
		} from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';

	const giftImage = $derived($finalCompositedImage || $capturedImageData);

	function restart() {
		selectedFrameId.set(null);
		capturedImageData.set(null);
		activeStickers.set([]);
		finalCompositedImage.set(null);
		go('landing');
	}
</script>

<style>
	.view {
		height: 100%;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 1rem;
		padding: 1.15rem;
		overflow: auto;
	}

	.head {
		text-align: center;
	}

	.head h1 {
		font-size: clamp(0.9rem, 3.2vw, 1.2rem);
		color: var(--gold);
		text-shadow: 2px 2px 0 var(--text);
		text-wrap: balance;
	}

	.head p {
		margin-top: 0.35rem;
		font-size: 0.5rem;
		color: var(--ink-soft);
	}

	.gift-layout {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 1.5rem;
		max-width: 860px;
		width: 100%;
		margin: 0 auto;
	}

	.photo-frame {
		position: relative;
		width: min(100%, 340px);
		aspect-ratio: 3 / 4;
		padding: 0.65rem;
		background: var(--marble);
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.photo-frame img,
	.empty {
		flex: 1;
		width: 100%;
		object-fit: cover;
		background: var(--text);
		box-shadow: inset 0 0 0 3px var(--primary);
	}

	.empty {
		display: grid;
		place-content: center;
		gap: 0.5rem;
		text-align: center;
		color: var(--bg-base);
		font-size: 0.6rem;
		padding: 1rem;
	}

	.sub {
		font-size: 0.42rem;
		opacity: 0.7;
		line-height: 1.7;
	}

	.plaque {
		text-align: center;
		font-size: 0.45rem;
		padding: 0.4rem;
		background: var(--primary);
		color: var(--gold-bright);
	}

	.qr-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55rem;
	}

	.qr-box {
		width: 148px;
		height: 148px;
		padding: 0.55rem;
		background: var(--bg-base);
		color: var(--text);
		box-shadow:
			0 0 0 4px var(--text),
			6px 6px 0 var(--accent);
	}

	.qr-svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.qr-caption {
		font-size: 0.5rem;
		color: var(--primary);
	}

	.qr-note {
		font-size: 0.4rem;
		color: var(--ink-soft);
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
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
		align-items: center;
	}

	.download {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.9rem 1.25rem;
		min-height: 3.25rem;
		background: var(--accent);
		color: var(--bg-base);
		text-decoration: none;
		font-size: clamp(0.55rem, 1.5vw, 0.7rem);
		box-shadow: var(--shadow-btn);
	}

	.download:active:not(.disabled) {
		transform: translate(3px, 3px);
		box-shadow: var(--shadow-btn-press);
	}

	.download.disabled {
		pointer-events: none;
		opacity: 0.45;
	}
</style>
