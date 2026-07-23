/**
 * Gift page — Hybrid God-Mode Zeus marble crack (Michael Bay / booth peak).
 * Real composited portrait at native aspect. Voxel storm + shockwave + aftershock.
 */
import {
	BoxGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	PlaneGeometry,
	Quaternion,
	Scene,
	SRGBColorSpace,
	TextureLoader,
	Vector3
} from 'three';
import { MeshBasicMaterial, box, disposeScene, makeRenderer, smooth01 } from './pixelShared.js';
import {
	createRng,
	deriveSeed,
	makeRockShape,
	resolveMarbleSeed
} from './marbleSeed.js';

/** Match / beat Landing temple hero sharpness (HERO_PX=1100) */
const MARBLE_PX = 1500;
const YAW_MAX = 0.18;
const PITCH_MAX = 0.055;
const SPRING = 10;

/* Bigger boulder volume */
const MARBLE_W = 22;
const MARBLE_H = 28;
const MARBLE_D = 14;
const VOX = 0.078;
const VOX_SIZE = VOX * 1.05;
/** Ortho vertical span — keep in sync with layer.resize() */
const VIEW_H = 2.25;
/** Fill most of the viewport, leave margin for chrome + hint */
const FIT_FRAC = 0.9;
/** Rock grid height + rubble pad — used to fit inside VIEW_H */
const ROCK_WORLD_H = MARBLE_H * VOX + 0.12;
const ROCK_SCENE_SCALE = (VIEW_H * FIT_FRAC) / ROCK_WORLD_H;
/** Nudge up so base clears the STRIKE hint */
const ROCK_Y_BIAS = 0.08;

/* Bayhem timeline */
const CHARGE_DUR = 0.4;
const BOLT_DUR = 0.52;
const IMPACT_DUR = 0.28;
const SHATTER_DUR = 1.15;
const EXHALE_DUR = 0.65;
const AFTERSHOCK_AT = 0.35; /* into shatter */

/* Classic Carrara cream — soft body + grey veins (not camo noise) */
const MAT_WHITE = 0;
const MAT_CREAM = 1;
const MAT_WARM = 2;
const MAT_VEIN = 3;
const MAT_VEIN_DK = 4;
const MAT_EDGE = 5;
const MAT_SHADE = 6;
const MARBLE_HEX = [
	'#faf8f5', /* white highlight */
	'#f3eee6', /* cream body */
	'#e8e0d4', /* warm body */
	'#b5b0a6', /* soft grey vein */
	'#8a857c', /* vein core */
	'#cfc7bb', /* edge / side */
	'#9e968a' /* bottom shade */
];

const SPARK_COLORS = ['#ffffff', '#ffd86a', '#fff4c8', '#dce8ff', '#ff9a3c'];
const DEBRIS_HEX = ['#faf8f5', '#f3eee6', '#e8e0d4', '#cfc7bb', '#b5b0a6'];

const MARBLE_FACE_W = MARBLE_W * VOX * 0.9;
const MARBLE_FACE_H = MARBLE_H * VOX * 0.9;

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _quat = new Quaternion();
const _scl = new Vector3();

/**
 * Contain size inside max box, preserve aspect.
 * @param {number} aspect w/h
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
 * Flowing marble vein field (coherent streaks, not speckles).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} cols
 * @param {number} rows
 * @param {number} depth
 */
function veinField(x, y, z, cols, rows, depth) {
	const u = x / Math.max(1, cols - 1);
	const v = y / Math.max(1, rows - 1);
	const w = z / Math.max(1, depth - 1);
	/* Diagonal + wavy streaks like Carrara */
	const a = Math.sin(u * 8.5 + v * 2.8 + Math.sin(v * 6.2) * 1.4);
	const b = Math.sin(u * 3.2 - v * 11.5 + w * 2.0 + 0.8);
	const c = Math.cos((u * 0.65 + v) * 13.0 + Math.sin(u * 4.5) * 2.2);
	return Math.abs(a * 0.5 + b * 0.32 + c * 0.18);
}

/**
 * Soft body shade — gentle bands, not random camo.
 * @param {number} x
 * @param {number} y
 */
function bodyField(x, y) {
	return 0.5 + 0.5 * Math.sin(x * 0.35 + y * 0.12) * Math.cos(y * 0.22 - x * 0.08);
}

/**
 * Irregular boulder radius in the XY plane (polar wobble) — shape is seed-driven.
 * @param {number} angle
 * @param {ReturnType<typeof makeRockShape>} shape
 */
function rockRadius(angle, shape) {
	return (
		shape.baseR +
		shape.amp2 * Math.sin(angle * 2.0 + shape.phase2) +
		shape.amp3 * Math.sin(angle * 3.0 + shape.phase3) +
		shape.amp5 * Math.cos(angle * 5.0 + shape.phase5) +
		shape.amp7 * Math.sin(angle * 7.0 + shape.phase7)
	);
}

/**
 * Is this cell inside the carved rock mass? (not a perfect cube)
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} cols
 * @param {number} rows
 * @param {number} depth
 * @param {ReturnType<typeof makeRockShape>} shape
 */
