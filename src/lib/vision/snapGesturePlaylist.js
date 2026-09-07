/**
 * Per-canvas Camera shutter poses.
 * Canonical cycle matches GESTURE_SNAP_KINDS: Victory → Open_Palm → Thumb_Up.
 */

/** @typedef {'Victory' | 'Open_Palm' | 'Thumb_Up'} SnapGestureKind */

export const SNAP_GESTURE_CYCLE = /** @type {const} */ ([
	'Victory',
	'Open_Palm',
	'Thumb_Up'
]);

/**
 * Fisher–Yates shuffle (copy).
 * @template T
 * @param {readonly T[]} list
 * @param {() => number} rand
 * @returns {T[]}
 */
function shuffle(list, rand) {
	const out = list.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		const tmp = out[i];
		out[i] = out[j];
		out[j] = tmp;
	}
	return out;
}

/**
 * Build the hold-to-snap pose list for a Camera visit.
 * 1 canvas → one random pose; 2 → random unique pair; 3+ → cycle the trio.
 *
 * @param {number} canvasCount
 * @param {() => number} [rand]
 * @returns {SnapGestureKind[]}
 */
export function buildSnapGesturePlaylist(canvasCount, rand = Math.random) {
	const n = Math.max(1, Math.floor(Number(canvasCount) || 1));
	const cycle = /** @type {SnapGestureKind[]} */ ([...SNAP_GESTURE_CYCLE]);

	if (n === 1) {
		const i = Math.min(cycle.length - 1, Math.floor(rand() * cycle.length));
		return [cycle[i]];
	}

	if (n === 2) {
		return shuffle(cycle, rand).slice(0, 2);
	}

	/** @type {SnapGestureKind[]} */
	const out = [];
	for (let i = 0; i < n; i++) {
		out.push(cycle[i % cycle.length]);
	}
	return out;
}
