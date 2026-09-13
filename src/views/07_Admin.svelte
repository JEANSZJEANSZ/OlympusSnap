<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { adminReturnTo, go } from '../router/index.js';
	import { createAdminExitMotion, playAdminExitOnce } from '../lib/fx/adminExitMotion.js';
	import {
		showSeedFrames,
		randomFrame,
		gestureSnap,
		gestureFrame,
		oracleShuffleMs,
		ORACLE_SHUFFLE_MIN_MS,
		ORACLE_SHUFFLE_MAX_MS,
		setShowSeedFrames,
		setRandomFrame,
		setGestureSnap,
		setGestureFrame,
		setOracleShuffleMs,
		getAdminPin,
		setAdminPin
	} from '../lib/assets/assetStore.js';
	import { lockBooth } from '../lib/assets/boothSession.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import BoothOlympusBackdrop from '../lib/components/BoothOlympusBackdrop.svelte';

	/** @type {HTMLElement | undefined} */
	let rootEl = $state();
	/** @type {import('svelte/attachments').Attachment<HTMLElement>} */
	function attachRoot(element) {
		rootEl = element;
		return () => {
			if (rootEl === element) rootEl = undefined;
		};
	}
	let exiting = $state(false);
	let reduced = $state(
		typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);

	let status = $state('');
	let showPinChange = $state(false);
	let newPin = $state('');

	function onLogout() {
		lockBooth();
		go('landing');
	}

	/** @type {null | ReturnType<typeof createAdminExitMotion>} */
	let exitMotion = null;

	onMount(() => {
		let disposed = false;
		(async () => {
			await tick();
			if (disposed || !rootEl) return;
			exitMotion = createAdminExitMotion(rootEl, { reduced });
		})();
		return () => {
			disposed = true;
			exitMotion?.dispose();
			exitMotion = null;
		};
	});

	async function goBack() {
		if (exiting) return;
		exiting = true;

		await new Promise((resolve) => {
			if (exitMotion) exitMotion.playExit(resolve);
			else playAdminExitOnce(rootEl, { reduced }).then(resolve);
		});

		const returnTo = get(adminReturnTo);
		go(returnTo);
	}

	function savePin() {
		if (!newPin.trim()) {
			status = 'PIN cannot be empty.';
			return;
		}
		setAdminPin(newPin.trim());
		showPinChange = false;
		newPin = '';
		status = 'PIN updated.';
	}
</script>

