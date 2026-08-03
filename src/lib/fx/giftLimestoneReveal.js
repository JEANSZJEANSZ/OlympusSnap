/**
 * Gift reveal — limestone Greek stele (solid 3D slab + carved face texture).
 * Strike → crack → split → portrait settle → UI handoff.
 */
import {
	CanvasTexture,
	ExtrudeGeometry,
	Group,
	Mesh,
	LinearFilter,
	LinearMipmapLinearFilter,
	NearestFilter,
	PlaneGeometry,
	Scene,
	Shape,
	SRGBColorSpace,
	TextureLoader,
	Vector2
} from 'three';
import { MeshBasicMaterial, box, disposeScene, makeRenderer, smooth01 } from './pixelShared.js';
import { createRng, deriveSeed, mintMarbleSeed } from './marbleSeed.js';
import {
	AFTERSHOCK_AT,
	fadeBolt,
	lightningFlicker,
	setupGodCrackKit
} from './giftGodCrackFx.js';

/** Low internal res + CSS pixelated upscale = chunky stele look */
const RENDER_PX = 640;
const VIEW_H = 2.25;
/** Booth / landscape — leave sky + mountains visible */
const FIT_FRAC = 0.62;
const FIT_FRAC_NARROW = 0.68;

/** World-space stele dimensions (landscape-ish slab like the reference) */
const PLAQUE_W = 1.92;
const PLAQUE_H = 1.48;
const PLAQUE_D = 0.34;
const PLAQUE_FACE_W = PLAQUE_W * 0.9;
const PLAQUE_FACE_H = PLAQUE_H * 0.82;
const PLAQUE_WORLD_W = PLAQUE_W;
const PLAQUE_WORLD_H = PLAQUE_H;
const PLAQUE_WORLD_D = PLAQUE_D;

const YAW_MAX = 0.14;
const PITCH_MAX = 0.04;
const SPRING = 10;

const CHARGE_DUR = 0.4;
const BOLT_DUR = 0.52;
const IMPACT_DUR = 0.28;
const SHATTER_DUR = 1.05;
const SETTLE_DUR = 0.32;
const EXHALE_DUR = 0.55;
const CANVAS_FADE_DUR = 0.48;

const DEBRIS_HEX = ['#faf8f2', '#f2ede3', '#e8e0d2', '#ddd5c8', '#c9bfb0'];
const SPARK_COLORS = ['#ffffff', '#ffd86a', '#fff4c8', '#f5ead8'];

/**
 * @param {number} aspect
 * @param {number} maxW
 * @param {number} maxH
 */
function containSize(aspect, maxW, maxH) {
	let w = maxW;
	let h = maxW / Math.max(0.05, aspect);
	if (h > maxH) {
		h = maxH;
		w = maxH * aspect;
	}
	return { w, h };
}

/**
 * Seeded chip depths along one edge (random walk + occasional big bites).
 * @param {() => number} rand
 * @param {number} count
 * @param {number} maxChip
 */
function buildEdgeWalk(rand, count, maxChip) {
	/** @type {number[]} */
	const out = new Array(count);
	let v = 0.4 + rand() * maxChip * 0.4;
	for (let i = 0; i < count; i++) {
		v += (rand() - 0.47) * (maxChip * 0.28);
		if (rand() < 0.12) v += maxChip * (0.35 + rand() * 0.55); /* bite */
		if (rand() < 0.08) v *= 0.45; /* flatter stretch */
		const edgeT = count <= 1 ? 0.5 : i / (count - 1);
		const cornerBoost = Math.min(edgeT, 1 - edgeT) < 0.14 ? 1.55 : 1;
		v = Math.max(0.05, Math.min(maxChip * cornerBoost, v));
		out[i] = v;
	}
	return out;
}

/**
 * World-space chipped rectangle outline (CW from top-left).
 * @param {() => number} rand
 * @param {number} [segs]
 */
function buildChippedOutline(rand, segs = 20) {
	const hw = PLAQUE_W / 2;
	const hh = PLAQUE_H / 2;
	const top = buildEdgeWalk(rand, segs + 1, 0.12);
	const right = buildEdgeWalk(rand, segs + 1, 0.1);
	const bottom = buildEdgeWalk(rand, segs + 1, 0.11);
	const left = buildEdgeWalk(rand, segs + 1, 0.1);
	/** @type {Vector2[]} */
	const pts = [];
	for (let i = 0; i <= segs; i++) {
		const t = i / segs;
		pts.push(new Vector2(-hw + t * PLAQUE_W, hh - top[i]));
	}
	for (let i = 1; i <= segs; i++) {
		const t = i / segs;
		pts.push(new Vector2(hw - right[i], hh - t * PLAQUE_H));
	}
	for (let i = 1; i <= segs; i++) {
		const t = i / segs;
		pts.push(new Vector2(hw - t * PLAQUE_W, -hh + bottom[i]));
	}
	for (let i = 1; i < segs; i++) {
		const t = i / segs;
		pts.push(new Vector2(-hw + left[i], -hh + t * PLAQUE_H));
	}
	return pts;
}

/**
 * Seeded jagged crack path from top → bottom (world space).
 * @param {() => number} rand
 * @param {number} [steps]
 */
function buildCrackPath(rand, steps = 28) {
	const hh = PLAQUE_H / 2;
	const maxAmp = PLAQUE_W * 0.055;
	/** @type {Vector2[]} */
	const path = [];
	let x = (rand() - 0.5) * PLAQUE_W * 0.04;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const y = hh - t * PLAQUE_H;
		x += (rand() - 0.5) * maxAmp * 0.85;
		x += -x * 0.12; /* soft pull to center */
		/* occasional hard kink */
		if (rand() < 0.18) x += (rand() < 0.5 ? -1 : 1) * (0.02 + rand() * 0.045);
		x = Math.max(-maxAmp * 1.35, Math.min(maxAmp * 1.35, x));
		path.push(new Vector2(x, y));
	}
	return path;
}

/**
 * Half plaque polygon: jagged fault seam + outer chipped rim (ordered).
 * @param {Vector2[]} outline
 * @param {Vector2[]} crackPath top→bottom
 * @param {'left' | 'right'} side
 */
function splitOutlineAlongCrack(outline, crackPath, side) {
	const keepLeft = side === 'left';
	const crackBot = crackPath[crackPath.length - 1];

	/** @param {Vector2} p */
	const onSide = (p) => {
		const cx = sampleCrackX(crackPath, p.y);
		return keepLeft ? p.x <= cx + 0.004 : p.x >= cx - 0.004;
	};

	let start = 0;
	let best = Infinity;
	for (let i = 0; i < outline.length; i++) {
		if (!onSide(outline[i])) continue;
		const d = outline[i].distanceToSquared(crackBot);
		if (d < best) {
			best = d;
			start = i;
		}
	}

	/** @type {Vector2[]} */
	const rim = [];
	for (let k = 0; k < outline.length; k++) {
		const i = keepLeft
			? (start + k) % outline.length
			: (start - k + outline.length * 4) % outline.length;
		const p = outline[i];
		if (!onSide(p)) {
			if (rim.length > 2) break;
			continue;
		}
		rim.push(p.clone());
	}

	/** @type {Vector2[]} */
	const pts = [];
	if (keepLeft) {
		for (const p of crackPath) pts.push(p.clone());
	} else {
		for (let i = crackPath.length - 1; i >= 0; i--) pts.push(crackPath[i].clone());
	}
	for (const p of rim) pts.push(p);

	if (pts.length < 3) {
		const hw = PLAQUE_W / 2;
		const hh = PLAQUE_H / 2;
		if (keepLeft) {
			return [new Vector2(-hw, hh), new Vector2(0, hh), new Vector2(0, -hh), new Vector2(-hw, -hh)];
		}
		return [new Vector2(0, hh), new Vector2(hw, hh), new Vector2(hw, -hh), new Vector2(0, -hh)];
	}
	return pts;
}

