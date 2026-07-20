<!-- Sky-only Olympus — hi-res temple on clouds. Tap anywhere. -->
<div
	class="landing"
	class:reduced
	class:exiting
	role="button"
	tabindex="0"
	aria-label="Enter Mount Olympus photobooth"
	onclick={enterOlympus}
	onkeydown={onKey}
	onpointermove={onPointerMove}
>
	<div class="world" aria-hidden="true">
		<div class="olympus-sky-mount" {@attach attachSkyRoot}></div>
		<canvas class="pixel-canvas hero" {@attach attachHeroCanvas}></canvas>
		<div class="light-veil"></div>
	</div>

	<div class="exit-flash" aria-hidden="true">
		<div class="exit-bolt"></div>
	</div>

	<div class="stage">
		<header class="mast">
			<div class="plaque">
				<p class="kicker">MOUNT OLYMPUS · PIXEL PHOTOBOOTH · CART 01</p>
				<h1 class="title">
					<span class="word olympus">OLYMPUS</span>
					<span class="word snap">SNAP!</span>
				</h1>
				<p class="tagline">Pose for the gods. Crack the marble. Snap the myth. Take it home.</p>
			</div>
			<p class="ascend-hint">
				<span class="pulse">TAP ANYWHERE</span>
				<span class="sub">TO ENTER THE TEMPLE</span>
			</p>
		</header>

		<div class="shrine-spacer" aria-hidden="true"></div>

		<footer class="foot">
			<div class="oracle">
				<DialogBox speaker="PYTHIA" text={oracleLine} />
			</div>
		</footer>
	</div>
</div>

