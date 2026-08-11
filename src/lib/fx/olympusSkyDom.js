/**
 * Hybrid Olympus sky — smooth CSS sky wash + pixel canvas mountains/clouds/celestials.
 * Day clock unchanged; temple/hero stay in olympusTemple.js.
 */
import { Color } from 'three';
import { DRIFT_HALF, createDayClock, sampleKey, wrapDrift } from './dayCycle.js';
import { observeCoverFit, applyCoverFitCanvas } from './pixelShared.js';

/** Canvas layer matches hero framing; CSS backdrop is full-bleed */
const PX_W = 480;
const PX_H = 270;

const SKY_CSS = `
.olympus-sky {
	position: absolute;
	inset: 0;
	overflow: hidden;
	z-index: 0;
	pointer-events: none;
	background: #071936;
}
.olympus-sky .sky-css-wash {
	position: absolute;
	inset: 0;
	z-index: 0;
	will-change: background;
}
.olympus-sky .sky-canvas {
	position: absolute;
	left: 50%;
	bottom: 0;
	top: auto;
	image-rendering: pixelated;
	image-rendering: crisp-edges;
}
.olympus-sky .sky-terrain {
	z-index: 1;
}
.olympus-sky .sky-celestial {
	z-index: 2;
}
.olympus-sky .sky-clouds {
	z-index: 3;
}
`;

const BAYER8 = [
	[0, 32, 8, 40, 2, 34, 10, 42],
	[48, 16, 56, 24, 50, 18, 58, 26],
	[12, 44, 4, 36, 14, 46, 6, 38],
	[60, 28, 52, 20, 62, 30, 54, 22],
	[3, 35, 11, 43, 1, 33, 9, 41],
	[51, 19, 59, 27, 49, 17, 57, 25],
	[15, 47, 7, 39, 13, 45, 5, 37],
	[63, 31, 55, 23, 61, 29, 53, 21]
];

const MTN_LOOP = {
	far: [
		{ t: 0.0, c: '#2e4258' },
		{ t: 0.22, c: '#5a7a94' },
		{ t: 0.5, c: '#7a9cb4' },
		{ t: 0.78, c: '#4a6680' },
		{ t: 1.0, c: '#2e4258' }
	],
	mid: [
		{ t: 0.0, c: '#283848' },
		{ t: 0.24, c: '#4a6a84' },
		{ t: 0.5, c: '#6a92ae' },
		{ t: 0.76, c: '#3a5a74' },
		{ t: 1.0, c: '#283848' }
	],
	near: [
		{ t: 0.0, c: '#1e3040' },
		{ t: 0.26, c: '#3a5a74' },
		{ t: 0.5, c: '#5a84a0' },
		{ t: 0.74, c: '#2e4860' },
		{ t: 1.0, c: '#1e3040' }
	],
	snow: [
		{ t: 0.0, c: '#5a7088' },
		{ t: 0.35, c: '#b8d0e0' },
		{ t: 0.55, c: '#d8e8f0' },
		{ t: 0.8, c: '#7a94a8' },
		{ t: 1.0, c: '#5a7088' }
	],
	treeline: [
		{ t: 0.0, c: '#1a2830' },
		{ t: 0.4, c: '#2a4850' },
		{ t: 0.55, c: '#3a6068' },
		{ t: 0.85, c: '#243840' },
		{ t: 1.0, c: '#1a2830' }
	]
};

const CLOUD_LOOP = [
	{ t: 0.0, c: '#6a7a90' },
	{ t: 0.22, c: '#d0c0b0' },
	{ t: 0.4, c: '#e8f0f8' },
	{ t: 0.55, c: '#f4f8fc' },
	{ t: 0.72, c: '#e0c8b0' },
	{ t: 0.88, c: '#7a8a9c' },
	{ t: 1.0, c: '#6a7a90' }
];

