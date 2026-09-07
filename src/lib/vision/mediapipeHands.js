/**
 * Shared MediaPipe GestureRecognizer for Camera shutter + Frame Select air gestures.
 * One WASM heap — those views never overlap.
 */

const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const WASM_ROOT = `${APP_BASE}assets/vision`;
const MODEL_PATH = `${WASM_ROOT}/gesture_recognizer.task`;

/** @type {import('@mediapipe/tasks-vision').GestureRecognizer | null} */
let recognizer = null;
/** @type {Promise<import('@mediapipe/tasks-vision').GestureRecognizer | null> | null} */
let loadPromise = null;
let loadFailed = false;

/**
 * @returns {Promise<import('@mediapipe/tasks-vision').GestureRecognizer | null>}
 */
export async function ensureGestureRecognizer() {
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
				console.warn('[mediapipeHands] GPU delegate failed, trying CPU', gpuErr);
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
			console.warn('[mediapipeHands] failed to load', err);
			return null;
		}
	})();

	return loadPromise;
}

/** Close WASM (leave Camera / hard reset). */
export function disposeGestureRecognizer() {
	if (recognizer) {
		try {
			recognizer.close();
		} catch {
			/* ignore */
		}
		recognizer = null;
	}
	loadPromise = null;
	loadFailed = false;
}
