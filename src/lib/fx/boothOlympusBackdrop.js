/**
 * Shared booth Olympus backdrop — ethereal pantheon above the clouds (HD pixel).
 * Reference: floating marble Olympus (tholos + colonnades + islands + moons).
 * Cheap: bake 3 parallax layers once; mist + waterfall tick at low fps.
 */
const PX_W = 480;
const PX_H = 270;

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

const CSS = `
.booth-olympus {
	position: absolute;
	inset: 0;
	z-index: 0;
	overflow: hidden;
	pointer-events: none;
	background: #0a1830;
}
.booth-olympus .bo-layer {
	position: absolute;
	inset: -4%;
	width: 108%;
	height: 108%;
	left: -4%;
	top: -4%;
	image-rendering: pixelated;
	image-rendering: crisp-edges;
	will-change: transform;
}
/* Depth: push scenery back so the courier / strip stay hero */
.booth-olympus .bo-far {
	z-index: 0;
	filter: brightness(0.62) saturate(0.7) blur(0.2px);
	opacity: 0.82;
}
.booth-olympus .bo-mid {
	z-index: 1;
	filter: brightness(0.9) saturate(0.92);
	opacity: 0.94;
}
.booth-olympus .bo-near {
	z-index: 2;
	filter: brightness(0.98);
}
.booth-olympus .bo-live { z-index: 3; opacity: 0.7; }
.booth-olympus .bo-veil {
	position: absolute;
	inset: 0;
	z-index: 3;
	pointer-events: none;
	background:
		radial-gradient(ellipse 36% 48% at 50% 40%, transparent 0%, transparent 32%, rgba(8, 18, 40, 0.35) 68%, rgba(6, 14, 32, 0.58) 100%),
		linear-gradient(180deg, rgba(10, 22, 48, 0.22) 0%, transparent 26%, transparent 52%, rgba(12, 24, 48, 0.28) 100%);
}
.booth-olympus .bo-scan {
	position: absolute;
	inset: 0;
	z-index: 4;
	pointer-events: none;
	background: repeating-linear-gradient(
		0deg,
		transparent 0 3px,
		rgba(15, 23, 42, 0.045) 3px 4px
	);
	opacity: 0.28;
}
`;

/** @param {number} r @param {number} g @param {number} b @param {number} [a] */
function pack(r, g, b, a = 255) {
	return (a << 24) | (b << 16) | (g << 8) | r;
}

const C = {
	/* sky — reference twilight (indigo → gold) */
	skyTop: pack(14, 22, 58),
	skyMid: pack(58, 110, 168),
	skySoft: pack(148, 188, 218),
	skyGlow: pack(240, 188, 130),
	skyHorizon: pack(255, 228, 178),
	star: pack(255, 248, 230),
	moon: pack(242, 246, 255),
	moonShade: pack(186, 198, 220),
	moonRim: pack(255, 255, 255),
	/* clouds — reference twilight billows (cream / rose / violet / deep purple) */
	cloudCream: pack(255, 248, 238),
	cloudPeach: pack(255, 228, 210),
	cloudRose: pack(238, 198, 218),
	cloudLavender: pack(220, 200, 238),
	cloudViolet: pack(148, 128, 188),
	cloudDeep: pack(88, 72, 138),
	cloudAbyss: pack(52, 44, 88),
	/* legacy aliases used elsewhere */
	cloudMid: pack(220, 200, 238),
	cloudLit: pack(255, 248, 238),
	cloudPink: pack(238, 198, 218),
	/* marble — bright white like the reference */
	marble: pack(244, 246, 252),
	marbleLit: pack(255, 255, 255),
	marbleMid: pack(220, 226, 238),
	marbleDark: pack(176, 186, 204),
	marbleShade: pack(128, 140, 164),
	vein: pack(168, 180, 200),
	gold: pack(220, 184, 108),
	goldLit: pack(248, 220, 150),
	/* roof tiles — high contrast so dimmed mid-layer still reads */
	roofDeep: pack(140, 96, 58),
	roofMid: pack(196, 148, 78),
	roofLit: pack(236, 200, 120),
	/* nature */
	grass: pack(82, 152, 92),
	grassLit: pack(124, 188, 118),
	grassDark: pack(46, 104, 66),
	rock: pack(108, 118, 138),
	rockDark: pack(68, 78, 98),
	water: pack(150, 206, 230),
	waterMid: pack(186, 228, 245),
	waterLit: pack(230, 250, 255),
	waterDeep: pack(110, 168, 198),
	foam: pack(245, 250, 255),
	haze: pack(156, 186, 214),
	door: pack(52, 62, 84)
};

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function mix(a, b, t) {
	const ar = a & 255;
	const ag = (a >> 8) & 255;
	const ab = (a >> 16) & 255;
	const br = b & 255;
	const bg = (b >> 8) & 255;
	const bb = (b >> 16) & 255;
	const u = t < 0 ? 0 : t > 1 ? 1 : t;
	return pack(
		(ar + (br - ar) * u + 0.5) | 0,
		(ag + (bg - ag) * u + 0.5) | 0,
		(ab + (bb - ab) * u + 0.5) | 0
	);
}

/**
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} x
 * @param {number} y
 * @param {number} rw
 * @param {number} rh
 * @param {number} col
 */
function fillRect(buf, w, h, x, y, rw, rh, col) {
	const x0 = Math.max(0, x | 0);
	const y0 = Math.max(0, y | 0);
	const x1 = Math.min(w, x0 + (rw | 0));
	const y1 = Math.min(h, y0 + (rh | 0));
	for (let yy = y0; yy < y1; yy++) {
		const row = yy * w;
		for (let xx = x0; xx < x1; xx++) buf[row + xx] = col;
	}
}

