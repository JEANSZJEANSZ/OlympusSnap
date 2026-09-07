/**
 * Frame Select air gestures — Camera-style canned poses.
 * Open_Palm + dx past threshold → swipe. Closed_Fist → grab and drag the rope.
 */

import { ensureGestureRecognizer } from './mediapipeHands.js';

const INFER_INTERVAL_MS = 33;
const SCORE_MIN = 0.5;
const WRIST = 0;
const MIDDLE_MCP = 9;
const SWIPE_MIN = 0.14;
const COOLDOWN_MS = 280;
const MISS_RESET = 5;

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
	palmOriginX = null;
	palmOriginY = null;
	tugging = false;
	missCount = 0;
}

/**
 * @param {import('@mediapipe/tasks-vision').Category[] | undefined} categories
 * @param {string} name
 * @returns {boolean}
 */
function categoriesMatch(categories, name) {
	if (!categories?.length) return false;
	for (const cat of categories) {
		if (cat?.categoryName === name && (cat.score ?? 0) >= SCORE_MIN) return true;
	}
	return false;
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
 * Largest hand + whether it is Open_Palm / Closed_Fist.
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
	return {
		...best,
		openPalm: categoriesMatch(cats, 'Open_Palm'),
		closedFist: categoriesMatch(cats, 'Closed_Fist')
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
			if (missCount >= MISS_RESET) {
				if (tugging) opts.onTugEnd();
				resetStroke();
				clearVisuals();
			}
			return;
		}

		missCount = 0;
		const { palm, aabb, openPalm, closedFist } = hand;
		lastOverlay = [{ ...aabb, matching: openPalm || closedFist }];

		if (tugging) {
			if (!closedFist) {
				opts.onTugEnd();
				tugging = false;
				palmOriginX = null;
				palmOriginY = null;
				setCharge({ ...IDLE_CHARGE });
				return;
			}
			setCharge({ left: false, right: false, down: true });
			opts.onTugMove(palm);
			return;
		}

		if (tugEnabled && closedFist) {
			const started = opts.onTugStart(palm);
			if (started === false) return;
			tugging = true;
			palmOriginX = null;
			palmOriginY = null;
			setCharge({ left: false, right: false, down: true });
			opts.onTugMove(palm);
			return;
		}

		if (!openPalm) {
			palmOriginX = null;
			palmOriginY = null;
			setCharge({ ...IDLE_CHARGE });
			return;
		}

		if (palmOriginX == null || palmOriginY == null) {
			palmOriginX = palm.x;
			palmOriginY = palm.y;
			setCharge({ ...IDLE_CHARGE });
			return;
		}

		const dx = palm.x - palmOriginX;
		const dy = palm.y - palmOriginY;
		const adx = Math.abs(dx);
		const ady = Math.abs(dy);
		const cooling = now < cooldownUntil;

		setCharge({
			left: !cooling && dx < -0.05 && adx > ady,
			right: !cooling && dx > 0.05 && adx > ady,
			down: false
		});

		if (cooling) return;

		if (adx >= SWIPE_MIN && adx > ady) {
			const dir = /** @type {-1 | 1} */ (dx > 0 ? 1 : -1);
			cooldownUntil = now + COOLDOWN_MS;
			palmOriginX = palm.x;
			palmOriginY = palm.y;
			setCharge({ ...IDLE_CHARGE });
			opts.onSwipe(dir);
		}
	};

	rafId = requestAnimationFrame(tick);
}
