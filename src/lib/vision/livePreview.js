/**
 * Live camera preview — mirror + CSS color grade + analog overlays.
 */
import {
	drawMirroredVideo,
	blitWithCssFilter,
	applyPhotoFilter
} from '../canvas/photoKonva.js';
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

const GOLD_MATCH = '#ffe08a';
const GOLD_TRACK = 'rgba(255, 217, 120, 0.72)';

/**
 * Draw mirrored AABB frames. Boxes use raw-video normalized coords (unmirrored).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ minX: number; minY: number; maxX: number; maxY: number; matching?: boolean }>} boxes
 */
function drawHandFrames(ctx, boxes) {
	const w = ctx.canvas.width;
	const h = ctx.canvas.height;
	if (!w || !h || !boxes?.length) return;

	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	for (const box of boxes) {
		const x1 = (1 - box.maxX) * w;
		const x2 = (1 - box.minX) * w;
		const y1 = box.minY * h;
		const y2 = box.maxY * h;
		let x = Math.min(x1, x2);
		let y = Math.min(y1, y2);
		let bw = Math.abs(x2 - x1);
		let bh = Math.abs(y2 - y1);
		const padX = Math.max(8, bw * 0.08);
		const padY = Math.max(8, bh * 0.08);
		x = Math.max(1, x - padX);
		y = Math.max(1, y - padY);
		bw = Math.min(w - x - 1, bw + padX * 2);
		bh = Math.min(h - y - 1, bh + padY * 2);
		if (bw < 4 || bh < 4) continue;

		const matching = !!box.matching;
		ctx.strokeStyle = matching ? GOLD_MATCH : GOLD_TRACK;
		ctx.lineWidth = matching ? 3 : 2;
		ctx.strokeRect(x, y, bw, bh);

		const tick = Math.max(6, Math.min(18, Math.min(bw, bh) * 0.22));
		ctx.beginPath();
		ctx.moveTo(x, y + tick);
		ctx.lineTo(x, y);
		ctx.lineTo(x + tick, y);
		ctx.moveTo(x + bw - tick, y);
		ctx.lineTo(x + bw, y);
		ctx.lineTo(x + bw, y + tick);
		ctx.moveTo(x + bw, y + bh - tick);
		ctx.lineTo(x + bw, y + bh);
		ctx.lineTo(x + bw - tick, y + bh);
		ctx.moveTo(x + tick, y + bh);
		ctx.lineTo(x, y + bh);
		ctx.lineTo(x, y + bh - tick);
		ctx.stroke();
	}

	ctx.restore();
}

/**
 * @param {{
 *   video: HTMLVideoElement;
 *   canvas: HTMLCanvasElement;
 *   getPreset: () => import('../canvas/photoKonva.js').FilterPresetId;
 *   getHandOverlay?: () => Array<{ minX: number; minY: number; maxX: number; maxY: number; matching?: boolean }> | null | undefined;
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

		const boxes = opts.getHandOverlay?.();
		if (boxes?.length) drawHandFrames(displayCtx, boxes);

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
 * Capture pipeline: raw still → color grade + analog overlays.
 * @param {HTMLVideoElement} videoEl
 * @param {import('../canvas/photoKonva.js').FilterPresetId} presetId
 * @returns {Promise<string | null>}
 */
export async function processCaptureFrame(videoEl, presetId) {
	if (!videoEl.videoWidth) return null;

	stopLivePreview();

	const raw = captureFrame(videoEl);
	if (!raw) return null;

	return applyPhotoFilter(raw, presetId);
}
