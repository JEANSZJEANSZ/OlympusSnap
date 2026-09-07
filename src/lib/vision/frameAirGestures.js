/**
 * Frame Select air gestures — Camera-style canned poses.
 * Open_Palm + dx/velocity past threshold → swipe. Closed_Fist → grab and drag the rope.
 * Pose hysteresis + landmark fist keep a still hand locked through classifier flicker.
 */

import { ensureGestureRecognizer } from './mediapipeHands.js';

const INFER_INTERVAL_MS = 33;
const PALM_ENTER = 0.5;
const PALM_EXIT = 0.28;
const FIST_ENTER = 0.5;
const FIST_EXIT = 0.28;
const AABB_EMA = 0.35;
const WRIST = 0;
const MIDDLE_MCP = 9;
const SWIPE_MIN = 0.1;
const SWIPE_VEL_DX = 0.06;
const SWIPE_VEL = 1.2;
const AXIS_DY = 0.9;
const COOLDOWN_MS = 280;
const CENTER_LO = 0.38;
const CENTER_HI = 0.62;
const FIST_HOLD_MS = 280;
const MISS_RESET = 5;
const TUG_MISS_RESET = 10;
const PALM_GRACE = 7;
const FIST_GRACE = 8;

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
let palmOriginX = null;
/** @type {number | null} */
let palmOriginY = null;
/** @type {number | null} */
let prevPalmX = null;
let palmLabelMiss = 0;
let tugging = false;
let missCount = 0;
let fistLabelMiss = 0;
let cooldownUntil = 0;
let palmLatched = false;
let fistLatched = false;
let needRecenter = false;
let fistHoldStartedAt = 0;
/** @type {{ minX: number; minY: number; maxX: number; maxY: number } | null} */
let smoothBox = null;

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
	smoothBox = null;
	palmLatched = false;
	fistLatched = false;
	setCharge({ ...IDLE_CHARGE });
}

function resetStroke() {
	palmOriginX = null;
	palmOriginY = null;
	prevPalmX = null;
	palmLabelMiss = 0;
	tugging = false;
	missCount = 0;
	fistLabelMiss = 0;
	palmLatched = false;
	fistLatched = false;
	fistHoldStartedAt = 0;
}

/**
 * @param {import('@mediapipe/tasks-vision').Category[] | undefined} categories
 * @param {string} name
 * @returns {number}
 */
function categoryScore(categories, name) {
	if (!categories?.length) return 0;
	let best = 0;
	for (const cat of categories) {
		if (cat?.categoryName === name) best = Math.max(best, cat.score ?? 0);
	}
	return best;
}

/**
 * @param {boolean} wasOn
 * @param {number} score
 * @param {number} enter
 * @param {number} exit
 */
function latchPose(wasOn, score, enter, exit) {
	if (wasOn) {
		if (score <= 0) return true;
		return score >= exit;
	}
	return score >= enter;
}

/**
 * @param {{ x?: number; y?: number } | undefined} a
 * @param {{ x?: number; y?: number } | undefined} b
 */
function dist2d(a, b) {
	if (!a || !b) return 0;
	return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
}

/**
 * Curled fingers (index–pinky) when the canned Closed_Fist label flickers.
 * @param {import('@mediapipe/tasks-vision').NormalizedLandmark[] | undefined} pts
 */
function isLandmarkFist(pts) {
	if (!pts || pts.length < 21) return false;
	const wrist = pts[WRIST];
	const tips = [8, 12, 16, 20];
	const pips = [6, 10, 14, 18];
	let curled = 0;
	for (let i = 0; i < 4; i++) {
		const tip = pts[tips[i]];
		const pip = pts[pips[i]];
		if (!tip || !pip || !wrist) continue;
		if (dist2d(tip, wrist) < dist2d(pip, wrist) * 1.2) curled += 1;
	}
	return curled >= 3;
}

/**
 * @param {{ minX: number; minY: number; maxX: number; maxY: number }} next
 */
