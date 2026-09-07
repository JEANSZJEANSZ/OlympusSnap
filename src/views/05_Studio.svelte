<section
	class="studio-view booth-view"
	class:handoff-pending={$imageHandoffBusy}
	class:mobile-session={mobileSession}
	class:session-error={!!sessionError}
	class:exiting
>
	{#if !mobileSession}
		<div class="sky-wash" aria-hidden="true"></div>
		<div class="stars" aria-hidden="true">
			<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
		</div>
		<div class="mountains mountains-far" aria-hidden="true"></div>
		<div class="mountains mountains-near" aria-hidden="true"></div>
	{/if}

	{#if sessionError}
		<div class="session-empty">
			<p class="session-empty-title">
				{sessionError === 'forbidden' ? 'LINK FORBIDDEN' : 'LINK NOT FOUND'}
			</p>
			<p class="session-empty-sub">
				{sessionError === 'forbidden'
					? 'This studio link is not valid. Scan the QR on the booth screen.'
					: 'This link is invalid or expired. Scan the QR on the booth screen.'}
			</p>
		</div>
	{:else if mobileSession || $capturedImageData}
		<div class="studio-body">
			<main class="stage">
				<aside class="dock-column">
					<div class="frame-pedestal">
						<div
							bind:this={shellEl}
							class="editor-shell pixel-panel"
							class:entry-busy={entryBusy || $imageHandoffBusy}
							class:is-narrow={frameAspect < 0.42}
							style:--frame-ar={frameAspect}
						>
							{#if $capturedImageData}
								<StudioKonvaEditor
									bind:this={editorRef}
									compositeUrl={$capturedImageData}
									stickers={$activeStickers}
									{selectedId}
									{touchMode}
									onStickersChange={onStickersChange}
									onSelect={onStickerSelect}
									onDragActive={onStickerDragActive}
									onDragMove={onStickerDragMove}
									onDragEnd={onStickerDragEnd}
									onReady={onEditorReady}
								/>
							{/if}

							{#if saving || saveDone || saveError}
								<div
									class={['download-status', { done: saveDone, error: saveError }]}
									role="status"
									aria-live="polite"
									aria-busy={saving}
									transition:fade={{ duration: reduced ? 0 : 180 }}
								>
									<div class="download-status-card">
										{#if saving}
											<span class="dl-spinner dl-spinner-lg" aria-hidden="true"></span>
										{:else if saveError}
											<span class="dl-error-mark" aria-hidden="true">!</span>
										{:else}
											<span class="dl-check-wrap" aria-hidden="true">
												<svg viewBox="0 0 24 24">
													<path
														fill="currentColor"
														d="M9.2 16.2 4.8 11.8l-1.4 1.4 5.8 5.8 12-12-1.4-1.4z"
													/>
												</svg>
											</span>
										{/if}
										<p>
											{saveError
												? 'Could not save — try again'
												: saveDone
													? 'Ready'
													: 'Downloading…'}
										</p>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</aside>

				{#if !mobileSession}
					<aside class="sticker-rail" aria-label="Sticker tray">
						<div class="gallery">
							{#each $stickers as item (item.id)}
								<button
									type="button"
									class="tile"
									disabled={entryBusy || exiting || saving}
									onclick={() => addSticker(item)}
								>
									<span class="swatch">
										<img src={item.src} alt="" draggable="false" />
									</span>
									<span class="label">{item.name}</span>
								</button>
							{/each}
						</div>

						<DialogBox speaker="DIONYSUS" text={dialogText} typewriter={false} />

						<div class="actions">
							<PixelButton
								label="REMOVE"
								variant="ghost"
								disabled={!selectedId || entryBusy || exiting || saving}
								onclick={removeSelected}
							/>
							<PixelButton
								label="CLEAR"
								variant="ghost"
								disabled={entryBusy || exiting || saving}
								onclick={clearStickers}
							/>
						</div>
					</aside>
				{/if}
			</main>

			{#if mobileSession}
				<aside
					class="story-rail"
					class:is-hidden={stickerSheetOpen || shareFallbackOpen || dragActive || sessionLoading}
					aria-hidden={stickerSheetOpen || shareFallbackOpen || dragActive || sessionLoading}
					aria-label="Studio tools"
				>
					<button
						type="button"
						class={['story-btn', { 'is-working': saving || saveDone }]}
						aria-label={saving ? 'Downloading snap' : saveDone ? 'Snap ready' : 'Download snap'}
						aria-busy={saving}
						disabled={busy || !$capturedImageData}
						onclick={saveMySnap}
					>
						{#if saving}
							<span class="dl-spinner" aria-hidden="true"></span>
						{:else if saveDone}
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									fill="currentColor"
									d="M9.2 16.2 4.8 11.8l-1.4 1.4 5.8 5.8 12-12-1.4-1.4z"
								/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									fill="currentColor"
									d="M11 3h2v10h3l-4 5-4-5h3V3zm-7 16h16v2H4v-2z"
								/>
							</svg>
						{/if}
					</button>
					<button
						type="button"
						class="story-btn"
						aria-label="Stickers and GIFs"
						aria-expanded={stickerSheetOpen}
						disabled={busy}
						onclick={openStickerSheet}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linejoin="round"
								stroke-linecap="round"
								d="M19.6 13.15A7.6 7.6 0 1 0 11.15 20.1c.42.08.86.12 1.3.12.48 0 .75-.38.75-.75v-2.85c0-1.18.96-2.14 2.14-2.14H18c.4 0 .75-.28.75-.72a7.55 7.55 0 0 0-.15-1.56z"
							/>
							<path
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linejoin="round"
								stroke-linecap="round"
								d="M15.35 14.48h2.7c.48 0 .87.4.87.87v2.7M15.35 14.48 18.92 18.05"
							/>
							<circle cx="9.35" cy="10.35" r="1.05" fill="currentColor" />
							<circle cx="13.85" cy="10.35" r="1.05" fill="currentColor" />
							<path
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								d="M9.55 13.3c.8 1.25 2.2 1.8 3.6 1.5"
							/>
						</svg>
					</button>
					<button
						type="button"
						class="story-btn"
						aria-label={sharing ? 'Sharing' : 'Share snap'}
						disabled={busy || !$capturedImageData}
						onclick={shareMySnap}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="currentColor"
								d="M14 4l6 6-6 6v-3.5c-4 0-7 1.2-9 4 1-5 4.5-8 9-8.5V4z"
							/>
						</svg>
					</button>
				</aside>

				<div
					bind:this={trashEl}
					class="trash-target"
					class:visible={dragActive}
					class:hot={dragOverTrash}
					aria-hidden={!dragActive}
					aria-label="Drop sticker to delete"
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							fill="currentColor"
							d="M9 3h6v2h5v2H4V5h5V3zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12v14H6V7z"
						/>
					</svg>
				</div>

				{#if stickerSheetOpen}
					<StickerSheet
						stickers={$stickers}
						disabled={busy}
						onSelect={placeStickerFromSheet}
						onClose={closeStickerSheet}
					/>
				{/if}

				{#if shareFallbackOpen}
					<ShareFallbackSheet
						dataUrl={lastExportUrl}
						onDownload={saveMySnap}
						onClose={closeShareFallback}
					/>
				{/if}
			{/if}
		</div>
	{/if}

	{#if sessionLoading && !sessionError}
		<div class="session-loading" aria-live="polite">
			<span class="session-spinner" aria-hidden="true"></span>
			<p>Loading your snap…</p>
		</div>
	{/if}
</section>

<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { get } from 'svelte/store';
	import {
		activeStickers,
		capturedImageData,
		selectedFrameId
	} from '../lib/stores/stores.js';
	import { getLiveFrameById } from '../lib/assets/assetStore.js';
	import { stickers, applyGuestCatalogFlagsFromUrl } from '../lib/assets/assetStore.js';
	import { go } from '../router/index.js';
	import { getSessionFromUrl, loadCapture } from '../lib/session/sessionClient.js';
	import { imageHandoffBusy } from '../lib/fx/imageHandoff.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import StudioKonvaEditor from '../lib/components/StudioKonvaEditor.svelte';
	import StickerSheet from '../lib/components/StickerSheet.svelte';
	import ShareFallbackSheet from '../lib/components/ShareFallbackSheet.svelte';
	import { downloadBlob, shareCompositeBlob } from '../lib/share/shareComposite.js';
	import { isPointInRect } from '../lib/utils/hitTest.js';
	import { warmFrameImages } from '../lib/utils/loadImageForCanvas.js';

	/** @type {StudioKonvaEditor | undefined} */
	let editorRef = $state();
	/** @type {HTMLDivElement | undefined} */
	let shellEl = $state();

	let selectedId = $state(/** @type {string | null} */ (null));
	let entryBusy = $state(true);
	let reduced = $state(false);
	let exiting = $state(false);
	let saving = $state(false);
	let saveDone = $state(false);
	let saveError = $state(false);
	let sharing = $state(false);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let saveErrorTimer = null;
	const guestFromUrl = typeof location !== 'undefined' && !!getSessionFromUrl();
	let mobileSession = $state(guestFromUrl);
	let coarsePointer = $state(false);
	let sessionLoading = $state(guestFromUrl);
	let stickerSheetOpen = $state(false);
	let shareFallbackOpen = $state(false);
	let dragActive = $state(false);
	let dragOverTrash = $state(false);
	let lastExportUrl = $state('');
	/** @type {HTMLDivElement | undefined} */
	let trashEl = $state();
	/** @type {'forbidden' | 'not_found' | null} */
	let sessionError = $state(null);
	/** @type {Record<string, { w: number; h: number }>} */
	let measuredDims = $state({});
	let captureObjectUrl = '';

	const frame = $derived(getLiveFrameById($selectedFrameId));

	function measureComposite(url) {
		const img = new Image();
		img.onload = () => {
			if (!img.naturalWidth || !img.naturalHeight) return;
			const key = $selectedFrameId || '__session__';
			measuredDims = {
				...measuredDims,
				[key]: { w: img.naturalWidth, h: img.naturalHeight }
			};
		};
		img.src = url;
	}

	const frameAspect = $derived.by(() => {
		const f = frame;
		if (f?.w && f?.h && f.h > 0) return f.w / f.h;
		const key = $selectedFrameId || '__session__';
		const m = measuredDims[key];
		if (m?.w && m?.h) return m.w / m.h;
		return 3 / 4;
	});

	const touchMode = $derived(mobileSession || coarsePointer);
	const busy = $derived(entryBusy || exiting || saving || saveDone || sharing);

	const dialogText = $derived('Scan the QR at the booth to open mobile studio.');

	/** @param {string} url */
	function rememberCaptureUrl(url) {
		if (captureObjectUrl && captureObjectUrl !== url) {
			URL.revokeObjectURL(captureObjectUrl);
		}
		captureObjectUrl = url.startsWith('blob:') ? url : '';
	}

	function revokeCaptureUrl() {
		if (!captureObjectUrl) return;
		URL.revokeObjectURL(captureObjectUrl);
		captureObjectUrl = '';
	}

	function clearSaveError() {
		saveError = false;
		if (saveErrorTimer != null) {
			clearTimeout(saveErrorTimer);
			saveErrorTimer = null;
		}
	}

	function flashSaveError() {
		clearSaveError();
		saveError = true;
		saveErrorTimer = setTimeout(() => {
			saveError = false;
			saveErrorTimer = null;
		}, 2000);
	}

	async function initEditorEntry() {
		await tick();
		entryBusy = true;
		try {
			/* Mobile session: minimal fade — no booth Z-fall entry motion. */
			if (shellEl && !reduced) {
				shellEl.style.opacity = '0';
				shellEl.style.transition = 'opacity 320ms ease';
				await tick();
				shellEl.style.opacity = '1';
				await new Promise((r) => setTimeout(r, 340));
			}
		} finally {
			entryBusy = false;
		}
	}

	function onEditorReady() {
		if (!sessionLoading) return;
		sessionLoading = false;
		entryBusy = false;
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		coarsePointer = window.matchMedia('(pointer: coarse)').matches;
		activeStickers.set([]);
		selectedId = null;

		const parts = getSessionFromUrl();
		if (parts) {
			applyGuestCatalogFlagsFromUrl();
			mobileSession = true;
			sessionLoading = true;
			entryBusy = true;
			capturedImageData.set(null);

			(async () => {
				try {
					const payload = await loadCapture(parts.id, parts.key);
					rememberCaptureUrl(payload.imageDataUrl);
					capturedImageData.set(payload.imageDataUrl);
					if (payload.frameId) selectedFrameId.set(payload.frameId);
					activeStickers.set([]);
					measureComposite(payload.imageDataUrl);
				} catch (err) {
					/* Same-device booth click: image may already live in the store. */
					const existing = get(capturedImageData);
					if (existing && err?.code !== 'FORBIDDEN') {
						activeStickers.set([]);
						measureComposite(existing);
						return;
					}
					sessionLoading = false;
					entryBusy = false;
					sessionError = err?.code === 'FORBIDDEN' ? 'forbidden' : 'not_found';
				}
			})();

			return;
		}

		if (!$capturedImageData) {
			go('camera');
			return;
		}

		measureComposite($capturedImageData);
		entryBusy = false;
	});

	onDestroy(() => {
		clearSaveError();
		revokeCaptureUrl();
	});

	/** @param {import('../lib/stores/stores.js').ActiveSticker[]} list */
	function onStickersChange(list) {
		activeStickers.set(list);
	}

	/** @param {string | null} id */
	function onStickerSelect(id) {
		selectedId = id;
	}

	/** @param {{ id: string; name: string; src: string }} item */
	async function addSticker(item) {
		if (busy) return;
		const id = `${item.id}-${Date.now()}`;
		await editorRef?.spawnSticker({ id, src: item.src });
	}

	/** @param {{ id: string; name: string; src: string }} item */
	async function placeStickerFromSheet(item) {
		await addSticker(item);
		stickerSheetOpen = false;
	}

	function openStickerSheet() {
		if (busy) return;
		clearSaveError();
		shareFallbackOpen = false;
		stickerSheetOpen = true;
		void warmFrameImages(get(stickers).map((s) => s.src));
	}

	function closeStickerSheet() {
		stickerSheetOpen = false;
	}

	function closeShareFallback() {
		shareFallbackOpen = false;
		clearSaveError();
	}

	function hitTrash(clientX, clientY) {
		return isPointInRect(clientX, clientY, trashEl?.getBoundingClientRect(), 28);
	}

	/** @param {boolean} on */
	function onStickerDragActive(on) {
		dragActive = on;
		if (!on) dragOverTrash = false;
		if (on) {
			stickerSheetOpen = false;
			shareFallbackOpen = false;
		}
	}

	/** @param {{ id: string; clientX: number; clientY: number }} pos */
	function onStickerDragMove(pos) {
		dragOverTrash = hitTrash(pos.clientX, pos.clientY);
	}

	/** @param {{ id: string; clientX: number; clientY: number }} pos */
	function onStickerDragEnd(pos) {
		const over = hitTrash(pos.clientX, pos.clientY);
		dragOverTrash = false;
		if (over) selectedId = null;
		return over;
	}

	function clearStickers() {
		if (busy) return;
		editorRef?.clearStickers();
		selectedId = null;
	}

	function removeSelected() {
		if (!selectedId || busy) return;
		const removed = editorRef?.removeSticker(selectedId) ?? false;
		if (removed) selectedId = null;
	}

	/** Capped JPEG data URL for ShareFallbackSheet copy only (not save/share primary path). */
	async function exportCurrent() {
		const url = await editorRef?.exportDataUrl();
		if (url) lastExportUrl = url;
		return url;
	}

	/** @returns {Promise<Blob | null>} */
	async function exportCurrentBlob() {
		return (await editorRef?.exportBlob?.()) ?? null;
	}

	function waitForPaint() {
		return new Promise((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(resolve));
		});
	}

	async function saveMySnap() {
		if (busy || !$capturedImageData) return;
		clearSaveError();
		saving = true;
		saveDone = false;
		shareFallbackOpen = false;
		stickerSheetOpen = false;
		await tick();
		await waitForPaint();
		try {
			const blob = await exportCurrentBlob();
			if (!blob) {
				flashSaveError();
				return;
			}
			downloadBlob(blob);
			await waitForPaint();
			saving = false;
			saveDone = true;
			await new Promise((r) => setTimeout(r, reduced ? 420 : 900));
		} finally {
			saving = false;
			saveDone = false;
		}
	}

	async function shareMySnap() {
		if (busy) return;
		clearSaveError();
		sharing = true;
		stickerSheetOpen = false;
		await tick();
		await waitForPaint();
		try {
			const blob = await exportCurrentBlob();
			if (!blob) {
				flashSaveError();
				return;
			}
			const result = await shareCompositeBlob(blob);
			if (result === 'unsupported' || result === 'failed') {
				// Fallback sheet still needs a (now-capped) data URL for clipboard copy.
				await exportCurrent();
				shareFallbackOpen = true;
			}
		} finally {
			sharing = false;
		}
	}
</script>

<style>
	.studio-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		--studio-tilt: 0deg;
		--pedestal-tilt: -3.5deg;
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
		overflow: hidden;
		padding: clamp(0.65rem, 1.5vh, 1rem) clamp(0.75rem, 2vw, 1.25rem);
		color: #fff8df;
		background: var(--sky-top);
		display: grid;
		grid-template-rows: 1fr;
	}

	.studio-view.mobile-session {
		padding: 0;
		height: 100%;
		min-height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: stretch;
		background: #071936;
		overflow: hidden;
		touch-action: manipulation;
		overscroll-behavior: none;
		z-index: 1;
	}

	/* Full-bleed opaque veil — covers App marble / leftover FX on wide screens */
	.studio-view.mobile-session::before {
		content: '';
		position: absolute;
		inset: 0;
		background: #071936;
		z-index: 0;
		pointer-events: none;
	}

	.studio-body {
		min-height: 0;
		height: 100%;
		width: 100%;
	}

	.mobile-session .studio-body {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		width: 100%;
		max-width: none;
		min-height: 0;
		margin-inline: 0;
		padding: 0;
	}

	.mobile-session .stage {
		display: flex;
		flex-direction: column;
		grid-template-columns: unset;
		grid-template-rows: unset;
		align-items: stretch;
		gap: 0;
		flex: 1 1 auto;
		min-height: 0;
		height: 100%;
		width: 100%;
		touch-action: manipulation;
		overscroll-behavior: contain;
	}

	.mobile-session .dock-column {
		flex: 1 1 0;
		min-height: 0;
		max-height: none;
		height: auto;
		padding: 0;
		background: #071936;
		touch-action: none;
		overscroll-behavior: contain;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mobile-session .frame-pedestal {
		position: relative;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mobile-session .frame-pedestal::after {
		display: none;
	}

	.mobile-session .editor-shell,
	.mobile-session .editor-shell.is-narrow {
		width: min(100%, calc(100cqh * var(--frame-ar)));
		height: auto;
		max-width: 100%;
		max-height: 100%;
		aspect-ratio: var(--frame-ar);
		margin: 0 auto;
		filter: none;
		background: #0a1220;
		border-radius: 0;
		box-shadow: none;
		transform: none;
	}

	.story-rail {
		position: absolute;
		top: max(0.85rem, env(safe-area-inset-top));
		right: max(0.7rem, env(safe-area-inset-right));
		z-index: 4;
		display: flex;
		flex-direction: column;
		gap: 0.72rem;
		transition: opacity 160ms ease;
	}

	.story-rail.is-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.story-btn {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: rgba(18, 18, 18, 0.42);
		color: #fff;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.story-btn svg {
		width: 1.28rem;
		height: 1.28rem;
	}

	.story-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.story-btn.is-working {
		color: #fff4c2;
		background: rgba(18, 18, 18, 0.62);
		box-shadow:
			0 0 0 1px color-mix(in srgb, #fff4c2 38%, transparent),
			0 0 16px color-mix(in srgb, #d4a017 32%, transparent);
	}

	.story-btn.is-working:disabled {
		opacity: 1;
		cursor: wait;
	}

	.story-btn:active:not(:disabled) {
		transform: scale(0.94);
	}

	.dl-spinner {
		width: 1.18rem;
		height: 1.18rem;
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, #fff4c2 22%, transparent);
		border-top-color: #fff4c2;
		animation: session-spin 0.7s linear infinite;
	}

	.dl-spinner-lg {
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
	}

	.download-status {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-items: center;
		pointer-events: auto;
		background: radial-gradient(
			ellipse at center,
			rgba(7, 25, 54, 0.38) 0%,
			rgba(7, 25, 54, 0.12) 70%
		);
	}

	.download-status-card {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.72rem 1.1rem 0.72rem 0.82rem;
		border-radius: 999px;
		background: rgba(10, 18, 32, 0.72);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow:
			0 10px 28px rgba(3, 12, 27, 0.45),
			inset 0 1px 0 color-mix(in srgb, #fff8df 16%, transparent);
		color: #fff8df;
	}

	.download-status-card p {
		margin: 0;
		font-family: var(--font-pixel);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff8df;
	}

	.download-status.done .download-status-card {
		box-shadow:
			0 10px 28px rgba(3, 12, 27, 0.45),
			0 0 18px color-mix(in srgb, #d4a017 28%, transparent),
			inset 0 1px 0 color-mix(in srgb, #fff8df 16%, transparent);
	}

	.download-status.error {
		pointer-events: none;
		background: radial-gradient(
			ellipse at center,
			rgba(54, 18, 18, 0.42) 0%,
			rgba(7, 25, 54, 0.1) 70%
		);
	}

	.download-status.error .download-status-card {
		box-shadow:
			0 10px 28px rgba(3, 12, 27, 0.45),
			0 0 14px color-mix(in srgb, #e07070 22%, transparent),
			inset 0 1px 0 color-mix(in srgb, #fff8df 16%, transparent);
	}

	.dl-error-mark {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
		border-radius: 50%;
		font-family: var(--font-pixel);
		font-size: 0.85rem;
		line-height: 1;
		color: #fff4c2;
		background: color-mix(in srgb, #c44 55%, transparent);
	}

	.dl-check-wrap {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
		color: #fff4c2;
	}

	.dl-check-wrap svg {
		width: 1.15rem;
		height: 1.15rem;
	}

	.trash-target {
		position: absolute;
		left: 50%;
		bottom: max(1.35rem, env(safe-area-inset-bottom));
		z-index: 5;
		display: grid;
		place-items: center;
		width: 3.4rem;
		height: 3.4rem;
		border-radius: 999px;
		background: rgba(18, 18, 18, 0.55);
		color: #fff;
		transform: translateX(-50%) scale(0.86);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 140ms ease,
			transform 140ms ease,
			background 140ms ease;
	}

	.trash-target svg {
		width: 1.4rem;
		height: 1.4rem;
	}

	.trash-target.visible {
		opacity: 1;
		transform: translateX(-50%) scale(1);
	}

	.trash-target.hot {
		background: #e24b4b;
		transform: translateX(-50%) scale(1.14);
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

	.session-loading {
		position: absolute;
		inset: 0;
		z-index: 12;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.9rem;
		background: #071936;
		text-align: center;
		padding: 1.5rem;
		pointer-events: auto;
	}

	.session-loading p {
		margin: 0;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		color: color-mix(in srgb, #fff8df 86%, transparent);
	}

	.session-spinner {
		width: 2.15rem;
		height: 2.15rem;
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, #fff8df 18%, transparent);
		border-top-color: #fff8df;
		animation: session-spin 0.75s linear infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.session-spinner,
		.dl-spinner {
			animation: none;
			border-top-color: color-mix(in srgb, #fff8df 48%, transparent);
		}
	}

	@keyframes session-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.session-empty {
		display: grid;
		place-content: center;
		gap: 0.75rem;
		height: 100%;
		text-align: center;
		padding: 1.5rem;
	}

	.session-empty-title {
		font-size: var(--booth-text-md);
		color: var(--gold-bright);
		letter-spacing: 0.06em;
	}

	.session-empty-sub {
		font-size: var(--booth-text-sm);
		color: color-mix(in srgb, #fff8df 72%, transparent);
		line-height: 1.7;
		max-width: 22rem;
		margin: 0 auto;
	}

	.stage {
		position: relative;
		z-index: 1;
		min-height: 0;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(var(--booth-rail-width), 1fr);
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
		padding: clamp(0.25rem, 1vh, 0.75rem) clamp(0.25rem, 1vw, 0.65rem);
		container-type: size;
		container-name: studio-dock;
	}

	.frame-pedestal {
		position: relative;
		perspective: 1100px;
		perspective-origin: 50% 40%;
		overflow: visible;
		max-width: 100%;
		max-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.frame-pedestal::after {
		content: '';
		position: absolute;
		left: 8%;
		right: 8%;
		bottom: -10px;
		height: 18px;
		background: radial-gradient(
			ellipse at center,
			rgba(3, 12, 27, 0.45),
			transparent 72%
		);
		transform: rotateZ(var(--pedestal-tilt));
		pointer-events: none;
		z-index: -1;
	}

	.editor-shell {
		--entry-y: 0px;
		--entry-z: 0px;
		--entry-rx: 0deg;
		--entry-rz: 0deg;
		--entry-scale: 1;
		position: relative;
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 520px);
		max-height: 100cqh;
		height: auto;
		aspect-ratio: var(--frame-ar);
		overflow: hidden;
		background: #0a1220;
		padding: 0;
		transform-style: preserve-3d;
		transform-origin: 50% 80%;
		transform: translateY(var(--entry-y)) translateZ(var(--entry-z)) rotateX(var(--entry-rx))
			rotateZ(var(--entry-rz)) scale(var(--entry-scale));
		filter: drop-shadow(0 16px 28px rgba(3, 12, 27, 0.5))
			drop-shadow(6px 8px 0 color-mix(in srgb, var(--primary) 35%, transparent));
		will-change: transform, opacity;
		touch-action: none;
	}

	.editor-shell.is-narrow {
		width: min(100cqw, calc(100cqh * var(--frame-ar)), 340px);
	}

	.editor-shell.entry-busy {
		pointer-events: none;
	}

	.studio-view.handoff-pending .editor-shell {
		opacity: 0;
	}

	.sticker-rail {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-height: 0;
		height: 100%;
		max-height: 100%;
		width: 100%;
		overflow: visible;
		padding: 0.5rem 0.35rem 0.65rem 0.65rem;
		box-sizing: border-box;
	}

	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--booth-tile-min), 1fr));
		grid-auto-rows: calc(var(--booth-swatch) + var(--booth-sticker-label-h) + 0.85rem);
		align-content: start;
		gap: 0.5rem;
		overflow-y: auto;
		min-height: 0;
		flex: 1;
		padding-right: 0.15rem;
		scrollbar-width: thin;
	}

	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		align-self: stretch;
		height: 100%;
		min-height: 0;
		gap: 0.35rem;
		padding: 0.45rem 0.35rem;
		background: #102f56;
		border: 2px solid color-mix(in srgb, var(--gold) 45%, transparent);
		box-shadow: 2px 2px 0 #071936;
		color: #fff8df;
		font-size: var(--booth-text-xs);
		text-align: center;
		min-width: var(--booth-touch);
		min-height: var(--booth-touch);
	}

	.tile:disabled {
		opacity: 0.45;
		pointer-events: none;
	}

	.tile:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 #071936;
	}

	.swatch {
		width: var(--booth-swatch);
		height: var(--booth-swatch);
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, #fff 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--gold-bright) 35%, transparent);
	}

	.swatch img {
		width: calc(var(--booth-swatch) * 0.64);
		height: calc(var(--booth-swatch) * 0.64);
		object-fit: contain;
	}

	.label {
		flex: 0 0 var(--booth-sticker-label-h);
		height: var(--booth-sticker-label-h);
		width: 100%;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
		letter-spacing: 0.02em;
		line-height: 1.35;
		align-content: center;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: flex-start;
		flex-shrink: 0;
		padding: 0.15rem 0.35rem 0.35rem 0.15rem;
	}

	.sticker-rail :global(.dialog) {
		flex-shrink: 0;
		max-width: calc(100% - 0.25rem);
	}

	.booth-view :global(.pixel-btn) {
		min-height: var(--booth-touch);
		font-size: var(--booth-text-sm);
		padding: 0.85rem 1.35rem;
	}

	.booth-view :global(.dialog) {
		max-width: var(--booth-panel-max);
	}

	.booth-view :global(.dialog .speaker),
	.booth-view :global(.dialog .body) {
		font-size: var(--booth-text-sm);
		line-height: 1.75;
	}

	@media (max-width: 980px) {
		.studio-view:not(.mobile-session) .stage {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			align-items: start;
		}

		.studio-view:not(.mobile-session) .dock-column {
			justify-content: center;
			min-height: min(52dvh, 560px);
			max-height: min(52dvh, 560px);
		}
	}
</style>
