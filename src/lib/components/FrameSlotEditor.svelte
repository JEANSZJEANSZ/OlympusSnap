<svelte:window onkeydown={onWindowKeydown} onkeyup={onWindowKeyup} onblur={onWindowBlur} />

<div class="editor">
	<div class="toolbar">
		<span class="hint">wheel zoom · space-drag pan · zoom in to hug transparent holes</span>
		<div class="toolbar-actions">
			<span class="zoom-tools">
				<PixelButton
					label="−"
					variant="ghost"
					disabled={zoom <= ZOOM_MIN}
					ariaLabel="Zoom out"
					onclick={zoomOut}
				/>
				<span class="zoom-pct">{Math.round(zoom * 100)}%</span>
				<PixelButton
					label="+"
					variant="ghost"
					disabled={zoom >= ZOOM_MAX}
					ariaLabel="Zoom in"
					onclick={zoomIn}
				/>
				<PixelButton label="FIT" variant="ghost" onclick={fitView} />
			</span>
			<PixelButton
				label="PAN"
				variant={panMode ? 'gold' : 'ghost'}
				ariaLabel={panMode ? 'Pan mode on' : 'Pan mode off'}
				onclick={togglePanMode}
			/>
			<PixelButton
				label="DELETE"
				variant="ghost"
				disabled={!selectedId || slots.length === 0}
				onclick={deleteSelected}
			/>
			<PixelButton
				label="CLEAR ALL"
				variant="ghost"
				disabled={slots.length === 0}
				onclick={clearAll}
			/>
		</div>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="stage"
		class:is-pan={panMode || spaceHeld}
		class:is-panning={!!panDrag}
		{@attach stageMount}
		onpointerdown={onStagePointerDown}
		onpointermove={onStagePointerMove}
		onpointerup={onStagePointerUp}
		onpointercancel={onStagePointerUp}
		onpointerenter={onStagePointerEnter}
		onpointerleave={onStagePointerLeave}
	>
		<div
			class="world"
			style:transform="translate({panX}px, {panY}px) scale({zoom})"
			style:transform-origin="0 0"
		>
			<img
				class="frame-img"
				src={imageSrc}
				alt="Frame preview"
				draggable="false"
				onload={measureContent}
				{@attach imgMount}
			/>
			{#if content.ready}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="overlay"
					{@attach overlayMount}
					style:left="{content.left}px"
					style:top="{content.top}px"
					style:width="{content.width}px"
					style:height="{content.height}px"
					onpointerdown={onOverlayPointerDown}
					onpointermove={onOverlayPointerMove}
					onpointerup={onOverlayPointerUp}
					onpointercancel={onOverlayPointerUp}
				>
					{#each slots as slot, i (slot.id)}
						{@const selected = slot.id === selectedId}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="slot"
							class:selected
							style:left="{slot.x * 100}%"
							style:top="{slot.y * 100}%"
							style:width="{slot.w * 100}%"
							style:height="{slot.h * 100}%"
							onpointerdown={(e) => onSlotPointerDown(e, slot.id)}
						>
							{#if selected}
								<span class="badge">{i + 1}</span>
								<button
									type="button"
									class="handle nw"
									aria-label="Resize northwest"
									onpointerdown={(e) => onHandlePointerDown(e, slot.id, 'nw')}
								></button>
								<button
									type="button"
									class="handle ne"
									aria-label="Resize northeast"
									onpointerdown={(e) => onHandlePointerDown(e, slot.id, 'ne')}
								></button>
								<button
									type="button"
									class="handle sw"
									aria-label="Resize southwest"
									onpointerdown={(e) => onHandlePointerDown(e, slot.id, 'sw')}
								></button>
								<button
									type="button"
									class="handle se"
									aria-label="Resize southeast"
									onpointerdown={(e) => onHandlePointerDown(e, slot.id, 'se')}
								></button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<script>
	import PixelButton from './PixelButton.svelte';

	/**
	 * @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot
	 * @typedef {'nw' | 'ne' | 'sw' | 'se'} Corner
	 */

	/** @type {{ imageSrc: string; slots?: FrameSlot[] }} */
	let { imageSrc, slots = $bindable([]) } = $props();

	const MIN = 0.02;
	const ZOOM_MIN = 1;
	const ZOOM_MAX = 6;
	const ZOOM_STEP = 0.25;
	const PAN_KEEP = 48;

	/** @type {HTMLDivElement | undefined} */
	let stageEl = $state();
	/** @type {HTMLDivElement | undefined} */
	let overlayEl = $state();
	/** @type {HTMLImageElement | undefined} */
	let imgEl = $state();
	let selectedId = $state(/** @type {string | null} */ (null));

	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let panMode = $state(false);
	let spaceHeld = $state(false);
	let pointerOverStage = $state(false);

	let content = $state({
		ready: false,
		left: 0,
		top: 0,
		width: 0,
		height: 0
	});

	/**
	 * @typedef {{
	 *   type: 'create' | 'move' | 'resize';
	 *   id: string;
	 *   pointerId: number;
	 *   startNorm: { x: number; y: number };
	 *   origin?: FrameSlot;
	 *   corner?: Corner;
	 * }} DragState
	 */
	/** @type {DragState | null} */
	let drag = $state(null);

	/**
	 * @typedef {{
	 *   pointerId: number;
	 *   startX: number;
	 *   startY: number;
	 *   originX: number;
	 *   originY: number;
	 * }} PanDrag
	 */
	/** @type {PanDrag | null} */
	let panDrag = $state(null);

	function measureContent() {
		if (!stageEl || !imgEl) return;
		const nw = imgEl.naturalWidth;
		const nh = imgEl.naturalHeight;
		if (!nw || !nh) {
			content = { ready: false, left: 0, top: 0, width: 0, height: 0 };
			return;
		}
		const cw = stageEl.clientWidth;
		const ch = stageEl.clientHeight;
		const scale = Math.min(cw / nw, ch / nh);
		const width = nw * scale;
		const height = nh * scale;
		content = {
			ready: true,
			left: (cw - width) / 2,
			top: (ch - height) / 2,
			width,
			height
		};
		applyPan(panX, panY, zoom);
	}

	/** @param {number} z */
	function clampZoom(z) {
		return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
	}

	/**
	 * @param {number} px
	 * @param {number} py
	 * @param {number} z
	 */
	function clampPan(px, py, z) {
		if (!stageEl || !content.ready) return { x: px, y: py };
		const sw = stageEl.clientWidth;
		const sh = stageEl.clientHeight;
		const imgW = content.width * z;
		const imgH = content.height * z;
		const keepX = Math.min(PAN_KEEP, sw * 0.2, imgW * 0.5);
		const keepY = Math.min(PAN_KEEP, sh * 0.2, imgH * 0.5);
		let minX = keepX - imgW - content.left * z;
		let maxX = sw - keepX - content.left * z;
		let minY = keepY - imgH - content.top * z;
		let maxY = sh - keepY - content.top * z;
		if (minX > maxX) {
			const mid = (minX + maxX) / 2;
			minX = maxX = mid;
		}
		if (minY > maxY) {
			const mid = (minY + maxY) / 2;
			minY = maxY = mid;
		}
		return {
			x: Math.min(maxX, Math.max(minX, px)),
			y: Math.min(maxY, Math.max(minY, py))
		};
	}

	/**
	 * @param {number} px
	 * @param {number} py
	 * @param {number} z
	 */
	function applyPan(px, py, z) {
		const next = clampPan(px, py, z);
		panX = next.x;
		panY = next.y;
	}

	/**
	 * @param {number} sx
	 * @param {number} sy
	 * @param {number} nextZoom
	 */
	function zoomAtPoint(sx, sy, nextZoom) {
		const z = zoom;
		const worldX = (sx - panX) / z;
		const worldY = (sy - panY) / z;
		zoom = nextZoom;
		applyPan(sx - worldX * nextZoom, sy - worldY * nextZoom, nextZoom);
	}

	/** @param {number} nextZoom */
	function zoomTowardCenter(nextZoom) {
		if (!stageEl) {
			zoom = nextZoom;
			applyPan(panX, panY, nextZoom);
			return;
		}
		zoomAtPoint(stageEl.clientWidth / 2, stageEl.clientHeight / 2, nextZoom);
	}

	function zoomIn() {
		zoomTowardCenter(clampZoom(zoom + ZOOM_STEP));
	}

	function zoomOut() {
		zoomTowardCenter(clampZoom(zoom - ZOOM_STEP));
	}

	function fitView() {
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	function togglePanMode() {
		panMode = !panMode;
	}

	/** @param {WheelEvent} e */
	function handleStageWheel(e) {
		e.preventDefault();
		if (!stageEl) return;
		const rect = stageEl.getBoundingClientRect();
		const next = clampZoom(zoom * Math.exp(-e.deltaY * 0.0015));
		if (next === zoom) return;
		zoomAtPoint(e.clientX - rect.left, e.clientY - rect.top, next);
	}

	/** @type {import('svelte/attachments').Attachment<HTMLDivElement>} */
	function stageMount(node) {
		stageEl = node;
		const ro = new ResizeObserver(() => measureContent());
		ro.observe(node);
		node.addEventListener('wheel', handleStageWheel, { passive: false });
		queueMicrotask(measureContent);
		return () => {
			ro.disconnect();
			node.removeEventListener('wheel', handleStageWheel);
			if (stageEl === node) stageEl = undefined;
		};
	}

	/** @type {import('svelte/attachments').Attachment<HTMLImageElement>} */
	function imgMount(node) {
		imgEl = node;
		return () => {
			if (imgEl === node) imgEl = undefined;
		};
	}

	/** @type {import('svelte/attachments').Attachment<HTMLDivElement>} */
	function overlayMount(node) {
		overlayEl = node;
		return () => {
			if (overlayEl === node) overlayEl = undefined;
		};
	}

	function onStagePointerEnter() {
		pointerOverStage = true;
	}

	function onStagePointerLeave() {
		if (panDrag) return;
		pointerOverStage = false;
	}

	/**
	 * @param {PointerEvent} e
	 */
	function wantsPan(e) {
		if (drag) return false;
		if (e.button === 1) return true;
		if (e.button !== 0) return false;
		if (spaceHeld) return true;
		if (panMode && !/** @type {HTMLElement} */ (e.target).closest('.slot')) return true;
		return false;
	}

	/** @param {PointerEvent} e */
	function onStagePointerDown(e) {
		if (!wantsPan(e)) return;
		e.preventDefault();
		e.stopPropagation();
		panDrag = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			originX: panX,
			originY: panY
		};
		stageEl?.setPointerCapture(e.pointerId);
	}

	/** @param {PointerEvent} e */
	function onStagePointerMove(e) {
		if (!panDrag || panDrag.pointerId !== e.pointerId) return;
		applyPan(panDrag.originX + (e.clientX - panDrag.startX), panDrag.originY + (e.clientY - panDrag.startY), zoom);
	}

	/** @param {PointerEvent} e */
	function onStagePointerUp(e) {
		if (!panDrag || panDrag.pointerId !== e.pointerId) return;
		panDrag = null;
		try {
			stageEl?.releasePointerCapture(e.pointerId);
		} catch {
			/* already released */
		}
	}

	/** @param {KeyboardEvent} e */
	function onWindowKeydown(e) {
		if (isTypingTarget(e.target)) return;
		if (e.key === ' ' || e.code === 'Space') {
			if (pointerOverStage || spaceHeld || panDrag) {
				e.preventDefault();
				spaceHeld = true;
			}
			return;
		}
		if (!pointerOverStage) return;
		if (e.key === '=' || e.key === '+') {
			e.preventDefault();
			zoomIn();
			return;
		}
		if (e.key === '-' || e.key === '_') {
			e.preventDefault();
			zoomOut();
			return;
		}
		if (e.key === '0') {
			e.preventDefault();
			fitView();
		}
	}

	/** @param {KeyboardEvent} e */
	function onWindowKeyup(e) {
		if (e.key === ' ' || e.code === 'Space') {
			spaceHeld = false;
		}
	}

	function onWindowBlur() {
		spaceHeld = false;
	}

	/** @param {EventTarget | null} target */
	function isTypingTarget(target) {
		if (!(target instanceof HTMLElement)) return false;
		return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
	}

	/**
	 * @param {PointerEvent} e
	 * @returns {{ x: number; y: number } | null}
	 */
	function toNorm(e) {
		if (!overlayEl) return null;
		const rect = overlayEl.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		return {
			x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
			y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
		};
	}

	function makeId() {
		return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	}

	/**
	 * @param {{ x: number; y: number }} a
	 * @param {{ x: number; y: number }} b
	 */
	function normalizeRect(a, b) {
		const x = Math.min(a.x, b.x);
		const y = Math.min(a.y, b.y);
		const w = Math.abs(b.x - a.x);
		const h = Math.abs(b.y - a.y);
		return { x, y, w, h };
	}

	/** @param {FrameSlot} s */
	function clampSlot(s) {
		let { x, y, w, h } = s;
		w = Math.min(1, Math.max(MIN, w));
		h = Math.min(1, Math.max(MIN, h));
		x = Math.min(1 - w, Math.max(0, x));
		y = Math.min(1 - h, Math.max(0, y));
		return { ...s, x, y, w, h };
	}

	/** @param {PointerEvent} e */
	function onOverlayPointerDown(e) {
		if (e.button !== 0) return;
		if (spaceHeld || panMode) return;
		if (/** @type {HTMLElement} */ (e.target).closest('.slot')) return;
		const p = toNorm(e);
		if (!p) return;
		e.preventDefault();
		const id = makeId();
		slots = [...slots, { id, x: p.x, y: p.y, w: 0, h: 0 }];
		selectedId = id;
		drag = {
			type: 'create',
			id,
			pointerId: e.pointerId,
			startNorm: p
		};
		overlayEl?.setPointerCapture(e.pointerId);
	}

	/**
	 * @param {PointerEvent} e
	 * @param {string} id
	 */
	function onSlotPointerDown(e, id) {
		if (e.button !== 0) return;
		if (spaceHeld) return;
		if (/** @type {HTMLElement} */ (e.target).closest('.handle')) return;
		e.preventDefault();
		e.stopPropagation();
		selectedId = id;
		const slot = slots.find((s) => s.id === id);
		if (!slot) return;
		const p = toNorm(e);
		if (!p) return;
		drag = {
			type: 'move',
			id,
			pointerId: e.pointerId,
			startNorm: p,
			origin: { ...slot }
		};
		overlayEl?.setPointerCapture(e.pointerId);
	}

	/**
	 * @param {PointerEvent} e
	 * @param {string} id
	 * @param {Corner} corner
	 */
	function onHandlePointerDown(e, id, corner) {
		if (e.button !== 0) return;
		if (spaceHeld) return;
		e.preventDefault();
		e.stopPropagation();
		selectedId = id;
		const slot = slots.find((s) => s.id === id);
		if (!slot) return;
		const p = toNorm(e);
		if (!p) return;
		drag = {
			type: 'resize',
			id,
			pointerId: e.pointerId,
			startNorm: p,
			origin: { ...slot },
			corner
		};
		overlayEl?.setPointerCapture(e.pointerId);
	}

	/** @param {PointerEvent} e */
	function onOverlayPointerMove(e) {
		if (!drag || drag.pointerId !== e.pointerId) return;
		const p = toNorm(e);
		if (!p) return;

		if (drag.type === 'create') {
			const r = normalizeRect(drag.startNorm, p);
			slots = slots.map((s) => (s.id === drag.id ? { ...s, ...r } : s));
			return;
		}

		const origin = drag.origin;
		if (!origin) return;

		if (drag.type === 'move') {
			const dx = p.x - drag.startNorm.x;
			const dy = p.y - drag.startNorm.y;
			const next = clampSlot({
				...origin,
				x: origin.x + dx,
				y: origin.y + dy
			});
			slots = slots.map((s) => (s.id === drag.id ? next : s));
			return;
		}

		if (drag.type === 'resize' && drag.corner) {
			const next = resizeFromCorner(origin, drag.corner, p);
			slots = slots.map((s) => (s.id === drag.id ? next : s));
		}
	}

	/**
	 * @param {FrameSlot} origin
	 * @param {Corner} corner
	 * @param {{ x: number; y: number }} p
	 */
	function resizeFromCorner(origin, corner, p) {
		let left = origin.x;
		let top = origin.y;
		let right = origin.x + origin.w;
		let bottom = origin.y + origin.h;

		if (corner.includes('w')) left = p.x;
		if (corner.includes('e')) right = p.x;
		if (corner.includes('n')) top = p.y;
		if (corner.includes('s')) bottom = p.y;

		if (right - left < MIN) {
			if (corner.includes('w')) left = right - MIN;
			else right = left + MIN;
		}
		if (bottom - top < MIN) {
			if (corner.includes('n')) top = bottom - MIN;
			else bottom = top + MIN;
		}

		left = Math.min(1 - MIN, Math.max(0, left));
		top = Math.min(1 - MIN, Math.max(0, top));
		right = Math.min(1, Math.max(left + MIN, right));
		bottom = Math.min(1, Math.max(top + MIN, bottom));

		return clampSlot({
			id: origin.id,
			x: Math.min(left, right),
			y: Math.min(top, bottom),
			w: Math.abs(right - left),
			h: Math.abs(bottom - top)
		});
	}

	/** @param {PointerEvent} e */
	function onOverlayPointerUp(e) {
		if (!drag || drag.pointerId !== e.pointerId) return;
		const finished = drag;
		drag = null;

		try {
			overlayEl?.releasePointerCapture(e.pointerId);
		} catch {
			/* already released */
		}

		if (finished.type === 'create') {
			const slot = slots.find((s) => s.id === finished.id);
			if (!slot || slot.w < MIN || slot.h < MIN) {
				slots = slots.filter((s) => s.id !== finished.id);
				if (selectedId === finished.id) selectedId = null;
				return;
			}
			slots = slots.map((s) => (s.id === finished.id ? clampSlot(s) : s));
		}
	}

	function deleteSelected() {
		if (!selectedId) return;
		slots = slots.filter((s) => s.id !== selectedId);
		selectedId = null;
	}

	function clearAll() {
		slots = [];
		selectedId = null;
	}
</script>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		width: 100%;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.hint {
		font-size: 0.4rem;
		color: var(--ink-soft);
		line-height: 1.5;
	}

	.toolbar-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
	}

	.zoom-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
	}

	.zoom-pct {
		min-width: 2.8rem;
		font-family: var(--font-pixel);
		font-size: 0.45rem;
		letter-spacing: 0.04em;
		text-align: center;
		color: var(--gold-bright, var(--gold));
	}

	.stage {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 4;
		max-height: min(58vh, 520px);
		background: var(--bg-base);
		box-shadow: inset 0 0 0 3px var(--text);
		overflow: hidden;
		touch-action: none;
		user-select: none;
	}

	.stage.is-pan {
		cursor: grab;
	}

	.stage.is-panning {
		cursor: grabbing;
	}

	.world {
		position: relative;
		width: 100%;
		height: 100%;
		transform-origin: 0 0;
		will-change: transform;
		background-color: color-mix(in srgb, var(--bg-base) 82%, #c4b8a0);
		background-image: repeating-conic-gradient(
			color-mix(in srgb, var(--text) 18%, var(--bg-base)) 0% 25%,
			color-mix(in srgb, var(--bg-base) 88%, #e8dfd0) 0% 50%
		);
		background-size: 16px 16px;
	}

	.frame-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}

	.overlay {
		position: absolute;
		touch-action: none;
		cursor: crosshair;
	}

	.stage.is-pan .overlay {
		cursor: grab;
	}

	.stage.is-panning .overlay {
		cursor: grabbing;
	}

	.slot {
		position: absolute;
		box-sizing: border-box;
		background: color-mix(in srgb, var(--gold) 28%, transparent);
		box-shadow:
			inset 0 0 0 2px var(--gold-bright),
			0 0 0 2px var(--text);
		cursor: move;
	}

	.slot.selected {
		background: color-mix(in srgb, var(--gold) 42%, transparent);
		box-shadow:
			inset 0 0 0 3px var(--gold-bright),
			0 0 0 2px var(--primary);
		z-index: 2;
	}

	.badge {
		position: absolute;
		top: 2px;
		left: 2px;
		min-width: 1.1rem;
		padding: 0.15rem 0.25rem;
		font-family: var(--font-pixel);
		font-size: 0.4rem;
		line-height: 1;
		text-align: center;
		color: var(--bg-base);
		background: var(--gold);
		box-shadow: 2px 2px 0 var(--text);
		pointer-events: none;
	}

	.handle {
		position: absolute;
		width: 12px;
		height: 12px;
		padding: 0;
		border: none;
		background: var(--gold-bright);
		box-shadow: 2px 2px 0 var(--text);
		cursor: nwse-resize;
		z-index: 3;
	}

	.handle.nw {
		top: -6px;
		left: -6px;
		cursor: nwse-resize;
	}

	.handle.ne {
		top: -6px;
		right: -6px;
		cursor: nesw-resize;
	}

	.handle.sw {
		bottom: -6px;
		left: -6px;
		cursor: nesw-resize;
	}

	.handle.se {
		bottom: -6px;
		right: -6px;
		cursor: nwse-resize;
	}
</style>
