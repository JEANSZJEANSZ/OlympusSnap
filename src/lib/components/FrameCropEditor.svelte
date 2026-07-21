<div class="editor">
	<div class="toolbar">
		<span class="hint">Drag corners to crop · drag inside to move · trim excess border</span>
		<div class="toolbar-actions">
			<PixelButton label="USE FULL IMAGE" variant="ghost" disabled={busy} onclick={useFull} />
			<PixelButton
				label={busy ? 'WAIT…' : 'APPLY CROP'}
				variant="gold"
				disabled={busy}
				onclick={applyCrop}
			/>
		</div>
	</div>

	<div class="stage" use:stageMount>
		<img
			bind:this={imgEl}
			class="frame-img"
			src={imageSrc}
			alt="Crop preview"
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
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="crop"
					style:left="{crop.x * 100}%"
					style:top="{crop.y * 100}%"
					style:width="{crop.w * 100}%"
					style:height="{crop.h * 100}%"
					onpointerdown={onCropPointerDown}
				>
					<button
						type="button"
						class="handle nw"
						aria-label="Resize northwest"
						onpointerdown={(e) => onHandlePointerDown(e, 'nw')}
					></button>
					<button
						type="button"
						class="handle ne"
						aria-label="Resize northeast"
						onpointerdown={(e) => onHandlePointerDown(e, 'ne')}
					></button>
					<button
						type="button"
						class="handle sw"
						aria-label="Resize southwest"
						onpointerdown={(e) => onHandlePointerDown(e, 'sw')}
					></button>
					<button
						type="button"
						class="handle se"
						aria-label="Resize southeast"
						onpointerdown={(e) => onHandlePointerDown(e, 'se')}
					></button>
				</div>
			</div>
		{/if}
	</div>
</div>

<script>
	import PixelButton from './PixelButton.svelte';
	import { cropImageToDataUrl, measureImage } from '../utils/imageCrop.js';

	/** @typedef {'nw' | 'ne' | 'sw' | 'se'} Corner */

	/**
	 * @type {{
	 *   imageSrc: string;
	 *   onApply?: (result: { src: string; w: number; h: number }) => void;
	 *   onUseFull?: (result: { src: string; w: number; h: number }) => void;
	 * }}
	 */
	let { imageSrc, onApply, onUseFull } = $props();

	const MIN = 0.02;

	let crop = $state({ x: 0, y: 0, w: 1, h: 1 });
	let busy = $state(false);

	/** @type {HTMLDivElement | undefined} */
	let stageEl = $state();
	/** @type {HTMLDivElement | undefined} */
	let overlayEl = $state();
	/** @type {HTMLImageElement | undefined} */
	let imgEl = $state();

	let content = $state({
		ready: false,
		left: 0,
		top: 0,
		width: 0,
		height: 0
	});

	/**
	 * @typedef {{
	 *   type: 'move' | 'resize';
	 *   pointerId: number;
	 *   startNorm: { x: number; y: number };
	 *   origin: { x: number; y: number; w: number; h: number };
	 *   corner?: Corner;
	 * }} DragState
	 */
	/** @type {DragState | null} */
	let drag = $state(null);

	$effect(() => {
		imageSrc;
		crop = { x: 0, y: 0, w: 1, h: 1 };
	});

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

	/** @param {{ x: number; y: number; w: number; h: number }} s */
	function clampCrop(s) {
		let { x, y, w, h } = s;
		w = Math.min(1, Math.max(MIN, w));
		h = Math.min(1, Math.max(MIN, h));
		x = Math.min(1 - w, Math.max(0, x));
		y = Math.min(1 - h, Math.max(0, y));
		return { x, y, w, h };
	}

	/** @param {PointerEvent} e */
	function onOverlayPointerDown(e) {
		if (e.button !== 0) return;
		if (/** @type {HTMLElement} */ (e.target).closest('.crop')) return;
	}

	/** @param {PointerEvent} e */
	function onCropPointerDown(e) {
		if (e.button !== 0) return;
		if (/** @type {HTMLElement} */ (e.target).closest('.handle')) return;
		e.preventDefault();
		e.stopPropagation();
		const p = toNorm(e);
		if (!p) return;
		drag = {
			type: 'move',
			pointerId: e.pointerId,
			startNorm: p,
			origin: { ...crop }
		};
		overlayEl?.setPointerCapture(e.pointerId);
	}

	/**
	 * @param {PointerEvent} e
	 * @param {Corner} corner
	 */
	function onHandlePointerDown(e, corner) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		const p = toNorm(e);
		if (!p) return;
		drag = {
			type: 'resize',
			pointerId: e.pointerId,
			startNorm: p,
			origin: { ...crop },
			corner
		};
		overlayEl?.setPointerCapture(e.pointerId);
	}

	/**
	 * @param {{ x: number; y: number; w: number; h: number }} origin
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

		return clampCrop({
			x: Math.min(left, right),
			y: Math.min(top, bottom),
			w: Math.abs(right - left),
			h: Math.abs(bottom - top)
		});
	}

	/** @param {PointerEvent} e */
	function onOverlayPointerMove(e) {
		if (!drag || drag.pointerId !== e.pointerId) return;
		const p = toNorm(e);
		if (!p) return;
		const origin = drag.origin;

		if (drag.type === 'move') {
			const dx = p.x - drag.startNorm.x;
			const dy = p.y - drag.startNorm.y;
			crop = clampCrop({
				x: origin.x + dx,
				y: origin.y + dy,
				w: origin.w,
				h: origin.h
			});
			return;
		}

		if (drag.type === 'resize' && drag.corner) {
			crop = resizeFromCorner(origin, drag.corner, p);
		}
	}

	/** @param {PointerEvent} e */
	function onOverlayPointerUp(e) {
		if (!drag || drag.pointerId !== e.pointerId) return;
		drag = null;
		try {
			overlayEl?.releasePointerCapture(e.pointerId);
		} catch {
			/* already released */
		}
	}

	async function applyCrop() {
		if (busy) return;
		busy = true;
		try {
			const result = await cropImageToDataUrl(imageSrc, crop);
			onApply?.(result);
		} catch (err) {
			console.error(err);
		} finally {
			busy = false;
		}
	}

	async function useFull() {
		if (busy) return;
		busy = true;
		try {
			const dims = await measureImage(imageSrc);
			onUseFull?.({ src: imageSrc, w: dims.w, h: dims.h });
		} catch (err) {
			console.error(err);
		} finally {
			busy = false;
		}
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
	}

	.crop {
		position: absolute;
		box-sizing: border-box;
		background: transparent;
		box-shadow:
			0 0 0 9999px rgba(6, 21, 45, 0.55),
			inset 0 0 0 3px var(--gold-bright),
			0 0 0 2px var(--text);
		cursor: move;
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
	}
</style>
