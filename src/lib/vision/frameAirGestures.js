/**
 * Frame Select air gestures — palm-centroid swipe + hold-then-pull tug.
 * Uses shared GestureRecognizer landmarks (no canned swipe label).
 */

import { ensureGestureRecognizer } from './mediapipeHands.js';

const INFER_INTERVAL_MS = 33;
const WRIST = 0;
const MIDDLE_MCP = 9;
const EMA = 0.65;
const STILL_MAX = 0.028;
const HOLD_MS = 200;
const SWIPE_MIN = 0.16;
const SWIPE_FLICK = 0.01;
const AXIS_RATIO = 1.35;
const RELEASE_LIFT = 0.05;
const CHARGE_H = 0.05;
const COOLDOWN_MS = 380;
const MISS_IDLE = 5;
const MISS_TUG = 10;

/** @typedef {{ minX: number; minY: number; maxX: number; maxY: number; matching: boolean }} HandOverlayBox */
/** @typedef {{ left: boolean; right: boolean; down: boolean }} AirCharge */

const IDLE_CHARGE = /** @type {const} */ ({ left: false, right: false, down: false });

/** @type {HandOverlayBox[]} */
let lastOverlay = [];
/** @type {AirCharge} */
let lastCharge = { ...IDLE_CHARGE };

let rafId = 0;
let lastInferAt = 0;
let loopGen = 0;
/** @type {(() => void) | null} */
let onVisibility = null;
/** @type {((c: AirCharge) => void) | undefined} */
let chargeCb;

/** @type {number | null} */
let originX = null;
/** @type {number | null} */
let originY = null;
/** @type {number | null} */
let smX = null;
/** @type {number | null} */
let smY = null;
/** @type {number | null} */
let prevX = null;
let holdStartedAt = 0;
let holding = false;
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
	smX = null;
	smY = null;
	prevX = null;
	holdStartedAt = 0;
	holding = false;
	tugging = false;
	missCount = 0;
}

/**
 * @param {number} raw
 * @param {number | null} prev
 * @returns {number}
 */
function ema(raw, prev) {
	if (prev == null) return raw;
	return prev + (raw - prev) * EMA;
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
		lastInferAt = now;

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
			const missMax = tugging || holding ? MISS_TUG : MISS_IDLE;
			if (missCount >= missMax) {
				if (tugging) opts.onTugEnd();
				resetStroke();
				clearVisuals();
			}
			return;
		}

		missCount = 0;
		const raw = hand.palm;
		smX = ema(raw.x, smX);
		smY = ema(raw.y, smY);
		const palm = { x: smX, y: smY };
		const aabb = hand.aabb;
		const flickX = prevX == null ? 0 : palm.x - prevX;
		prevX = palm.x;

		if (tugging) {
			setCharge({ left: false, right: false, down: true });
			lastOverlay = [{ ...aabb, matching: true }];
			opts.onTugMove(palm);
			if (originY != null && palm.y < originY - RELEASE_LIFT) {
				opts.onTugEnd();
				tugging = false;
				holding = false;
				holdStartedAt = 0;
				originX = palm.x;
				originY = palm.y;
				setCharge({ ...IDLE_CHARGE });
			}
			return;
		}

		if (originX == null || originY == null) {
			originX = palm.x;
			originY = palm.y;
			holdStartedAt = now;
			holding = false;
			setCharge({ ...IDLE_CHARGE });
			lastOverlay = [{ ...aabb, matching: false }];
			return;
		}

		const dx = palm.x - originX;
		const dy = palm.y - originY;
		const adx = Math.abs(dx);
		const ady = Math.abs(dy);
		const still = adx < STILL_MAX && ady < STILL_MAX;
		const cooling = now < cooldownUntil;

		if (still) {
			if (!holdStartedAt) holdStartedAt = now;
			if (tugEnabled && now - holdStartedAt >= HOLD_MS) holding = true;
		} else if (!holding) {
			holdStartedAt = 0;
		}

		const charge = {
			left: !cooling && !holding && dx < -CHARGE_H && adx > ady * AXIS_RATIO,
			right: !cooling && !holding && dx > CHARGE_H && adx > ady * AXIS_RATIO,
			down: holding
		};
		setCharge(charge);
		lastOverlay = [{ ...aabb, matching: holding || charge.left || charge.right }];

		if (cooling) return;

		if (
			!holding &&
			adx >= SWIPE_MIN &&
			adx > ady * AXIS_RATIO &&
			Math.abs(flickX) >= SWIPE_FLICK
		) {
			const dir = /** @type {-1 | 1} */ (dx > 0 ? 1 : -1);
			cooldownUntil = now + COOLDOWN_MS;
			originX = palm.x;
			originY = palm.y;
			holdStartedAt = 0;
			setCharge({ ...IDLE_CHARGE });
			opts.onSwipe(dir);
			return;
		}

		if (tugEnabled && holding) {
			const started = opts.onTugStart(palm);
			if (started === false) {
				originX = palm.x;
				originY = palm.y;
				holding = false;
				holdStartedAt = 0;
				return;
			}
			tugging = true;
			originY = palm.y;
			setCharge({ left: false, right: false, down: true });
			opts.onTugMove(palm);
		}
	};

	rafId = requestAnimationFrame(tick);
}
