/**
 * Capture-time soft beauty via MediaPipe Face Landmarker (not live preview).
 */
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL =
	'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Booth default — applied automatically on every snap. */
export const BOOTH_SOFT_BEAUTY = { smooth: 0.35, brighten: 0.08 };

/** @type {FaceLandmarker | null} */
let landmarker = null;
/** @type {Promise<FaceLandmarker | null> | null} */
let initPromise = null;
/** @type {Promise<void> | null} */
let captureMutex = null;
/** @type {boolean} */
let beautySkipLogged = false;

/** @type {HTMLCanvasElement | null} */
let maskCanvas = null;
/** @type {HTMLCanvasElement | null} */
let smoothCanvas = null;
/** @type {HTMLCanvasElement | null} */
let compCanvas = null;

/**
 * @returns {Promise<boolean>}
 */
export async function initFaceBeauty() {
	if (landmarker) return true;
	if (initPromise) return (await initPromise) !== null;

	initPromise = (async () => {
		try {
			const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
			landmarker = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath: MODEL_URL,
					delegate: 'GPU'
				},
				runningMode: 'IMAGE',
				numFaces: 1,
				outputFaceBlendshapes: false,
				outputFacialTransformationMatrixes: false
			});
			return landmarker;
		} catch {
			try {
				const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
				landmarker = await FaceLandmarker.createFromOptions(vision, {
					baseOptions: { modelAssetPath: MODEL_URL },
					runningMode: 'IMAGE',
					numFaces: 1
				});
				return landmarker;
			} catch {
				landmarker = null;
				return null;
			}
		}
	})();

	const result = await initPromise;
	return result !== null;
}

export function isFaceBeautyReady() {
	return landmarker !== null;
}

/**
 * @param {import('@mediapipe/tasks-vision').NormalizedLandmark[]} landmarks
 * @param {number} w
 * @param {number} h
 * @returns {Path2D}
 */
function faceOvalPath(landmarks, w, h) {
	const path = new Path2D();
	const conns = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL;
	if (!conns?.length) return path;

	const start = landmarks[conns[0].start];
	if (!start) return path;
	path.moveTo(start.x * w, start.y * h);

	for (const conn of conns) {
		const pt = landmarks[conn.end];
		if (pt) path.lineTo(pt.x * w, pt.y * h);
	}
	path.closePath();
	return path;
}

/**
 * @param {number} w
 * @param {number} h
 */
function ensureWorkBuffers(w, h) {
	if (!maskCanvas) maskCanvas = document.createElement('canvas');
	if (!smoothCanvas) smoothCanvas = document.createElement('canvas');
	if (!compCanvas) compCanvas = document.createElement('canvas');
	for (const c of [maskCanvas, smoothCanvas, compCanvas]) {
		if (c.width !== w || c.height !== h) {
			c.width = w;
			c.height = h;
		}
	}
}

/**
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {CanvasRenderingContext2D} targetCtx
 * @param {import('@mediapipe/tasks-vision').NormalizedLandmark[]} landmarks
 * @param {{ smooth: number; brighten: number }} opts
 */
function applyFeatheredBeauty(sourceCanvas, targetCtx, landmarks, opts) {
	const w = sourceCanvas.width;
	const h = sourceCanvas.height;
	if (!w || !h || !maskCanvas || !smoothCanvas || !compCanvas) return;

	const blurPx = Math.max(2, Math.round(3 + opts.smooth * 10));
	const blendAlpha = 0.42 + opts.smooth * 0.28;
	const featherPx = Math.max(8, Math.round(blurPx * 1.3));
	const path = faceOvalPath(landmarks, w, h);

	const sctx = smoothCanvas.getContext('2d');
	const mctx = maskCanvas.getContext('2d');
	const cctx = compCanvas.getContext('2d');
	if (!sctx || !mctx || !cctx) return;

	sctx.setTransform(1, 0, 0, 1, 0, 0);
	sctx.clearRect(0, 0, w, h);
	sctx.filter = `blur(${blurPx}px) brightness(${1 + opts.brighten * 0.85})`;
	sctx.drawImage(sourceCanvas, 0, 0);
	sctx.filter = 'none';

	mctx.setTransform(1, 0, 0, 1, 0, 0);
	mctx.clearRect(0, 0, w, h);
	mctx.shadowColor = '#ffffff';
	mctx.shadowBlur = featherPx;
	mctx.fillStyle = '#ffffff';
	mctx.fill(path);
	mctx.shadowBlur = 0;

	cctx.setTransform(1, 0, 0, 1, 0, 0);
	cctx.clearRect(0, 0, w, h);
	cctx.drawImage(smoothCanvas, 0, 0);
	cctx.globalCompositeOperation = 'destination-in';
	cctx.drawImage(maskCanvas, 0, 0);
	cctx.globalCompositeOperation = 'source-over';

	targetCtx.save();
	targetCtx.setTransform(1, 0, 0, 1, 0, 0);
	targetCtx.globalAlpha = blendAlpha;
	targetCtx.drawImage(compCanvas, 0, 0);
	targetCtx.restore();
}

/**
 * Always-on soft booth beauty on a captured still.
 * @param {string} dataUrl
 * @returns {Promise<string>}
 */
export async function applySoftBeautyToCapture(dataUrl) {
	if (!dataUrl) return dataUrl;

	if (!landmarker) {
		if (!beautySkipLogged) {
			console.warn('[OlympusSnap] Soft beauty skipped — MediaPipe unavailable');
			beautySkipLogged = true;
		}
		return dataUrl;
	}

	while (captureMutex) {
		await captureMutex;
	}

	let release = /** @type {() => void} */ (() => {});
	captureMutex = new Promise((r) => {
		release = r;
	});

	try {
		const img = await loadImage(dataUrl);
		const w = img.naturalWidth || img.width;
		const h = img.naturalHeight || img.height;
		if (!w || !h) return dataUrl;

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return dataUrl;

		ctx.drawImage(img, 0, 0, w, h);
		ensureWorkBuffers(w, h);

		let result;
		try {
			result = landmarker.detect(canvas);
		} catch {
			return dataUrl;
		}

		const landmarks = result.faceLandmarks?.[0];
		if (!landmarks) return dataUrl;

		applyFeatheredBeauty(canvas, ctx, landmarks, BOOTH_SOFT_BEAUTY);
		return canvas.toDataURL('image/png');
	} finally {
		release();
		captureMutex = null;
	}
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Beauty image load failed'));
		img.src = src;
	});
}

export function disposeFaceBeauty() {
	landmarker?.close?.();
	landmarker = null;
	initPromise = null;
	captureMutex = null;
	beautySkipLogged = false;
	maskCanvas = null;
	smoothCanvas = null;
	compCanvas = null;
}