function smoothAabb(next) {
	if (!smoothBox) {
		smoothBox = { ...next };
		return smoothBox;
	}
	const a = AABB_EMA;
	const b = 1 - a;
	smoothBox = {
		minX: next.minX * a + smoothBox.minX * b,
		minY: next.minY * a + smoothBox.minY * b,
		maxX: next.maxX * a + smoothBox.maxX * b,
		maxY: next.maxY * a + smoothBox.maxY * b
	};
	return smoothBox;
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
 * Largest hand plus Open_Palm / Closed_Fist classifier scores.
 * @param {import('@mediapipe/tasks-vision').GestureRecognizerResult | null | undefined} result
 */
function pickHand(result) {
	const landmarks = result?.landmarks;
	if (!landmarks?.length) return null;
	let best = null;
	let bestArea = -1;
	let bestIndex = 0;
	for (let i = 0; i < landmarks.length; i++) {
		const pts = landmarks[i];
		const aabb = landmarksAabb(pts);
		const palm = palmCentroid(pts);
		if (!aabb || !palm) continue;
		const area = Math.max(0, aabb.maxX - aabb.minX) * Math.max(0, aabb.maxY - aabb.minY);
		if (area > bestArea) {
			bestArea = area;
			bestIndex = i;
			best = { palm, aabb };
		}
	}
	if (!best) return null;
	const cats = result?.gestures?.[bestIndex];
	const pts = landmarks[bestIndex];
	return {
		...best,
		pts,
		palmScore: categoryScore(cats, 'Open_Palm'),
		fistScore: categoryScore(cats, 'Closed_Fist')
	};
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
	needRecenter = false;
	resetStroke();
	clearVisuals();
}

/** @param {number} x mirrored guest-space 0–1 */
function inCenterBand(x) {
	return x >= CENTER_LO && x <= CENTER_HI;
}

/**
 * @param {number} dx
 * @param {number} dy
 * @param {number} vx
 * @returns {boolean}
 */
function isSwipe(dx, dy, vx) {
	const adx = Math.abs(dx);
	const ady = Math.abs(dy);
	if (adx <= ady * AXIS_DY) return false;
	if (adx >= SWIPE_MIN) return true;
	return adx >= SWIPE_VEL_DX && Math.abs(vx) >= SWIPE_VEL;
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
		const dtSec = Math.max(0.016, (now - lastInferAt) / 1000);
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
			const missLimit = tugging ? TUG_MISS_RESET : MISS_RESET;
			if (missCount >= missLimit) {
				if (tugging) opts.onTugEnd();
				resetStroke();
				clearVisuals();
			}
			return;
		}

		missCount = 0;
		const landmarkFist = isLandmarkFist(hand.pts);
		let nextFist = landmarkFist || latchPose(fistLatched, hand.fistScore, FIST_ENTER, FIST_EXIT);
		let nextPalm = latchPose(palmLatched, hand.palmScore, PALM_ENTER, PALM_EXIT);
		if (landmarkFist) nextPalm = false;
		else if (nextPalm && hand.palmScore >= PALM_ENTER) nextFist = false;
		fistLatched = nextFist;
		palmLatched = nextPalm;
		const openPalm = palmLatched;
		const closedFist = fistLatched;
		const aabb = smoothAabb(hand.aabb);
		const { palm } = hand;
		lastOverlay = [{ ...aabb, matching: openPalm || closedFist || palmOriginX != null }];

		if (tugging) {
			if (!closedFist) {
				fistLabelMiss += 1;
				if (fistLabelMiss >= FIST_GRACE) {
					opts.onTugEnd();
					tugging = false;
					fistHoldStartedAt = 0;
					fistLabelMiss = 0;
					palmOriginX = null;
					palmOriginY = null;
					prevPalmX = null;
					palmLabelMiss = 0;
					setCharge({ ...IDLE_CHARGE });
					return;
				}
			} else {
				fistLabelMiss = 0;
			}
			setCharge({ left: false, right: false, down: true });
			opts.onTugMove(palm);
			return;
		}

		if (tugEnabled && closedFist) {
			if (!fistHoldStartedAt) fistHoldStartedAt = now;
			setCharge({ left: false, right: false, down: true });
			if (now - fistHoldStartedAt < FIST_HOLD_MS) return;
			const started = opts.onTugStart(palm);
			if (started === false) {
				fistHoldStartedAt = 0;
				return;
			}
			tugging = true;
			fistHoldStartedAt = 0;
			fistLabelMiss = 0;
			palmOriginX = null;
			palmOriginY = null;
			prevPalmX = null;
			palmLabelMiss = 0;
			opts.onTugMove(palm);
			return;
		}
		fistHoldStartedAt = 0;

		const inStroke = palmOriginX != null && palmOriginY != null;
		if (!openPalm) {
			if (!inStroke) {
				setCharge({ ...IDLE_CHARGE });
				prevPalmX = palm.x;
				return;
			}
			palmLabelMiss += 1;
			if (palmLabelMiss >= PALM_GRACE) {
				palmOriginX = null;
				palmOriginY = null;
				prevPalmX = null;
				palmLabelMiss = 0;
				setCharge({ ...IDLE_CHARGE });
				return;
			}
		} else {
			palmLabelMiss = 0;
		}

		if (needRecenter) {
			if (inCenterBand(palm.x)) needRecenter = false;
			else {
				palmOriginX = null;
				palmOriginY = null;
				prevPalmX = palm.x;
				setCharge({ ...IDLE_CHARGE });
				return;
			}
		}

		if (palmOriginX == null || palmOriginY == null) {
			if (!inCenterBand(palm.x)) {
				prevPalmX = palm.x;
				setCharge({ ...IDLE_CHARGE });
				return;
			}
			palmOriginX = palm.x;
			palmOriginY = palm.y;
			prevPalmX = palm.x;
			setCharge({ ...IDLE_CHARGE });
			return;
		}

		const dx = palm.x - palmOriginX;
		const dy = palm.y - palmOriginY;
		const adx = Math.abs(dx);
		const ady = Math.abs(dy);
		const vx = prevPalmX == null ? 0 : (palm.x - prevPalmX) / dtSec;
		prevPalmX = palm.x;
		const cooling = now < cooldownUntil;

		setCharge({
			left: !cooling && dx < -0.04 && adx > ady * AXIS_DY,
			right: !cooling && dx > 0.04 && adx > ady * AXIS_DY,
			down: false
		});

		if (cooling) return;

		if (isSwipe(dx, dy, vx)) {
			const dir = /** @type {-1 | 1} */ (dx > 0 ? 1 : -1);
			cooldownUntil = now + COOLDOWN_MS;
			needRecenter = true;
			palmOriginX = null;
			palmOriginY = null;
			prevPalmX = palm.x;
			palmLabelMiss = 0;
			setCharge({ ...IDLE_CHARGE });
			opts.onSwipe(dir);
		}
	};

	rafId = requestAnimationFrame(tick);
}
