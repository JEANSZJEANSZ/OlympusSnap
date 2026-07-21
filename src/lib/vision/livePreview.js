/**
 * Live camera preview — mirror + CSS color grade only (no live MediaPipe).
 */
import {
	drawMirroredVideo,
	blitWithCssFilter,
	applyPhotoFilter
} from '../canvas/photoKonva.js';
import { applySoftBeautyToCapture } from './faceBeauty.js';
import { captureFrame } from '../utils/camera.js';

/** @type {number | null} */
let rafId = null;
/** @type {HTMLCanvasElement | null} */
let cleanCanvas = null;
/** @type {number} */
let cleanW = 0;
/** @type {number} */
let cleanH = 0;

/**
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement}
 */
function getCleanCanvas(w, h) {
	if (!cleanCanvas) cleanCanvas = document.createElement('canvas');
	if (cleanW !== w || cleanH !== h) {
		cleanCanvas.width = w;
		cleanCanvas.height = h;
		cleanW = w;
		cleanH = h;
	}
	return cleanCanvas;
}

/**
 * @param {{
 *   video: HTMLVideoElement;
 *   canvas: HTMLCanvasElement;
 *   getPreset: () => import('../canvas/photoKonva.js').FilterPresetId;
 * }} opts
 */
export function startLivePreview(opts) {
	stopLivePreview();

	const tick = () => {
		if (!opts.video.videoWidth) {
			rafId = requestAnimationFrame(tick);
			return;
		}

		const preset = opts.getPreset();
		const displayCtx = opts.canvas.getContext('2d');
		if (!displayCtx) {
			rafId = requestAnimationFrame(tick);
			return;
		}

		const w = opts.video.videoWidth;
		const h = opts.video.videoHeight;
		const clean = getCleanCanvas(w, h);
		const cleanCtx = clean.getContext('2d');
		if (!cleanCtx) {
			rafId = requestAnimationFrame(tick);
			return;
		}

		drawMirroredVideo(cleanCtx, opts.video);
		blitWithCssFilter(displayCtx, clean, preset);

		rafId = requestAnimationFrame(tick);
	};

	rafId = requestAnimationFrame(tick);
}

export function stopLivePreview() {
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
}

/**
 * Capture pipeline: raw → always-on soft beauty → color grade.
 * @param {HTMLVideoElement} videoEl
 * @param {import('../canvas/photoKonva.js').FilterPresetId} presetId
 * @returns {Promise<string | null>}
 */
export async function processCaptureFrame(videoEl, presetId) {
	if (!videoEl.videoWidth) return null;

	stopLivePreview();

	let raw = captureFrame(videoEl);
	if (!raw) return null;

	raw = await applySoftBeautyToCapture(raw);
	return applyPhotoFilter(raw, presetId);
}
