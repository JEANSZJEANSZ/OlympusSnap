/**
 * Svelte action: drag via CSS transform translate(x, y).
 * Skips drag when the event starts on a transform handle (.handle)
 * or when params.enabled === false.
 *
 * @param {HTMLElement} node
 * @param {{
 *   x?: number;
 *   y?: number;
 *   enabled?: boolean;
 *   onMove?: (pos: { x: number; y: number }) => void;
 * }} [params]
 */
export function draggable(node, params = {}) {
	let x = params.x ?? 0;
	let y = params.y ?? 0;
	let enabled = params.enabled !== false;
	let dragging = false;
	/** @type {number} */
	let startX = 0;
	/** @type {number} */
	let startY = 0;
	/** @type {number} */
	let originX = 0;
	/** @type {number} */
	let originY = 0;

	function apply() {
		node.style.transform = `translate(${x}px, ${y}px)`;
	}

	/** @param {EventTarget | null} target */
	function isHandleTarget(target) {
		return target instanceof Element && !!target.closest('.handle');
	}

	/** @param {PointerEvent} e */
	function onPointerDown(e) {
		if (!enabled || isHandleTarget(e.target)) return;
		// Only primary button / touch
		if (e.pointerType === 'mouse' && e.button !== 0) return;

		dragging = true;
		startX = e.clientX;
		startY = e.clientY;
		originX = x;
		originY = y;
		node.setPointerCapture(e.pointerId);
		node.classList.add('is-dragging');
		e.stopPropagation();
	}

	/** @param {PointerEvent} e */
	function onPointerMove(e) {
		if (!dragging) return;
		x = originX + (e.clientX - startX);
		y = originY + (e.clientY - startY);
		apply();
		params.onMove?.({ x, y });
	}

	/** @param {PointerEvent} e */
	function onPointerUp(e) {
		if (!dragging) return;
		dragging = false;
		try {
			node.releasePointerCapture(e.pointerId);
		} catch {
			/* already released */
		}
		node.classList.remove('is-dragging');
		params.onMove?.({ x, y });
	}

	apply();
	node.style.touchAction = 'none';
	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerUp);

	return {
		/**
		 * @param {{
		 *   x?: number;
		 *   y?: number;
		 *   enabled?: boolean;
		 *   onMove?: (pos: { x: number; y: number }) => void;
		 * }} next
		 */
		update(next) {
			params = next;
			enabled = next.enabled !== false;
			if (typeof next.x === 'number') x = next.x;
			if (typeof next.y === 'number') y = next.y;
			// Don't yank position mid-drag from parent sync
			if (!dragging) apply();
			else {
				// Keep visual in sync with internal x/y only
				apply();
			}
		},
		destroy() {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerUp);
		}
	};
}