<section class="admin-view" class:exiting {@attach attachRoot}>
	<BoothOlympusBackdrop />
	<div class="back-veil" aria-hidden="true"></div>
	<div class="forge-glow" aria-hidden="true"></div>

	<div class="content">
		<header class="head">
			<p class="eyebrow">HEPHAESTUS FORGE · BOOTH RITES · CART 01</p>
			<h1>ADMIN ARMORY</h1>
			<p class="tagline">
				Booth flags for this tablet. Custom frames and stickers come later via Cloudflare.
			</p>
		</header>

		{#if showPinChange}
			<div class="pin-change forge-panel">
				<p class="panel-kicker">CHANGE PIN</p>
				<label class="field">
					<span>New PIN</span>
					<input type="text" bind:value={newPin} placeholder={getAdminPin()} />
				</label>
				<div class="actions">
					<PixelButton label="SAVE PIN" variant="gold" onclick={savePin} />
					<PixelButton
						label="CANCEL"
						variant="ghost"
						onclick={() => {
							showPinChange = false;
							newPin = '';
						}}
					/>
				</div>
			</div>
		{/if}

		<div class="seed-panel forge-panel">
			<p class="panel-kicker">SEED RELICS</p>
			<p class="seed-copy">
				Shipped blanks for testing. Turn off only when a backend supplies frames — seed-off
				with no backend leaves Frame Select empty.
			</p>
			<div class="seed-toggles">
				<button
					type="button"
					class="seed-toggle"
					class:on={$showSeedFrames}
					aria-pressed={$showSeedFrames}
					onclick={() => {
						const next = !$showSeedFrames;
						setShowSeedFrames(next);
						status = next
							? 'Seed frames ON — guests can pick blanks.'
							: 'Seed frames OFF — Frame Select empty until a backend supplies frames.';
					}}
				>
					<span class="seed-toggle-label">FRAMES</span>
					<span class="seed-toggle-state">{$showSeedFrames ? 'ON' : 'OFF'}</span>
				</button>
			</div>
		</div>

		<div class="seed-panel forge-panel">
			<p class="panel-kicker">BOOTH FLOW</p>
			<p class="seed-copy">
				Random Frame skips pull-to-select. Pythia chooses a relic on the Delphi altar. Gesture
				Snap lets guests hold the pose shown on Camera for each canvas (victory / stop /
				thumbs up) to start the rite (SNAP stays). Gesture Pick lets guests swipe an open palm
				left/right to change the relic; hold a fist, then pull down to tug the rope (oracle
				ignores it). Booth flow toggles persist for this browser tab session.
			</p>
			<div class="seed-toggles">
				<button
					type="button"
					class="seed-toggle"
					class:on={$randomFrame}
					aria-pressed={$randomFrame}
					onclick={() => {
						const next = !$randomFrame;
						setRandomFrame(next);
						status = next
							? 'Random Frame ON — guests get an oracle pick.'
							: 'Random Frame OFF — guests pull to select.';
					}}
				>
					<span class="seed-toggle-label">RANDOM FRAME</span>
					<span class="seed-toggle-state">{$randomFrame ? 'ON' : 'OFF'}</span>
				</button>
				<button
					type="button"
					class="seed-toggle"
					class:on={$gestureSnap}
					aria-pressed={$gestureSnap}
					onclick={() => {
						const next = !$gestureSnap;
						setGestureSnap(next);
						status = next
							? 'Gesture Snap ON — hold the pose shown on Camera for each canvas.'
							: 'Gesture Snap OFF — SNAP button only.';
					}}
				>
					<span class="seed-toggle-label">GESTURE SNAP</span>
					<span class="seed-toggle-state">{$gestureSnap ? 'ON' : 'OFF'}</span>
				</button>
				<button
					type="button"
					class="seed-toggle"
					class:on={$gestureFrame}
					aria-pressed={$gestureFrame}
					onclick={() => {
						const next = !$gestureFrame;
						setGestureFrame(next);
						status = next
							? 'Gesture Pick ON — center-to-side palm swipe relics; hold a fist, then pull down to drop.'
							: 'Gesture Pick OFF — pull the rope by hand.';
					}}
				>
					<span class="seed-toggle-label">GESTURE PICK</span>
					<span class="seed-toggle-state">{$gestureFrame ? 'ON' : 'OFF'}</span>
				</button>
			</div>
			<label class="shuffle-slider">
				<span class="shuffle-slider-head">
					<span>SHUFFLE</span>
					<span class="shuffle-slider-val">{($oracleShuffleMs / 1000).toFixed(1)}s</span>
				</span>
				<input
					type="range"
					min={ORACLE_SHUFFLE_MIN_MS}
					max={ORACLE_SHUFFLE_MAX_MS}
					step="100"
					value={$oracleShuffleMs}
					aria-valuemin={ORACLE_SHUFFLE_MIN_MS}
					aria-valuemax={ORACLE_SHUFFLE_MAX_MS}
					aria-valuenow={$oracleShuffleMs}
					aria-label="Oracle shuffle duration"
					oninput={(e) => {
						const next = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value);
						setOracleShuffleMs(next);
						status = `Oracle shuffle set to ${(next / 1000).toFixed(1)}s.`;
					}}
				/>
				<span class="shuffle-slider-ends" aria-hidden="true">
					<span>FAST</span>
					<span>SLOW</span>
				</span>
			</label>
		</div>

		<div class="seed-panel forge-panel">
			<p class="panel-kicker">BOOTH SESSION</p>
			<p class="seed-copy">
				This tablet is unlocked with the Admin PIN for this tab. Log out to seal the booth
				again.
			</p>
			<div class="actions">
				<PixelButton label="LOG OUT" variant="ghost" onclick={onLogout} />
			</div>
		</div>

		{#if status}
			<p class="status" role="status">{status}</p>
		{/if}

		<div class="footer-actions">
			<PixelButton label="CHANGE PIN" variant="ghost" onclick={() => (showPinChange = true)} />
			<PixelButton label="EXIT ADMIN" variant="primary" onclick={goBack} />
		</div>
		<p class="hint">
			Seeds ship with the app. Custom frames/stickers attach later via Cloudflare.
		</p>
	</div>
</section>

<style>
	.admin-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		--cream: #f7f3ea;
		--cream-ink: #1a2438;
		--ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
		overflow: auto;
		color: #fff8df;
		background: var(--sky-top);
	}

	.admin-view.exiting {
		pointer-events: none;
		overflow: hidden;
	}

	.back-veil {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
		opacity: 0;
		background:
			radial-gradient(ellipse at 50% 72%, rgba(255, 176, 96, 0.35), transparent 58%),
			linear-gradient(180deg, #071936 0%, #0d2748 55%, #1a3a5c 100%);
	}

	.forge-glow {
		position: absolute;
		left: 50%;
		bottom: 0;
		z-index: 1;
		width: min(90%, 640px);
		height: 28%;
		translate: -50% 0;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--sky-low) 55%, transparent) 0%,
			transparent 70%
		);
		pointer-events: none;
		animation: forge-breathe 5.5s var(--ease-expo) infinite alternate;
	}

	.content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
		max-width: 920px;
		margin: 0 auto;
		padding: clamp(0.85rem, 2.2vh, 1.25rem) clamp(0.85rem, 3vw, 1.5rem)
			clamp(1.25rem, 3vh, 1.85rem);
		animation: content-rise 0.55s var(--ease-expo) both;
	}

	.head {
		text-align: center;
		text-shadow: 2px 2px 0 #06152d;
	}

	.eyebrow {
		margin: 0;
		font-size: clamp(0.34rem, 1vw, 0.45rem);
		letter-spacing: 0.2em;
		color: #f3d9bb;
	}

	.head h1 {
		margin: 0.35rem 0 0.4rem;
		font-size: clamp(0.95rem, 3.2vw, 1.55rem);
		line-height: 1.15;
		letter-spacing: 0.1em;
		color: var(--gold-bright);
		text-wrap: balance;
	}

	.tagline {
		margin: 0 auto;
		max-width: 36rem;
		font-size: clamp(0.4rem, 1.15vw, 0.52rem);
		line-height: 1.75;
		color: #f8eee1;
		text-wrap: pretty;
	}

	.forge-panel {
		background: var(--cream);
		color: var(--cream-ink);
		box-shadow:
			0 0 0 4px #0f172a,
			0 0 0 8px var(--gold),
			6px 6px 0 var(--primary);
		padding: 1rem 1.05rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		animation: panel-stamp 0.45s var(--ease-expo) both;
	}

	.panel-kicker {
		margin: 0;
		font-size: clamp(0.42rem, 1.1vw, 0.52rem);
		letter-spacing: 0.14em;
		color: var(--primary);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.45rem;
		color: color-mix(in srgb, var(--cream-ink) 72%, transparent);
	}

	.field input {
		font-family: var(--font-pixel);
		font-size: 0.55rem;
		padding: 0.65rem 0.75rem;
		border: none;
		background: #fffdf8;
		color: var(--cream-ink);
		box-shadow:
			0 0 0 3px var(--text),
			3px 3px 0 var(--primary);
	}

	.field input:focus-visible {
		outline: 3px solid var(--gold-bright);
		outline-offset: 2px;
	}

	.field input::placeholder {
		color: color-mix(in srgb, var(--cream-ink) 45%, transparent);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: center;
	}

	.status {
		font-size: 0.45rem;
		color: var(--gold-bright);
		text-align: center;
		text-shadow: 2px 2px 0 #06152d;
		margin: 0;
	}

	.seed-panel {
		display: grid;
		gap: 0.65rem;
	}

	.seed-copy {
		margin: 0;
		font-size: 0.4rem;
		line-height: 1.7;
		color: #f3d9bb;
		text-shadow: 1px 1px 0 #06152d;
	}

	.seed-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.seed-toggle {
		flex: 1 1 9rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 3rem;
		padding: 0.65rem 0.85rem;
		border: 2px solid var(--gold);
		background: #102f56;
		color: #f3e6c8;
		font-family: var(--font-pixel);
		font-size: 0.42rem;
		letter-spacing: 0.1em;
		box-shadow: 3px 3px 0 #07152d;
		cursor: pointer;
		transition:
			transform 60ms steps(2),
			box-shadow 60ms steps(2),
			background 80ms;
	}

	.seed-toggle.on {
		background: var(--primary);
		color: var(--gold-bright);
	}

	.seed-toggle:hover {
		filter: brightness(1.08);
	}

	.seed-toggle:active {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 #07152d;
	}

	.seed-toggle:focus-visible {
		outline: 3px solid var(--gold-bright);
		outline-offset: 2px;
	}

	.seed-toggle:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		filter: none;
	}

	.seed-toggle:disabled:hover,
	.seed-toggle:disabled:active {
		filter: none;
		transform: none;
		box-shadow: 3px 3px 0 #07152d;
	}

	.seed-toggle-state {
		padding: 0.2rem 0.45rem;
		border: 2px solid var(--gold);
		background: #07152d;
		color: var(--gold-bright);
		font-size: 0.38rem;
		letter-spacing: 0.14em;
	}

	.seed-toggle.on .seed-toggle-state {
		background: #07152d;
		color: #7dffb0;
	}

	.shuffle-slider {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.42rem;
		letter-spacing: 0.08em;
	}

	.shuffle-slider-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--cream-ink);
	}

	.shuffle-slider-val {
		font-size: 0.48rem;
		letter-spacing: 0.1em;
		color: #8e2f36;
		font-weight: 700;
	}

	.shuffle-slider input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 14px;
		margin: 0;
		background: #07152d;
		border: 3px solid #0f172a;
		box-shadow: inset 2px 2px 0 #1a2a44;
		cursor: pointer;
	}

	.shuffle-slider input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 22px;
		height: 22px;
		background: var(--gold-bright, #f0c14a);
		border: 3px solid #0f172a;
		box-shadow: 2px 2px 0 var(--primary);
		cursor: grab;
	}

	.shuffle-slider input[type='range']::-moz-range-thumb {
		width: 22px;
		height: 22px;
		background: var(--gold-bright, #f0c14a);
		border: 3px solid #0f172a;
		box-shadow: 2px 2px 0 var(--primary);
		cursor: grab;
	}

	.shuffle-slider-ends {
		display: flex;
		justify-content: space-between;
		font-size: 0.34rem;
		letter-spacing: 0.12em;
		opacity: 0.7;
	}

	.footer-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		justify-content: center;
		align-items: center;
		padding-top: 0.25rem;
	}

	.hint {
		font-size: 0.38rem;
		color: #f3d9bb;
		text-align: center;
		line-height: 1.75;
		text-shadow: 1px 1px 0 #06152d;
		margin: 0;
		opacity: 0.9;
	}

	@keyframes forge-breathe {
		from {
			opacity: 0.55;
			transform: scale(1);
		}
		to {
			opacity: 0.9;
			transform: scale(1.06);
		}
	}

	@keyframes content-rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes panel-stamp {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.forge-glow,
		.content,
		.forge-panel {
			animation: none;
		}
	}
</style>