/**
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} col
 * @param {number} [a] alpha 0–255 baked as overwrite if a>=250
 */
function fillCircle(buf, w, h, cx, cy, r, col) {
	const rr = r * r;
	for (let dy = -r; dy <= r; dy++) {
		const yy = cy + dy;
		if (yy < 0 || yy >= h) continue;
		const row = yy * w;
		const y2 = dy * dy;
		for (let dx = -r; dx <= r; dx++) {
			if (dx * dx + y2 > rr) continue;
			const xx = cx + dx;
			if (xx >= 0 && xx < w) buf[row + xx] = col;
		}
	}
}

/**
 * Landing-page cloud lobes — shade offset +2y, body, upper-left highlight.
 * @type {Array<Array<{ dx: number, dy: number, r: number }>>}
 */
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

/** BLOB → SHADE (internal humps only; bottom lobes provide the flat base). */
function paintCloudSprite(buf, w, h, cx, cy, kind, warm = false, scale = 1) {
	const lobes = CLOUD_SHAPES[kind % CLOUD_SHAPES.length];
	const s = scale < 0.6 ? 0.6 : scale;
	const body = warm ? mix(C.cloudCream, C.cloudPeach, 0.22) : C.cloudCream;
	const humpShade = warm ? mix(C.cloudPeach, C.cloudRose, 0.42) : mix(C.cloudLavender, C.cloudRose, 0.32);
	const lit = C.cloudLit;

	const sorted = [...lobes].sort((a, b) => a.dy - b.dy);
	for (const L of sorted) {
		const dx = (L.dx * s) | 0;
		const dy = (L.dy * s) | 0;
		const r = Math.max(3, (L.r * s) | 0);
		fillCircle(buf, w, h, cx + dx, cy + dy, r, body);
	}

	for (const L of sorted) {
		if (L.dy > 0) continue;
		const dx = (L.dx * s) | 0;
		const dy = (L.dy * s) | 0;
		const r = Math.max(3, (L.r * s) | 0);
		const sr = Math.max(2, (r * 0.52) | 0);
		fillCircle(buf, w, h, cx + dx, cy + dy + Math.max(1, (r * 0.18) | 0), sr, humpShade);
	}

	for (const L of sorted) {
		const dx = (L.dx * s) | 0;
		const dy = (L.dy * s) | 0;
		const r = Math.max(3, (L.r * s) | 0);
		if (r < ((7 * s) | 0)) continue;
		fillCircle(buf, w, h, cx + dx - 2, cy + dy - ((r * 0.35) | 0), Math.max(2, (r * 0.4) | 0), lit);
	}
}

function paintCloudShelfRow(buf, w, h, y, left, right, warm = false) {
	const body = warm ? mix(C.cloudCream, C.cloudPeach, 0.22) : C.cloudCream;
	const humpShade = warm ? mix(C.cloudPeach, C.cloudRose, 0.42) : mix(C.cloudLavender, C.cloudRose, 0.32);
	const baseTone = warm ? mix(C.cloudRose, C.cloudLavender, 0.35) : C.cloudLavender;
	const lit = C.cloudLit;
	const bw = right - left;
	const shelfH = 5;

	fillRect(buf, w, h, left, y, bw, shelfH, baseTone);
	fillRect(buf, w, h, left, y, bw, 1, body);

	for (let x = left + 20; x < right - 12; x += 34) {
		const j = ((x * 7) % 7) - 3;
		const r0 = 10 + ((x * 3) % 3);
		const r1 = 12 + ((x * 5) % 4);
		fillCircle(buf, w, h, x - 14 + j, y - 2, r0, body);
		fillCircle(buf, w, h, x + 14 - j, y - 2, r0, body);
		fillCircle(buf, w, h, x, y - 8, r1, body);
		fillCircle(buf, w, h, x - 7, y - 15, 8 + (x % 3), body);
		fillCircle(buf, w, h, x + 7, y - 14, 7 + (x % 4), body);
		fillCircle(buf, w, h, x - 4, y - 10, 5, humpShade);
		fillCircle(buf, w, h, x + 3, y - 12, 4, humpShade);
		fillCircle(buf, w, h, x - 2, y - 13, 3, lit);
	}
}

function paintCloudBank(buf, w, h, cx, cy, bw, bh, warm = false, kindStart = 0) {
	const s = Math.max(1.2, bh / 12);
	const step = Math.max(20, (26 * s) | 0);
	const count = Math.max(3, Math.ceil(bw / step) + 1);
	const left = cx - ((bw / 2) | 0);
	for (let i = 0; i < count; i++) {
		const t = count <= 1 ? 0.5 : i / (count - 1);
		const x = left + ((t * bw) | 0);
		const yJitter = ((i * 3 + kindStart) % 5) - 2;
		paintCloudSprite(buf, w, h, x, cy + yJitter, (kindStart + i) % CLOUD_SHAPES.length, warm, s);
	}
}

/**
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} scale
 * @param {boolean} [warm]
 * @param {number} [kind]
 */
function paintCloud(buf, w, h, cx, cy, scale, warm = false, kind = 0) {
	const s = Math.max(1, scale * 1.35);
	paintCloudSprite(buf, w, h, cx, cy, kind, warm, s);
}

/**
 * Doric marble column — abacus + echinus, fluted shaft, no Thai finials.
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} top
 * @param {number} bot
 * @param {number} colW
 */
