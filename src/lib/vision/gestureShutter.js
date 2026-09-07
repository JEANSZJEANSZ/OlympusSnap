/**
 * Light Victory-gesture shutter for Camera Temple.
 * MediaPipe GestureRecognizer ~8fps / 1 hand / GPU — pause when not armed; close on leave.
 */

const INFER_INTERVAL_MS = 125;
const HOLD_MS = 700;
const MISS_RESET = 2;
const SCORE_MIN = 0.75;
const GESTURE = 'Victory';

const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const WASM_ROOT = `${APP_BASE}assets/vision`;
const MODEL_PATH = `${WASM_ROOT}/gesture_recognizer.task`;

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
				numHands: 1,
				cannedGesturesClassifierOptions: {
					categoryAllowlist: [GESTURE],
					scoreThreshold: SCORE_MIN
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
 * @param {import('@mediapipe/tasks-vision').GestureRecognizerResult | null | undefined} result
 * @returns {boolean}
 */
function isVictory(result) {
	const hands = result?.gestures;
	if (!hands?.length) return false;
	for (const categories of hands) {
		const top = categories?.[0];
		if (!top) continue;
		if (top.categoryName === GESTURE && (top.score ?? 0) >= SCORE_MIN) return true;
	}
	return false;
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
 * }} opts
 */
export async function startGestureShutter(opts) {
	stopGestureShutter();
	const gen = loopGen;

	const rec = await ensureRecognizer();
	if (!rec || !opts.video || gen !== loopGen) return;

	lastInferAt = 0;
	lastVideoTime = -1;
	resetHold();

	onVisibility = () => {
		if (document.hidden) resetHold();
	};
	document.addEventListener('visibilitychange', onVisibility);

	const tick = () => {
		if (gen !== loopGen) return;
		rafId = requestAnimationFrame(tick);

		if (document.hidden) return;
		if (!opts.isArmed()) {
			resetHold();
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
			return;
		}

		if (isVictory(result)) {
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
