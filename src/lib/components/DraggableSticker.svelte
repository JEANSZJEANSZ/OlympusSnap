<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="sticker-root"
	class:selected
	class:locked={handlesActive}
	use:draggable={{
		x: localX,
		y: localY,
		enabled: !handlesActive,
		onMove: (pos) => {
			if (handlesActive) return;
			localX = pos.x;
			localY = pos.y;
			onTransform?.({
				x: pos.x,
				y: pos.y,
				scale: localScale,
				rotation: localRotation
			});
		}
	}}
	style:--scale={localScale}
	style:--rotation="{localRotation}deg"
	style:--base="{BASE}px"
	onpointerdown={onBodyPointerDown}
	role="img"
	aria-label="Transformable sticker"
>
	<div class="sticker-box" bind:this={boxEl}>
		{#if src}
			<img {src} alt="" draggable="false" />
		{:else if label}
			<span class="glyph">{label}</span>
		{/if}

		{#if selected}
			<div class="frame" aria-hidden="true"></div>
			<button
				type="button"
				class="handle rotate"
				aria-label="Rotate"
				onpointerdown={startRotate}
			></button>
			<button
				type="button"
				class="handle nw"
				aria-label="Scale"
				onpointerdown={(e) => startResize(e, 'nw')}
			></button>
			<button
				type="button"
				class="handle ne"
				aria-label="Scale"
				onpointerdown={(e) => startResize(e, 'ne')}
			></button>
			<button
				type="button"
				class="handle sw"
				aria-label="Scale"
				onpointerdown={(e) => startResize(e, 'sw')}
			></button>
			<button
				type="button"
				class="handle se"
				aria-label="Scale"
				onpointerdown={(e) => startResize(e, 'se')}
			></button>
		{/if}
	</div>
</div>

<script module>
	export { draggable } from '../utils/draggable.js';
</script>

<script>
	import { draggable } from '../utils/draggable.js';

	const BASE = 64;
	const MIN_SCALE = 0.35;
	const MAX_SCALE = 3;

	/**
	 * Canva-style selectable sticker: move, uniform scale, rotate.
	 * Scale/rotate lock the root position (center-anchored); only body drag moves.
	 * @type {{
	 *   src?: string;
	 *   label?: string;
	 *   x?: number;
	 *   y?: number;
	 *   scale?: number;
	 *   rotation?: number;
	 *   selected?: boolean;
	 *   onSelect?: () => void;
	 *   onTransform?: (t: { x: number; y: number; scale: number; rotation: number }) => void;
	 * }}
	 */
	let {
		src = '',
		label = '',
		x = 0,
		y = 0,
		scale = 1,
		rotation = 0,
		selected = false,
		onSelect,
		onTransform
	} = $props();

	let localX = $state(0);
	let localY = $state(0);
	let localScale = $state(1);
	let localRotation = $state(0);
	/** When true, body drag is disabled (handle gesture in progress). */
	let handlesActive = $state(false);

	$effect(() => {
		if (handlesActive) return;
		localX = x;
		localY = y;
		localScale = scale;
		localRotation = rotation;
	});

	$effect(() => {
		if (!selected && handlesActive) handlesActive = false;
	});

	/** @type {HTMLElement | undefined} */
	let boxEl = $state();

	function emit() {
		onTransform?.({
			x: localX,
			y: localY,
			scale: localScale,
			rotation: localRotation
		});
	}

	function clampScale(/** @type {number} */ s) {
		return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
	}

	/** Size in px for a given scale (top-left positioned box). */
	function sizeAt(/** @type {number} */ s) {
		return BASE * s;
	}

	/**
	 * Apply a new scale while keeping the visual center fixed
	 * (so the root does not drift when resizing).
	 * @param {number} nextScale
	 */
	function setScaleKeepingCenter(nextScale) {
		const prev = localScale;
		const next = clampScale(nextScale);
		if (next === prev) return;
		const cx = localX + sizeAt(prev) / 2;
		const cy = localY + sizeAt(prev) / 2;
		localScale = next;
		localX = cx - sizeAt(next) / 2;
		localY = cy - sizeAt(next) / 2;
	}

	/** @param {PointerEvent} e */
	function onBodyPointerDown(e) {
		if (/** @type {Element} */ (e.target).closest?.('.handle')) return;
		onSelect?.();
		e.stopPropagation();
	}

	/**
	 * @param {PointerEvent} e
	 * @param {HTMLElement} captureTarget
	 * @param {() => void} removeListeners
	 */
	function finishHandleGesture(e, captureTarget, removeListeners) {
		try {
			if (captureTarget.hasPointerCapture?.(e.pointerId)) {
				captureTarget.releasePointerCapture(e.pointerId);
			}
		} catch {
			/* already released */
		}
		removeListeners();
		emit();
		handlesActive = false;
	}

	/**
	 * @param {PointerEvent} e
	 * @param {'nw' | 'ne' | 'sw' | 'se'} corner
	 */
	function startResize(e, corner) {
		e.stopPropagation();
		e.preventDefault();
		onSelect?.();

		const startScale = localScale;
		const rect = boxEl?.getBoundingClientRect();
		if (!rect) return;

		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
		const captureTarget = /** @type {HTMLElement} */ (e.currentTarget);

		handlesActive = true;
		try {
			captureTarget.setPointerCapture(e.pointerId);
		} catch {
			handlesActive = false;
			return;
		}

		/** @param {PointerEvent} ev */
		function onMove(ev) {
			const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy);
			setScaleKeepingCenter(startScale * (dist / startDist));
		}

		function removeListeners() {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			window.removeEventListener('lostpointercapture', onUp);
		}

		/** @param {PointerEvent} ev */
		function onUp(ev) {
			finishHandleGesture(ev, captureTarget, removeListeners);
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		window.addEventListener('lostpointercapture', onUp);
		void corner;
	}

	/** @param {PointerEvent} e */
	function startRotate(e) {
		e.stopPropagation();
		e.preventDefault();
		onSelect?.();

		const rect = boxEl?.getBoundingClientRect();
		if (!rect) return;

		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
		const startRotation = localRotation;
		const lockedX = localX;
		const lockedY = localY;
		const captureTarget = /** @type {HTMLElement} */ (e.currentTarget);

		handlesActive = true;
		try {
			captureTarget.setPointerCapture(e.pointerId);
		} catch {
			handlesActive = false;
			return;
		}

		/** @param {PointerEvent} ev */
		function onMove(ev) {
			localX = lockedX;
			localY = lockedY;
			const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
			const delta = ((angle - startAngle) * 180) / Math.PI;
			localRotation = startRotation + delta;
		}

		function removeListeners() {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			window.removeEventListener('lostpointercapture', onUp);
		}

		/** @param {PointerEvent} ev */
		function onUp(ev) {
			localX = lockedX;
			localY = lockedY;
			finishHandleGesture(ev, captureTarget, removeListeners);
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		window.addEventListener('lostpointercapture', onUp);
	}
</script>

<style>
	.sticker-root {
		position: absolute;
		left: 0;
		top: 0;
		width: calc(var(--base) * var(--scale, 1));
		height: calc(var(--base) * var(--scale, 1));
		z-index: 5;
		touch-action: none;
		user-select: none;
		cursor: grab;
	}

	.sticker-root.selected {
		z-index: 20;
	}

	.sticker-root.locked {
		cursor: default;
	}

	.sticker-root:global(.is-dragging) {
		cursor: grabbing;
	}

	.sticker-box {
		position: relative;
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		transform: rotate(var(--rotation, 0deg));
		transform-origin: center center;
		filter: drop-shadow(2px 2px 0 var(--text));
	}

	.sticker-root.selected .sticker-box {
		filter: drop-shadow(3px 3px 0 var(--primary));
	}

	.sticker-box img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}

	.glyph {
		font-size: calc(2rem * var(--scale, 1));
		line-height: 1;
		pointer-events: none;
	}

	.frame {
		position: absolute;
		inset: -4px;
		box-shadow:
			0 0 0 2px var(--bg-base),
			0 0 0 4px var(--accent);
		pointer-events: none;
	}

	.handle {
		position: absolute;
		width: 18px;
		height: 18px;
		padding: 0;
		background: var(--bg-base);
		box-shadow:
			0 0 0 2px var(--text),
			2px 2px 0 var(--primary);
		cursor: nwse-resize;
		z-index: 3;
		border: none;
		touch-action: none;
	}

	.handle.ne {
		cursor: nesw-resize;
	}

	.handle.sw {
		cursor: nesw-resize;
	}

	.handle.nw {
		top: -10px;
		left: -10px;
	}

	.handle.ne {
		top: -10px;
		right: -10px;
	}

	.handle.sw {
		bottom: -10px;
		left: -10px;
	}

	.handle.se {
		bottom: -10px;
		right: -10px;
	}

	.handle.rotate {
		top: -40px;
		left: 50%;
		margin-left: -9px;
		transform: none;
		width: 18px;
		height: 18px;
		background: var(--gold);
		cursor: grab;
		box-shadow:
			0 0 0 2px var(--text),
			2px 2px 0 var(--primary);
	}

	.handle.rotate::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 100%;
		width: 2px;
		height: 16px;
		background: var(--accent);
		transform: translateX(-50%);
		pointer-events: none;
	}
</style>
