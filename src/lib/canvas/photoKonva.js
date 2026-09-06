/**
 * Booth photo filters — CSS live preview + matching CSS capture bake,
 * plus cached analog overlays (grain, vignette, light leak).
 */

import { loadImageForCanvas as loadImage } from '../utils/loadImageForCanvas.js';

/** @typedef {'natural' | 'softGlow' | 'warmGolden' | 'coolMarble' | 'blackWhite' | 'highContrast' | 'sepiaVintage' | 'pastelDream' | 'dramatic' | 'olympusGold' | 'styxNoir' | 'matteFade' | 'neonBacchus' | 'tealOracle' | 'portraFilm' | 'goldLeak'} FilterPresetId */

/**
 * @typedef {{
 *   id: FilterPresetId;
 *   label: string;
 *   cssFilter: string;
 *   grain?: number;
 *   vignette?: number;
 *   leak?: 'none' | 'warm';
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
	},
	{
		id: 'styxNoir',
		label: 'STYX NOIR',
		cssFilter: 'grayscale(1) contrast(1.45) brightness(0.92)'
	},
	{
		id: 'matteFade',
		label: 'MATTE',
		cssFilter: 'brightness(1.08) contrast(0.78) saturate(0.72)'
	},
	{
		id: 'neonBacchus',
		label: 'NEON BACCHUS',
		cssFilter: 'brightness(1.06) contrast(1.12) saturate(1.65) hue-rotate(-18deg)'
	},
	{
		id: 'tealOracle',
		label: 'TEAL ORACLE',
		cssFilter: 'brightness(0.97) contrast(1.2) saturate(1.08) hue-rotate(22deg)'
	},
	{
		id: 'portraFilm',
		label: 'PORTRA FILM',
		cssFilter: 'brightness(1.04) contrast(0.94) saturate(1.12) sepia(0.22)',
		grain: 0.32,
		vignette: 0.5
	},
	{
		id: 'goldLeak',
		label: 'GOLD LEAK',
		cssFilter: 'brightness(1.07) contrast(1.08) saturate(1.2) sepia(0.16) hue-rotate(-10deg)',
		vignette: 0.18,
		leak: 'warm'
	}
];

const GRAIN_TILE = 256;

/** @type {HTMLCanvasElement | null} */
let grainTile = null;

/** @type {HTMLCanvasElement | null} */
let vignetteCanvas = null;
let vignetteW = 0;
let vignetteH = 0;

/** @type {HTMLCanvasElement | null} */
let leakCanvas = null;
let leakW = 0;
let leakH = 0;

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
 * @param {FilterPreset} spec
 * @returns {boolean}
 */
function hasAnalogOverlays(spec) {
	return (
		(spec.grain ?? 0) > 0 || (spec.vignette ?? 0) > 0 || (!!spec.leak && spec.leak !== 'none')
	);
}

/**
 * Apply the same CSS color grade used in live preview to a captured still.
 * @param {string} dataUrl
 * @param {FilterPresetId} [preset='natural']
 * @returns {Promise<string>}
 */
export async function applyPhotoFilter(dataUrl, preset = 'natural') {
	if (!dataUrl || preset === 'natural') return dataUrl;

	const spec = getPresetById(preset);
	const cssFilter = spec.cssFilter === 'none' ? '' : spec.cssFilter;
	if (!cssFilter && !hasAnalogOverlays(spec)) return dataUrl;

	const img = await loadImage(dataUrl);
	const w = img.naturalWidth || img.width;
	const h = img.naturalHeight || img.height;
	if (!w || !h) return dataUrl;

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return dataUrl;

	ctx.filter = cssFilter || 'none';
	ctx.drawImage(img, 0, 0, w, h);
	ctx.filter = 'none';
	applyAnalogOverlays(ctx, w, h, spec);

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
 * Blit source canvas to dest with CSS color grade + analog overlays.
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
	applyAnalogOverlays(destCtx, w, h, getPresetById(preset));
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

/** @returns {HTMLCanvasElement} */
function getGrainTile() {
	if (grainTile) return grainTile;
	grainTile = document.createElement('canvas');
	grainTile.width = GRAIN_TILE;
	grainTile.height = GRAIN_TILE;
	const ctx = grainTile.getContext('2d');
	if (!ctx) return grainTile;
	const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
	const d = img.data;
	for (let i = 0; i < d.length; i += 4) {
		const n = 90 + ((Math.random() * 75) | 0);
		d[i] = n;
		d[i + 1] = n;
		d[i + 2] = n;
		d[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return grainTile;
}

/**
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement}
 */
function getVignetteCanvas(w, h) {
	if (!vignetteCanvas) vignetteCanvas = document.createElement('canvas');
	if (vignetteW !== w || vignetteH !== h) {
		vignetteCanvas.width = w;
		vignetteCanvas.height = h;
		vignetteW = w;
		vignetteH = h;
		const ctx = vignetteCanvas.getContext('2d');
		if (ctx) {
			const r = Math.hypot(w, h) * 0.52;
			const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, r);
			g.addColorStop(0, 'rgba(0,0,0,0)');
			g.addColorStop(0.65, 'rgba(0,0,0,0.12)');
			g.addColorStop(1, 'rgba(12,4,2,1)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
		}
	}
	return vignetteCanvas;
}

/**
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement}
 */
function getLeakCanvas(w, h) {
	if (!leakCanvas) leakCanvas = document.createElement('canvas');
	if (leakW !== w || leakH !== h) {
		leakCanvas.width = w;
		leakCanvas.height = h;
		leakW = w;
		leakH = h;
		const ctx = leakCanvas.getContext('2d');
		if (ctx) {
			ctx.clearRect(0, 0, w, h);
			const g = ctx.createRadialGradient(w * 0.12, h * 0.1, 0, w * 0.12, h * 0.1, Math.max(w, h) * 0.55);
			g.addColorStop(0, 'rgba(255, 214, 120, 0.95)');
			g.addColorStop(0.35, 'rgba(232, 140, 48, 0.45)');
			g.addColorStop(1, 'rgba(232, 140, 48, 0)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
		}
	}
	return leakCanvas;
}

/**
 * Cached analog overlays. No per-pixel work on the live frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {FilterPreset} spec
 */
function applyAnalogOverlays(ctx, w, h, spec) {
	if (!hasAnalogOverlays(spec)) return;

	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.filter = 'none';

	const grain = spec.grain ?? 0;
	if (grain > 0) {
		const tile = getGrainTile();
		const pattern = ctx.createPattern(tile, 'repeat');
		if (pattern) {
			ctx.globalCompositeOperation = 'overlay';
			ctx.globalAlpha = grain;
			ctx.fillStyle = pattern;
			ctx.fillRect(0, 0, w, h);
		}
	}

	const vignette = spec.vignette ?? 0;
	if (vignette > 0) {
		ctx.globalCompositeOperation = 'multiply';
		ctx.globalAlpha = vignette;
		ctx.drawImage(getVignetteCanvas(w, h), 0, 0);
	}

	if (spec.leak === 'warm') {
		ctx.globalCompositeOperation = 'screen';
		ctx.globalAlpha = 0.42;
		ctx.drawImage(getLeakCanvas(w, h), 0, 0);
	}

	ctx.restore();
}
