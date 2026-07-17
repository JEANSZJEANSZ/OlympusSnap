<script>
	import { onMount } from 'svelte';
	import { selectedFrameId } from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import { frames } from '../lib/assets/assetStore.js';
	import { createFrameSelectMotion } from '../lib/fx/frameSelectMotion.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';

	let index = $state(0);
	let imgFailed = $state(false);
	let reduced = $state(false);
	let exiting = $state(false);
	let rootEl;
	let motion;
	const list = $derived($frames);
	const frame = $derived(list[Math.min(index, Math.max(0, list.length - 1))]);

	function attachRoot(node) {
		rootEl = node;

		return () => {
			if (rootEl === node) rootEl = undefined;
		};
	}

	onMount(() => {
		const unsubscribeFrames = frames.subscribe((items) => {
			if (index >= items.length && items.length > 0) index = items.length - 1;
			imgFailed = false;
		});

		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (rootEl) motion = createFrameSelectMotion(rootEl, { reduced });

		return () => {
			unsubscribeFrames();
			motion?.dispose();
			motion = undefined;
		};
	});

	function selectFrame(target, direction) {
		if (exiting || !list.length) return;

		const nextIndex = ((target % list.length) + list.length) % list.length;
		if (nextIndex === index) return;

		index = nextIndex;
		imgFailed = false;
		motion?.playSwap(direction);
	}

	function prev() {
		selectFrame(index - 1, -1);
	}

	function next() {
		selectFrame(index + 1, 1);
	}

	function selectDot(target) {
		selectFrame(target, target < index ? -1 : 1);
	}

	function back() {
		if (!exiting) go('landing');
	}

	function confirmFrame() {
		if (exiting || !frame) return;

		selectedFrameId.set(frame.id);
		exiting = true;

		if (motion) {
			motion.playConfirm(() => go('camera'));
		} else {
			go('camera');
		}
	}
</script>

