/**
 * Gift page — Hybrid God-Mode marble crack (Zeus / Poseidon / Hades).
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
	makeMarbleTexture,
	makeRockShape,
	resolveMarbleSeed
} from './marbleSeed.js';

/** Match / beat Landing temple hero sharpness (HERO_PX=1100) */
const MARBLE_PX = 1500;
const YAW_MAX = 0.18;
const PITCH_MAX = 0.055;
const SPRING = 10;

/* Higher voxel density — marble detail without turning into Lego */
const MARBLE_W = 44;
const MARBLE_H = 38;
const MARBLE_D = 24;
const VOX = 0.057;
const VOX_SIZE = VOX * 1.02;
/** Ortho vertical span — keep in sync with layer.resize() */
const VIEW_H = 2.25;
/** Fill most of the viewport, leave margin for chrome + hint */
const FIT_FRAC = 0.9;
/** Rock grid height — used to fit inside VIEW_H */
const ROCK_WORLD_H = MARBLE_H * VOX + 0.06;
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

/* Classic Carrara cream — soft body + cool grey veins (not dirt speckles) */
const MAT_WHITE = 0;
const MAT_CREAM = 1;
const MAT_WARM = 2;
const MAT_VEIN = 3;
const MAT_VEIN_DK = 4;
const MAT_EDGE = 5;
const MAT_SHADE = 6;
const MARBLE_HEX = [
	'#fbfaf8', /* bright polish */
	'#f6f2eb', /* cream body */
	'#efeae2', /* soft warm cream — still marble, not soil */
	'#c5c0b8', /* soft grey vein */
	'#8f8a82', /* vein core */
	'#e2ddd4', /* soft recess */
	'#d4cfc6' /* underside shade */
];

const SPARK_COLORS = ['#ffffff', '#ffd86a', '#fff4c8', '#dce8ff', '#ff9a3c'];
const DEBRIS_HEX = ['#fbfaf8', '#f6f2eb', '#efeae2', '#e2ddd4', '#c5c0b8'];
const SEA_HEX = ['#1a6bb5', '#2ec4ff', '#7ad7ff', '#e8f7ff', '#0d4a8a'];
const HADES_HEX = ['#ff5a1f', '#c41e3a', '#5b1d8a', '#1a0a14', '#ff9a3c'];

/** Random crack setpiece gods — not tied to marble seed */
const CRACK_GODS = /** @type {const} */ (['zeus', 'poseidon', 'hades']);

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
 * Thin flowing Carrara veins — ribbon peaks, seeded grain (not dirt speckles).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} cols
 * @param {number} rows
 * @param {number} depth
 * @param {ReturnType<typeof makeMarbleTexture>} tex
 */
function veinField(x, y, z, cols, rows, depth, tex) {
	const u0 = x / Math.max(1, cols - 1);
	const v0 = y / Math.max(1, rows - 1);
	const w0 = z / Math.max(1, depth - 1);
	/* Rotate UV so vein direction varies per seed */
	const u = u0 * tex.cosA - v0 * tex.sinA;
	const v = u0 * tex.sinA + v0 * tex.cosA;
	const w = w0;

	const primary = Math.sin(
		u * tex.pFreqU +
			v * tex.pFreqV +
			Math.sin(v * tex.pWarpV + w * tex.pWarpW + tex.pPhase) * tex.pWarp +
			w * tex.pFreqW +
			tex.pPhase
	);
	const secondary = Math.sin(u * tex.sFreqU - v * tex.sFreqV + w * tex.sFreqW + tex.sPhase);
	const hair = Math.sin((u * 0.65 + v) * tex.hFreq + Math.sin(u * 2.8 + tex.hPhase) * tex.hWarp + tex.hPhase);
	/* Peak only near zero-crossings → thin continuous veins */
	const thin = (s, sharp) => Math.max(0, 1 - Math.min(1, Math.abs(s) * sharp));
	return Math.max(
		thin(primary, tex.pSharp) * tex.pWeight,
		thin(secondary, tex.sSharp) * tex.sWeight,
		thin(hair, tex.hSharp) * tex.hWeight
	);
}

/**
 * Soft cream banding — polished marble body, seeded per visit.
 * @param {number} x
 * @param {number} y
 * @param {ReturnType<typeof makeMarbleTexture>} tex
 */
function bodyField(x, y, tex) {
	return (
		0.5 +
		0.5 *
			Math.sin(x * tex.bFreqX + y * tex.bFreqY + tex.bPhase) *
			Math.cos(y * tex.bFreqY2 - x * tex.bFreqX2 + tex.bPhase2)
	);
}

/**
 * Smooth union of two SDF distances (keeps fused lobes as one rock).
 * @param {number} a
 * @param {number} b
 * @param {number} k
 */
function smin(a, b, k) {
	const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
	return a * h + b * (1 - h) - k * h * (1 - h);
}

/**
 * Surface wobble for facet / lump (not thin pillars).
 * @param {number} angle
 * @param {ReturnType<typeof makeRockShape>} shape
 * @param {number} [h] 0..1 height
 */