function inRock(x, y, z, cols, rows, depth, shape) {
	const cx = (cols - 1) / 2 + shape.leanX * cols * 0.5;
	const cy = (rows - 1) / 2;
	const cz = (depth - 1) / 2 + shape.leanZ * depth * 0.5;
	const tall = 0.45 + shape.tallness * 0.95;
	const nx = ((x - cx) / (cols * 0.5)) / Math.max(0.35, shape.widthX);
	const ny = ((y - cy) / (rows * 0.5)) / tall;
	const nz = ((z - cz) / (depth * 0.5)) / Math.max(0.35, shape.depthZ);
	const ang = Math.atan2(ny, nx);
	const r = Math.hypot(nx, ny);
	const heightTaper = 1 - shape.taper + shape.taper * (1 - y / Math.max(1, rows - 1));
	/* depthZ already scales nz — tighten slabs / open boulders further */
	const depthLimit =
		(0.55 + 0.35 * Math.min(1.4, shape.depthZ)) *
		(0.85 +
			0.12 * Math.sin(x * 0.55 + y * 0.35 + shape.phase2) +
			0.08 * Math.cos(y * 0.9 + shape.phase3));
	const bite =
		shape.bite * Math.sin(x * 1.9 + y * 2.4 + z * 1.3 + shape.phase5) +
		shape.bite * 0.7 * Math.cos(x * 3.1 - z * 2.0 + shape.phase7);
	let rMax = rockRadius(ang, shape) * heightTaper + bite;

	/* Secondary lobe — makes some seeds look like fused stones */
	if (shape.lobe) {
		const ly = (shape.lobeY - 0.5) * 2;
		const lx = Math.cos(shape.lobeAng) * shape.lobeR;
		const lz = Math.sin(shape.lobeAng) * shape.lobeR * 0.6;
		const dx = nx - lx;
		const dy = ny - ly;
		const dz = nz - lz;
		const lobeDist = Math.hypot(dx, dy) + Math.abs(dz) * 0.5;
		if (lobeDist < shape.lobeR * (0.9 + heightTaper * 0.3)) return true;
	}

	if (r > rMax) return false;
	if (Math.abs(nz) > depthLimit) return false;
	if (y > rows * shape.crown) {
		const crownCut = 0.4 + 0.45 * Math.sin(x * 0.9 + z * 1.2 + shape.phase3);
		if (r > rMax * crownCut) return false;
	}
	if (r > rMax * 0.75 && Math.sin(x * 4.7 + y * 3.3 + z * 2.1 + shape.phase2) > shape.chip) {
		return false;
	}
	return true;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function cellKey(x, y, z) {
	return `${x},${y},${z}`;
}

/**
 * Cream marble + form shading for an irregular rock (surface vs core).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} cols
 * @param {number} rows
 * @param {number} depth
 * @param {Set<string>} rockSet
 */
function pickMarbleMat(x, y, z, cols, rows, depth, rockSet) {
	const neighbors = [
		[1, 0, 0],
		[-1, 0, 0],
		[0, 1, 0],
		[0, -1, 0],
		[0, 0, 1],
		[0, 0, -1]
	];
	let exposed = 0;
	let exposedDown = false;
	let exposedUp = false;
	let exposedFront = false;
	for (const [dx, dy, dz] of neighbors) {
		if (!rockSet.has(cellKey(x + dx, y + dy, z + dz))) {
			exposed++;
			if (dy === -1) exposedDown = true;
			if (dy === 1) exposedUp = true;
			if (dz === 1) exposedFront = true;
		}
	}
	const onSurface = exposed > 0;

	if (exposedDown && exposed >= 2) return MAT_SHADE;
	if (onSurface && !exposedFront && !exposedUp) return MAT_EDGE;

	const veins = veinField(x, y, z, cols, rows, depth);
	if (onSurface && veins > 0.76) return MAT_VEIN_DK;
	if (onSurface && veins > 0.62) return MAT_VEIN;

	const body = bodyField(x + z * 0.3, y);
	if (exposedUp) return MAT_WHITE;
	if (exposedFront || onSurface) {
		if (body > 0.62) return MAT_WHITE;
		if (body > 0.38) return MAT_CREAM;
		return MAT_WARM;
	}
	return MAT_CREAM;
}

/**
 * Irregular marble boulder — chunky rock silhouette, not a perfect cube.
 * @param {Group} parent
 * @param {number} cols
 * @param {number} rows
 * @param {number} depth
 * @param {() => number} rand
 * @param {(x: number, y: number, z: number) => boolean} [filter]
 * @param {import('three').MeshBasicMaterial[]} mats
 * @param {ReturnType<typeof makeRockShape>} shape
 */
function buildVoxelMarble(parent, cols, rows, depth, rand, filter, mats, shape) {
	const ox = ((cols - 1) * VOX) / 2;
	const oy = ((rows - 1) * VOX) / 2;
	const oz = ((depth - 1) * VOX) / 2;

	/** @type {Set<string>} */
	const rockSet = new Set();
	/** @type {{ x: number, y: number, z: number }[]} */
	const cells = [];

	for (let z = 0; z < depth; z++) {
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				if (!inRock(x, y, z, cols, rows, depth, shape)) continue;
				if (filter && !filter(x, y, z)) continue;
				rockSet.add(cellKey(x, y, z));
				cells.push({ x, y, z });
			}
		}
	}

	/** @type {{ x: number, y: number, z: number, s: number }[][]} */
	const buckets = mats.map(() => []);

	for (const c of cells) {
		const mi = pickMarbleMat(c.x, c.y, c.z, cols, rows, depth, rockSet);
		const s = 0.92 + rand() * 0.22;
		buckets[mi].push({
			x: c.x * VOX - ox + (rand() - 0.5) * VOX * 0.08,
			y: c.y * VOX - oy + (rand() - 0.5) * VOX * 0.06,
			z: c.z * VOX - oz + (rand() - 0.5) * VOX * 0.08,
			s
		});
	}

	/** @type {InstancedMesh[]} */
	const meshes = [];
	for (let mi = 0; mi < mats.length; mi++) {
		const list = buckets[mi];
		if (!list.length) continue;
		const geo = new BoxGeometry(VOX_SIZE, VOX_SIZE, VOX_SIZE);
		const inst = new InstancedMesh(geo, mats[mi], list.length);
		for (let i = 0; i < list.length; i++) {
			const p = list[i];
			_pos.set(p.x, p.y, p.z);
			_scl.set(p.s, p.s, p.s);
			_mat4.compose(_pos, _quat, _scl);
			inst.setMatrixAt(i, _mat4);
		}
		inst.instanceMatrix.needsUpdate = true;
		parent.add(inst);
		meshes.push(inst);
	}
	return meshes;
}

