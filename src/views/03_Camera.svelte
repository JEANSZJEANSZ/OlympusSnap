<section class="view">
	<header class="head">
		<h1>CAMERA TEMPLE</h1>
		<p>Frame: {$selectedFrameId ?? 'none'} · Mirrored preview</p>
	</header>

	<div class="viewport scanlines">
		{#if cameraError}
			<div class="placeholder">
				<p>CAMERA OFFLINE</p>
				<p class="hint">Grant webcam access — or continue with a mock capture later.</p>
			</div>
		{:else}
			<video bind:this={videoEl} class="feed" playsinline muted autoplay></video>
		{/if}

		{#if counting}
			<div class="countdown" aria-live="assertive">{count}</div>
		{/if}

		{#if flashing}
			<div class="flash" aria-hidden="true"></div>
		{/if}

		<div class="viewfinder" aria-hidden="true"></div>
	</div>

	<div class="bottom">
		<DialogBox speaker="POSE CHALLENGE" text={poseText} typewriter={false} />
		<div class="actions">
			<PixelButton label="BACK" variant="ghost" onclick={() => go('frame')} />
			<PixelButton
				label={counting ? 'HOLD STILL…' : 'SNAP (3s)'}
				variant="accent"
				disabled={counting || !cameraReady}
				onclick={startCountdown}
			/>
			<PixelButton label="SKIP → STUDIO" variant="gold" onclick={skipToStudio} />
		</div>
	</div>
</section>

<script>
	import { onMount } from 'svelte';
	import {
		capturedImageData,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import { startCamera, stopCamera, captureFrame } from '../lib/utils/camera.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';

	/** @type {HTMLVideoElement | undefined} */
	let videoEl = $state();
	let cameraReady = $state(false);
	let cameraError = $state(false);
	let counting = $state(false);
	let count = $state(3);
	let flashing = $state(false);

	const poses = [
		'Strike a HEROIC Zeus pose — fists to the sky!',
		'Channel Aphrodite: soft smile, shoulders square.',
		'Athena wisdom look — chin up, one eyebrow raised.',
		'Group huddle! Fill the frame like a temple frieze.'
	];
	const poseText = poses[Math.floor(Math.random() * poses.length)];

	onMount(() => {
		let cancelled = false;
		const timeout = setTimeout(() => {
			if (!cancelled && !cameraReady) cameraError = true;
		}, 2500);

		(async () => {
			if (!videoEl) return;
			const stream = await startCamera(videoEl);
			if (cancelled) {
				stopCamera();
				return;
			}
			cameraReady = !!stream;
			cameraError = !stream;
		})();

		return () => {
			cancelled = true;
			clearTimeout(timeout);
			stopCamera();
		};
	});

	function skipToStudio() {
		stopCamera();
		capturedImageData.set(null);
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
		if (videoEl) {
			const data = captureFrame(videoEl);
			if (data) capturedImageData.set(data);
		}
		await new Promise((r) => setTimeout(r, 350));
		flashing = false;
		counting = false;
		stopCamera();
		go('studio');
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
		max-height: min(48dvh, 420px);
		background: var(--text);
		box-shadow:
			0 0 0 4px var(--gold),
			0 0 0 8px var(--text),
			8px 8px 0 var(--primary);
		overflow: hidden;
	}

	.feed {
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* Mirror preview */
		transform: scaleX(-1);
		display: block;
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