function paintColumn(buf, w, h, cx, top, bot, colW) {
	const height = bot - top;
	if (height < 4) return;
	/* abacus */
	fillRect(buf, w, h, cx - colW - 1, top, colW * 2 + 3, 2, C.marbleLit);
	/* echinus (simple Doric cushion — marble, not gold spike) */
	fillRect(buf, w, h, cx - colW, top + 2, colW * 2 + 1, 2, C.marbleMid);
	fillRect(buf, w, h, cx - colW + 1, top + 4, colW * 2 - 1, 1, C.marble);
	/* shaft */
	const shaftTop = top + 5;
	const shaftH = bot - shaftTop - 3;
	fillRect(buf, w, h, cx - colW + 1, shaftTop, colW * 2 - 1, shaftH, C.marbleMid);
	fillRect(buf, w, h, cx - colW + 1, shaftTop, 1, shaftH, C.marbleLit);
	fillRect(buf, w, h, cx + colW - 1, shaftTop, 1, shaftH, C.marbleShade);
	if (colW >= 2) {
		fillRect(buf, w, h, cx, shaftTop + 1, 1, shaftH - 2, C.vein);
	}
	/* stylobate foot */
	fillRect(buf, w, h, cx - colW, bot - 3, colW * 2 + 1, 2, C.marbleDark);
	fillRect(buf, w, h, cx - colW - 1, bot - 1, colW * 2 + 3, 1, C.marbleShade);
}

/**
 * Greek Doric temple facade (Parthenon-adjacent) — marble pediment, NOT a spirit-house roof.
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} x
 * @param {number} groundY
 * @param {number} tw
 * @param {number} bodyH
 * @param {number} cols
 * @param {number} [scale]
 * @param {'shrine' | 'grand'} [kind]
 */
function paintTemple(buf, w, h, x, groundY, tw, bodyH, cols, scale = 1, kind = 'shrine') {
	const grand = kind === 'grand';
	const mid = (x + tw / 2) | 0;

	/* crepidoma — three marble steps */
	const steps = grand ? 3 : 2;
	const stepH = 2;
	let stylobate = groundY;
	for (let s = 0; s < steps; s++) {
		const inset = s * 2;
		stylobate -= stepH;
		fillRect(buf, w, h, x + inset, stylobate, tw - inset * 2, stepH, s % 2 ? C.marbleMid : C.marbleDark);
		fillRect(buf, w, h, x + inset, stylobate, tw - inset * 2, 1, C.marbleLit);
	}

	const colTop = stylobate - bodyH;
	const colBot = stylobate - 1;

	/* cella wall recessed behind the colonnade */
	const cellInset = grand ? 6 : 4;
	fillRect(buf, w, h, x + cellInset, colTop + 4, tw - cellInset * 2, bodyH - 6, C.marble);
	fillRect(buf, w, h, x + cellInset, colTop + 4, 2, bodyH - 6, C.marbleLit);
	fillRect(buf, w, h, x + tw - cellInset - 2, colTop + 4, 2, bodyH - 6, C.marbleShade);

	/* naos door */
	const doorW = Math.max(4, (tw * 0.14) | 0);
	const doorH = (bodyH * 0.5) | 0;
	fillRect(buf, w, h, mid - ((doorW / 2) | 0), colBot - doorH, doorW, doorH, C.door);
	fillRect(buf, w, h, mid - ((doorW / 2) | 0), colBot - doorH, 1, doorH, C.marbleShade);

	/* free-standing Doric colonnade across the facade */
	const colW = grand ? 2 : 2;
	const pad = grand ? 5 : 4;
	const span = tw - pad * 2;
	for (let i = 0; i < cols; i++) {
		const cx = (x + pad + (i + 0.5) * (span / cols)) | 0;
		paintColumn(buf, w, h, cx, colTop + 2, colBot, colW);
	}

	/* entablature: architrave → triglyph frieze → cornice (all marble) */
	const entH = grand ? 7 : 5;
	const entY = colTop - entH + 2;
	fillRect(buf, w, h, x, entY + entH - 2, tw, 2, C.marbleMid); /* architrave */
	fillRect(buf, w, h, x, entY + 2, tw, entH - 4, C.marble); /* frieze band */
	/* triglyphs + metopes */
	const trig = Math.max(3, (tw / (cols + 1)) | 0);
	for (let tx = x + 2; tx < x + tw - 3; tx += trig) {
		fillRect(buf, w, h, tx, entY + 2, 2, entH - 4, C.marbleShade);
		if (grand) fillRect(buf, w, h, tx + 1, entY + 3, 1, entH - 6, C.marbleDark);
	}
	fillRect(buf, w, h, x - 1, entY, tw + 2, 2, C.marbleLit); /* cornice */
	fillRect(buf, w, h, x + 2, entY + 1, tw - 4, 1, mix(C.marbleLit, C.gold, 0.25));

	/*
	 * Low pediment with flat ridge — no sharp apex (avoids tippy / spirit-house read).
	 */
	const pedH = Math.max(grand ? 8 : 5, (tw * (grand ? 0.12 : 0.11)) | 0);
	const pedY = entY - pedH;
	const maxHalf = ((tw / 2) | 0) - 1;
	const flatHalf = Math.max(2, grand ? 5 : 4); /* truncated ridge width */
	for (let row = 0; row < pedH; row++) {
		const t = (row + 1) / pedH;
		const half = Math.max(flatHalf, ((t * maxHalf) | 0));
		const y = pedY + row;
		fillRect(buf, w, h, mid - half, y, half * 2 + 1, 1, row < 2 ? C.marbleLit : C.marbleMid);
		fillRect(buf, w, h, mid - half, y, 1, 1, C.marbleLit);
		fillRect(buf, w, h, mid + half, y, 1, 1, C.marbleShade);
	}
	/* flat ridge cap on top */
	fillRect(buf, w, h, mid - flatHalf, pedY - 1, flatHalf * 2 + 1, 2, C.marbleLit);
	fillRect(buf, w, h, mid - flatHalf + 1, pedY, flatHalf * 2 - 1, 1, C.marbleMid);
	/* tympanum recess */
	const tymH = Math.max(2, (pedH * 0.5) | 0);
	for (let row = 0; row < tymH; row++) {
		const half = Math.max(flatHalf - 1, ((((row + 1) / tymH) * (maxHalf - 3)) | 0));
		fillRect(buf, w, h, mid - half, pedY + pedH - tymH + row - 1, half * 2, 1, C.marbleDark);
	}
	/* geison */
	fillRect(buf, w, h, x, pedY + pedH - 1, tw, 2, C.marbleLit);

	/* corner acroteria only — no apex spike */
	if (grand) {
		fillRect(buf, w, h, x + 1, pedY + pedH - 2, 2, 2, C.marbleLit);
		fillRect(buf, w, h, x + tw - 3, pedY + pedH - 2, 2, 2, C.marbleLit);
	}
}

