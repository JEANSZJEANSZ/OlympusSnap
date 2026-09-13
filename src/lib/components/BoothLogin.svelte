<script>
	import { unlockBooth } from '../assets/boothSession.js';
	import DialogBox from './DialogBox.svelte';
	import PixelButton from './PixelButton.svelte';
	import BoothOlympusBackdrop from './BoothOlympusBackdrop.svelte';

	let pinInput = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit() {
		if (busy) return;
		busy = true;
		error = '';
		try {
			await unlockBooth({ pin: pinInput });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unlock failed.';
		} finally {
			busy = false;
		}
	}
</script>

<section class="booth-lock">
	<BoothOlympusBackdrop />
	<div class="content">
		<header class="head">
			<p class="eyebrow">BOOTH SEAL · CERBERUS WATCHES</p>
			<h1>OLYMPUS LOCKED</h1>
			<p class="tagline">
				Operator login required for booth flow. Guests with a QR still enter Studio freely.
			</p>
		</header>

		<div class="gate">
			<DialogBox
				speaker="CERBERUS"
				text="Speak the Admin PIN to open the booth."
				typewriter={false}
			/>
			<label class="field">
				<span>PIN</span>
				<input
					type="password"
					bind:value={pinInput}
					autocomplete="off"
					disabled={busy}
					onkeydown={(e) => e.key === 'Enter' && submit()}
				/>
			</label>
			{#if error}
				<p class="err">{error}</p>
			{/if}
			<div class="actions">
				<PixelButton
					label={busy ? 'CHECKING…' : 'ENTER'}
					variant="gold"
					disabled={busy}
					onclick={submit}
				/>
			</div>
		</div>
	</div>
</section>

<style>
	.booth-lock {
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
		overflow: auto;
		color: #fff8df;
		background: #071936;
	}

	.content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
		max-width: 520px;
		margin: 0 auto;
		padding: clamp(1.25rem, 4vh, 2.5rem) clamp(0.85rem, 3vw, 1.5rem);
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
		max-width: 28rem;
		font-size: clamp(0.4rem, 1.15vw, 0.52rem);
		line-height: 1.75;
		color: #f8eee1;
		text-wrap: pretty;
	}

	.gate {
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
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.42rem;
		letter-spacing: 0.08em;
	}

	.field input {
		font: inherit;
		font-size: 0.55rem;
		padding: 0.55rem 0.65rem;
		border: 3px solid #0f172a;
		background: #fffdf8;
		color: var(--cream-ink);
		box-shadow: 3px 3px 0 var(--primary);
	}

	.err {
		margin: 0;
		font-size: 0.42rem;
		color: var(--danger, #8e2f36);
	}

	.actions {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
	}
</style>
