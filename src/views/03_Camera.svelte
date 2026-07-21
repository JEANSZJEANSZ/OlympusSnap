<section
	class="camera-view"
	class:handoff-pending={$frameHandoffBusy}
	class:ritual-busy={ritualOpen}
>
	<div class="sky-wash" aria-hidden="true"></div>
	<div class="stars" aria-hidden="true">
		<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
	</div>
	<div class="mountains mountains-far" aria-hidden="true"></div>
	<div class="mountains mountains-near" aria-hidden="true"></div>

	<main class="stage">
		<aside class="dock-column">
			{#if cameraError}
				<div class="frame-dock offline">
					<p>CAMERA OFFLINE</p>
					<p class="hint">Grant webcam access to begin the ritual.</p>
				</div>
			{:else if frameSrc || !useSlots}
				<div
					class="frame-dock"
					bind:this={dockEl}
					style:--frame-ar={frameAspect}
					data-frame-handoff-target
				>
					{#if useSlots && frameSrc}
						<img class="frame-art" src={frameSrc} alt="" draggable="false" />
						<div class="content-layer">
							{#each slots as slot, i (slot.id)}
								<div
									class="hole"
									class:active={i === slotIndex && !ritualOpen}
									class:done={!!photos[i] && i !== slotIndex}
									data-slot-index={i}
									style:left="{slot.x * 100}%"
									style:top="{slot.y * 100}%"
									style:width="{slot.w * 100}%"
									style:height="{slot.h * 100}%"
								>
									{#if photos[i] && (i !== slotIndex || ritualOpen)}
										<img class="hole-shot" src={photos[i]} alt="" />
									{:else if i === slotIndex && !cameraError && !ritualOpen}
										<canvas class="hole-live-canvas" bind:this={previewCanvas}></canvas>
									{:else}
										<span class="hole-num">{i + 1}</span>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						{#if frameSrc}
							<img class="frame-art" src={frameSrc} alt="" draggable="false" />
						{/if}
						<div class="content-layer">
							<div class="hole active full-bleed" data-slot-index="0">
								{#if photos[0]}
									<img class="hole-shot" src={photos[0]} alt="" />
								{:else if !ritualOpen}
									<canvas class="hole-live-canvas" bind:this={previewCanvas}></canvas>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<video bind:this={videoEl} class="capture-source" playsinline muted autoplay></video>
		</aside>

		<div class="ritual-panel">
			<header class="head">
				<p class="eyebrow">THE MORTAL LENS AWAITS</p>
				<h1>CAMERA TEMPLE</h1>
				<p class="sub">{frameName}</p>
			</header>

			<p class="progress">
				{#if snapTotal > 1}
					SNAP {Math.min(slotIndex + 1, snapTotal)} / {snapTotal}
				{:else}
					SINGLE RELIC CAPTURE
				{/if}
			</p>

			<DialogBox speaker="POSE CHALLENGE" text={poseText} typewriter={false} />

			<div class="actions">
				<PixelButton label="BACK" variant="ghost" disabled={ritualOpen} onclick={goBack} />
				<PixelButton
					label={ritualOpen ? 'RITUAL…' : 'BEGIN RITUAL'}
					variant="accent"
					disabled={ritualOpen || !cameraReady || $frameHandoffBusy}
					onclick={beginRitual}
				/>
				{#if !useSlots}
					<PixelButton
						label="SKIP → STUDIO"
						variant="gold"
						disabled={ritualOpen}
						onclick={skipToStudio}
					/>
				{/if}
			</div>
		</div>

		<FilterGallery
			selectedId={filterPreset}
			disabled={ritualOpen || !cameraReady}
			onSelect={(id) => (filterPreset = id)}
		/>
	</main>

	<CameraSnapOverlay
		open={ritualOpen}
		{ritualKey}
		fromRect={snapFromRect}
		{videoEl}
		{reduced}
		{filterPreset}
		onCaptured={onSnapCaptured}
		onSettled={onSnapSettled}
	/>
</section>

<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		appendCapture,
		capturedImageData,
		capturedPhotos,
		clearCaptures,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { getLiveFrameById } from '../lib/assets/assetStore.js';
	import { frameHandoffBusy } from '../lib/fx/frameHandoff.js';
	import { getActiveHoleRect } from '../lib/fx/cameraLayout.js';
	import { go } from '../router/index.js';
	import { startCamera, stopCamera } from '../lib/utils/camera.js';
	import { compositeFramePhotos } from '../lib/utils/canvasRenderer.js';
	import { initFaceBeauty, disposeFaceBeauty } from '../lib/vision/faceBeauty.js';
	import { startLivePreview, stopLivePreview } from '../lib/vision/livePreview.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import FilterGallery from '../lib/components/FilterGallery.svelte';
	import CameraSnapOverlay from '../lib/components/CameraSnapOverlay.svelte';

	/** @type {HTMLVideoElement | undefined} */
	let videoEl = $state();
	/** @type {HTMLCanvasElement | undefined} */
	let previewCanvas = $state();
	/** @type {HTMLElement | undefined} */
	let dockEl = $state();

	let cameraReady = $state(false);
	let cameraError = $state(false);
	let reduced = $state(false);
	let slotIndex = $state(0);
	/** @type {string[]} */
	let photos = $state([]);
	/** @type {MediaStream | null} */
	let stream = $state(null);

	let ritualOpen = $state(false);
	let ritualKey = $state(0);
	/** @type {DOMRect | null} */
	let snapFromRect = $state(null);
	/** @type {import('../lib/canvas/photoKonva.js').FilterPresetId} */
	let filterPreset = $state('natural');

	let frameNatW = $state(300);
	let frameNatH = $state(400);

	const poses = [
		'Strike a HEROIC Zeus pose — fists to the sky!',
		'Channel Aphrodite: soft smile, shoulders square.',
		'Athena wisdom look — chin up, one eyebrow raised.',
		'Group huddle! Fill the frame like a temple frieze.'
	];
	let sessionPose = $state(poses[0]);

	const frame = $derived(getLiveFrameById($selectedFrameId));
	const slots = $derived(frame?.slots?.length ? frame.slots : []);
	const useSlots = $derived(slots.length > 0);
	const snapTotal = $derived(useSlots ? slots.length : 1);
	const frameSrc = $derived(frame?.src ?? '');
	const frameName = $derived(frame?.name ?? $selectedFrameId ?? 'none');
	const frameAspect = $derived(`${frameNatW} / ${frameNatH}`);

	const poseText = $derived(
		useSlots
			? `Canvas ${slotIndex + 1} of ${snapTotal}. ${poses[slotIndex % poses.length]}`
			: sessionPose
	);

	function loadFrameMetrics(src) {
		if (!src) return;
		const img = new Image();
		img.onload = () => {
			frameNatW = img.naturalWidth || frame?.w || 300;
			frameNatH = img.naturalHeight || frame?.h || 400;
		};
		img.src = src;
	}

	$effect(() => {
		if (frameSrc) loadFrameMetrics(frameSrc);
		else if (frame?.w && frame?.h) {
			frameNatW = frame.w;
			frameNatH = frame.h;
		}
	});

	$effect(() => {
		if (ritualOpen || !cameraReady || !videoEl || !previewCanvas) {
			stopLivePreview();
			return;
		}

		startLivePreview({
			video: videoEl,
			canvas: previewCanvas,
			getPreset: () => filterPreset
		});

		return () => stopLivePreview();
	});

	onMount(() => {
		clearCaptures();
		photos = [];
		slotIndex = 0;
		sessionPose = poses[Math.floor(Math.random() * poses.length)];
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		initFaceBeauty();

		let cancelled = false;
		const timeout = setTimeout(() => {
			if (!cancelled && !cameraReady) cameraError = true;
		}, 2500);

		(async () => {
			if (!videoEl) return;
			const s = await startCamera(videoEl);
			if (cancelled) {
				stopCamera();
				return;
			}
			stream = s;
			cameraReady = !!s;
			cameraError = !s;
		})();

		return () => {
			cancelled = true;
			clearTimeout(timeout);
			stopLivePreview();
			stopCamera();
			disposeFaceBeauty();
			stream = null;
		};
	});

	function goBack() {
		stopLivePreview();
		stopCamera();
		clearCaptures();
		go('frame');
	}

	function skipToStudio() {
		stopLivePreview();
		stopCamera();
		clearCaptures();
		go('studio');
	}

	async function finishSession() {
		stopLivePreview();
		stopCamera();
		const list = get(capturedPhotos);
		const frameId = get(selectedFrameId);
		if (useSlots && list.length) {
			const preview = await compositeFramePhotos(list, frameId, [], { skipStickers: true });
			capturedImageData.set(preview || list[0] || null);
		} else if (list[0]) {
			capturedImageData.set(list[0]);
		}
		go('studio');
	}

	function beginRitual() {
		if (ritualOpen || !cameraReady || $frameHandoffBusy) return;
		const rect = getActiveHoleRect(dockEl, slotIndex);
		if (!rect) return;
		stopLivePreview();
		snapFromRect = rect;
		ritualOpen = true;
		ritualKey += 1;
	}

	/** @param {string} dataUrl */
	function onSnapCaptured(dataUrl) {
		appendCapture(dataUrl);
		const next = [...photos];
		next[slotIndex] = dataUrl;
		photos = next;
	}

	async function onSnapSettled() {
		ritualOpen = false;
		snapFromRect = null;

		if (slotIndex + 1 >= snapTotal) {
			await finishSession();
			return;
		}
		slotIndex += 1;
	}
</script>

<style>
	.camera-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
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
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(240px, 0.85fr) minmax(120px, 168px);
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
	}

	.frame-dock {
		position: relative;
		width: min(34vw, calc(min(72dvh, 640px) * var(--frame-ar)));
		max-height: min(72dvh, 640px);
		aspect-ratio: var(--frame-ar);
		background: transparent;
		filter: drop-shadow(6px 8px 0 color-mix(in srgb, var(--primary) 35%, transparent));
	}

	.frame-dock.offline {
		aspect-ratio: 3 / 4;
		width: min(32vw, 280px);
		display: grid;
		place-content: center;
		gap: 0.65rem;
		padding: 1rem;
		text-align: center;
		font-size: 0.55rem;
		color: var(--ink-soft);
		background: var(--surface);
		box-shadow: var(--shadow-panel);
	}

	.capture-source {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.frame-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		pointer-events: none;
		z-index: 1;
	}

	.content-layer {
		position: absolute;
		inset: 0;
		z-index: 2;
	}

	.hole {
		position: absolute;
		overflow: hidden;
		background: #111;
		box-shadow: inset 0 0 0 1px rgba(255, 217, 120, 0.35);
	}

	.hole.full-bleed {
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.hole.active {
		box-shadow:
			inset 0 0 0 2px var(--gold-bright),
			0 0 0 1px rgba(255, 217, 120, 0.5);
	}

	.hole-live-canvas,
	.hole-shot {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.hole-num {
		display: grid;
		place-items: center;
		height: 100%;
		font-size: 0.7rem;
		color: var(--gold-bright);
		opacity: 0.55;
	}

	.hint {
		font-size: 0.42rem;
		line-height: 1.7;
		opacity: 0.85;
	}

	.ritual-panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 420px;
		width: 100%;
		justify-self: center;
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

	.progress {
		font-size: 0.48rem;
		background: #102f56;
		color: #fff8df;
		display: inline-block;
		padding: 0.35rem 0.55rem;
		width: fit-content;
		box-shadow: 2px 2px 0 #071936;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.camera-view.handoff-pending .frame-art {
		opacity: 0;
	}

	.camera-view.handoff-pending .ritual-panel,
	.camera-view.handoff-pending :global(.filter-rail),
	.camera-view.ritual-busy .ritual-panel,
	.camera-view.ritual-busy :global(.filter-rail) {
		opacity: 0.4;
		transition: opacity 220ms steps(3);
	}

	@media (max-width: 980px) {
		.stage {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto;
			align-items: start;
		}

		.frame-dock {
			width: min(72vw, calc(min(42dvh, 480px) * var(--frame-ar)));
			margin: 0 auto;
		}

		.dock-column {
			justify-content: center;
		}

		.ritual-panel {
			max-width: none;
		}
	}
</style>