/**
 * Fill only the upper half of a circle (shallow dome roof).
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy base of dome (equator)
 * @param {number} r
 * @param {number} col
 */
function fillDome(buf, w, h, cx, cy, r, col) {
	const rr = r * r;
	for (let dy = -r; dy <= 0; dy++) {
		const yy = cy + dy;
		if (yy < 0 || yy >= h) continue;
		const row = yy * w;
		const y2 = dy * dy;
		for (let dx = -r; dx <= r; dx++) {
			if (dx * dx + y2 > rr) continue;
			const xx = cx + dx;
			if (xx >= 0 && xx < w) buf[row + xx] = col;
		}
	}
}

/**
 * Pantheon-style rotunda: colonnade → drum → stepped dome → oculus.
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} groundY
 * @param {number} radius
 */
function paintTholos(buf, w, h, cx, groundY, radius) {
	const steps = 5;
	const stepH = 3;
	let y = groundY;
	for (let s = 0; s < steps; s++) {
		y -= stepH;
		const rw = radius * 2 - s * 4 + 22;
		const rx = cx - ((rw / 2) | 0);
		fillRect(buf, w, h, rx, y, rw, stepH, s % 2 ? C.marbleMid : C.marbleDark);
		fillRect(buf, w, h, rx, y, rw, 1, C.marbleLit);
	}

	const shaftH = 32;
	const colTop = y - shaftH;
	const colBot = y - 1;
	const n = 11;

	/* rear colonnade */
	for (let i = 1; i < n - 1; i++) {
		const t = i / (n - 1);
		const ox = ((t - 0.5) * radius * 1.3) | 0;
		paintColumn(buf, w, h, cx + ox, colTop + 3, colBot - 1, 2);
		fillRect(buf, w, h, cx + ox - 1, colTop + 9, 2, shaftH - 14, C.marbleShade);
	}

	/* cylindrical cella */
	for (let dy = 0; dy < 14; dy++) {
		const half = (Math.sqrt(1 - (dy / 14) * (dy / 14)) * (radius - 8)) | 0;
		fillRect(buf, w, h, cx - half, colTop + 10 + dy, half * 2, 1, C.marbleMid);
	}
	fillRect(buf, w, h, cx - 4, colBot - 14, 8, 12, C.door);

	/* front colonnade */
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1);
		const ox = ((t - 0.5) * radius * 1.7) | 0;
		const shorten = (Math.abs(t - 0.5) * 3) | 0;
		paintColumn(buf, w, h, cx + ox, colTop + shorten, colBot, i === 0 || i === n - 1 ? 2 : 3);
	}

	/* entablature */
	const entY = colTop;
	fillRect(buf, w, h, cx - radius - 2, entY, radius * 2 + 4, 3, C.marbleLit);
	fillRect(buf, w, h, cx - radius + 2, entY + 1, radius * 2 - 4, 1, C.gold);

	/* drum — clear cylindrical attic the dome rests on */
	const drumH = 12;
	const drumTop = entY - drumH;
	const drumR = radius - 5;
	for (let dy = 0; dy < drumH; dy++) {
		fillRect(buf, w, h, cx - drumR, drumTop + dy, drumR * 2, 1, dy < 2 ? C.marbleLit : C.marble);
		fillRect(buf, w, h, cx - drumR, drumTop + dy, 2, 1, C.marbleLit);
		fillRect(buf, w, h, cx + drumR - 2, drumTop + dy, 2, 1, C.marbleShade);
		/* panel joints on drum */
		if (dy > 2 && dy < drumH - 1 && dy % 3 === 0) {
			for (let px = -drumR + 4; px < drumR - 4; px += 7) {
				fillRect(buf, w, h, cx + px, drumTop + dy, 1, 1, C.vein);
			}
		}
	}
	fillRect(buf, w, h, cx - drumR - 3, drumTop - 3, drumR * 2 + 6, 3, C.marbleLit);
	fillRect(buf, w, h, cx - drumR - 1, drumTop - 2, drumR * 2 + 2, 1, C.gold);

	/*
	 * Pantheon dome: smooth hemisphere on the drum + subtle coffer arcs + oculus.
	 * (Stepped ledges read as a ziggurat — avoid that.)
	 */
	const domeBase = drumTop - 1;
	const domeR = drumR + 1;
	fillDome(buf, w, h, cx, domeBase, domeR, C.marbleMid);
	fillDome(buf, w, h, cx, domeBase, domeR - 3, C.marble);
	fillDome(buf, w, h, cx - 2, domeBase - 1, Math.max(8, domeR - 9), C.marbleLit);
	/* soft shadow on the right of the dome */
	for (let dy = -domeR; dy <= 0; dy++) {
		const yy = domeBase + dy;
		const half = (Math.sqrt(Math.max(0, domeR * domeR - dy * dy)) | 0);
		if (half > 3) fillRect(buf, w, h, cx + half - 2, yy, 2, 1, C.marbleShade);
	}
	/* coffer arcs — thin concentric guides, not ledges */
	for (const rr of [domeR - 5, domeR - 10, domeR - 15]) {
		if (rr < 6) continue;
		for (let a = -rr; a <= 0; a++) {
			const half = (Math.sqrt(Math.max(0, rr * rr - a * a)) | 0);
			const y = domeBase + a;
			fillRect(buf, w, h, cx - half, y, 1, 1, C.vein);
			fillRect(buf, w, h, cx + half - 1, y, 1, 1, C.vein);
		}
	}
	/* oculus */
	const ocY = domeBase - domeR + 6;
	fillCircle(buf, w, h, cx, ocY, 5, C.marbleDark);
	fillCircle(buf, w, h, cx, ocY, 3, mix(C.skyMid, C.skySoft, 0.55));
	fillRect(buf, w, h, cx - 2, ocY - 5, 5, 2, C.goldLit);
}

