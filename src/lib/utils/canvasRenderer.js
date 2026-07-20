/**
 * Canvas compositing for final export.
 *
 * Slotted frames:
 * 1. Canvas = frame natural size
 * 2. Cover-fit each photo into its normalized slot rect
 * 3. Draw frame art on top
 * 4. Stickers
 *
 * Legacy (no slots):
 * 1. Full-bleed photo
 * 2. Frame stretch overlay
 * 3. Stickers
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
 * Cover-fit `img` into destination rect (clip).
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} img
 * @param {number} dx
 * @param {number} dy
 * @param {number} dw
 * @param {number} dh
 * @param {number} iw
 * @param {number} ih
 */
export function drawCoverFit(ctx, img, dx, dy, dw, dh, iw, ih) {
	if (iw <= 0 || ih <= 0 || dw <= 0 || dh <= 0) return;
	const scale = Math.max(dw / iw, dh / ih);
	const sw = dw / scale;
	const sh = dh / scale;
	const sx = (iw - sw) / 2;
	const sy = (ih - sh) / 2;
	ctx.save();
	ctx.beginPath();
	ctx.rect(dx, dy, dw, dh);
	ctx.clip();
	ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
	ctx.restore();
}

/**
 * Draw a sticker with Canva-style transform.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {{ x: number; y: number; scale: number; rotation: number }} sticker
 * @param {number} studioW
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
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {Array<{ id: string; src: string; x: number; y: number; scale: number; rotation?: number }>} stickers
 * @param {number} studioW
 * @param {number} studioH
 */
async function drawStickers(ctx, canvasW, canvasH, stickers, studioW, studioH) {
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
				canvasW,
				canvasH
			);
		} catch {
			/* skip broken sticker */
		}
	}
}

/**
 * @param {string[]} photos data URLs in slot order
 * @param {string | null} frameId
 * @param {Array<{ id: string; src: string; x: number; y: number; scale: number; rotation?: number }>} stickers
 * @param {{ studioWidth?: number; studioHeight?: number; skipStickers?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function compositeFramePhotos(photos, frameId, stickers, opts = {}) {
	const studioW = opts.studioWidth ?? 560;
	const studioH = opts.studioHeight ?? 420;
	const frame = getLiveFrameById(frameId);
	const slots = frame?.slots?.length ? frame.slots : null;

	if (!slots) {
		const first = photos[0] || '';
		if (!first) return '';
		return compositeFinalImage(first, frameId, opts.skipStickers ? [] : stickers, opts);
	}

	if (!frame?.src) return photos[0] || '';

	let frameImg;
	try {
		frameImg = await loadImage(frame.src);
	} catch {
		return photos[0] || '';
	}

	const canvas = document.createElement('canvas');
	canvas.width = frameImg.naturalWidth || frameImg.width || 600;
	canvas.height = frameImg.naturalHeight || frameImg.height || 800;
	const ctx = canvas.getContext('2d');
	if (!ctx) return photos[0] || '';

	ctx.fillStyle = '#111';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	for (let i = 0; i < slots.length; i++) {
		const slot = slots[i];
		const src = photos[i];
		if (!src) continue;
		const photo = await loadImage(src).catch(() => null);
		if (!photo) continue;
		const dx = slot.x * canvas.width;
		const dy = slot.y * canvas.height;
		const dw = slot.w * canvas.width;
		const dh = slot.h * canvas.height;
		const iw = photo.naturalWidth || photo.width;
		const ih = photo.naturalHeight || photo.height;
		drawCoverFit(ctx, photo, dx, dy, dw, dh, iw, ih);
	}

	ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

	if (!opts.skipStickers) {
		await drawStickers(ctx, canvas.width, canvas.height, stickers, studioW, studioH);
	}

	return canvas.toDataURL('image/png');
}

/**
 * Legacy single-photo composite (also used when frame has no slots).
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
	const frame = getLiveFrameById(frameId);

	if (frame?.slots?.length) {
		return compositeFramePhotos([imageData], frameId, stickers, opts);
	}

	const canvas = document.createElement('canvas');
	const photo = await loadImage(imageData).catch(() => null);
	if (!photo) return imageData;

	canvas.width = photo.naturalWidth || photo.width;
	canvas.height = photo.naturalHeight || photo.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return imageData;

	ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

	if (frame?.src) {
		try {
			const frameImg = await loadImage(frame.src);
			ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
		} catch {
			/* missing frame asset — skip */
		}
	}

	await drawStickers(ctx, canvas.width, canvas.height, stickers, studioW, studioH);

	return canvas.toDataURL('image/png');
}
