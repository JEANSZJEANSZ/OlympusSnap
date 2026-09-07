/**
 * Frame Select air gestures — palm-centroid swipe + downward tug.
 * Uses shared GestureRecognizer landmarks (no canned swipe label).
 */

import { ensureGestureRecognizer } from './mediapipeHands.js';

const INFER_INTERVAL_MS = 66;
const WRIST = 0;
const MIDDLE_MCP = 9;
const SWIPE_MIN = 0.18;
const AXIS_RATIO = 1.5;
const TUG_MIN = 0.08;
const CHARGE_H = 0.06;
const CHARGE_V = 0.04;
const COOLDOWN_MS = 480;
const MISS_RESET = 4;

/** @typedef {{ minX: number; minY: number; maxX: number; maxY: number; matching: boolean }} HandOverlayBox */
/** @typedef {{ left: boolean; right: boolean; down: boolean }} AirCharge */

const IDLE_CHARGE = /** @type {const} */ ({ left: false, right: false, down: false });

/** @type {HandOverlayBox[]} */
let lastOverlay = [];
/** @type {AirCharge} */
let lastCharge = { ...IDLE_CHARGE };

let rafId = 0;
let lastInferAt = 0;
let lastVideoTime = -1;
let loopGen = 0;
/** @type {(() => void) | null} */
let onVisibility = null;
/** @type {((c: AirCharge) => void) | undefined} */
let chargeCb;

/** @type {number | null} */
let originX = null;
/** @type {number | null} */
let originY = null;
let tugging = false;
let missCount = 0;
let cooldownUntil = 0;

/**
 * @returns {HandOverlayBox[]}
 */
export function getFrameAirOverlay() {
	return lastOverlay;
}

/**
 * @returns {AirCharge}
 */
export function getAirCharge() {
	return lastCharge;
}

/** @param {AirCharge} next */
function setCharge(next) {
	lastCharge = next;
	chargeCb?.(next);
}

function clearVisuals() {
	lastOverlay = [];
	setCharge({ ...IDLE_CHARGE });
}

function resetStroke() {
	originX = null;
	originY = null;
	tugging = false;
	missCount = 0;
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
 * Mirrored palm centroid (guest-right = +x).
 * @param {import('@mediapipe/tasks-vision').NormalizedLandmark[] | undefined} pts
 * @returns {{ x: number; y: number } | null}
 */
function palmCentroid(pts) {
	if (!pts?.length) return null;
	const a = pts[WRIST];
	const b = pts[MIDDLE_MCP] ?? pts[WRIST];
	if (!a) return null;
	const x = ((a.x ?? 0) + (b.x ?? 0)) / 2;
	const y = ((a.y ?? 0) + (b.y ?? 0)) / 2;
	return { x: 1 - x, y };
}

/**
 * Prefer the larger (closer) hand.
 * @param {import('@mediapipe/tasks-vision').GestureRecognizerResult | null | undefined} result
 * @returns {{ palm: { x: number; y: number }; aabb: { minX: number; minY: number; maxX: number; maxY: number } } | null}
 */
function pickHand(result) {
	const landmarks = result?.landmarks;
	if (!landmarks?.length) return null;
	let best = null;
	let bestArea = -1;
	for (const pts of landmarks) {
		const aabb = landmarksAabb(pts);
		const palm = palmCentroid(pts);
		if (!aabb || !palm) continue;
		const area = Math.max(0, aabb.maxX - aabb.minX) * Math.max(0, aabb.maxY - aabb.minY);
		if (area > bestArea) {
			bestArea = area;
			best = { palm, aabb };
		}
	}
	return best;
}

export function stopFrameAirGestures() {
	loopGen += 1;
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = 0;
	}
	if (onVisibility) {
		document.removeEventListener('visibilitychange', onVisibility);
		onVisibility = null;
	}
	chargeCb = undefined;
	lastInferAt = 0;
	lastVideoTime = -1;
	resetStroke();
	clearVisuals();
}