/**
 * Cascading waterfall — lip, tapering curtain, spray at base.
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} yTop
 * @param {number} fallH
 * @param {number} lipW
 */
function paintWaterfall(buf, w, h, cx, yTop, fallH, lipW) {
	const halfLip = (lipW / 2) | 0;
	/* rocky ledge + wet lip */
	fillRect(buf, w, h, cx - halfLip - 3, yTop - 3, lipW + 6, 3, C.rockDark);
	fillRect(buf, w, h, cx - halfLip - 1, yTop - 1, lipW + 2, 2, C.rock);
	fillRect(buf, w, h, cx - halfLip, yTop + 1, lipW, 2, C.waterLit);
	fillRect(buf, w, h, cx - ((halfLip * 0.6) | 0), yTop + 1, Math.max(3, (lipW * 0.55) | 0), 1, C.foam);

	/*
	 * Soft translucent curtain + bright strands.
	 * Curtain gives volume; strands + gaps give “falling water.”
	 */
	for (let row = 0; row < fallH; row++) {
		const t = row / fallH;
		const spread =
			t < 0.15 ? lipW : t < 0.65 ? Math.max(5, (lipW * (1 - t * 0.25)) | 0) : Math.max(7, (lipW * (0.65 + t * 0.55)) | 0);
		const y = yTop + 3 + row;
		const left = cx - ((spread / 2) | 0);
		/* sparse curtain (every other pixel) so it isn't a neon bar */
		for (let x = left; x < left + spread; x++) {
			if (x < 0 || x >= w || y < 0 || y >= h) continue;
			if (((x + row) & 1) === 0) continue;
			if (BAYER8[row & 7][x & 7] > 40) continue;
			buf[y * w + x] = t > 0.8 ? C.waterMid : C.water;
		}
	}
	const streamCount = Math.max(5, (lipW / 2.5) | 0);
	for (let s = 0; s < streamCount; s++) {
		const u = streamCount === 1 ? 0.5 : s / (streamCount - 1);
		const x0 = cx - halfLip + 1 + ((u * (lipW - 2)) | 0);
		const lean = (u - 0.5) * 0.5;
		for (let row = 0; row < fallH; row++) {
			const t = row / fallH;
			const y = yTop + 3 + row;
			const x = x0 + ((lean * t * 8) | 0) + (((row + s * 2) % 6 === 0) ? 1 : 0);
			if ((row + s * 3) % 6 === 0) continue;
			const col = (row + s) % 4 === 0 ? C.foam : (row + s) % 2 === 0 ? C.waterLit : C.waterMid;
			fillRect(buf, w, h, x, y, t > 0.7 ? 2 : 1, 1, col);
		}
	}

	/* mist / foam bloom where water hits the cloud sea */
	const baseY = yTop + 3 + fallH;
	fillCircle(buf, w, h, cx, baseY, ((lipW * 0.5) | 0), pack(245, 250, 255, 200));
	fillCircle(buf, w, h, cx - 6, baseY + 2, 5, C.cloudLit);
	fillCircle(buf, w, h, cx + 6, baseY + 2, 5, C.cloudLit);
	fillCircle(buf, w, h, cx, baseY + 4, 8, mix(C.cloudMid, C.waterMid, 0.35));
	for (let i = 0; i < 8; i++) {
		const fx = cx - 10 + i * 3;
		const fy = baseY - 1 + (i % 3);
		if ((i + cx) % 3 !== 0) fillRect(buf, w, h, fx, fy, 2, 2, i % 2 ? C.foam : C.waterLit);
	}
}

/**
 * Floating island with grass; optional waterfall cascade.
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} iw
 * @param {number} ih
 * @param {boolean | number} [waterfall] true/false or lip width
 */
function paintIsland(buf, w, h, cx, cy, iw, ih, waterfall = true) {
	const left = cx - ((iw / 2) | 0);
	/* rocky underside */
	for (let row = 0; row < ih; row++) {
		const t = row / ih;
		const shrink = (t * t * (iw * 0.35)) | 0;
		const col = t < 0.35 ? C.rock : C.rockDark;
		fillRect(buf, w, h, left + shrink, cy + row, iw - shrink * 2, 1, col);
	}
	/* grass cap */
	fillRect(buf, w, h, left + 2, cy - 3, iw - 4, 4, C.grassDark);
	fillRect(buf, w, h, left + 3, cy - 5, iw - 6, 3, C.grass);
	for (let i = 0; i < iw; i += 3) {
		if ((i * 7) % 5 === 0) fillRect(buf, w, h, left + 4 + i, cy - 7, 2, 3, C.grassLit);
	}
	if (!waterfall) return;
	const lipW = typeof waterfall === 'number' ? waterfall : Math.max(16, (iw * 0.38) | 0);
	const fallH = 28 + ((ih * 1.6) | 0);
	const wx = cx + ((iw * 0.06) | 0);
	paintWaterfall(buf, w, h, wx, cy + ih - 2, fallH, lipW);
}

