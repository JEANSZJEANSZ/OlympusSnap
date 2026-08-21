/**
 * Screen-space point vs DOMRect, with optional padding (px).
 * @param {number} x
 * @param {number} y
 * @param {DOMRect | { left: number; right: number; top: number; bottom: number } | null | undefined} rect
 * @param {number} [pad]
 * @returns {boolean}
 */
export function isPointInRect(x, y, rect, pad = 0) {
	if (!rect || !Number.isFinite(x) || !Number.isFinite(y)) return false;
	const p = Number.isFinite(pad) ? pad : 0;
	return x >= rect.left - p && x <= rect.right + p && y >= rect.top - p && y <= rect.bottom + p;
}