/**
 * @param {{
 *   video: HTMLVideoElement;
 *   isArmed: () => boolean;
 *   tugEnabled?: boolean;
 *   onSwipe: (dir: -1 | 1) => void;
 *   onTugStart: (palm: { x: number; y: number }) => boolean | void;
 *   onTugMove: (palm: { x: number; y: number }) => void;
 *   onTugEnd: () => void;
 *   onCharge?: (charge: AirCharge) => void;
 * }} opts
 */
export async function startFrameAirGestures(opts) {
	stopFrameAirGestures();
	const gen = loopGen;
	const tugEnabled = opts.tugEnabled !== false;
	chargeCb = opts.onCharge;

	const rec = await ensureGestureRecognizer();
	if (!rec || !opts.video || gen !== loopGen) return;

	onVisibility = () => {
		if (document.hidden) {
			if (tugging) opts.onTugEnd();
			resetStroke();
			clearVisuals();
		}
	};
	document.addEventListener('visibilitychange', onVisibility);

	const tick = () => {
		if (gen !== loopGen) return;
		rafId = requestAnimationFrame(tick);

		if (document.hidden) return;
		if (!opts.isArmed()) {
			if (tugging) opts.onTugEnd();
			resetStroke();
			clearVisuals();
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
			console.warn('[frameAirGestures] recognize failed', err);
			if (tugging) opts.onTugEnd();
			resetStroke();
			clearVisuals();
			return;
		}

		const hand = pickHand(result);
		if (!hand) {
			missCount += 1;
			if (missCount >= MISS_RESET) {
				if (tugging) opts.onTugEnd();
				resetStroke();
				clearVisuals();
			}
			return;
		}

		missCount = 0;
		const { palm, aabb } = hand;

		if (tugging) {
			setCharge({ left: false, right: false, down: true });
			lastOverlay = [{ ...aabb, matching: true }];
			opts.onTugMove(palm);
			if (originY != null && palm.y < originY - 0.04) {
				opts.onTugEnd();
				tugging = false;
				originX = palm.x;
				originY = palm.y;
				setCharge({ ...IDLE_CHARGE });
			}
			return;
		}

		if (originX == null || originY == null) {
			originX = palm.x;
			originY = palm.y;
			setCharge({ ...IDLE_CHARGE });
			lastOverlay = [{ ...aabb, matching: false }];
			return;
		}

		const dx = palm.x - originX;
		const dy = palm.y - originY;
		const adx = Math.abs(dx);
		const ady = Math.abs(dy);
		const cooling = now < cooldownUntil;

		const charge = {
			left: !cooling && dx < -CHARGE_H && adx > ady * AXIS_RATIO,
			right: !cooling && dx > CHARGE_H && adx > ady * AXIS_RATIO,
			down: !cooling && tugEnabled && dy > CHARGE_V && ady > adx * AXIS_RATIO
		};
		setCharge(charge);
		lastOverlay = [{ ...aabb, matching: charge.left || charge.right || charge.down }];

		if (cooling) return;

		if (adx >= SWIPE_MIN && adx > ady * AXIS_RATIO) {
			const dir = /** @type {-1 | 1} */ (dx > 0 ? 1 : -1);
			cooldownUntil = now + COOLDOWN_MS;
			originX = palm.x;
			originY = palm.y;
			setCharge({ ...IDLE_CHARGE });
			opts.onSwipe(dir);
			return;
		}

		if (tugEnabled && dy >= TUG_MIN && ady > adx * AXIS_RATIO) {
			const started = opts.onTugStart(palm);
			if (started === false) {
				originX = palm.x;
				originY = palm.y;
				return;
			}
			tugging = true;
			setCharge({ left: false, right: false, down: true });
			opts.onTugMove(palm);
		}
	};

	rafId = requestAnimationFrame(tick);
}
