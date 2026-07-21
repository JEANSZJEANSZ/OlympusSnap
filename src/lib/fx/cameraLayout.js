/**
 * Camera layout helpers — measure active slot hole for snap ritual FLIP.
 */

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