const CLOUD_SHAPES = [
	[
		{ dx: -14, dy: 2, r: 8 },
		{ dx: -4, dy: -2, r: 10 },
		{ dx: 6, dy: 0, r: 9 },
		{ dx: 14, dy: 2, r: 6 },
		{ dx: 0, dy: -6, r: 6 }
	],
	[
		{ dx: -18, dy: 1, r: 9 },
		{ dx: -8, dy: -2, r: 11 },
		{ dx: 4, dy: -1, r: 10 },
		{ dx: 15, dy: 2, r: 8 },
		{ dx: -2, dy: -7, r: 7 }
	],
	[
		{ dx: -10, dy: 2, r: 7 },
		{ dx: 0, dy: -3, r: 10 },
		{ dx: 10, dy: 0, r: 8 },
		{ dx: -2, dy: -8, r: 6 }
	],
	[
		{ dx: -11, dy: 0, r: 7 },
		{ dx: 0, dy: -2, r: 9 },
		{ dx: 10, dy: 1, r: 6 },
		{ dx: -2, dy: -6, r: 5 }
	],
	[
		{ dx: -20, dy: 2, r: 8 },
		{ dx: -10, dy: -2, r: 11 },
		{ dx: 2, dy: -3, r: 11 },
		{ dx: 14, dy: -1, r: 9 },
		{ dx: 22, dy: 2, r: 6 },
		{ dx: -2, dy: -8, r: 7 }
	]
];

const _cA = new Color();
const _cB = new Color();
const _cO = new Color();

function packRgb(r, g, b, a = 255) {
	return (a << 24) | (b << 16) | (g << 8) | r;
}

/**
 * @param {string} css
 * @returns {number}
 */
function cssToPacked(css) {
	_cA.set(css);
	const r = Math.round(Math.round(_cA.r * 48) / 48 * 255);
	const g = Math.round(Math.round(_cA.g * 48) / 48 * 255);
	const b = Math.round(Math.round(_cA.b * 48) / 48 * 255);
	return packRgb(r, g, b, 255);
}

/**
 * @param {number} pa
 * @param {number} pb
 * @param {number} t
 */
function mixPacked(pa, pb, t) {
	const u = t < 0 ? 0 : t > 1 ? 1 : t;
	const ar = pa & 255;
	const ag = (pa >> 8) & 255;
	const ab = (pa >> 16) & 255;
	const br = pb & 255;
	const bg = (pb >> 8) & 255;
	const bb = (pb >> 16) & 255;
	return packRgb(
		(ar + (br - ar) * u + 0.5) | 0,
		(ag + (bg - ag) * u + 0.5) | 0,
		(ab + (bb - ab) * u + 0.5) | 0,
		255
	);
}

/**
 * @param {string} a
 * @param {string} b
 * @param {number} t
 */
function mixCss(a, b, t) {
	_cA.set(a);
	_cB.set(b);
	_cO.copy(_cA).lerp(_cB, Math.min(1, Math.max(0, t)));
	return `#${_cO.getHexString()}`;
}

function celestialToPx(xy) {
	return {
		x: PX_W * 0.5 + (xy.x / 2.85) * (PX_W * 0.46),
		y: PX_H * 0.7 - xy.y * (PX_H * 0.5)
	};
}

function driftToPx(driftX) {
	return PX_W * 0.5 + (driftX / DRIFT_HALF) * (PX_W * 0.72);
}

/**
 * @param {number} seed
 * @param {number} base
 * @param {number} peak
 */
function buildRidge(seed, base, peak) {
	/** @type {number[]} */
	const h = new Array(PX_W);
	for (let x = 0; x < PX_W; x++) {
		const u = x / PX_W;
		const n1 = Math.sin(seed * 4.1 + u * Math.PI * 6.2) * 0.5 + 0.5;
		const n2 = Math.sin(seed * 9.7 + u * Math.PI * 14.5) * 0.5 + 0.5;
		const n3 = Math.sin(seed * 2.3 + u * Math.PI * 3.1) * 0.5 + 0.5;
		const mid = Math.max(0, 1 - Math.abs(u - 0.52) * 2.1);
		const massif = mid * mid * (peak - base) * 0.75;
		h[x] = (base + (n1 * 0.55 + n2 * 0.28 + n3 * 0.17) * (peak - base) + massif + 0.5) | 0;
	}
	for (let pass = 0; pass < 2; pass++) {
		const copy = h.slice();
		for (let x = 1; x < PX_W - 1; x++) {
			h[x] = (copy[x - 1] * 0.2 + copy[x] * 0.6 + copy[x + 1] * 0.2 + 0.5) | 0;
		}
	}
	return h;
}

