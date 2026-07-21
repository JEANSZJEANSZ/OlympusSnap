<section class="view" class:handoff-pending={$frameHandoffBusy}>
	<header class="head">
		<h1>CAMERA TEMPLE</h1>
		<p>
			{frameName} ·
			{#if snapTotal > 1}
				SNAP {slotIndex + 1} / {snapTotal}
			{:else}
				Mirrored preview
			{/if}
		</p>
	</header>

	<div
		class="viewport scanlines"
		class:framed={!!frameSrc}
		style:--frame-ar={frameAspect}
		data-frame-handoff-target={!useSlots ? true : undefined}
	>
		{#if cameraError}
			<div class="placeholder">
				<p>CAMERA OFFLINE</p>
				<p class="hint">Grant webcam access — or continue with a mock capture later.</p>
			</div>
		{:else}
			<!-- Full mirrored feed behind; slotted mode clips live hole + shows filled thumbs -->
			<video bind:this={videoEl} class="feed" class:hidden-feed={useSlots} playsinline muted autoplay
			></video>

			{#if useSlots && frameSrc}
				<div class="slot-stage" bind:this={stageEl}>
					<img
						class="frame-art"
						src={frameSrc}
						alt=""
						draggable="false"
						data-frame-handoff-target
					/>
					<div
						class="content-layer"
						style:left="{contentBox.left}px"
						style:top="{contentBox.top}px"
						style:width="{contentBox.w}px"
						style:height="{contentBox.h}px"
					>
						{#each slots as slot, i (slot.id)}
							<div
								class="hole"
								class:active={i === slotIndex}
								class:done={!!photos[i] && i !== slotIndex}
								style:left="{slot.x * 100}%"
								style:top="{slot.y * 100}%"
								style:width="{slot.w * 100}%"
								style:height="{slot.h * 100}%"
							>
								{#if photos[i] && i !== slotIndex}
									<img class="hole-shot" src={photos[i]} alt="" />
								{:else if i === slotIndex && !cameraError}
									<video
										class="hole-live"
										bind:this={holeVideoEl}
										playsinline
										muted
										autoplay
									></video>
								{:else}
									<span class="hole-num">{i + 1}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		{#if counting}
			<div class="countdown" aria-live="assertive">{count}</div>
		{/if}

		{#if flashing}
			<div class="flash" aria-hidden="true"></div>
		{/if}

		{#if !useSlots}
			<div class="viewfinder" aria-hidden="true"></div>
		{/if}
	</div>

	<div class="bottom">
		<DialogBox speaker="POSE CHALLENGE" text={poseText} typewriter={false} />
		<div class="actions">
			<PixelButton label="BACK" variant="ghost" onclick={goBack} />
			<PixelButton
				label={counting
					? 'HOLD STILL…'
					: snapTotal > 1
						? `SNAP ${slotIndex + 1}/${snapTotal}`
						: 'SNAP (3s)'}
				variant="accent"
				disabled={counting || !cameraReady || $frameHandoffBusy}
				onclick={startCountdown}
			/>
			{#if !useSlots}
				<PixelButton label="SKIP → STUDIO" variant="gold" onclick={skipToStudio} />
			{/if}
		</div>
	</div>
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
	import { go } from '../router/index.js';
	import { startCamera, stopCamera, captureFrame } from '../lib/utils/camera.js';
	import { compositeFramePhotos } from '../lib/utils/canvasRenderer.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';

	/** @type {HTMLVideoElement | undefined} */
	let videoEl = $state();
	/** @type {HTMLVideoElement | undefined} */
	let holeVideoEl = $state();
	/** @type {HTMLElement | undefined} */
	let stageEl = $state();
	let cameraReady = $state(false);
	let cameraError = $state(false);
	let counting = $state(false);
	let count = $state(3);
	let flashing = $state(false);
	let slotIndex = $state(0);
	/** @type {string[]} */
	let photos = $state([]);
	/** @type {MediaStream | null} */
	let stream = $state(null);
	let frameNatW = $state(300);
	let frameNatH = $state(400);
	let stageW = $state(1);
	let stageH = $state(1);

	const frame = $derived(getLiveFrameById($selectedFrameId));
	const slots = $derived(frame?.slots?.length ? frame.slots : []);
	const useSlots = $derived(slots.length > 0);
	const snapTotal = $derived(useSlots ? slots.length : 1);
	const frameSrc = $derived(frame?.src ?? '');
	const frameName = $derived(frame?.name ?? $selectedFrameId ?? 'none');
	const frameAspect = $derived(`${frameNatW} / ${frameNatH}`);

	/** Image content box inside the stage (object-fit: contain). */
	const contentBox = $derived.by(() => {
		const scale = Math.min(stageW / frameNatW, stageH / frameNatH);
		const w = frameNatW * scale;
		const h = frameNatH * scale;
		return {
			left: (stageW - w) / 2,
			top: (stageH - h) / 2,
			w,
			h
		};
	});

	const poses = [
		'Strike a HEROIC Zeus pose — fists to the sky!',
		'Channel Aphrodite: soft smile, shoulders square.',
		'Athena wisdom look — chin up, one eyebrow raised.',
		'Group huddle! Fill the frame like a temple frieze.'
	];
	const poseText = $derived(
		useSlots
			? `Canvas ${slotIndex + 1} of ${snapTotal}. ${poses[slotIndex % poses.length]}`
			: poses[Math.floor(Math.random() * poses.length)]
	);

	function measureStage() {
		if (!stageEl) return;
		const r = stageEl.getBoundingClientRect();
		stageW = Math.max(1, r.width);
		stageH = Math.max(1, r.height);
	}

	function loadFrameMetrics(src) {
		if (!src) return;
		const img = new Image();
		img.onload = () => {
			frameNatW = img.naturalWidth || 300;
			frameNatH = img.naturalHeight || 400;
			requestAnimationFrame(measureStage);
		};
		img.src = src;
	}

	function attachHoleStream() {
		if (holeVideoEl && stream) {
			holeVideoEl.srcObject = stream;
			holeVideoEl.play?.().catch(() => {});
		}
	}

	$effect(() => {
		if (frameSrc) loadFrameMetrics(frameSrc);
	});

	$effect(() => {
		if (useSlots && holeVideoEl && stream) attachHoleStream();
	});

	onMount(() => {
		clearCaptures();
		photos = [];
		slotIndex = 0;

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
			attachHoleStream();
			measureStage();
		})();

		return () => {
			cancelled = true;
			clearTimeout(timeout);
			stopCamera();
			stream = null;
		};
	});

	$effect(() => {
		if (!stageEl) return;
		measureStage();
		const ro = new ResizeObserver(() => measureStage());
		ro.observe(stageEl);
		return () => ro.disconnect();
	});

	function goBack() {
		stopCamera();
		clearCaptures();
		go('frame');
	}

	function skipToStudio() {
		stopCamera();
		clearCaptures();
		go('studio');
	}

	async function finishSession() {
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

	async function startCountdown() {
		if (counting || !cameraReady) return;
		counting = true;
		count = 3;
		for (let i = 3; i >= 1; i--) {
			count = i;
			await new Promise((r) => setTimeout(r, 900));
		}
		flashing = true;
		const source = videoEl;
		if (source) {
			const data = captureFrame(source);
			if (data) {
				appendCapture(data);
				photos = [...photos, data];
			}
		}
		await new Promise((r) => setTimeout(r, 350));
		flashing = false;
		counting = false;

		if (slotIndex + 1 >= snapTotal) {
			await finishSession();
			return;
		}
		slotIndex += 1;
	}
</script>

<style>
	.view {
		height: 100%;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 0.85rem;
		padding: 1rem;
	}

	.view.handoff-pending .frame-art {
		opacity: 0;
	}

	.view.handoff-pending .head,
	.view.handoff-pending .bottom {
		opacity: 0.35;
		transition: opacity 280ms steps(3);
	}

	.view:not(.handoff-pending) .head,
	.view:not(.handoff-pending) .bottom,
	.view:not(.handoff-pending) .frame-art {
		transition: opacity 220ms steps(3);
	}

	.head {
		text-align: center;
	}

	.head h1 {
		font-size: clamp(0.8rem, 2.8vw, 1.05rem);
		color: var(--primary);
	}

	.head p {
		margin-top: 0.35rem;
		font-size: 0.48rem;
		color: var(--ink-soft);
	}

	.viewport {
		position: relative;
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
		aspect-ratio: 4 / 3;
		max-height: min(52dvh, 480px);
		background: var(--text);
		box-shadow:
			0 0 0 4px var(--gold),
			0 0 0 8px var(--text),
			8px 8px 0 var(--primary);
		overflow: hidden;
	}

	.viewport.framed {
		aspect-ratio: var(--frame-ar, 3 / 4);
		max-width: min(420px, 100%);
	}

	.feed {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scaleX(-1);
		display: block;
	}

	.feed.hidden-feed {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.slot-stage {
		position: absolute;
		inset: 0;
		background: #0a1220;
	}

	.frame-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
		pointer-events: none;
		z-index: 1;
	}

	.content-layer {
		position: absolute;
		z-index: 2;
	}

	.hole {
		position: absolute;
		overflow: hidden;
		z-index: 1;
		background: #111;
		box-shadow: inset 0 0 0 1px rgba(255, 217, 120, 0.35);
	}

	.hole.active {
		box-shadow:
			inset 0 0 0 2px var(--gold-bright),
			0 0 0 1px rgba(255, 217, 120, 0.5);
	}

	.hole-live,
	.hole-shot {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.hole-live {
		transform: scaleX(-1);
	}

	.hole-num {
		display: grid;
		place-items: center;
		height: 100%;
		font-size: 0.7rem;
		color: var(--gold-bright);
		opacity: 0.55;
	}

	.placeholder {
		height: 100%;
		display: grid;
		place-content: center;
		gap: 0.75rem;
		padding: 1rem;
		text-align: center;
		color: var(--bg-base);
		font-size: 0.65rem;
		background: repeating-linear-gradient(
			45deg,
			#0f172a,
			#0f172a 10px,
			#1e293b 10px,
			#1e293b 20px
		);
	}

	.hint {
		font-size: 0.48rem;
		line-height: 1.7;
		opacity: 0.8;
		max-width: 18rem;
		margin: 0 auto;
	}

	.countdown {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: clamp(4rem, 20vw, 7rem);
		color: var(--gold-bright);
		text-shadow: 4px 4px 0 var(--text);
		z-index: 4;
		animation: countdown-pop 0.85s steps(3) both;
		pointer-events: none;
	}

	.flash {
		position: absolute;
		inset: 0;
		background: var(--flash);
		z-index: 5;
		animation: flash-white 0.35s ease-out forwards;
		pointer-events: none;
	}

	.viewfinder {
		position: absolute;
		inset: 12px;
		border: 2px dashed color-mix(in srgb, var(--bg-base) 50%, transparent);
		pointer-events: none;
		z-index: 3;
	}

	.viewfinder::before,
	.viewfinder::after {
		content: '';
		position: absolute;
		width: 18px;
		height: 18px;
		border-color: var(--gold-bright);
		border-style: solid;
	}

	.viewfinder::before {
		top: -2px;
		left: -2px;
		border-width: 3px 0 0 3px;
	}

	.viewfinder::after {
		bottom: -2px;
		right: -2px;
		border-width: 0 3px 3px 0;
	}

	.bottom {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: center;
	}
</style>
