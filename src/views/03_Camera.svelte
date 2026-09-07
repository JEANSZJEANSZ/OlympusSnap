<section
	bind:this={rootEl}
	class="camera-view booth-view"
	class:handoff-pending={$frameHandoffBusy || $imageHandoffBusy}
	class:ritual-busy={ritualOpen}
	class:review-open={reviewOpen}
	class:exiting
>
	<BoothOlympusBackdrop />

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
			{:else if frame || !useSlots}
				<div
					class="frame-dock"
					class:connecting={cameraStatus === 'connecting'}
					bind:this={dockEl}
					style:--frame-ar={frameAspect}
					style:--frame-ar-num={frameAspectNum}
					data-frame-handoff-target
					data-camera-handoff-target
				>
					{#if useSlots}
						{#if frameSrc}
							<img class="frame-art" src={frameSrc} alt="" draggable="false" />
						{/if}
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
			<div class="ritual-copy">
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

				{#if gestureRite && !(reviewOpen && isLastCanvas)}
					<div class="gesture-rite" aria-live="polite">
						<img class="gesture-rite-art" src={gestureRite.src} alt="" width="96" height="96" />
						<p class="gesture-rite-cue">{gestureRite.cue}</p>
					</div>
				{/if}

				<DialogBox
					speaker={reviewOpen ? 'REVIEW' : 'POSE CHALLENGE'}
					text={reviewOpen ? reviewText : poseText}
					typewriter={false}
				/>
			</div>

			<div class="actions">
				{#if reviewOpen}
					<PixelButton label="RETAKE" variant="ghost" disabled={exiting || ritualOpen} onclick={retakeShot} />
					{#if isLastCanvas}
						<PixelButton
							label="REVEAL"
							variant="gold"
							disabled={exiting || ritualOpen}
							onclick={goRevealFromReview}
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
							label="SKIP → REVEAL"
							variant="gold"
							disabled={ritualOpen || exiting}
							onclick={skipToReveal}
						/>
					{/if}
				{/if}
			</div>
		</div>

		<FilterGallery
			selectedId={filterPreset}
			disabled={ritualOpen || liveSlot < 0 || !cameraReady || exiting}
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
		activeStickers,
		setCaptureAt,
		capturedImageData,
		capturedPhotos,
		clearCaptures,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { getLiveFrameById, assetsReady, gestureSnap } from '../lib/assets/assetStore.js';
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
	import {
		startGestureShutter,
		stopGestureShutter,
		disposeGestureShutter,
		getHandOverlay
	} from '../lib/vision/gestureShutter.js';
	import { buildSnapGesturePlaylist } from '../lib/vision/snapGesturePlaylist.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import FilterGallery from '../lib/components/FilterGallery.svelte';
	import CameraSnapOverlay from '../lib/components/CameraSnapOverlay.svelte';
	import RitualShutterButton from '../lib/components/RitualShutterButton.svelte';
	import BoothOlympusBackdrop from '../lib/components/BoothOlympusBackdrop.svelte';
	import { frameHandoffBusy } from '../lib/fx/frameHandoff.js';
	import {
		frameImageCacheTick,
		isFrameImageCached,
		preloadFrameImage,
		resolveCachedFrameSrc
	} from '../lib/utils/loadImageForCanvas.js';

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
	const frameSrc = $derived.by(() => {
		$frameImageCacheTick;
		const raw = frame?.src ?? '';
		if (!raw || !isFrameImageCached(raw)) return '';
		return resolveCachedFrameSrc(raw);
	});
	const frameName = $derived(frame?.name ?? $selectedFrameId ?? 'none');
	const frameAspect = $derived(`${frameNatW} / ${frameNatH}`);
	const frameAspectNum = $derived(frameNatH > 0 ? frameNatW / frameNatH : 3 / 4);

	const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

	const GESTURE_RITE = /** @type {const} */ ({
		Victory: {
			src: `${APP_BASE}assets/gestures/victory.png`,
			cue: 'Show a victory sign to the gods to capture!'
		},
		Open_Palm: {
			src: `${APP_BASE}assets/gestures/open-palm.png`,
			cue: 'Show an open palm to the gods to capture!'
		},
		Thumb_Up: {
			src: `${APP_BASE}assets/gestures/thumb-up.png`,
			cue: 'Show a thumbs up to the gods to capture!'
		}
	});

	const catalogSettled = $derived($assetsReady && (!$selectedFrameId || !!frame));

	const playlist = $derived.by(() => {
		if (!catalogSettled) {
			return /** @type {import('../lib/vision/snapGesturePlaylist.js').SnapGestureKind[]} */ ([]);
		}
		return buildSnapGesturePlaylist(snapTotal);
	});

	const poseText = $derived(
		useSlots
			? `Canvas ${slotIndex + 1} of ${snapTotal}. ${poses[slotIndex % poses.length]}`
			: sessionPose
	);

	const isLastCanvas = $derived(slotIndex + 1 >= snapTotal);

	/** SNAP is available: first shot, or next canvas from review (not last-slot reveal). */
	const snapArmed = $derived.by(() => {
		if (exiting || ritualOpen || !cameraReady || $frameHandoffBusy || $imageHandoffBusy) {
			return false;
		}
		if (reviewOpen) return !isLastCanvas;
		return true;
	});

	/** Hole that should show the live camera — current slot, or the next one while reviewing. */
	const liveSlot = $derived.by(() => {
		if (ritualOpen) return -1;
		if (reviewOpen) return isLastCanvas ? -1 : slotIndex + 1;
		return slotIndex;
	});

	const slotKind = $derived.by(() => {
		const i = liveSlot >= 0 ? liveSlot : slotIndex;
		return playlist[i] ?? playlist[slotIndex] ?? 'Victory';
	});

	const gestureRite = $derived.by(() => {
		if (!$gestureSnap || !playlist.length) return null;
		return GESTURE_RITE[slotKind] ?? GESTURE_RITE.Victory;
	});

	const reviewText = $derived(
		isLastCanvas
			? 'Last canvas locked. RETAKE for another shot, or crack the marble on REVEAL.'
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
		const src = frame?.src;
		if (src) void preloadFrameImage(src);
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
			getPreset: () => filterPreset,
			getHandOverlay
		});

		return () => stopLivePreview();
	});

	$effect(() => {
		const enabled = $gestureSnap;
		const kind = slotKind;
		const video = videoEl;

		if (
			!enabled ||
			!playlist.length ||
			!video ||
			!cameraReady ||
			ritualOpen ||
			(reviewOpen && isLastCanvas)
		) {
			if (!enabled) disposeGestureShutter();
			else stopGestureShutter();
			return;
		}

		void startGestureShutter({
			video,
			isArmed: () => snapArmed,
			onTrigger: () => {
				if (reviewOpen) void snapNextFromReview();
				else beginRitual();
			},
			gesture: kind
		});

		return () => stopGestureShutter();
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
			disposeGestureShutter();
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

	async function skipToReveal() {
		if (exiting || ritualOpen || reviewOpen) return;
		stopLivePreview();
		stopCamera();
		clearCaptures();
		activeStickers.set([]);
		await playViewExit(rootEl, { reduced, direction: 'left' });
		go('reveal');
	}

	async function finishSession() {
		if (exiting) return;
		exiting = true;
		reviewOpen = false;
		stopLivePreview();
		stopCamera();
		activeStickers.set([]);
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
				targetSel: '[data-reveal-handoff-target]',
				reduced
			});
		}
		go('reveal');
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

	async function goRevealFromReview() {
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
		width: min(100cqw, calc(100cqh * var(--frame-ar-num, 0.75)), 520px);
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

	.ritual-copy {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		min-width: 0;
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

	.gesture-rite {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.65rem;
		max-width: 100%;
		padding: 0.4rem 0.55rem;
		background: #102f56;
		border: 2px solid var(--gold);
		box-shadow: 2px 2px 0 #07152d;
		box-sizing: border-box;
	}

	.gesture-rite-art {
		width: 4.2rem;
		height: 4.2rem;
		flex: 0 0 auto;
		object-fit: contain;
		background: #07152d;
		image-rendering: pixelated;
		image-rendering: -moz-crisp-edges;
		image-rendering: crisp-edges;
	}

	.gesture-rite-cue {
		margin: 0;
		color: #fff8df;
		font-size: var(--booth-text-sm);
		line-height: 1.4;
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

		/*
		 * size containment + auto height collapses the dock to 0 layout height
		 * (children are ignored for sizing), so copy/filters paint over the frame.
		 */
		.dock-column {
			container-type: normal;
			height: auto;
			min-height: 0;
			justify-content: center;
		}

		.frame-dock {
			width: min(78vw, calc(min(52dvh, 560px) * var(--frame-ar-num, 0.75)));
			max-height: min(52dvh, 560px);
			margin: 0 auto;
		}

		.ritual-panel {
			max-width: none;
		}
	}

	/* Phone-as-booth — portrait phones running the full capture flow */
	@media (max-width: 640px) {
		.camera-view {
			padding:
				max(0.35rem, env(safe-area-inset-top))
				max(0.5rem, env(safe-area-inset-right))
				0
				max(0.5rem, env(safe-area-inset-left));
			overflow: hidden;
			touch-action: manipulation;
		}

		.stage {
			display: flex;
			flex-direction: column;
			height: 100%;
			min-height: 0;
			overflow: hidden;
			gap: 0.4rem;
		}

		/* Grows so leftover viewport sits around the frame, not as empty sky under SNAP */
		.dock-column {
			order: 1;
			flex: 1 1 0;
			width: 100%;
			height: auto;
			min-height: 0;
			align-items: center;
			justify-content: center;
			padding: 0.15rem 0;
			container-type: normal;
			overflow: hidden;
		}

		.frame-dock {
			width: min(92vw, calc(min(48dvh, 100%) * var(--frame-ar-num, 0.75)));
			max-width: 100%;
			max-height: 100%;
			height: auto;
			margin: 0 auto;
		}

		.ritual-panel {
			display: contents;
		}

		.ritual-copy {
			order: 2;
			flex: 0 0 auto;
			min-height: 0;
			overflow: visible;
			gap: 0.3rem;
		}

		.gesture-rite-art {
			width: 2.6rem;
			height: 2.6rem;
		}

		.gesture-rite-cue {
			font-size: var(--booth-text-xs);
		}

		.head .eyebrow,
		.head h1 {
			display: none;
		}

		.head .sub {
			margin: 0;
			font-size: var(--booth-text-xs);
			line-height: 1.35;
		}

		.progress {
			font-size: var(--booth-text-xs);
			padding: 0.28rem 0.45rem;
		}

		.ritual-copy :global(.dialog) {
			max-width: none;
			padding: 0.55rem 0.65rem 0.6rem;
			box-shadow:
				0 0 0 3px var(--text),
				0 0 0 5px var(--gold),
				4px 4px 0 var(--primary);
		}

		.ritual-copy :global(.dialog .speaker) {
			font-size: var(--booth-text-xs);
			margin-bottom: 0.2rem;
		}

		.ritual-copy :global(.dialog .body) {
			font-size: var(--booth-text-xs);
			line-height: 1.4;
		}

		.stage :global(.filter-rail) {
			order: 3;
			flex: 0 0 auto;
			width: 100%;
			max-width: none;
			max-height: none;
		}

		.stage :global(.filter-rail .rail-title) {
			display: none;
		}

		.actions {
			order: 4;
			flex: 0 0 auto;
			width: 100%;
			display: grid;
			grid-template-columns: minmax(5.5rem, 0.9fr) minmax(0, 1.25fr);
			gap: 0.45rem;
			align-items: stretch;
			padding:
				0.4rem 0
				max(0.4rem, env(safe-area-inset-bottom));
			background: #071936;
			border-top: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
		}

		.actions :global(.pixel-btn) {
			min-height: max(48px, var(--booth-touch));
			padding: 0.65rem 0.5rem;
			font-size: clamp(0.55rem, 2.6vw, var(--booth-text-sm));
		}

		.actions :global(.pixel-btn:last-child) {
			grid-column: auto;
		}
	}

	@media (max-width: 640px) and (max-height: 580px) {
		.frame-dock {
			width: min(88vw, calc(min(40dvh, 100%) * var(--frame-ar-num, 0.75)));
		}

		.head .sub {
			display: none;
		}

		.ritual-copy :global(.dialog .body) {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			overflow: hidden;
		}
	}

	@media (max-width: 640px) and (max-height: 430px) {
		.frame-dock {
			width: min(84vw, calc(min(34dvh, 100%) * var(--frame-ar-num, 0.75)));
		}

		.stage {
			gap: 0.25rem;
		}
	}
</style>