/**
 * @param {number} y
 * @param {number} rows
 * @param {() => number} rand
 */
function seamXAt(y, rows, rand) {
	const mid = (MARBLE_W - 1) / 2;
	const jitter = (rand() - 0.5) * 2.0;
	const wave = Math.sin((y / rows) * Math.PI * 3.2) * 1.0;
	return mid + jitter + wave;
}

/**
 * Loose rubble under the boulder — sells “rock”, not pedestal slab.
 * @param {Group} parent
 * @param {import('three').MeshBasicMaterial[]} mats
 * @param {() => number} rand
 */
function addRockRubble(parent, mats, rand) {
	const cream = mats[MAT_CREAM];
	const edge = mats[MAT_EDGE];
	const shade = mats[MAT_SHADE];
	const warm = mats[MAT_WARM];
	const baseY = -((MARBLE_H - 1) * VOX) / 2 - 0.04;
	for (let i = 0; i < 14; i++) {
		const px = (rand() - 0.5) * MARBLE_W * VOX * 1.15;
		const pz = (rand() - 0.5) * MARBLE_D * VOX * 0.9;
		const s = 0.04 + rand() * 0.07;
		const mat = rand() < 0.35 ? shade : rand() < 0.5 ? edge : rand() < 0.5 ? cream : warm;
		box(parent, px, baseY + rand() * 0.03, pz, s * (0.8 + rand()), s * 0.6, s * (0.7 + rand()), mat);
	}
}

/**
 * @param {Group} root
 * @param {() => number} rand
 * @param {import('three').MeshBasicMaterial[]} mats
 * @param {ReturnType<typeof makeRockShape>} shape
 */
function buildMarbleHalves(root, rand, mats, shape) {
	const left = new Group();
	const right = new Group();
	/** @type {number[]} */
	const seamByRow = [];
	for (let y = 0; y < MARBLE_H; y++) seamByRow.push(seamXAt(y, MARBLE_H, rand));

	buildVoxelMarble(left, MARBLE_W, MARBLE_H, MARBLE_D, rand, (x, y) => x < seamByRow[y], mats, shape);
	buildVoxelMarble(right, MARBLE_W, MARBLE_H, MARBLE_D, rand, (x, y) => x >= seamByRow[y], mats, shape);
	left.visible = false;
	right.visible = false;
	root.add(left, right);
	return { left, right };
}

/**
 * Jagged Zeus trunk from sky → impact. Aggressive mid-path zig-zag.
 * @param {() => number} rand
 * @param {{ startX?: number, startY?: number, endX?: number, endY?: number, segs?: number }} [opts]
 */
function buildLightningPath(rand, opts = {}) {
	const startX = opts.startX ?? (rand() - 0.5) * 0.12;
	const startY = opts.startY ?? 1.7;
	const endX = opts.endX ?? 0;
	const endY = opts.endY ?? 0.02;
	const segs = opts.segs ?? 16;
	/** @type {{ x: number, y: number }[]} */
	const pts = [];
	for (let i = 0; i <= segs; i++) {
		const t = i / segs;
		const baseX = startX + (endX - startX) * t;
		const baseY = startY + (endY - startY) * t;
		const amp = Math.sin(t * Math.PI) * 0.42;
		const zig =
			i === 0 || i === segs
				? 0
				: (rand() - 0.5) * 2 * amp + Math.sin(t * 19.7 + rand()) * amp * 0.55;
		pts.push({ x: baseX + zig, y: baseY });
	}
	return pts;
}

/**
 * Full Zeus lightning tree: continuous polyline segments (core + mid + glow + gold),
 * with real side-branches forking off the trunk. Appears as one strike, not a caterpillar.
 * @param {Group} parent
 * @param {() => number} rand
 * @param {{ path?: { x: number, y: number }[], branchChance?: number, scale?: number }} [opts]
 */