<script>
	import { onMount } from 'svelte';
	import { go } from '../router/index.js';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import { randomPythiaQuote } from '../lib/content/pythiaQuotes.js';
	import { createLandingMotion } from '../lib/fx/landingMotion.js';

	const oracleLine = randomPythiaQuote();

	/** @type {HTMLElement | undefined} */
	let skyRootEl = $state();
	/** @type {HTMLCanvasElement | undefined} */
	let heroCanvasEl = $state();
	let reduced = $state(false);
	let exiting = $state(false);

	/** @type {import('svelte/attachments').Attachment<HTMLElement>} */
	const attachSkyRoot = (element) => {
		skyRootEl = element;
		return () => {
			if (skyRootEl === element) skyRootEl = undefined;
		};
	};

	/** @type {import('svelte/attachments').Attachment<HTMLCanvasElement>} */
	const attachHeroCanvas = (element) => {
		heroCanvasEl = element;
		return () => {
			if (heroCanvasEl === element) heroCanvasEl = undefined;
		};
	};

	/** @type {null | { setDay: (d: number, immediate?: boolean) => void, nudgeDay: (d: number) => void, setPointer: (x: number, y: number) => void, dispose: () => void }} */
	let world = null;
	/** @type {null | { playExit: (onDone: () => void) => void, dispose: () => void }} */
	let uiMotion = null;

	function enterOlympus() {
		if (exiting) return;
		exiting = true;
		const finish = () => go('frame');
		if (uiMotion) uiMotion.playExit(finish);
		else finish();
	}

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			enterOlympus();
		}
	}

	/** @param {PointerEvent} e */
	function onPointerMove(e) {
		if (reduced) return;
		const r = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
		world?.setPointer((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const el = /** @type {HTMLElement | null} */ (document.querySelector('.landing'));
		let disposed = false;

		if (el) uiMotion = createLandingMotion(el, { reduced });

		/** @param {WheelEvent} e */
		const onWheel = (e) => {
			if (reduced || !world) return;
			e.preventDefault();
			world.nudgeDay(e.deltaY * 0.00035);
		};

		const boot = () => {
			if (disposed || !skyRootEl || !heroCanvasEl) return;
			import('../lib/fx/pixelOlympus.js').then(({ createPixelOlympus }) => {
				if (disposed || !skyRootEl || !heroCanvasEl) return;
				world?.dispose();
				world = createPixelOlympus(skyRootEl, heroCanvasEl, { reduced });
				world.setDay(0.35, true);
			});
		};

		requestAnimationFrame(boot);
		el?.addEventListener('wheel', onWheel, { passive: false });

		return () => {
			disposed = true;
			el?.removeEventListener('wheel', onWheel);
			world?.dispose();
			world = null;
			uiMotion?.dispose();
			uiMotion = null;
		};
	});
</script>

<style>
	.landing {
		--ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
		--ease-back: cubic-bezier(0.34, 1.56, 0.64, 1);
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
		overflow: hidden;
		cursor: pointer;
		color: var(--bg-base);
		outline: none;
		background: #071428;
	}

	.landing:focus-visible {
		box-shadow: inset 0 0 0 3px var(--gold-bright);
	}

	.world {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		transform-origin: 50% 58%;
		will-change: transform, filter;
	}

	.pixel-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		image-rendering: pixelated;
		image-rendering: crisp-edges;
	}

	.olympus-sky-mount {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.pixel-canvas.hero {
		z-index: 1;
	}

	:global(.landing.fx-anime) .pixel-canvas.hero,
	:global(.landing.fx-anime) .plaque,
	:global(.landing.fx-anime) .word,
	:global(.landing.fx-anime) .tagline,
	:global(.landing.fx-anime) .ascend-hint,
	:global(.landing.fx-anime) .oracle {
		opacity: 0;
		animation: none;
	}

	/*
	 * Soft floor wash only — a top radial + soft-light blend was painting a
	 * visible rectangular plate over the sun/moon (the "ugly aura box").
	 */
	.light-veil {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		opacity: 0.5;
		background: radial-gradient(
			ellipse 90% 42% at 50% 110%,
			color-mix(in srgb, #1a4a72 38%, transparent),
			transparent 72%
		);
		mix-blend-mode: multiply;
	}

	.exit-flash {
		position: absolute;
		inset: 0;
		z-index: 8;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		pointer-events: none;
		opacity: 0;
		background: #fffdf5;
		will-change: opacity;
	}

	.exit-bolt {
		width: clamp(2rem, 5vw, 4rem);
		height: clamp(18rem, 72vh, 46rem);
		opacity: 0;
		background: linear-gradient(180deg, #ffffff 0 38%, var(--gold-bright) 100%);
		clip-path: polygon(
			56% 0,
			96% 0,
			68% 31%,
			91% 31%,
			43% 65%,
			64% 65%,
			8% 100%,
			31% 56%,
			11% 56%,
			47% 25%,
			27% 25%
		);
		transform-origin: center;
		will-change: transform, opacity;
	}

	.landing:not(.fx-anime):not(.reduced) .light-veil {
		animation: veil-breathe 8s ease-in-out infinite;
	}

	.stage {
		position: relative;
		z-index: 4;
		height: 100%;
		display: grid;
		grid-template-rows: auto 1fr auto;
		padding: clamp(0.55rem, 2vh, 1rem) 1rem 0.55rem;
		pointer-events: none;
		text-align: center;
	}

	.landing.exiting .stage {
		pointer-events: none;
	}

	.mast {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
	}

	/* High-contrast brand plaque */
	.plaque {
		position: relative;
		width: min(100%, 26rem);
		padding: clamp(0.55rem, 1.8vh, 0.9rem) clamp(0.8rem, 2.5vw, 1.2rem);
		background: color-mix(in srgb, #0a1c32 90%, #1a3048);
		border: 3px solid #d2c1a5;
		box-shadow:
			0 0 0 3px #081424,
			5px 5px 0 #143a5c;
		overflow: hidden;
	}

	.landing:not(.fx-anime):not(.reduced) .plaque {
		animation: plaque-stamp 0.85s var(--ease-back) both;
	}

	.plaque::before {
		content: '';
		position: absolute;
		inset: -40% -60%;
		background: linear-gradient(
			115deg,
			transparent 40%,
			color-mix(in srgb, #e8dfd0 50%, transparent) 48%,
			color-mix(in srgb, #fff8ec 70%, transparent) 50%,
			color-mix(in srgb, #d2c1a5 40%, transparent) 52%,
			transparent 60%
		);
		transform: translateX(-30%) rotate(8deg);
		pointer-events: none;
		opacity: 0;
	}

	.landing:not(.reduced) .plaque::before {
		animation: gold-sweep 3.6s var(--ease-expo) 1.1s infinite;
	}

	.plaque::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 1px solid color-mix(in srgb, #d2c1a5 50%, transparent);
		pointer-events: none;
	}

	.landing:not(.reduced) .plaque::after {
		animation: border-glow 2.8s ease-in-out infinite;
	}

	.shrine-spacer {
		min-height: 0;
	}

	.foot {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-bottom: 0.2rem;
	}

	.oracle {
		width: min(100%, 26rem);
	}

	.landing:not(.fx-anime):not(.reduced) .oracle {
		animation: oracle-rise 1s var(--ease-expo) 0.55s both;
	}

	.oracle :global(.dialog) {
		padding: 0.85rem 1rem 0.75rem;
	}

	.oracle :global(.body) {
		font-size: clamp(0.48rem, 1.2vw, 0.58rem);
		min-height: 2.4em;
	}

	.kicker {
		font-family: var(--font-pixel);
		font-size: clamp(0.36rem, 1vw, 0.48rem);
		letter-spacing: 0.14em;
		color: #d2c1a5;
		margin-bottom: 0.45rem;
	}

	.landing:not(.fx-anime):not(.reduced) .kicker {
		animation: kicker-in 0.7s var(--ease-expo) 0.15s both;
	}

	.title {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.05rem;
		line-height: 0.92;
		text-wrap: balance;
	}

	.word {
		display: block;
		font-family: var(--font-greek);
		font-size: clamp(1.85rem, 9vw, 3.6rem);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.landing:not(.fx-anime):not(.reduced) .word {
		opacity: 0;
		animation: word-slam 0.75s var(--ease-back) both;
	}

	.olympus {
		color: #ffffff;
		text-shadow:
			4px 4px 0 #081424,
			-2px 0 0 #c8d8e8,
			0 0 0 1px #081424;
	}

	.landing:not(.fx-anime):not(.reduced) .olympus {
		animation-delay: 0.28s;
	}

	.snap {
		color: #e0d0b4;
		text-shadow:
			4px 4px 0 #081424,
			-1px 0 0 #f5f1e6;
	}

	.landing:not(.fx-anime):not(.reduced) .snap {
		animation-delay: 0.42s;
		animation-name: word-slam-gold;
	}

	.tagline {
		max-width: 24rem;
		margin: 0.55rem auto 0;
		font-family: var(--font-pixel);
		font-size: clamp(0.4rem, 1.1vw, 0.5rem);
		line-height: 1.85;
		color: color-mix(in srgb, #f0ebe0 80%, #d2c1a5);
	}

	.landing:not(.fx-anime):not(.reduced) .tagline {
		animation: fade-up 0.8s var(--ease-expo) 0.55s both;
	}

	.ascend-hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.45rem 0.9rem;
		background: color-mix(in srgb, #143a5c 90%, transparent);
		border: 2px solid #d2c1a5;
		box-shadow: 3px 3px 0 #081424;
	}

	.landing:not(.fx-anime):not(.reduced) .ascend-hint {
		animation: hint-pop 0.7s var(--ease-back) 0.7s both;
	}

	.pulse {
		font-family: var(--font-greek);
		font-size: clamp(0.9rem, 2.4vw, 1.2rem);
		color: #e8dfd0;
		letter-spacing: 0.08em;
		text-shadow:
			2px 2px 0 #081424,
			0 0 18px color-mix(in srgb, #d2c1a5 40%, transparent);
	}

	.landing:not(.fx-anime):not(.reduced) .pulse {
		animation: pulse-hint 1.6s steps(2, end) infinite;
	}

	.sub {
		font-family: var(--font-pixel);
		font-size: 0.38rem;
		letter-spacing: 0.14em;
		color: var(--bg-base);
		text-shadow: 1px 1px 0 var(--text);
	}

	@keyframes plaque-stamp {
		0% {
			opacity: 0;
			transform: translateY(-1.4rem) scale(0.86) rotate(-1.5deg);
		}
		70% {
			opacity: 1;
			transform: translateY(0.12rem) scale(1.03) rotate(0.4deg);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1) rotate(0);
		}
	}

	@keyframes gold-sweep {
		0%,
		55% {
			transform: translateX(-45%) rotate(8deg);
			opacity: 0;
		}
		62% {
			opacity: 0.85;
		}
		78% {
			transform: translateX(45%) rotate(8deg);
			opacity: 0;
		}
		100% {
			transform: translateX(45%) rotate(8deg);
			opacity: 0;
		}
	}

	@keyframes border-glow {
		0%,
		100% {
			box-shadow: inset 0 0 0 0 transparent;
		}
		50% {
			box-shadow: inset 0 0 22px color-mix(in srgb, var(--gold-bright) 18%, transparent);
		}
	}

	@keyframes word-slam {
		0% {
			opacity: 0;
			transform: translateY(1.1rem) scale(0.92) skewX(-6deg);
			filter: blur(2px);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1) skewX(0);
			filter: blur(0);
		}
	}

	@keyframes word-slam-gold {
		0% {
			opacity: 0;
			transform: translateY(1.1rem) scale(0.92) skewX(6deg);
			filter: blur(2px);
		}
		60% {
			text-shadow:
				4px 4px 0 var(--text),
				-1px 0 0 #fff,
				0 0 28px color-mix(in srgb, var(--gold-bright) 70%, transparent);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1) skewX(0);
			filter: blur(0);
			text-shadow:
				4px 4px 0 var(--text),
				-1px 0 0 #fff;
		}
	}

	@keyframes kicker-in {
		from {
			opacity: 0;
			letter-spacing: 0.4em;
			transform: translateY(-0.4rem);
		}
		to {
			opacity: 1;
			letter-spacing: 0.14em;
			transform: translateY(0);
		}
	}

	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes hint-pop {
		0% {
			opacity: 0;
			transform: translateY(0.8rem) scale(0.9);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes pulse-hint {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.45;
			transform: scale(0.98);
		}
	}

	@keyframes oracle-rise {
		from {
			opacity: 0;
			transform: translateY(1.25rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes hero-settle {
		from {
			opacity: 0;
			transform: translateY(2.5%) scale(1.04);
			filter: brightness(1.15);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
			filter: brightness(1);
		}
	}

	@keyframes veil-breathe {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 0.9;
		}
	}

	.landing.reduced .plaque,
	.landing.reduced .word,
	.landing.reduced .kicker,
	.landing.reduced .tagline,
	.landing.reduced .ascend-hint,
	.landing.reduced .oracle,
	.landing.reduced .pixel-canvas.hero,
	.landing.reduced .light-veil {
		animation: none;
		opacity: 1;
		transform: none;
		filter: none;
	}

	.landing.reduced .plaque::before,
	.landing.reduced .plaque::after {
		animation: none;
		opacity: 0;
	}

	.landing.reduced .pulse {
		animation: none;
		opacity: 1;
		text-shadow: 2px 2px 0 var(--text);
	}

	@media (max-width: 640px) {
		.word {
			font-size: clamp(1.6rem, 12vw, 2.6rem);
		}

		.plaque {
			width: min(100%, 22rem);
		}
	}

	@media (max-height: 640px) {
		.tagline {
			display: none;
		}

		.word {
			font-size: clamp(1.45rem, 7vw, 2.4rem);
		}

		.plaque {
			padding: 0.55rem 0.85rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.plaque,
		.word,
		.kicker,
		.tagline,
		.ascend-hint,
		.oracle,
		.pixel-canvas.hero,
		.light-veil,
		.pulse,
		.plaque::before,
		.plaque::after {
			animation: none !important;
		}
	}
</style>
