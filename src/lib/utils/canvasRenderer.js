/**
 * Canvas compositing for final export.
 *
 * Pipeline:
 * 1. Hidden canvas matching capture size
 * 2. Draw webcam capture (already mirrored at capture time)
 * 3. Draw frame PNG overlay (full size)
 * 4. Draw activeStickers with translate → rotate → scale
 * 5. Return canvas.toDataURL()
 */

import { getLiveFrameById } from '../assets/assetStore.js';

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load ${src}`));
		img.src = src;
	});
}

/**
 * Draw a sticker with Canva-style transform.
 * Sticker x/y are top-left in studio canvas space; scale is relative to a 64px base.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {{ x: number; y: number; scale: number; rotation: number }} sticker
 * @param {number} studioW width of the studio preview used for sticker coords
 * @param {number} studioH
 * @param {number} canvasW
 * @param {number} canvasH
 */
function drawSticker(ctx, img, sticker, studioW, studioH, canvasW, canvasH) {
	const BASE = 64;
	const sx = canvasW / studioW;
	const sy = canvasH / studioH;
	const scaleX = sticker.scale * sx;
	const scaleY = sticker.scale * sy;
	const w = BASE * scaleX;
	const h = BASE * scaleY;
	const x = sticker.x * sx;
	const y = sticker.y * sy;
	const cx = x + w / 2;
	const cy = y + h / 2;
	const rad = (sticker.rotation * Math.PI) / 180;

	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(rad);
	ctx.drawImage(img, -w / 2, -h / 2, w, h);
	ctx.restore();
}

/**
 * @param {string} imageData
 * @param {string | null} frameId
 * @param {Array<{ id: string; src: string; x: number; y: number; scale: number; rotation?: number }>} stickers
 * @param {{ studioWidth?: number; studioHeight?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function compositeFinalImage(imageData, frameId, stickers, opts = {}) {
	if (!imageData) return '';

	const studioW = opts.studioWidth ?? 560;
	const studioH = opts.studioHeight ?? 420;

	const canvas = document.createElement('canvas');
	const photo = await loadImage(imageData).catch(() => null);
	if (!photo) return imageData;

	canvas.width = photo.naturalWidth || photo.width;
	canvas.height = photo.naturalHeight || photo.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return imageData;

	ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

	const frame = getLiveFrameById(frameId);
	if (frame?.src) {
		try {
			const frameImg = await loadImage(frame.src);
			ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
		} catch {
			/* missing frame asset — skip */
		}
	}

	for (const sticker of stickers) {
		if (!sticker.src) continue;
		try {
			const img = await loadImage(sticker.src);
			drawSticker(
				ctx,
				img,
				{
					x: sticker.x,
					y: sticker.y,
					scale: sticker.scale,
					rotation: sticker.rotation ?? 0
				},
				studioW,
				studioH,
				canvas.width,
				canvas.height
			);
		} catch {
			/* skip broken sticker */
		}
	}

	return canvas.toDataURL('image/png');
}