function buildLightningTree(parent, rand, opts = {}) {
	const path = opts.path || buildLightningPath(rand);
	const branchChance = opts.branchChance ?? 0.5;
	const scale = opts.scale ?? 1;

	const glowMat = new MeshBasicMaterial({
		color: '#4a7dff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const midMat = new MeshBasicMaterial({
		color: '#e8f2ff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const coreMat = new MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const goldMat = new MeshBasicMaterial({
		color: '#ffd86a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});

	const group = new Group();
	parent.add(group);

	/**
	 * 2.5D voxel bolt chunk — stacked cubes along the edge (marble-language, not flat ribbons).
	 * @param {number} ax
	 * @param {number} ay
	 * @param {number} bx
	 * @param {number} by
	 * @param {number} thick
	 */
	function addSegment(ax, ay, bx, by, thick) {
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.hypot(dx, dy) || 0.01;
		const ux = dx / len;
		const uy = dy / len;
		const chunk = 0.055 * scale;
		const steps = Math.max(1, Math.ceil(len / (chunk * 0.72)));
		const base = 0.07 * thick * scale;

		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const px = ax + dx * t;
			const py = ay + dy * t;
			const zJitter = (rand() - 0.5) * 0.06;
			const z = 0.28 + zJitter;
			const wobble = (rand() - 0.5) * 0.012 * thick;

			/* Deep glow slab (gives 2.5D thickness) */
			box(
				group,
				px + wobble,
				py,
				z - 0.04,
				base * 1.85,
				base * 1.85,
				0.1 * scale,
				glowMat
			);
			/* Gold mid shell */
			box(
				group,
				px,
				py,
				z - 0.02,
				base * 1.25,
				base * 1.25,
				0.08 * scale,
				goldMat
			);
			/* Hot mid */
			box(group, px, py, z, base * 0.85, base * 0.85, 0.065 * scale, midMat);
			/* White core voxel */
			box(group, px, py, z + 0.015, base * 0.45, base * 0.45, 0.05 * scale, coreMat);

			/* Occasional side spur for jagged 3D silhouette */
			if (rand() < 0.22 && thick > 0.5) {
				const sx = px + uy * (rand() < 0.5 ? -1 : 1) * (0.04 + rand() * 0.06);
				const sy = py - ux * (0.02 + rand() * 0.04);
				box(group, sx, sy, z, base * 0.55, base * 0.55, 0.055 * scale, midMat);
			}
		}
	}

	for (let i = 0; i < path.length - 1; i++) {
		const a = path[i];
		const b = path[i + 1];
		addSegment(a.x, a.y, b.x, b.y, 1);

		/* True fork: spawn a dying branch from mid-trunk joints */
		if (i > 2 && i < path.length - 4 && rand() < branchChance) {
			let bx = a.x;
			let by = a.y;
			const dir = rand() < 0.5 ? -1 : 1;
			const n = 3 + Math.floor(rand() * 4);
			for (let j = 0; j < n; j++) {
				const nx = bx + dir * (0.1 + rand() * 0.22) + (rand() - 0.5) * 0.08;
				const ny = by - (0.07 + rand() * 0.12);
				addSegment(bx, by, nx, ny, Math.max(0.28, 0.7 - j * 0.12));
				bx = nx;
				by = ny;
			}
		}
	}

	/* Impact hotspot — chunky voxel burst tip */
	const tip = path[path.length - 1];
	for (let k = 0; k < 5; k++) {
		const o = (k - 2) * 0.035;
		box(group, tip.x + o * 0.3, tip.y + Math.abs(o) * 0.15, 0.3, 0.08 * scale, 0.08 * scale, 0.07 * scale, coreMat);
		box(group, tip.x + o * 0.5, tip.y, 0.26, 0.12 * scale, 0.12 * scale, 0.09 * scale, goldMat);
	}

	return {
		group,
		mats: [glowMat, midMat, coreMat, goldMat],
		/**
		 * @param {number} coreOp
		 * @param {number} [glowOp]
		 * @param {number} [goldOp]
		 */
		setOpacity(coreOp, glowOp = coreOp * 0.6, goldOp = coreOp * 0.45) {
			coreMat.opacity = Math.max(0, coreOp);
			midMat.opacity = Math.max(0, coreOp * 0.9);
			glowMat.opacity = Math.max(0, glowOp);
			goldMat.opacity = Math.max(0, goldOp);
		},
		hide() {
			this.setOpacity(0, 0, 0);
		}
	};
}

/**
 * Flicker envelope for a Zeus strike — flash, blink, hold, fade (not a crawl).
 * @param {number} t 0..1
 */
function lightningFlicker(t) {
	if (t < 0.06) return 1;
	if (t < 0.11) return 0.08;
	if (t < 0.18) return 1;
	if (t < 0.24) return 0.2;
	if (t < 0.58) return 0.92 + Math.sin(t * 90) * 0.08;
	return Math.max(0, 1 - (t - 0.58) / 0.42);
}

/**
 * Expanding shockwave ring of voxel ticks.
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
	const ticks = 24;
	/** @type {Mesh[]} */
	const meshes = [];
	for (let i = 0; i < ticks; i++) {
		const ang = (i / ticks) * Math.PI * 2;
		const m = box(g, Math.cos(ang), Math.sin(ang), 0.12, 0.08, 0.035, 0.02, mat);
		meshes.push(m);
	}
	parent.add(g);
	return { group: g, meshes, mat, life: 0, active: false };
}

/**
 * @param {Group} parent
 * @param {number} count
 * @param {() => number} rand
 * @param {string[]} colors
 * @param {[number, number]} sizeRange
 */
function buildParticlePool(parent, count, rand, colors, sizeRange) {
	const mats = colors.map(
		(c) => new MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthWrite: false })
	);
	/** @type {{ mesh: Mesh, mat: MeshBasicMaterial, vx: number, vy: number, vz: number, life: number, maxLife: number, active: boolean }[]} */
	const pool = [];
	for (let i = 0; i < count; i++) {
		const mat = mats[Math.floor(rand() * mats.length)];
		const s = sizeRange[0] + rand() * (sizeRange[1] - sizeRange[0]);
		const mesh = box(parent, 0, -40, 0, s, s, s, mat);
		mesh.visible = false;
		pool.push({ mesh, mat, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, active: false });
	}
	return { pool, mats };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ portraitUrl?: string | null, reduced?: boolean, seed?: number, onPhaseChange?: (p: string) => void, onRevealed?: () => void }} [opts]
 */
