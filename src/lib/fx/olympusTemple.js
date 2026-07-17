/**
 * Olympus HERO layer — Temple of Apollo on a dense cloud mush (2.5D peek).
 * Edit this file for shrine art. Sky/cycle lives in olympusSkyDom.js + dayCycle.js.
 *
 * Hierarchy: templePivot → facade + flanks + roof/floor decks along −Z.
 * Pointer springs clamped yaw/pitch so guests can peek sides, never orbit behind.
 * Atmosphere: day birds + Apollo dust, night shooting stars + dusk fireflies.
 */
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Scene } from 'three';
import { DRIFT_HALF, nightAmount, wrapDrift } from './dayCycle.js';
import { MeshBasicMaterial, box, disposeScene, makeRenderer, smooth01 } from './pixelShared.js';

const _tintA = new Color();
const _tintB = new Color();
const _tintC = new Color();

/**
 * Soft day/night/noon material tint (closed loop via dayAmt).
 * @param {import('three').MeshBasicMaterial} mat
 * @param {string} dayHex
 * @param {string} nightHex
 * @param {string | undefined} noonHex
 * @param {number} dayAmt
 */
function applyDayTint(mat, dayHex, nightHex, noonHex, dayAmt) {
	_tintA.set(nightHex);
	_tintB.set(dayHex);
	_tintA.lerp(_tintB, dayAmt);
	if (noonHex && dayAmt > 0.55) {
		const noonMix = smooth01((dayAmt - 0.55) / 0.45) * 0.4;
		_tintC.set(noonHex);
		_tintA.lerp(_tintC, noonMix);
	}
	mat.color.copy(_tintA);
}

const HERO_PX = 1100;
const YAW_MAX = 0.28;
const PITCH_MAX = 0.08;
const SPRING = 10;
/* Keep cloud yaw close to temple so side peek doesn’t shear lobes through the floor */
const CLOUD_YAW = 0.85;

/** @param {number} phase */
function softWave(phase) {
	return 0.5 + 0.5 * Math.sin(phase);
}

/** Tiny day birds — V shapes that forever-drift (never despawn). */
function buildBird() {
	const g = new Group();
	const mat = new MeshBasicMaterial({
		color: '#1a2838',
		transparent: true,
		opacity: 0.55,
		depthWrite: false
	});
	box(g, -0.035, 0, 0, 0.045, 0.012, 0.02, mat);
	box(g, 0.035, 0, 0, 0.045, 0.012, 0.02, mat);
	box(g, 0, -0.01, 0, 0.022, 0.01, 0.02, mat);
	g.userData.mat = mat;
	return g;
}

/**
 * Shooting-star streak (head + trail). Parked off-screen when idle; opacity fade only.
 * @returns {{ group: Group, mats: import('three').MeshBasicMaterial[], life: number, maxLife: number, active: boolean, vx: number, vy: number }}
 */
