<section class="view">
	<header class="head">
		<h1>ADMIN ARMORY</h1>
		<p>Frames & stickers · local booth storage</p>
	</header>

	{#if !unlocked}
		<div class="gate pixel-panel">
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
		<div class="tabs">
			<button
				type="button"
				class="tab"
				class:on={tab === 'frames'}
				onclick={() => (tab = 'frames')}>FRAMES</button
			>
			<button
				type="button"
				class="tab"
				class:on={tab === 'stickers'}
				onclick={() => (tab = 'stickers')}>STICKERS</button
			>
		</div>

		<div class="upload pixel-panel">
			<p class="upload-title">ADD {tab === 'frames' ? 'FRAME' : 'STICKER'}</p>
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
				accept="image/png,image/svg+xml,image/webp,image/jpeg"
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
			{#each list as item (item.id)}
				<article class="card" class:seed={!item.custom}>
					<img src={item.src} alt="" />
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
						<span class="badge">{item.custom ? 'CUSTOM' : 'SEED'}</span>
						{#if item.custom}
							<button
								type="button"
								class="del"
								disabled={busy}
								onclick={() => onDelete(item.id, true)}>DEL</button
							>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		{#if status}
			<p class="status">{status}</p>
		{/if}

		{#if showPinChange}
			<div class="pin-change pixel-panel">
				<label class="field">
					<span>New PIN (was set)</span>
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
		<p class="hint">Seeds = shipped defaults (read-only). Customs live in this tablet’s IndexedDB.</p>
	{/if}
</section>

<script>
	import { go } from '../router/index.js';
	import {
		frames,
		stickers,
		addFrame,
		addSticker,
		updateAsset,
		removeCustomAsset,
		exportCatalog,
		importCatalog,
		verifyAdminPin,
		getAdminPin,
		setAdminPin
	} from '../lib/assets/assetStore.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';

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

	function goBack() {
		unlocked = false;
		pinInput = '';
		pinError = '';
		status = '';
		go('landing');
	}

	function triggerUpload() {
		fileInput?.click();
	}

	/** @param {Event} e */
	async function onFileChosen(e) {
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		busy = true;
		status = 'Uploading…';
		try {
			if (tab === 'frames') {
				await addFrame({
					name: uploadName || file.name.replace(/\.[^.]+$/, ''),
					motif: uploadMotif || undefined,
					file
				});
				status = 'Frame added.';
			} else {
				await addSticker({
					name: uploadName || file.name.replace(/\.[^.]+$/, ''),
					file
				});
				status = 'Sticker added.';
			}
			uploadName = '';
			uploadMotif = '';
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
	.view {
		height: 100%;
		overflow: auto;
		padding: 1rem 1.15rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 920px;
		margin: 0 auto;
	}

	.head {
		text-align: center;
	}

	.head h1 {
		font-size: clamp(0.8rem, 2.8vw, 1.05rem);
		color: var(--primary);
	}

	.head p {
		margin-top: 0.3rem;
		font-size: 0.45rem;
		color: var(--ink-soft);
	}

	.gate {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
		max-width: 28rem;
		margin: 1rem auto 0;
		width: 100%;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.45rem;
		color: var(--ink-soft);
	}

	.field input,
	.name-edit {
		font-family: var(--font-pixel);
		font-size: 0.55rem;
		padding: 0.65rem 0.75rem;
		border: none;
		background: var(--bg-base);
		color: var(--text);
		box-shadow:
			0 0 0 3px var(--text),
			3px 3px 0 var(--primary);
	}

	.err {
		font-size: 0.45rem;
		color: var(--danger);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: center;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	.tab {
		padding: 0.65rem 1rem;
		font-family: var(--font-pixel);
		font-size: 0.5rem;
		background: var(--surface);
		box-shadow: var(--shadow-btn);
		color: var(--text);
	}

	.tab.on {
		background: var(--primary);
		color: var(--gold-bright);
	}

	.upload {
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.upload-title {
		font-size: 0.5rem;
		color: var(--primary);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.75rem;
	}

	.card {
		background: var(--surface);
		box-shadow: var(--shadow-panel);
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.card.seed {
		opacity: 0.92;
	}

	.card img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: contain;
		background: var(--bg-base);
		box-shadow: inset 0 0 0 2px var(--text);
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.name-edit {
		width: 100%;
		font-size: 0.4rem;
		padding: 0.4rem;
	}

	.badge {
		font-size: 0.35rem;
		color: var(--gold);
	}

	.del {
		font-family: var(--font-pixel);
		font-size: 0.4rem;
		padding: 0.4rem;
		background: var(--danger);
		color: var(--bg-base);
		box-shadow: 2px 2px 0 var(--text);
	}

	.status {
		font-size: 0.45rem;
		color: var(--accent);
		text-align: center;
	}

	.pin-change {
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.footer-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		justify-content: center;
		align-items: center;
	}

	.import-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.9rem 1.25rem;
		min-height: 3.25rem;
		font-family: var(--font-pixel);
		font-size: clamp(0.55rem, 1.5vw, 0.7rem);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-btn);
		cursor: pointer;
	}

	.import-btn:active {
		transform: translate(3px, 3px);
		box-shadow: var(--shadow-btn-press);
	}

	.hint {
		font-size: 0.4rem;
		color: var(--ink-soft);
		text-align: center;
		line-height: 1.7;
	}
</style>