/**
 * Distant hazy temple silhouette.
 * @param {Uint32Array} buf
 * @param {number} w
 * @param {number} h
 * @param {number} x
 * @param {number} y
 * @param {number} tw
 * @param {number} th
 */
function paintHazeTemple(buf, w, h, x, y, tw, th) {
	const col = mix(C.haze, C.skySoft, 0.35);
	fillRect(buf, w, h, x, y, tw, th, col);
	const mid = (x + tw / 2) | 0;
	/* apex-up pediment silhouette */
	for (let row = 0; row < 8; row++) {
		const half = Math.max(1, ((((row + 1) / 8) * (tw / 2)) | 0));
		fillRect(buf, w, h, mid - half, y - 8 + row, half * 2, 1, col);
	}
	for (let i = 0; i < 4; i++) {
		fillRect(buf, w, h, x + 4 + i * ((tw - 8) / 4), y + 4, 2, th - 6, mix(col, C.skyMid, 0.25));
	}
}

/**
 * @param {number} w
 * @param {number} h
 * @param {(buf: Uint32Array, w: number, h: number) => void} paint
 * @param {boolean} [transparent]
 */
function bakeLayer(w, h, paint, transparent = false) {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d', { alpha: transparent });
	if (!ctx) return c;
	ctx.imageSmoothingEnabled = false;
	const image = ctx.createImageData(w, h);
	const buf = new Uint32Array(image.data.buffer);
	if (!transparent) {
		for (let i = 0; i < buf.length; i++) buf[i] = C.skyTop;
	}
	paint(buf, w, h);
	ctx.putImageData(image, 0, 0);
	return c;
}

/** Far: sky, moons, stars, distant haze architecture */
function paintFar(buf, w, h) {
	for (let y = 0; y < h; y++) {
		const t = y / (h - 1);
		let col;
		if (t < 0.22) col = mix(C.skyTop, C.skyMid, t / 0.22);
		else if (t < 0.48) col = mix(C.skyMid, C.skySoft, (t - 0.22) / 0.26);
		else if (t < 0.68) col = mix(C.skySoft, C.skyGlow, (t - 0.48) / 0.2);
		else col = mix(C.skyGlow, C.skyHorizon, (t - 0.68) / 0.32);
		const row = y * w;
		const next =
			t < 0.22
				? mix(C.skyTop, C.skyMid, Math.min(1, t / 0.22 + 0.1))
				: t < 0.48
					? mix(C.skyMid, C.skySoft, Math.min(1, (t - 0.22) / 0.26 + 0.1))
					: t < 0.68
						? mix(C.skySoft, C.skyGlow, Math.min(1, (t - 0.48) / 0.2 + 0.1))
						: mix(C.skyGlow, C.skyHorizon, Math.min(1, (t - 0.68) / 0.32 + 0.1));
		for (let x = 0; x < w; x++) {
			buf[row + x] = BAYER8[y & 7][x & 7] > 34 ? next : col;
		}
	}

	/* stars (upper sky only) */
	for (let i = 0; i < 110; i++) {
		const x = 4 + ((i * 67) % (w - 8));
		const y = 4 + ((i * 41) % ((h * 0.42) | 0));
		if ((i * 13) % 6 === 0) continue;
		buf[y * w + x] = C.star;
		if (i % 8 === 0) {
			if (x > 0) buf[y * w + x - 1] = C.star;
			if (y > 0) buf[(y - 1) * w + x] = C.star;
		}
	}

	/* moons — smaller / softer so they don't steal focus from the courier */
	const moons = [
		{ x: 64, y: 36, r: 14 },
		{ x: 198, y: 22, r: 8 },
		{ x: 390, y: 40, r: 11 }
	];
	for (const m of moons) {
		fillCircle(buf, w, h, m.x, m.y, m.r + 2, mix(C.moonShade, C.skyMid, 0.65));
		fillCircle(buf, w, h, m.x, m.y, m.r, mix(C.moonShade, C.skySoft, 0.25));
		fillCircle(buf, w, h, m.x - 1, m.y - 1, Math.max(3, m.r - 4), mix(C.moon, C.skySoft, 0.2));
	}

	/* high sky billows */
	paintCloudBank(buf, w, h, 110, 88, 92, 22, true, 0);
	paintCloudBank(buf, w, h, 290, 72, 84, 26, true, 1);
	paintCloudBank(buf, w, h, 410, 94, 76, 20, false, 2);

	/* distant haze temples */
	paintHazeTemple(buf, w, h, 28, 122, 40, 30);
	paintHazeTemple(buf, w, h, 410, 116, 46, 34);
	paintHazeTemple(buf, w, h, 188, 108, 32, 24);
}

