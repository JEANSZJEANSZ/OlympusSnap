<div class="catalog">
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
				<p class="seed-copy">
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
				<p class="seed-copy">
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
				{@attach attachFileInput}
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
				<PixelButton label="CANCEL" variant="ghost" disabled={busy} onclick={exitSelectMode} />
				{#if selectedIds.length > 0}
					<PixelButton
						label={`DELETE SELECTED (${selectedIds.length})`}
						variant="ghost"
						disabled={busy}
						onclick={onDeleteSelected}
					/>
				{/if}
			{:else}
				<PixelButton label="SELECT" variant="ghost" disabled={busy} onclick={enterSelectMode} />
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
</div>

<script>
	import {
		addFrame,
		addStickers,
		catalogError,
		fileToDataUrl,
		frames,
		isAssetImageFile,
		removeCustomAsset,
		stickers,
		updateAsset
	} from '../assets/assetStore.js';
	import FrameCropEditor from './FrameCropEditor.svelte';
	import FrameSlotEditor from './FrameSlotEditor.svelte';
	import PixelButton from './PixelButton.svelte';

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

	let tab = $state(/** @type {'frames' | 'stickers'} */ ('frames'));
	let busy = $state(false);
	let status = $state('');
	let selectMode = $state(false);
	let selectedIds = $state(/** @type {string[]} */ ([]));
	let uploadName = $state('');
	let uploadMotif = $state('');
	/** @type {HTMLInputElement | undefined} */
	let fileInput = $state();
	/** @type {import('svelte/attachments').Attachment<HTMLInputElement>} */
	function attachFileInput(element) {
		fileInput = element;
		return () => {
			if (fileInput === element) fileInput = undefined;
		};
	}
	/** @type {FrameDraft | null} */
	let frameDraft = $state(null);
	let editorError = $state('');

	const list = $derived(tab === 'frames' ? $frames : $stickers);

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

	/** @param {{ src: string; w: number; h: number }} result */
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
		const ids = [...selectedIds];
		const n = ids.length;
		const label = tab === 'stickers' ? `sticker${n === 1 ? '' : 's'}` : `frame${n === 1 ? '' : 's'}`;
		if (!confirm(`Delete ${n} custom ${label}?`)) return;
		busy = true;
		try {
			let index = 0;
			for (const id of ids) {
				index += 1;
				const item = list.find((x) => x.id === id);
				status = `Deleting ${index}/${n}: ${item?.name ?? id}…`;
				await removeCustomAsset(id);
			}
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
</script>

<style>
	.catalog {
		--cream: #f7f3ea;
		--cream-ink: #1a2438;
		--ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
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

	.seed-copy {
		margin: 0;
		font-size: 0.4rem;
		line-height: 1.7;
		color: var(--cream-ink);
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
		background: linear-gradient(135deg, #e8eef6 0%, #d6dde8 100%);
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
		background: linear-gradient(135deg, #e8eef6 0%, #d6dde8 100%);
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
		.forge-panel,
		.card {
			animation: none;
		}
	}
</style>
