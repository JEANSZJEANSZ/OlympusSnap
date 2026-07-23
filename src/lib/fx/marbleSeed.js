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
 * Wild silhouette params — different seeds must look OBVIOUSLY different.
 * Picks an archetype then randomizes hard.
 * @param {() => number} rng
 */
export function makeRockShape(rng) {
	/** @type {'menhir' | 'boulder' | 'wedge' | 'slab' | 'blob' | 'spire'} */
	const archetypes = ['menhir', 'boulder', 'wedge', 'slab', 'blob', 'spire'];
	const archetype = archetypes[Math.floor(rng() * archetypes.length)];

	/** @type {ReturnType<typeof baseShape>} */
	let shape = baseShape(rng);

	switch (archetype) {
		case 'menhir':
			/* Tall standing stone */
			shape.tallness = 0.75 + rng() * 0.25;
			shape.widthX = 0.55 + rng() * 0.25;
			shape.depthZ = 0.5 + rng() * 0.3;
			shape.taper = 0.35 + rng() * 0.25;
			shape.crown = 0.7 + rng() * 0.15;
			break;
		case 'boulder':
			/* Round fat rock */
			shape.tallness = 0.15 + rng() * 0.35;
			shape.widthX = 1.05 + rng() * 0.35;
			shape.depthZ = 0.95 + rng() * 0.35;
			shape.taper = 0.05 + rng() * 0.15;
			shape.baseR = 0.78 + rng() * 0.12;
			break;
		case 'wedge':
			/* Triangular / leaning shard */
			shape.tallness = 0.55 + rng() * 0.35;
			shape.widthX = 0.7 + rng() * 0.4;
			shape.depthZ = 0.45 + rng() * 0.35;
			shape.taper = 0.45 + rng() * 0.3;
			shape.leanX = (rng() < 0.5 ? -1 : 1) * (0.18 + rng() * 0.22);
			shape.amp2 = 0.22 + rng() * 0.15;
			break;
		case 'slab':
			/* Flat-ish plate on edge */
			shape.tallness = 0.45 + rng() * 0.35;
			shape.widthX = 1.15 + rng() * 0.4;
			shape.depthZ = 0.35 + rng() * 0.25;
			shape.taper = 0.1 + rng() * 0.2;
			shape.amp3 = 0.18 + rng() * 0.12;
			break;
		case 'blob':
			/* Lumpy amoeba */
			shape.tallness = 0.25 + rng() * 0.4;
			shape.widthX = 0.9 + rng() * 0.45;
			shape.depthZ = 0.85 + rng() * 0.4;
			shape.amp2 = 0.2 + rng() * 0.18;
			shape.amp3 = 0.16 + rng() * 0.14;
			shape.amp5 = 0.12 + rng() * 0.12;
			shape.amp7 = 0.08 + rng() * 0.1;
			shape.bite = 0.12 + rng() * 0.12;
			shape.chip = 0.35 + rng() * 0.35;
			break;
		case 'spire':
			/* Narrow peak */
			shape.tallness = 0.85 + rng() * 0.15;
			shape.widthX = 0.4 + rng() * 0.25;
			shape.depthZ = 0.4 + rng() * 0.3;
			shape.taper = 0.5 + rng() * 0.25;
			shape.crown = 0.55 + rng() * 0.2;
			shape.baseR = 0.55 + rng() * 0.15;
			break;
	}

	shape.archetype = archetype;
	/* Extra lobe for asymmetry — visible “second bump” on some seeds */
	shape.lobe = rng() > 0.45;
	shape.lobeAng = rng() * Math.PI * 2;
	shape.lobeR = 0.25 + rng() * 0.35;
	shape.lobeY = 0.2 + rng() * 0.55;
	return shape;
}

/**
 * @param {() => number} rng
 */
function baseShape(rng) {
	return {
		archetype: /** @type {string} */ ('boulder'),
		baseR: 0.58 + rng() * 0.28,
		amp2: 0.08 + rng() * 0.22,
		amp3: 0.06 + rng() * 0.2,
		amp5: 0.04 + rng() * 0.16,
		amp7: 0.02 + rng() * 0.12,
		phase2: rng() * Math.PI * 2,
		phase3: rng() * Math.PI * 2,
		phase5: rng() * Math.PI * 2,
		phase7: rng() * Math.PI * 2,
		tallness: rng(),
		widthX: 0.55 + rng() * 0.7,
		depthZ: 0.45 + rng() * 0.7,
		taper: 0.05 + rng() * 0.55,
		bite: 0.04 + rng() * 0.16,
		chip: 0.3 + rng() * 0.5,
		crown: 0.55 + rng() * 0.35,
		leanX: (rng() - 0.5) * 0.45,
		leanZ: (rng() - 0.5) * 0.35,
		lobe: false,
		lobeAng: 0,
		lobeR: 0.3,
		lobeY: 0.4
	};
}