/** Mid: cloud sea, islands, tholos, side temples */
function paintMid(buf, w, h) {
	for (let i = 0; i < buf.length; i++) buf[i] = 0;

	/* cloud sea — soft violet wash below the cloud shelf line */
	const seaY = 198;
	for (let y = seaY; y < h; y++) {
		const t = (y - seaY) / (h - seaY);
		const col =
			t < 0.45
				? mix(C.cloudLavender, C.cloudViolet, t / 0.45)
				: t < 0.8
					? mix(C.cloudViolet, C.cloudDeep, (t - 0.45) / 0.35)
					: mix(C.cloudDeep, C.cloudAbyss, (t - 0.8) / 0.2);
		const row = y * w;
		for (let x = 0; x < w; x++) buf[row + x] = col;
	}

	/* continuous sea-of-clouds — flat shelves with billowing humps */
	paintCloudShelfRow(buf, w, h, 218, 0, w, true);
	paintCloudShelfRow(buf, w, h, 238, 0, w, false);
	paintCloudShelfRow(buf, w, h, 256, 0, w, true);

	/* bridge gaps between side temples and center */
	paintCloudBank(buf, w, h, 168, 196, 100, 26, true, 1);
	paintCloudBank(buf, w, h, 312, 198, 96, 26, true, 3);
	paintCloudBank(buf, w, h, 240, 168, 110, 22, true, 2);
	paintCloud(buf, w, h, 210, 188, 1.35, true, 4);
	paintCloud(buf, w, h, 270, 190, 1.3, false, 1);

	/* upper drifting masses behind architecture */
	paintCloud(buf, w, h, 52, 178, 1.35, true, 0);
	paintCloud(buf, w, h, 145, 186, 1.25, true, 2);
	paintCloud(buf, w, h, 238, 172, 1.5, true, 4);
	paintCloud(buf, w, h, 330, 184, 1.3, false, 1);
	paintCloud(buf, w, h, 420, 176, 1.25, true, 3);

	/* lower sea puffs flanking islands */
	paintCloud(buf, w, h, 88, 248, 1.2, true, 2);
	paintCloud(buf, w, h, 392, 246, 1.2, true, 0);

	/* side Doric temples on floating islands (hexastyle marble facades) */
	paintIsland(buf, w, h, 78, 126, 78, 14, 18);
	paintIsland(buf, w, h, 400, 130, 76, 14, 17);
	paintTemple(buf, w, h, 40, 126, 78, 32, 6, 1, 'grand');
	paintTemple(buf, w, h, 360, 130, 76, 30, 6, 1, 'grand');

	/* tiny attendant shrines — same Greek language, quieter */
	paintIsland(buf, w, h, 168, 200, 44, 10, false);
	paintIsland(buf, w, h, 312, 202, 42, 10, false);
	paintTemple(buf, w, h, 148, 200, 42, 18, 4, 0.85, 'shrine');
	paintTemple(buf, w, h, 290, 202, 40, 17, 4, 0.85, 'shrine');

	/* central pantheon — cascade off to the side so strip stays clear */
	paintIsland(buf, w, h, 240, 164, 110, 18, false);
	paintWaterfall(buf, w, h, 198, 178, 36, 16);
	paintWaterfall(buf, w, h, 282, 180, 34, 15);
	paintTholos(buf, w, h, 240, 164, 32);
}

/** Near: framing colonnades + stair wings (reference foreground) */
function paintNear(buf, w, h) {
	for (let i = 0; i < buf.length; i++) buf[i] = 0;

	const stairBase = 255;
	for (let s = 0; s < 10; s++) {
		const y = stairBase - s * 5;
		const ww = 78 + s * 7;
		fillRect(buf, w, h, 0, y, ww, 5, s % 2 ? C.marbleMid : C.marbleDark);
		fillRect(buf, w, h, 0, y, ww, 1, C.marbleLit);
		fillRect(buf, w, h, w - ww, y, ww, 5, s % 2 ? C.marbleMid : C.marbleDark);
		fillRect(buf, w, h, w - ww, y, ww, 1, C.marbleLit);
	}

	/* massive edge columns */
	paintColumn(buf, w, h, 14, 48, 240, 6);
	paintColumn(buf, w, h, 34, 58, 236, 5);
	paintColumn(buf, w, h, 52, 72, 228, 4);
	paintColumn(buf, w, h, w - 14, 48, 240, 6);
	paintColumn(buf, w, h, w - 34, 58, 236, 5);
	paintColumn(buf, w, h, w - 52, 72, 228, 4);

	/* architrave stubs */
	fillRect(buf, w, h, 0, 52, 62, 5, C.marbleLit);
	fillRect(buf, w, h, 0, 54, 58, 1, C.gold);
	fillRect(buf, w, h, w - 62, 52, 62, 5, C.marbleLit);
	fillRect(buf, w, h, w - 58, 54, 58, 1, C.gold);

	/* balustrade urns */
	fillRect(buf, w, h, 46, 188, 6, 10, C.marbleMid);
	fillRect(buf, w, h, 47, 183, 4, 5, C.goldLit);
	fillRect(buf, w, h, w - 52, 188, 6, 10, C.marbleMid);
	fillRect(buf, w, h, w - 51, 183, 4, 5, C.goldLit);

	/* soft edge vignette */
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < 12; x++) {
			if (BAYER8[y & 7][x & 7] > 18 + x * 4) continue;
			const row = y * w;
			if ((buf[row + x] >>> 24) === 0) buf[row + x] = pack(12, 22, 44, 100);
			if ((buf[row + (w - 1 - x)] >>> 24) === 0) buf[row + (w - 1 - x)] = pack(12, 22, 44, 100);
		}
	}
}

/** Soft mist sprite */
function bakeMistSprite() {
	const sw = 72;
	const sh = 32;
	const c = document.createElement('canvas');
	c.width = sw;
	c.height = sh;
	const ctx = c.getContext('2d');
	if (!ctx) return c;
	ctx.imageSmoothingEnabled = false;
	const image = ctx.createImageData(sw, sh);
	const buf = new Uint32Array(image.data.buffer);
	const lobes = [
		{ x: 18, y: 18, r: 12 },
		{ x: 36, y: 14, r: 14 },
		{ x: 54, y: 18, r: 11 }
	];
	for (const L of lobes) {
		for (let dy = -L.r; dy <= L.r; dy++) {
			for (let dx = -L.r; dx <= L.r; dx++) {
				if (dx * dx + dy * dy > L.r * L.r) continue;
				const xx = L.x + dx;
				const yy = L.y + dy;
				if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
				buf[yy * sw + xx] = pack(240, 244, 255, 120);
			}
		}
	}
	ctx.putImageData(image, 0, 0);
	return c;
}