<section class="frame-view" class:exiting {@attach attachRoot}>
	<div class="sky-wash" aria-hidden="true"></div>
	<div class="stars" aria-hidden="true">
		<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
	</div>
	<div class="mountains mountains-far" aria-hidden="true"></div>
	<div class="mountains mountains-near" aria-hidden="true"></div>

	<header class="head">
		<p class="eyebrow">THE OLYMPIAN COURIER AWAITS</p>
		<h1>CHOOSE THY FRAME</h1>
		<div class="headline">
			<p>Choose the relic our winged herald shall carry to the mortal lens.</p>
			<span class="relic-count">{list.length} {list.length === 1 ? 'RELIC' : 'RELICS'}</span>
		</div>
	</header>

	<main class="carousel" aria-label="Frame selection">
		<button class="nav nav-prev" type="button" onclick={prev} aria-label="Previous frame">
			<span aria-hidden="true">‹</span>
		</button>

		<div class="flight-stage">
			<div class="bird-rig" aria-hidden="true">
				<svg class="bird" viewBox="0 0 180 82" shape-rendering="crispEdges">
					<g class="wing wing-left">
						<path fill="#3c241c" d="M82 35H66V29H51V23H31V17H8V25H18V33H29V41H43V49H65V45H82Z" />
						<path fill="#704128" d="M72 37H55V31H39V25H19V31H31V38H44V45H65V42H72Z" />
						<path fill="#b47731" d="M65 39H49V34H35V30H27V36H41V42H57V46H70Z" />
						<path fill="#e0a642" d="M58 40H45V36H38V40H49V45H62Z" />
					</g>
					<g class="wing wing-right">
						<path fill="#3c241c" d="M98 35H114V29H129V23H149V17H172V25H162V33H151V41H137V49H115V45H98Z" />
						<path fill="#704128" d="M108 37H125V31H141V25H161V31H149V38H136V45H115V42H108Z" />
						<path fill="#b47731" d="M115 39H131V34H145V30H153V36H139V42H123V46H110Z" />
						<path fill="#e0a642" d="M122 40H135V36H142V40H131V45H118Z" />
					</g>
					<path fill="#2d1a18" d="M73 35H107V59H101V68H79V59H73Z" />
					<path fill="#78472a" d="M80 33H102V57H97V64H83V57H78V40H80Z" />
					<path fill="#b77934" d="M84 42H98V61H94V67H86V61H82V48H84Z" />
					<path fill="#f2ead5" d="M96 28H113V34H121V48H113V53H99V48H94V34H96Z" />
					<path fill="#d5c9ae" d="M99 44H114V49H108V54H99Z" />
					<rect x="108" y="34" width="4" height="4" fill="#101729" />
					<path fill="#d99a2b" d="M119 39H135V44H128V49H116V44H119Z" />
					<path fill="#4b2b20" d="M78 60H84V74H75V70H68V66H78ZM96 60H102V66H112V70H105V74H96Z" />
					<path fill="#d99a2b" d="M76 66H81V75H76V78H72V74H68V71H76ZM99 66H104V71H112V74H108V78H104V75H99Z" />
					<path fill="#e2b553" d="M84 53H96V58H100V62H80V58H84Z" />
					<path fill="#2d1a18" d="M83 68H88V79H83ZM92 68H97V79H92Z" />
					<path fill="#f0cf6a" d="M81 76H90V81H81ZM90 76H99V81H90Z" />
				</svg>
			</div>

			<svg class="rope-physics" width="100%" height="100%" aria-hidden="true">
				<polyline class="rope-line" points="300,58 300,86 300,116"></polyline>
			</svg>

			<div class="snap-spark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

			<div class="hang-group">
				<div class="frame-body" data-motif={frame?.id ?? 'none'}>
					<div class="photo-window">
						<div class="portrait-silhouette" aria-hidden="true">
							<span class="portrait-head"></span>
							<span class="portrait-body"></span>
						</div>
					</div>
					{#if frame && !imgFailed}
						<img
							class="frame-overlay"
							src={frame.src}
							alt=""
							onerror={() => (imgFailed = true)}
						/>
					{/if}
				</div>
			</div>
		</div>

		<button class="nav nav-next" type="button" onclick={next} aria-label="Next frame">
			<span aria-hidden="true">›</span>
		</button>
	</main>

	<div class="dots" aria-label="Choose a frame">
		{#each list as f, i (f.id)}
			<button
				type="button"
				class="dot"
				class:active={i === index}
				aria-label={`Select ${f.name}`}
				aria-pressed={i === index}
				onclick={() => selectDot(i)}
			><span>{i + 1}</span></button>
		{/each}
	</div>

	<footer class="footer">
		<DialogBox
			speaker="HEPHAESTUS"
			text={frame
				? `${frame.name} is secured beneath the courier. Arm the camera to send it skyward.`
				: 'The courier bears no relic. Open Admin to add a frame.'}
			typewriter={false}
		/>
		<div class="actions">
			<PixelButton label="BACK" variant="ghost" onclick={back} />
			<PixelButton
				label="ARM CAMERA"
				variant="primary"
				disabled={!frame || exiting}
				onclick={confirmFrame}
			/>
		</div>
	</footer>
</section>

<style>
	.frame-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto;
		gap: clamp(0.25rem, 1.2vh, 0.65rem);
		padding: clamp(0.55rem, 1.8vh, 1rem) clamp(0.75rem, 3vw, 2rem);
		align-items: center;
		color: #fff8df;
		background: var(--sky-top);
	}

	.frame-view.exiting {
		pointer-events: none;
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
		bottom: 6%;
		opacity: 0.78;
		background: #31577a;
	}

	.mountains-near {
		z-index: -1;
		height: 35%;
		clip-path: polygon(0 62%, 13% 37%, 24% 71%, 39% 27%, 52% 65%, 67% 38%, 81% 74%, 93% 40%, 100% 58%, 100% 100%, 0 100%);
	}

	.head {
		width: min(100%, 760px);
		margin: 0 auto;
		text-align: center;
		text-shadow: 2px 2px 0 #06152d;
	}

	.head h1 {
		margin: 0.1rem 0 0.2rem;
		font-size: clamp(1rem, 3.4vw, 1.75rem);
		line-height: 1;
		letter-spacing: 0.12em;
		color: #ffd978;
		text-wrap: balance;
	}

	.eyebrow {
		margin: 0;
		font-size: clamp(0.36rem, 1vw, 0.48rem);
		letter-spacing: 0.22em;
		color: #f3d9bb;
	}

	.headline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
	}

	.headline p {
		margin: 0;
		font-size: clamp(0.43rem, 1.2vw, 0.57rem);
		color: #f8eee1;
	}

	.relic-count {
		border-left: 2px solid #d29a43;
		padding-left: 0.65rem;
		font-size: 0.42rem;
		letter-spacing: 0.12em;
		color: #ffd978;
		white-space: nowrap;
	}

	.carousel {
		display: grid;
		grid-template-columns: minmax(44px, 3.25rem) minmax(0, 1fr) minmax(44px, 3.25rem);
		gap: clamp(0.35rem, 2vw, 1rem);
		align-items: center;
		justify-self: center;
		max-width: 780px;
		width: 100%;
		margin: 0 auto;
		height: 100%;
		min-height: 0;
	}

	.nav {
		position: relative;
		z-index: 3;
		width: clamp(44px, 5vw, 3.25rem);
		height: clamp(44px, 5vw, 3.25rem);
		border: 3px solid #f2d89e;
		background: #8e2f36;
		box-shadow: 4px 4px 0 #07152d, inset 0 0 0 2px #c86c52;
		font: inherit;
		font-size: clamp(1.7rem, 4vw, 2.4rem);
		line-height: 1;
		color: #fff4cf;
		cursor: pointer;
	}

	.nav span {
		position: relative;
		top: -0.12em;
	}

	.nav:active {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 #07152d, inset 0 0 0 2px #c86c52;
	}

	.nav:focus-visible,
	.dot:focus-visible {
		outline: 3px solid #fff8df;
		outline-offset: 3px;
	}

	.flight-stage {
		position: relative;
		width: 100%;
		height: 100%;
		max-height: min(54dvh, 340px);
		min-height: 220px;
		margin: 0 auto;
		overflow: visible;
	}

	.bird-rig,
	.hang-group,
	.snap-spark {
		position: absolute;
		left: 50%;
	}

	.bird-rig {
		z-index: 3;
		top: 0;
		width: clamp(150px, 20vw, 180px);
		translate: -50% 0;
		transform-origin: center 35%;
	}

	.bird {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		filter: drop-shadow(3px 4px 0 rgba(4, 14, 31, 0.65));
	}

	.bird .wing {
		transform-box: fill-box;
	}

	.bird .wing-left {
		transform-origin: right center;
	}

	.bird .wing-right {
		transform-origin: left center;
	}

	.rope-physics {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.rope-line {
		fill: none;
		stroke: #c08a43;
		stroke-width: 4;
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: drop-shadow(2px 1px 0 #3a241d);
		vector-effect: non-scaling-stroke;
	}

	.snap-spark {
		z-index: 5;
		top: clamp(66px, 10vh, 78px);
		width: 24px;
		height: 24px;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.snap-spark i {
		position: absolute;
		top: 10px;
		left: 1px;
		width: 22px;
		height: 3px;
		background: #ffe887;
		opacity: 0;
	}

	.snap-spark i:nth-child(2) { transform: rotate(45deg); }
	.snap-spark i:nth-child(3) { transform: rotate(90deg); }
	.snap-spark i:nth-child(4) { transform: rotate(135deg); }

	.hang-group {
		z-index: 2;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		translate: -50% 90px;
		transform-origin: center;
		will-change: transform;
	}

	.frame-body {
		position: relative;
		width: clamp(145px, 24vh, 205px);
		aspect-ratio: 3 / 4;
		background: transparent;
		filter: drop-shadow(5px 7px 3px rgba(3, 12, 27, 0.55));
	}

	.photo-window {
		position: absolute;
		inset: 9% 11% 10%;
		z-index: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		background:
			linear-gradient(180deg, rgba(255, 240, 203, 0.18), transparent 44%),
			linear-gradient(180deg, #7690a1 0 54%, #5a4950 55%);
	}

	.portrait-silhouette {
		position: relative;
		width: 72%;
		height: 78%;
		margin-top: 22%;
	}

	.portrait-head {
		position: absolute;
		top: 5%;
		left: 50%;
		width: 36%;
		aspect-ratio: 1;
		transform: translateX(-50%);
		background: #343b4b;
		box-shadow: 3px 0 #24283a, -3px 0 #24283a;
	}

	.portrait-body {
		position: absolute;
		right: 4%;
		bottom: -8%;
		left: 4%;
		height: 54%;
		background: #343b4b;
		clip-path: polygon(18% 0, 82% 0, 100% 100%, 0 100%);
	}

	.frame-overlay {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}

	.dots {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.2rem;
		min-height: 44px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.dot {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.dot span {
		display: grid;
		place-items: center;
		width: 12px;
		height: 12px;
		border: 2px solid #f1d29a;
		background: #274f73;
		color: transparent;
		box-shadow: 2px 2px 0 #07152d;
	}

	.dot.active span {
		background: #b84a43;
		box-shadow: 0 0 0 2px #ffd978, 2px 2px 0 2px #07152d;
	}

	.footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: clamp(0.45rem, 1.6vw, 0.9rem);
		align-items: center;
		max-width: 800px;
		width: 100%;
		margin: 0 auto;
	}

	.actions {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 640px) {
		.frame-view {
			grid-template-rows: auto minmax(0, 1fr) auto auto;
		}

		.headline p {
			max-width: 32rem;
		}

		.relic-count {
			display: none;
		}

		.carousel {
			grid-template-columns: 44px minmax(0, 1fr) 44px;
			gap: 0.25rem;
		}

		.frame-body {
			width: clamp(135px, 34vw, 175px);
		}

		.footer {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}
	}

	@media (max-height: 580px) {
		.frame-view {
			padding-top: 0.4rem;
			padding-bottom: 0.4rem;
			gap: 0.18rem;
		}

		.flight-stage {
			max-height: 270px;
			min-height: 220px;
		}

		.bird-rig {
			scale: 0.86;
			transform-origin: top center;
		}

		.hang-group {
			translate: -50% 82px;
		}

		.frame-body {
			width: clamp(135px, 28vh, 165px);
		}

		.dots {
			min-height: 34px;
		}

		.dot {
			height: 34px;
		}
	}

	@media (max-height: 430px) {
		.eyebrow,
		.headline {
			display: none;
		}

		.footer {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.frame-view *,
		.frame-view *::before,
		.frame-view *::after {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
