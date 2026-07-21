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

		gap: 0.5rem;

		min-height: 0;

		max-height: min(72dvh, 640px);

		width: 100%;

		max-width: 168px;

	}



	.rail-title {

		font-size: 0.42rem;

		color: #fff8df;

		letter-spacing: 0.08em;

	}



	.rail-hint {

		font-size: 0.34rem;

		color: color-mix(in srgb, #fff8df 65%, transparent);

		line-height: 1.5;

		margin-bottom: 0.25rem;

	}



	.gallery {

		display: flex;

		flex-direction: column;

		gap: 0.45rem;

		overflow-y: auto;

		padding-right: 0.25rem;

		scrollbar-width: thin;

	}



	.tile {

		display: grid;

		grid-template-columns: 52px 1fr;

		grid-template-rows: auto auto;

		gap: 0.15rem 0.45rem;

		align-items: center;

		padding: 0.4rem;

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

		grid-row: span 2;

		width: 52px;

		height: 52px;

		display: block;

		background:

			linear-gradient(145deg, #e8b896 0%, #c97858 38%, #8b4a3a 72%, #3a241c 100%);

		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);

	}



	.label {

		font-size: 0.34rem;

		line-height: 1.35;

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

			width: 88px;

			grid-template-columns: 1fr;

			grid-template-rows: 52px auto;

			justify-items: center;

			text-align: center;

		}



		.swatch {

			grid-row: auto;

		}

	}

</style>