function rockRadius(angle, shape, h = 0.5) {
	const n = shape.noise ?? 0.16;
	return (
		shape.baseR *
		(1 +
			n *
				(shape.amp2 * Math.sin(angle * 2.0 + shape.phase2) * 0.55 +
					shape.amp3 * Math.sin(angle * 3.0 + shape.phase3 + h * 2) * 0.45 +
					shape.amp5 * Math.cos(angle * 5.0 + shape.phase5) * 0.3 +
					shape.amp7 * Math.sin(angle * 2.5 + h * 4 + shape.phase7) * 0.25))
	);
}

/**
 * Ellipsoid distance in normalized space (inside < 1).
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} rx
 * @param {number} ry
 * @param {number} rz
 */
function ellipD(px, py, pz, rx, ry, rz) {
	const ex = px / Math.max(0.08, rx);
	const ey = py / Math.max(0.08, ry);
	const ez = pz / Math.max(0.08, rz);
	return Math.sqrt(ex * ex + ey * ey + ez * ez);
}

/**
 * Lumpy gravity boulder — multi-lobe metaball, wide foot, not a smooth egg.
 * Primary mass straddles center so the crack still yields two real halves.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} cols
 * @param {number} rows
 * @param {number} depth
 * @param {ReturnType<typeof makeRockShape>} shape
 */
