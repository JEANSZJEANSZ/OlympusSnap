<div class="sheet-root">
	<button type="button" class="backdrop" aria-label="Close share" onclick={onClose}></button>
	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-label="Share snap"
		transition:fly={{ y: 36, duration: reduced ? 0 : 240 }}
	>
		<div class="handle" aria-hidden="true"></div>
		<p class="title">Share snap</p>
		<div class="actions">
			<button type="button" class="row" onclick={openInstagram}>
				<span class="glyph ig" aria-hidden="true">IG</span>
				Open Instagram
			</button>
			<button type="button" class="row" onclick={openFacebook}>
				<span class="glyph fb" aria-hidden="true">f</span>
				Open Facebook
			</button>
			<button type="button" class="row" onclick={copyImage}>
				{copied ? 'Copied' : 'Copy image'}
			</button>
			<button type="button" class="row primary" onclick={onDownload}>Download</button>
		</div>
	</div>
</div>

<script>
	import { fly } from 'svelte/transition';
	import { copyImageToClipboard, facebookHomeUrl, instagramHomeUrl } from '../share/shareComposite.js';

	/** @type {{
	 *   dataUrl?: string;
	 *   onDownload?: () => void;
	 *   onClose?: () => void;
	 * }} */
	let { dataUrl = '', onDownload, onClose } = $props();

	let copied = $state(false);
	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	function openInstagram() {
		window.open(instagramHomeUrl(), '_blank', 'noopener');
	}

	function openFacebook() {
		window.open(facebookHomeUrl(), '_blank', 'noopener');
	}

	async function copyImage() {
		const ok = await copyImageToClipboard(dataUrl);
		copied = ok;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onClose?.();
	}}
/>

<style>
	.sheet-root {
		position: absolute;
		inset: 0;
		z-index: 9;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		pointer-events: none;
	}

	.backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background: rgba(0, 0, 0, 0.42);
		pointer-events: auto;
		cursor: pointer;
	}

	.sheet {
		position: relative;
		z-index: 1;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding:
			0.55rem 0.95rem
			max(1.1rem, env(safe-area-inset-bottom));
		background: #161616;
		border-radius: 1.25rem 1.25rem 0 0;
		color: #fff8df;
	}

	.handle {
		width: 2.4rem;
		height: 0.28rem;
		margin: 0.1rem auto 0;
		border-radius: 99px;
		background: color-mix(in srgb, #fff 28%, transparent);
	}

	.title {
		margin: 0;
		font-family: var(--font-pixel);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--gold-bright, #fff4c2);
		text-align: center;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		min-height: 2.85rem;
		border: 0;
		border-radius: 0.85rem;
		background: #2a2a2a;
		color: #fff;
		font: inherit;
		font-size: 0.95rem;
		cursor: pointer;
	}

	.row.primary {
		background: var(--gold, #d4a017);
		color: #071936;
		font-family: var(--font-pixel);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.glyph {
		display: grid;
		place-items: center;
		width: 1.45rem;
		height: 1.45rem;
		border-radius: 0.35rem;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.glyph.ig {
		background: #e1306c;
		color: #fff;
	}

	.glyph.fb {
		background: #1877f2;
		color: #fff;
	}
</style>
