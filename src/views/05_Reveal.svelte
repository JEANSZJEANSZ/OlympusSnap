<section class="view">
	<header class="head">
		<h1>THE HANGING GIFT</h1>
		<p>One cut. One reveal.</p>
	</header>

	<div
		class="stage"
		class:snipped={phase !== 'idle'}
		class:unrolling={phase === 'unrolling' || phase === 'done'}
	>
		<div class="rod" aria-hidden="true"></div>

		<div class="rope-row">
			<div class="rope left" class:cut={phase !== 'idle'} aria-hidden="true"></div>
			<button
				type="button"
				class="cut-hotspot"
				onclick={cutRope}
				disabled={phase !== 'idle'}
				aria-label="Cut the rope"
			>
				<span class="scissors" aria-hidden="true">✂</span>
				<span class="cut-label">CUT</span>
			</button>
			<div class="rope right" class:cut={phase !== 'idle'} aria-hidden="true"></div>
		</div>

		<div class="scroll">
			<div class="roll top" aria-hidden="true"></div>
			<div class="cloth">
				<div class="painting">
					{#if previewImage}
						<img src={previewImage} alt="" />
					{:else}
						<div class="mock"></div>
					{/if}
				</div>
			</div>
			<div class="roll bottom" class:drop={phase === 'unrolling' || phase === 'done'} aria-hidden="true"></div>
		</div>
	</div>

	<div class="footer">
		<DialogBox speaker="FATES" text={hint} typewriter={false} />
		<p class="tip">Tap the scissors. The cloth remembers.</p>
	</div>
</section>

<script>
	import { get } from 'svelte/store';
	import {
		capturedImageData,
		finalCompositedImage,
		activeStickers
	} from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import { compositeWithStickers } from '../lib/utils/canvasRenderer.js';
	import DialogBox from '../lib/components/DialogBox.svelte';

	let phase = $state(/** @type {'idle' | 'snipped' | 'unrolling' | 'done'} */ ('idle'));
	let previewImage = $state(/** @type {string | null} */ (null));

	const hint = $derived(
		phase === 'idle'
			? 'Cut the cord. Let your snap unfurl.'
			: phase === 'snipped'
				? 'The rope gives way…'
				: phase === 'unrolling'
					? 'The scroll awakens!'
					: 'Behold your Olympus Snap!'
	);

	function prefersReducedMotion() {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	async function prepareComposite() {
		const base = get(capturedImageData);
		const stickers = get(activeStickers);
		const composited = await compositeWithStickers(base || '', stickers);
		finalCompositedImage.set(composited || base);
		previewImage = composited || base;
	}

	async function cutRope() {
		if (phase !== 'idle') return;

		if (prefersReducedMotion()) {
			phase = 'done';
			await prepareComposite();
			go('export');
			return;
		}

		phase = 'snipped';
		await new Promise((r) => setTimeout(r, 280));
		phase = 'unrolling';
		await prepareComposite();
		await new Promise((r) => setTimeout(r, 1100));
		phase = 'done';
		go('export');
	}
</script>

<style>
	.view {
		height: 100%;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 0.85rem;
		padding: 1.15rem;
		place-items: center;
		background:
			radial-gradient(
				ellipse at 50% 20%,
				color-mix(in srgb, var(--primary) 22%, transparent),
				transparent 55%
			),
			var(--bg-base);
	}

	.head {
		text-align: center;
	}

	.head h1 {
		font-size: clamp(0.85rem, 3vw, 1.1rem);
		color: var(--primary);
	}

	.head p {
		margin-top: 0.35rem;
		font-size: 0.5rem;
		color: var(--gold);
	}

	.stage {
		position: relative;
		width: min(88vw, 360px);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.rod {
		width: 100%;
		height: 14px;
		background: repeating-linear-gradient(
			90deg,
			var(--gold) 0 10px,
			var(--gold-bright) 10px 14px
		);
		box-shadow:
			0 0 0 3px var(--text),
			4px 4px 0 var(--primary);
		z-index: 3;
	}

	.rope-row {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		width: 100%;
		height: 56px;
		margin-top: -2px;
		z-index: 4;
	}

	.rope {
		width: 6px;
		height: 52px;
		background: repeating-linear-gradient(
			180deg,
			#8b5a2b 0 6px,
			#c4a484 6px 8px
		);
		box-shadow: 1px 0 0 var(--text);
		margin: 0 1.4rem;
		transform-origin: top center;
		transition: transform 0.28s steps(3), opacity 0.28s steps(2);
	}

	.rope.cut.left {
		transform: rotate(-28deg) translateY(8px);
		opacity: 0.35;
	}

	.rope.cut.right {
		transform: rotate(28deg) translateY(8px);
		opacity: 0.35;
	}

	.cut-hotspot {
		position: absolute;
		top: 4px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: 4.5rem;
		min-height: 4.5rem;
		padding: 0.45rem;
		background: var(--surface);
		box-shadow: var(--shadow-btn);
		z-index: 5;
	}

	.cut-hotspot:not(:disabled):hover {
		filter: brightness(1.05);
	}

	.cut-hotspot:not(:disabled):active {
		transform: translateX(-50%) translate(2px, 2px);
		box-shadow: var(--shadow-btn-press);
	}

	.cut-hotspot:disabled {
		opacity: 0.4;
	}

	.scissors {
		font-size: 1.5rem;
		line-height: 1;
		color: var(--primary);
	}

	.cut-label {
		font-size: 0.45rem;
		color: var(--text);
		letter-spacing: 0.08em;
	}

	.scroll {
		width: 92%;
		margin-top: -6px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		z-index: 2;
	}

	.roll {
		height: 18px;
		background: linear-gradient(
			180deg,
			#c4a484 0%,
			#8b5a2b 40%,
			#6b4423 100%
		);
		box-shadow:
			0 0 0 3px var(--text),
			inset 0 2px 0 color-mix(in srgb, #fff 25%, transparent);
		z-index: 3;
	}

	.roll.top {
		border-bottom: 0;
	}

	.roll.bottom {
		margin-top: -2px;
		transition: transform 1.1s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.roll.bottom.drop {
		transform: translateY(4px);
	}

	.cloth {
		position: relative;
		overflow: hidden;
		background: #d4c4a8;
		box-shadow:
			0 0 0 3px var(--text),
			6px 6px 0 var(--primary);
		/* Rolled shut: almost no height, then unrolls */
		max-height: 28px;
		transition: max-height 1.1s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.stage.unrolling .cloth {
		max-height: 420px;
	}

	.painting {
		aspect-ratio: 3 / 4;
		width: 100%;
		padding: 0.65rem;
		background:
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 7px,
				color-mix(in srgb, #000 6%, transparent) 7px,
				color-mix(in srgb, #000 6%, transparent) 8px
			),
			#d4c4a8;
	}

	.painting img,
	.mock {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		box-shadow: inset 0 0 0 3px var(--primary);
		min-height: 200px;
	}

	.mock {
		background: linear-gradient(160deg, var(--primary), #1e3a5f);
		min-height: 240px;
	}

	.footer {
		width: min(100%, 42rem);
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		align-items: center;
	}

	.tip {
		font-size: 0.45rem;
		color: var(--ink-soft);
	}

	@media (prefers-reduced-motion: reduce) {
		.rope,
		.cloth,
		.roll.bottom {
			transition: none;
		}

		.stage.unrolling .cloth {
			max-height: 420px;
		}
	}
</style>
