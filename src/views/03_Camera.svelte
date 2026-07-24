<section
	bind:this={rootEl}
	class="camera-view booth-view"
	class:handoff-pending={$frameHandoffBusy || $imageHandoffBusy}
	class:ritual-busy={ritualOpen}
	class:review-open={reviewOpen}
	class:exiting
>
	<div class="sky-wash" aria-hidden="true"></div>
	<div class="stars" aria-hidden="true">
		<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
	</div>
	<div class="mountains mountains-far" aria-hidden="true"></div>
	<div class="mountains mountains-near" aria-hidden="true"></div>

	<main class="stage">
		<aside class="dock-column">
			{#if frameLoading}
				<div class="frame-dock loading">
					<p>LOADING FRAME…</p>
					<p class="hint">Restoring your chosen relic from the vault.</p>
				</div>
			{:else if cameraStatus === 'offline'}
				<div class="frame-dock offline">
					<p>CAMERA OFFLINE</p>
					<p class="hint">Grant webcam access or check your external camera connection.</p>
					<PixelButton label="RETRY" variant="gold" onclick={retryCamera} />
				</div>
			{:else if frameSrc || !useSlots}
				<div
					class="frame-dock"
					class:connecting={cameraStatus === 'connecting'}
					bind:this={dockEl}
					style:--frame-ar={frameAspect}
					data-frame-handoff-target
					data-camera-handoff-target
				>
					{#if useSlots && frameSrc}
						<img class="frame-art" src={frameSrc} alt="" draggable="false" />
						<div class="content-layer">
							{#each slots as slot, i (slot.id)}
								<div
									class="hole"
									class:active={liveSlot >= 0 ? i === liveSlot : i === slotIndex}
									class:done={!!photos[i] && i !== slotIndex && i !== liveSlot}
									data-slot-index={i}
									style:left="{slot.x * 100}%"
									style:top="{slot.y * 100}%"
									style:width="{slot.w * 100}%"
									style:height="{slot.h * 100}%"
								>
									{#if i === liveSlot && cameraReady && !ritualOpen}
										<canvas class="hole-live-canvas" bind:this={previewCanvas}></canvas>
									{:else if photos[i]}
										<img class="hole-shot" src={photos[i]} alt="" />
									{:else if cameraStatus === 'connecting'}
										<span class="hole-num connecting">…</span>
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
							<div
								class="hole active full-bleed"
								data-slot-index="0"
							>
								{#if liveSlot === 0 && cameraReady && !ritualOpen}
									<canvas class="hole-live-canvas" bind:this={previewCanvas}></canvas>
								{:else if photos[0]}
									<img class="hole-shot" src={photos[0]} alt="" />
								{:else if cameraStatus === 'connecting'}
									<span class="hole-num connecting">…</span>
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

			<DialogBox
				speaker={reviewOpen ? 'REVIEW' : 'POSE CHALLENGE'}
				text={reviewOpen ? reviewText : poseText}
				typewriter={false}
			/>

			<div class="actions">
				{#if reviewOpen}
					<PixelButton label="RETAKE" variant="ghost" disabled={exiting || ritualOpen} onclick={retakeShot} />
					{#if isLastCanvas}
						<PixelButton
							label="STUDIO"
							variant="gold"
							disabled={exiting || ritualOpen}
							onclick={goStudioFromReview}
						/>
					{:else}
						<RitualShutterButton
							busy={ritualOpen}
							disabled={ritualOpen || !cameraReady || $frameHandoffBusy || $imageHandoffBusy || exiting}
							onclick={snapNextFromReview}
						/>
					{/if}
				{:else}
					<PixelButton
						label="BACK"
						variant="ghost"
						disabled={ritualOpen || exiting}
						onclick={goBack}
					/>
					<RitualShutterButton
						busy={ritualOpen}
						disabled={ritualOpen || !cameraReady || $frameHandoffBusy || $imageHandoffBusy || exiting}
						onclick={beginRitual}
					/>
					{#if !useSlots}
						<PixelButton
							label="SKIP → STUDIO"
							variant="gold"
							disabled={ritualOpen || exiting}
							onclick={skipToStudio}
						/>
					{/if}
				{/if}
			</div>
		</div>

		<FilterGallery
			selectedId={filterPreset}
			disabled={ritualOpen || reviewOpen || !cameraReady || exiting}
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
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import {
		setCaptureAt,
		capturedImageData,
		capturedPhotos,
		clearCaptures,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { getLiveFrameById, assetsReady } from '../lib/assets/assetStore.js';
	import { beginImageHandoff, imageHandoffBusy } from '../lib/fx/imageHandoff.js';
	import { playViewExit } from '../lib/fx/viewExitMotion.js';
	import {
		getActiveHoleRect,
		getFrameDockRect
	} from '../lib/fx/cameraLayout.js';
	import { go } from '../router/index.js';
	import { startCamera, stopCamera } from '../lib/utils/camera.js';
	import { compositeFramePhotos } from '../lib/utils/canvasRenderer.js';
	import { startLivePreview, stopLivePreview } from '../lib/vision/livePreview.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import FilterGallery from '../lib/components/FilterGallery.svelte';
	import CameraSnapOverlay from '../lib/components/CameraSnapOverlay.svelte';
	import RitualShutterButton from '../lib/components/RitualShutterButton.svelte';
	import { frameHandoffBusy } from '../lib/fx/frameHandoff.js';

	/** @type {HTMLElement | undefined} */
	let rootEl = $state();
	/** @type {HTMLVideoElement | undefined} */
	let videoEl = $state();
	/** @type {HTMLCanvasElement | undefined} */
	let previewCanvas = $state();
	/** @type {HTMLElement | undefined} */
	let dockEl = $state();

	let cameraReady = $state(false);
	/** @type {'connecting' | 'ready' | 'offline'} */
	let cameraStatus = $state('connecting');
	let reduced = $state(false);
	let exiting = $state(false);
	let reviewOpen = $state(false);
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
	const frameLoading = $derived(!!$selectedFrameId && !$assetsReady);
	const frameMissing = $derived(
		$assetsReady && !!$selectedFrameId && !frame
	);
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

	const isLastCanvas = $derived(slotIndex + 1 >= snapTotal);

	/** Hole that should show the live camera — current slot, or the next one while reviewing. */
	const liveSlot = $derived.by(() => {
		if (ritualOpen) return -1;
		if (reviewOpen) return isLastCanvas ? -1 : slotIndex + 1;
		return slotIndex;
	});

	const reviewText = $derived(
		isLastCanvas
			? 'Last canvas locked. RETAKE for another shot, or head to STUDIO.'
			: `Canvas ${slotIndex + 1} of ${snapTotal} locked. SNAP starts the next canvas ritual, or RETAKE this one.`
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
		if (!$selectedFrameId) {
			go('frame');
			return;
		}
		if (frameMissing) {
			console.warn('[camera] selected frame missing after assets load', $selectedFrameId);
			go('frame');
		}
	});

	/** @type {(() => void) | undefined} */
	let stopCameraInit = $state();

	async function initCamera() {
		stopCameraInit?.();
		let cancelled = false;
		stopCameraInit = () => {
			cancelled = true;
		};

		cameraStatus = 'connecting';
		cameraReady = false;

		if (!videoEl) return;
		const s = await startCamera(videoEl);
		if (cancelled) {
			stopCamera();
			return;
		}

		stream = s;
		cameraReady = !!s;
		cameraStatus = s ? 'ready' : 'offline';
	}

	function retryCamera() {
		initCamera();
	}

	$effect(() => {
		if (ritualOpen || liveSlot < 0 || !cameraReady || !videoEl || !previewCanvas) {
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
		if (!$selectedFrameId) {
			go('frame');
			return;
		}

		clearCaptures();
		photos = [];
		slotIndex = 0;
		reviewOpen = false;
		sessionPose = poses[Math.floor(Math.random() * poses.length)];
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		(async () => {
			await tick();
			initCamera();
		})();

		return () => {
			stopCameraInit?.();
			stopLivePreview();
			stopCamera();
			stream = null;
		};
	});

	async function goBack() {
		if (exiting || ritualOpen || reviewOpen) return;
		exiting = true;
		stopLivePreview();
		stopCamera();
		clearCaptures();

		const fromEl = dockEl;
		if (fromEl && frameSrc) {
			beginImageHandoff({
				src: frameSrc,
				fromEl,
				targetSel: '[data-frame-select-handoff-target]',
				reduced
			});
			go('frame');
			return;
		}

		await playViewExit(rootEl, { reduced, direction: 'right' });
		go('frame');
	}

	async function skipToStudio() {
		if (exiting || ritualOpen || reviewOpen) return;
		stopLivePreview();
		stopCamera();
		clearCaptures();
		await playViewExit(rootEl, { reduced, direction: 'left' });
		go('studio');
	}

	async function finishSession() {
		if (exiting) return;
		exiting = true;
		reviewOpen = false;
		stopLivePreview();
		stopCamera();
		const list = get(capturedPhotos);
		const frameId = get(selectedFrameId);
		let preview = list[0] || null;
		if (useSlots && list.length) {
			preview =
				(await compositeFramePhotos(list, frameId, [], { skipStickers: true })) ||
				list[0] ||
				null;
		}
		if (preview) capturedImageData.set(preview);

		const fromEl = dockEl;
		if (fromEl && preview) {
			beginImageHandoff({
				src: preview,
				fromEl,
				targetSel: '[data-studio-handoff-target]',
				reduced
			});
		}
		go('studio');
	}

	function beginRitual() {
		if (ritualOpen || reviewOpen || exiting || !cameraReady || $frameHandoffBusy || $imageHandoffBusy)
			return;
		const rect = getActiveHoleRect(dockEl, slotIndex) ?? getFrameDockRect(dockEl);
		if (!rect) return;
		stopLivePreview();
		snapFromRect = rect;
		ritualOpen = true;
		ritualKey += 1;
	}

	/** @param {string} dataUrl */
	function onSnapCaptured(dataUrl) {
		setCaptureAt(slotIndex, dataUrl);
		const next = [...photos];
		next[slotIndex] = dataUrl;
		photos = next;
	}

	function onSnapSettled() {
		ritualOpen = false;
		snapFromRect = null;
		reviewOpen = true;
	}

	function retakeShot() {
		if (!reviewOpen || exiting || ritualOpen) return;
		setCaptureAt(slotIndex, null);
		photos = photos.slice(0, slotIndex);
		reviewOpen = false;
	}

	/** Same SNAP shutter as first shot — advance slot, then run the full countdown ritual. */
	async function snapNextFromReview() {
		if (!reviewOpen || exiting || ritualOpen || isLastCanvas) return;
		if (!cameraReady || $frameHandoffBusy || $imageHandoffBusy) return;
		reviewOpen = false;
		slotIndex += 1;
		await tick();
		beginRitual();
	}

	async function goStudioFromReview() {
		if (!reviewOpen || exiting || ritualOpen || !isLastCanvas) return;
		await finishSession();
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
		grid-template-columns: minmax(0, 1.1fr) minmax(240px, 1fr) var(--booth-filter-rail-width);
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
		container-type: size;
		container-name: camera-dock;
	}

	.frame-dock {
		position: relative;
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 520px);
		max-height: 100cqh;
		aspect-ratio: var(--frame-ar);
		background: transparent;
		filter: drop-shadow(6px 8px 0 color-mix(in srgb, var(--primary) 35%, transparent));
	}

	.frame-dock.offline,
	.frame-dock.loading {
		aspect-ratio: 3 / 4;
		width: min(100cqw, 320px);
		max-height: 100cqh;
		display: grid;
		place-content: center;
		gap: 0.65rem;
		padding: 1rem;
		text-align: center;
		font-size: var(--booth-text-sm);
		color: var(--ink-soft);
		background: var(--surface);
		box-shadow: var(--shadow-panel);
	}

	.frame-dock.connecting {
		opacity: 0.92;
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
		z-index: 3;
	}

	.content-layer {
		position: absolute;
		inset: 0;
		z-index: 1;
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
		font-size: var(--booth-text-md);
		color: var(--gold-bright);
		opacity: 0.55;
	}

	.hole-num.connecting {
		animation: cam-pulse 1s steps(3) infinite;
		opacity: 0.75;
	}

	@keyframes cam-pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 0.9;
		}
	}

	.hint {
		font-size: var(--booth-text-xs);
		line-height: 1.7;
		opacity: 0.85;
	}

	.ritual-panel {
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
		font-size: var(--booth-text-md);
		color: #fff8df;
		text-shadow: 2px 2px 0 color-mix(in srgb, var(--gold) 40%, transparent);
	}

	.sub {
		margin-top: 0.35rem;
		font-size: var(--booth-text-sm);
		color: color-mix(in srgb, #fff8df 72%, transparent);
		line-height: 1.6;
	}

	.progress {
		font-size: var(--booth-text-sm);
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
		align-items: center;
		gap: 0.65rem;
	}

	.camera-view.handoff-pending .frame-art {
		opacity: 0;
	}

	.camera-view.ritual-busy .frame-dock,
	.camera-view.handoff-pending .frame-dock {
		opacity: 0;
		visibility: hidden;
	}

	.camera-view.handoff-pending .ritual-panel,
	.camera-view.handoff-pending :global(.filter-rail),
	.camera-view.ritual-busy .ritual-panel,
	.camera-view.ritual-busy :global(.filter-rail),
	.camera-view.exiting .ritual-panel,
	.camera-view.exiting :global(.filter-rail) {
		opacity: 0.4;
		transition: opacity 220ms steps(3);
	}

	.camera-view.review-open .hole.active {
		box-shadow:
			inset 0 0 0 2px #fff8df,
			0 0 0 2px rgba(46, 196, 255, 0.55);
	}

	.booth-view :global(.pixel-btn) {
		min-height: var(--booth-touch);
		font-size: var(--booth-text-sm);
		padding: 0.85rem 1.35rem;
	}

	@media (max-width: 980px) {
		.stage {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto;
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

		.ritual-panel {
			max-width: none;
		}
	}
</style>
