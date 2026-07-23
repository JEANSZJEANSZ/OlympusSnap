<PixelButton
	variant="accent"
	disabled={disabled || busy}
	onclick={onclick}
	ariaLabel={busy ? 'Ritual in progress' : 'Begin ritual'}
>
	<span class="shutter-inner" class:busy>
		<span class="housing" aria-hidden="true">
			<span class="ring ring-outer"></span>
			<span class="ring ring-mid"></span>
			<span class="lens"></span>
		</span>
		<span class="label">{busy ? 'RITUAL…' : 'SNAP'}</span>
	</span>
</PixelButton>

<script>
	import PixelButton from './PixelButton.svelte';

	let {
		disabled = false,
		busy = false,
		onclick = undefined
	} = $props();
</script>

<style>
	.shutter-inner {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		line-height: 1;
	}

	.housing {
		position: relative;
		flex: 0 0 auto;
		width: 1.35rem;
		height: 1.35rem;
		display: grid;
		place-items: center;
		background: var(--surface);
		box-shadow:
			0 0 0 2px var(--text),
			inset 0 0 0 1px color-mix(in srgb, var(--gold) 55%, transparent);
	}

	.ring {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
	}

	.ring-outer {
		width: 72%;
		height: 72%;
		box-shadow:
			0 0 0 1px var(--primary),
			inset 0 0 0 1px color-mix(in srgb, var(--gold-bright) 70%, transparent);
	}

	.ring-mid {
		width: 58%;
		height: 58%;
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--gold) 80%, var(--text));
	}

	.lens {
		width: 42%;
		height: 42%;
		border-radius: 50%;
		background: radial-gradient(
			circle at 35% 30%,
			color-mix(in srgb, var(--gold-bright) 90%, white),
			var(--gold) 45%,
			color-mix(in srgb, var(--primary) 65%, #1a1a1a) 100%
		);
		box-shadow:
			inset 0 0 0 1px var(--text),
			0 0 0 1px color-mix(in srgb, var(--gold-bright) 50%, transparent);
	}

	.label {
		letter-spacing: 0.08em;
	}

	.shutter-inner.busy .lens {
		animation: shutter-pulse 0.9s steps(3) infinite;
	}

	@keyframes shutter-pulse {
		0%,
		100% {
			filter: brightness(1);
		}
		50% {
			filter: brightness(1.35);
		}
	}
</style>
