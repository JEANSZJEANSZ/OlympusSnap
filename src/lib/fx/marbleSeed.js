/**
 * Marble ritual seeds — unique boulder per guest visit.
 * Always mint a fresh seed when a gift enters the marble phase.
 * Optional session cache only for same SPA remount with explicit seed prop.
 */
const STORAGE_KEY = 'olympus-snap-marble-seed';

/**
 * FNV-1a 32-bit hash → unsigned int seed.
 * @param {string} str
 */
export function hashString(str) {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/**
 * Mulberry-style LCG. Deterministic float RNG in [0, 1).
 * @param {number} seed
 */
export function createRng(seed) {
	let s = seed >>> 0;
	if (!s) s = 0x9e3779b9;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/**
 * Child seed from parent + label (bolt, rubble, veins, …).
 * @param {number} parent
 * @param {string} label
 */
export function deriveSeed(parent, label) {
	return hashString(`${parent >>> 0}:${label}`);
}

/**
 * Mint a brand-new unique seed (call once when gift → marble phase).
 * @param {string} [portraitUrl]
 */
export function mintMarbleSeed(portraitUrl = '') {
	const slice =
		(portraitUrl || '').slice(32, 180) +
		(portraitUrl || '').slice(-120) +
		String(portraitUrl?.length || 0);
	const seed = hashString(
		`${Date.now()}-${performance.now()}-${Math.random().toString(36).slice(2)}-${slice}`
	);
	try {
		sessionStorage.setItem(STORAGE_KEY, String(seed));
	} catch {
		/* private mode */
	}
	return seed;
}

/**
 * @deprecated Prefer mintMarbleSeed on each marble enter — cached seeds look “static”.
 * @param {string} [portraitUrl]
 */
export function resolveMarbleSeed(portraitUrl = '') {
	return mintMarbleSeed(portraitUrl);
}

/** Drop seed so the next ritual gets a new boulder. */
export function clearMarbleSeed() {
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		/* ignore */
	}
}

/**
 * @typedef {{ ox: number, oy: number, oz: number, rx: number, ry: number, rz: number }} RockLobe
 * @typedef {{ nx: number, ny: number, nz: number, thresh: number }} RockFacet
 */

/**
 * Gravity-sensible lumpy boulder params — freer silhouettes per seed.
 * Primary mass straddles center; fused lobes settle low; SDF knobs vary by archetype.
 * @param {() => number} rng
 */
export function makeRockShape(rng) {
	/** @type {'boulder' | 'mound' | 'overhang' | 'chunk' | 'ridge'} */
	const archetypes = ['boulder', 'mound', 'overhang', 'chunk', 'ridge'];
	const archetype = archetypes[Math.floor(rng() * archetypes.length)];

	/** @type {ReturnType<typeof baseShape>} */
	let shape = baseShape(rng);

	switch (archetype) {
		case 'mound':
			/* Very squat, wide foot, soft fusion, low CoM */
			shape.tallness = 0.12 + rng() * 0.14;
			shape.widthX = 1.05 + rng() * 0.16;
			shape.depthZ = 1.0 + rng() * 0.16;
			shape.taper = 0.48 + rng() * 0.28;
			shape.baseR = 1.0 + rng() * 0.1;
			shape.crown = 0.62 + rng() * 0.16;
			shape.noise = 0.14 + rng() * 0.14;
			shape.chip = 0.62 + rng() * 0.28;
			shape.comY = 0.28 + rng() * 0.06;
			shape.fillBias = 0.48 + rng() * 0.06;
			shape.squashY = 0.78 + rng() * 0.1;
			shape.sminK = 0.22 + rng() * 0.08;
			shape.facetStrength = 0.1 + rng() * 0.2;
			shape.lobeCount = 2;
			break;
		case 'boulder':
			/* Classic lumpy mid mass */
			shape.tallness = 0.28 + rng() * 0.22;
			shape.widthX = 0.9 + rng() * 0.26;
			shape.depthZ = 0.82 + rng() * 0.26;
			shape.taper = 0.22 + rng() * 0.28;
			shape.baseR = 0.9 + rng() * 0.14;
			shape.crown = 0.68 + rng() * 0.2;
			shape.noise = 0.22 + rng() * 0.22;
			shape.chip = 0.45 + rng() * 0.35;
			shape.comY = 0.32 + rng() * 0.08;
			shape.fillBias = 0.5 + rng() * 0.06;
			shape.squashY = 0.85 + rng() * 0.18;
			shape.sminK = 0.14 + rng() * 0.12;
			shape.facetStrength = 0.25 + rng() * 0.35;
			shape.lobeCount = 2 + (rng() > 0.4 ? 1 : 0) + (rng() > 0.85 ? 1 : 0);
			break;
		case 'chunk':
			/* Blockier, stronger facets, more shell chips */
			shape.tallness = 0.32 + rng() * 0.23;
			shape.widthX = 0.86 + rng() * 0.28;
			shape.depthZ = 0.76 + rng() * 0.28;
			shape.taper = 0.18 + rng() * 0.26;
			shape.baseR = 0.88 + rng() * 0.14;
			shape.crown = 0.64 + rng() * 0.22;
			shape.noise = 0.28 + rng() * 0.22;
			shape.chip = 0.32 + rng() * 0.32;
			shape.comY = 0.34 + rng() * 0.08;
			shape.fillBias = 0.48 + rng() * 0.08;
			shape.squashY = 0.88 + rng() * 0.2;
			shape.sminK = 0.12 + rng() * 0.1;
			shape.facetStrength = 0.45 + rng() * 0.3;
			shape.lobeCount = 2 + (rng() > 0.35 ? 1 : 0) + (rng() > 0.75 ? 1 : 0);
			break;
		case 'ridge':
			/* Long X / thin Z, 3 lobes along the spine */
			shape.tallness = 0.2 + rng() * 0.22;
			shape.widthX = 1.1 + rng() * 0.16;
			shape.depthZ = 0.55 + rng() * 0.18;
			shape.taper = 0.28 + rng() * 0.24;
			shape.baseR = 0.94 + rng() * 0.1;
			shape.crown = 0.58 + rng() * 0.2;
			shape.noise = 0.2 + rng() * 0.2;
			shape.chip = 0.5 + rng() * 0.3;
			shape.comY = 0.3 + rng() * 0.08;
			shape.fillBias = 0.48 + rng() * 0.06;
			shape.squashY = 0.8 + rng() * 0.16;
			shape.sminK = 0.14 + rng() * 0.12;
			shape.facetStrength = 0.3 + rng() * 0.35;
			shape.lobeCount = 3;
			break;
		case 'overhang':
			/* Strong lean + flank undercut + biased side lobe */
			shape.tallness = 0.3 + rng() * 0.25;
			shape.widthX = 0.92 + rng() * 0.24;
			shape.depthZ = 0.78 + rng() * 0.24;
			shape.taper = 0.2 + rng() * 0.24;
			shape.baseR = 0.9 + rng() * 0.12;
			shape.crown = 0.66 + rng() * 0.2;
			shape.noise = 0.24 + rng() * 0.2;
			shape.chip = 0.4 + rng() * 0.35;
			shape.overhang = 0.45 + rng() * 0.4;
			shape.overhangSide = rng() < 0.5 ? -1 : 1;
			shape.comY = 0.33 + rng() * 0.09;
			shape.fillBias = 0.5 + rng() * 0.06;
			shape.squashY = 0.86 + rng() * 0.18;
			shape.sminK = 0.14 + rng() * 0.12;
			shape.facetStrength = 0.28 + rng() * 0.35;
			shape.lobeCount = 2 + (rng() > 0.4 ? 1 : 0);
			break;
	}

	shape.archetype = archetype;

	/* Freer lean — counterbalanced by opposite-side lobes below */
	shape.leanX = (rng() - 0.5) * 0.56;
	shape.leanZ = (rng() - 0.5) * 0.28;

	shape.facets = makeFacets(rng, 2 + (rng() > 0.45 ? 1 : 0));
	shape.lobes = makeLobes(rng, archetype, shape);

	/* Legacy single-lobe fields unused by metaball path — keep for safety */
	shape.lobe = false;
	shape.lobeAng = 0;
	shape.lobeR = 0.15;
	shape.lobeY = 0.35;

	return shape;
}

/**
 * Seeded facet planes — replace fixed normals in inRock.
 * @param {() => number} rng
 * @param {number} count
 * @returns {RockFacet[]}
 */
function makeFacets(rng, count) {
	/** @type {RockFacet[]} */
	const facets = [];
	const n = Math.max(2, Math.min(3, count | 0));
	for (let i = 0; i < n; i++) {
		let nx = rng() * 2 - 1;
		let ny = (rng() - 0.55) * 1.4;
		let nz = rng() * 2 - 1;
		const len = Math.hypot(nx, ny, nz) || 1;
		nx /= len;
		ny /= len;
		nz /= len;
		facets.push({
			nx,
			ny,
			nz,
			thresh: 0.62 + rng() * 0.28
		});
	}
	return facets;
}

/**
 * Per-archetype lobe recipes — freer offsets, crack-fair counter-lobes.
 * @param {() => number} rng
 * @param {string} archetype
 * @param {ReturnType<typeof baseShape>} shape
 * @returns {RockLobe[]}
 */
function makeLobes(rng, archetype, shape) {
	/** @type {RockLobe[]} */
	const lobes = [];
	const overhangSide = shape.overhangSide || 1;

	if (archetype === 'mound') {
		/* 2 small low side bumps */
		for (const side of [-1, 1]) {
			lobes.push({
				ox: side * (0.12 + rng() * 0.16),
				oy: -0.55 - rng() * 0.3,
				oz: (rng() - 0.5) * 0.2,
				rx: 0.18 + rng() * 0.16,
				ry: 0.14 + rng() * 0.14,
				rz: 0.16 + rng() * 0.16
			});
		}
	} else if (archetype === 'ridge') {
		/* 3 lobes spaced along X spine */
		const xs = [-0.28 - rng() * 0.1, (rng() - 0.5) * 0.08, 0.28 + rng() * 0.1];
		for (let i = 0; i < 3; i++) {
			lobes.push({
				ox: xs[i],
				oy: -0.35 + rng() * 0.45,
				oz: (rng() - 0.5) * 0.16,
				rx: 0.22 + rng() * 0.18,
				ry: 0.2 + rng() * 0.22,
				rz: 0.16 + rng() * 0.14
			});
		}
	} else if (archetype === 'overhang') {
		/* Large lobe on overhang side + smaller counter-lobe */
		lobes.push({
			ox: overhangSide * (0.28 + rng() * 0.2),
			oy: -0.15 + rng() * 0.35,
			oz: (rng() - 0.5) * 0.28,
			rx: 0.38 + rng() * 0.28,
			ry: 0.28 + rng() * 0.26,
			rz: 0.3 + rng() * 0.26
		});
		lobes.push({
			ox: -overhangSide * (0.16 + rng() * 0.16),
			oy: -0.5 + rng() * 0.3,
			oz: (rng() - 0.5) * 0.22,
			rx: 0.22 + rng() * 0.18,
			ry: 0.18 + rng() * 0.16,
			rz: 0.2 + rng() * 0.18
		});
		if (shape.lobeCount > 2) {
			lobes.push({
				ox: (rng() - 0.5) * 0.35,
				oy: -0.45 + rng() * 0.4,
				oz: (rng() - 0.5) * 0.32,
				rx: 0.2 + rng() * 0.2,
				ry: 0.16 + rng() * 0.18,
				rz: 0.18 + rng() * 0.2
			});
		}
	} else {
		/* boulder / chunk — 2–4 freer lobes */
		const n = Math.max(2, Math.min(4, shape.lobeCount | 0));
		for (let i = 0; i < n; i++) {
			const side = i % 2 === 0 ? (rng() < 0.55 ? -1 : 1) : rng() < 0.5 ? 1 : -1;
			const low = 0.05 + rng() * 0.5;
			lobes.push({
				ox: side * (0.16 + rng() * 0.3),
				oy: low * 2 - 1,
				oz: (rng() - 0.5) * 0.4,
				rx: 0.28 + rng() * 0.32,
				ry: 0.2 + rng() * 0.28,
				rz: 0.24 + rng() * 0.3
			});
		}
		if (archetype === 'chunk') {
			lobes[0].rx *= 1.22;
			lobes[0].ry *= 0.9;
			lobes[0].rz *= 1.15;
		} else {
			lobes[0].rx *= 1.15;
			lobes[0].ry *= 1.08;
			lobes[0].rz *= 1.08;
		}
	}

	/* Strong lean → ensure opposite half still has a lobe */
	if (Math.abs(shape.leanX) > 0.12) {
		const leanSide = shape.leanX > 0 ? 1 : -1;
		const hasCounter = lobes.some((L) => L.ox * leanSide < -0.08);
		if (!hasCounter) {
			lobes.push({
				ox: -leanSide * (0.22 + rng() * 0.2),
				oy: -0.4 + rng() * 0.35,
				oz: (rng() - 0.5) * 0.25,
				rx: 0.28 + rng() * 0.2,
				ry: 0.22 + rng() * 0.18,
				rz: 0.24 + rng() * 0.2
			});
		}
	}

	return lobes;
}

/**
 * Seeded Carrara vein + cream body params — unique marble grain per visit.
 * Independent of rock silhouette (`deriveSeed(seed, 'tex')`).
 * @param {() => number} rng
 */
export function makeMarbleTexture(rng) {
	/* Prefer diagonal sweeps; occasional steeper or flatter grain */
	const angle = (rng() - 0.5) * 1.4;
	const cosA = Math.cos(angle);
	const sinA = Math.sin(angle);
	return {
		/* UV rotation for vein direction */
		cosA,
		sinA,
		/* Primary ribbon */
		pFreqU: 4.2 + rng() * 3.6,
		pFreqV: 1.6 + rng() * 2.4,
		pWarp: 1.1 + rng() * 1.4,
		pWarpV: 2.6 + rng() * 2.4,
		pWarpW: 0.6 + rng() * 1.4,
		pFreqW: 0.5 + rng() * 1.2,
		pPhase: rng() * Math.PI * 2,
		pSharp: 2.8 + rng() * 1.4,
		pWeight: 0.82 + rng() * 0.14,
		/* Secondary sweep */
		sFreqU: 1.4 + rng() * 2.0,
		sFreqV: 6.5 + rng() * 4.0,
		sFreqW: 1.4 + rng() * 2.0,
		sPhase: rng() * Math.PI * 2,
		sSharp: 3.6 + rng() * 1.6,
		sWeight: 0.4 + rng() * 0.3,
		/* Fine hairline veins */
		hFreq: 10 + rng() * 10,
		hWarp: 0.9 + rng() * 1.4,
		hPhase: rng() * Math.PI * 2,
		hSharp: 4.5 + rng() * 2.0,
		hWeight: 0.18 + rng() * 0.22,
		/* Density thresholds — how much grey shows */
		veinDark: 0.72 + rng() * 0.12,
		veinSoft: 0.5 + rng() * 0.14,
		/* Soft cream body banding */
		bFreqX: 0.1 + rng() * 0.14,
		bFreqY: 0.04 + rng() * 0.1,
		bFreqY2: 0.06 + rng() * 0.1,
		bFreqX2: 0.03 + rng() * 0.08,
		bPhase: rng() * Math.PI * 2,
		bPhase2: rng() * Math.PI * 2,
		whiteBias: 0.5 + rng() * 0.16,
		creamBias: 0.26 + rng() * 0.14
	};
}

/**
 * @param {() => number} rng
 */
function baseShape(rng) {
	return {
		archetype: /** @type {string} */ ('boulder'),
		baseR: 0.9 + rng() * 0.12,
		amp2: 0.14 + rng() * 0.2,
		amp3: 0.12 + rng() * 0.18,
		amp5: 0.08 + rng() * 0.14,
		amp7: 0.05 + rng() * 0.1,
		phase2: rng() * Math.PI * 2,
		phase3: rng() * Math.PI * 2,
		phase5: rng() * Math.PI * 2,
		phase7: rng() * Math.PI * 2,
		tallness: 0.35,
		widthX: 1.05,
		depthZ: 0.95,
		taper: 0.4,
		bite: 0.04 + rng() * 0.06,
		chip: 0.55 + rng() * 0.3,
		crown: 0.76,
		leanX: 0,
		leanZ: 0,
		noise: 0.16,
		overhang: 0,
		overhangSide: 1,
		lobeCount: 2,
		comY: 0.34,
		fillBias: 0.56,
		squashY: 0.92,
		sminK: 0.18,
		facetStrength: 0.35,
		/** @type {RockFacet[]} */
		facets: [],
		/** @type {RockLobe[]} */
		lobes: [],
		lobe: false,
		lobeAng: 0,
		lobeR: 0.15,
		lobeY: 0.4
	};
}
