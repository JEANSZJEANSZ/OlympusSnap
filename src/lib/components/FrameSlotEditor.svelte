<div class="editor">
	<div class="toolbar">
		<span class="hint">Drag empty area to add canvases · click to select</span>
		<div class="toolbar-actions">
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

	<div class="stage" use:stageMount>
		<img
			bind:this={imgEl}
			class="frame-img"
			src={imageSrc}
			alt="Frame preview"
			draggable="false"
			onload={measureContent}
		/>
		{#if content.ready}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="overlay"
				bind:this={overlayEl}
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

<script>
	import PixelButton from './PixelButton.svelte';

	/**
	 * @typedef {{ id: string; x: number; y: number; w: number; h: number }} FrameSlot
	 * @typedef {'nw' | 'ne' | 'sw' | 'se'} Corner
	 */

	/** @type {{ imageSrc: string; slots?: FrameSlot[] }} */
	let { imageSrc, slots = $bindable([]) } = $props();

	const MIN = 0.02;

	/** @type {HTMLDivElement | undefined} */
	let stageEl = $state();
	/** @type {HTMLDivElement | undefined} */
	let overlayEl = $state();
	/** @type {HTMLImageElement | undefined} */
	let imgEl = $state();
	let selectedId = $state(/** @type {string | null} */ (null));

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
	}

	/** @param {HTMLDivElement} node */
	function stageMount(node) {
		stageEl = node;
		const ro = new ResizeObserver(() => measureContent());
		ro.observe(node);
		queueMicrotask(measureContent);
		return {
			destroy() {
				ro.disconnect();
				if (stageEl === node) stageEl = undefined;
			}
		};
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
		gap: 0.45rem;
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
