/**
 * Booth photo filters — CSS live preview + matching CSS capture bake.
 */

/** @typedef {'natural' | 'softGlow' | 'warmGolden' | 'coolMarble' | 'blackWhite' | 'highContrast' | 'sepiaVintage' | 'pastelDream' | 'dramatic' | 'olympusGold'} FilterPresetId */

/**
 * @typedef {{
 *   id: FilterPresetId;
 *   label: string;
 *   cssFilter: string;
 * }} FilterPreset
 */

/** @type {FilterPreset[]} */
export const FILTER_PRESETS = [
	{ id: 'natural', label: 'NATURAL', cssFilter: 'none' },
	{
		id: 'softGlow',
		label: 'SOFT GLOW',
		cssFilter: 'brightness(1.08) contrast(0.92) saturate(1.05)'
	},
	{
		id: 'warmGolden',
		label: 'WARM GOLD',
		cssFilter: 'brightness(1.05) contrast(1.05) saturate(1.18) sepia(0.12)'
	},
	{
		id: 'coolMarble',
		label: 'COOL MARBLE',
		cssFilter: 'brightness(1.04) contrast(1.02) saturate(0.82) hue-rotate(12deg)'
	},
	{
		id: 'blackWhite',
		label: 'B&W',
		cssFilter: 'grayscale(1) contrast(1.18) brightness(1.02)'
	},
	{
		id: 'highContrast',
		label: 'HIGH CONTRAST',
		cssFilter: 'contrast(1.35) brightness(0.96) saturate(1.08)'
	},
	{
		id: 'sepiaVintage',
		label: 'SEPIA',
		cssFilter: 'sepia(0.55) contrast(0.95) brightness(0.94) saturate(0.85)'
	},
	{
		id: 'pastelDream',
		label: 'PASTEL',
		cssFilter: 'brightness(1.12) contrast(0.88) saturate(0.92)'
	},
	{
		id: 'dramatic',
		label: 'DRAMATIC',
		cssFilter: 'brightness(0.88) contrast(1.32) saturate(0.95)'
	},
	{
		id: 'olympusGold',
		label: 'OLYMPUS GOLD',
		cssFilter: 'brightness(1.06) contrast(1.1) saturate(1.22) sepia(0.18) hue-rotate(-8deg)'
	}
];

/** @param {FilterPresetId} id */
export function getPresetById(id) {
	return FILTER_PRESETS.find((p) => p.id === id) ?? FILTER_PRESETS[0];
}

/** @param {FilterPresetId} id */
export function getCssFilter(id) {
	const f = getPresetById(id).cssFilter;
	return f === 'none' ? '' : f;
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Filter image load failed'));
		img.src = src;
	});
}

/**
 * Apply the same CSS color grade used in live preview to a captured still.
 * @param {string} dataUrl
 * @param {FilterPresetId} [preset='natural']
 * @returns {Promise<string>}
 */
export async function applyPhotoFilter(dataUrl, preset = 'natural') {
	if (!dataUrl || preset === 'natural') return dataUrl;

	const cssFilter = getCssFilter(preset);
	if (!cssFilter) return dataUrl;

	const img = await loadImage(dataUrl);
	const w = img.naturalWidth || img.width;
	const h = img.naturalHeight || img.height;
	if (!w || !h) return dataUrl;

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return dataUrl;

	ctx.filter = cssFilter;
	ctx.drawImage(img, 0, 0, w, h);
	ctx.filter = 'none';

	return canvas.toDataURL('image/png');
}

/**
 * Resize canvas only when video dimensions change.
 * @param {HTMLCanvasElement} canvas
 * @param {number} w
 * @param {number} h
 */
function ensureCanvasSize(canvas, w, h) {
	if (canvas.width !== w || canvas.height !== h) {
		canvas.width = w;
		canvas.height = h;
	}
}

/**
 * Draw mirrored video to canvas — no CSS filter (clean input for face tracking).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} video
 */
export function drawMirroredVideo(ctx, video) {
	const w = video.videoWidth;
	const h = video.videoHeight;
	if (!w || !h) return;

	ensureCanvasSize(ctx.canvas, w, h);
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, w, h);
	ctx.translate(w, 0);
	ctx.scale(-1, 1);
	ctx.filter = 'none';
	ctx.drawImage(video, 0, 0, w, h);
	ctx.restore();
}

/**
 * Blit source canvas to dest with CSS color grade.
 * @param {CanvasRenderingContext2D} destCtx
 * @param {CanvasImageSource} source
 * @param {FilterPresetId} preset
 */
export function blitWithCssFilter(destCtx, source, preset) {
	const w = /** @type {HTMLCanvasElement} */ (source).width ?? destCtx.canvas.width;
	const h = /** @type {HTMLCanvasElement} */ (source).height ?? destCtx.canvas.height;
	if (!w || !h) return;

	ensureCanvasSize(destCtx.canvas, w, h);
	destCtx.save();
	destCtx.setTransform(1, 0, 0, 1, 0, 0);
	destCtx.clearRect(0, 0, w, h);
	destCtx.filter = getCssFilter(preset) || 'none';
	destCtx.drawImage(source, 0, 0, w, h);
	destCtx.filter = 'none';
	destCtx.restore();
}

/**
 * Draw a mirrored video frame with CSS filter onto canvas (legacy single-pass).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} video
 * @param {FilterPresetId} preset
 */
export function drawFilteredVideoFrame(ctx, video, preset) {
	const w = video.videoWidth;
	const h = video.videoHeight;
	if (!w || !h) return;

	const clean = document.createElement('canvas');
	clean.width = w;
	clean.height = h;
	const cleanCtx = clean.getContext('2d');
	if (!cleanCtx) return;

	drawMirroredVideo(cleanCtx, video);
	blitWithCssFilter(ctx, clean, preset);
}