/**
 * @param {Vector2[]} outline
 */
function makeExtrudedPlaque(outline) {
	const shape = new Shape(outline.map((p) => p.clone()));
	const geo = new ExtrudeGeometry(shape, {
		depth: PLAQUE_D,
		bevelEnabled: false,
		curveSegments: 1
	});
	geo.translate(0, 0, -PLAQUE_D / 2);
	return geo;
}

/**
 * World → texture pixel.
 * @param {number} wx
 * @param {number} wy
 * @param {number} texW
 * @param {number} texH
 */
function worldToTex(wx, wy, texW, texH) {
	const u = (wx / PLAQUE_W + 0.5) * texW;
	const v = (0.5 - wy / PLAQUE_H) * texH;
	return { x: u, y: v };
}

/**
 * Abstract ruin marks — wedges, hooks, chevrons (not readable letters).
 * Each entry: array of [x1,y1,x2,y2] segments in unit box -1..1.
 */
const RUIN_MARKS = {
	wedge: [[-0.55, 0.65, 0.5, -0.55]],
	hook: [
		[-0.45, -0.65, -0.45, 0.25],
		[-0.45, 0.25, 0.35, 0.45]
	],
	chevron: [
		[-0.55, 0.35, 0, -0.45],
		[0.55, 0.35, 0, -0.45]
	],
	brokenRing: [
		[-0.45, -0.25, -0.55, 0.15],
		[-0.55, 0.15, -0.15, 0.55],
		[-0.15, 0.55, 0.35, 0.35],
		[0.35, 0.35, 0.5, -0.15]
	],
	doubleBar: [
		[-0.6, -0.15, 0.6, -0.15],
		[-0.6, 0.2, 0.6, 0.2],
		[0.15, -0.15, 0.3, 0.2]
	],
	tripleNotch: [
		[-0.5, 0.45, -0.5, -0.45],
		[-0.5, 0.45, -0.32, 0.28],
		[-0.5, 0, -0.32, -0.12],
		[-0.5, -0.45, -0.32, -0.3]
	],
	nestedAngle: [
		[-0.45, 0.55, -0.45, -0.45],
		[-0.45, -0.45, 0.45, -0.45],
		[-0.3, 0.4, -0.3, -0.3],
		[-0.3, -0.3, 0.3, -0.3]
	],
	zigBar: [
		[-0.55, 0.25, -0.15, -0.35],
		[-0.15, -0.35, 0.15, 0.15],
		[0.15, 0.15, 0.55, -0.25]
	],
	forkStub: [
		[-0.45, -0.55, 0, 0.45],
		[0.45, -0.55, 0, 0.45],
		[0, 0.45, 0, -0.15]
	],
	arcPair: [
		[-0.35, 0.15, 0, 0.5],
		[0, 0.5, 0.35, 0.15],
		[-0.5, -0.1, 0.5, -0.1]
	],
	stepPyramid: [
		[-0.45, 0.45, 0.45, 0.45],
		[-0.3, 0.3, 0.3, 0.3],
		[-0.15, 0.15, 0.15, 0.15]
	],
	crossHatch: [
		[-0.4, -0.4, 0.4, 0.4],
		[-0.4, 0.4, 0.4, -0.4]
	],
	crescent: [
		[-0.5, 0.1, -0.2, 0.45],
		[-0.2, 0.45, 0.25, 0.2],
		[0.25, 0.2, 0.15, -0.35],
		[-0.35, -0.2, -0.5, 0.1]
	],
	throneTick: [
		[-0.55, 0.35, 0.55, 0.35],
		[0, 0.35, 0, -0.45],
		[-0.25, -0.45, 0.25, -0.45]
	],
	spiralStub: [
		[0.4, 0.4, 0.1, 0.45],
		[0.1, 0.45, -0.25, 0.2],
		[-0.25, 0.2, -0.15, -0.25],
		[-0.15, -0.25, 0.2, -0.35]
	]
};

const RUIN_MARK_KEYS = Object.keys(RUIN_MARKS);

/**
 * Procedural limestone face — chipped alpha silhouette + jagged crack + glyphs.
 * @param {() => number} rand
 * @param {Vector2[]} outline
 * @param {Vector2[]} crackPath
 * @param {() => number} [scriptRand]
 * @param {number} [texW]
 * @param {number} [texH]
 */
