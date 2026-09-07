<section class="admin-view" bind:this={rootEl} class:exiting>
	<BoothOlympusBackdrop />
	<div class="back-veil" aria-hidden="true"></div>
	<div class="forge-glow" aria-hidden="true"></div>

	<div class="content">
		<header class="head">
			<p class="eyebrow">HEPHAESTUS FORGE · LOCAL RELICS · CART 01</p>
			<h1>ADMIN ARMORY</h1>
			<p class="tagline">
				Forge frames & stickers for this booth — {cloudEnabled
					? 'synced to the cloud forge'
					: 'sealed in the tablet’s vault'}.
			</p>
		</header>

			<div class="tabs" role="tablist" aria-label="Asset type">
				<button
					type="button"
					role="tab"
					class="tab"
					class:on={tab === 'frames'}
					aria-selected={tab === 'frames'}
					onclick={() => switchTab('frames')}>FRAMES</button
				>
				<button
					type="button"
					role="tab"
					class="tab"
					class:on={tab === 'stickers'}
					aria-selected={tab === 'stickers'}
					onclick={() => switchTab('stickers')}>STICKERS</button
				>
			</div>

			{#if frameDraft}
				<div class="editor-panel forge-panel">
					{#if frameDraft.step === 'crop'}
						<p class="panel-kicker">CROP FRAME</p>
						<label class="field">
							<span>Name</span>
							<input type="text" bind:value={frameDraft.name} placeholder="Display name" />
						</label>
						<label class="field">
							<span>Motif</span>
							<input type="text" bind:value={frameDraft.motif} placeholder="Optional tag" />
						</label>
						<p class="hint">
							Crop trims excess border. Photo canvases are placed on the trimmed image.
						</p>
						{#key frameDraft.src}
							<FrameCropEditor
								imageSrc={frameDraft.src}
								onApply={onCropReady}
								onUseFull={onCropReady}
							/>
						{/key}
						<div class="actions">
							<PixelButton
								label="CANCEL"
								variant="ghost"
								disabled={busy}
								onclick={cancelFrameDraft}
							/>
						</div>
					{:else}
						<p class="panel-kicker">
							{frameDraft.mode === 'edit' ? 'EDIT FRAME CANVASES' : 'PLACE PHOTO CANVASES'}
						</p>
						<label class="field">
							<span>Name</span>
							<input type="text" bind:value={frameDraft.name} placeholder="Display name" />
						</label>
						<label class="field">
							<span>Motif</span>
							<input type="text" bind:value={frameDraft.motif} placeholder="Optional tag" />
						</label>
						<p class="hint">
							Drawn rectangles are the photo windows — captures paint on top of those areas.
						</p>
						{#key frameDraft.src}
							<FrameSlotEditor imageSrc={frameDraft.src} bind:slots={frameDraft.slots} />
						{/key}
						{#if editorError}
							<p class="err">{editorError}</p>
						{/if}
						<div class="actions">
							{#if frameDraft.mode === 'edit'}
								<PixelButton
									label="RE-CROP"
									variant="ghost"
									disabled={busy}
									onclick={startRecrop}
								/>
							{/if}
							<PixelButton
								label={busy ? 'WAIT…' : 'SAVE'}
								variant="gold"
								disabled={busy}
								onclick={saveFrameDraft}
							/>
							<PixelButton
								label="CANCEL"
								variant="ghost"
								disabled={busy}
								onclick={cancelFrameDraft}
							/>
						</div>
					{/if}
				</div>
			{:else}
				<div class="upload forge-panel">
					<p class="panel-kicker">ADD {tab === 'frames' ? 'FRAME' : 'STICKERS'}</p>
					<label class="field">
						<span>Name</span>
						<input
							type="text"
							bind:value={uploadName}
							placeholder={tab === 'stickers'
								? 'Optional — single upload only'
								: 'Display name'}
						/>
					</label>
					{#if tab === 'frames'}
						<label class="field">
							<span>Motif</span>
							<input type="text" bind:value={uploadMotif} placeholder="Optional tag" />
						</label>
					{/if}
					<input
						bind:this={fileInput}
						type="file"
						accept="image/png,image/webp,.png,.webp"
						multiple={tab === 'stickers'}
						hidden
						onchange={onFileChosen}
					/>
					<PixelButton
						label={busy ? 'WAIT…' : tab === 'stickers' ? 'CHOOSE IMAGES' : 'CHOOSE IMAGE'}
						variant="accent"
						fullWidth
						disabled={busy}
						onclick={triggerUpload}
					/>
				</div>

				<div class="grid-toolbar">
					{#if selectMode}
						<PixelButton
							label="CANCEL"
							variant="ghost"
							disabled={busy}
							onclick={exitSelectMode}
						/>
						{#if selectedIds.length > 0}
							<PixelButton
								label={`DELETE SELECTED (${selectedIds.length})`}
								variant="ghost"
								disabled={busy}
								onclick={onDeleteSelected}
							/>
						{/if}
					{:else}
						<PixelButton
							label="SELECT"
							variant="ghost"
							disabled={busy}
							onclick={enterSelectMode}
						/>
					{/if}
				</div>

				<div class="grid">
					{#each list as item, i (item.id)}
						<article
							class="card"
							class:seed={!item.custom}
							class:selected={selectMode && selectedIds.includes(item.id)}
							class:selectable={selectMode && item.custom}
							style:--i={i}
						>
							{#if selectMode && item.custom}
								<button
									type="button"
									class="select-hit"
									aria-pressed={selectedIds.includes(item.id)}
									aria-label={`Select ${item.name}`}
									onclick={() => toggleSelect(item.id)}
								>
									<span
										class="select-mark"
										class:checked={selectedIds.includes(item.id)}
										aria-hidden="true"
									>
										{#if selectedIds.includes(item.id)}✓{/if}
									</span>
									<img src={item.src} alt="" />
								</button>
							{:else}
								<div class="thumb">
									<img src={item.src} alt="" />
								</div>
							{/if}
							<div class="meta">
								<input
									class="name-edit"
									value={item.name}
									disabled={!item.custom || busy || selectMode}
									onchange={(e) => {
										const v = /** @type {HTMLInputElement} */ (e.currentTarget).value;
										if (!item.custom) return;
										if (tab === 'frames') {
											const motif = 'motif' in item ? item.motif : undefined;
											onRename(item.id, v, motif);
										} else {
											onRename(item.id, v);
										}
									}}
								/>
								<span class="badge" class:custom={item.custom}
									>{item.custom ? 'CUSTOM' : 'SEED'}</span
								>
								{#if item.custom && !selectMode}
									<div class="card-actions">
										{#if tab === 'frames'}
											<button
												type="button"
												class="edit-slots"
												disabled={busy}
												onclick={() => openEditCanvases(item)}>EDIT CANVASES</button
											>
										{/if}
										<button
											type="button"
											class="del"
											disabled={busy}
											onclick={() => onDelete(item.id, true)}>DEL</button
										>
									</div>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			{/if}

			{#if $catalogError}
				<p class="status" role="alert">Cloud catalog down: {$catalogError}</p>
			{/if}
			{#if status}
				<p class="status" role="status">{status}</p>
			{/if}

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
					Shipped blanks for testing. Turn off for live booths that only use custom uploads.
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
								: 'Seed frames OFF — guests see custom frames only.';
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
					Random Frame skips pull-to-select. Pythia chooses a relic on the Delphi altar.
					Gesture Snap lets guests hold the pose shown on Camera for each canvas
					(victory / stop / thumbs up) to start the rite (SNAP stays). Gesture Pick lets guests swipe an open palm left/right to change
					the relic; make a fist and pull down to tug the rope (oracle ignores it). Booth flow toggles
					persist for this browser tab session.
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
								? 'Gesture Pick ON — open-palm swipe relics, fist then pull down to drop.'
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
					{cloudEnabled
						? 'Photobooth Auth is verified with the forge and kept for this tab. Log out to seal the booth again.'
						: 'This tablet is unlocked with the Admin PIN for this tab. Log out to seal the booth again.'}
				</p>
				{#if cloudEnabled}
					<label class="field">
						<span>API AUTH</span>
						<input
							type="password"
							bind:value={authInput}
							autocomplete="off"
							placeholder="Update Auth header"
						/>
					</label>
					{#if authError}
						<p class="err">{authError}</p>
					{/if}
					<div class="actions">
						<PixelButton
							label={authBusy ? 'CHECKING…' : 'SAVE AUTH'}
							variant="gold"
							disabled={authBusy}
							onclick={saveAuth}
						/>
						<PixelButton label="LOG OUT" variant="ghost" onclick={onLogout} />
					</div>
				{:else}
					<div class="actions">
						<PixelButton label="LOG OUT" variant="ghost" onclick={onLogout} />
					</div>
				{/if}
			</div>

			{#if cloudEnabled}
				<div class="recent-panel forge-panel">
					<p class="panel-kicker">RECENT CAPTURES</p>
					{#if recentError}
						<p class="hint">{recentError}</p>
					{:else if !recent?.length}
						<p class="hint">No recent captures (or API restarted).</p>
					{:else}
						<ul class="recent-grid">
							{#each recent as item (item.id)}
								<li>
									{#if item.previewBase64}
										<img src={`data:image/png;base64,${item.previewBase64}`} alt="" />
									{/if}
									<span>{item.frameId}</span>
									<span>{item.createdAt}</span>
								</li>
							{/each}
						</ul>
					{/if}
					<PixelButton label="REFRESH" variant="ghost" onclick={refreshRecent} />
				</div>
			{/if}

			<div class="footer-actions">
				{#if cloudEnabled}
					<PixelButton
						label="UPLOAD LOCAL → CLOUD"
						variant="ghost"
						disabled={busy}
						onclick={onUploadLocalToCloud}
					/>
				{/if}
				<PixelButton label="EXPORT JSON" variant="ghost" disabled={busy} onclick={onExport} />
				<label class="import-btn">
					IMPORT JSON
					<input type="file" accept="application/json,.json" hidden onchange={onImport} />
				</label>
				{#if !cloudEnabled}
					<PixelButton
						label="CHANGE PIN"
						variant="ghost"
						onclick={() => (showPinChange = true)}
					/>
				{/if}
				<PixelButton label="EXIT ADMIN" variant="primary" onclick={goBack} />
			</div>
			<p class="hint">
				Seeds = shipped defaults (read-only). Customs live in {cloudEnabled
					? 'OpenHouse Photobooth API when VITE_API_BASE is set'
					: 'this tablet’s IndexedDB'}. Seed toggles persist on this device and travel with
				EXPORT/IMPORT.
			</p>
	</div>
</section>

<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { adminReturnTo, go } from '../router/index.js';
	import { createAdminExitMotion, playAdminExitOnce } from '../lib/fx/adminExitMotion.js';
	import {
		frames,
		stickers,
		catalogError,
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
		addFrame,
		addStickers,
		updateAsset,
		removeCustomAsset,
		removeCustomAssets,
		exportCatalog,
		importCatalog,
		uploadLocalCustomsToCloud,
		isCloudAssetsEnabled,
		getAdminPin,
		setAdminPin,
		fileToDataUrl,
		isAssetImageFile
	} from '../lib/assets/assetStore.js';
	import { getAdminAuth, setAdminAuth } from '../lib/assets/adminAuth.js';
	import { listRecentCaptures, verifyAdminAuth } from '../lib/assets/assetApi.js';
	import { lockBooth } from '../lib/assets/boothSession.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import BoothOlympusBackdrop from '../lib/components/BoothOlympusBackdrop.svelte';
	import FrameSlotEditor from '../lib/components/FrameSlotEditor.svelte';
	import FrameCropEditor from '../lib/components/FrameCropEditor.svelte';

	/** @type {HTMLElement | undefined} */
	let rootEl = $state();
	let exiting = $state(false);
	let reduced = $state(
		typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);

	let recent = $state(/** @type {import('../lib/assets/assetApi.js').RecentCapture[]} */ ([]));
	let recentError = $state('');

	async function refreshRecent() {
		if (!isCloudAssetsEnabled()) return;
		try {
			recent = await listRecentCaptures();
			recentError = '';
		} catch (e) {
			recentError = e instanceof Error ? e.message : 'Failed to load recent captures';
			recent = [];
		}
	}

	/**
	 * @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot
	 * @typedef {{
	 *   mode: 'create' | 'edit';
	 *   step: 'crop' | 'slots';
	 *   id?: string;
	 *   name: string;
	 *   motif: string;
	 *   src: string;
	 *   w?: number;
	 *   h?: number;
	 *   slots: FrameSlot[];
	 * }} FrameDraft
	 */

	let authInput = $state(getAdminAuth());
	let authError = $state('');
	let authBusy = $state(false);
	let tab = $state(/** @type {'frames' | 'stickers'} */ ('frames'));
	let status = $state('');
	let busy = $state(false);
	let selectMode = $state(false);
	let selectedIds = $state(/** @type {string[]} */ ([]));

	let uploadName = $state('');
	let uploadMotif = $state('');
	/** @type {HTMLInputElement | undefined} */
	let fileInput = $state();

	let showPinChange = $state(false);
	let newPin = $state('');

	/** @type {FrameDraft | null} */
	let frameDraft = $state(null);
	let editorError = $state('');

	async function saveAuth() {
		if (authBusy) return;
		const auth = authInput.trim();
		if (!auth) {
			authError = 'API Auth required for cloud forge writes.';
			return;
		}
		authBusy = true;
		authError = '';
		const prev = getAdminAuth();
		setAdminAuth(auth);
		try {
			const ok = await verifyAdminAuth();
			if (!ok) {
				setAdminAuth(prev);
				authError = 'Auth rejected by the forge.';
				status = '';
				return;
			}
			status = 'Photobooth Auth saved for this tab.';
		} catch (e) {
			setAdminAuth(prev);
			authError = e instanceof Error ? e.message : 'Could not verify Auth.';
		} finally {
			authBusy = false;
		}
	}

	function onLogout() {
		lockBooth();
		go('landing');
	}

	/** @type {null | ReturnType<typeof createAdminExitMotion>} */
	let exitMotion = null;

	onMount(() => {
		void refreshRecent();
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

	function triggerUpload() {
		fileInput?.click();
	}

	function cancelFrameDraft() {
		frameDraft = null;
		editorError = '';
		status = '';
	}

	/**
	 * @param {{ id: string; name: string; src: string; motif?: string; w?: number; h?: number; slots?: FrameSlot[]; custom?: boolean }} item
	 */
	function openEditCanvases(item) {
		if (!item.custom) {
			status = 'Seed frames are read-only.';
			return;
		}
		editorError = '';
		frameDraft = {
			mode: 'edit',
			step: 'slots',
			id: item.id,
			name: item.name,
			motif: item.motif ?? '',
			src: item.src,
			w: item.w,
			h: item.h,
			slots: (item.slots ?? []).map((s) => ({ ...s }))
		};
	}

	function startRecrop() {
		if (!frameDraft) return;
		frameDraft = { ...frameDraft, step: 'crop' };
	}

	/**
	 * @param {{ src: string; w: number; h: number }} result
	 */
	function onCropReady(result) {
		if (!frameDraft) return;
		const changed = frameDraft.src !== result.src;
		frameDraft = {
			...frameDraft,
			step: 'slots',
			src: result.src,
			w: result.w,
			h: result.h,
			slots: changed ? [] : frameDraft.slots
		};
		status = changed
			? 'Crop applied — draw photo canvases on the trimmed frame.'
			: 'Frame ready — draw photo canvases.';
	}

	async function saveFrameDraft() {
		if (!frameDraft) return;
		if (frameDraft.slots.length < 1) {
			editorError = 'Add at least one photo canvas.';
			return;
		}
		busy = true;
		editorError = '';
		try {
			if (frameDraft.mode === 'create') {
				await addFrame({
					name: frameDraft.name,
					motif: frameDraft.motif || undefined,
					src: frameDraft.src,
					w: frameDraft.w,
					h: frameDraft.h,
					slots: frameDraft.slots
				});
				status = 'Frame added.';
				uploadName = '';
				uploadMotif = '';
			} else if (frameDraft.id) {
				await updateAsset(frameDraft.id, {
					name: frameDraft.name,
					motif: frameDraft.motif || undefined,
					src: frameDraft.src,
					w: frameDraft.w,
					h: frameDraft.h,
					slots: frameDraft.slots
				});
				status = 'Frame updated.';
			}
			frameDraft = null;
		} catch (err) {
			editorError = err instanceof Error ? err.message : 'Save failed';
		} finally {
			busy = false;
		}
	}

	/** @param {Event} e */
	async function onFileChosen(e) {
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (!files.length) return;

		if (tab === 'frames') {
			const file = files[0];
			if (!isAssetImageFile(file)) {
				status = 'Frames and stickers must be PNG or WebP.';
				return;
			}

			busy = true;
			status = 'Loading frame…';
			try {
				const src = await fileToDataUrl(file);
				editorError = '';
				frameDraft = {
					mode: 'create',
					step: 'crop',
					name: uploadName || file.name.replace(/\.[^.]+$/, ''),
					motif: uploadMotif,
					src,
					slots: []
				};
				status = 'Crop your frame, then place photo canvases.';
			} catch (err) {
				status = err instanceof Error ? err.message : 'Upload failed';
			} finally {
				busy = false;
			}
			return;
		}

		const valid = files.filter((file) => isAssetImageFile(file));
		const skipped = files.length - valid.length;
		if (!valid.length) {
			status = 'Stickers must be PNG or WebP.';
			return;
		}

		busy = true;
		status = valid.length > 1 ? `Uploading ${valid.length} stickers…` : 'Uploading…';
		try {
			const items = valid.map((file) => ({
				name:
					valid.length === 1 && uploadName.trim()
						? uploadName.trim()
						: file.name.replace(/\.[^.]+$/, ''),
				file
			}));
			await addStickers(items);
			status =
				skipped > 0
					? `Added ${valid.length} sticker(s). ${skipped} skipped (not PNG/WebP).`
					: valid.length > 1
						? `Added ${valid.length} stickers.`
						: 'Sticker added.';
			uploadName = '';
		} catch (err) {
			status = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			busy = false;
		}
	}

	/** @param {'frames' | 'stickers'} next */
	function switchTab(next) {
		tab = next;
		exitSelectMode();
	}

	function enterSelectMode() {
		selectMode = true;
		selectedIds = [];
	}

	function exitSelectMode() {
		selectMode = false;
		selectedIds = [];
	}

	/** @param {string} id */
	function toggleSelect(id) {
		if (!selectMode) return;
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((x) => x !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}

	async function onDeleteSelected() {
		if (!selectedIds.length) return;
		const n = selectedIds.length;
		const label =
			tab === 'stickers'
				? `sticker${n === 1 ? '' : 's'}`
				: `frame${n === 1 ? '' : 's'}`;
		if (!confirm(`Delete ${n} custom ${label}?`)) return;
		busy = true;
		try {
			await removeCustomAssets(selectedIds, {
				onProgress: ({ index, total, name }) => {
					status = `Deleting ${index}/${total}: ${name}…`;
				}
			});
			status = `Deleted ${n}.`;
			exitSelectMode();
		} catch (err) {
			status = err instanceof Error ? err.message : 'Delete failed';
		} finally {
			busy = false;
		}
	}

	/**
	 * @param {string} id
	 * @param {boolean} isCustom
	 */
	async function onDelete(id, isCustom) {
		if (!isCustom) {
			status = 'Seed assets are read-only.';
			return;
		}
		if (!confirm('Delete this custom asset?')) return;
		busy = true;
		try {
			await removeCustomAsset(id);
			status = 'Deleted.';
		} catch (err) {
			status = err instanceof Error ? err.message : 'Delete failed';
		} finally {
			busy = false;
		}
	}

	/**
	 * @param {string} id
	 * @param {string} name
	 * @param {string} [motif]
	 */
	async function onRename(id, name, motif) {
		busy = true;
		try {
			await updateAsset(id, { name, motif });
			status = 'Renamed.';
		} catch (err) {
			status = err instanceof Error ? err.message : 'Rename failed';
		} finally {
			busy = false;
		}
	}

	async function onExport() {
		busy = true;
		try {
			const payload = await exportCatalog();
			const blob = new Blob([JSON.stringify(payload, null, 2)], {
				type: 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `olympus-snap-catalog-${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);
			status = 'Exported catalog JSON.';
		} catch (err) {
			status = err instanceof Error ? err.message : 'Export failed';
		} finally {
			busy = false;
		}
	}

	/** @param {Event} e */
	async function onImport(e) {
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		try {
			const text = await file.text();
			const json = JSON.parse(text);
			await importCatalog(json);
			status = 'Imported catalog (customs replaced).';
		} catch (err) {
			status = err instanceof Error ? err.message : 'Import failed';
		} finally {
			busy = false;
		}
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

	const cloudEnabled = isCloudAssetsEnabled();
	const list = $derived(tab === 'frames' ? $frames : $stickers);

	async function onUploadLocalToCloud() {
		if (!confirm('Upload IndexedDB customs to Photobooth? Skips name+kind already on the server.')) return;
		busy = true;
		try {
			const { uploaded, skipped } = await uploadLocalCustomsToCloud();
			status = `Cloud sync: ${uploaded} uploaded, ${skipped} skipped.`;
		} catch (err) {
			status = err instanceof Error ? err.message : 'Cloud upload failed';
		} finally {
			busy = false;
		}
	}
</script>

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

	.field input,
	.name-edit {
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

	.field input:focus-visible,
	.name-edit:focus-visible {
		outline: 3px solid var(--gold-bright);
		outline-offset: 2px;
	}

	.field input::placeholder,
	.name-edit::placeholder {
		color: color-mix(in srgb, var(--cream-ink) 45%, transparent);
	}

	.err {
		font-size: 0.45rem;
		color: var(--danger);
		margin: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: center;
	}

	.tabs {
		display: flex;
		gap: 0.55rem;
		justify-content: center;
	}

	.tab {
		padding: 0.7rem 1.15rem;
		min-height: 2.75rem;
		font-family: var(--font-pixel);
		font-size: clamp(0.45rem, 1.2vw, 0.55rem);
		letter-spacing: 0.08em;
		background: #8e2f36;
		color: #fff4cf;
		border: 3px solid var(--gold);
		box-shadow:
			4px 4px 0 #07152d,
			inset 0 0 0 2px #c86c52;
		transition:
			transform 60ms steps(2),
			box-shadow 60ms steps(2),
			filter 80ms;
	}

	.tab:not(.on) {
		background: color-mix(in srgb, #102f56 88%, #fff);
		border-color: #d29a43;
		box-shadow:
			4px 4px 0 #07152d,
			inset 0 0 0 2px #31577a;
		color: #f3d9bb;
	}

	.tab.on {
		background: #8e2f36;
		color: var(--gold-bright);
		filter: brightness(1.05);
	}

	.tab:hover {
		filter: brightness(1.08);
	}

	.tab:active {
		transform: translate(3px, 3px);
		box-shadow:
			1px 1px 0 #07152d,
			inset 0 0 0 2px #c86c52;
	}

	.tab:focus-visible {
		outline: 3px solid #fff8df;
		outline-offset: 3px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
		gap: 0.85rem;
	}

	.grid-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.65rem;
	}

	.card {
		background: var(--cream);
		color: var(--cream-ink);
		box-shadow:
			0 0 0 3px #0f172a,
			0 0 0 6px color-mix(in srgb, var(--gold) 85%, #fff),
			5px 5px 0 #07152d;
		padding: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		animation: card-rise 0.4s var(--ease-expo) both;
		animation-delay: calc(var(--i, 0) * 40ms);
	}

	.card.seed {
		opacity: 0.9;
	}

	.card.selectable {
		cursor: pointer;
	}

	.card.selected {
		box-shadow:
			0 0 0 3px #0f172a,
			0 0 0 6px var(--gold-bright),
			5px 5px 0 #07152d;
	}

	.thumb {
		position: relative;
		background:
			linear-gradient(135deg, #e8eef6 0%, #d6dde8 100%);
		box-shadow: inset 0 0 0 2px #0f172a;
		padding: 0.35rem;
	}

	.card img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
	}

	.select-hit {
		position: relative;
		display: block;
		width: 100%;
		padding: 0.35rem;
		border: 0;
		cursor: pointer;
		text-align: inherit;
		background:
			linear-gradient(135deg, #e8eef6 0%, #d6dde8 100%);
		box-shadow: inset 0 0 0 2px #0f172a;
	}

	.select-hit img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
	}

	.select-mark {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		z-index: 1;
		width: 1.1rem;
		height: 1.1rem;
		display: grid;
		place-items: center;
		font-size: 0.65rem;
		line-height: 1;
		background: color-mix(in srgb, #fff 88%, transparent);
		color: #0f172a;
		box-shadow: 0 0 0 2px #0f172a;
	}

	.select-mark.checked {
		background: var(--gold-bright);
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.name-edit {
		width: 100%;
		font-size: 0.4rem;
		padding: 0.45rem;
	}

	.badge {
		align-self: flex-start;
		font-size: 0.34rem;
		letter-spacing: 0.1em;
		padding: 0.25rem 0.4rem;
		background: #102f56;
		color: #f3d9bb;
		box-shadow: 2px 2px 0 #07152d;
	}

	.badge.custom {
		background: var(--primary);
		color: var(--gold-bright);
	}

	.card-actions {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.edit-slots,
	.del {
		font-family: var(--font-pixel);
		font-size: 0.35rem;
		padding: 0.45rem;
		letter-spacing: 0.04em;
		box-shadow: 2px 2px 0 #07152d;
		transition:
			transform 60ms steps(2),
			box-shadow 60ms steps(2);
	}

	.edit-slots {
		background: var(--primary);
		color: var(--gold-bright);
		border: 2px solid var(--gold);
	}

	.del {
		background: var(--danger);
		color: #fff8df;
		border: 2px solid var(--gold);
	}

	.edit-slots:active:not(:disabled),
	.del:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: 0 0 0 #07152d;
	}

	.edit-slots:focus-visible,
	.del:focus-visible {
		outline: 3px solid var(--gold-bright);
		outline-offset: 2px;
	}

	.status {
		font-size: 0.45rem;
		color: var(--gold-bright);
		text-align: center;
		text-shadow: 2px 2px 0 #06152d;
		margin: 0;
	}

	.recent-panel {
		gap: 0.75rem;
	}

	.recent-panel .hint {
		text-align: left;
		text-shadow: none;
		color: color-mix(in srgb, var(--cream-ink) 72%, transparent);
	}

	.recent-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.65rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.recent-grid li {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		background: #fffdf8;
		padding: 0.45rem;
		box-shadow:
			0 0 0 2px #0f172a,
			3px 3px 0 var(--primary);
	}

	.recent-grid img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
		background: linear-gradient(135deg, #e8eef6 0%, #d6dde8 100%);
		box-shadow: inset 0 0 0 2px #0f172a;
	}

	.recent-grid span {
		font-size: 0.32rem;
		letter-spacing: 0.04em;
		line-height: 1.4;
		color: color-mix(in srgb, var(--cream-ink) 78%, transparent);
		word-break: break-all;
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

	.import-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.9rem 1.25rem;
		min-height: 3.25rem;
		font-family: var(--font-pixel);
		font-size: clamp(0.55rem, 1.5vw, 0.7rem);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-btn);
		cursor: pointer;
		transition:
			transform 60ms steps(2),
			box-shadow 60ms steps(2),
			filter 80ms;
	}

	.import-btn:hover {
		filter: brightness(1.08);
	}

	.import-btn:active {
		transform: translate(3px, 3px);
		box-shadow: var(--shadow-btn-press);
	}

	.import-btn:focus-within {
		outline: 3px solid var(--gold);
		outline-offset: 3px;
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

	@keyframes card-rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.forge-glow,
		.content,
		.forge-panel,
		.card {
			animation: none;
		}
	}
</style>