/**
 * @param {Uint32Array} buf
 * @param {number[]} ridge
 * @param {number} shift
 * @param {{ hi: number, mid: number, low: number, base: number, leeHi: number, leeMid: number, leeLow: number, leeBase: number, snow: number, tree: number, snowAmt: number, peakH: number, withTrees: boolean }} pal
 */
function rasterRidge(buf, ridge, shift, pal) {
	const snowCut = pal.peakH * 0.8;
	const treeLo = pal.peakH * 0.16;
	for (let x = 0; x < PX_W; x++) {
		const sx = (x + shift + PX_W * 40) % PX_W;
		const h = ridge[sx];
		const prev = ridge[(sx - 1 + PX_W) % PX_W];
		const next = ridge[(sx + 1) % PX_W];
		const top = PX_H - h;
		if (top >= PX_H) continue;
		const lee = h < prev - 2;
		const cHi = lee ? pal.leeHi : pal.hi;
		const cMid = lee ? pal.leeMid : pal.mid;
		const cLow = lee ? pal.leeLow : pal.low;
		const cBase = lee ? pal.leeBase : pal.base;
		const yB = top + ((h * 0.12) | 0);
		const yC = top + ((h * 0.35) | 0);
		const yD = top + ((h * 0.65) | 0);

		for (let y = top; y < PX_H; y++) {
			let col = cBase;
			if (y < yB) col = cHi;
			else if (y < yC) col = cMid;
			else if (y < yD) col = cLow;
			if (y >= yB - 1 && y <= yB + 1) col = BAYER8[y & 7][x & 7] > 32 ? cMid : cHi;
			else if (y >= yC - 1 && y <= yC + 1) col = BAYER8[y & 7][x & 7] > 32 ? cLow : cMid;
			else if (y >= yD - 1 && y <= yD + 1) col = BAYER8[y & 7][x & 7] > 32 ? cBase : cLow;
			buf[y * PX_W + x] = col;
		}

		if (pal.withTrees && h > treeLo && h < snowCut * 0.86) {
			const hash = (sx * 17 + 31) % 14;
			if (hash < 2) {
				const th = 4 + (hash % 3);
				for (let i = 0; i < th; i++) {
					const yy = top - th + i;
					if (yy >= 0 && yy < PX_H) buf[yy * PX_W + x] = pal.tree;
				}
			}
		}

		if (pal.snowAmt < 0.06 || h < snowCut) continue;
		const localMax = h >= prev - 1 && h >= next - 1;
		if (!localMax && h < pal.peakH * 0.92) continue;
		const capH = h > pal.peakH * 0.92 ? 4 : 2;
		for (let i = 0; i < capH; i++) {
			if (i > 1 && BAYER8[(top + i) & 7][x & 7] > 40) continue;
			const yy = top + i;
			if (yy >= 0 && yy < PX_H) buf[yy * PX_W + x] = pal.snow;
		}
	}
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 */
function fillCircle(ctx, cx, cy, r) {
	const rr = r * r;
	for (let y = -r; y <= r; y++) {
		const yy = y * y;
		let x0 = -r;
		while (x0 * x0 + yy > rr) x0++;
		let x1 = r;
		while (x1 * x1 + yy > rr) x1--;
		if (x1 >= x0) ctx.fillRect(cx + x0, cy + y, x1 - x0 + 1, 1);
	}
}

/**
 * @param {number} kind
 * @param {string} shade
 * @param {string} body
 * @param {string} lit
 */
function bakeCloud(kind, shade, body, lit) {
	const lobes = CLOUD_SHAPES[kind % CLOUD_SHAPES.length];
	let minX = 0;
	let maxX = 0;
	let minY = 0;
	let maxY = 0;
	for (const L of lobes) {
		minX = Math.min(minX, L.dx - L.r);
		maxX = Math.max(maxX, L.dx + L.r);
		minY = Math.min(minY, L.dy - L.r - 2);
		maxY = Math.max(maxY, L.dy + L.r + 2);
	}
	const pad = 2;
	const w = maxX - minX + pad * 2;
	const h = maxY - minY + pad * 2;
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const g = c.getContext('2d');
	if (!g) return { canvas: c, ox: 0, oy: 0 };
	g.imageSmoothingEnabled = false;
	const ox = -minX + pad;
	const oy = -minY + pad;
	g.fillStyle = shade;
	for (const L of lobes) fillCircle(g, ox + L.dx, oy + L.dy + 2, L.r);
	g.fillStyle = body;
	for (const L of lobes) fillCircle(g, ox + L.dx, oy + L.dy, L.r);
	g.fillStyle = lit;
	for (const L of lobes) {
		if (L.r < 7) continue;
		fillCircle(g, ox + L.dx - 2, oy + L.dy - ((L.r * 0.35) | 0), Math.max(3, (L.r * 0.45) | 0));
	}
	return { canvas: c, ox, oy };
}

function bakeSun(dayAmt) {
	const c = document.createElement('canvas');
	c.width = 44;
	c.height = 44;
	const g = c.getContext('2d');
	if (!g) return c;
	g.imageSmoothingEnabled = false;
	const cx = 22;
	const cy = 22;
	const core = dayAmt > 0.6 ? '#fff4d0' : '#f0e0b8';
	g.fillStyle = '#d2c1a5';
	const rays = [
		[0, -16],
		[0, 16],
		[-16, 0],
		[16, 0],
		[-11, -11],
		[11, -11],
		[-11, 11],
		[11, 11]
	];
	for (const [dx, dy] of rays) {
		g.fillRect(cx + dx - 1, cy + dy - 1, 3, 3);
		g.fillRect(cx + ((dx * 0.55) | 0) - 1, cy + ((dy * 0.55) | 0) - 1, 2, 2);
	}
	g.fillStyle = '#c4b49a';
	fillCircle(g, cx, cy, 10);
	g.fillStyle = '#e8d4a0';
	fillCircle(g, cx, cy, 7);
	g.fillStyle = core;
	fillCircle(g, cx, cy, 4);
	g.fillStyle = '#fffaf0';
	fillCircle(g, cx - 1, cy - 1, 2);
	return c;
}

function bakeMoon() {
	const c = document.createElement('canvas');
	c.width = 28;
	c.height = 28;
	const g = c.getContext('2d');
	if (!g) return c;
	g.imageSmoothingEnabled = false;
	const cx = 14;
	const cy = 14;
	g.fillStyle = '#8a9ab0';
	fillCircle(g, cx, cy, 10);
	g.fillStyle = '#c8d4e8';
	fillCircle(g, cx, cy, 7);
	g.fillStyle = '#f0f4ff';
	fillCircle(g, cx + 1, cy - 1, 5);
	g.fillStyle = '#6a7a90';
	g.fillRect(cx - 1, cy - 2, 2, 2);
	g.fillRect(cx + 2, cy + 1, 3, 2);
	g.globalCompositeOperation = 'destination-out';
	fillCircle(g, cx - 5, cy, 6);
	g.globalCompositeOperation = 'source-over';
	return c;
}

/**
 * @param {HTMLElement} root
 */
function buildCssSky(root) {
	const wash = document.createElement('div');
	wash.className = 'sky-css-wash';
	root.appendChild(wash);
	return wash;
}

/**
 * @param {HTMLElement} wash
 * @param {ReturnType<typeof import('./dayCycle.js').sampleDay>} s
 */
function applyCssSky(wash, s) {
	const mid = mixCss(s.zenith, s.horizon, 0.44);
	const warm = mixCss(s.horizon, '#fff8df', 0.28 + s.dayAmt * 0.22);
	const glowPct = Math.round((0.1 + s.dayAmt * 0.42) * 100);
	const glowY = 16 + s.dayAmt * 12;

	wash.style.background = [
		`radial-gradient(ellipse 92% 56% at 50% ${glowY}%, color-mix(in srgb, ${warm} ${glowPct}%, transparent), transparent 64%)`,
		`linear-gradient(180deg, ${s.zenith} 0%, ${mid} 44%, ${s.horizon} 100%)`
	].join(', ');
}

/**
 * @param {HTMLElement} root
 * @param {{ reduced?: boolean }} [opts]
 */
export function createOlympusSky(root, opts = {}) {
	const reduced = !!opts.reduced;

	let styleEl = document.getElementById('olympus-sky-styles');
	if (!styleEl) {
		styleEl = document.createElement('style');
		styleEl.id = 'olympus-sky-styles';
		document.head.appendChild(styleEl);
	}
	styleEl.textContent = SKY_CSS;

	root.classList.add('olympus-sky');
	root.setAttribute('aria-hidden', 'true');
	root.innerHTML = '';

	const cssWash = buildCssSky(root);

	const terrainCanvas = document.createElement('canvas');
	terrainCanvas.className = 'sky-canvas sky-terrain';
	terrainCanvas.width = PX_W;
	terrainCanvas.height = PX_H;
	terrainCanvas.setAttribute('aria-hidden', 'true');
	root.appendChild(terrainCanvas);

	const celestialCanvas = document.createElement('canvas');
	celestialCanvas.className = 'sky-canvas sky-celestial';
	celestialCanvas.width = PX_W;
	celestialCanvas.height = PX_H;
	celestialCanvas.setAttribute('aria-hidden', 'true');
	root.appendChild(celestialCanvas);

	const cloudCanvas = document.createElement('canvas');
	cloudCanvas.className = 'sky-canvas sky-clouds';
	cloudCanvas.width = PX_W;
	cloudCanvas.height = PX_H;
	cloudCanvas.setAttribute('aria-hidden', 'true');
	root.appendChild(cloudCanvas);

	const terrainCtx = terrainCanvas.getContext('2d', { alpha: true, desynchronized: true });
	const celestialCtx = celestialCanvas.getContext('2d', { alpha: true, desynchronized: true });
	const cloudCtx = cloudCanvas.getContext('2d', { alpha: true, desynchronized: true });
	if (!terrainCtx || !celestialCtx || !cloudCtx) {
		return {
			setDay() {},
			nudgeDay() {},
			getDay: () => 0.35,
			setPointer() {},
			resize() {},
			tick() {},
			dispose() {
				root.innerHTML = '';
				root.classList.remove('olympus-sky');
			}
		};
	}
	terrainCtx.imageSmoothingEnabled = false;
	celestialCtx.imageSmoothingEnabled = false;
	cloudCtx.imageSmoothingEnabled = false;

	const stopCoverFit = observeCoverFit([terrainCanvas, celestialCanvas, cloudCanvas], root, PX_W, PX_H);

	const terrainImage = terrainCtx.createImageData(PX_W, PX_H);
	const terrainBuf = new Uint32Array(terrainImage.data.buffer);

	/** @type {{ x: number, y: number, kind: number, bright: number, tw: number, twSpeed: number }[]} */
	const stars = [];
	for (let i = 0; i < 90; i++) {
		stars.push({
			x: 6 + ((Math.random() * (PX_W - 12)) | 0),
			y: 4 + ((Math.random() * (PX_H * 0.55)) | 0),
			kind: i % 9 === 0 ? 2 : i % 4 === 0 ? 1 : 0,
			bright: 0.4 + Math.random() * 0.6,
			tw: Math.random() * Math.PI * 2,
			twSpeed: 0.5 + Math.random() * 1.4
		});
	}

	const ridgeFar = buildRidge(1.7, 48, 110);
	const ridgeMid = buildRidge(3.1, 54, 126);
	const ridgeNear = buildRidge(5.9, 40, 114);
	const peakFar = Math.max(...ridgeFar);
	const peakMid = Math.max(...ridgeMid);
	const peakNear = Math.max(...ridgeNear);

	const puffDefs = [
		{ kind: 0, x: -4.8, y: 22, speed: 0.018 },
		{ kind: 1, x: -3.2, y: 18, speed: 0.022 },
		{ kind: 2, x: -1.4, y: 28, speed: 0.015 },
		{ kind: 4, x: 0.2, y: 20, speed: 0.025 },
		{ kind: 3, x: 1.8, y: 26, speed: 0.019 },
		{ kind: 1, x: 3.4, y: 16, speed: 0.023 },
		{ kind: 0, x: 4.8, y: 24, speed: 0.017 },
		{ kind: 2, x: -5.4, y: 14, speed: 0.021 }
	];

	const sunDay = bakeSun(0.7);
	const sunDawn = bakeSun(0.4);
	const moonSpr = bakeMoon();

	/** @type {Map<string, ReturnType<typeof bakeCloud>[]>} */
	const cloudCache = new Map();

	/**
	 * @param {number} dayBucket
	 * @param {number} day
	 */
	function cloudsForBucket(dayBucket, day) {
		const key = String(dayBucket);
		let list = cloudCache.get(key);
		if (list) return list;
		const tint = sampleKey(CLOUD_LOOP, day, 'c');
		const shade = mixCss(tint, '#6a7a90', 0.38);
		const lit = mixCss(tint, '#ffffff', 0.42);
		list = [0, 1, 2, 3, 4].map((k) => bakeCloud(k, shade, tint, lit));
		cloudCache.set(key, list);
		if (cloudCache.size > 24) {
			const first = cloudCache.keys().next().value;
			if (first !== undefined) cloudCache.delete(first);
		}
		return list;
	}

	const clock = createDayClock({ reduced });
	let mx = 0.5;
	let my = 0.4;
	let elapsed = 0;
	let scrubDrift = 0;
	let frame = 0;

	let lastDayQ = -1;
	let lastPar = -999;
	let lastStarPhase = -1;

	/**
	 * Pixel mountains + stars on a transparent canvas (sky is CSS underneath).
	 * @param {ReturnType<typeof import('./dayCycle.js').sampleDay>} s
	 * @param {number} parX
	 * @param {number} starPhase
	 */
	function paintTerrain(s, parX, starPhase) {
		terrainBuf.fill(0);

		const gate = 0.08 + s.nightAmt * 0.92;
		const WHITE = packRgb(255, 255, 255, 255);
		const STAR = packRgb(220, 232, 255, 255);
		if (gate > 0.12) {
			for (const star of stars) {
				const tw = reduced
					? 0.9
					: 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(starPhase * star.twSpeed + star.tw));
				const op = gate * star.bright * tw;
				if (op < 0.18) continue;
				const px = star.x + (((mx - 0.5) * -4) | 0);
				const py = star.y + (((my - 0.5) * -2) | 0);
				if (px < 1 || px >= PX_W - 1 || py < 1 || py >= PX_H - 1) continue;
				terrainBuf[py * PX_W + px] = WHITE;
				if (star.kind >= 1) {
					terrainBuf[py * PX_W + px - 1] = WHITE;
					terrainBuf[py * PX_W + px + 1] = WHITE;
					terrainBuf[(py - 1) * PX_W + px] = WHITE;
					terrainBuf[(py + 1) * PX_W + px] = WHITE;
				}
				if (star.kind >= 2) terrainBuf[py * PX_W + px] = STAR;
			}
		}

		const snow = cssToPacked(sampleKey(MTN_LOOP.snow, s.day, 'c'));
		const tree = cssToPacked(sampleKey(MTN_LOOP.treeline, s.day, 'c'));
		const snowAmt = 0.25 + s.dayAmt * 0.7;
		const deep = cssToPacked('#061018');

		/**
		 * @param {string} fillCss
		 * @param {number} peakH
		 * @param {boolean} withTrees
		 * @param {number} shadeAmt
		 */
		function palFor(fillCss, peakH, withTrees, shadeAmt) {
			const fill = cssToPacked(fillCss);
			const shade = mixPacked(fill, deep, shadeAmt);
			const hi = mixPacked(fill, packRgb(255, 255, 255, 255), 0.14);
			const low = mixPacked(fill, shade, 0.55);
			const base = mixPacked(shade, deep, 0.35);
			return {
				hi,
				mid: fill,
				low,
				base,
				leeHi: mixPacked(hi, deep, 0.3),
				leeMid: mixPacked(fill, deep, 0.35),
				leeLow: mixPacked(low, deep, 0.4),
				leeBase: mixPacked(base, deep, 0.45),
				snow,
				tree,
				snowAmt,
				peakH,
				withTrees
			};
		}

		const farFill = sampleKey(MTN_LOOP.far, s.day, 'c');
		const midFill = sampleKey(MTN_LOOP.mid, s.day, 'c');
		const nearFill = sampleKey(MTN_LOOP.near, s.day, 'c');

		rasterRidge(terrainBuf, ridgeFar, (parX * -8) | 0, palFor(farFill, peakFar, false, 0.28));
		rasterRidge(terrainBuf, ridgeMid, (parX * -5) | 0, {
			...palFor(midFill, peakMid, true, 0.32),
			snowAmt
		});
		rasterRidge(terrainBuf, ridgeNear, (parX * -2) | 0, {
			...palFor(nearFill, peakNear, true, 0.38),
			snowAmt: snowAmt * 0.9
		});

		terrainCtx.putImageData(terrainImage, 0, 0);
	}

	/**
	 * @param {ReturnType<typeof import('./dayCycle.js').sampleDay>} s
	 */
	function paintCelestials(s) {
		celestialCtx.clearRect(0, 0, PX_W, PX_H);
		if (s.showSun && s.sunFade > 0.01) {
			const p = celestialToPx(s.sunXY);
			const spr = s.dayAmt > 0.55 ? sunDay : sunDawn;
			celestialCtx.globalAlpha = Math.min(1, s.sunFade);
			celestialCtx.drawImage(spr, p.x - 22, p.y - 22);
		}
		if (s.showMoon && s.moonFade > 0.01) {
			const p = celestialToPx(s.moonXY);
			celestialCtx.globalAlpha = Math.min(1, s.moonFade);
			celestialCtx.drawImage(moonSpr, p.x - 14, p.y - 14);
		}
		celestialCtx.globalAlpha = 1;
	}

	/**
	 * @param {ReturnType<typeof import('./dayCycle.js').sampleDay>} s
	 */
	function paintClouds(s) {
		cloudCtx.clearRect(0, 0, PX_W, PX_H);
		const dayBucket = (s.day * 48) | 0;
		const sprites = cloudsForBucket(dayBucket, s.day);
		cloudCtx.globalAlpha = 0.5 + s.dayAmt * 0.42;
		for (let i = 0; i < puffDefs.length; i++) {
			const def = puffDefs[i];
			const x = reduced
				? def.x
				: wrapDrift(def.x + elapsed * def.speed + scrubDrift, DRIFT_HALF);
			const cx = driftToPx(x);
			const bob = reduced ? 0 : Math.sin(elapsed * 0.32 + def.x) * 2;
			const cy = (def.y / 100) * PX_H;
			const spr = sprites[def.kind];
			cloudCtx.drawImage(spr.canvas, cx - spr.ox, cy + bob - spr.oy);
		}
		cloudCtx.globalAlpha = 1;
	}

	return {
		/** @param {number} d @param {boolean} [immediate] */
		setDay(d, immediate = false) {
			clock.setDay(d, immediate);
		},
		/** @param {number} delta */
		nudgeDay(delta) {
			clock.nudgeDay(delta);
			scrubDrift += delta * 14;
		},
		getDay: () => clock.getDay(),
		/** @param {number} x @param {number} y */
		setPointer(x, y) {
			mx = x;
			my = y;
		},
		resize() {
			applyCoverFitCanvas(terrainCanvas, root, PX_W, PX_H);
			applyCoverFitCanvas(celestialCanvas, root, PX_W, PX_H);
			applyCoverFitCanvas(cloudCanvas, root, PX_W, PX_H);
		},
		/**
		 * @param {number} dt
		 * @param {number} nowElapsed
		 */
		tick(dt, nowElapsed) {
			elapsed = nowElapsed;
			clock.tick(dt);
			frame++;

			const s = clock.sample();
			const dayQ = (s.day * 96) | 0;
			const par = (((mx - 0.5) * 10) | 0);
			const starBucket = (elapsed * 2) | 0;

			applyCssSky(cssWash, s);

			const needTerrain =
				dayQ !== lastDayQ || par !== lastPar || starBucket !== lastStarPhase || frame <= 2;
			if (needTerrain) {
				lastDayQ = dayQ;
				lastPar = par;
				lastStarPhase = starBucket;
				paintTerrain(s, mx - 0.5, elapsed);
			}

			paintCelestials(s);
			paintClouds(s);
		},
		dispose() {
			stopCoverFit();
			cloudCache.clear();
			root.innerHTML = '';
			root.classList.remove('olympus-sky');
		}
	};
}
