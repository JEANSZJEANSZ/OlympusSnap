<aside class="dialog pixel-panel" role="status" aria-live="polite">
	<div class="speaker">{speaker}</div>
	<p class="body">
		{shown}<span class="cursor" class:hidden={done}>▌</span>
	</p>
</aside>

<script>
	import { onDestroy } from 'svelte';

	/**
	 * RPG-style dialogue box with optional typewriter effect.
	 * @type {{
	 *   speaker?: string;
	 *   text?: string;
	 *   typewriter?: boolean;
	 *   speedMs?: number;
	 * }}
	 */
	let {
		speaker = 'ORACLE',
		text = '',
		typewriter = true,
		speedMs = 28
	} = $props();

	let shown = $state('');
	let done = $state(false);

	/** @type {ReturnType<typeof setInterval> | null} */
	let timer = null;

	function clearTimer() {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	}

	function startTypewriter(/** @type {string} */ full) {
		clearTimer();
		if (!typewriter || !full) {
			shown = full;
			done = true;
			return;
		}
		shown = '';
		done = false;
		let i = 0;
		timer = setInterval(() => {
			i += 1;
			shown = full.slice(0, i);
			if (i >= full.length) {
				done = true;
				clearTimer();
			}
		}, speedMs);
	}

	$effect(() => {
		startTypewriter(text);
		return clearTimer;
	});

	onDestroy(clearTimer);
</script>

<style>
	.dialog {
		position: relative;
		padding: 1rem 1.1rem 1.15rem;
		background: var(--bg-base);
		box-shadow:
			0 0 0 4px var(--text),
			0 0 0 8px var(--gold),
			6px 6px 0 var(--primary);
		max-width: 42rem;
		width: 100%;
	}

	.speaker {
		display: inline-block;
		margin-bottom: 0.65rem;
		padding: 0.35rem 0.55rem;
		background: var(--primary);
		color: var(--gold-bright);
		font-size: 0.55rem;
		letter-spacing: 0.06em;
	}

	.body {
		font-size: clamp(0.55rem, 1.6vw, 0.68rem);
		line-height: 1.75;
		color: var(--text);
		min-height: 2.8em;
		text-wrap: pretty;
	}

	.cursor {
		display: inline-block;
		margin-left: 2px;
		color: var(--accent);
		animation: type-cursor 0.8s steps(1) infinite;
	}

	.cursor.hidden {
		visibility: hidden;
		animation: none;
	}
</style>