/**
 * @param {HTMLElement} root
 * @param {{ reduced?: boolean }} [opts]
 */
export function createBoothOlympusBackdrop(root, opts = {}) {
	const reduced = !!opts.reduced;

	let styleEl = document.getElementById('booth-olympus-styles');
	if (!styleEl) {
		styleEl = document.createElement('style');
		styleEl.id = 'booth-olympus-styles';
		document.head.appendChild(styleEl);
	}
	styleEl.textContent = CSS;

	root.classList.add('booth-olympus');
	root.setAttribute('aria-hidden', 'true');
	root.innerHTML = '';

	const farCvs = bakeLayer(PX_W, PX_H, paintFar, false);
	farCvs.className = 'bo-layer bo-far';
	root.appendChild(farCvs);

	const midCvs = bakeLayer(PX_W, PX_H, paintMid, true);
	midCvs.className = 'bo-layer bo-mid';
	root.appendChild(midCvs);

	const nearCvs = bakeLayer(PX_W, PX_H, paintNear, true);
	nearCvs.className = 'bo-layer bo-near';
	root.appendChild(nearCvs);

	const live = document.createElement('canvas');
	live.className = 'bo-layer bo-live';
	live.width = PX_W;
	live.height = PX_H;
	root.appendChild(live);

	const veil = document.createElement('div');
	veil.className = 'bo-veil';
	root.appendChild(veil);

	const scan = document.createElement('div');
	scan.className = 'bo-scan';
	root.appendChild(scan);

	const lctx = live.getContext('2d', { alpha: true, desynchronized: true });
	if (!lctx) {
		return { setPointer() {}, dispose() {} };
	}
	lctx.imageSmoothingEnabled = false;

	const mistSpr = bakeMistSprite();
	const puffs = [
		{ x: -50, y: 200, speed: 5 },
		{ x: 90, y: 215, speed: 3.5 },
		{ x: 240, y: 205, speed: 4.5 },
		{ x: 380, y: 220, speed: 3 },
		{ x: 160, y: 230, speed: 4 }
	];

	/* live waterfall shimmer over baked cascades */
	const falls = [
		{ x: 84, y: 136, h: 40, lip: 20 },
		{ x: 198, y: 178, h: 36, lip: 16 },
		{ x: 282, y: 180, h: 34, lip: 15 },
		{ x: 406, y: 140, h: 38, lip: 18 }
	];

	let mx = 0.5;
	let my = 0.45;
	let raf = 0;
	let last = performance.now();
	let elapsed = 0;
	let tick = 0;

	function applyParallax() {
		const px = (mx - 0.5) * 12;
		const py = (my - 0.5) * 5;
		farCvs.style.transform = `translate3d(${(-px * 0.12).toFixed(2)}px, ${(-py * 0.08).toFixed(2)}px, 0)`;
		midCvs.style.transform = `translate3d(${(-px * 0.32).toFixed(2)}px, ${(-py * 0.22).toFixed(2)}px, 0)`;
		nearCvs.style.transform = `translate3d(${(-px * 0.7).toFixed(2)}px, ${(-py * 0.4).toFixed(2)}px, 0)`;
		live.style.transform = `translate3d(${(-px * 0.38).toFixed(2)}px, ${(-py * 0.26).toFixed(2)}px, 0)`;
	}

	function paintLive() {
		lctx.clearRect(0, 0, PX_W, PX_H);
		const phase = tick % 3;
		for (const f of falls) {
			const half = (f.lip / 2) | 0;
			for (let row = 0; row < f.h; row++) {
				const t = row / f.h;
				let spread = t < 0.7 ? Math.max(3, (f.lip * (1 - t * 0.4)) | 0) : Math.max(5, (f.lip * (0.5 + t * 0.5)) | 0);
				const left = f.x - ((spread / 2) | 0);
				const y = f.y + row;
				/* moving bright strands */
				for (let s = 0; s < 3; s++) {
					const sx = left + 1 + (((s * 5 + row + phase * 2) % Math.max(2, spread - 1)) | 0);
					lctx.fillStyle = s === 1 ? 'rgba(240,252,255,0.55)' : 'rgba(190,230,248,0.35)';
					lctx.fillRect(sx, y, 1, 1);
				}
				if (row > f.h - 4) {
					lctx.fillStyle = 'rgba(250,252,255,0.25)';
					lctx.fillRect(f.x - half - 2 + phase, y, f.lip + 4, 1);
				}
			}
		}
		lctx.globalAlpha = 0.35;
		if (!reduced) {
			for (const p of puffs) {
				const x = ((p.x + elapsed * p.speed) % (PX_W + 90)) - 50;
				lctx.drawImage(mistSpr, x, p.y);
			}
		} else {
			for (const p of puffs) lctx.drawImage(mistSpr, p.x, p.y);
		}
		lctx.globalAlpha = 1;
	}

	let acc = 0;
	function frame(now) {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		elapsed += dt;
		acc += dt;
		if (acc >= 1 / 10) {
			acc = 0;
			tick++;
			paintLive();
		}
		raf = requestAnimationFrame(frame);
	}

	applyParallax();
	paintLive();
	if (!reduced) raf = requestAnimationFrame(frame);

	return {
		/** @param {number} x @param {number} y */
		setPointer(x, y) {
			mx = x;
			my = y;
			applyParallax();
		},
		dispose() {
			cancelAnimationFrame(raf);
			root.innerHTML = '';
			root.classList.remove('booth-olympus');
		}
	};
}
