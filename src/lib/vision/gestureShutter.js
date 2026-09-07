/**
 * Light gesture shutter for Camera Temple.
 * MediaPipe GestureRecognizer ~15fps / 2 hands / GPU — pause when not armed; close on leave.
 * Current Camera-playlist pose (Victory / Open_Palm / Thumb_Up) filtered in JS, not classifier allowlist.
 */

import { disposeGestureRecognizer, ensureGestureRecognizer } from './mediapipeHands.js';

const INFER_INTERVAL_MS = 66;
const HOLD_MS = 700;
const MISS_RESET = 5;
const SCORE_MIN = 0.5;
const SCORE_EXIT = 0.28;
const GESTURE_KINDS = /** @type {const} */ (['Victory', 'Open_Palm', 'Thumb_Up']);

/** @typedef {{ minX: number; minY: number; maxX: number; maxY: number; matching: boolean }} HandOverlayBox */

/** @type {number} */
let rafId = 0;
/** @type {number} */
let lastInferAt = 0;
/** @type {number} */
let lastVideoTime = -1;
/** @type {number} */
let holdStartedAt = 0;
/** @type {number} */
let missCount = 0;
let poseLatched = false;
/** @type {(() => void) | null} */
let onVisibility = null;
let loopGen = 0;
/** @type {HandOverlayBox[]} */
let lastOverlay = [];

/**
 * Latest hand AABBs in raw-video normalized coords (unmirrored). Empty when shutter idle.
 * @returns {HandOverlayBox[]}
 */
export function getHandOverlay() {
	return lastOverlay;
}

function clearOverlay() {
	lastOverlay = [];
}

/**
 * @param {import('@mediapipe/tasks-vision').Category[] | undefined} categories
 * @param {string} gesture
 * @returns {number}
 */
function categoryScore(categories, gesture) {
	if (!categories?.length) return 0;
	let best = 0;
	for (const cat of categories) {
		if (cat?.categoryName === gesture) best = Math.max(best, cat.score ?? 0);
	}
	return best;
}

/**
 * @param {import('@mediapipe/tasks-vision').GestureRecognizerResult | null | undefined} result
 * @param {string} gesture
 * @returns {number}
 */
function bestGestureScore(result, gesture) {
	const hands = result?.gestures;
	if (!hands?.length) return 0;
	let best = 0;
	for (const categories of hands) {
		best = Math.max(best, categoryScore(categories, gesture));
	}
	return best;
}

/**
 * @param {import('@mediapipe/tasks-vision').Category[] | undefined} categories
 * @param {string} gesture
 * @returns {boolean}
 */
function categoriesMatch(categories, gesture) {
	return categoryScore(categories, gesture) >= (poseLatched ? SCORE_EXIT : SCORE_MIN);
}

/**
 * @param {import('@mediapipe/tasks-vision').NormalizedLandmark[] | undefined} pts
 * @returns {{ minX: number; minY: number; maxX: number; maxY: number } | null}
 */
function landmarksAabb(pts) {
	if (!pts?.length) return null;
	let minX = 1;
	let minY = 1;
	let maxX = 0;
	let maxY = 0;
	for (const p of pts) {
		const x = p.x ?? 0;
		const y = p.y ?? 0;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	return { minX, minY, maxX, maxY };
}

/**
 * @param {import('@mediapipe/tasks-vision').GestureRecognizerResult | null | undefined} result
 * @param {string} gesture
 */
function storeOverlay(result, gesture) {
	const landmarks = result?.landmarks;
	if (!landmarks?.length) return;
	/** @type {HandOverlayBox[]} */
	const boxes = [];
	for (let i = 0; i < landmarks.length; i++) {
		const aabb = landmarksAabb(landmarks[i]);
		if (!aabb) continue;
		boxes.push({
			...aabb,
			matching: categoriesMatch(result?.gestures?.[i], gesture) || poseLatched
		});
	}
	if (boxes.length) lastOverlay = boxes;
}

function resetHold() {
	holdStartedAt = 0;
	missCount = 0;
	poseLatched = false;
}

/** Cancel the infer loop; keep the loaded recognizer warm. */
export function stopGestureShutter() {
	loopGen += 1;
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = 0;
	}
	if (onVisibility) {
		document.removeEventListener('visibilitychange', onVisibility);
		onVisibility = null;
	}
	resetHold();
	lastInferAt = 0;
	lastVideoTime = -1;
	clearOverlay();
}

/** Stop loop and free WASM (leave Camera / toggle off). */
export function disposeGestureShutter() {
	stopGestureShutter();
	disposeGestureRecognizer();
}

/**
 * @param {{
 *   video: HTMLVideoElement;
 *   isArmed: () => boolean;
 *   onTrigger: () => void;
 *   gesture: string;
 * }} opts
 */
export async function startGestureShutter(opts) {
	stopGestureShutter();
	const gen = loopGen;
	const gesture = GESTURE_KINDS.includes(/** @type {*} */ (opts.gesture))
		? opts.gesture
		: 'Victory';

	const rec = await ensureGestureRecognizer();
	if (!rec || !opts.video || gen !== loopGen) return;

	lastInferAt = 0;
	lastVideoTime = -1;
	resetHold();
	clearOverlay();

	onVisibility = () => {
		if (document.hidden) {
			resetHold();
			clearOverlay();
		}
	};
	document.addEventListener('visibilitychange', onVisibility);

	const tick = () => {
		if (gen !== loopGen) return;
		rafId = requestAnimationFrame(tick);

		if (document.hidden) return;
		if (!opts.isArmed()) {
			resetHold();
			clearOverlay();
			return;
		}

		const video = opts.video;
		if (!video.videoWidth || video.readyState < 2) return;

		const now = performance.now();
		if (now - lastInferAt < INFER_INTERVAL_MS) return;
		if (video.currentTime === lastVideoTime) return;

		lastInferAt = now;
		lastVideoTime = video.currentTime;

		let result;
		try {
			result = rec.recognizeForVideo(video, now);
		} catch (err) {
			console.warn('[gestureShutter] recognize failed', err);
			resetHold();
			clearOverlay();
			return;
		}

		const hasHands = !!result?.landmarks?.length;
		const score = hasHands ? bestGestureScore(result, gesture) : 0;
		if (hasHands && score >= (poseLatched ? SCORE_EXIT : SCORE_MIN)) {
			poseLatched = true;
			missCount = 0;
		} else {
			missCount += 1;
			if (missCount >= MISS_RESET) poseLatched = false;
		}

		storeOverlay(result, gesture);

		if (poseLatched) {
			if (!holdStartedAt) holdStartedAt = now;
			if (now - holdStartedAt >= HOLD_MS) {
				resetHold();
				opts.onTrigger();
			}
		} else if (missCount >= MISS_RESET) {
			holdStartedAt = 0;
			if (!hasHands) clearOverlay();
		}
	};

	rafId = requestAnimationFrame(tick);
}
