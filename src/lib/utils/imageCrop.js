/**
 * Measure and crop frame images (normalized 0–1 rects).
 */

const MIN_PX = 32;

/**
 * @typedef {{ x: number; y: number; w: number; h: number }} NormRect
 */

/**
 * @param {string} src
 * @returns {Promise<{ w: number; h: number }>}
 */
export function measureImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const w = img.naturalWidth || img.width;
			const h = img.naturalHeight || img.height;
			if (!w || !h) {
				reject(new Error('Could not read image dimensions'));
				return;
			}
			resolve({ w, h });
		};
		img.onerror = () => reject(new Error('Image load failed'));
		img.src = src;
	});
}

/**
 * @param {NormRect} rect
 * @param {number} imgW
 * @param {number} imgH
 */
function clampRectToPixels(rect, imgW, imgH) {
	let x = Math.min(1, Math.max(0, rect.x));
	let y = Math.min(1, Math.max(0, rect.y));
	let w = Math.min(1, Math.max(0, rect.w));
	let h = Math.min(1, Math.max(0, rect.h));
	x = Math.min(x, 1 - 1 / imgW);
	y = Math.min(y, 1 - 1 / imgH);
	w = Math.max(w, MIN_PX / imgW);
	h = Math.max(h, MIN_PX / imgH);
	if (x + w > 1) w = 1 - x;
	if (y + h > 1) h = 1 - y;

	const sx = Math.round(x * imgW);
	const sy = Math.round(y * imgH);
	const sw = Math.max(MIN_PX, Math.round(w * imgW));
	const sh = Math.max(MIN_PX, Math.round(h * imgH));
	const clampedW = Math.min(sw, imgW - sx);
	const clampedH = Math.min(sh, imgH - sy);
	return { sx, sy, sw: clampedW, sh: clampedH };
}

/**
 * @param {string} src
 * @param {NormRect} rect normalized crop region
 * @returns {Promise<{ src: string; w: number; h: number }>}
 */
export function cropImageToDataUrl(src, rect) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const imgW = img.naturalWidth || img.width;
			const imgH = img.naturalHeight || img.height;
			if (!imgW || !imgH) {
				reject(new Error('Could not read image dimensions'));
				return;
			}
			const { sx, sy, sw, sh } = clampRectToPixels(rect, imgW, imgH);
			const canvas = document.createElement('canvas');
			canvas.width = sw;
			canvas.height = sh;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas unavailable'));
				return;
			}
			ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
			resolve({ src: canvas.toDataURL('image/png'), w: sw, h: sh });
		};
		img.onerror = () => reject(new Error('Image load failed'));
		img.src = src;
	});
}
