<button
	class="pixel-btn"
	class:full={fullWidth}
	data-variant={variant}
	{type}
	{disabled}
	{onclick}
	aria-label={ariaLabel}
>
	{#if children}
		{@render children()}
	{:else}
		{label}
	{/if}
</button>

<script>
	/**
	 * Reusable 8-bit button — hard box-shadow borders, no border-radius.
	 * @typedef {'primary' | 'accent' | 'ghost' | 'gold'} Variant
	 */
	/** @type {{
	 *   label?: string;
	 *   variant?: Variant;
	 *   disabled?: boolean;
	 *   fullWidth?: boolean;
	 *   type?: 'button' | 'submit';
	 *   onclick?: (e: MouseEvent) => void;
	 *   children?: import('svelte').Snippet;
	 *   ariaLabel?: string;
	 * }} */
	let {
		label = '',
		variant = 'primary',
		disabled = false,
		fullWidth = false,
		type = 'button',
		onclick,
		children,
		ariaLabel = undefined
	} = $props();
</script>

<style>
	.pixel-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.9rem 1.25rem;
		min-height: 3.25rem;
		font-family: var(--font-pixel);
		font-size: clamp(0.55rem, 1.5vw, 0.7rem);
		line-height: 1.35;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-radius: 0;
		border: none;
		box-shadow: var(--shadow-btn);
		transition:
			transform 60ms steps(2),
			box-shadow 60ms steps(2),
			filter 80ms;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.pixel-btn.full {
		width: 100%;
	}

	.pixel-btn:not(:disabled):hover {
		filter: brightness(1.08);
	}

	.pixel-btn:not(:disabled):active {
		transform: translate(3px, 3px);
		box-shadow: var(--shadow-btn-press);
	}

	.pixel-btn:focus-visible {
		outline: 3px solid var(--gold);
		outline-offset: 3px;
	}

	.pixel-btn[data-variant='primary'] {
		background: var(--primary);
		color: var(--bg-base);
	}

	.pixel-btn[data-variant='accent'] {
		background: var(--accent);
		color: var(--bg-base);
	}

	.pixel-btn[data-variant='gold'] {
		background: var(--gold);
		color: var(--text);
	}

	.pixel-btn[data-variant='ghost'] {
		background: var(--surface);
		color: var(--text);
	}
</style>