function inRock(x, y, z, cols, rows, depth, shape) {
	const cx = (cols - 1) / 2 + shape.leanX * cols * 0.16;
	/* Seeded CoM height — freer silhouettes */
	const comY = Math.max(0.28, Math.min(0.42, shape.comY ?? 0.34));
	const cy = (rows - 1) * comY;
	const cz = (depth - 1) / 2 + shape.leanZ * depth * 0.14;

	const h = y / Math.max(1, rows - 1);
	/* Grounded foot + bulky mid — taper only bites the upper third */
	const taperH = Math.max(0, (h - 0.1) / 0.9);
	const profile = 1.2 - shape.taper * Math.pow(taperH, 1.55) * 0.9;
	const floorWide = Math.max(0.78, profile);

	const tall = 0.52 + shape.tallness * 0.42;
	/* Seeded mass scale — clamped so silhouette isn't wall-capped */
	const fill = Math.max(0.48, Math.min(0.56, shape.fillBias ?? 0.54));
	const squashY = Math.max(0.78, Math.min(1.08, shape.squashY ?? 0.92));
	const sminK = Math.max(0.12, Math.min(0.3, shape.sminK ?? 0.18));
	const facetStrength = Math.max(0.1, Math.min(0.75, shape.facetStrength ?? 0.35));

	const wx = cols * 0.5 * Math.max(0.6, shape.widthX) * floorWide * fill;
	const wy = rows * 0.5 * tall;
	const wz = depth * 0.5 * Math.max(0.6, shape.depthZ) * floorWide * fill;

	const px = (x - cx) / wx;
	const py = (y - cy) / wy;
	const pz = (z - cz) / wz;

	const ang = Math.atan2(pz, px);
	const rMul = rockRadius(ang, shape, h);

	/* Primary body — seeded Y squash */
	let d = ellipD(px, py, pz, rMul * 1.05, squashY, rMul * 0.95);

	/* Fused gravity lobes — seeded soft vs sharp seams */
	const lobes = shape.lobes || [];
	for (let i = 0; i < lobes.length; i++) {
		const L = lobes[i];
		const ld = ellipD(px - L.ox, py - L.oy, pz - L.oz, L.rx, L.ry, L.rz);
		d = smin(d, ld, sminK);
	}

	const n = shape.noise ?? 0.16;

	/* Seeded facet planes — flat faces / ridges */
	const facets = shape.facets || [];
	let facetBite = 0;
	for (let i = 0; i < facets.length; i++) {
		const F = facets[i];
		const plane = px * F.nx + py * F.ny + pz * F.nz;
		facetBite = Math.max(facetBite, plane - F.thresh);
	}
	/* Carve faces more up high — keep a grounded foot */
	const facetAmt = (h < 0.28 ? 0.45 : 1) * facetStrength * (0.55 + n * 0.7);
	d += Math.max(0, facetBite) * facetAmt;

	/* Mid-frequency lumps that read at higher voxel density */
	d +=
		n *
		0.2 *
		(Math.sin(px * 4.1 + shape.phase2) * Math.cos(pz * 3.4 + shape.phase3) +
			0.7 * Math.sin((px + pz) * 2.6 + h * 6 + shape.phase5) +
			0.35 * Math.cos(px * 6.2 - py * 3.1 + shape.phase7));

	/* Flat-ish settled base — gravity, not a floating orb */
	const floorBite = 1.6 + shape.taper * 0.6;
	const floor = -0.82 + 0.04 * Math.sin(px * 5 + shape.phase2) * Math.cos(pz * 4.5);
	if (py < floor) d += (floor - py) * floorBite;

	/* Occasional lower-flank undercut (Giant Rock vibe) — keep core intact */
	if (shape.overhang > 0.05 && h < 0.42) {
		const side = shape.overhangSide || 1;
		const flank = px * side;
		if (flank > 0.12) {
			const cut = (flank - 0.12) * shape.overhang * (1 - h / 0.42);
			d += cut * 0.62;
		}
	}

	if (d > 1.06) return false;

	/* Soft crown — broad dome, not a needle */
	if (h > shape.crown) {
		const tip = (h - shape.crown) / Math.max(0.05, 1 - shape.crown);
		if (d > 0.88 - tip * 0.3) return false;
		if (Math.hypot(px, pz) > rMul * (0.72 - tip * 0.18)) return false;
	}

	/* Outer shell chips / fissure bites */
	if (d > 0.78 && Math.sin(x * 2.8 + y * 2.1 + z * 1.7 + shape.phase2) > shape.chip) {
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
 * Cream Carrara marble — flowing veins on a polished cream body.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} cols
 * @param {number} rows
 * @param {number} depth
 * @param {Set<string>} rockSet
 * @param {ReturnType<typeof makeMarbleTexture>} tex
 */
function pickMarbleMat(x, y, z, cols, rows, depth, rockSet, tex) {
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

	/* Soft underside only — not a muddy crust */
	if (exposedDown && exposed >= 3) return MAT_SHADE;

	const veins = veinField(x, y, z, cols, rows, depth, tex);
	/* Veins run through the stone (surface + shallow body) */
	if (veins > tex.veinDark) return MAT_VEIN_DK;
	if (veins > tex.veinSoft) return MAT_VEIN;

	/* Deep recesses get a cool soft shade — still cream family */
	if (onSurface && !exposedFront && !exposedUp && exposed >= 3) return MAT_EDGE;

	const body = bodyField(x + z * 0.25, y, tex);
	if (exposedUp) return MAT_WHITE;
	if (onSurface || exposedFront) {
		if (body > tex.whiteBias) return MAT_WHITE;
		if (body > tex.creamBias) return MAT_CREAM;
		return MAT_WARM;
	}
	/* Interior stays cream so cracks still read as marble */
	return body > tex.creamBias + 0.12 ? MAT_CREAM : MAT_WARM;
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
 * @param {ReturnType<typeof makeMarbleTexture>} tex
 */
function buildVoxelMarble(parent, cols, rows, depth, rand, filter, mats, shape, tex) {
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
		const mi = pickMarbleMat(c.x, c.y, c.z, cols, rows, depth, rockSet, tex);
		/* Tight voxel fit — polish, not crumbly dirt */
		const s = 0.97 + rand() * 0.08;
		buckets[mi].push({
			x: c.x * VOX - ox + (rand() - 0.5) * VOX * 0.03,
			y: c.y * VOX - oy + (rand() - 0.5) * VOX * 0.02,
			z: c.z * VOX - oz + (rand() - 0.5) * VOX * 0.03,
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
	/* Keep crack near center so both halves have real mass */
	const jitter = (rand() - 0.5) * 0.9;
	const wave = Math.sin((y / rows) * Math.PI * 2.4) * 0.45;
	return mid + jitter + wave;
}

/**
 * Tiny marble chips on the floor — cream flecks, not dirt clumps.
 * Lives on root so chips stay after the boulder cracks.
 * @param {Group} parent
 * @param {import('three').MeshBasicMaterial[]} mats
 * @param {() => number} rand
 */
function addRockRubble(parent, mats, rand) {
	const cream = mats[MAT_CREAM];
	const white = mats[MAT_WHITE];
	const warm = mats[MAT_WARM];
	const edge = mats[MAT_EDGE];
	const vein = mats[MAT_VEIN];
	const baseY = -((MARBLE_H - 1) * VOX) / 2 - 0.04;
	for (let i = 0; i < 20; i++) {
		const px = (rand() - 0.5) * MARBLE_W * VOX * 1.12;
		const pz = (rand() - 0.5) * MARBLE_D * VOX * 0.95;
		const s = 0.022 + rand() * 0.04;
		const roll = rand();
		const mat = roll < 0.28 ? white : roll < 0.55 ? cream : roll < 0.75 ? warm : roll < 0.9 ? edge : vein;
		box(
			parent,
			px,
			baseY + rand() * 0.02,
			pz,
			s * (0.7 + rand() * 0.6),
			s * (0.35 + rand() * 0.35),
			s * (0.65 + rand() * 0.55),
			mat
		);
	}
}

/**
 * @param {Group} root
 * @param {() => number} rand
 * @param {import('three').MeshBasicMaterial[]} mats
 * @param {ReturnType<typeof makeRockShape>} shape
 * @param {ReturnType<typeof makeMarbleTexture>} tex
 */
function buildMarbleHalves(root, rand, mats, shape, tex) {
	const left = new Group();
	const right = new Group();
	/** @type {number[]} */
	const seamByRow = [];
	for (let y = 0; y < MARBLE_H; y++) seamByRow.push(seamXAt(y, MARBLE_H, rand));

	buildVoxelMarble(left, MARBLE_W, MARBLE_H, MARBLE_D, rand, (x, y) => x < seamByRow[y], mats, shape, tex);
	buildVoxelMarble(right, MARBLE_W, MARBLE_H, MARBLE_D, rand, (x, y) => x >= seamByRow[y], mats, shape, tex);
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
 * Poseidon — instanced curled tsunami + trailing sheet (few draws, epic slam).
 * @param {Group} parent
 * @param {() => number} rand
 */
function buildTsunami(parent, rand) {
	const group = new Group();
	parent.add(group);

	const deep = new MeshBasicMaterial({
		color: '#1a6bb5',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const mid = new MeshBasicMaterial({
		color: '#2ec4ff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const foam = new MeshBasicMaterial({
		color: '#e8f7ff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const mats = [deep, mid, foam];
	const geo = new BoxGeometry(1, 1, 1);

	const cols = 6;
	const rows = 10;
	const cellW = 0.26;
	const cellH = 0.18;

	/** @type {{ row: number, bx: number, by: number, bz: number, sx: number, sy: number, sz: number, mi: number, sheet: number }[]} */
	const cells = [];

	function pushCell(row, col, sheet, forceFoam) {
		const isFoam = forceFoam || row >= rows - 2 || (row >= rows - 3 && rand() < 0.4);
		const isDeep = !isFoam && (row < 3 || rand() < 0.22);
		const mi = isFoam ? 2 : isDeep ? 0 : 1;
		const jitter = (rand() - 0.5) * 0.035;
		cells.push({
			row,
			bx: (col - (cols - 1) / 2) * cellW + jitter,
			by: (row - (rows - 1) / 2) * cellH + (rand() - 0.5) * 0.025,
			bz: (rand() - 0.5) * 0.1 - sheet * 0.22,
			sx: cellW * (0.82 + rand() * 0.32),
			sy: cellH * (0.78 + rand() * 0.38),
			sz: 0.09 + rand() * 0.1,
			mi,
			sheet
		});
	}

	/* Main wall */
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) pushCell(r, c, 0, false);
	}
	/* Crest foam row */
	for (let c = 0; c < cols + 2; c++) {
		pushCell(rows - 1, c - 1, 0, true);
	}
	/* Secondary trailing sheet — thinner, fewer cols */
	for (let r = 1; r < rows - 1; r++) {
		for (let c = 1; c < cols - 1; c++) {
			if (rand() < 0.55) pushCell(r, c, 1, r >= rows - 3);
		}
	}

	/** @type {InstancedMesh[]} */
	const meshes = mats.map((mat, mi) => {
		const count = cells.filter((c) => c.mi === mi).length;
		const inst = new InstancedMesh(geo, mat, Math.max(1, count));
		inst.count = count;
		inst.frustumCulled = false;
		group.add(inst);
		return inst;
	});

	/** Per-mat list of cell indices into `cells` */
	/** @type {number[][]} */
	const byMat = [[], [], []];
	for (let i = 0; i < cells.length; i++) byMat[cells[i].mi].push(i);

	const startX = -3.2;
	const endX = 2.6;
	group.position.set(startX, 0.05, 0.35);
	group.visible = false;

	/**
	 * @param {number} t
	 * @param {number} op
	 */
	function writeMatrices(t, op) {
		const p = Math.max(0, Math.min(1, t));
		const o = Math.max(0, op);
		group.visible = o > 0.01;
		group.position.x = startX + (endX - startX) * p;
		/* Whole-wall lean + compress on exit */
		const exitFlat = p > 0.85 ? (p - 0.85) / 0.15 : 0;
		group.rotation.z = -0.1 + p * 0.18 - exitFlat * 0.12;
		group.scale.set(1 + p * 0.2 - exitFlat * 0.35, 0.82 + p * 0.45 - exitFlat * 0.25, 1);

		deep.opacity = o * 0.78;
		mid.opacity = o * 0.88;
		foam.opacity = o * (0.9 + Math.min(1, p * 1.2) * 0.1);

		for (let mi = 0; mi < 3; mi++) {
			const list = byMat[mi];
			const inst = meshes[mi];
			for (let k = 0; k < list.length; k++) {
				const c = cells[list[k]];
				const rowN = c.row / Math.max(1, rows - 1);
				/* Curl: crest advances ahead of base */
				const curl = rowN * rowN * p * 0.55;
				const sheetLag = c.sheet * 0.38 * (1 - p * 0.35);
				const bob = Math.sin(p * 12 + c.row * 0.7 + c.bx * 3) * 0.02 * p;
				_pos.set(c.bx + curl - sheetLag, c.by + bob + rowN * p * 0.08, c.bz);
				const bloom = c.mi === 2 && p > 0.65 ? 1 + (p - 0.65) * 1.4 : 1;
				_scl.set(c.sx * bloom, c.sy * bloom * (1 - exitFlat * 0.3), c.sz);
				_mat4.compose(_pos, _quat, _scl);
				inst.setMatrixAt(k, _mat4);
			}
			inst.instanceMatrix.needsUpdate = true;
		}
	}

	writeMatrices(0, 0);

	return {
		group,
		mats,
		/**
		 * @param {number} t 0..1 surge progress
		 * @param {number} op overall opacity
		 */
		setProgress(t, op) {
			writeMatrices(t, op);
		},
		hide() {
			writeMatrices(0, 0);
			group.visible = false;
		}
	};
}

/**
 * Hades — instanced racing fissure + staggered hellfire pillars.
 * @param {Group} parent
 * @param {() => number} rand
 */
function buildUnderworldRupture(parent, rand) {
	const group = new Group();
	parent.add(group);

	const ash = new MeshBasicMaterial({
		color: '#1a0a14',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const violet = new MeshBasicMaterial({
		color: '#5b1d8a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const ember = new MeshBasicMaterial({
		color: '#ff5a1f',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const core = new MeshBasicMaterial({
		color: '#c41e3a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const mats = [ash, violet, ember, core];
	const geo = new BoxGeometry(1, 1, 1);

	const floorY = -((MARBLE_H - 1) * VOX) / 2 - 0.02;

	/** @type {{ bx: number, by: number, bz: number, sx: number, sy: number, sz: number, mi: number, rad: number, kind: 'fissure' | 'pillar', pillar: number, delay: number }[]} */
	const cells = [];

	/* Racing fissure arms */
	const arms = 6;
	for (let a = 0; a < arms; a++) {
		const ang = (a / arms) * Math.PI * 2 + (rand() - 0.5) * 0.35;
		const len = 0.65 + rand() * 0.55;
		const segs = 5;
		for (let s = 0; s < segs; s++) {
			const t = (s + 0.5) / segs;
			const rad = t;
			cells.push({
				bx: Math.cos(ang) * len * t + (rand() - 0.5) * 0.03,
				by: floorY,
				bz: Math.sin(ang) * len * t * 0.55 + (rand() - 0.5) * 0.025,
				sx: 0.045 + rand() * 0.035,
				sy: 0.028,
				sz: 0.07 + rand() * 0.05,
				mi: s % 2 === 0 ? 0 : 1,
				rad,
				kind: 'fissure',
				pillar: -1,
				delay: 0
			});
		}
	}

	/* Center pillar (index 0) + 3 side pillars — staggered delays */
	const pillarDefs = [
		{ x: 0, z: 0, maxH: 1.15, thick: 1.35, delay: 0 },
		{ x: -0.32, z: 0.12, maxH: 0.85, thick: 0.95, delay: 0.12 },
		{ x: 0.3, z: -0.08, maxH: 0.9, thick: 1.0, delay: 0.18 },
		{ x: 0.08, z: 0.28, maxH: 0.75, thick: 0.9, delay: 0.26 }
	];
	for (let pi = 0; pi < pillarDefs.length; pi++) {
		const def = pillarDefs[pi];
		const layers = pi === 0 ? 11 : 8;
		for (let L = 0; L < layers; L++) {
			const hN = L / layers;
			const h = hN * def.maxH;
			const shrink = 1 - hN * 0.5;
			const mi = L < 2 ? 0 : L % 3 === 0 ? 2 : L % 3 === 1 ? 3 : 1;
			const s = (0.09 + rand() * 0.06) * shrink * def.thick;
			cells.push({
				bx: def.x + (rand() - 0.5) * 0.05,
				by: floorY + h,
				bz: def.z + (rand() - 0.5) * 0.04,
				sx: s,
				sy: 0.085,
				sz: s,
				mi,
				rad: 0,
				kind: 'pillar',
				pillar: pi,
				delay: def.delay
			});
		}
	}

	/** @type {InstancedMesh[]} */
	const meshes = mats.map((mat, mi) => {
		const count = cells.filter((c) => c.mi === mi).length;
		const inst = new InstancedMesh(geo, mat, Math.max(1, count));
		inst.count = count;
		inst.frustumCulled = false;
		group.add(inst);
		return inst;
	});

	/** @type {number[][]} */
	const byMat = [[], [], [], []];
	for (let i = 0; i < cells.length; i++) byMat[cells[i].mi].push(i);

	/** Per-pillar current grow 0..1 */
	const pillarGrow = pillarDefs.map(() => 0);

	group.visible = false;

	/**
	 * @param {number} t
	 * @param {number} op
	 */
	function writeMatrices(t, op) {
		const p = Math.max(0, Math.min(1, t));
		const o = Math.max(0, op);
		group.visible = o > 0.01;

		/* Fissure races outward with t */
		const fissureFront = Math.min(1, p * 2.4);
		ash.opacity = o * Math.min(1, p * 2.2) * 0.85;
		violet.opacity = o * (0.3 + p * 0.6);
		ember.opacity = o * Math.max(0, (p - 0.12) / 0.88);
		core.opacity = o * Math.max(0, (p - 0.2) / 0.8);

		for (let pi = 0; pi < pillarDefs.length; pi++) {
			const local = Math.max(0, (p - pillarDefs[pi].delay) / Math.max(0.05, 1 - pillarDefs[pi].delay));
			pillarGrow[pi] = smooth01(Math.min(1, local * 1.15));
		}

		for (let mi = 0; mi < 4; mi++) {
			const list = byMat[mi];
			const inst = meshes[mi];
			for (let k = 0; k < list.length; k++) {
				const c = cells[list[k]];
				if (c.kind === 'fissure') {
					const show = c.rad <= fissureFront ? 1 : 0.02;
					_pos.set(c.bx, c.by, c.bz);
					_scl.set(c.sx * show, c.sy, c.sz * show);
				} else {
					const def = pillarDefs[c.pillar];
					const g = pillarGrow[c.pillar];
					const heightFrac = Math.max(0, (c.by - floorY) / Math.max(0.01, def.maxH));
					const alive = g > 0.02 && g >= heightFrac - 0.05;
					const scl = alive ? 1 : 0.001;
					_pos.set(c.bx, c.by, c.bz);
					_scl.set(c.sx * scl, c.sy * scl, c.sz * scl);
				}
				_mat4.compose(_pos, _quat, _scl);
				inst.setMatrixAt(k, _mat4);
			}
			inst.instanceMatrix.needsUpdate = true;
		}
	}

	writeMatrices(0, 0);

	return {
		group,
		mats,
		/**
		 * @param {number} t 0..1 eruption progress
		 * @param {number} op opacity
		 */
		setProgress(t, op) {
			writeMatrices(t, op);
		},
		hide() {
			writeMatrices(0, 0);
			group.visible = false;
		}
	};
}

/**
 * Divine charge aura — soft gold backlight rings behind the rock + orbiting embers.
 * Lives on marblePivot so it shares boulder parallax. Voxel-native (no stickers).
 * @param {Group} parent
 * @param {() => number} rand
 */
function buildDivineCharge(parent, rand) {
	const group = new Group();
	parent.add(group);

	const behindZ = -((MARBLE_D * VOX) / 2 + 0.18);
	const ringMats = [
		new MeshBasicMaterial({
			color: '#ffd86a',
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: true
		}),
		new MeshBasicMaterial({
			color: '#fff4c8',
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: true
		}),
		new MeshBasicMaterial({
			color: '#ff9a3c',
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: true
		})
	];

	/** @type {{ hub: Group, baseScale: number, phase: number, mat: import('three').MeshBasicMaterial }[]} */
	const rings = [];
	const ringDefs = [
		{ rx: 0.95, ry: 1.15, ticks: 28, thick: 0.055, mat: ringMats[0], scale: 1 },
		{ rx: 1.2, ry: 1.45, ticks: 32, thick: 0.04, mat: ringMats[1], scale: 1.05 },
		{ rx: 1.45, ry: 1.75, ticks: 36, thick: 0.032, mat: ringMats[2], scale: 1.1 }
	];

	for (let ri = 0; ri < ringDefs.length; ri++) {
		const def = ringDefs[ri];
		const hub = new Group();
		hub.position.z = behindZ - ri * 0.04;
		hub.renderOrder = -30 + ri;
		for (let i = 0; i < def.ticks; i++) {
			const ang = (i / def.ticks) * Math.PI * 2;
			const x = Math.cos(ang) * def.rx;
			const y = Math.sin(ang) * def.ry;
			const m = box(hub, x, y, 0, def.thick * 1.4, def.thick, 0.028, def.mat);
			m.rotation.z = ang;
		}
		group.add(hub);
		rings.push({
			hub,
			baseScale: def.scale,
			phase: rand() * Math.PI * 2,
			mat: def.mat
		});
	}

	const emberColors = ['#ffd86a', '#fff4c8', '#ffffff', '#ff9a3c', '#ffe8a0'];
	const EMBER_N = 22;
	/** @type {{ mesh: Mesh, mat: import('three').MeshBasicMaterial, rx: number, ry: number, speed: number, phase: number, z: number, size: number }[]} */
	const embers = [];
	/** @type {import('three').MeshBasicMaterial[]} */
	const emberMats = [];
	for (let i = 0; i < EMBER_N; i++) {
		const mat = new MeshBasicMaterial({
			color: emberColors[Math.floor(rand() * emberColors.length)],
			transparent: true,
			opacity: 0,
			depthWrite: false,
			depthTest: true
		});
		emberMats.push(mat);
		const size = 0.028 + rand() * 0.04;
		const mesh = box(group, 0, 0, 0, size, size, size * 0.85, mat);
		mesh.visible = false;
		embers.push({
			mesh,
			mat,
			rx: 0.7 + rand() * 0.85,
			ry: 0.9 + rand() * 1.05,
			speed: 0.55 + rand() * 1.1,
			phase: rand() * Math.PI * 2,
			z: behindZ + 0.05 + rand() * 0.35,
			size
		});
	}

	/**
	 * @param {number} op
	 */
	function setOpacity(op) {
		const o = Math.max(0, Math.min(1, op));
		group.visible = o > 0.01;
		if (o <= 0.01) {
			for (const r of rings) r.mat.opacity = 0;
			for (const e of embers) {
				e.mat.opacity = 0;
				e.mesh.visible = false;
			}
		}
	}

	/**
	 * @param {number} t
	 * @param {number} [intensity]
	 */
	function tick(t, intensity = 1) {
		const amp = Math.max(0, intensity);
		if (amp <= 0.01) {
			setOpacity(0);
			return;
		}
		const breath = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 2.4));
		const vis = Math.min(1.35, amp) * breath;
		group.visible = true;

		for (let i = 0; i < rings.length; i++) {
			const r = rings[i];
			const pulse = 1 + Math.sin(t * (1.6 + i * 0.35) + r.phase) * 0.045 * Math.min(1, amp);
			r.hub.scale.setScalar(r.baseScale * pulse);
			r.hub.rotation.z = Math.sin(t * 0.7 + r.phase) * 0.08 * Math.min(1, amp);
			r.mat.opacity = Math.min(1, vis * (0.28 + i * 0.1));
		}

		for (let i = 0; i < embers.length; i++) {
			const e = embers[i];
			const a = e.phase + t * e.speed;
			e.mesh.position.set(Math.cos(a) * e.rx, Math.sin(a) * e.ry, e.z + Math.sin(a * 2) * 0.04);
			const flicker = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 7 + e.phase * 3));
			e.mat.opacity = Math.min(1, vis * flicker * 0.85);
			e.mesh.visible = e.mat.opacity > 0.02;
			const s = 0.85 + flicker * 0.35;
			e.mesh.scale.setScalar(s);
		}
	}

	setOpacity(0);
	return {
		group,
		setOpacity,
		tick,
		dispose() {
			for (const m of ringMats) m.dispose();
			for (const m of emberMats) m.dispose();
			group.traverse((obj) => {
				const mesh = /** @type {Mesh} */ (obj);
				if (mesh.geometry) mesh.geometry.dispose();
			});
		}
	};
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
	const tex = makeMarbleTexture(createRng(deriveSeed(seed, 'tex')));
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

	/* Divine charge lives ON the pivot — same 2D parallax as the boulder */
	const aura = buildDivineCharge(marblePivot, createRng(deriveSeed(seed, 'aura')));

	const solidMarble = new Group();
	marblePivot.add(solidMarble);
	buildVoxelMarble(solidMarble, MARBLE_W, MARBLE_H, MARBLE_D, rand, undefined, sharedMats, shape, tex);
	/* Floor chips sit on root — stay put when the marble shatters */
	addRockRubble(root, sharedMats, rubbleRand);

	const { left: leftHalf, right: rightHalf } = buildMarbleHalves(
		marblePivot,
		halfRand,
		sharedMats,
		shape,
		tex
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

	/** Lazy-built Poseidon / Hades FX — only allocated when that god strikes */
	/** @type {ReturnType<typeof buildTsunami> | null} */
	let tsunami = null;
	/** @type {ReturnType<typeof buildUnderworldRupture> | null} */
	let underworld = null;

	function ensureTsunami() {
		if (!tsunami) tsunami = buildTsunami(root, createRng(deriveSeed(seed, 'tsunami')));
		return tsunami;
	}
	function ensureUnderworld() {
		if (!underworld) underworld = buildUnderworldRupture(root, createRng(deriveSeed(seed, 'hades')));
		return underworld;
	}

	const shock = buildShockwave(root);
	const debris = buildParticlePool(root, 90, createRng(deriveSeed(seed, 'debris')), DEBRIS_HEX, [
		0.035, 0.085
	]);
	const sparks = buildParticlePool(root, 55, createRng(deriveSeed(seed, 'sparks')), SPARK_COLORS, [
		0.018, 0.04
	]);
	const seaSplash = buildParticlePool(root, 36, createRng(deriveSeed(seed, 'sea')), SEA_HEX, [
		0.025, 0.07
	]);
	const hadesEmbers = buildParticlePool(root, 36, createRng(deriveSeed(seed, 'embers')), HADES_HEX, [
		0.02, 0.055
	]);

	/** @type {'enter' | 'idle' | 'crack' | 'revealed'} */
	let phase = reduced ? 'revealed' : 'enter';
	let enterT = 0;
	let crackT = 0;
	let elapsed = 0;
	/** @type {'zeus' | 'poseidon' | 'hades'} */
	let crackGod = 'zeus';
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
		crackGod = CRACK_GODS[Math.floor(Math.random() * CRACK_GODS.length)];
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
		tsunami?.hide();
		underworld?.hide();
	}

	/**
	 * @param {ReturnType<typeof buildParticlePool>} pool
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
			d.maxLife = 0.55 + r() * 0.85;
			d.life = d.maxLife;
			d.mesh.visible = true;
			d.mesh.position.set((r() - 0.5) * 0.2, (r() - 0.5) * 0.25, 0.15 + r() * 0.1);
			const ang = r() * Math.PI * 2;
			const speed = (1.2 + r() * 2.4) * speedMul;
			d.vx = Math.cos(ang) * speed * (biasX ? 0.45 : 1) + biasX * speed;
			d.vy = Math.sin(ang) * speed * 0.85 * (biasY ? 0.35 : 1) + upward + biasY * speed * 0.55;
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

			/* Aura ramps in with the boulder */
			const auraIn = smooth01(Math.min(1, Math.max(0, (enterT - 0.2) / 0.55)));
			aura.tick(elapsed, auraIn);
			if (enterT > 0.32 && enterT < 0.55) {
				flashMat.color.set('#fff4c8');
				flashMat.opacity = Math.min(0.45, flashMat.opacity + rawDt * 4);
			} else {
				flashMat.opacity = Math.max(0, flashMat.opacity - rawDt * 3);
			}

			if (enterT >= 1) {
				marblePivot.scale.setScalar(1);
				flashMat.opacity = 0;
				setPhase('idle');
			}
		}

		/* —— Idle —— */
		if (phase === 'idle') {
			marblePivot.position.y = Math.sin(elapsed * 0.85) * 0.014;
			marblePivot.scale.setScalar(1 + Math.sin(elapsed * 1.05) * 0.012);
			spiderMats[0].opacity = 0.14 + (0.5 + 0.5 * Math.sin(elapsed * 2.6)) * 0.32;
			/* Keep divine charge alive until the boulder breaks */
			aura.tick(elapsed, 1);
		}

		/* —— CRACK BAYHEM —— */
		if (phase === 'crack') {
			crackT += dt;
			const t1 = CHARGE_DUR;
			const t2 = t1 + BOLT_DUR;
			const t3 = t2 + IMPACT_DUR;
			const t4 = t3 + SHATTER_DUR;
			const t5 = t4 + EXHALE_DUR;

			/* 1. Charge — storm builds; aura intensifies until the split */
			if (crackT < t1) {
				const p = crackT / CHARGE_DUR;
				if (crackGod === 'poseidon') {
					flashMat.color.set('#031a33');
					flashGold.color.set('#2ec4ff');
					flashMat.opacity = 0.4 * smooth01(p);
					flashGold.opacity = 0.18 * p;
					/* Wave gathers off-screen */
					ensureTsunami().setProgress(0.08 * p, 0.35 + p * 0.4);
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
				marblePivot.position.x = (Math.random() - 0.5) * 0.04 * p;
				marblePivot.position.y = (Math.random() - 0.5) * 0.035 * p;
				shakeAmp = 0.02 * p;
				for (let i = 0; i < spiderMats.length; i++) {
					spiderMats[i].opacity = p * (0.35 + i * 0.08);
				}
				aura.tick(elapsed, 1 + p * 0.35);
			}

			/* 2. SETPIECE — god attack (Zeus bolt / Poseidon tsunami / Hades rupture) */
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
					/* Curled wave surges across the viewport and slams the marble */
					const surge = smooth01(bt);
					const crash = bt > 0.68 ? lightningFlicker((bt - 0.68) / 0.32) : 0;
					ensureTsunami().setProgress(0.08 + surge * 0.92, 0.8 + crash * 0.2);
					flashMat.color.set(bt > 0.68 ? '#e8f7ff' : '#0a3d6b');
					flashGold.color.set('#2ec4ff');
					flashMat.opacity = 0.28 + surge * 0.4 + crash * 0.5;
					flashGold.opacity = 0.18 + surge * 0.35 + crash * 0.4;
					shakeAmp = 0.04 + surge * 0.055 + crash * 0.09;
					marblePivot.position.x = (Math.random() - 0.5) * 0.06 * surge;
					if (bt > 0.7) camera.position.x += (Math.random() - 0.5) * 0.02;
				} else {
					/* Staggered hellfire pillars race up through the boulder */
					const rise = smooth01(bt);
					const bloom = bt > 0.6 ? lightningFlicker((bt - 0.6) / 0.4) : 0;
					ensureUnderworld().setProgress(0.2 + rise * 0.8, 0.75 + bloom * 0.25);
					flashMat.color.set(bt > 0.55 ? '#1a0a14' : '#120818');
					flashGold.color.set('#ff5a1f');
					flashMat.opacity = 0.45 + rise * 0.35 + bloom * 0.45;
					flashGold.opacity = 0.22 + rise * 0.38 + bloom * 0.45;
					shakeAmp = 0.045 + rise * 0.06 + bloom * 0.08;
					marblePivot.position.y = (Math.random() - 0.5) * 0.05 * rise;
					camera.position.y += (Math.random() - 0.5) * 0.015 * rise;
				}

				spiderMats[0].opacity = 0.95;
				aura.tick(elapsed, 1.15);
			}

			/* 3. IMPACT — flash + shockwave + debris storm */
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
				root.scale.setScalar(punch);
				root.rotation.z = dutch;

				if (!halvesSwapped) {
					solidMarble.visible = false;
					leftHalf.visible = true;
					rightHalf.visible = true;
					halvesSwapped = true;
					/* Kill seam + aura — boulder is broken in half */
					spider.visible = false;
					for (const m of spiderMats) m.opacity = 0;
					aura.setOpacity(0);
				}
				if (!debrisSpawned) {
					spawnBurst(debris, 1.35, 1.1);
					spawnBurst(sparks, 1.8, 1.6);
					if (crackGod === 'poseidon') {
						spawnBurst(seaSplash, 1.7, 0.55, { biasX: 1.15 });
					}
					if (crackGod === 'hades') {
						spawnBurst(hadesEmbers, 1.55, 2.0, { biasY: 1.1 });
					}
					fireShockwave();
					debrisSpawned = true;
					timeScale = 0.42; /* slow-mo hit */
				}

				/* God setpiece burns out at impact */
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
				root.scale.setScalar(punch);
				root.rotation.z = dutch;
				aura.setOpacity(0);
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
				/* Drop translucent god FX early — free overdraw for halves/portrait */
				if (crackT - t3 < dt * 2) {
					tsunami?.hide();
					underworld?.hide();
				}
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

				/* Aftershock — god-flavored second hit mid-shatter */
				if (!aftershockFired && splitP >= AFTERSHOCK_AT) {
					aftershockFired = true;
					spawnBurst(sparks, 1.4, 0.9);
					spawnBurst(debris, 0.7, 0.5);
					if (crackGod === 'poseidon') {
						spawnBurst(seaSplash, 1.15, 0.45, { biasX: 0.9 });
						ensureTsunami().setProgress(1, 0.35);
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
				tsunami?.hide();
				underworld?.hide();
				canvas.style.opacity = String(1 - fade);

				if (crackT >= t5 || ep >= 1) setPhase('revealed');
			}

			tickPool(debris, dt, 3.4);
			tickPool(sparks, dt, 1.8);
			if (crackGod === 'poseidon') tickPool(seaSplash, dt, 2.6);
			if (crackGod === 'hades') tickPool(hadesEmbers, dt, 2.2);
		}

		if (phase === 'revealed') {
			flashMat.opacity = 0;
			flashGold.opacity = 0;
			aura.setOpacity(0);
			shock.mat.opacity = 0;
			for (const m of spiderMats) m.opacity = 0;
			for (const b of allBolts) b.hide();
			tsunami?.hide();
			underworld?.hide();
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
		aura.dispose?.();
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
