/**
 * Light gesture shutter for Camera Temple.
 * MediaPipe GestureRecognizer ~15fps / 2 hands / GPU — pause when not armed; close on leave.
 * Admin pick (Victory / Open_Palm / Thumb_Up) filtered in JS, not classifier allowlist.
 */

const INFER_INTERVAL_MS = 66;
const HOLD_MS = 700;
const MISS_RESET = 5;
const SCORE_MIN = 0.5;
const GESTURE_KINDS = /** @type {const} */ (['Victory', 'Open_Palm', 'Thumb_Up']);

const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const WASM_ROOT = `${APP_BASE}assets/vision`;
const MODEL_PATH = `${WASM_ROOT}/gesture_recognizer.task`;

/** @typedef {{ minX: number; minY: number; maxX: number; maxY: number; matching: boolean }} HandOverlayBox */

/** @type {import('@mediapipe/tasks-vision').GestureRecognizer | null} */
let recognizer = null;
/** @type {Promise<import('@mediapipe/tasks-vision').GestureRecognizer | null> | null} */
let loadPromise = null;
let loadFailed = false;
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
 * @returns {Promise<GestureRecognizer | null>}
 */
async function ensureRecognizer() {
	if (recognizer) return recognizer;
	if (loadFailed) return null;
	if (loadPromise) return loadPromise;

	loadPromise = (async () => {
		try {
			const { FilesetResolver, GestureRecognizer } = await import('@mediapipe/tasks-vision');
			const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
			const opts = {
				baseOptions: {
					modelAssetPath: MODEL_PATH,
					delegate: /** @type {'GPU'} */ ('GPU')
				},
				runningMode: /** @type {'VIDEO'} */ ('VIDEO'),
				numHands: 2,
				minHandDetectionConfidence: 0.4,
				minHandPresenceConfidence: 0.4,
				minTrackingConfidence: 0.4,
				cannedGesturesClassifierOptions: {
					scoreThreshold: 0.3
				}
			};
			try {
				recognizer = await GestureRecognizer.createFromOptions(vision, opts);
			} catch (gpuErr) {
				console.warn('[gestureShutter] GPU delegate failed, trying CPU', gpuErr);
				recognizer = await GestureRecognizer.createFromOptions(vision, {
					...opts,
					baseOptions: {
						modelAssetPath: MODEL_PATH,
						delegate: /** @type {'CPU'} */ ('CPU')
					}
				});
			}
			return recognizer;
		} catch (err) {
			loadFailed = true;
			loadPromise = null;
			console.warn('[gestureShutter] failed to load — SNAP button only', err);
			return null;
		}
	})();

	return loadPromise;
}

/**
 * @param {import('@mediapipe/tasks-vision').Category[] | undefined} categories
 * @param {string} gesture
 * @returns {boolean}
 */
function categoriesMatch(categories, gesture) {
	if (!categories?.length) return false;
	for (const cat of categories) {
		if (cat?.categoryName === gesture && (cat.score ?? 0) >= SCORE_MIN) return true;
	}
	return false;
}

/**
 * @param {import('@mediapipe/tasks-vision').GestureRecognizerResult | null | undefined} result
 * @param {string} gesture
 * @returns {boolean}
 */
function isTriggerGesture(result, gesture) {
	const hands = result?.gestures;
	if (!hands?.length) return false;
	for (const categories of hands) {
		if (categoriesMatch(categories, gesture)) return true;
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
 * @param {import('@mediapipe/tasks-vision').GestureRecognizerResult | null | undefined} result
 * @param {string} gesture
 */
function storeOverlay(result, gesture) {
	const landmarks = result?.landmarks;
	if (!landmarks?.length) {
		clearOverlay();
		return;
	}
	/** @type {HandOverlayBox[]} */
	const boxes = [];
	for (let i = 0; i < landmarks.length; i++) {
		const aabb = landmarksAabb(landmarks[i]);
		if (!aabb) continue;
		boxes.push({
			...aabb,
			matching: categoriesMatch(result?.gestures?.[i], gesture)
		});
	}
	lastOverlay = boxes;
}

function resetHold() {
	holdStartedAt = 0;
	missCount = 0;
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
	if (recognizer) {
		try {
			recognizer.close();
		} catch {
			/* ignore */
		}
		recognizer = null;
	}
	loadPromise = null;
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

	const rec = await ensureRecognizer();
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

		storeOverlay(result, gesture);

		if (isTriggerGesture(result, gesture)) {
			missCount = 0;
			if (!holdStartedAt) holdStartedAt = now;
			if (now - holdStartedAt >= HOLD_MS) {
				resetHold();
				opts.onTrigger();
			}
		} else {
			missCount += 1;
			if (missCount >= MISS_RESET) resetHold();
		}
	};

	rafId = requestAnimationFrame(tick);
}
