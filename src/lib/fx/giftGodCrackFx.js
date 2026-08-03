/**
 * Zeus / Poseidon / Hades strike FX — shared by marble + limestone reveals.
 */
import {
	BoxGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	PlaneGeometry,
	Quaternion,
	Vector3
} from 'three';
import { MeshBasicMaterial, box, smooth01 } from './pixelShared.js';

export const CRACK_GODS = /** @type {const} */ (['zeus', 'poseidon', 'hades']);
export const AFTERSHOCK_AT = 0.35;
export const SEA_HEX = ['#1a6bb5', '#2ec4ff', '#7ad7ff', '#e8f7ff', '#0d4a8a'];
export const HADES_HEX = ['#ff5a1f', '#c41e3a', '#5b1d8a', '#1a0a14', '#ff9a3c'];

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _quat = new Quaternion();
const _scl = new Vector3();
const _axisZ = new Vector3(0, 0, 1);

/** @param {() => number} rand @param {object} [opts] */
export function buildLightningPath(rand, opts = {}) {
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

/** @param {Group} parent @param {() => number} rand @param {object} [opts] */
export function buildLightningTree(parent, rand, opts = {}) {
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
			box(group, px + wobble, py, z - 0.04, base * 1.85, base * 1.85, 0.1 * scale, glowMat);
			box(group, px, py, z - 0.02, base * 1.25, base * 1.25, 0.08 * scale, goldMat);
			box(group, px, py, z, base * 0.85, base * 0.85, 0.065 * scale, midMat);
			box(group, px, py, z + 0.015, base * 0.45, base * 0.45, 0.05 * scale, coreMat);
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

	const tip = path[path.length - 1];
	for (let k = 0; k < 5; k++) {
		const o = (k - 2) * 0.035;
		box(group, tip.x + o * 0.3, tip.y + Math.abs(o) * 0.15, 0.3, 0.08 * scale, 0.08 * scale, 0.07 * scale, coreMat);
		box(group, tip.x + o * 0.5, tip.y, 0.26, 0.12 * scale, 0.12 * scale, 0.09 * scale, goldMat);
	}

	return {
		group,
		mats: [glowMat, midMat, coreMat, goldMat],
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

/** @param {number} t */
export function lightningFlicker(t) {
	if (t < 0.06) return 1;
	if (t < 0.11) return 0.08;
	if (t < 0.18) return 1;
	if (t < 0.24) return 0.2;
	if (t < 0.58) return 0.92 + Math.sin(t * 90) * 0.08;
	return Math.max(0, 1 - (t - 0.58) / 0.42);
}

/**
 * Poseidon's wrath — curling ocean wall + wind streaks + foam crest + trident spears.
 * Progress t: 0 swell → ~0.7 crest peak → 1 crash.
 * @param {Group} parent
 * @param {() => number} rand
 */
export function buildTsunami(parent, rand) {
	const group = new Group();
	parent.add(group);

	const abyss = new MeshBasicMaterial({ color: '#041428', transparent: true, opacity: 0, depthWrite: false });
	const deep = new MeshBasicMaterial({ color: '#0a3d6b', transparent: true, opacity: 0, depthWrite: false });
	const mid = new MeshBasicMaterial({ color: '#1a8fd4', transparent: true, opacity: 0, depthWrite: false });
	const foam = new MeshBasicMaterial({ color: '#e8f7ff', transparent: true, opacity: 0, depthWrite: false });
	const wind = new MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0, depthWrite: false });
	const spearMat = new MeshBasicMaterial({ color: '#7ad7ff', transparent: true, opacity: 0, depthWrite: false });
	/* mats[0..2] kept for callers that fade mats[1] */
	const mats = [deep, mid, foam];
	const geo = new BoxGeometry(1, 1, 1);

	/**
	 * @typedef {{ kind: 'wall' | 'crest' | 'wind' | 'spear', bx: number, by: number, bz: number, sx: number, sy: number, sz: number, mi: number, ang: number, phase: number, curl: number }} WaveCell
	 */
	/** @type {WaveCell[]} */
	const cells = [];

	/* Tall curling wall — C-shaped ocean face (reads as a god-wave, not spray) */
	const wallCols = 8;
	const wallRows = 14;
	for (let r = 0; r < wallRows; r++) {
		for (let c = 0; c < wallCols; c++) {
			const u = c / (wallCols - 1);
			const v = r / (wallRows - 1);
			/* Crescent: lean forward at the crest */
			const curlAmt = v * v * 0.95;
			const thickness = 0.55 + (1 - v) * 0.7;
			const isCrest = v > 0.78;
			const isAbyss = v < 0.22;
			const mi = isCrest ? 2 : isAbyss ? 0 : v < 0.5 ? 0 : 1;
			cells.push({
				kind: isCrest ? 'crest' : 'wall',
				bx: (u - 0.5) * 1.15 * thickness - curlAmt * 0.35,
				by: (v - 0.15) * 2.35 - 0.55,
				bz: (rand() - 0.5) * 0.12 - curlAmt * 0.25,
				sx: 0.16 + rand() * 0.1,
				sy: 0.14 + rand() * 0.08,
				sz: 0.1 + rand() * 0.08,
				mi,
				ang: -curlAmt * 0.55,
				phase: rand() * Math.PI * 2,
				curl: curlAmt
			});
		}
	}

	/* Secondary sheet behind the wall for depth */
	for (let r = 2; r < wallRows - 1; r += 2) {
		for (let c = 1; c < wallCols - 1; c++) {
			if (rand() > 0.55) continue;
			const u = c / (wallCols - 1);
			const v = r / (wallRows - 1);
			const curlAmt = v * v * 0.7;
			cells.push({
				kind: 'wall',
				bx: (u - 0.5) * 1.0 - curlAmt * 0.25,
				by: (v - 0.15) * 2.2 - 0.55,
				bz: -0.28 - curlAmt * 0.15,
				sx: 0.18 + rand() * 0.08,
				sy: 0.12 + rand() * 0.06,
				sz: 0.08,
				mi: v < 0.35 ? 0 : 1,
				ang: -curlAmt * 0.4,
				phase: rand() * 6,
				curl: curlAmt
			});
		}
	}

	/* Foam lip along the crest arc */
	for (let i = 0; i < 18; i++) {
		const u = i / 17;
		cells.push({
			kind: 'crest',
			bx: (u - 0.5) * 1.35 - 0.55,
			by: 1.35 + Math.sin(u * Math.PI) * 0.22 + (rand() - 0.5) * 0.06,
			bz: -0.35 + (rand() - 0.5) * 0.08,
			sx: 0.12 + rand() * 0.14,
			sy: 0.08 + rand() * 0.1,
			sz: 0.08 + rand() * 0.06,
			mi: 2,
			ang: -0.6 + (rand() - 0.5) * 0.3,
			phase: rand() * 6,
			curl: 1
		});
	}

	/* Horizontal wind streaks — Poseidon as god of winds */
	for (let i = 0; i < 22; i++) {
		cells.push({
			kind: 'wind',
			bx: (rand() - 0.5) * 2.4,
			by: (rand() - 0.35) * 2.1,
			bz: 0.15 + rand() * 0.2,
			sx: 0.35 + rand() * 0.75,
			sy: 0.02 + rand() * 0.025,
			sz: 0.03 + rand() * 0.02,
			mi: 3,
			ang: (rand() - 0.5) * 0.12,
			phase: rand() * Math.PI * 2,
			curl: rand()
		});
	}

	/* Trident water spears — thrust at impact */
	for (let i = 0; i < 5; i++) {
		const spread = (i - 2) * 0.18;
		cells.push({
			kind: 'spear',
			bx: spread,
			by: 0.2 + Math.abs(spread) * 0.15,
			bz: 0.22,
			sx: 0.055 + rand() * 0.03,
			sy: 0.55 + rand() * 0.35,
			sz: 0.055,
			mi: 4,
			ang: -0.85 + spread * 0.35,
			phase: i * 0.15,
			curl: 0
		});
	}

	const allMats = [deep, mid, foam, wind, spearMat, abyss];
	/* Remap wall abyss cells onto abyss mat via mi=5 for bottom rows already using deep — keep deep for mid-dark */
	const meshes = allMats.map((mat) => {
		const inst = new InstancedMesh(geo, mat, Math.max(1, cells.length));
		inst.count = 0;
		inst.frustumCulled = false;
		group.add(inst);
		return inst;
	});

	/** @type {number[][]} */
	const byMat = [[], [], [], [], [], []];
	for (let i = 0; i < cells.length; i++) {
		const c = cells[i];
		/* Abyss tint for lowest wall band */
		if (c.kind === 'wall' && c.by < -0.35) c.mi = 5;
		byMat[c.mi].push(i);
	}
	for (let mi = 0; mi < meshes.length; mi++) {
		meshes[mi].count = byMat[mi].length;
	}

	const startX = -3.6;
	const slamX = 0.15;
	group.position.set(startX, 0.05, 0.4);
	group.visible = false;

	function writeMatrices(t, op) {
		const p = Math.max(0, Math.min(1, t));
		const o = Math.max(0, op);
		group.visible = o > 0.01;

		const swell = smooth01(Math.min(1, p / 0.28));
		const surge = smooth01(Math.max(0, (p - 0.12) / 0.55));
		const crest = smooth01(Math.max(0, (p - 0.48) / 0.28));
		const crash = smooth01(Math.max(0, (p - 0.72) / 0.28));
		const exitFlat = crash;

		group.position.x = startX + (slamX - startX) * surge;
		group.position.y = 0.02 + swell * 0.12 - crash * 0.28;
		group.rotation.z = -0.18 * (1 - surge) + crest * 0.22 - crash * 0.35;
		group.scale.set(
			0.85 + swell * 0.25 + crest * 0.2 - crash * 0.45,
			0.55 + swell * 0.55 + crest * 0.55 - crash * 0.5,
			1
		);

		abyss.opacity = o * (0.55 + swell * 0.35) * (1 - crash * 0.4);
		deep.opacity = o * (0.7 + surge * 0.25);
		mid.opacity = o * (0.75 + crest * 0.2);
		foam.opacity = o * (0.2 + crest * 0.75 + crash * 0.15);
		wind.opacity = o * (0.15 + swell * 0.45 + surge * 0.35) * (1 - crash * 0.5);
		spearMat.opacity = o * crest * (0.35 + crash * 0.65);

		for (let mi = 0; mi < meshes.length; mi++) {
			const list = byMat[mi];
			const inst = meshes[mi];
			for (let k = 0; k < list.length; k++) {
				const c = cells[list[k]];
				let px = c.bx;
				let py = c.by;
				let pz = c.bz;
				let sx = c.sx;
				let sy = c.sy;
				let sz = c.sz;
				let ang = c.ang;

				if (c.kind === 'wall' || c.kind === 'crest') {
					const curlBoost = c.curl * crest * 0.55;
					px += curlBoost * 0.4;
					py += crest * c.curl * 0.18 - crash * c.curl * 0.55;
					pz -= curlBoost * 0.2;
					ang = c.ang - crest * 0.35 * c.curl + crash * 0.5;
					const bob = Math.sin(p * 14 + c.phase) * 0.03 * surge;
					py += bob;
					if (c.kind === 'crest') {
						sx *= 1 + crest * 0.8 + crash * 1.2;
						sy *= 1 + crest * 0.5;
						px += crash * (0.4 + c.phase * 0.05);
						py -= crash * 0.35;
					}
					const alive = swell > 0.05 ? 1 : 0.02;
					sx *= alive;
					sy *= alive * (1 - exitFlat * 0.35);
				} else if (c.kind === 'wind') {
					const windT = swell * 0.4 + surge;
					px = c.bx + windT * (1.8 + c.curl) - crash * 0.5;
					py = c.by + Math.sin(p * 20 + c.phase) * 0.06;
					sx = c.sx * (0.4 + windT * 1.4) * (1 - crash * 0.6);
					sy = c.sy * (1 + surge * 0.5);
					const show = windT > 0.08 ? 1 : 0.001;
					sx *= show;
					sy *= show;
					ang = c.ang;
				} else {
					/* spears — appear late, stab through the relic */
					const spearT = Math.max(0, (crest - c.phase) / Math.max(0.05, 1 - c.phase));
					const thrust = smooth01(Math.min(1, spearT * 1.4));
					px = c.bx + thrust * 0.15;
					py = c.by + (1 - thrust) * 0.8 - crash * 0.2;
					sy = c.sy * (0.2 + thrust * 1.1) * (1 - crash * 0.45);
					sx = c.sx * (0.5 + thrust * 0.8);
					ang = c.ang + crash * 0.2;
					const show = thrust > 0.05 ? 1 : 0.001;
					sx *= show;
					sy *= show;
				}

				_pos.set(px, py, pz);
				_quat.setFromAxisAngle(_axisZ, ang);
				_scl.set(sx, sy, sz);
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
 * @param {Group} parent
 * @param {() => number} rand
 * @param {number} floorY
 */
export function buildUnderworldRupture(parent, rand, floorY) {
	const group = new Group();
	parent.add(group);

	const ash = new MeshBasicMaterial({ color: '#1a0a14', transparent: true, opacity: 0, depthWrite: false });
	const violet = new MeshBasicMaterial({ color: '#5b1d8a', transparent: true, opacity: 0, depthWrite: false });
	const ember = new MeshBasicMaterial({ color: '#ff5a1f', transparent: true, opacity: 0, depthWrite: false });
	const core = new MeshBasicMaterial({ color: '#c41e3a', transparent: true, opacity: 0, depthWrite: false });
	const mats = [ash, violet, ember, core];
	const geo = new BoxGeometry(1, 1, 1);

	/** @type {{ bx: number, by: number, bz: number, sx: number, sy: number, sz: number, mi: number, rad: number, kind: 'fissure' | 'pillar', pillar: number, delay: number }[]} */
	const cells = [];

	const arms = 6;
	for (let a = 0; a < arms; a++) {
		const ang = (a / arms) * Math.PI * 2 + (rand() - 0.5) * 0.35;
		const len = 0.65 + rand() * 0.55;
		const segs = 5;
		for (let s = 0; s < segs; s++) {
			const t = (s + 0.5) / segs;
			cells.push({
				bx: Math.cos(ang) * len * t + (rand() - 0.5) * 0.03,
				by: floorY,
				bz: Math.sin(ang) * len * t * 0.55 + (rand() - 0.5) * 0.025,
				sx: 0.045 + rand() * 0.035,
				sy: 0.028,
				sz: 0.07 + rand() * 0.05,
				mi: s % 2 === 0 ? 0 : 1,
				rad: t,
				kind: 'fissure',
				pillar: -1,
				delay: 0
			});
		}
	}

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
	const pillarGrow = pillarDefs.map(() => 0);
	group.visible = false;

	function writeMatrices(t, op) {
		const p = Math.max(0, Math.min(1, t));
		const o = Math.max(0, op);
		group.visible = o > 0.01;
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
 * @param {Group} parent
 * @param {number} count
 * @param {() => number} rand
 * @param {string[]} colors
 * @param {[number, number]} sizeRange
 */
export function buildGodParticlePool(parent, count, rand, colors, sizeRange) {
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
 * @param {ReturnType<typeof buildLightningTree>} bolt
 * @param {number} rate
 * @param {number} dt
 */
export function fadeBolt(bolt, rate, dt) {
	const cur = bolt.mats[2].opacity;
	bolt.setOpacity(Math.max(0, cur - rate * dt));
}

/**
 * @param {Group} root
 * @param {number} seed
 * @param {number} floorY
 * @param {{ deriveSeed: Function, createRng: Function }} helpers
 */
export function setupGodCrackKit(root, seed, floorY, { deriveSeed, createRng }) {
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

	/** @type {ReturnType<typeof buildTsunami> | null} */
	let tsunami = null;
	/** @type {ReturnType<typeof buildUnderworldRupture> | null} */
	let underworld = null;

	const flashGold = new MeshBasicMaterial({
		color: '#ff9a3c',
		transparent: true,
		opacity: 0,
		depthWrite: false,
		depthTest: false
	});
	const flashGoldQuad = new Mesh(new PlaneGeometry(6, 6), flashGold);
	flashGoldQuad.position.set(0.04, -0.03, 0.68);
	flashGoldQuad.visible = false;
	flashGoldQuad.frustumCulled = false;
	root.add(flashGoldQuad);

	const seaSplash = buildGodParticlePool(root, 36, createRng(deriveSeed(seed, 'sea')), SEA_HEX, [0.025, 0.07]);
	const hadesEmbers = buildGodParticlePool(root, 36, createRng(deriveSeed(seed, 'embers')), HADES_HEX, [
		0.02, 0.055
	]);

	return {
		allBolts,
		boltMain,
		boltGhost,
		boltSide,
		boltAfter,
		flashGold,
		flashGoldQuad,
		seaSplash,
		hadesEmbers,
		ensureTsunami() {
			if (!tsunami) tsunami = buildTsunami(root, createRng(deriveSeed(seed, 'tsunami')));
			return tsunami;
		},
		ensureUnderworld() {
			if (!underworld) underworld = buildUnderworldRupture(root, createRng(deriveSeed(seed, 'hades')), floorY);
			return underworld;
		},
		get tsunami() {
			return tsunami;
		},
		get underworld() {
			return underworld;
		},
		hideAll() {
			for (const b of allBolts) b.hide();
			tsunami?.hide();
			underworld?.hide();
			flashGold.opacity = 0;
			flashGoldQuad.visible = false;
		},
		pickGod() {
			return CRACK_GODS[Math.floor(Math.random() * CRACK_GODS.length)];
		}
	};
}
