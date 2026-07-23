/**
 * Camera layout helpers — measure frame dock / slot holes for snap ritual FLIP.
 */

/**
 * @param {ParentNode | null | undefined} root
 * @returns {DOMRect | null}
 */
export function getFrameDockRect(root) {
	if (!root) return null;
	const dock = root.querySelector('.frame-dock');
	if (!dock) return null;
	const r = dock.getBoundingClientRect();
	if (r.width > 2 && r.height > 2) return r;
	return null;
}

/**
 * @param {ParentNode | null | undefined} root
 * @param {number} slotIndex
 * @returns {DOMRect | null}
 */
export function getActiveHoleRect(root, slotIndex) {
	if (!root) return null;
	const hole = root.querySelector(`.hole[data-slot-index="${slotIndex}"]`);
	if (hole) {
		const r = hole.getBoundingClientRect();
		if (r.width > 2 && r.height > 2) return r;
	}
	const dock = root.querySelector('.frame-dock');
	if (dock) {
		const r = dock.getBoundingClientRect();
		if (r.width > 2 && r.height > 2) return r;
	}
	return null;
}

/**
 * Fullscreen target rect with safe padding (viewport aspect — legacy).
 * @param {number} [pad=12]
 */
export function getFullscreenRect(pad = 12) {
	return new DOMRect(pad, pad, window.innerWidth - pad * 2, window.innerHeight - pad * 2);
}

/**
 * Largest rect that fits inside the viewport while preserving source aspect ratio.
 * @param {DOMRect} sourceRect
 * @param {number} [pad=14]
 */
export function getContainedFullscreenRect(sourceRect, pad = 14) {
	const ar = sourceRect.width / Math.max(sourceRect.height, 1);
	const availW = window.innerWidth - pad * 2;
	const availH = window.innerHeight - pad * 2;

	let w;
	let h;
	if (availW / availH > ar) {
		h = availH;
		w = h * ar;
	} else {
		w = availW;
		h = w / ar;
	}

	const left = (window.innerWidth - w) / 2;
	const top = (window.innerHeight - h) / 2;
	return new DOMRect(left, top, w, h);
}

/**
 * @param {DOMRect} rect
 */
export function rectToStyle(rect) {
	return {
		left: `${rect.left}px`,
		top: `${rect.top}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`
	};
}

/**
 * @param {DOMRect} rect
 * @returns {{ x: number; y: number }}
 */
export function rectCenter(rect) {
	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2
	};
}

/**
 * Grow a rect around its center.
 * @param {DOMRect} rect
 * @param {number} [factor=1.5]
 */
export function expandRectAroundCenter(rect, factor = 1.5) {
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;
	const w = rect.width * factor;
	const h = rect.height * factor;
	return new DOMRect(cx - w / 2, cy - h / 2, w, h);
}

/**
 * Clamp inner rect to outer bounds (preserves size when possible).
 * @param {DOMRect} inner
 * @param {DOMRect} outer
 */
export function clampRectToOuter(inner, outer) {
	let left = inner.left;
	let top = inner.top;
	let width = inner.width;
	let height = inner.height;

	if (left < outer.left) left = outer.left;
	if (top < outer.top) top = outer.top;
	if (left + width > outer.right) left = outer.right - width;
	if (top + height > outer.bottom) top = outer.bottom - height;

	if (left < outer.left) {
		left = outer.left;
		width = Math.min(width, outer.width);
	}
	if (top < outer.top) {
		top = outer.top;
		height = Math.min(height, outer.height);
	}

	return new DOMRect(left, top, width, height);
}

/**
 * Active slot hole expanded with nearby frame context, clamped to dock.
 * @param {ParentNode | null | undefined} root
 * @param {number} slotIndex
 * @param {number} [expandFactor=1.5]
 */
export function getSlotFocusRect(root, slotIndex, expandFactor = 1.5) {
	const dock = getFrameDockRect(root);
	const hole = getActiveHoleRect(root, slotIndex);
	if (!dock) return hole;
	if (!hole) return dock;
	return clampRectToOuter(expandRectAroundCenter(hole, expandFactor), dock);
}

/**
 * Transform-origin percentages for scaling frame-scene toward a focus rect.
 * @param {DOMRect} dockRect
 * @param {DOMRect} focusRect
 */
export function focusTransformOrigin(dockRect, focusRect) {
	const c = rectCenter(focusRect);
	const ox = ((c.x - dockRect.left) / Math.max(dockRect.width, 1)) * 100;
	const oy = ((c.y - dockRect.top) / Math.max(dockRect.height, 1)) * 100;
	return `${ox}% ${oy}%`;
}

/**
 * Google-Earth style zoom: map a focus region inside the dock frame onto a
 * contain-fit viewport target via uniform translate+scale (origin 0,0).
 * The whole frame is one zoom element — surrounding art scales with the canvas.
 *
 * @param {DOMRect} dockRect Frame dock on screen
 * @param {DOMRect} focusRect Active canvas/hole on screen (absolute)
 * @param {number} [pad=12]
 * @returns {{
 *   start: { x: number; y: number; scale: number };
 *   end: { x: number; y: number; scale: number };
 *   target: DOMRect;
 * }}
 */
export function getEarthZoomTransforms(dockRect, focusRect, pad = 12) {
	const focus = focusRect.width > 2 && focusRect.height > 2 ? focusRect : dockRect;
	const target = getContainedFullscreenRect(focus, pad);

	const localX = focus.left - dockRect.left;
	const localY = focus.top - dockRect.top;
	const endScale = target.width / Math.max(focus.width, 1);

	return {
		start: {
			x: dockRect.left,
			y: dockRect.top,
			scale: 1
		},
		end: {
			x: target.left - localX * endScale,
			y: target.top - localY * endScale,
			scale: endScale
		},
		target
	};
}