export function createGiftMarbleReveal(canvas, opts = {}) {
	const reduced = !!opts.reduced;
	const onPhaseChange = opts.onPhaseChange || (() => {});
	const onRevealed = opts.onRevealed || (() => {});

	const seed =
		opts.seed != null && Number.isFinite(opts.seed)
			? opts.seed >>> 0
			: resolveMarbleSeed(opts.portraitUrl || '');
	const rand = createRng(deriveSeed(seed, 'rock'));
	const shape = makeRockShape(createRng(deriveSeed(seed, 'shape')));
	const halfRand = createRng(deriveSeed(seed, 'halves'));
	const rubbleRand = createRng(deriveSeed(seed, 'rubble'));

	const scene = new Scene();
	const dpr = typeof window !== 'undefined' ? Math.min(1.75, window.devicePixelRatio || 1) : 1;
	const layer = makeRenderer(canvas, MARBLE_PX, true, {
		powerPreference: 'high-performance',
		pixelRatio: dpr,
		imageRendering: 'auto'
	});
	const { renderer, camera } = layer;

	const sharedMats = MARBLE_HEX.map((c) => new MeshBasicMaterial({ color: c }));

	const root = new Group();
	root.scale.setScalar(ROCK_SCENE_SCALE);
	root.position.y = ROCK_Y_BIAS;
	scene.add(root);

	const marblePivot = new Group();
	root.add(marblePivot);

	const solidMarble = new Group();
	marblePivot.add(solidMarble);
	buildVoxelMarble(solidMarble, MARBLE_W, MARBLE_H, MARBLE_D, rand, undefined, sharedMats, shape);
	addRockRubble(solidMarble, sharedMats, rubbleRand);

	const { left: leftHalf, right: rightHalf } = buildMarbleHalves(
		marblePivot,
		halfRand,
		sharedMats,
		shape
	);

	/** Real portrait — sized to native aspect (contain inside marble face) */
	const portraitMat = new MeshBasicMaterial({
		color: '#ffffff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	let portraitPlane = new Mesh(new PlaneGeometry(0.9, 1.15), portraitMat);
	portraitPlane.position.z = (MARBLE_D * VOX) / 2 + 0.012;
	portraitPlane.scale.setScalar(0.28);
	marblePivot.add(portraitPlane);

	const rimMat = new MeshBasicMaterial({
		color: '#ffd86a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const rimGroup = new Group();
	rimGroup.position.z = (MARBLE_D * VOX) / 2 + 0.022;
	rimGroup.scale.setScalar(0.28);
	marblePivot.add(rimGroup);

	/** @param {number} pw @param {number} ph */
	function rebuildRim(pw, ph) {
		while (rimGroup.children.length) {
			const c = /** @type {Mesh} */ (rimGroup.children[0]);
			rimGroup.remove(c);
			c.geometry?.dispose();
		}
		const t = 0.04;
		box(rimGroup, 0, ph / 2 + t / 2, 0, pw + t * 2, t, 0.02, rimMat);
		box(rimGroup, 0, -(ph / 2 + t / 2), 0, pw + t * 2, t, 0.02, rimMat);
		box(rimGroup, -(pw / 2 + t / 2), 0, 0, t, ph, 0.02, rimMat);
		box(rimGroup, pw / 2 + t / 2, 0, 0, t, ph, 0.02, rimMat);
	}
	rebuildRim(0.94, 1.2);

	/** Spider crack */
	const spiderColors = ['#fff8cc', '#ffd86a', '#ffffff', '#dce8ff', '#fff4c8', '#ff9a3c', '#ffffff'];
	const spiderMats = spiderColors.map(
		(c) =>
			new MeshBasicMaterial({
				color: c,
				transparent: true,
				opacity: 0,
				depthWrite: false
			})
	);
	/** Seam hint only — lives ON the marble face, never over the portrait after split */
	const spider = new Group();
	const seamZ = (MARBLE_D * VOX) / 2 - 0.01;
	box(spider, 0, 0, seamZ, 0.028, MARBLE_H * VOX * 0.92, 0.04, spiderMats[0]);
	box(spider, -0.06, 0.28, seamZ, 0.018, MARBLE_H * VOX * 0.28, 0.035, spiderMats[1]);
	box(spider, 0.07, -0.18, seamZ, 0.016, MARBLE_H * VOX * 0.22, 0.035, spiderMats[2]);
	marblePivot.add(spider);

	/** Dual flash (white + gold offset = fake chromatic) */
	const flashMat = new MeshBasicMaterial({
		color: '#fff4c8',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const flashGold = new MeshBasicMaterial({
		color: '#ff9a3c',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const flashQuad = new Mesh(new PlaneGeometry(6, 6), flashMat);
	flashQuad.position.z = 0.7;
	const flashQuad2 = new Mesh(new PlaneGeometry(6, 6), flashGold);
	flashQuad2.position.set(0.04, -0.03, 0.68);
	root.add(flashQuad, flashQuad2);

	const rayMat = new MeshBasicMaterial({
		color: '#ffd86a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const rays = new Group();
	for (let i = 0; i < 12; i++) {
		const ang = (i / 12) * Math.PI * 2;
		const m = box(rays, Math.cos(ang) * 0.6, Math.sin(ang) * 0.75, -0.1, 0.65, 0.028, 0.02, rayMat);
		m.rotation.z = ang;
	}
	root.add(rays);

	/** Zeus strikes — seeded so each ritual’s bolt forking differs */
	const boltMain = buildLightningTree(root, createRng(deriveSeed(seed, 'bolt-main')), {
		path: buildLightningPath(createRng(deriveSeed(seed, 'path-main')), { segs: 18 }),
		branchChance: 0.5 + createRng(deriveSeed(seed, 'bolt-main-chance'))() * 0.2,
		scale: 1.15
	});
	const ghostOff = createRng(deriveSeed(seed, 'path-ghost'));
	const boltGhost = buildLightningTree(root, createRng(deriveSeed(seed, 'bolt-ghost')), {
		path: buildLightningPath(createRng(deriveSeed(seed, 'path-ghost-line')), {
			startX: (ghostOff() - 0.5) * 0.2,
			endX: (ghostOff() - 0.5) * 0.1,
			segs: 14
		}),
		branchChance: 0.3 + ghostOff() * 0.2,
		scale: 0.85
	});
	boltGhost.group.position.z = -0.04;
	const sideOff = createRng(deriveSeed(seed, 'path-side'));
	const boltSide = buildLightningTree(root, createRng(deriveSeed(seed, 'bolt-side')), {
		path: buildLightningPath(createRng(deriveSeed(seed, 'path-side-line')), {
			startX: -0.15 - sideOff() * 0.25,
			endX: (sideOff() - 0.5) * 0.12,
			segs: 12
		}),
		branchChance: 0.35 + sideOff() * 0.2,
		scale: 0.75
	});
	const afterOff = createRng(deriveSeed(seed, 'path-after'));
	const boltAfter = buildLightningTree(root, createRng(deriveSeed(seed, 'bolt-after')), {
		path: buildLightningPath(createRng(deriveSeed(seed, 'path-after-line')), {
			startX: (afterOff() - 0.5) * 0.3,
			endX: (afterOff() - 0.5) * 0.08,
			segs: 14
		}),
		branchChance: 0.45 + afterOff() * 0.2,
		scale: 0.95
	});

	const allBolts = [boltMain, boltGhost, boltSide, boltAfter];

	const shock = buildShockwave(root);
	const debris = buildParticlePool(root, 90, createRng(deriveSeed(seed, 'debris')), DEBRIS_HEX, [
		0.035, 0.085
	]);
	const sparks = buildParticlePool(root, 55, createRng(deriveSeed(seed, 'sparks')), SPARK_COLORS, [
		0.018, 0.04
	]);

	/** @type {'enter' | 'idle' | 'crack' | 'revealed'} */
	let phase = reduced ? 'revealed' : 'enter';
	let enterT = 0;
	let crackT = 0;
	let elapsed = 0;
	let mx = 0.5;
	let my = 0.5;
	let yaw = 0;
	let pitch = 0;
	let shakeAmp = 0;
	let punch = 1;
	let dutch = 0;
	let debrisSpawned = false;
	let aftershockFired = false;
	let revealedCalled = false;
	let halvesSwapped = false;
	let timeScale = 1;

	/** @type {import('three').Texture | null} */
	let portraitTex = null;

	/**
	 * Size plane + rim to the real image aspect (contain in marble face).
	 * @param {import('three').Texture} tex
	 */
	function applyPortraitAspect(tex) {
		const img = /** @type {HTMLImageElement} */ (tex.image);
		const iw = img?.naturalWidth || img?.width || 3;
		const ih = img?.naturalHeight || img?.height || 4;
		const { w, h } = containSize(iw / ih, MARBLE_FACE_W, MARBLE_FACE_H);
		portraitPlane.geometry.dispose();
		portraitPlane.geometry = new PlaneGeometry(w, h);
		rebuildRim(w, h);
	}

	if (opts.portraitUrl) {
		portraitTex = new TextureLoader().load(opts.portraitUrl, (tex) => {
			tex.colorSpace = SRGBColorSpace;
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
		setPhase('crack');
		crackT = 0;
		debrisSpawned = false;
		aftershockFired = false;
		halvesSwapped = false;
		punch = 1;
		dutch = 0;
		timeScale = 1;
		shock.active = false;
		shock.mat.opacity = 0;
		spider.visible = true;
		portraitMat.opacity = 0;
		rimMat.opacity = 0;
		portraitPlane.scale.setScalar(0.28);
		rimGroup.scale.setScalar(0.28);
		for (const b of allBolts) b.hide();
	}

	/**
	 * @param {ReturnType<typeof buildParticlePool>} pool
	 * @param {number} speedMul
	 * @param {number} upward
	 */
	function spawnBurst(pool, speedMul, upward) {
		const r = createRng(deriveSeed(seed, `burst-${(elapsed * 1000) | 0}`));
		for (const d of pool.pool) {
			d.active = true;
			d.maxLife = 0.55 + r() * 0.85;
			d.life = d.maxLife;
			d.mesh.visible = true;
			d.mesh.position.set((r() - 0.5) * 0.2, (r() - 0.5) * 0.25, 0.15 + r() * 0.1);
			const ang = r() * Math.PI * 2;
			const speed = (1.2 + r() * 2.4) * speedMul;
			d.vx = Math.cos(ang) * speed;
			d.vy = Math.sin(ang) * speed * 0.85 + upward;
			d.vz = (r() - 0.5) * 1.2 * speedMul;
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
			d.mesh.rotation.x += dt * 6;
			d.mesh.rotation.z += dt * 5;
			d.mat.opacity = Math.max(0, d.life / d.maxLife);
			if (d.life <= 0) {
				d.active = false;
				d.mesh.visible = false;
			}
		}
	}

	/**
	 * @param {ReturnType<typeof buildLightningTree>} bolt
	 * @param {number} rate
	 * @param {number} dt
	 */
	function fadeBolt(bolt, rate, dt) {
		const cur = bolt.mats[2].opacity;
		bolt.setOpacity(Math.max(0, cur - rate * dt));
	}

	function fireShockwave() {
		shock.active = true;
		shock.life = 0;
		shock.mat.opacity = 0.95;
		shock.group.scale.setScalar(0.15);
	}

	let raf = 0;
	let last = performance.now();

	/**
	 * @param {number} now
	 */
	function tick(now) {
		const rawDt = Math.min(0.05, (now - last) / 1000);
		last = now;
		elapsed += rawDt;
		const dt = rawDt * timeScale;

		const k = 1 - Math.exp(-rawDt * SPRING);

		if (!reduced && phase !== 'revealed' && phase !== 'crack') {
			const targetYaw = (mx - 0.5) * 2 * YAW_MAX;
			const targetPitch = (0.5 - my) * 2 * PITCH_MAX;
			yaw += (targetYaw - yaw) * k;
			pitch += (targetPitch - pitch) * k;
			marblePivot.rotation.y = yaw;
			marblePivot.rotation.x = pitch;
		}

		/* —— Enter —— */
		if (phase === 'enter') {
			enterT = Math.min(1, enterT + rawDt / 1.1);
			const e = smooth01(enterT);
			let scale;
			if (e < 0.72) scale = 0.04 + smooth01(e / 0.72) * 1.0;
			else scale = 1.02 - smooth01((e - 0.72) / 0.28) * 0.02;
			marblePivot.scale.setScalar(scale);

			if (enterT > 0.32 && enterT < 0.55) {
				flashMat.color.set('#fff4c8');
				flashMat.opacity = Math.min(0.55, flashMat.opacity + rawDt * 5);
				rayMat.opacity = Math.min(0.85, rayMat.opacity + rawDt * 5);
			} else {
				flashMat.opacity = Math.max(0, flashMat.opacity - rawDt * 3);
				rayMat.opacity = Math.max(0, rayMat.opacity - rawDt * 2.8);
			}

			if (enterT >= 1) {
				marblePivot.scale.setScalar(1);
				flashMat.opacity = 0;
				rayMat.opacity = 0;
				setPhase('idle');
			}
		}

		/* —— Idle —— */
		if (phase === 'idle') {
			marblePivot.position.y = Math.sin(elapsed * 0.85) * 0.014;
			marblePivot.scale.setScalar(1 + Math.sin(elapsed * 1.05) * 0.012);
			spiderMats[0].opacity = 0.14 + (0.5 + 0.5 * Math.sin(elapsed * 2.6)) * 0.32;
		}

		/* —— CRACK BAYHEM —— */
		if (phase === 'crack') {
			crackT += dt;
			const t1 = CHARGE_DUR;
			const t2 = t1 + BOLT_DUR;
			const t3 = t2 + IMPACT_DUR;
			const t4 = t3 + SHATTER_DUR;
			const t5 = t4 + EXHALE_DUR;

			/* 1. Charge — storm builds */
			if (crackT < t1) {
				const p = crackT / CHARGE_DUR;
				flashMat.color.set('#040c1c');
				flashMat.opacity = 0.45 * smooth01(p);
				flashGold.opacity = 0.12 * p;
				marblePivot.position.x = (Math.random() - 0.5) * 0.04 * p;
				marblePivot.position.y = (Math.random() - 0.5) * 0.035 * p;
				shakeAmp = 0.02 * p;
				for (let i = 0; i < spiderMats.length; i++) {
					spiderMats[i].opacity = p * (0.35 + i * 0.08);
				}
				rayMat.opacity = p * 0.25;
			}

			/* 2. ZEUS STRIKE — full jagged bolt appears at once + flicker */
			if (crackT >= t1 && crackT < t2) {
				const bt = (crackT - t1) / BOLT_DUR;
				const op = lightningFlicker(bt);

				boltMain.setOpacity(op);
				boltGhost.setOpacity(op * 0.4, op * 0.25, op * 0.2);
				boltGhost.group.position.x = 0.05 + Math.sin(bt * 40) * 0.01;

				if (bt > 0.15) {
					boltSide.setOpacity(op * 0.75, op * 0.4, op * 0.3);
				}

				/* Sky whiteout pulses with the strike */
				flashMat.color.set('#ffffff');
				flashMat.opacity = Math.max(flashMat.opacity, op * 0.55);
				flashGold.opacity = Math.max(flashGold.opacity, op * 0.25);
				if (Math.random() < 0.35) {
					flashMat.opacity = Math.min(0.85, op * 0.9);
				}

				spiderMats[0].opacity = 0.95;
				shakeAmp = 0.04 + op * 0.06;
				rayMat.opacity = op * 0.35;
			}

			/* 3. IMPACT — whiteout + shockwave + debris storm */
			if (crackT >= t2 && crackT < t3) {
				const ip = (crackT - t2) / IMPACT_DUR;
				flashMat.color.set(ip < 0.35 ? '#ffffff' : '#ffd86a');
				flashMat.opacity = 0.95 * (1 - ip);
				flashGold.opacity = 0.55 * (1 - ip);
				shakeAmp = 0.12 * (1 - ip);
				punch = 1 + Math.sin(ip * Math.PI) * 0.14;
				dutch = (Math.random() - 0.5) * 0.08 * (1 - ip);
				root.scale.setScalar(punch);
				root.rotation.z = dutch;

				if (!halvesSwapped) {
					solidMarble.visible = false;
					leftHalf.visible = true;
					rightHalf.visible = true;
					halvesSwapped = true;
					/* Kill seam beam — never draw over the revealed portrait */
					spider.visible = false;
					for (const m of spiderMats) m.opacity = 0;
				}
				if (!debrisSpawned) {
					spawnBurst(debris, 1.35, 1.1);
					spawnBurst(sparks, 1.8, 1.6);
					fireShockwave();
					debrisSpawned = true;
					timeScale = 0.42; /* slow-mo hit */
				}

				/* Bolt burns out at impact point */
				const burn = Math.max(0, 0.85 * (1 - ip));
				boltMain.setOpacity(burn);
				boltGhost.setOpacity(burn * 0.3);
				boltSide.setOpacity(burn * 0.4);
			} else if (crackT >= t3) {
				punch += (1 - punch) * Math.min(1, rawDt * 6);
				dutch += (0 - dutch) * Math.min(1, rawDt * 5);
				root.scale.setScalar(punch);
				root.rotation.z = dutch;
				/* Ease out of slow-mo */
				timeScale += (1 - timeScale) * Math.min(1, rawDt * 2.2);
			}

			if (shakeAmp > 0.001) {
				shakeAmp *= 0.92;
				camera.position.x = (Math.random() - 0.5) * shakeAmp * 2.2;
				camera.position.y = (Math.random() - 0.5) * shakeAmp * 2.2;
			} else {
				camera.position.set(0, 0, 10);
			}

			/* Shockwave expand */
			if (shock.active) {
				shock.life += rawDt;
				const sp = Math.min(1, shock.life / 0.55);
				const rad = 0.2 + smooth01(sp) * 2.4;
				shock.group.scale.setScalar(rad);
				shock.mat.opacity = 0.9 * (1 - sp);
				for (let i = 0; i < shock.meshes.length; i++) {
					const ang = (i / shock.meshes.length) * Math.PI * 2;
					shock.meshes[i].position.set(Math.cos(ang), Math.sin(ang) * 1.15, 0.12);
				}
				if (sp >= 1) {
					shock.active = false;
					shock.mat.opacity = 0;
				}
			}

			/* 4. Shatter — violent tumble + portrait bloom + aftershock */
			if (crackT >= t3 && crackT < t4) {
				const splitP = (crackT - t3) / SHATTER_DUR;
				const e = smooth01(splitP);
				const sep = e * 1.45;
				leftHalf.position.set(-sep, -e * 0.35 - e * e * 0.4, e * 0.15);
				rightHalf.position.set(sep, -e * 0.28 - e * e * 0.45, -e * 0.1);
				leftHalf.rotation.set(e * 0.35, e * 0.15, e * 0.55);
				rightHalf.rotation.set(-e * 0.3, -e * 0.2, -e * 0.5);

				/* Portrait pop — init tiny, then fade-in + expand with overshoot */
				const popOp = smooth01(Math.min(1, e * 1.35));
				portraitMat.opacity = popOp;
				rimMat.opacity = popOp;
				let popScale;
				if (splitP < 0.8) {
					const t = smooth01(splitP / 0.8);
					popScale = 0.28 + t * (1.1 - 0.28);
				} else {
					const t = smooth01((splitP - 0.8) / 0.2);
					popScale = 1.1 + t * (1 - 1.1);
				}
				portraitPlane.scale.setScalar(popScale);
				rimGroup.scale.setScalar(popScale);

				/* Aftershock — second Zeus strike mid-shatter */
				if (!aftershockFired && splitP >= AFTERSHOCK_AT) {
					aftershockFired = true;
					spawnBurst(sparks, 1.4, 0.9);
					spawnBurst(debris, 0.7, 0.5);
					fireShockwave();
					shakeAmp = 0.09;
					flashMat.color.set('#ffffff');
					flashMat.opacity = 0.55;
				}
				if (aftershockFired && splitP < AFTERSHOCK_AT + 0.28) {
					const at = (splitP - AFTERSHOCK_AT) / 0.28;
					const op = lightningFlicker(at) * 0.9;
					boltAfter.setOpacity(op);
				} else if (aftershockFired) {
					fadeBolt(boltAfter, 5, dt);
				}

				flashMat.opacity = Math.max(0, flashMat.opacity - rawDt * 1.8);
				flashGold.opacity = Math.max(0, flashGold.opacity - rawDt * 2);
				fadeBolt(boltMain, 3, dt);
				fadeBolt(boltGhost, 4, dt);
				fadeBolt(boltSide, 4, dt);
			}

			/* 5. Exhale — chunks leave frame, hand off to gift UI */
			if (crackT >= t4) {
				const ep = Math.min(1, (crackT - t4) / EXHALE_DUR);
				const fade = smooth01(ep);
				leftHalf.position.x = -1.45 - fade * 1.2;
				rightHalf.position.x = 1.45 + fade * 1.2;
				leftHalf.position.y = -0.75 - fade * 1.1;
				rightHalf.position.y = -0.73 - fade * 1.2;
				leftHalf.rotation.z = 0.55 + fade * 0.6;
				rightHalf.rotation.z = -0.5 - fade * 0.7;

				for (const m of spiderMats) m.opacity = 0;
				rimMat.opacity = Math.max(0.75, rimMat.opacity * (1 - fade * 0.15));
				portraitMat.opacity = Math.max(0.95, portraitMat.opacity);
				portraitPlane.scale.setScalar(1);
				rimGroup.scale.setScalar(1);
				flashMat.opacity = 0;
				flashGold.opacity = 0;
				canvas.style.opacity = String(1 - fade);

				if (crackT >= t5 || ep >= 1) setPhase('revealed');
			}

			tickPool(debris, dt, 3.4);
			tickPool(sparks, dt, 1.8);
		}

		if (phase === 'revealed') {
			flashMat.opacity = 0;
			flashGold.opacity = 0;
			rayMat.opacity = 0;
			shock.mat.opacity = 0;
			for (const m of spiderMats) m.opacity = 0;
			for (const b of allBolts) b.hide();
			canvas.style.opacity = '0';
		}

		renderer.render(scene, camera);
		raf = requestAnimationFrame(tick);
	}

	const onResize = () => {
		layer.resize(VIEW_H);
		/* Keep photo sharp — don't force nearest-neighbor on the whole canvas */
		canvas.style.imageRendering = 'auto';
	};
	onResize();
	window.addEventListener('resize', onResize);

	/**
	 * @param {PointerEvent} e
	 */
	function onPointerMove(e) {
		const rect = canvas.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return;
		mx = (e.clientX - rect.left) / rect.width;
		my = (e.clientY - rect.top) / rect.height;
	}

	/**
	 * @param {PointerEvent} e
	 */
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
		canvas.removeEventListener('pointermove', onPointerMove);
		canvas.removeEventListener('pointerdown', onPointerDown);
		if (portraitTex) portraitTex.dispose();
		disposeScene(scene);
		renderer.dispose();
	}

	return {
		seed,
		resize: onResize,
		/** @param {number} x @param {number} y */
		setPointer(x, y) {
			mx = x;
			my = y;
		},
		triggerCrack,
		dispose,
		destroy: dispose
	};
}
