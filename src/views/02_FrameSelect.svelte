<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { selectedFrameId } from '../lib/stores/stores.js';
	import { go } from '../router/index.js';
	import { assetsReady, frames, randomFrame, oracleShuffleMs } from '../lib/assets/assetStore.js';
	import { createFrameSelectMotion } from '../lib/fx/frameSelectMotion.js';
	import { playOracleRite } from '../lib/fx/oracleRite.js';
	import { beginFrameHandoff } from '../lib/fx/frameHandoff.js';
	import {
		frameImageCacheTick,
		invalidateFrameImage,
		isFrameImageCached,
		preloadFrameImage,
		resolveCachedFrameSrc,
		warmFrameImages
	} from '../lib/utils/loadImageForCanvas.js';
	import PixelButton from '../lib/components/PixelButton.svelte';
	import DialogBox from '../lib/components/DialogBox.svelte';
	import BoothOlympusBackdrop from '../lib/components/BoothOlympusBackdrop.svelte';

	let index = $state(0);
	let reduced = $state(false);
	let exiting = $state(false);
	let artRetryId = $state(/** @type {string | null} */ (null));
	/** @type {'idle' | 'warming' | 'weigh' | 'spin' | 'spoken' | 'drop'} */
	let oraclePhase = $state('idle');
	let oracleStarted = $state(false);
	/** @type {HTMLElement | undefined} */
	let rootEl = $state();
	/** @type {Record<string, { w: number; h: number }>} */
	let measuredDims = $state({});
	/** @type {ReturnType<typeof createFrameSelectMotion> | undefined} */
	let motion = $state();
	/** @type {{ cancelled: boolean }} */
	let oracleSignal = { cancelled: false };
	const list = $derived($frames);
	const frame = $derived(list[Math.min(index, Math.max(0, list.length - 1))]);
	const oracleMode = $derived($randomFrame);
	const oracleActive = $derived(oracleMode && list.length > 0);
	const displaySrc = $derived.by(() => {
		$frameImageCacheTick;
		const raw = frame?.src ?? '';
		if (!raw || !isFrameImageCached(raw)) return '';
		return resolveCachedFrameSrc(raw);
	});
	const frameArtReady = $derived(!!displaySrc);

	const dialogSpeaker = $derived(oracleMode ? 'PYTHIA' : 'HEPHAESTUS');
	const dialogText = $derived.by(() => {
		if (!frame) return 'The courier bears no relic. Open Admin to forge a frame.';
		if (!oracleMode) {
			return reduced
				? `${frame.name} hangs ready. Tap the strip to proceed.`
				: `${frame.name} hangs ready. Pull hard, hold if you wish, then release to drop.`;
		}
		if (oraclePhase === 'warming' || oraclePhase === 'idle') {
			return 'The Fates gather the relics…';
		}
		if (oraclePhase === 'weigh') return 'The Fates weigh the relics…';
		if (oraclePhase === 'spin') return 'Olympus spins the lots…';
		if (oraclePhase === 'spoken') return `THE FATES HAVE SPOKEN — ${frame.name}`;
		if (oraclePhase === 'drop') return `${frame.name} rises as a blessing.`;
		return 'Pythia prepares the oracle…';
	});

	/**
	 * Restore carousel to the frame already chosen (e.g. Camera → Back).
	 * @param {typeof list} items
	 * @param {string | null} id
	 */
	function syncIndexToSelected(items, id) {
		if (!items.length) return;
		if (oracleMode) {
			if (index >= items.length) index = items.length - 1;
			return;
		}
		if (id) {
			const i = items.findIndex((f) => f.id === id);
			if (i >= 0) {
				index = i;
				return;
			}
		}
		if (index >= items.length) index = items.length - 1;
	}

	$effect(() => {
		const f = frame;
		if (!f?.src) return;
		const id = f.id;
		const src = f.src;
		let cancelled = false;

		preloadFrameImage(src).then((img) => {
			if (cancelled || frame?.id !== id || !img) return;
			if (img.naturalWidth && img.naturalHeight && !(f.w && f.h)) {
				measuredDims = {
					...measuredDims,
					[id]: { w: img.naturalWidth, h: img.naturalHeight }
				};
			}
		});

		return () => {
			cancelled = true;
		};
	});

	/** Warm the next/prev relic so carousel swaps do not flash empty slots. */
	$effect(() => {
		if (oracleMode || list.length < 2) return;
		const prev = list[(index - 1 + list.length) % list.length];
		const next = list[(index + 1) % list.length];
		if (prev?.src) preloadFrameImage(prev.src);
		if (next?.src) preloadFrameImage(next.src);
	});

	/** Unitless w/h for CSS aspect-ratio + width cap calc. */
	const frameAr = $derived.by(() => {
		const f = frame;
		if (f?.w && f?.h && f.h > 0) return f.w / f.h;
		const m = f?.id ? measuredDims[f.id] : null;
		if (m?.w && m?.h) return m.w / m.h;
		return 3 / 4;
	});

	function attachRoot(node) {
		rootEl = node;

		return () => {
			if (rootEl === node) rootEl = undefined;
		};
	}

	/**
	 * Commit the hanging relic and fly to Camera.
	 * @param {typeof frame} f
	 */
	function commitFrameToCamera(f) {
		if (!f) return;
		selectedFrameId.set(f.id);
		const fromEl = rootEl?.querySelector('.frame-body');
		if (fromEl && f.src) {
			beginFrameHandoff({
				src: resolveCachedFrameSrc(f.src),
				fromEl,
				reduced: reduced || oracleMode
			});
		}
		go('camera');
	}

	/**
	 * @param {typeof list} items
	 */
	function listFullyCached(items) {
		return items.every((f) => !f.src || isFrameImageCached(f.src));
	}

	/**
	 * Warm catalog art and require every src in the blob cache before the rite.
	 * @param {typeof list} items
	 * @param {{ cancelled: boolean }} signal
	 */
	async function waitForOracleArt(items, signal) {
		const srcs = items.map((f) => f.src);
		await warmFrameImages(srcs);
		if (signal.cancelled || exiting) return false;
		if (listFullyCached(items)) return true;

		await warmFrameImages(srcs);
		if (signal.cancelled || exiting) return false;
		if (listFullyCached(items)) return true;

		await new Promise((resolve) => window.setTimeout(resolve, 400));
		if (signal.cancelled || exiting) return false;
		await warmFrameImages(srcs);
		return !signal.cancelled && !exiting && listFullyCached(items);
	}

	/**
	 * @param {typeof list} items
	 * @param {{ cancelled: boolean }} signal
	 */
	async function startOracleRite(items, signal) {
		if (oracleStarted || exiting || !oracleMode || !items.length || !rootEl) return;
		if (signal.cancelled) return;

		oraclePhase = 'warming';
		const artReady = await waitForOracleArt(items, signal);
		if (!artReady || signal.cancelled || exiting || !rootEl) return;

		oracleStarted = true;
		oraclePhase = 'weigh';

		const startIndex = Math.min(index, Math.max(0, items.length - 1));
		const targetIndex = Math.floor(Math.random() * items.length);

		await playOracleRite(rootEl, {
			listLength: items.length,
			startIndex,
			targetIndex,
			shuffleMs: get(oracleShuffleMs),
			reduced,
			signal,
			onStep: (i) => {
				index = i;
			},
			onPhase: (phase) => {
				oraclePhase = phase;
			},
			onDone: () => {
				if (signal.cancelled) return;
				exiting = true;
				const f = items[Math.min(index, Math.max(0, items.length - 1))];
				commitFrameToCamera(f);
			}
		});
	}

	onMount(() => {
		let restored = false;
		const tryRestore = (/** @type {typeof list} */ items) => {
			if (!items.length) return;
			if (!restored) {
				syncIndexToSelected(items, get(selectedFrameId));
				restored = true;
				return;
			}
			if (index >= items.length) index = items.length - 1;
		};

		tryRestore(get(frames));
		const unsubscribeFrames = frames.subscribe(tryRestore);

		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const useOracle = get(randomFrame);
		if (rootEl && !useOracle) {
			motion = createFrameSelectMotion(rootEl, {
				reduced,
				pullEnabled: true
			});
		}

		return () => {
			oracleSignal.cancelled = true;
			unsubscribeFrames();
			motion?.dispose();
			motion = undefined;
		};
	});

	$effect(() => {
		const current = frame;
		const i = index;
		if (!motion) return;
		motion.setSelectHandlers({
			onBroken: () => {
				exiting = true;
			},
			onGone: () => {
				const f = list[Math.min(i, Math.max(0, list.length - 1))] ?? current;
				commitFrameToCamera(f);
			}
		});
	});

	$effect(() => {
		const ready = $assetsReady;
		const mode = oracleMode;
		const el = rootEl;
		const items = list;
		const gone = exiting;

		if (!mode || !ready || !el || !items.length || gone) return;

		const fingerprint = items.map((f) => f.id).join('|');
		oracleSignal.cancelled = true;
		const signal = { cancelled: false };
		oracleSignal = signal;

		const timer = window.setTimeout(() => {
			if (signal.cancelled) return;
			if (fingerprint !== list.map((f) => f.id).join('|')) return;
			void startOracleRite(items, signal);
		}, 350);

		return () => {
			window.clearTimeout(timer);
			if (!oracleStarted) signal.cancelled = true;
		};
	});

	function selectFrame(target, direction) {
		if (exiting || oracleMode || !list.length) return;

		const nextIndex = ((target % list.length) + list.length) % list.length;
		if (nextIndex === index) return;

		const apply = () => {
			index = nextIndex;
		};

		if (motion && !reduced) {
			const targetFrame = list[nextIndex];
			preloadFrameImage(targetFrame?.src).then(() => {
				if (exiting) return;
				motion.playSwap(direction, apply);
			});
		} else {
			apply();
		}
	}

	function prev() {
		selectFrame(index - 1, -1);
	}

	function next() {
		selectFrame(index + 1, 1);
	}

	function back() {
		if (exiting) return;
		exiting = true;
		const finish = () => go('landing');
		if (motion) {
			motion.playBackToLanding(finish);
		} else {
			finish();
		}
	}

	/** Reduced-motion fallback: click confirms without pull. */
	function confirmFrame() {
		if (exiting || !frame || !reduced || oracleMode) return;
		exiting = true;
		const f = frame;
		if (motion) {
			motion.playConfirm(() => commitFrameToCamera(f));
		} else {
			commitFrameToCamera(f);
		}
	}

	const pagerLabel = $derived(
		list.length ? `${index + 1} / ${list.length}` : '0 / 0'
	);
	const pagerProgress = $derived(
		list.length > 1 ? index / (list.length - 1) : list.length === 1 ? 1 : 0
	);
