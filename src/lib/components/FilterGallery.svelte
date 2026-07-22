<aside class="filter-rail" aria-label="Photo filters">
	<p class="rail-title">FILTERS</p>
	<p class="rail-hint">Tap to preview on your frame. Soft glam on every snap.</p>

	<div class="gallery" role="listbox" aria-label="Filter presets">
		{#each FILTER_PRESETS as preset (preset.id)}
			<button
				type="button"
				class="tile"
				class:selected={selectedId === preset.id}
				class:disabled={disabled}
				role="option"
				aria-selected={selectedId === preset.id}
				disabled={disabled}
				onclick={() => onSelect?.(preset.id)}
			>
				<span class="swatch" style:filter={preset.cssFilter === 'none' ? '' : preset.cssFilter}></span>
				<span class="label">{preset.label}</span>
			</button>
		{/each}
	</div>
</aside>

<script>
	import { FILTER_PRESETS } from '../canvas/photoKonva.js';

	/** @type {import('../canvas/photoKonva.js').FilterPresetId} */
	let {
		selectedId = 'natural',
		disabled = false,
		onSelect = undefined
	} = $props();
</script>

<style>
	.filter-rail {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-height: 0;
		max-height: var(--booth-frame-max-h, min(78dvh, 760px));
		width: 100%;
		max-width: var(--booth-filter-rail-width, 16rem);
		justify-self: stretch;
	}

	.rail-title {
		font-size: var(--booth-text-md, 0.85rem);
		color: #fff8df;
		letter-spacing: 0.08em;
	}

	.rail-hint {
		font-size: var(--booth-text-xs, 0.55rem);
		color: color-mix(in srgb, #fff8df 65%, transparent);
		line-height: 1.55;
		margin-bottom: 0.15rem;
	}

	.gallery {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		overflow-y: auto;
		min-height: 0;
		flex: 1;
		padding-right: 0.35rem;
		scrollbar-width: thin;
	}

	.tile {
		display: grid;
		grid-template-columns: var(--booth-filter-swatch, 4.75rem) minmax(0, 1fr);
		grid-template-rows: 1fr;
		gap: 0.75rem;
		align-items: center;
		flex-shrink: 0;
		height: var(--booth-filter-tile-h, 5.85rem);
		min-height: var(--booth-filter-tile-h, 5.85rem);
		max-height: var(--booth-filter-tile-h, 5.85rem);
		padding: 0.55rem 0.65rem;
		background: color-mix(in srgb, #102f56 88%, #fff);
		box-shadow: 2px 2px 0 #071936;
		border: 2px solid transparent;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		color: #fff8df;
	}

	.tile.selected {
		border-color: var(--gold-bright);
		box-shadow:
			2px 2px 0 #071936,
			0 0 0 1px var(--gold);
	}

	.tile.disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.swatch {
		width: var(--booth-filter-swatch, 4.75rem);
		height: var(--booth-filter-swatch, 4.75rem);
		flex-shrink: 0;
		display: block;
		background:
			linear-gradient(145deg, #e8b896 0%, #c97858 38%, #8b4a3a 72%, #3a241c 100%);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
	}

	.label {
		font-size: var(--booth-filter-text, 0.68rem);
		line-height: 1.35;
		letter-spacing: 0.02em;
		min-width: 0;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	@media (max-width: 980px) {
		.filter-rail {
			max-width: none;
			max-height: none;
		}

		.gallery {
			flex-direction: row;
			flex-wrap: wrap;
			overflow-x: auto;
			overflow-y: hidden;
		}

		.tile {
			width: clamp(7rem, 24vw, 10rem);
			height: auto;
			min-height: calc(var(--booth-filter-swatch, 4.75rem) + 2.5rem);
			max-height: calc(var(--booth-filter-swatch, 4.75rem) + 2.5rem);
			grid-template-columns: 1fr;
			grid-template-rows: var(--booth-filter-swatch, 4.75rem) minmax(0, 1fr);
			justify-items: center;
			text-align: center;
			gap: 0.45rem;
		}

		.label {
			-webkit-line-clamp: 2;
		}
	}
</style>