function makePlaqueFaceTexture(rand, outline, crackPath, scriptRand = rand, texW = 192, texH = 144) {
	const cvs = document.createElement('canvas');
	cvs.width = texW;
	cvs.height = texH;
	const ctx = /** @type {CanvasRenderingContext2D} */ (cvs.getContext('2d'));
	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, texW, texH);

	/* Clip to seeded chipped silhouette */
	ctx.beginPath();
	for (let i = 0; i < outline.length; i++) {
		const { x, y } = worldToTex(outline[i].x, outline[i].y, texW, texH);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.save();
	ctx.clip();

	/* Base cream limestone — stepped bands */
	const bands = ['#f7f3ea', '#f0ebe0', '#efe8dc', '#e8dfd0', '#e4dacd'];
	for (let y = 0; y < texH; y++) {
		ctx.fillStyle = bands[((y * bands.length) / texH) | 0];
		ctx.fillRect(0, y, texW, 1);
	}
	for (let x = 0; x < texW; x += 2) {
		const t = x / texW;
		ctx.fillStyle = `rgba(228,218,205,${t * 0.22})`;
		ctx.fillRect(x, 0, 2, texH);
	}

	/* Chunky grain + pores */
	for (let i = 0; i < 520; i++) {
		const x = (rand() * texW) | 0;
		const y = (rand() * texH) | 0;
		const s = 1 + ((rand() * 2) | 0);
		const a = 0.08 + rand() * 0.16;
		ctx.fillStyle = rand() < 0.5 ? `rgba(170,158,140,${a})` : `rgba(255,252,245,${a * 0.75})`;
		ctx.fillRect(x, y, s, s);
	}

	/* Warm stains */
	for (let i = 0; i < 8; i++) {
		const cx = (rand() * texW) | 0;
		const cy = (texH * (0.7 + rand() * 0.25)) | 0;
		const r = 3 + ((rand() * 7) | 0);
		ctx.fillStyle = `rgba(196,176,148,${0.18 + rand() * 0.14})`;
		for (let dy = -r; dy <= r; dy++) {
			for (let dx = -r; dx <= r; dx++) {
				if (dx * dx + dy * dy > r * r) continue;
				ctx.fillRect(cx + dx, cy + dy, 1, 1);
			}
		}
	}

	/* Inner frame recess */
	const padX = Math.round(texW * 0.1);
	const padY = Math.round(texH * 0.14);
	ctx.fillStyle = 'rgba(120,110,98,0.55)';
	ctx.fillRect(padX, padY, texW - padX * 2, 1);
	ctx.fillRect(padX, texH - padY - 1, texW - padX * 2, 1);
	ctx.fillRect(padX, padY, 1, texH - padY * 2);
	ctx.fillRect(texW - padX - 1, padY, 1, texH - padY * 2);
	ctx.fillStyle = 'rgba(255,255,255,0.28)';
	ctx.fillRect(padX + 2, padY + 2, texW - padX * 2 - 4, 1);
	ctx.fillRect(padX + 2, texH - padY - 3, texW - padX * 2 - 4, 1);
	ctx.fillRect(padX + 2, padY + 2, 1, texH - padY * 2 - 4);
	ctx.fillRect(texW - padX - 3, padY + 2, 1, texH - padY * 2 - 4);

	/* Seeded ruin inscription — abstract marks, not readable letters */
	drawRuinInscription(ctx, scriptRand, crackPath, padX, padY, texW, texH);

	/* Jagged crack — dark seam + highlight lip + micro branches */
	for (let i = 0; i < crackPath.length; i++) {
		const { x, y } = worldToTex(crackPath[i].x, crackPath[i].y, texW, texH);
		const px = (x + 0.5) | 0;
		const py = (y + 0.5) | 0;
		const w = i % 5 === 0 ? 2 : 1;
		ctx.fillStyle = 'rgba(72,66,58,0.92)';
		ctx.fillRect(px, py, w, 1);
		ctx.fillStyle = 'rgba(248,244,236,0.35)';
		ctx.fillRect(px + w, py, 1, 1);
		if (rand() < 0.16) {
			const dir = rand() < 0.5 ? -1 : 1;
			const len = 1 + ((rand() * 3) | 0);
			ctx.fillStyle = 'rgba(72,66,58,0.75)';
			ctx.fillRect(px + dir, py, len, 1);
		}
	}

	ctx.restore();

	/* Edge ruin shading just inside silhouette (reads as worn stone) */
	ctx.save();
	ctx.beginPath();
	for (let i = 0; i < outline.length; i++) {
		const { x, y } = worldToTex(outline[i].x, outline[i].y, texW, texH);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.clip();
	ctx.strokeStyle = 'rgba(150,140,125,0.45)';
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.restore();

	const tex = new CanvasTexture(cvs);
	tex.colorSpace = SRGBColorSpace;
	tex.magFilter = NearestFilter;
	tex.minFilter = NearestFilter;
	tex.generateMipmaps = false;
	tex.anisotropy = 1;
	return tex;
}

/**
 * 3D jagged crack from seeded path (shared material for opacity pulse).
 * @param {Group} parent
 * @param {Vector2[]} crackPath
 * @param {import('three').MeshBasicMaterial} crackMat
 * @param {() => number} rand
 */
function buildJaggedCrack(parent, crackPath, crackMat, rand) {
	const group = new Group();
	group.position.z = PLAQUE_D / 2 + 0.009;
	parent.add(group);
	for (let i = 0; i < crackPath.length - 1; i++) {
		const a = crackPath[i];
		const b = crackPath[i + 1];
		const mx = (a.x + b.x) * 0.5;
		const my = (a.y + b.y) * 0.5;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.max(0.02, Math.hypot(dx, dy) * 1.15);
		const ang = Math.atan2(dy, dx);
		const thick = 0.012 + rand() * 0.014;
		const seg = new Mesh(new PlaneGeometry(len, thick), crackMat);
		seg.position.set(mx, my, (i % 3) * 0.0004);
		seg.rotation.z = ang;
		group.add(seg);
		/* micro chip flakes along the fault */
		if (rand() < 0.35) {
			const s = 0.018 + rand() * 0.03;
			box(group, mx + (rand() - 0.5) * 0.03, my, 0.01, s * 0.5, s, 0.02, crackMat);
		}
	}
	return group;
}

/**
 * Bresenham-ish pixel line.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {string} color
 */
function drawPixelLine(ctx, x0, y0, x1, y1, color) {
	let x = (x0 + 0.5) | 0;
	let y = (y0 + 0.5) | 0;
	const xEnd = (x1 + 0.5) | 0;
	const yEnd = (y1 + 0.5) | 0;
	const dx = Math.abs(xEnd - x);
	const dy = Math.abs(yEnd - y);
	const sx = x < xEnd ? 1 : -1;
	const sy = y < yEnd ? 1 : -1;
	let err = dx - dy;
	ctx.fillStyle = color;
	for (;;) {
		ctx.fillRect(x, y, 1, 1);
		if (x === xEnd && y === yEnd) break;
		const e2 = err * 2;
		if (e2 > -dy) {
			err -= dy;
			x += sx;
		}
		if (e2 < dx) {
			err += dx;
			y += sy;
		}
	}
}

/**
 * Incised ruin mark — dark groove + light lip (carved into stone).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} halfW
 * @param {number} halfH
 * @param {number[][]} strokes
 * @param {number} wear 0..1 (higher = more eroded / faded)
 */
function drawIncisedMark(ctx, cx, cy, halfW, halfH, strokes, wear) {
	const darkA = 0.88 - wear * 0.45;
	const hiA = 0.42 - wear * 0.25;
	const dark = `rgba(70,64,56,${darkA})`;
	const hi = `rgba(250,246,238,${Math.max(0.08, hiA)})`;

	for (const [x1, y1, x2, y2] of strokes) {
		const ax = cx + x1 * halfW;
		const ay = cy + y1 * halfH;
		const bx = cx + x2 * halfW;
		const by = cy + y2 * halfH;
		drawPixelLine(ctx, ax, ay, bx, by, dark);
		/* highlight lip offset toward top-left light */
		drawPixelLine(ctx, ax - 1, ay - 1, bx - 1, by - 1, hi);
	}
}

/**
 * Seeded rows of abstract ruin marks (unique per scripture seed).
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => number} rand
 * @param {Vector2[]} crackPath
 * @param {number} padX
 * @param {number} padY
 * @param {number} texW
 * @param {number} texH
 */
function drawRuinInscription(ctx, rand, crackPath, padX, padY, texW, texH) {
	const rows = 3 + ((rand() * 2) | 0); /* 3–4 lines */
	const innerW = texW - padX * 2;
	const innerH = texH - padY * 2;
	const rowH = innerH / (rows + 0.35);
	const markH = Math.max(6, Math.min(11, (rowH * 0.58) | 0));
	const markW = Math.max(5, (markH * 0.75) | 0);
	const halfH = markH * 0.5;
	const halfW = markW * 0.5;

	for (let row = 0; row < rows; row++) {
		const marksInRow = 4 + ((rand() * 3) | 0); /* 4–6 marks */
		const rowShift = ((rand() - 0.5) * 5) | 0;
		const yJitter = ((rand() - 0.5) * 2) | 0;
		const cy = Math.round(padY + rowH * (row + 0.7) + yJitter);
		const span = Math.min(innerW - 8, marksInRow * (markW + 3));
		const startX = padX + ((innerW - span) / 2 | 0) + rowShift;

		for (let col = 0; col < marksInRow; col++) {
			const cx = Math.round(startX + col * (markW + 3) + halfW + ((rand() - 0.5) * 1.5));
			const wy = (0.5 - cy / texH) * PLAQUE_H;
			const crackTx = worldToTex(sampleCrackX(crackPath, wy), wy, texW, texH).x;
			if (Math.abs(cx - crackTx) < markW * 0.7) continue;

			const key = RUIN_MARK_KEYS[(rand() * RUIN_MARK_KEYS.length) | 0];
			const strokes = RUIN_MARKS[key];
			const wear = Math.min(0.85, row * 0.12 + rand() * 0.35);
			if (rand() < 0.08 + row * 0.04) continue;
			drawIncisedMark(ctx, cx, cy, halfW, halfH, strokes, wear);
		}
	}
}

/**
 * Crack world-x at a given world y (path is top→bottom).
 * @param {Vector2[]} crackPath
 * @param {number} wy
 */
function sampleCrackX(crackPath, wy) {
	for (let i = 0; i < crackPath.length - 1; i++) {
		const a = crackPath[i];
		const b = crackPath[i + 1];
		const minY = Math.min(a.y, b.y);
		const maxY = Math.max(a.y, b.y);
		if (wy < minY - 1e-6 || wy > maxY + 1e-6) continue;
		const dy = b.y - a.y;
		const t = Math.abs(dy) < 1e-6 ? 0 : (wy - a.y) / dy;
		return a.x + (b.x - a.x) * t;
	}
	return crackPath[(crackPath.length / 2) | 0]?.x ?? 0;
}

/**
 * Half face: copy full plaque, clear the other side of the jagged fault.
 * @param {import('three').CanvasTexture} faceTex
 * @param {Vector2[]} crackPath
 * @param {'left' | 'right'} side
 */
function makeHalfFaceTexture(faceTex, crackPath, side) {
	const src = /** @type {HTMLCanvasElement} */ (faceTex.image);
	const texW = src.width;
	const texH = src.height;
	const cvs = document.createElement('canvas');
	cvs.width = texW;
	cvs.height = texH;
	const ctx = /** @type {CanvasRenderingContext2D} */ (cvs.getContext('2d'));
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(src, 0, 0);
	for (let py = 0; py < texH; py++) {
		const wy = (0.5 - (py + 0.5) / texH) * PLAQUE_H;
		const wx = sampleCrackX(crackPath, wy);
		const cx = (worldToTex(wx, wy, texW, texH).x + 0.5) | 0;
		if (side === 'left') ctx.clearRect(cx + 1, py, texW - cx, 1);
		else ctx.clearRect(0, py, Math.max(0, cx), 1);
	}
	const tex = new CanvasTexture(cvs);
	tex.colorSpace = SRGBColorSpace;
	tex.magFilter = NearestFilter;
	tex.minFilter = NearestFilter;
	tex.generateMipmaps = false;
	tex.anisotropy = 1;
	return tex;
}

/**
 * @param {Group} parent
 * @param {'left' | 'right'} side
 * @param {import('three').CanvasTexture} faceTex
 * @param {import('three').MeshBasicMaterial} sideMat
 * @param {Vector2[]} outline
 * @param {Vector2[]} crackPath
 * @param {() => number} rand
 */
function buildPlaqueHalf(parent, side, faceTex, sideMat, outline, crackPath, rand) {
	const g = new Group();
	const halfOutline = splitOutlineAlongCrack(outline, crackPath, side);
	const body = new Mesh(makeExtrudedPlaque(halfOutline), sideMat);
	g.add(body);

	const halfTex = makeHalfFaceTexture(faceTex, crackPath, side);
	const frontMat = new MeshBasicMaterial({
		map: halfTex,
		transparent: true,
		alphaTest: 0.45,
		depthWrite: true
	});
	const front = new Mesh(new PlaneGeometry(PLAQUE_W, PLAQUE_H), frontMat);
	front.position.z = PLAQUE_D / 2 + 0.006;
	g.add(front);

	/* Seam rubble follows the jagged crack */
	const sign = side === 'left' ? -1 : 1;
	for (let i = 0; i < crackPath.length; i += 2) {
		if (rand() > 0.55) continue;
		const p = crackPath[i];
		const s = 0.028 + rand() * 0.045;
		box(
			g,
			p.x + sign * (0.01 + rand() * 0.025),
			p.y + (rand() - 0.5) * 0.02,
			PLAQUE_D * (0.1 + rand() * 0.2),
			s * 0.55,
			s,
			s * 0.65,
			sideMat
		);
	}

	/* Outer ruin chips along the chipped perimeter */
	for (let i = 0; i < halfOutline.length; i += 3) {
		if (rand() > 0.5) continue;
		const p = halfOutline[i];
		if (Math.abs(p.x) < 0.02) continue; /* skip seam */
		const s = 0.03 + rand() * 0.05;
		box(g, p.x, p.y, PLAQUE_D * 0.3, s, s * 0.7, s * 0.5, sideMat);
	}

	parent.add(g);
	return { group: g, halfTex };
}

/**
 * @param {Group} parent
 * @param {import('three').CanvasTexture} faceTex
 * @param {import('three').MeshBasicMaterial} sideMat
 * @param {Vector2[]} outline
 * @param {Vector2[]} crackPath
 * @param {() => number} rand
 */
function buildSolidPlaque(parent, faceTex, sideMat, outline, crackPath, rand) {
	const g = new Group();

	const body = new Mesh(makeExtrudedPlaque(outline), sideMat);
	g.add(body);

	const frontMat = new MeshBasicMaterial({
		map: faceTex,
		transparent: true,
		alphaTest: 0.45,
		depthWrite: true
	});
	const front = new Mesh(new PlaneGeometry(PLAQUE_W, PLAQUE_H), frontMat);
	front.position.z = PLAQUE_D / 2 + 0.006;
	g.add(front);

	/* Perimeter ruin chips — follow silhouette bites */
	for (let i = 0; i < outline.length; i++) {
		if (rand() > 0.42) continue;
		const p = outline[i];
		const s = 0.03 + rand() * 0.055;
		box(g, p.x * 0.98, p.y * 0.98, PLAQUE_D * (0.25 + rand() * 0.25), s, s * 0.65, s * 0.5, sideMat);
	}

	const crackMat = new MeshBasicMaterial({
		color: '#5c554c',
		transparent: true,
		opacity: 0.4,
		depthWrite: false
	});
	buildJaggedCrack(g, crackPath, crackMat, rand);

	parent.add(g);
	return { group: g, crackMat };
}

/**
 * @param {Group} parent
 * @param {() => number} rand
 * @param {import('three').MeshBasicMaterial} chipMat
 */
function buildFloorChips(parent, rand, chipMat) {
	const baseY = -PLAQUE_H / 2 - 0.06;
	for (let i = 0; i < 12; i++) {
		const s = 0.022 + rand() * 0.028;
		box(
			parent,
			(rand() - 0.5) * PLAQUE_W * 1.1,
			baseY + rand() * 0.012,
			(rand() - 0.5) * PLAQUE_D * 0.6,
			s,
			s * 0.4,
			s * 0.55,
			chipMat
		);
	}
}

/**
 * @param {Group} parent
 */
function buildAura(parent) {
	const group = new Group();
	parent.add(group);
	const behindZ = -(PLAQUE_D / 2 + 0.14);
	const mat = new MeshBasicMaterial({
		color: '#ffd86a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const hub = new Group();
	hub.position.z = behindZ;
	for (let i = 0; i < 20; i++) {
		const ang = (i / 20) * Math.PI * 2;
		const m = box(hub, Math.cos(ang) * 1.08, Math.sin(ang) * 0.88, 0, 0.04, 0.032, 0.018, mat);
		m.rotation.z = ang;
	}
	group.add(hub);

	function setOpacity(op) {
		mat.opacity = Math.max(0, Math.min(1, op));
		group.visible = mat.opacity > 0.02;
	}

	function tick(t, intensity = 1) {
		const amp = Math.max(0, intensity);
		if (amp <= 0.01) {
			setOpacity(0);
			return;
		}
		setOpacity(Math.min(1, amp * (0.5 + 0.5 * Math.sin(t * 2.1)) * 0.45));
		hub.scale.setScalar(1 + Math.sin(t * 1.2) * 0.03);
	}

	setOpacity(0);
	return { setOpacity, tick, dispose: () => mat.dispose() };
}

/**
 * @param {Group} parent
 */
function buildShockwave(parent) {
	const g = new Group();
	const mat = new MeshBasicMaterial({
		color: '#ffd86a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	/** @type {Mesh[]} */
	const meshes = [];
	for (let i = 0; i < 20; i++) {
		const ang = (i / 20) * Math.PI * 2;
		meshes.push(box(g, Math.cos(ang), Math.sin(ang) * 0.85, 0.1, 0.06, 0.028, 0.018, mat));
	}
	parent.add(g);
	return { group: g, meshes, mat, life: 0, active: false };
}

/**
 * @param {Group} parent
 * @param {number} count
 * @param {() => number} rand
 * @param {string[]} colors
 */
function buildParticlePool(parent, count, rand, colors) {
	const mats = colors.map(
		(c) => new MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false })
	);
	/** @type {{ active: boolean, life: number, maxLife: number, mesh: Mesh, mat: import('three').MeshBasicMaterial, vx: number, vy: number, vz: number }[]} */
	const pool = [];
	for (let i = 0; i < count; i++) {
		const mat = mats[i % mats.length];
		const mesh = box(parent, 0, 0, 0, 0.035, 0.035, 0.025, mat);
		mesh.visible = false;
		pool.push({ active: false, life: 0, maxLife: 1, mesh, mat, vx: 0, vy: 0, vz: 0 });
	}
	return { pool, mats };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ portraitUrl?: string | null, reduced?: boolean, seed?: number, onPhaseChange?: (p: string) => void, onRevealed?: () => void }} [opts]
 */
export function createGiftLimestoneReveal(canvas, opts = {}) {
	const reduced = !!opts.reduced;
	const onPhaseChange = opts.onPhaseChange || (() => {});
	const onRevealed = opts.onRevealed || (() => {});

	const seed =
		opts.seed != null && Number.isFinite(opts.seed)
			? opts.seed >>> 0
			: mintMarbleSeed(opts.portraitUrl || '');
	const rand = createRng(deriveSeed(seed, 'plaque'));
	const halfRand = createRng(deriveSeed(seed, 'halves'));

	const scene = new Scene();
	/* Transparent clear — CSS sky / mountains / stars must show through */
	const layer = makeRenderer(canvas, RENDER_PX, true, {
		powerPreference: 'high-performance',
		pixelRatio: 1,
		imageRendering: 'pixelated',
		minAspect: 0.05
	});
	const { renderer, camera } = layer;

	const sideMat = new MeshBasicMaterial({ color: '#cfc4b2' });
	const chipMat = new MeshBasicMaterial({ color: '#e8e0d2' });

	/* Unique ruin silhouette + fault + scripture per marble seed */
	const edgeRand = createRng(deriveSeed(seed, 'plaque-edges'));
	const crackRand = createRng(deriveSeed(seed, 'plaque-crack'));
	const scriptureRand = createRng(deriveSeed(seed, 'plaque-scripture'));
	const outline = buildChippedOutline(edgeRand);
	const crackPath = buildCrackPath(crackRand);
	const faceTex = makePlaqueFaceTexture(rand, outline, crackPath, scriptureRand);

	const root = new Group();
	scene.add(root);

	/** God strike FX scaled separately on wide booth screens */
	const godsFx = new Group();
	root.add(godsFx);

	const pivot = new Group();
	root.add(pivot);

	const aura = buildAura(pivot);
	const solid = new Group();
	pivot.add(solid);
	const { crackMat } = buildSolidPlaque(solid, faceTex, sideMat, outline, crackPath, rand);
	buildFloorChips(root, rand, chipMat);

	const leftHalf = new Group();
	const rightHalf = new Group();
	leftHalf.visible = false;
	rightHalf.visible = false;
	const leftBuilt = buildPlaqueHalf(leftHalf, 'left', faceTex, sideMat, outline, crackPath, halfRand);
	const rightBuilt = buildPlaqueHalf(rightHalf, 'right', faceTex, sideMat, outline, crackPath, halfRand);
	pivot.add(leftHalf, rightHalf);

	const portraitMat = new MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	let portraitPlane = new Mesh(new PlaneGeometry(0.9, 1.15), portraitMat);
	portraitPlane.position.z = PLAQUE_D / 2 + 0.012;
	portraitPlane.scale.setScalar(0.22);
	pivot.add(portraitPlane);

	const rimMat = new MeshBasicMaterial({
		color: '#ffd86a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const rimGroup = new Group();
	rimGroup.position.z = PLAQUE_D / 2 + 0.018;
	rimGroup.scale.setScalar(0.22);
	pivot.add(rimGroup);

	/** @param {number} pw @param {number} ph */
	function rebuildRim(pw, ph) {
		while (rimGroup.children.length) {
			const c = /** @type {Mesh} */ (rimGroup.children[0]);
			rimGroup.remove(c);
			c.geometry?.dispose();
		}
		const t = 0.035;
		box(rimGroup, 0, ph / 2 + t / 2, 0, pw + t * 2, t, 0.018, rimMat);
		box(rimGroup, 0, -(ph / 2 + t / 2), 0, pw + t * 2, t, 0.018, rimMat);
		box(rimGroup, -(pw / 2 + t / 2), 0, 0, t, ph, 0.018, rimMat);
		box(rimGroup, pw / 2 + t / 2, 0, 0, t, ph, 0.018, rimMat);
	}
	rebuildRim(0.9, 1.15);

	const flashMat = new MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		opacity: 0,
		depthWrite: false,
		depthTest: false
	});
	const flashQuad = new Mesh(new PlaneGeometry(4, 3), flashMat);
	flashQuad.position.z = 0.65;
	flashQuad.visible = false;
	flashQuad.frustumCulled = false;
	scene.add(flashQuad);

	const floorY = -PLAQUE_H / 2 - 0.06;
	const gods = setupGodCrackKit(godsFx, seed, floorY, { deriveSeed, createRng });
	const {
		allBolts,
		boltMain,
		boltGhost,
		boltSide,
		boltAfter,
		flashGold,
		flashGoldQuad,
		seaSplash,
		hadesEmbers,
		ensureTsunami,
		ensureUnderworld
	} = gods;

	function syncFlashVisibility() {
		flashQuad.visible = flashMat.opacity > 0.02;
		flashGoldQuad.visible = flashGold.opacity > 0.02;
	}

	const shock = buildShockwave(pivot);
	const debris = buildParticlePool(pivot, 28, rand, DEBRIS_HEX);
	const sparks = buildParticlePool(pivot, 18, rand, SPARK_COLORS);

	let phase = reduced ? 'revealed' : 'enter';
	let enterT = 0;
	let crackT = 0;
	let settleT = 0;
	let elapsed = 0;
	let mx = 0.5;
	let my = 0.5;
	let yaw = 0;
	let pitch = 0;
	let shakeAmp = 0;
	let halvesSwapped = false;
	let debrisSpawned = false;
	let revealedCalled = false;
	let portraitPopCap = 1;
	let shatterSepMul = 1;
	let giftPortraitScale = 0.72;
	let canvasFade = 1;
	/** @type {'zeus' | 'poseidon' | 'hades'} */
	let crackGod = 'zeus';
	let aftershockFired = false;
	let timeScale = 1;
	let punch = 1;
	let dutch = 0;
	let fitScale = 1;
	let canvasPhotoMode = false;

	function applyRootScale() {
		root.scale.setScalar(fitScale * punch);
	}

	/** Plaque = pixelated; once the gift photo blooms, bilinear upscale */
	function setCanvasPhotoMode(photoMode) {
		canvasPhotoMode = !!photoMode;
		canvas.style.imageRendering = canvasPhotoMode ? 'auto' : 'pixelated';
	}

	/** Full-viewport flash + cap god FX size on wide booth */
	function resizeOverlays(vw, vh) {
		flashQuad.geometry.dispose();
		flashQuad.geometry = new PlaneGeometry(vw * 1.12, vh * 1.12);
		const fxScale = Math.min(1, 3.5 / Math.max(vw, 2.8));
		godsFx.scale.setScalar(fxScale);
	}

	/** @type {import('three').Texture | null} */
	let portraitTex = null;

	function applyPortraitAspect(tex) {
		const img = /** @type {HTMLImageElement} */ (tex.image);
		const iw = img?.naturalWidth || img?.width || 3;
		const ih = img?.naturalHeight || img?.height || 4;
		const { w, h } = containSize(iw / ih, PLAQUE_FACE_W, PLAQUE_FACE_H);
		portraitPlane.geometry.dispose();
		portraitPlane.geometry = new PlaneGeometry(w, h);
		rebuildRim(w, h);
	}

	if (opts.portraitUrl) {
		portraitTex = new TextureLoader().load(opts.portraitUrl, (tex) => {
			tex.colorSpace = SRGBColorSpace;
			/* Smooth photo — plaque face stays nearest; portrait must not look blocky */
			tex.magFilter = LinearFilter;
			tex.minFilter = LinearMipmapLinearFilter;
			tex.generateMipmaps = true;
			tex.anisotropy = 4;
			tex.needsUpdate = true;
			portraitMat.map = tex;
			portraitMat.needsUpdate = true;
			applyPortraitAspect(tex);
		});
	}

	/**
	 * @param {string} next
	 */
	function setPhase(next) {
		if (phase === next) return;
		phase = next;
		onPhaseChange(next);
		if (next === 'revealed' && !revealedCalled) {
			revealedCalled = true;
			onRevealed();
		}
	}

	function triggerCrack() {
		if (phase !== 'idle' || reduced) return;
		crackGod = gods.pickGod();
		setPhase('crack');
		crackT = 0;
		settleT = 0;
		halvesSwapped = false;
		debrisSpawned = false;
		aftershockFired = false;
		timeScale = 1;
		punch = 1;
		dutch = 0;
		canvasFade = 1;
		shock.active = false;
		shock.mat.opacity = 0;
		portraitMat.opacity = 0;
		rimMat.opacity = 0;
		portraitPlane.scale.setScalar(0.22);
		rimGroup.scale.setScalar(0.22);
		gods.hideAll();
	}

	/**
	 * @param {{ pool: { active: boolean, maxLife: number, life: number, mesh: Mesh, mat: import('three').Material & { opacity: number }, vx: number, vy: number, vz: number }[] }} pool
	 * @param {number} speedMul
	 * @param {number} upward
	 * @param {{ biasX?: number, biasY?: number }} [dir]
	 */
	function spawnBurst(pool, speedMul, upward, dir = {}) {
		const biasX = dir.biasX ?? 0;
		const biasY = dir.biasY ?? 0;
		const r = createRng(deriveSeed(seed, `burst-${(elapsed * 1000) | 0}`));
		for (const d of pool.pool) {
			d.active = true;
			d.maxLife = 0.5 + r() * 0.7;
			d.life = d.maxLife;
			d.mesh.visible = true;
			d.mesh.position.set((r() - 0.5) * 0.15, (r() - 0.5) * 0.14, 0.1 + r() * 0.08);
			const ang = r() * Math.PI * 2;
			const speed = (1 + r() * 2) * speedMul;
			d.vx = Math.cos(ang) * speed * (biasX ? 0.45 : 1) + biasX * speed;
			d.vy = Math.sin(ang) * speed * 0.75 * (biasY ? 0.35 : 1) + upward + biasY * speed * 0.55;
			d.vz = (r() - 0.5) * 0.9 * speedMul;
			d.mat.opacity = 1;
		}
	}

	/**
	 * @param {ReturnType<typeof buildParticlePool>} pool
	 * @param {number} dt
	 * @param {number} gravity
	 */
	function tickPool(pool, dt, gravity) {
		for (const d of pool.pool) {
			if (!d.active) continue;
			d.life -= dt;
			d.vy -= gravity * dt;
			d.mesh.position.x += d.vx * dt;
			d.mesh.position.y += d.vy * dt;
			d.mesh.position.z += d.vz * dt;
			d.mat.opacity = Math.max(0, d.life / d.maxLife);
			if (d.life <= 0) {
				d.active = false;
				d.mesh.visible = false;
			}
		}
	}

	function fireShockwave() {
		shock.active = true;
		shock.life = 0;
		shock.mat.opacity = 0.85;
		shock.group.scale.setScalar(0.12);
	}

	let raf = 0;
	let last = performance.now();

	function tick(now) {
		const rawDt = Math.min(0.05, (now - last) / 1000);
		last = now;
		elapsed += rawDt;
		const dt = rawDt * timeScale;
		const k = 1 - Math.exp(-rawDt * SPRING);

		if (!reduced && phase !== 'revealed' && phase !== 'crack' && phase !== 'settle') {
			const targetYaw = (mx - 0.5) * 2 * YAW_MAX;
			const targetPitch = (0.5 - my) * 2 * PITCH_MAX;
			yaw += (targetYaw - yaw) * k;
			pitch += (targetPitch - pitch) * k;
			pivot.rotation.y = yaw;
			pivot.rotation.x = pitch;
		}

		if (phase === 'enter') {
			enterT = Math.min(1, enterT + rawDt / 0.95);
			const e = smooth01(enterT);
			const scale = e < 0.7 ? 0.05 + smooth01(e / 0.7) * 0.95 : 1;
			pivot.scale.setScalar(scale);
			aura.tick(elapsed, smooth01(Math.min(1, Math.max(0, (enterT - 0.15) / 0.5))));
			if (enterT >= 1) {
				pivot.scale.setScalar(1);
				setPhase('idle');
			}
		}

		if (phase === 'idle') {
			pivot.position.y = Math.sin(elapsed * 0.8) * 0.01;
			pivot.scale.setScalar(1 + Math.sin(elapsed * 0.95) * 0.008);
			crackMat.opacity = 0.28 + (0.5 + 0.5 * Math.sin(elapsed * 2.4)) * 0.18;
			aura.tick(elapsed, 1);
		}

		if (phase === 'crack') {
			crackT += dt;
			const t1 = CHARGE_DUR;
			const t2 = t1 + BOLT_DUR;
			const t3 = t2 + IMPACT_DUR;
			const t4 = t3 + SHATTER_DUR;
			const t5 = t4 + EXHALE_DUR;
			const tsunami = gods.tsunami;
			const underworld = gods.underworld;

			/* 1. Charge — storm builds */
			if (crackT < t1) {
				const p = crackT / CHARGE_DUR;
				if (crackGod === 'poseidon') {
					/* Storm gathers — dark sea + wind before the wall arrives */
					flashMat.color.set('#020d1c');
					flashGold.color.set('#1a6bb5');
					flashMat.opacity = 0.5 * smooth01(p);
					flashGold.opacity = 0.22 * p;
					ensureTsunami().setProgress(0.04 + 0.14 * p, 0.4 + p * 0.45);
					pivot.position.x = (Math.random() - 0.5) * 0.05 * p;
					camera.position.x += (Math.random() - 0.5) * 0.012 * p;
				} else if (crackGod === 'hades') {
					flashMat.color.set('#0a040c');
					flashGold.color.set('#5b1d8a');
					flashMat.opacity = 0.55 * smooth01(p);
					flashGold.opacity = 0.2 * p;
					ensureUnderworld().setProgress(0.2 * p, 0.45 + p * 0.35);
				} else {
					flashMat.color.set('#040c1c');
					flashGold.color.set('#ff9a3c');
					flashMat.opacity = 0.45 * smooth01(p);
					flashGold.opacity = 0.12 * p;
				}
				crackMat.opacity = 0.35 + p * 0.45;
				pivot.position.x = (Math.random() - 0.5) * 0.04 * p;
				pivot.position.y = (Math.random() - 0.5) * 0.035 * p;
				shakeAmp = 0.02 * p;
				aura.tick(elapsed, 1 + p * 0.35);
			}

			/* 2. God attack — Zeus bolt / Poseidon tsunami / Hades rupture */
			if (crackT >= t1 && crackT < t2) {
				const bt = (crackT - t1) / BOLT_DUR;

				if (crackGod === 'zeus') {
					const op = lightningFlicker(bt);
					boltMain.setOpacity(op);
					boltGhost.setOpacity(op * 0.4, op * 0.25, op * 0.2);
					boltGhost.group.position.x = 0.05 + Math.sin(bt * 40) * 0.01;
					if (bt > 0.15) {
						boltSide.setOpacity(op * 0.75, op * 0.4, op * 0.3);
					}
					flashMat.color.set('#ffffff');
					flashGold.color.set('#ff9a3c');
					flashMat.opacity = Math.max(flashMat.opacity, op * 0.55);
					flashGold.opacity = Math.max(flashGold.opacity, op * 0.25);
					if (Math.random() < 0.35) {
						flashMat.opacity = Math.min(0.85, op * 0.9);
					}
					shakeAmp = 0.04 + op * 0.06;
				} else if (crackGod === 'poseidon') {
					/* Wrath surge — wall curls over, wind screams, crest crashes */
					const surge = smooth01(bt);
					const crest = bt > 0.55 ? lightningFlicker((bt - 0.55) / 0.45) : 0;
					const crash = bt > 0.78 ? lightningFlicker((bt - 0.78) / 0.22) : 0;
					ensureTsunami().setProgress(0.18 + surge * 0.82, 0.85 + crest * 0.1 + crash * 0.1);
					flashMat.color.set(bt > 0.78 ? '#e8f7ff' : bt > 0.55 ? '#0a4a7a' : '#031a33');
					flashGold.color.set(bt > 0.78 ? '#e8f7ff' : '#2ec4ff');
					flashMat.opacity = 0.32 + surge * 0.35 + crest * 0.35 + crash * 0.4;
					flashGold.opacity = 0.2 + surge * 0.3 + crest * 0.35 + crash * 0.35;
					shakeAmp = 0.045 + surge * 0.06 + crest * 0.07 + crash * 0.1;
					pivot.position.x = -0.02 * surge + (Math.random() - 0.5) * 0.07 * surge;
					pivot.position.y = (Math.random() - 0.5) * 0.04 * crest;
					if (bt > 0.5) camera.position.x += (Math.random() - 0.5) * 0.025;
					if (bt > 0.75) camera.position.y += (Math.random() - 0.5) * 0.02;
				} else {
					const rise = smooth01(bt);
					const bloom = bt > 0.6 ? lightningFlicker((bt - 0.6) / 0.4) : 0;
					ensureUnderworld().setProgress(0.2 + rise * 0.8, 0.75 + bloom * 0.25);
					flashMat.color.set(bt > 0.55 ? '#1a0a14' : '#120818');
					flashGold.color.set('#ff5a1f');
					flashMat.opacity = 0.45 + rise * 0.35 + bloom * 0.45;
					flashGold.opacity = 0.22 + rise * 0.38 + bloom * 0.45;
					shakeAmp = 0.045 + rise * 0.06 + bloom * 0.08;
					pivot.position.y = (Math.random() - 0.5) * 0.05 * rise;
					camera.position.y += (Math.random() - 0.5) * 0.015 * rise;
				}

				crackMat.opacity = 0.95;
				aura.tick(elapsed, 1.15);
			}

			/* 3. Impact — flash + shockwave + debris */
			if (crackT >= t2 && crackT < t3) {
				const ip = (crackT - t2) / IMPACT_DUR;
				if (crackGod === 'poseidon') {
					flashMat.color.set(ip < 0.35 ? '#e8f7ff' : '#2ec4ff');
					flashGold.color.set('#7ad7ff');
				} else if (crackGod === 'hades') {
					flashMat.color.set(ip < 0.35 ? '#1a0a14' : '#5b1d8a');
					flashGold.color.set('#ff5a1f');
				} else {
					flashMat.color.set(ip < 0.35 ? '#ffffff' : '#ffd86a');
					flashGold.color.set('#ff9a3c');
				}
				flashMat.opacity = 0.95 * (1 - ip);
				flashGold.opacity = 0.55 * (1 - ip);
				shakeAmp = 0.12 * (1 - ip);
				punch = 1 + Math.sin(ip * Math.PI) * 0.14;
				dutch = (Math.random() - 0.5) * 0.08 * (1 - ip);
				applyRootScale();
				root.rotation.z = dutch;

				if (!halvesSwapped) {
					solid.visible = false;
					leftHalf.visible = true;
					rightHalf.visible = true;
					halvesSwapped = true;
					crackMat.opacity = 0;
					aura.setOpacity(0);
				}
				if (!debrisSpawned) {
					spawnBurst(debris, 1.35, 1.1);
					spawnBurst(sparks, 1.8, 1.6);
					if (crackGod === 'poseidon') {
						/* Foam crash + wind blast — not a gentle splash */
						spawnBurst(seaSplash, 2.35, 1.25, { biasX: 1.45, biasY: 0.35 });
						spawnBurst(sparks, 1.3, 0.8, { biasX: 0.9 });
					}
					if (crackGod === 'hades') {
						spawnBurst(hadesEmbers, 1.55, 2.0, { biasY: 1.1 });
					}
					fireShockwave();
					debrisSpawned = true;
					timeScale = 0.42;
				}

				const burn = Math.max(0, 0.85 * (1 - ip));
				if (crackGod === 'zeus') {
					boltMain.setOpacity(burn);
					boltGhost.setOpacity(burn * 0.3);
					boltSide.setOpacity(burn * 0.4);
				} else if (crackGod === 'poseidon') {
					ensureTsunami().setProgress(0.95 + ip * 0.05, burn);
				} else {
					ensureUnderworld().setProgress(1, burn);
				}
			} else if (crackT >= t3) {
				punch += (1 - punch) * Math.min(1, rawDt * 6);
				dutch += (0 - dutch) * Math.min(1, rawDt * 5);
				applyRootScale();
				root.rotation.z = dutch;
				aura.setOpacity(0);
				timeScale += (1 - timeScale) * Math.min(1, rawDt * 2.2);
			}

			if (shock.active) {
				shock.life += rawDt;
				const sp = Math.min(1, shock.life / 0.55);
				const rad = 0.12 + smooth01(sp) * 1.35;
				shock.group.scale.setScalar(rad);
				shock.mat.opacity = 0.9 * (1 - sp);
				for (let i = 0; i < shock.meshes.length; i++) {
					const ang = (i / shock.meshes.length) * Math.PI * 2;
					shock.meshes[i].position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.85, 0.08);
				}
				if (sp >= 1) {
					shock.active = false;
					shock.mat.opacity = 0;
				}
			}

			/* 4. Shatter — tumble + portrait bloom + aftershock */
			if (crackT >= t3 && crackT < t4) {
				if (crackT - t3 < dt * 2) {
					tsunami?.hide();
					underworld?.hide();
					setCanvasPhotoMode(true);
				}
				const splitP = (crackT - t3) / SHATTER_DUR;
				const e = smooth01(splitP);
				const sep = e * 1.05 * shatterSepMul;
				leftHalf.position.set(-sep, -e * 0.22 - e * e * 0.28, e * 0.08);
				rightHalf.position.set(sep, -e * 0.18 - e * e * 0.3, -e * 0.06);
				leftHalf.rotation.set(e * 0.22, e * 0.08, e * 0.35);
				rightHalf.rotation.set(-e * 0.2, -e * 0.1, -e * 0.32);

				const popOp = smooth01(Math.min(1, e * 1.3));
				portraitMat.opacity = popOp;
				rimMat.opacity = popOp * 0.85;
				let popScale;
				if (splitP < 0.78) {
					const t = smooth01(splitP / 0.78);
					popScale = 0.22 + t * (portraitPopCap - 0.22);
				} else {
					const t = smooth01((splitP - 0.78) / 0.22);
					popScale = portraitPopCap + t * (giftPortraitScale - portraitPopCap);
				}
				portraitPlane.scale.setScalar(popScale);
				rimGroup.scale.setScalar(popScale);

				if (!aftershockFired && splitP >= AFTERSHOCK_AT) {
					aftershockFired = true;
					spawnBurst(sparks, 1.4, 0.9);
					spawnBurst(debris, 0.7, 0.5);
					if (crackGod === 'poseidon') {
						spawnBurst(seaSplash, 1.75, 0.95, { biasX: 1.25, biasY: 0.25 });
						ensureTsunami().setProgress(1, 0.45);
					}
					if (crackGod === 'hades') {
						spawnBurst(hadesEmbers, 1.25, 1.8, { biasY: 0.95 });
						ensureUnderworld().setProgress(1, 0.4);
					}
					fireShockwave();
					shakeAmp = 0.09;
					if (crackGod === 'poseidon') {
						flashMat.color.set('#e8f7ff');
						flashGold.color.set('#2ec4ff');
					} else if (crackGod === 'hades') {
						flashMat.color.set('#1a0a14');
						flashGold.color.set('#ff5a1f');
					} else {
						flashMat.color.set('#ffffff');
						flashGold.color.set('#ff9a3c');
					}
					flashMat.opacity = 0.55;
				}
				if (aftershockFired && splitP < AFTERSHOCK_AT + 0.28) {
					const at = (splitP - AFTERSHOCK_AT) / 0.28;
					const op = lightningFlicker(at) * 0.9;
					if (crackGod === 'zeus') {
						boltAfter.setOpacity(op);
					} else if (crackGod === 'poseidon' && tsunami) {
						tsunami.setProgress(1, op * 0.4);
					} else if (underworld) {
						underworld.setProgress(1, op * 0.5);
					}
				} else if (aftershockFired) {
					if (crackGod === 'zeus') fadeBolt(boltAfter, 5, dt);
					else if (crackGod === 'poseidon' && tsunami) {
						tsunami.setProgress(1, Math.max(0, tsunami.mats[1].opacity - 5 * dt));
					} else if (underworld) {
						underworld.setProgress(1, Math.max(0, underworld.mats[2].opacity - 5 * dt));
					}
				}

				flashMat.opacity = Math.max(0, flashMat.opacity - rawDt * 1.8);
				flashGold.opacity = Math.max(0, flashGold.opacity - rawDt * 2);
				fadeBolt(boltMain, 3, dt);
				fadeBolt(boltGhost, 4, dt);
				fadeBolt(boltSide, 4, dt);
			}

			/* 5. Exhale — chunks leave frame, hand off to settle */
			if (crackT >= t4) {
				const ep = Math.min(1, (crackT - t4) / EXHALE_DUR);
				const fade = smooth01(ep);
				leftHalf.position.x = -0.95 * shatterSepMul - fade * 0.85;
				rightHalf.position.x = 0.95 * shatterSepMul + fade * 0.85;
				leftHalf.position.y = -0.45 - fade * 0.75;
				rightHalf.position.y = -0.42 - fade * 0.8;
				portraitPlane.scale.setScalar(giftPortraitScale);
				rimGroup.scale.setScalar(giftPortraitScale);
				portraitMat.opacity = 1;
				rimMat.opacity = 0.75;
				flashMat.opacity = 0;
				flashGold.opacity = 0;
				tsunami?.hide();
				underworld?.hide();
				for (const b of allBolts) b.hide();

				if (crackT >= t5) {
					setPhase('settle');
					settleT = 0;
				}
			}

			tickPool(debris, dt, 3.4);
			tickPool(sparks, dt, 1.8);
			if (crackGod === 'poseidon') tickPool(seaSplash, dt, 2.6);
			if (crackGod === 'hades') tickPool(hadesEmbers, dt, 2.2);
		}

		if (phase === 'settle') {
			settleT += rawDt;
			setCanvasPhotoMode(true);
			gods.hideAll();
			portraitPlane.scale.setScalar(giftPortraitScale);
			rimGroup.scale.setScalar(giftPortraitScale);
			canvasFade = 1 - smooth01(Math.min(1, settleT / CANVAS_FADE_DUR));
			canvas.style.opacity = String(canvasFade);
			leftHalf.visible = canvasFade > 0.15;
			rightHalf.visible = canvasFade > 0.15;
			if (settleT >= SETTLE_DUR) setPhase('revealed');
		}

		if (phase === 'revealed') {
			flashMat.opacity = 0;
			flashGold.opacity = 0;
			flashQuad.visible = false;
			flashGoldQuad.visible = false;
			gods.hideAll();
			aura.setOpacity(0);
			shock.mat.opacity = 0;
			canvas.style.opacity = '0';
			leftHalf.visible = false;
			rightHalf.visible = false;
		}

		if (shakeAmp > 0.001) {
			camera.position.x = (Math.random() - 0.5) * shakeAmp * 2;
			camera.position.y = (Math.random() - 0.5) * shakeAmp * 2;
			shakeAmp *= 0.88;
		} else {
			camera.position.set(0, 0, 10);
		}

		/* Never leave flash planes in the scene when idle — edge shows as a box */
		syncFlashVisibility();

		renderer.render(scene, camera);
		raf = requestAnimationFrame(tick);
	}

	const onResize = () => {
		const metrics = layer.resize(VIEW_H);
		/* makeRenderer resets imageRendering — restore photo mode if active */
		setCanvasPhotoMode(canvasPhotoMode);
		if (!metrics) return;

		const { aspect, viewH: vh, viewW: vw } = metrics;
		const narrow = aspect < 0.72;
		const fit = narrow ? FIT_FRAC_NARROW : FIT_FRAC;
		const scaleH = (vh * fit) / PLAQUE_WORLD_H;
		const scaleW = (vw * fit) / PLAQUE_WORLD_W;
		fitScale = Math.min(scaleH, scaleW);
		applyRootScale();
		resizeOverlays(vw, vh);
		root.position.y = narrow ? 0.01 : 0.05;

		portraitPopCap = narrow ? 0.78 : 0.92;
		shatterSepMul = narrow ? 0.78 : 1;
		giftPortraitScale = narrow ? 0.72 : 0.88;
	};

	onResize();
	window.addEventListener('resize', onResize);

	const resizeParent = canvas.parentElement;
	/** @type {ResizeObserver | null} */
	let resizeObserver = null;
	if (typeof ResizeObserver !== 'undefined' && resizeParent) {
		let queued = false;
		resizeObserver = new ResizeObserver(() => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => {
				queued = false;
				onResize();
			});
		});
		resizeObserver.observe(resizeParent);
	}

	function onPointerMove(e) {
		const rect = canvas.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return;
		mx = (e.clientX - rect.left) / rect.width;
		my = (e.clientY - rect.top) / rect.height;
	}

	function onPointerDown(e) {
		if (e.button != null && e.button !== 0) return;
		e.preventDefault();
		onPointerMove(e);
		triggerCrack();
	}

	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerdown', onPointerDown);

	if (reduced) {
		setPhase('revealed');
	} else {
		onPhaseChange('enter');
		raf = requestAnimationFrame(tick);
	}

	function dispose() {
		cancelAnimationFrame(raf);
		window.removeEventListener('resize', onResize);
		resizeObserver?.disconnect();
		canvas.removeEventListener('pointermove', onPointerMove);
		canvas.removeEventListener('pointerdown', onPointerDown);
		if (portraitTex) portraitTex.dispose();
		faceTex.dispose();
		leftBuilt.halfTex.dispose();
		rightBuilt.halfTex.dispose();
		sideMat.dispose();
		chipMat.dispose();
		aura.dispose?.();
		disposeScene(scene);
		renderer.dispose();
	}

	return {
		seed,
		resize: onResize,
		triggerCrack,
		dispose,
		destroy: dispose
	};
}

/** @deprecated Use createGiftLimestoneReveal */
export const createGiftMarbleReveal = createGiftLimestoneReveal;