</script>

<section
	class="frame-view"
	class:exiting
	class:oracle-mode={oracleActive}
	class:oracle-rite={oracleActive && oraclePhase !== 'idle'}
	{@attach attachRoot}
>
	<BoothOlympusBackdrop />
	<div class="back-veil" aria-hidden="true"></div>
	{#if oracleActive}
		<div class="oracle-veil" aria-hidden="true"></div>
	{/if}

	<header class="head">
		<p class="eyebrow">{oracleMode ? 'THE FATES AWAIT' : 'THE OLYMPIAN COURIER AWAITS'}</p>
		<h1>{oracleMode ? 'ORACLE OF RELICS' : 'CHOOSE THY FRAME'}</h1>
		<div class="headline">
			<p>
				{oracleMode
					? 'Pythia casts the lots — the Fates choose the relic for the lens.'
					: 'Choose the relic our winged herald shall carry to the mortal lens.'}
			</p>
			<span class="relic-count">{list.length} {list.length === 1 ? 'RELIC' : 'RELICS'}</span>
		</div>
	</header>

	<div class="pager" aria-live="polite" aria-atomic="true">
		<p class="pager-name">{frame?.name ?? 'NO RELIC'}</p>
		<p class="pager-count">{pagerLabel}</p>
		<div
			class="pager-track"
			role="presentation"
			style:--pager-progress={pagerProgress}
		>
			<span class="pager-fill"></span>
		</div>
	</div>

	<main class="carousel" class:oracle-carousel={oracleActive} aria-label={oracleMode ? 'Oracle frame rite' : 'Frame selection'}>
		{#if oracleActive}
			<div class="oracle-stage" aria-live="polite">
				<div class="oracle-ring" aria-hidden="true"></div>
				<div class="oracle-columns" aria-hidden="true">
					<svg class="oracle-col oracle-col-l" viewBox="0 0 40 160" shape-rendering="crispEdges" aria-hidden="true">
						<path fill="#5c4630" d="M4 148H36V160H4Z" />
						<path fill="#8a6e48" d="M6 150H34V158H6Z" />
						<path fill="#cbb892" d="M8 152H32V156H8Z" />
						<path fill="#4a3822" d="M10 40H30V150H10Z" />
						<path fill="#a89068" d="M12 42H16V148H12ZM18 42H22V148H18ZM24 42H28V148H24Z" />
						<path fill="#d8c49a" d="M13 42H15V148H13ZM19 42H21V148H19ZM25 42H27V148H25Z" />
						<path fill="#6e5638" d="M6 28H34V42H6Z" />
						<path fill="#b89a68" d="M8 30H32V40H8Z" />
						<path fill="#efe3c2" d="M10 32H14V38H10ZM16 32H20V38H16ZM22 32H26V38H22ZM28 32H30V38H28Z" />
						<path fill="#5c4630" d="M2 8H38V28H2Z" />
						<path fill="#cbb892" d="M4 10H36V18H4Z" />
						<path fill="#efe3c2" d="M6 12H34V16H6Z" />
						<path fill="#8a6e48" d="M4 18H36V26H4Z" />
						<path fill="#d8c49a" d="M8 20H12V24H8ZM14 20H18V24H14ZM20 20H24V24H20ZM26 20H30V24H26Z" />
						<path fill="#f0c14a" d="M18 4H22V10H18Z" />
						<path fill="#fff4cf" d="M19 5H21V8H19Z" />
					</svg>
					<svg class="oracle-col oracle-col-r" viewBox="0 0 40 160" shape-rendering="crispEdges" aria-hidden="true">
						<path fill="#5c4630" d="M4 148H36V160H4Z" />
						<path fill="#8a6e48" d="M6 150H34V158H6Z" />
						<path fill="#cbb892" d="M8 152H32V156H8Z" />
						<path fill="#4a3822" d="M10 40H30V150H10Z" />
						<path fill="#a89068" d="M12 42H16V148H12ZM18 42H22V148H18ZM24 42H28V148H24Z" />
						<path fill="#d8c49a" d="M13 42H15V148H13ZM19 42H21V148H19ZM25 42H27V148H25Z" />
						<path fill="#6e5638" d="M6 28H34V42H6Z" />
						<path fill="#b89a68" d="M8 30H32V40H8Z" />
						<path fill="#efe3c2" d="M10 32H14V38H10ZM16 32H20V38H16ZM22 32H26V38H22ZM28 32H30V38H28Z" />
						<path fill="#5c4630" d="M2 8H38V28H2Z" />
						<path fill="#cbb892" d="M4 10H36V18H4Z" />
						<path fill="#efe3c2" d="M6 12H34V16H6Z" />
						<path fill="#8a6e48" d="M4 18H36V26H4Z" />
						<path fill="#d8c49a" d="M8 20H12V24H8ZM14 20H18V24H14ZM20 20H24V24H20ZM26 20H30V24H26Z" />
						<path fill="#f0c14a" d="M18 4H22V10H18Z" />
						<path fill="#fff4cf" d="M19 5H21V8H19Z" />
					</svg>
				</div>
				<svg class="oracle-torch" viewBox="0 0 96 88" shape-rendering="crispEdges" aria-hidden="true">
					<!-- stone plinth -->
					<path fill="#3a2a18" d="M18 72H78V88H18Z" />
					<path fill="#6e5638" d="M22 74H74V84H22Z" />
					<path fill="#b89a68" d="M26 76H70V80H26Z" />
					<!-- bronze bowl -->
					<path fill="#4a3018" d="M28 58H68V72H28Z" />
					<path fill="#8b5a2b" d="M30 60H66V70H30Z" />
					<path fill="#c9a24a" d="M34 62H62V66H34Z" />
					<path fill="#e8c86a" d="M38 63H58V65H38Z" />
					<!-- bowl lip -->
					<path fill="#5c3a16" d="M24 52H72V60H24Z" />
					<path fill="#d4a84a" d="M26 54H70V58H26Z" />
					<path fill="#fff0b0" d="M32 55H40V57H32ZM56 55H64V57H56Z" />
					<!-- torch legs -->
					<path fill="#2a1c10" d="M34 70H40V78H34ZM56 70H62V78H56ZM44 68H52V80H44Z" />
					<path fill="#7a4e24" d="M36 70H38V76H36ZM58 70H60V76H58ZM46 69H50V78H46Z" />
					<!-- sacred flame -->
					<g class="oracle-flame">
						<path fill="#f0c14a" d="M40 28H56V44H52V52H44V44H40Z" />
						<path fill="#e89a2e" d="M44 20H52V36H48V44H44V36H40V28H44Z" />
						<path fill="#ff6b2d" d="M46 12H50V28H48V36H46V28H44V20H46Z" />
						<path fill="#fff4cf" d="M47 8H49V20H47Z" />
					</g>
				</svg>
				<p class="oracle-runes" aria-hidden="true">ΜΟΙΡΑ · ΚΛΗΡΟΣ · ΤΥΧΗ</p>
				<div class="oracle-relic-wrap">
					<div
						class="frame-body oracle-relic"
						class:art-ready={frameArtReady}
						style:--frame-ar={frameAr}
						data-motif={frame?.id ?? 'none'}
						data-frame-select-handoff-target
						role="img"
						aria-label={frame ? `Oracle relic ${frame.name}` : 'Oracle relic'}
					>
						<div class="frame-slots" aria-hidden="true">
							{#each frame?.slots ?? [] as slot (slot.id)}
								<span
									class="frame-slot"
									style:left="{(slot.x * 100).toFixed(3)}%"
									style:top="{(slot.y * 100).toFixed(3)}%"
									style:width="{(slot.w * 100).toFixed(3)}%"
									style:height="{(slot.h * 100).toFixed(3)}%"
								></span>
							{/each}
						</div>
						{#if displaySrc}
							{#key frame?.id}
								<img
									class="frame-art"
									src={displaySrc}
									alt=""
									draggable="false"
									onerror={() => {
										const raw = frame?.src;
										const id = frame?.id;
										if (!raw || !id) return;
										if (artRetryId === id) return;
										artRetryId = id;
										invalidateFrameImage(raw);
										void preloadFrameImage(raw);
									}}
								/>
							{/key}
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<button class="nav nav-prev" type="button" onclick={prev} aria-label="Previous frame">
				<span class="chev" aria-hidden="true"></span>
			</button>

			<div class="flight-stage">
				<div class="bird-rig" aria-hidden="true">
					<svg class="bird" viewBox="0 0 180 82" shape-rendering="crispEdges">
						<g class="wing wing-left">
							<path fill="#3c241c" d="M82 35H66V29H51V23H31V17H8V25H18V33H29V41H43V49H65V45H82Z" />
							<path fill="#704128" d="M72 37H55V31H39V25H19V31H31V38H44V45H65V42H72Z" />
							<path fill="#b47731" d="M65 39H49V34H35V30H27V36H41V42H57V46H70Z" />
							<path fill="#e0a642" d="M58 40H45V36H38V40H49V45H62Z" />
						</g>
						<g class="wing wing-right">
							<path fill="#3c241c" d="M98 35H114V29H129V23H149V17H172V25H162V33H151V41H137V49H115V45H98Z" />
							<path fill="#704128" d="M108 37H125V31H141V25H161V31H149V38H136V45H115V42H108Z" />
							<path fill="#b47731" d="M115 39H131V34H145V30H153V36H139V42H123V46H110Z" />
							<path fill="#e0a642" d="M122 40H135V36H142V40H131V45H118Z" />
						</g>
						<path fill="#2d1a18" d="M73 35H107V59H101V68H79V59H73Z" />
						<path fill="#78472a" d="M80 33H102V57H97V64H83V57H78V40H80Z" />
						<path fill="#b77934" d="M84 42H98V61H94V67H86V61H82V48H84Z" />
						<path fill="#f2ead5" d="M96 28H113V34H121V48H113V53H99V48H94V34H96Z" />
						<path fill="#d5c9ae" d="M99 44H114V49H108V54H99Z" />
						<rect x="108" y="34" width="4" height="4" fill="#101729" />
						<path fill="#d99a2b" d="M119 39H135V44H128V49H116V44H119Z" />
						<path fill="#4b2b20" d="M78 60H84V74H75V70H68V66H78ZM96 60H102V66H112V70H105V74H96Z" />
						<path fill="#d99a2b" d="M76 66H81V75H76V78H72V74H68V71H76ZM99 66H104V71H112V74H108V78H104V75H99Z" />
						<path fill="#e2b553" d="M84 53H96V58H100V62H80V58H84Z" />
						<path fill="#2d1a18" d="M83 68H88V79H83ZM92 68H97V79H92Z" />
						<path fill="#f0cf6a" d="M81 76H90V81H81ZM90 76H99V81H90Z" />
					</svg>
				</div>

				<svg class="rope-physics" width="100%" height="100%" aria-hidden="true">
					<polyline class="rope-line" points="300,58 300,86 300,116"></polyline>
				</svg>

				<div class="snap-spark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

				<div class="hang-group">
					<button
						type="button"
						class="frame-body"
						class:art-ready={frameArtReady}
						style:--frame-ar={frameAr}
						data-motif={frame?.id ?? 'none'}
						data-frame-select-handoff-target
						aria-label={frame
							? reduced
								? `Select ${frame.name}`
								: `Pull ${frame.name} taut, then release to drop`
							: 'Select frame'}
						disabled={!frame || exiting}
						onclick={confirmFrame}
					>
						<div class="frame-slots" aria-hidden="true">
							{#each frame?.slots ?? [] as slot (slot.id)}
								<span
									class="frame-slot"
									style:left="{(slot.x * 100).toFixed(3)}%"
									style:top="{(slot.y * 100).toFixed(3)}%"
									style:width="{(slot.w * 100).toFixed(3)}%"
									style:height="{(slot.h * 100).toFixed(3)}%"
								></span>
							{/each}
						</div>
						{#if displaySrc}
							{#key frame?.id}
								<img
									class="frame-art"
									src={displaySrc}
									alt=""
									draggable="false"
									onerror={() => {
										const raw = frame?.src;
										const id = frame?.id;
										if (!raw || !id) return;
										if (artRetryId === id) return;
										artRetryId = id;
										invalidateFrameImage(raw);
										void preloadFrameImage(raw);
									}}
								/>
							{/key}
						{/if}
					</button>
				</div>
			</div>

			<button class="nav nav-next" type="button" onclick={next} aria-label="Next frame">
				<span class="chev" aria-hidden="true"></span>
			</button>
		{/if}
	</main>

	<footer class="footer">
		<DialogBox speaker={dialogSpeaker} text={dialogText} typewriter={false} />
		<div class="actions">
			<PixelButton label="BACK" variant="ghost" onclick={back} />
		</div>
	</footer>
</section>

<style>
	.frame-view {
		--sky-top: #071936;
		--sky-mid: #153d69;
		--sky-low: #be6f62;
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 100%;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		gap: clamp(0.25rem, 1.2vh, 0.65rem);
		padding: clamp(0.55rem, 1.8vh, 1rem) clamp(0.75rem, 3vw, 2rem);
		align-items: center;
		color: #fff8df;
		background: var(--sky-top);
	}

	.frame-view.exiting {
		pointer-events: none;
	}

	.frame-view.exiting:not(.backing) .head,
	.frame-view.exiting:not(.backing) .pager,
	.frame-view.exiting:not(.backing) .footer,
	.frame-view.exiting:not(.backing) .nav {
		opacity: 0;
		transition: opacity 280ms steps(4);
	}

	.frame-view.exiting:not(.backing) :global(.booth-olympus) {
		filter: brightness(0.72);
		transition: filter 320ms steps(4);
	}

	.back-veil {
		position: absolute;
		inset: 0;
		z-index: 30;
		pointer-events: none;
		opacity: 0;
		background:
			radial-gradient(ellipse at 50% 28%, rgba(255, 248, 223, 0.55), transparent 55%),
			linear-gradient(180deg, #071936 0%, #0d2748 55%, #1a3a5c 100%);
	}

	.oracle-veil {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		opacity: 0;
		background:
			radial-gradient(ellipse at 50% 36%, rgba(232, 196, 90, 0.42), transparent 58%),
			radial-gradient(ellipse at 50% 8%, rgba(255, 248, 223, 0.28), transparent 42%);
		transition: opacity 420ms steps(5);
	}

	.frame-view.oracle-mode .oracle-veil,
	.frame-view.oracle-rite .oracle-veil {
		opacity: 1;
	}

	.carousel.oracle-carousel {
		grid-template-columns: minmax(0, 1fr);
		max-width: 640px;
	}

	.oracle-stage {
		position: relative;
		z-index: 2;
		width: 100%;
		height: auto;
		align-self: stretch;
		max-height: none;
		min-height: 260px;
		margin: 0 auto;
		display: grid;
		place-items: center;
		isolation: isolate;
		container-type: size;
	}

	.oracle-ring {
		position: absolute;
		left: 50%;
		top: 42%;
		width: min(72%, 280px);
		aspect-ratio: 1;
		translate: -50% -50%;
		border-radius: 50%;
		border: 3px solid rgba(232, 196, 90, 0.55);
		box-shadow:
			0 0 0 8px rgba(232, 196, 90, 0.12),
			inset 0 0 24px rgba(255, 248, 223, 0.18);
		pointer-events: none;
		z-index: 0;
	}

	.oracle-ring::before,
	.oracle-ring::after {
		content: '';
		position: absolute;
		inset: 12%;
		border-radius: 50%;
		border: 2px dashed rgba(243, 217, 187, 0.35);
	}

	.oracle-ring::after {
		inset: 24%;
		border-style: solid;
		border-color: rgba(232, 196, 90, 0.28);
	}

	.oracle-columns {
		position: absolute;
		inset: 4% 4% 10%;
		pointer-events: none;
		z-index: 0;
	}

	.oracle-col {
		position: absolute;
		top: 0;
		bottom: 0;
		width: clamp(36px, 8vw, 52px);
		height: 100%;
		filter: drop-shadow(3px 4px 0 rgba(4, 14, 31, 0.55));
	}

	.oracle-col-l {
		left: 0;
	}

	.oracle-col-r {
		right: 0;
	}

	.oracle-torch {
		position: absolute;
		left: 50%;
		bottom: 2%;
		width: clamp(88px, 22vw, 120px);
		translate: -50% 0;
		z-index: 2;
		filter: drop-shadow(2px 3px 0 rgba(4, 14, 31, 0.55));
		pointer-events: none;
		transform-origin: 50% 70%;
	}

	.oracle-flame {
		transform-origin: 48px 52px;
	}

	.oracle-runes {
		position: absolute;
		top: 6%;
		left: 50%;
		translate: -50% 0;
		margin: 0;
		z-index: 1;
		font-size: clamp(0.38rem, 1.1vw, 0.5rem);
		letter-spacing: 0.28em;
		color: #f0c14a;
		text-shadow: 2px 2px 0 #06152d;
		opacity: 0.85;
		pointer-events: none;
		white-space: nowrap;
	}

	.oracle-relic-wrap {
		position: relative;
		z-index: 3;
		display: grid;
		place-items: center;
		margin-bottom: clamp(3.2rem, 10vh, 4.4rem);
	}

	.oracle-relic {
		/* No rope — leave room for torch + runes, not bird hang. */
		--hang-clearance: 6.2rem;
		cursor: default;
		box-shadow:
			0 0 0 3px #c9a24a,
			0 0 28px rgba(240, 193, 74, 0.45),
			4px 6px 0 rgba(4, 14, 31, 0.55);
		transform-origin: center center;
	}

	.frame-view.oracle-rite .oracle-relic {
		box-shadow:
			0 0 0 4px #f0c14a,
			0 0 40px rgba(240, 193, 74, 0.65),
			4px 6px 0 rgba(4, 14, 31, 0.55);
	}

	.head {
		position: relative;
		z-index: 1;
		width: min(100%, 760px);
		margin: 0 auto;
		text-align: center;
		text-shadow: 2px 2px 0 #06152d;
	}

	.head h1 {
		margin: 0.1rem 0 0.2rem;
		font-size: clamp(1rem, 3.4vw, 1.75rem);
		line-height: 1;
		letter-spacing: 0.12em;
		color: var(--gold-bright);
		text-wrap: balance;
	}

	.eyebrow {
		margin: 0;
		font-size: clamp(0.36rem, 1vw, 0.48rem);
		letter-spacing: 0.22em;
		color: #f3d9bb;
	}

	.headline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
	}

	.headline p {
		margin: 0;
		font-size: clamp(0.43rem, 1.2vw, 0.57rem);
		color: #f8eee1;
	}

	.relic-count {
		border-left: 2px solid #d29a43;
		padding-left: 0.65rem;
		font-size: 0.42rem;
		letter-spacing: 0.12em;
		color: var(--gold-bright);
		white-space: nowrap;
	}

	.carousel {
		display: grid;
		grid-template-columns: minmax(44px, 3.25rem) minmax(0, 1fr) minmax(44px, 3.25rem);
		gap: clamp(0.35rem, 2vw, 1rem);
		align-items: start;
		justify-self: center;
		max-width: 780px;
		width: 100%;
		margin: 0 auto;
		height: 100%;
		min-height: 0;
		padding-top: clamp(0.15rem, 0.8vh, 0.45rem);
	}

	.nav {
		align-self: center;
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: clamp(44px, 5vw, 3.25rem);
		height: clamp(44px, 5vw, 3.25rem);
		padding: 0;
		border: 3px solid var(--gold);
		background: #8e2f36;
		box-shadow: 4px 4px 0 #07152d, inset 0 0 0 2px #c86c52;
		font: inherit;
		color: #fff4cf;
		cursor: pointer;
	}

	.nav .chev {
		display: block;
		width: 0;
		height: 0;
		border-style: solid;
	}

	.nav-prev .chev {
		border-width: 8px 12px 8px 0;
		border-color: transparent #fff4cf transparent transparent;
	}

	.nav-next .chev {
		border-width: 8px 0 8px 12px;
		border-color: transparent transparent transparent #fff4cf;
	}

	.nav span {
		line-height: 1;
	}

	.nav:active {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 #07152d, inset 0 0 0 2px #c86c52;
	}

	.nav:focus-visible,
	.frame-body:focus-visible {
		outline: 3px solid #fff8df;
		outline-offset: 3px;
	}

	.flight-stage {
		position: relative;
		z-index: 2;
		width: 100%;
		height: auto;
		align-self: stretch;
		max-height: none;
		min-height: 260px;
		margin: 0 auto;
		overflow: visible;
		container-type: size;
		--rig-lift: clamp(-20px, -3vh, -8px);
	}

	.bird-rig,
	.hang-group,
	.snap-spark {
		position: absolute;
		left: 50%;
	}

	.bird-rig {
		z-index: 3;
		top: var(--rig-lift);
		width: clamp(150px, 20vw, 180px);
		translate: -50% 0;
		transform-origin: center 35%;
		pointer-events: none;
	}

	.bird {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		filter: drop-shadow(3px 4px 0 rgba(4, 14, 31, 0.65));
	}

	.bird .wing {
		transform-box: fill-box;
	}

	.bird .wing-left {
		transform-origin: right center;
	}

	.bird .wing-right {
		transform-origin: left center;
	}


	.rope-physics {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.rope-line {
		fill: none;
		stroke: #c08a43;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
		filter: drop-shadow(2px 1px 0 #3a241d);
		vector-effect: non-scaling-stroke;
	}

	.snap-spark {
		z-index: 5;
		top: clamp(32px, 5vh, 44px);
		width: 24px;
		height: 24px;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.snap-spark i {
		position: absolute;
		top: 10px;
		left: 1px;
		width: 22px;
		height: 3px;
		background: #ffe887;
		opacity: 0;
	}

	.snap-spark i:nth-child(2) { transform: rotate(45deg); }
	.snap-spark i:nth-child(3) { transform: rotate(90deg); }
	.snap-spark i:nth-child(4) { transform: rotate(135deg); }

	.hang-group {
		z-index: 4;
		top: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		translate: -50% 0;
		/* Match Matter body center so tilt follows the simulation, not a pinned corner. */
		transform-origin: center center;
		will-change: transform;
	}

	.frame-body {
		/* Leftover stage under bird+rope. Rope length is physics (7×16px) — do not grow it. */
		--frame-ar: 3 / 4;
		--hang-clearance: 224px;
		position: relative;
		display: block;
		width: min(58vw, 280px, calc(min(37dvh, 230px) * var(--frame-ar)));
		width: min(72vw, 640px, calc(max(0px, 100cqh - var(--hang-clearance)) * var(--frame-ar)));
		height: auto;
		aspect-ratio: var(--frame-ar);
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow:
			0 10px 18px rgba(3, 12, 27, 0.42),
			0 2px 4px rgba(3, 12, 27, 0.18);
		font: inherit;
		color: #1c1a17;
		cursor: grab;
		touch-action: none;
		user-select: none;
		overflow: hidden;
	}

	.frame-view:global(.pulling) .frame-body {
		cursor: grabbing;
	}

	.frame-body:disabled {
		cursor: default;
		opacity: 0.72;
	}

	.frame-slots {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}

	.frame-slot {
		position: absolute;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, transparent 42%),
			#1a1c1f;
		opacity: 0;
		transition: opacity 160ms steps(3);
	}

	.frame-body.art-ready .frame-slot {
		opacity: 1;
	}

	.frame-body:not(.art-ready) {
		background: rgba(12, 18, 28, 0.28);
	}

	.frame-art {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
		-webkit-user-drag: none;
		opacity: 0;
		transition: opacity 180ms steps(3);
	}

	.frame-body.art-ready .frame-art {
		opacity: 1;
	}

	.pager {
		position: relative;
		z-index: 4;
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 0.28rem;
		min-height: 44px;
		padding: 0.15rem 0.75rem 0.35rem;
		text-align: center;
	}

	.pager-name {
		margin: 0;
		max-width: min(90vw, 28rem);
		font-family: var(--font-pixel);
		font-size: clamp(0.42rem, 1.5vw, 0.55rem);
		letter-spacing: 0.12em;
		color: var(--gold-bright);
		text-shadow: 2px 2px 0 #07152d;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pager-count {
		margin: 0;
		font-family: var(--font-pixel);
		font-size: clamp(0.5rem, 1.8vw, 0.65rem);
		letter-spacing: 0.16em;
		color: #f3e6c8;
		text-shadow: 2px 2px 0 #07152d;
	}

	.pager-track {
		--pager-progress: 0;
		position: relative;
		width: min(220px, 48vw);
		height: 8px;
		border: 2px solid var(--gold);
		background: #102f56;
		box-shadow: 2px 2px 0 #07152d;
		overflow: hidden;
	}

	.pager-fill {
		display: block;
		height: 100%;
		width: calc(var(--pager-progress) * 100%);
		background: #b84a43;
		box-shadow: inset 0 0 0 1px var(--gold-bright);
		transition: width 160ms steps(3);
	}

	.footer {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: clamp(0.45rem, 1.6vw, 0.9rem);
		align-items: center;
		max-width: 800px;
		width: 100%;
		margin: 0 auto;
	}

	.actions {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 640px) {
		.frame-view {
			grid-template-rows: auto auto minmax(0, 1fr) auto;
		}

		.headline p {
			max-width: 32rem;
		}

		.relic-count {
			display: none;
		}

		.carousel {
			grid-template-columns: 44px minmax(0, 1fr) 44px;
			gap: 0.25rem;
		}

		.carousel.oracle-carousel {
			grid-template-columns: minmax(0, 1fr);
		}

		.frame-body {
			width: min(72vw, 260px, calc(min(42dvh, 300px) * var(--frame-ar)));
			width: min(78vw, 420px, calc(max(0px, 100cqh - var(--hang-clearance)) * var(--frame-ar)));
		}

		.footer {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}
	}

	@media (max-height: 580px) {
		.frame-view {
			padding-top: 0.4rem;
			padding-bottom: 0.4rem;
			gap: 0.18rem;
		}

		.bird-rig {
			scale: 0.78;
			transform-origin: top center;
		}

		.frame-body {
			--hang-clearance: 168px;
		}

		.pager {
			min-height: 34px;
			gap: 0.18rem;
		}
	}

	@media (max-height: 430px) {
		.eyebrow,
		.headline {
			display: none;
		}

		.footer {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.frame-view *,
		.frame-view *::before,
		.frame-view *::after {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