function buildMeteor() {
	const group = new Group();
	const head = new MeshBasicMaterial({
		color: '#fff8e8',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const mid = new MeshBasicMaterial({
		color: '#dce8ff',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const tail = new MeshBasicMaterial({
		color: '#a8b8d8',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	box(group, 0, 0, 0, 0.028, 0.028, 0.02, head);
	box(group, -0.04, 0.03, 0, 0.05, 0.014, 0.015, mid);
	box(group, -0.1, 0.07, 0, 0.07, 0.01, 0.012, tail);
	box(group, -0.16, 0.11, 0, 0.05, 0.008, 0.01, tail);
	group.position.set(-8, 4, -6);
	return {
		group,
		mats: [head, mid, tail],
		life: 0,
		maxLife: 1.2,
		active: false,
		vx: -1.8,
		vy: -1.1
	};
}

/**
 * @param {Group} parent
 * @param {number} u
 */
function makeCell(parent, u) {
	/**
	 * @param {number} gx
	 * @param {number} gy
	 * @param {number} gw
	 * @param {number} gh
	 * @param {MeshBasicMaterial} mat
	 * @param {number} [z]
	 * @param {number} [d]
	 */
	return (gx, gy, gw, gh, mat, z = 0, d = 0.1) => {
		box(parent, gx * u, gy * u, z, gw * u, gh * u, d, mat);
	};
}

/**
 * Side colonnade bay along −Z (real depth, not fake X overhang).
 * @param {Group} flank
 * @param {number} side +1 right / -1 left
 * @param {number} u
 * @param {number} W facade grid width
 * @param {Record<string, MeshBasicMaterial>} mats
 */
function buildFlank(flank, side, u, W, mats) {
	const cell = makeCell(flank, u);
	const {
		marble,
		marbleLit,
		marbleMid,
		marbleDark,
		shade,
		aegean,
		aegeanDeep,
		terracotta,
		terracottaLit
	} = mats;

	const xEdge = side * 12.5;
	const bay = 0.155;
	const bays = 5;
	const depthEnd = -(bays * bay);
	const stripLen = bays * bay;
	const stripZ = depthEnd / 2;

	/* crepidoma side — three stepped tiers continuing back */
	for (let i = 1; i <= bays; i++) {
		const z = -i * bay;
		const stepD = bay * 0.95;
		cell(xEdge, -12.55, 2.2, 1.55, marbleMid, z, stepD);
		cell(xEdge, -11.15, 2.0, 1.45, marble, z, stepD);
		cell(xEdge, -9.85, 1.8, 1.35, marbleLit, z, stepD);
		cell(xEdge, -9.2, 1.7, 0.45, marbleMid, z + 0.01, stepD * 0.9);
	}

	/* Doric columns stepped back in −Z — square footprint so yaw reveals volume */
	for (let i = 1; i <= bays; i++) {
		const z = -i * bay;
		const cx = xEdge;
		const colW = 1.9;
		const colD = 1.9 * u;
		cell(cx, 6.8, 2.5, 0.6, marbleLit, z, colD);
		cell(cx, 6.2, 2.1, 0.6, marble, z, colD);
		cell(cx, -1.5, colW, 14.0, marbleMid, z, colD);
		cell(cx - side * 0.4, -1.5, 0.3, 13.6, marbleDark, z + 0.01, colD * 0.85);
		cell(cx + side * 0.4, -1.5, 0.3, 13.6, shade, z + 0.01, colD * 0.85);
		cell(cx, -8.55, 2.3, 0.75, marbleDark, z, colD);
	}

	/* architrave + polychrome frieze along flank */
	const stripThick = 1.5 * u;
	cell(xEdge, 7.65, 1.7, 1.3, marble, stripZ, stripLen);
	cell(xEdge, 7.1, 1.8, 0.3, marbleMid, stripZ, stripLen);

	for (let i = 1; i <= bays; i++) {
		const z = -i * bay;
		if (i % 2 === 1) {
			cell(xEdge, 9.3, 1.5, 2.2, aegean, z, stripThick);
			cell(xEdge, 9.3, 0.35, 2.0, aegeanDeep, z + 0.02, stripThick * 0.9);
			cell(xEdge, 8.15, 1.5, 0.28, aegeanDeep, z, stripThick);
		} else {
			cell(xEdge, 9.3, 1.5, 2.0, terracottaLit, z, stripThick);
			cell(xEdge, 9.3, 1.0, 1.4, terracotta, z + 0.02, stripThick * 0.9);
		}
	}

	cell(xEdge, 10.7, 1.8, 0.55, marbleLit, stripZ, stripLen);
	cell(xEdge, 11.15, 1.9, 0.35, marbleMid, stripZ, stripLen);

	/* roof eave + side slope — seals the sky hole when yaw peeks */
	cell(xEdge, 12.0, 2.2, 0.7, marble, stripZ, stripLen);
	cell(xEdge, 12.7, 1.8, 0.65, marbleLit, stripZ, stripLen * 0.95);
	cell(xEdge, 13.35, 1.3, 0.55, marbleMid, stripZ * 0.9, stripLen * 0.8);
	cell(xEdge - side * 0.35, 12.35, 0.45, 1.4, shade, stripZ, stripLen * 0.9);

	/* inner naos wall + floor ledge along the flank */
	cell(xEdge - side * 1.4, -1.5, 1.0, 13.5, shade, stripZ - 0.12, stripLen * 0.7);
	cell(xEdge - side * 0.9, -9.35, 1.6, 0.9, marbleMid, stripZ, stripLen * 0.85);
}

/**
 * Temple of Apollo at Delphi — 2.5D: facade + flanks + roof/floor/rear decks.
 * @returns {Group} templePivot
 */
export function buildTemple() {
	const pivot = new Group();
	const facade = new Group();
	const leftFlank = new Group();
	const rightFlank = new Group();
	pivot.add(facade);
	pivot.add(leftFlank);
	pivot.add(rightFlank);

	const marble = new MeshBasicMaterial({ color: '#f4f6fa' });
	const marbleLit = new MeshBasicMaterial({ color: '#ffffff' });
	const marbleMid = new MeshBasicMaterial({ color: '#d5dde8' });
	const marbleDark = new MeshBasicMaterial({ color: '#a8b4c4' });
	const shade = new MeshBasicMaterial({ color: '#8a96a8' });
	const pedimentBg = new MeshBasicMaterial({ color: '#4a5564' });
	const aegean = new MeshBasicMaterial({ color: '#0f4c81' });
	const aegeanDeep = new MeshBasicMaterial({ color: '#0a355c' });
	const terracotta = new MeshBasicMaterial({ color: '#8b3a2f' });
	const terracottaLit = new MeshBasicMaterial({ color: '#a84838' });
	const figure = new MeshBasicMaterial({ color: '#eef2f7' });
	const figureShade = new MeshBasicMaterial({ color: '#c5ceda' });

	const mats = {
		marble,
		marbleLit,
		marbleMid,
		marbleDark,
		shade,
		aegean,
		aegeanDeep,
		terracotta,
		terracottaLit
	};

	const u = 0.032;
	const W = 30;
	const cell = makeCell(facade, u);

	/*
	 * Depth budget (camera looks −Z; larger z = closer):
	 *   roof / floor decks ≈ −0.40 … −0.05  (close the volume when peeking)
	 *   naos cavity       ≈ −0.55 … −0.22
	 *   crepidoma steps   ≈  0.02 …  0.26   (lower step = closer + wider)
	 *   columns           ≈  0.10 …  0.22
	 *   pediment / figs   ≈  0.14 …  0.22
	 * Keep ≥ ~0.06 clear air between layers so yaw/pitch peek never Z-fights.
	 */
	const bay = 0.155;
	const bays = 5;
	const depth = bays * bay;
	const midZ = -depth / 2;
	const rearZ = -depth;

	/* ——— crepidoma: 3 real steps (tread + dark riser). Lower = wider + closer ——— */
	/* Step 1 — bottom */
	cell(0, -12.55, W + 7, 1.55, marbleMid, 0.18, 0.22);
	cell(0, -11.85, W + 7, 0.55, shade, 0.28, 0.06);
	/* Step 2 */
	cell(0, -11.15, W + 3.6, 1.45, marble, 0.1, 0.17);
	cell(0, -10.5, W + 3.6, 0.5, marbleDark, 0.18, 0.05);
	/* Step 3 — stylobate / porch floor */
	cell(0, -9.85, W + 0.6, 1.35, marbleLit, 0.03, 0.13);
	cell(0, -9.25, W + 0.6, 0.45, marbleMid, 0.1, 0.05);
	cell(0, -13.2, W + 7.6, 0.35, shade, 0.12, 0.14);

	/* ——— naos cavity walls (vertical recess behind the colonnade) ——— */
	cell(0, -0.2, W - 6, 14.5, shade, -0.55, 0.18);
	cell(0, -0.2, W - 10, 13, marbleDark, -0.4, 0.14);
	cell(0, 0.2, W - 14, 11, pedimentBg, -0.28, 0.12);

	/*
	 * Cella front — the architectural wall immediately behind the colonnade.
	 * It is split around a recessed doorway so it closes every open bay
	 * without reading as a flat, camera-facing backplate.
	 */
	const cellaFrontZ = -0.06;
	const cellaWallW = W - 3;
	const cellaWallH = 15.8;
	const cellaWallY = -0.55;
	const doorW = 5.4;
	const doorH = 11.8;
	const doorY = -2.5;
	const sideWallW = (cellaWallW - doorW) / 2;
	const sideWallX = (doorW + sideWallW) / 2;

	/* Side wall fields cover all intercolumniation gaps. */
	cell(-sideWallX, cellaWallY, sideWallW, cellaWallH, marbleMid, cellaFrontZ, 0.08);
	cell(sideWallX, cellaWallY, sideWallW, cellaWallH, marbleMid, cellaFrontZ, 0.08);
	/* Lintel closes the area above the doorway. */
	const lintelBottom = doorY + doorH / 2;
	const wallTop = cellaWallY + cellaWallH / 2;
	cell(0, (lintelBottom + wallTop) / 2, doorW, wallTop - lintelBottom, marble, cellaFrontZ, 0.08);

	/* Doorway backing sits deeper than the wall, preserving porch depth. */
	cell(0, doorY, doorW, doorH, pedimentBg, -0.2, 0.1);
	cell(-doorW / 2 - 0.3, doorY, 0.6, doorH + 0.5, marbleDark, -0.035, 0.07);
	cell(doorW / 2 + 0.3, doorY, 0.6, doorH + 0.5, marbleDark, -0.035, 0.07);
	cell(0, lintelBottom + 0.3, doorW + 1.2, 0.6, marbleLit, -0.03, 0.07);

	/* ——— interior floor — solid pad between columns (was open sky/void) ——— */
	cell(0, -9.45, W - 4, 1.15, marbleMid, midZ, depth * 0.9);
	cell(0, -9.05, W - 7, 0.55, marble, midZ + 0.02, depth * 0.8);
	cell(0, -9.65, W - 5, 0.4, shade, midZ - 0.02, depth * 0.85);

	/* ——— roof deck + ceiling — seals the open top when yaw peeks ——— */
	cell(0, 11.45, W - 1, 0.55, shade, midZ, depth * 0.95);
	cell(0, 12.05, W + 1.6, 0.85, marbleMid, midZ, depth);
	cell(0, 12.75, W + 0.4, 0.7, marble, midZ, depth * 0.95);
	cell(0, 13.4, W - 6, 0.55, marbleLit, midZ * 0.92, depth * 0.82);
	/* shallow pitch sides */
	cell(-10, 12.55, 8, 0.55, marbleMid, midZ, depth * 0.9);
	cell(10, 12.55, 8, 0.55, marbleMid, midZ, depth * 0.9);

	/* ——— rear wall — closes the cella when peeking past the columns ——— */
	cell(0, -0.5, W - 3, 15.5, marbleDark, rearZ - 0.03, 0.12);
	cell(0, 12.6, W - 1, 3.2, marble, rearZ, 0.1);
	cell(0, 14.2, W - 8, 2.2, marbleMid, rearZ, 0.09);

	/* ——— 6 Doric columns — fully in front of naos ——— */
	const cols = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];
	for (const cx of cols) {
		cell(cx, 6.8, 2.9, 0.65, marbleLit, 0.16, 0.1);
		cell(cx, 6.2, 2.4, 0.65, marble, 0.16, 0.1);
		cell(cx, -1.2, 2.1, 13.6, marble, 0.14, 0.12);
		cell(cx - 0.5, -1.2, 0.3, 13.2, marbleMid, 0.17, 0.08);
		cell(cx - 0.15, -1.2, 0.25, 13.2, marbleDark, 0.18, 0.07);
		cell(cx + 0.15, -1.2, 0.25, 13.2, marbleLit, 0.18, 0.07);
		cell(cx + 0.5, -1.2, 0.3, 13.2, marbleMid, 0.17, 0.08);
		/* bases sit on the top stylobate tread */
		cell(cx, -8.55, 2.5, 0.8, marbleDark, 0.15, 0.1);
		cell(cx, -9.05, 2.8, 0.4, shade, 0.13, 0.09);
	}

	/* ——— entablature ——— */
	cell(0, 7.65, W, 1.4, marble, 0.14, 0.1);
	cell(0, 7.1, W + 0.2, 0.35, marbleMid, 0.12, 0.09);

	cell(0, 9.3, W, 2.4, terracotta, 0.12, 0.09);
	const unit = 2.5;
	const count = 12;
	const frieze0 = -((count - 1) * unit) / 2;
	for (let i = 0; i < count; i++) {
		const x = frieze0 + i * unit;
		if (i % 2 === 0) {
			cell(x, 9.3, 1.15, 2.3, aegean, 0.15, 0.1);
			cell(x - 0.28, 9.3, 0.2, 2.1, aegeanDeep, 0.17, 0.08);
			cell(x, 9.3, 0.2, 2.1, aegeanDeep, 0.17, 0.08);
			cell(x + 0.28, 9.3, 0.2, 2.1, aegeanDeep, 0.17, 0.08);
			cell(x, 8.15, 1.15, 0.3, aegeanDeep, 0.16, 0.08);
		} else {
			cell(x, 9.3, 1.2, 2.1, terracottaLit, 0.15, 0.09);
			cell(x, 9.3, 0.85, 1.5, terracotta, 0.16, 0.08);
		}
	}

	cell(0, 10.7, W + 0.8, 0.65, marbleLit, 0.14, 0.1);
	cell(0, 11.15, W + 1.2, 0.4, marbleMid, 0.12, 0.09);

	/* ——— pediment — rim in front, dark tympanum recessed behind ——— */
	const pedSteps = [
		[0, 20.2, 3.2, 1.4],
		[0, 18.9, 6.6, 1.4],
		[0, 17.6, 10, 1.4],
		[0, 16.3, 13.4, 1.4],
		[0, 15.0, 16.8, 1.4],
		[0, 13.7, 20.2, 1.4],
		[0, 12.4, 23.6, 1.4],
		[0, 11.55, W - 2, 1.1]
	];
	for (const [gx, gy, gw, gh] of pedSteps) {
		cell(gx, gy, gw + 0.8, gh, marble, 0.16, 0.1);
		if (gw > 6) cell(gx, gy - 0.5, gw - 2.4, gh * 0.8, pedimentBg, 0.04, 0.08);
	}

	/** @type {[number, number, number, number, MeshBasicMaterial][]} */
	const sculptures = [
		[0, 15.0, 1.5, 5.0, figure],
		[0, 17.9, 1.3, 1.2, figure],
		[-0.4, 15.0, 0.3, 4.4, figureShade],
		[0.4, 15.0, 0.3, 4.4, figureShade],
		[-1.2, 16.2, 1.2, 0.4, figure],
		[1.2, 16.2, 1.2, 0.4, figure],
		[-4.0, 14.2, 1.3, 4.0, figure],
		[-4.0, 16.6, 1.1, 1.0, figure],
		[4.0, 14.2, 1.3, 4.0, figure],
		[4.0, 16.6, 1.1, 1.0, figure],
		[-7.0, 13.2, 1.4, 2.5, figureShade],
		[7.0, 13.2, 1.4, 2.5, figureShade],
		[-9.6, 12.4, 2.0, 1.4, figureShade],
		[9.6, 12.4, 2.0, 1.4, figureShade],
		[-2.1, 13.8, 1.0, 3.2, figureShade],
		[2.1, 13.8, 1.0, 3.2, figureShade]
	];
	for (const [gx, gy, gw, gh, mat] of sculptures) {
		cell(gx, gy, gw, gh, mat, 0.2, 0.08);
	}

	cell(0, 21.8, 1.1, 0.9, marbleLit, 0.18, 0.09);
	cell(0, 22.7, 1.6, 0.65, marble, 0.18, 0.09);
	cell(-0.65, 23.3, 0.4, 1.1, marbleMid, 0.19, 0.08);
	cell(0.65, 23.3, 0.4, 1.1, marbleMid, 0.19, 0.08);
	cell(0, 24.0, 0.65, 0.65, marbleLit, 0.2, 0.08);
	cell(-(W / 2) + 0.5, 11.9, 1.3, 1.1, marble, 0.17, 0.09);
	cell(-(W / 2) + 0.5, 12.8, 0.9, 0.9, marbleLit, 0.18, 0.08);
	cell(W / 2 - 0.5, 11.9, 1.3, 1.1, marble, 0.17, 0.09);
	cell(W / 2 - 0.5, 12.8, 0.9, 0.9, marbleLit, 0.18, 0.08);

	/* Apollo glint — pediment apex flash (opacity driven in tick) */
	const glintMat = new MeshBasicMaterial({
		color: '#ffe08a',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const glint = new Group();
	box(glint, 0, 0, 0, 0.05, 0.05, 0.03, glintMat);
	box(glint, 0, 0.04, 0.01, 0.028, 0.028, 0.02, glintMat);
	box(glint, -0.04, 0, 0, 0.035, 0.012, 0.02, glintMat);
	box(glint, 0.04, 0, 0, 0.035, 0.012, 0.02, glintMat);
	box(glint, 0, -0.04, 0, 0.012, 0.03, 0.02, glintMat);
	glint.position.set(0, 24.6 * u, 0.22);
	facade.add(glint);

	/* real Z flanks — visible only when yaw peeks */
	buildFlank(leftFlank, -1, u, W, mats);
	buildFlank(rightFlank, 1, u, W, mats);

	pivot.rotation.order = 'YXZ';
	/** Closed-loop tint slots — day / noon gold / night cool */
	pivot.userData.tintSlots = [
		{ mat: marble, day: '#f4f6fa', noon: '#fff2d8', night: '#b8c4d4' },
		{ mat: marbleLit, day: '#ffffff', noon: '#fff8e8', night: '#c8d4e4' },
		{ mat: marbleMid, day: '#d5dde8', noon: '#e8dcc8', night: '#8a9ab0' },
		{ mat: marbleDark, day: '#a8b4c4', noon: '#c4b098', night: '#6a7a90' },
		{ mat: shade, day: '#8a96a8', noon: '#9a8a78', night: '#4a5868' },
		{ mat: figure, day: '#eef2f7', noon: '#fff0dc', night: '#b0bcc8' },
		{ mat: figureShade, day: '#c5ceda', noon: '#d8c8b0', night: '#7a8a9c' },
		{ mat: terracotta, day: '#8b3a2f', noon: '#a84830', night: '#5a2830' },
		{ mat: terracottaLit, day: '#a84838', noon: '#c06040', night: '#6a3038' },
		{ mat: aegean, day: '#0f4c81', noon: '#1a5a90', night: '#0a2848' },
		{ mat: aegeanDeep, day: '#0a355c', noon: '#124868', night: '#061828' }
	];
	pivot.userData.glintMat = glintMat;
	pivot.userData.glint = glint;
	return pivot;
}

/**
 * One continuous cloud mush under the temple — packed lobes, no gaps.
 * Edge wisps peel off and drift for wind life.
 */
export function buildCloudMush() {
	const g = new Group();
	/* Cool bank only — warm sand tones were reading as brown slabs when they Z-fought the floor */
	const lit = new MeshBasicMaterial({
		color: '#f8fbff',
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const litSoft = new MeshBasicMaterial({
		color: '#eef4fb',
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});
	const mid = new MeshBasicMaterial({
		color: '#dde8f4',
		polygonOffset: true,
		polygonOffsetFactor: 2,
		polygonOffsetUnits: 2
	});
	const midCool = new MeshBasicMaterial({
		color: '#c4d6ea',
		polygonOffset: true,
		polygonOffsetFactor: 2,
		polygonOffsetUnits: 2
	});
	const shade = new MeshBasicMaterial({
		color: '#9eb4cc',
		polygonOffset: true,
		polygonOffsetFactor: 3,
		polygonOffsetUnits: 3
	});
	const deep = new MeshBasicMaterial({
		color: '#7a92b0',
		polygonOffset: true,
		polygonOffsetFactor: 4,
		polygonOffsetUnits: 4
	});
	const u = 0.042;
	const cell = makeCell(g, u);

	/**
	 * One pixel-cumulus puff: a deep body, bright crown, and shaded belly.
	 * Overlapping these clusters makes a scalloped silhouette while the
	 * staggered Z/depth values expose real volume during pointer yaw.
	 * @param {number} gx
	 * @param {number} gy
	 * @param {number} gw
	 * @param {number} gh
	 * @param {number} z
	 * @param {MeshBasicMaterial} body
	 * @param {MeshBasicMaterial} cap
	 * @param {number} depth
	 */
	function puff(gx, gy, gw, gh, z, body, cap, depth) {
		cell(gx, gy, gw, gh, body, z, depth);
		cell(
			gx - gw * 0.08,
			gy + gh * 0.34,
			gw * 0.68,
			gh * 0.38,
			cap,
			z + depth * 0.22,
			depth * 0.68
		);
		cell(
			gx + gw * 0.08,
			gy - gh * 0.34,
			gw * 0.76,
			gh * 0.3,
			body === shade || body === deep ? deep : shade,
			z + depth * 0.16,
			depth * 0.74
		);
	}

	/**
	 * Back crown: pale, high puffs frame the temple without covering its pad.
	 * @type {[number, number, number, number, number, MeshBasicMaterial, MeshBasicMaterial, number][]}
	 */
	const backPuffs = [
		[-15.5, -0.5, 8.5, 4.1, -0.28, midCool, litSoft, 0.26],
		[-10.2, 0.3, 10, 4.8, -0.26, mid, lit, 0.3],
		[-4.3, 0.75, 10.5, 5.1, -0.24, midCool, litSoft, 0.32],
		[2.3, 0.65, 11.5, 5.2, -0.25, mid, lit, 0.32],
		[8.8, 0.25, 10.5, 4.7, -0.26, midCool, litSoft, 0.3],
		[15, -0.7, 8.5, 4, -0.28, mid, lit, 0.26]
	];

	/**
	 * Front crown: brighter, staggered puffs create the near scalloped rim.
	 * @type {[number, number, number, number, number, MeshBasicMaterial, MeshBasicMaterial, number][]}
	 */
	const frontPuffs = [
		[-18, -1.7, 7, 4.1, -0.04, midCool, litSoft, 0.22],
		[-14, -0.8, 8.5, 4.8, -0.02, mid, lit, 0.26],
		[-8.8, -0.45, 9, 5.1, 0, midCool, litSoft, 0.28],
		[-3.2, -0.65, 9.5, 4.7, 0.01, mid, lit, 0.29],
		[2.4, -0.55, 10, 4.9, 0.01, midCool, litSoft, 0.29],
		[8.2, -0.4, 9.2, 5, 0, mid, lit, 0.28],
		[13.5, -0.9, 8.5, 4.7, -0.02, midCool, litSoft, 0.26],
		[18, -1.8, 6.8, 3.9, -0.04, mid, lit, 0.22]
	];

	/**
	 * Deep hanging lobes give the bank a soft, irregular underbelly.
	 * @type {[number, number, number, number, number, MeshBasicMaterial, MeshBasicMaterial, number][]}
	 */
	const bellyPuffs = [
		[-15, -4.2, 8.5, 3.7, -0.2, shade, midCool, 0.28],
		[-9.5, -4.5, 10, 4.1, -0.17, shade, mid, 0.31],
		[-3.2, -4.8, 11.5, 4.4, -0.15, deep, midCool, 0.32],
		[3.8, -4.7, 11.5, 4.3, -0.14, shade, mid, 0.32],
		[10.3, -4.4, 9.8, 4, -0.17, deep, midCool, 0.3],
		[15.5, -4, 8, 3.5, -0.2, shade, mid, 0.27]
	];

	for (const def of [...backPuffs, ...bellyPuffs, ...frontPuffs]) {
		const [gx, gy, gw, gh, z, body, cap, depth] = def;
		puff(gx, gy, gw, gh, z, body, cap, depth);
	}

	/*
	 * Small contact pad only: hidden under the crepidoma, it gives the temple
	 * a stable nest without restoring the old full-width platform silhouette.
	 */
	cell(0, 1.15, 22, 1.15, litSoft, -0.09, 0.2);
	cell(0, 0.7, 25, 0.7, mid, -0.12, 0.24);

	/* Edge wisps — peel off the bank, forever loop off-screen */
	/** @type {Group[]} */
	const wisps = [];
	const wispMat = new MeshBasicMaterial({
		color: '#eef4fc',
		transparent: true,
		opacity: 0.45,
		depthWrite: false
	});
	const wispDefs = [
		{ x: -0.85, y: 0.12, speed: 0.06, phase: 0.2 },
		{ x: 0.9, y: 0.08, speed: 0.05, phase: 1.4 },
		{ x: -0.55, y: 0.18, speed: 0.07, phase: 2.1 },
		{ x: 0.65, y: 0.15, speed: 0.055, phase: 3.3 },
		{ x: 0.1, y: 0.22, speed: 0.045, phase: 4.0 }
	];
	for (const def of wispDefs) {
		const w = new Group();
		box(w, 0, 0, 0, 0.12, 0.05, 0.04, wispMat);
		box(w, 0.06, 0.02, 0.01, 0.08, 0.04, 0.03, wispMat);
		box(w, -0.05, 0.01, 0, 0.07, 0.035, 0.03, wispMat);
		w.position.set(def.x, def.y, 0.12);
		w.userData.baseX = def.x;
		w.userData.baseY = def.y;
		w.userData.speed = def.speed;
		w.userData.phase = def.phase;
		wisps.push(w);
		g.add(w);
	}

	g.userData.tintSlots = [
		{ mat: lit, day: '#f8fbff', noon: '#f6f8fc', night: '#6a7a90' },
		{ mat: litSoft, day: '#eef4fb', noon: '#e8eef6', night: '#5a6a80' },
		{ mat: mid, day: '#dde8f4', noon: '#d4dce8', night: '#5a6a80' },
		{ mat: midCool, day: '#c4d6ea', noon: '#b8c8dc', night: '#4a5a70' },
		{ mat: shade, day: '#9eb4cc', noon: '#8fa4bc', night: '#3a4a5c' },
		{ mat: deep, day: '#7a92b0', noon: '#6e86a4', night: '#2a3848' },
		{ mat: wispMat, day: '#eef4fc', noon: '#e8eef8', night: '#5a6a80' }
	];
	g.userData.wisps = wisps;
	g.userData.wispMat = wispMat;
	return g;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ reduced?: boolean }} [opts]
 */
export function createOlympusTemple(canvas, opts = {}) {
	const reduced = !!opts.reduced;
	const scene = new Scene();
	const layer = makeRenderer(canvas, HERO_PX, true);

	const olympus = new Group();
	olympus.position.set(0, -0.38, -2.2);

	const cloudMush = buildCloudMush();
	/* Cloud bank behind + below stylobate so yaw peek can’t Z-fight the floor */
	cloudMush.position.set(0, -0.5, -0.18);
	olympus.add(cloudMush);

	const templePivot = buildTemple();
	templePivot.position.set(0, -0.02, 0.22);
	templePivot.scale.setScalar(0.95);
	templePivot.rotation.set(0, 0, 0);
	olympus.add(templePivot);

	scene.add(olympus);

	/* —— Apollo day dust (gold sparkle around temple) —— */
	const dustCount = 36;
	const dustGeo = new BoxGeometry(0.018, 0.018, 0.018);
	const dustMat = new MeshBasicMaterial({ color: '#e8c84a', transparent: true, opacity: 0, depthWrite: false });
	const dust = new InstancedMesh(dustGeo, dustMat, dustCount);
	const matrix = new Matrix4();
	/** @type {{ x: number, y: number, z: number, sp: number, ph: number }[]} */
	const dustData = [];
	for (let i = 0; i < dustCount; i++) {
		dustData.push({
			x: (Math.random() - 0.5) * 1.6,
			y: Math.random() * 1.0 - 0.2,
			z: -1.4 - Math.random() * 0.8,
			sp: 0.08 + Math.random() * 0.12,
			ph: Math.random() * Math.PI * 2
		});
	}
	scene.add(dust);

	/* —— Day birds: forever belt above the temple, dim at night —— */
	/** @type {Group[]} */
	const birds = [];
	for (let i = 0; i < 4; i++) {
		const bird = buildBird();
		const bx = -2.4 + i * 1.5;
		bird.position.set(bx, 0.85 + (i % 3) * 0.14, -3.2 - i * 0.15);
		bird.userData.baseX = bx;
		bird.userData.baseY = 0.85 + (i % 3) * 0.14;
		bird.userData.speed = 0.14 + i * 0.035;
		bird.userData.phase = i * 1.7;
		birds.push(bird);
		scene.add(bird);
	}

	/* —— Night shooting stars: soft fade streaks, spawn off-screen —— */
	/** @type {ReturnType<typeof buildMeteor>[]} */
	const meteors = [];
	for (let i = 0; i < 3; i++) {
		const m = buildMeteor();
		meteors.push(m);
		scene.add(m.group);
	}
	let meteorCooldown = 1.2 + Math.random() * 2;
	/** Apollo pediment glint — rare short flash near noon */
	let glintLife = 0;
	let glintCooldown = 4 + Math.random() * 6;

	/* —— Dusk/dawn fireflies: soft gold motes, peak at twilight —— */
	const flyCount = 18;
	const flyGeo = new BoxGeometry(0.014, 0.014, 0.014);
	const flyMat = new MeshBasicMaterial({
		color: '#e8d060',
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const fireflies = new InstancedMesh(flyGeo, flyMat, flyCount);
	/** @type {{ x: number, y: number, z: number, sp: number, ph: number }[]} */
	const flyData = [];
	for (let i = 0; i < flyCount; i++) {
		flyData.push({
			x: (Math.random() - 0.5) * 2.4,
			y: -0.1 + Math.random() * 1.1,
			z: -2.0 - Math.random() * 1.2,
			sp: 0.5 + Math.random() * 1.4,
			ph: Math.random() * Math.PI * 2
		});
	}
	scene.add(fireflies);

	let mx = 0.5;
	let my = 0.5;
	let elapsed = 0;
	let yaw = 0;
	let pitch = 0;

	return {
		resize: () => layer.resize(2.35),
		/** @param {number} x @param {number} y */
		setPointer(x, y) {
			mx = x;
			my = y;
		},
		/**
		 * @param {number} dt
		 * @param {number} nowElapsed
		 * @param {number} day 0..1 for dust brightness
		 */
		tick(dt, nowElapsed, day = 0.5) {
			elapsed = nowElapsed;
			const k = 1 - Math.exp(-dt * SPRING);

			if (!reduced) {
				const targetYaw = (mx - 0.5) * 2 * YAW_MAX;
				const targetPitch = (0.5 - my) * 2 * PITCH_MAX;
				yaw += (targetYaw - yaw) * k;
				pitch += (targetPitch - pitch) * k;

				templePivot.rotation.y = yaw;
				templePivot.rotation.x = pitch;
				cloudMush.rotation.y = yaw * CLOUD_YAW;

				const bob = Math.sin(elapsed * 0.65) * 0.04;
				const sway = Math.sin(elapsed * 0.4) * 0.03;
				olympus.position.y = -0.38 + bob;
				olympus.position.x = sway + (mx - 0.5) * 0.08;
				olympus.rotation.z = 0;
				/* Soft breath — keep Y/scale small so mush never climbs into the floor */
				const inhale = Math.sin(elapsed * 0.32) * 0.014;
				cloudMush.position.y = -0.5 + Math.sin(elapsed * 0.85 + 1) * 0.008;
				cloudMush.scale.set(1 + inhale, 1 + Math.sin(elapsed * 0.55) * 0.012, 1);
			} else {
				yaw = 0;
				pitch = 0;
				templePivot.rotation.set(0, 0, 0);
				cloudMush.rotation.y = 0;
				cloudMush.position.y = -0.5;
				cloudMush.scale.set(1, 1, 1);
				olympus.position.set(0, -0.38, -2.2);
				olympus.rotation.z = 0;
			}

			/* Shared continuous day/night from closed loop — no hard gates */
			const nightAmt = nightAmount(day);
			const dayAmt = 1 - nightAmt;
			/* Twilight band peaks when nightAmt is mid (dusk/dawn) */
			const twilight = smooth01(1 - Math.abs(nightAmt - 0.45) / 0.45);

			/* Temple warm-up / cool-down — same dayAmt as sky */
			for (const slot of /** @type {{ mat: import('three').MeshBasicMaterial, day: string, noon: string, night: string }[]} */ (
				templePivot.userData.tintSlots || []
			)) {
				applyDayTint(slot.mat, slot.day, slot.night, slot.noon, dayAmt);
			}
			for (const slot of /** @type {{ mat: import('three').MeshBasicMaterial, day: string, noon: string, night: string }[]} */ (
				cloudMush.userData.tintSlots || []
			)) {
				applyDayTint(slot.mat, slot.day, slot.night, slot.noon, dayAmt);
			}

			/* Edge wisps peel off the cloud bank (forever loop) */
			const wisps = /** @type {Group[]} */ (cloudMush.userData.wisps || []);
			const wispMat = /** @type {import('three').MeshBasicMaterial | undefined} */ (
				cloudMush.userData.wispMat
			);
			if (wispMat) wispMat.opacity = 0.2 + dayAmt * 0.35;
			for (const w of wisps) {
				if (!reduced) {
					const drift = wrapDrift(w.userData.baseX + elapsed * w.userData.speed, 1.35);
					w.position.x = drift;
					w.position.y =
						w.userData.baseY + Math.sin(elapsed * 0.7 + w.userData.phase) * 0.04;
					w.scale.setScalar(0.75 + softWave(elapsed * 0.5 + w.userData.phase) * 0.35);
				}
			}

			/* Apollo pediment glint — rare 1–2s flash when sun is high */
			const glintMat = /** @type {import('three').MeshBasicMaterial | undefined} */ (
				templePivot.userData.glintMat
			);
			if (glintMat) {
				if (!reduced && dayAmt > 0.82) {
					if (glintLife > 0) {
						glintLife -= dt;
						const u = 1 - glintLife / 1.4;
						let fade = 1;
						if (u < 0.2) fade = smooth01(u / 0.2);
						else if (u > 0.55) fade = smooth01((1 - u) / 0.45);
						glintMat.opacity = fade * 0.95 * dayAmt;
						const g = /** @type {Group} */ (templePivot.userData.glint);
						if (g) g.scale.setScalar(0.9 + fade * 0.35);
					} else {
						glintMat.opacity = 0;
						glintCooldown -= dt;
						if (glintCooldown <= 0) {
							glintLife = 1.1 + Math.random() * 0.6;
							glintCooldown = 8 + Math.random() * 14;
						}
					}
				} else {
					glintMat.opacity = Math.max(0, glintMat.opacity - dt * 2);
					glintLife = 0;
				}
			}

			const tw = reduced ? 0.7 : 0.55 + 0.45 * softWave(elapsed * 1.2);
			const dustAmt = Math.max(0.02, dayAmt * 0.7 * tw);
			dustMat.opacity = dustAmt;
			for (let i = 0; i < dustCount; i++) {
				const d = dustData[i];
				const y = d.y + (reduced ? 0 : Math.sin(elapsed * d.sp + d.ph) * 0.09);
				const x = d.x + (reduced ? 0 : Math.cos(elapsed * d.sp * 0.7 + d.ph) * 0.04);
				const sc = reduced ? 1 : 0.75 + 0.35 * softWave(elapsed * d.sp * 1.4 + d.ph);
				matrix.makeScale(sc, sc, 1);
				matrix.setPosition(x + (mx - 0.5) * 0.12, y + (my - 0.5) * 0.06, d.z);
				dust.setMatrixAt(i, matrix);
			}
			dust.instanceMatrix.needsUpdate = true;

			/* Birds — forever drift; soft day dim; never despawn */
			for (const bird of birds) {
				const bOp = 0.06 + dayAmt * 0.55;
				bird.userData.mat.opacity = bOp;
				if (!reduced) {
					bird.position.x = wrapDrift(bird.userData.baseX + elapsed * bird.userData.speed, DRIFT_HALF);
					bird.position.y =
						bird.userData.baseY +
						Math.sin(elapsed * 1.8 + bird.userData.phase) * 0.08 +
						Math.sin(elapsed * 0.4 + bird.userData.phase) * 0.05;
					bird.scale.y = 1 + Math.sin(elapsed * 6 + bird.userData.phase) * 0.28;
				}
			}

			/* Shooting stars — spawn off-screen at night, fade out off-screen */
			if (!reduced) {
				meteorCooldown -= dt;
				if (meteorCooldown <= 0 && nightAmt > 0.45) {
					const idle = meteors.find((m) => !m.active);
					if (idle) {
						idle.active = true;
						idle.life = 0;
						idle.maxLife = 0.85 + Math.random() * 0.7;
						idle.vx = -1.6 - Math.random() * 1.2;
						idle.vy = -0.9 - Math.random() * 0.7;
						idle.group.position.set(
							1.6 + Math.random() * 1.4,
							1.1 + Math.random() * 0.55,
							-4.5 - Math.random() * 1.2
						);
						const ang = Math.atan2(idle.vy, idle.vx);
						idle.group.rotation.z = ang;
					}
					meteorCooldown = 2.2 + Math.random() * 4.5 * (1.4 - nightAmt);
				}
			}
			for (const m of meteors) {
				if (!m.active) {
					for (const mat of m.mats) mat.opacity = 0;
					continue;
				}
				m.life += dt;
				const u = m.life / m.maxLife;
				/* Soft envelope: creep in, hold, fade out — no hard pop */
				let fade = 1;
				if (u < 0.12) fade = smooth01(u / 0.12);
				else if (u > 0.65) fade = smooth01((1 - u) / 0.35);
				fade *= nightAmt;
				if (!reduced) {
					m.group.position.x += m.vx * dt;
					m.group.position.y += m.vy * dt;
				}
				m.mats[0].opacity = fade;
				m.mats[1].opacity = fade * 0.65;
				m.mats[2].opacity = fade * 0.35;
				if (u >= 1 || m.group.position.x < -3.5 || m.group.position.y < -1.2) {
					m.active = false;
					for (const mat of m.mats) mat.opacity = 0;
					m.group.position.set(-8, 4, -6);
				}
			}

			/* Fireflies — peak at twilight, soft twinkle, always in scene */
			const flyAmt = twilight * 0.55 * (reduced ? 0.7 : 0.6 + softWave(elapsed * 0.9) * 0.4);
			flyMat.opacity = Math.max(0.02, flyAmt);
			for (let i = 0; i < flyCount; i++) {
				const f = flyData[i];
				const blink = reduced ? 0.85 : 0.45 + 0.55 * softWave(elapsed * f.sp + f.ph);
				const y = f.y + (reduced ? 0 : Math.sin(elapsed * f.sp * 0.6 + f.ph) * 0.12);
				const x = f.x + (reduced ? 0 : Math.cos(elapsed * f.sp * 0.4 + f.ph) * 0.1);
				const sc = 0.6 + blink * 0.7;
				matrix.makeScale(sc, sc, 1);
				matrix.setPosition(x + (mx - 0.5) * 0.08, y + (my - 0.5) * 0.05, f.z);
				fireflies.setMatrixAt(i, matrix);
			}
			fireflies.instanceMatrix.needsUpdate = true;

			layer.camera.position.x = reduced ? 0 : (mx - 0.5) * 0.06;
			layer.camera.position.y = reduced ? 0 : (my - 0.5) * 0.04;
			layer.renderer.render(scene, layer.camera);
		},
		dispose() {
			disposeScene(scene);
			layer.renderer.dispose();
		}
	};
}
