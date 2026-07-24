<section class="admin-view" bind:this={rootEl} class:exiting>
	<div class="sky-wash" aria-hidden="true"></div>
	<div class="stars" aria-hidden="true">
		<i></i><i></i><i></i><i></i><i></i><i></i><i></i>
	</div>
	<div class="mountains mountains-far" aria-hidden="true"></div>
	<div class="mountains mountains-near" aria-hidden="true"></div>
	<div class="forge-glow" aria-hidden="true"></div>

	<div class="content">
		<header class="head">
			<p class="eyebrow">HEPHAESTUS FORGE · LOCAL RELICS · CART 01</p>
			<h1>ADMIN ARMORY</h1>
			<p class="tagline">Forge frames & stickers for this booth — sealed in the tablet’s vault.</p>
		</header>

		{#if !unlocked}
			<div class="gate forge-panel">
				<DialogBox
					speaker="CERBERUS"
					text="Enter the Admin PIN to forge new relics. Default: olympus"
					typewriter={false}
				/>
				<label class="field">
					<span>PIN</span>
					<input
						type="password"
						bind:value={pinInput}
						autocomplete="off"
						onkeydown={(e) => e.key === 'Enter' && tryUnlock()}
					/>
				</label>
				{#if pinError}
					<p class="err">{pinError}</p>
				{/if}
				<div class="actions">
					<PixelButton label="UNLOCK" variant="gold" onclick={tryUnlock} />
					<PixelButton label="BACK" variant="ghost" onclick={goBack} />
				</div>
			</div>
		{:else}
			<div class="tabs" role="tablist" aria-label="Asset type">
				<button
					type="button"
					role="tab"
					class="tab"
					class:on={tab === 'frames'}
					aria-selected={tab === 'frames'}
					onclick={() => (tab = 'frames')}>FRAMES</button
				>
				<button
					type="button"
					role="tab"
					class="tab"
					class:on={tab === 'stickers'}
					aria-selected={tab === 'stickers'}
					onclick={() => (tab = 'stickers')}>STICKERS</button
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
					<p class="panel-kicker">ADD {tab === 'frames' ? 'FRAME' : 'STICKER'}</p>
					<label class="field">
						<span>Name</span>
						<input type="text" bind:value={uploadName} placeholder="Display name" />
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
						accept="image/png,.png"
						hidden
						onchange={onFileChosen}
					/>
					<PixelButton
						label={busy ? 'WAIT…' : 'CHOOSE IMAGE'}
						variant="accent"
						fullWidth
						disabled={busy}
						onclick={triggerUpload}
					/>
				</div>

				<div class="grid">
					{#each list as item, i (item.id)}
						<article
							class="card"
							class:seed={!item.custom}
							style:--i={i}
						>
							<div class="thumb">
								<img src={item.src} alt="" />
							</div>
							<div class="meta">
								<input
									class="name-edit"
									value={item.name}
									disabled={!item.custom || busy}
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
								{#if item.custom}
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
					<button
						type="button"
						class="seed-toggle"
						class:on={$showSeedStickers}
						aria-pressed={$showSeedStickers}
						onclick={() => {
							const next = !$showSeedStickers;
							setShowSeedStickers(next);
							status = next
								? 'Seed stickers ON — guests can pick blanks.'
								: 'Seed stickers OFF — guests see custom stickers only.';
						}}
					>
						<span class="seed-toggle-label">STICKERS</span>
						<span class="seed-toggle-state">{$showSeedStickers ? 'ON' : 'OFF'}</span>
					</button>
				</div>
			</div>

			<div class="footer-actions">
				<PixelButton label="EXPORT JSON" variant="ghost" disabled={busy} onclick={onExport} />
				<label class="import-btn">
					IMPORT JSON
					<input type="file" accept="application/json,.json" hidden onchange={onImport} />
				</label>
				<PixelButton
					label="CHANGE PIN"
					variant="ghost"
					onclick={() => (showPinChange = true)}
				/>
				<PixelButton label="EXIT ADMIN" variant="primary" onclick={goBack} />
			</div>
			<p class="hint">
				Seeds = shipped defaults (read-only). Customs live in this tablet’s IndexedDB. Seed toggles
				persist on this device and travel with EXPORT/IMPORT.
			</p>
		{/if}
	</div>
</section>

<script>
	import { go } from '../router/index.js';
	import { playViewExit } from '../lib/fx/viewExitMotion.js';
	import {
		frames,
		stickers,
		showSeedFrames,
		showSeedStickers,
		setShowSeedFrames,
		setShowSeedStickers,
		addFrame,
		addSticker,
		updateAsset,
		removeCustomAsset,
		exportCatalog,
		importCatalog,
		verifyAdminPin,
		getAdminPin,
		setAdminPin,
		fileToDataUrl,
		isPngFile
	} from '../lib/assets/assetStore.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import FrameSlotEditor from '../lib/components/FrameSlotEditor.svelte';
	import FrameCropEditor from '../lib/components/FrameCropEditor.svelte';

	/** @type {HTMLElement | undefined} */
	let rootEl = $state();
	let exiting = $state(false);
	let reduced = $state(
		typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);

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

	let unlocked = $state(false);
	let pinInput = $state('');
	let pinError = $state('');
	let tab = $state(/** @type {'frames' | 'stickers'} */ ('frames'));
	let status = $state('');
	let busy = $state(false);

	let uploadName = $state('');
	let uploadMotif = $state('');
	/** @type {HTMLInputElement | undefined} */
	let fileInput = $state();

	let showPinChange = $state(false);
	let newPin = $state('');

	/** @type {FrameDraft | null} */
	let frameDraft = $state(null);
	let editorError = $state('');

	function tryUnlock() {
		if (verifyAdminPin(pinInput.trim())) {
			unlocked = true;
			pinError = '';
			pinInput = '';
			status = '';
		} else {
			pinError = 'Wrong PIN. Default seed: olympus';
		}
	}

	async function goBack() {
		if (exiting) return;
		exiting = true;
		unlocked = false;
		pinInput = '';
		pinError = '';
		status = '';
		frameDraft = null;
		editorError = '';
		await playViewExit(rootEl, { reduced, direction: 'right' });
		go('landing');
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
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		if (!isPngFile(file)) {
			status = 'Frames and stickers must be PNG with transparency.';
			return;
		}

		busy = true;
		status = tab === 'frames' ? 'Loading frame…' : 'Uploading…';
		try {
			if (tab === 'frames') {
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
			} else {
				await addSticker({
					name: uploadName || file.name.replace(/\.[^.]+$/, ''),
					file
				});
				status = 'Sticker added.';
				uploadName = '';
			}
		} catch (err) {
			status = err instanceof Error ? err.message : 'Upload failed';
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

	const list = $derived(tab === 'frames' ? $frames : $stickers);
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

	.sky-wash {
		position: absolute;
		inset: 0;
		z-index: -4;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 18%),
			linear-gradient(180deg, var(--sky-top) 0%, var(--sky-mid) 55%, var(--sky-low) 140%);
		pointer-events: none;
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
		box-shadow:
			3px 0 #fff4bd,
			0 3px #fff4bd,
			3px 3px #fff4bd;
		animation: star-twinkle 2.8s steps(2) infinite;
	}

	.stars i:nth-child(1) {
		left: 8%;
		top: 12%;
	}
	.stars i:nth-child(2) {
		left: 22%;
		top: 28%;
		transform: scale(0.65);
		animation-delay: 0.4s;
	}
	.stars i:nth-child(3) {
		left: 38%;
		top: 9%;
		transform: scale(0.7);
		animation-delay: 1.1s;
	}
	.stars i:nth-child(4) {
		right: 34%;
		top: 18%;
		animation-delay: 0.7s;
	}
	.stars i:nth-child(5) {
		right: 18%;
		top: 8%;
		transform: scale(0.6);
		animation-delay: 1.6s;
	}
	.stars i:nth-child(6) {
		right: 7%;
		top: 26%;
		transform: scale(0.8);
		animation-delay: 0.2s;
	}
	.stars i:nth-child(7) {
		right: 12%;
		top: 42%;
		transform: scale(0.55);
		animation-delay: 2s;
	}

	.mountains {
		position: absolute;
		right: -5%;
		bottom: -1px;
		left: -5%;
		z-index: -2;
		height: 38%;
		clip-path: polygon(
			0 72%,
			8% 48%,
			15% 62%,
			25% 25%,
			36% 58%,
			47% 35%,
			58% 67%,
			70% 30%,
			80% 56%,
			91% 22%,
			100% 61%,
			100% 100%,
			0 100%
		);
		background: #102f56;
		pointer-events: none;
	}

	.mountains-far {
		bottom: 5%;
		opacity: 0.78;
		background: #31577a;
	}

	.mountains-near {
		z-index: -1;
		height: 28%;
		clip-path: polygon(
			0 62%,
			13% 37%,
			24% 71%,
			39% 27%,
			52% 65%,
			67% 38%,
			81% 74%,
			93% 40%,
			100% 58%,
			100% 100%,
			0 100%
		);
	}

	.forge-glow {
		position: absolute;
		left: 50%;
		bottom: 0;
		z-index: -1;
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
		z-index: 1;
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

	.gate {
		max-width: 28rem;
		margin: 0.35rem auto 0;
		width: 100%;
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

	.thumb {
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

	@keyframes star-twinkle {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
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
		.stars i,
		.forge-glow,
		.content,
		.forge-panel,
		.card {
			animation: none;
		}
	}
</style>
