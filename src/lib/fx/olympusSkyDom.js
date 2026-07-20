/**
 * DOM sky layer — gradient wash, sun/moon, stars, mountains, drifting clouds.
 * Shared day clock drives all tints; clouds wrap only off-screen.
 */
import { Color } from 'three';
import { DRIFT_HALF, createDayClock, sampleKey, wrapDrift } from './dayCycle.js';

/** @param {number} phase */
function softWave(phase) {
	return 0.5 + 0.5 * Math.sin(phase);
}

/**
 * Continuous hex lerp (no stepped color-mix jumps).
 * @param {string} a
 * @param {string} b
 * @param {number} t 0..1 toward b
 */
function lerpHex(a, b, t) {
	const ca = new Color(a);
	const cb = new Color(b);
	return ca.lerp(cb, Math.min(1, Math.max(0, t))).getStyle();
}

/**
 * Map world drift x → CSS left %.
 * At ±DRIFT_HALF the puff is fully off-screen so wrap is invisible.
 * @param {number} driftX
 */
function driftToLeftPct(driftX) {
	/* ±65% from center ⇒ ~-15% … 115% — past both edges */
	return 50 + (driftX / DRIFT_HALF) * 65;
}

const SKY_CSS = `
.olympus-sky {
	position: absolute;
	inset: 0;
	overflow: hidden;
	z-index: 0;
	image-rendering: pixelated;
	image-rendering: crisp-edges;
	pointer-events: none;
}
.olympus-sky .sky-wash {
	position: absolute;
	inset: 0;
	background: linear-gradient(to bottom, var(--sky-zenith, #4a98d0) 0%, var(--sky-horizon, #e8f0ff) 72%);
}
.olympus-sky .sky-stars {
	position: absolute;
	inset: 0;
}
.olympus-sky .sky-star {
	position: absolute;
	width: 3px;
	height: 3px;
	background: #fff;
	box-shadow: 0 0 2px #dce8ff;
	transform: translate(-50%, -50%);
}
.olympus-sky .sky-star.sparkle {
	width: 5px;
	height: 5px;
	clip-path: polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%);
}
.olympus-sky .sky-star.cross {
	width: 4px;
	height: 4px;
	box-shadow:
		0 -4px 0 #fff,
		0 4px 0 #fff,
		-4px 0 0 #fff,
		4px 0 0 #fff,
		0 0 2px #dce8ff;
	background: transparent;
}
.olympus-sky .sky-sun,
.olympus-sky .sky-moon {
	position: absolute;
	left: 50%;
	top: 40%;
	transform: translate(-50%, -50%);
	will-change: left, top, opacity, transform;
	opacity: 0;
}
.olympus-sky .sky-sun svg,
.olympus-sky .sky-moon svg {
	display: block;
	image-rendering: pixelated;
}
.olympus-sky .sky-puffs {
	position: absolute;
	inset: 0;
	overflow: hidden;
}
.olympus-sky .sky-puff {
	position: absolute;
	transform: translate(-50%, -50%);
	opacity: 0.5;
	will-change: left, top, opacity;
	--puff-tint: #e8f0fa;
	--puff-shade: #c8d4e4;
	--puff-lit: #f8fafc;
}
.olympus-sky .sky-puff svg {
	display: block;
	image-rendering: pixelated;
	overflow: visible;
}
.olympus-sky .sky-mtn {
	position: absolute;
	left: -4%;
	right: -4%;
	bottom: 0;
	will-change: transform;
}
.olympus-sky .sky-mtn svg {
	display: block;
	width: 100%;
	height: 100%;
}
.olympus-sky .sky-mtn.far { height: 34%; bottom: 3%; z-index: 1; opacity: 0.92; }
.olympus-sky .sky-mtn.mid { height: 38%; bottom: 0; z-index: 2; }
.olympus-sky .sky-mtn.near { height: 42%; bottom: -3%; z-index: 3; }
`;

/*
 * Cumulus silhouettes — one path per cloud (scalloped outline), plus shade/lit.
 * Reads as a cloud, not loose circles or flat bars.
 */
const CLOUD_SVG = {
	wispy: `<svg width="128" height="48" viewBox="0 0 64 24" aria-hidden="true">
		<path fill="var(--puff-shade)" d="M8,18 C6,18 4,16 5,14 C3,13 3,10 6,10 C6,7 9,5 13,6 C15,3 20,2 24,4 C28,1 34,2 37,5 C41,3 46,4 48,7 C52,6 56,8 55,12 C58,13 58,17 55,18 Z"/>
		<path fill="var(--puff-tint)" d="M9,17 C7,17 5,15 6,13 C4,12 4,9 7,9 C7,6 10,4 14,5 C16,2 21,1 25,3 C29,0 35,1 38,4 C42,2 47,3 49,6 C53,5 57,7 56,11 C59,12 59,16 56,17 Z"/>
		<path fill="var(--puff-lit)" d="M14,10 C13,7 17,5 21,6 C23,3 28,3 31,6 C34,4 38,5 39,8 C36,7 32,8 30,10 C26,8 20,8 14,10 Z"/>
	</svg>`,
	flat: `<svg width="152" height="52" viewBox="0 0 76 26" aria-hidden="true">
		<path fill="var(--puff-shade)" d="M6,20 C3,20 1,17 3,14 C0,13 1,9 5,9 C5,5 10,3 15,4 C18,1 24,0 29,2 C34,-1 42,0 46,3 C51,1 58,2 61,5 C66,4 72,7 70,12 C74,13 74,18 70,20 Z"/>
		<path fill="var(--puff-tint)" d="M7,19 C4,19 2,16 4,13 C1,12 2,8 6,8 C6,4 11,2 16,3 C19,0 25,-1 30,1 C35,-2 43,-1 47,2 C52,0 59,1 62,4 C67,3 73,6 71,11 C75,12 75,17 71,19 Z"/>
		<path fill="var(--puff-lit)" d="M16,11 C15,7 20,5 25,6 C28,3 34,2 39,5 C43,3 48,4 50,7 C46,6 42,7 39,9 C33,6 24,7 16,11 Z"/>
	</svg>`,
	stack: `<svg width="120" height="68" viewBox="0 0 60 34" aria-hidden="true">
		<path fill="var(--puff-shade)" d="M8,26 C5,26 3,23 5,20 C2,19 2,14 7,14 C7,10 12,8 17,9 C19,5 25,3 31,5 C36,2 43,4 45,8 C50,7 55,10 54,15 C58,16 58,22 54,25 C52,28 44,29 36,28 C28,30 16,29 8,26 Z"/>
		<path fill="var(--puff-tint)" d="M9,25 C6,25 4,22 6,19 C3,18 3,13 8,13 C8,9 13,7 18,8 C20,4 26,2 32,4 C37,1 44,3 46,7 C51,6 56,9 55,14 C59,15 59,21 55,24 C53,27 45,28 37,27 C29,29 17,28 9,25 Z"/>
		<path fill="var(--puff-lit)" d="M18,14 C17,9 23,6 29,7 C32,3 39,3 42,8 C38,7 34,8 32,11 C28,8 22,9 18,14 Z"/>
		<path fill="var(--puff-lit)" d="M26,8 C26,5 30,3 34,5 C33,7 30,8 26,8 Z"/>
	</svg>`,
	chunk: `<svg width="104" height="46" viewBox="0 0 52 23" aria-hidden="true">
		<path fill="var(--puff-shade)" d="M6,17 C3,17 2,14 4,12 C1,11 2,7 6,7 C6,4 10,2 15,3 C17,0 23,-1 27,2 C31,0 36,1 38,4 C42,3 47,5 46,9 C49,10 49,15 45,17 Z"/>
		<path fill="var(--puff-tint)" d="M7,16 C4,16 3,13 5,11 C2,10 3,6 7,6 C7,3 11,1 16,2 C18,-1 24,-2 28,1 C32,-1 37,0 39,3 C43,2 48,4 47,8 C50,9 50,14 46,16 Z"/>
		<path fill="var(--puff-lit)" d="M14,9 C13,5 18,3 23,4 C26,1 31,2 33,5 C29,4 26,5 24,7 C20,5 16,6 14,9 Z"/>
	</svg>`
};

/** @param {string} dayTint */
function cloudShade(dayTint) {
	return lerpHex(dayTint, '#9eb0c4', 0.35);
}

/** @param {string} dayTint */
function cloudLit(dayTint) {
	return lerpHex(dayTint, '#ffffff', 0.45);
}

const SUN_SVG = `<svg width="48" height="48" viewBox="0 0 16 16" aria-hidden="true">
	<rect x="7" y="0" width="2" height="2" fill="#e8dfd0"/>
	<rect x="6" y="2" width="4" height="1" fill="#e8dfd0"/>
	<rect x="5" y="3" width="6" height="2" fill="#e8dfd0"/>
	<rect x="4" y="5" width="8" height="2" fill="#e8dfd0"/>
	<rect x="3" y="7" width="10" height="2" fill="#f5f1e6"/>
	<rect x="3" y="9" width="10" height="2" fill="#d2c1a5"/>
	<rect x="4" y="11" width="8" height="2" fill="#b8a890"/>
	<rect x="5" y="13" width="6" height="1" fill="#b8a890"/>
	<rect x="0" y="7" width="2" height="2" fill="#e8dfd0"/>
	<rect x="14" y="7" width="2" height="2" fill="#e8dfd0"/>
	<rect x="7" y="14" width="2" height="2" fill="#e8dfd0"/>
</svg>`;

const MOON_SVG = `<svg width="40" height="40" viewBox="0 0 14 14" aria-hidden="true">
	<rect x="3" y="2" width="8" height="1" fill="#f0f4ff"/>
	<rect x="2" y="3" width="10" height="1" fill="#f0f4ff"/>
	<rect x="2" y="4" width="10" height="2" fill="#c8d4e8"/>
	<rect x="2" y="6" width="10" height="2" fill="#f0f4ff"/>
	<rect x="2" y="8" width="10" height="2" fill="#c8d4e8"/>
	<rect x="3" y="10" width="8" height="1" fill="#f0f4ff"/>
	<rect x="4" y="11" width="6" height="1" fill="#c8d4e8"/>
	<rect x="5" y="5" width="2" height="1" fill="#6a7a90"/>
	<rect x="7" y="8" width="2" height="1" fill="#6a7a90"/>
	<rect x="1" y="4" width="3" height="6" fill="#8a9ab0" opacity="0.85"/>
</svg>`;

/*
 * Olympus range — Mytikas-led central massif, broad shoulders, soft snow haze.
 * Snow fills are cool blue-grey (never bright white).
 */
const MTN_FAR = `<svg viewBox="0 0 480 140" preserveAspectRatio="none" aria-hidden="true">
	<path d="M0,140 L0,98 L40,88 L70,95 L105,72 L140,82 L175,58 L210,70 L245,45 L280,62 L315,40 L350,55 L385,38 L420,52 L455,42 L480,48 L480,140 Z" fill="var(--mtn-fill, #8aacc4)"/>
	<path d="M160,78 L175,58 L195,68 L210,70 L245,45 L265,58 L245,78 Z" fill="var(--mtn-snow, #9eb8cc)" opacity="0.55"/>
	<path d="M300,62 L315,40 L340,55 L315,70 Z" fill="var(--mtn-snow, #9eb8cc)" opacity="0.45"/>
</svg>`;

const MTN_MID = `<svg viewBox="0 0 480 160" preserveAspectRatio="none" aria-hidden="true">
	<!-- foothills -->
	<path d="M0,160 L0,118 L55,108 L110,115 L165,100 L220,110 L275,95 L330,108 L385,98 L440,110 L480,105 L480,160 Z" fill="var(--mtn-shade, #5a829e)"/>
	<!-- main Olympus spine — tall central Mytikas -->
	<path d="M0,160 L20,120 L55,105 L90,118 L125,88 L155,100 L185,70 L215,85 L240,48 L270,72 L300,55 L335,78 L370,62 L405,85 L440,70 L470,90 L480,85 L480,160 Z" fill="var(--mtn-fill, #6a92ae)"/>
	<!-- snow caps -->
	<path d="M215,85 L240,48 L262,68 L240,88 Z" fill="var(--mtn-snow, #a8c4d6)" opacity="0.65"/>
	<path d="M285,72 L300,55 L318,68 L300,82 Z" fill="var(--mtn-snow, #a8c4d6)" opacity="0.5"/>
	<path d="M165,100 L185,70 L205,88 L185,105 Z" fill="var(--mtn-snow, #a8c4d6)" opacity="0.4"/>
</svg>`;

const MTN_NEAR = `<svg viewBox="0 0 480 180" preserveAspectRatio="none" aria-hidden="true">
	<!-- near ridge — quieter so temple stays focus -->
	<path d="M0,180 L0,130 L50,118 L95,128 L140,100 L185,115 L230,88 L275,108 L320,78 L365,100 L410,90 L450,108 L480,100 L480,180 Z" fill="var(--mtn-fill, #5a84a0)"/>
	<path d="M0,180 L0,148 L80,140 L160,150 L240,135 L320,148 L400,138 L480,145 L480,180 Z" fill="var(--mtn-shade, #4a7490)" opacity="0.85"/>
	<path d="M210,108 L230,88 L255,100 L230,118 Z" fill="var(--mtn-snow, #b4ccdc)" opacity="0.45"/>
	<path d="M300,100 L320,78 L345,95 L320,112 Z" fill="var(--mtn-snow, #b4ccdc)" opacity="0.4"/>
</svg>`;

/**
 * Closed-loop mountain palettes (t=0 === t=1) — same clock as SKY_KEYS.
 * Soft blue haze through dawn/dusk; never snaps to black.
 */
const MTN_LOOP = {
	far: {
		fill: [
			{ t: 0.0, c: '#3a5068' },
			{ t: 0.2, c: '#5a7890' },
			{ t: 0.32, c: '#7a9cb4' },
			{ t: 0.5, c: '#8aacc4' },
			{ t: 0.7, c: '#6a8ca8' },
			{ t: 0.82, c: '#4a6480' },
			{ t: 1.0, c: '#3a5068' }
		],
		snow: [
			{ t: 0.0, c: '#4a6580' },
			{ t: 0.32, c: '#8aacc0' },
			{ t: 0.5, c: '#9eb8cc' },
			{ t: 0.78, c: '#6a849c' },
			{ t: 1.0, c: '#4a6580' }
		],
		shade: [
			{ t: 0.0, c: '#2e4458' },
			{ t: 0.5, c: '#6a8ca4' },
			{ t: 1.0, c: '#2e4458' }
		]
	},
	mid: {
		fill: [
			{ t: 0.0, c: '#344e64' },
			{ t: 0.22, c: '#4a6a84' },
			{ t: 0.4, c: '#5a88a4' },
			{ t: 0.52, c: '#6a92ae' },
			{ t: 0.72, c: '#4a708c' },
			{ t: 0.86, c: '#3a5a74' },
			{ t: 1.0, c: '#344e64' }
		],
		snow: [
			{ t: 0.0, c: '#4e6a82' },
			{ t: 0.5, c: '#a8c4d6' },
			{ t: 1.0, c: '#4e6a82' }
		],
		shade: [
			{ t: 0.0, c: '#2c4458' },
			{ t: 0.5, c: '#5a829e' },
			{ t: 1.0, c: '#2c4458' }
		]
	},
	near: {
		fill: [
			{ t: 0.0, c: '#2e4860' },
			{ t: 0.24, c: '#3a5a74' },
			{ t: 0.48, c: '#5a84a0' },
			{ t: 0.74, c: '#3a607c' },
			{ t: 1.0, c: '#2e4860' }
		],
		snow: [
			{ t: 0.0, c: '#506878' },
			{ t: 0.5, c: '#b4ccdc' },
			{ t: 1.0, c: '#506878' }
		],
		shade: [
			{ t: 0.0, c: '#243848' },
			{ t: 0.5, c: '#4a7490' },
			{ t: 1.0, c: '#243848' }
		]
	}
};

/** Closed-loop cloud body tint (t=0 === t=1) */
const CLOUD_LOOP = [
	{ t: 0.0, c: '#6a7a90' },
	{ t: 0.22, c: '#c8b8a8' },
	{ t: 0.35, c: '#e8f0fa' },
	{ t: 0.5, c: '#f4f7fb' },
	{ t: 0.68, c: '#e8d8c8' },
	{ t: 0.8, c: '#a89080' },
	{ t: 0.92, c: '#6a7a90' },
	{ t: 1.0, c: '#6a7a90' }
];

/**
 * @param {{ x: number, y: number }} xy
 */
function celestialToCSS(xy) {
	const left = 50 + (xy.x / 2.85) * 48;
	const top = 72 - xy.y * 55;
	return { left: `${left}%`, top: `${top}%` };
}

/**
 * @param {HTMLElement} parent
 * @param {string} className
 * @param {string} [html]
 */
function layer(parent, className, html = '') {
	const el = document.createElement('div');
	el.className = className;
	if (html) el.innerHTML = html;
	parent.appendChild(el);
	return el;
}

/**
 * Sample mountain colors from the closed day loop (same clock as sky wash).
 * @param {number} day
 * @param {HTMLElement} mtn
 * @param {typeof MTN_LOOP.far} loop
 */
function tintMountain(day, mtn, loop) {
	mtn.style.setProperty('--mtn-fill', sampleKey(loop.fill, day, 'c'));
	mtn.style.setProperty('--mtn-snow', sampleKey(loop.snow, day, 'c'));
	mtn.style.setProperty('--mtn-shade', sampleKey(loop.shade, day, 'c'));
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

	const wash = layer(root, 'sky-wash');
	const starsEl = layer(root, 'sky-stars');
	const sunEl = layer(root, 'sky-sun', SUN_SVG);
	const moonEl = layer(root, 'sky-moon', MOON_SVG);
	const puffsEl = layer(root, 'sky-puffs');
	const mtnFar = layer(root, 'sky-mtn far', MTN_FAR);
	const mtnMid = layer(root, 'sky-mtn mid', MTN_MID);
	const mtnNear = layer(root, 'sky-mtn near', MTN_NEAR);

	/** @type {{ el: HTMLElement, baseLeft: number, baseTop: number, tw: number, twSpeed: number, bright: number }[]} */
	const stars = [];
	const starKinds = ['', '', 'cross', 'cross', 'sparkle', 'sparkle'];
	for (let i = 0; i < 92; i++) {
		const star = document.createElement('span');
		const kind = starKinds[i % starKinds.length];
		star.className = `sky-star${kind ? ` ${kind}` : ''}`;
		const baseLeft = 8 + Math.random() * 84;
		const baseTop = 5 + Math.random() * 55;
		star.style.left = `${baseLeft}%`;
		star.style.top = `${baseTop}%`;
		starsEl.appendChild(star);
		stars.push({
			el: star,
			baseLeft,
			baseTop,
			tw: Math.random() * Math.PI * 2,
			twSpeed: 0.55 + Math.random() * 1.1,
			bright: kind === 'sparkle' ? 1 : 0.55 + Math.random() * 0.4
		});
	}

	/* Spread across full drift belt so the sky never looks empty mid-wrap */
	const puffDefs = [
		{ kind: /** @type {const} */ ('wispy'), tint: '#e8f0fa', x: -4.8, y: 42, scale: 1.35 },
		{ kind: /** @type {const} */ ('flat'), tint: '#f4f7fb', x: -3.2, y: 36, scale: 1.45 },
		{ kind: /** @type {const} */ ('stack'), tint: '#dce8f4', x: -1.6, y: 48, scale: 1.25 },
		{ kind: /** @type {const} */ ('chunk'), tint: '#fff0d8', x: -0.2, y: 38, scale: 1.3 },
		{ kind: /** @type {const} */ ('stack'), tint: '#e0e8f0', x: 1.4, y: 44, scale: 1.4 },
		{ kind: /** @type {const} */ ('flat'), tint: '#eef4fc', x: 3.0, y: 32, scale: 1.2 },
		{ kind: /** @type {const} */ ('wispy'), tint: '#f8fafc', x: 4.6, y: 34, scale: 1.15 },
		{ kind: /** @type {const} */ ('chunk'), tint: '#e8f0fa', x: -5.4, y: 28, scale: 1.1 },
		{ kind: /** @type {const} */ ('stack'), tint: '#dce8f4', x: 2.2, y: 40, scale: 1.35 }
	];

	/**
	 * @type {{
	 *   el: HTMLElement,
	 *   baseX: number,
	 *   baseY: number,
	 *   speed: number,
	 *   dayTint: string,
	 *   nightTint: string,
	 *   x: number
	 * }[]}
	 */
	const puffs = [];
	for (const def of puffDefs) {
		const puff = document.createElement('div');
		puff.className = 'sky-puff';
		puff.style.left = `${driftToLeftPct(def.x)}%`;
		puff.style.top = `${def.y}%`;
		puff.style.transform = `translate(-50%, -50%) scale(${def.scale})`;
		puff.innerHTML = CLOUD_SVG[def.kind];
		puff.style.setProperty('--puff-tint', def.tint);
		puff.style.setProperty('--puff-lit', cloudLit(def.tint));
		puff.style.setProperty('--puff-shade', cloudShade(def.tint));
		puffsEl.appendChild(puff);
		puffs.push({
			el: puff,
			baseX: def.x,
			baseY: def.y,
			speed: 0.022 + Math.random() * 0.038,
			dayTint: def.tint,
			nightTint: def.tint === '#fff0d8' ? '#6a5a50' : '#6a7a90',
			x: def.x,
			scale: def.scale
		});
	}

	const clock = createDayClock({ reduced });
	let mx = 0.5;
	let my = 0.4;
	let elapsed = 0;
	/** Accumulated scrub — wheel nudge also drifts clouds so they stay in sync with day */
	let scrubDrift = 0;

	return {
		/** @param {number} d @param {boolean} [immediate] */
		setDay(d, immediate = false) {
			clock.setDay(d, immediate);
		},
		/** @param {number} delta */
		nudgeDay(delta) {
			clock.nudgeDay(delta);
			/* Push clouds toward the exit edge with the scrub so they don't pop */
			scrubDrift += delta * 14;
		},
		getDay: () => clock.getDay(),
		/** @param {number} x @param {number} y */
		setPointer(x, y) {
			mx = x;
			my = y;
		},
		resize() {},
		/**
		 * @param {number} dt
		 * @param {number} nowElapsed
		 */
		tick(dt, nowElapsed) {
			elapsed = nowElapsed;
			clock.tick(dt);
			const s = clock.sample();

			root.style.setProperty('--sky-zenith', s.zenith);
			root.style.setProperty('--sky-horizon', s.horizon);
			wash.style.background = `linear-gradient(to bottom, ${s.zenith} 0%, ${s.horizon} 72%)`;

			/* Sun — opacity fade only; park off-frame when inactive */
			if (s.showSun && s.sunFade > 0.01) {
				const pos = celestialToCSS(s.sunXY);
				sunEl.style.left = pos.left;
				sunEl.style.top = pos.top;
				const scale =
					(0.88 + Math.sin(s.sunT * Math.PI) * 0.24) * (0.55 + s.sunFade * 0.45);
				sunEl.style.opacity = String(s.sunFade);
				sunEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
			} else {
				sunEl.style.left = '-12%';
				sunEl.style.opacity = '0';
			}

			/* Moon — same soft exit */
			if (s.showMoon && s.moonFade > 0.01) {
				const pos = celestialToCSS(s.moonXY);
				moonEl.style.left = pos.left;
				moonEl.style.top = pos.top;
				const scale =
					(0.92 + Math.sin(s.moonT * Math.PI) * 0.2) * (0.85 + s.moonFade * 0.15);
				moonEl.style.opacity = String(s.moonFade);
				moonEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
			} else {
				moonEl.style.left = '112%';
				moonEl.style.opacity = '0';
			}

			/* Stars — forever twinkle; dim by shared nightAmt, never hidden */
			for (const star of stars) {
				const tw = reduced
					? 0.85
					: 0.72 + 0.28 * softWave(elapsed * star.twSpeed + star.tw);
				const gate = 0.14 + s.nightAmt * 0.86;
				const op = Math.min(1, Math.max(0.12, gate * star.bright * tw));
				star.el.style.opacity = String(op);
				const parX = (mx - 0.5) * -1.2;
				const parY = (my - 0.5) * -0.6;
				star.el.style.left = `${star.baseLeft + parX}%`;
				star.el.style.top = `${star.baseTop + parY}%`;
			}

			/* Mountains — closed day loop (same clock as sky wash) */
			const px = mx - 0.5;
			mtnFar.style.transform = `translate3d(${px * -12}px, 0, 0)`;
			mtnMid.style.transform = `translate3d(${px * -8}px, 0, 0)`;
			mtnNear.style.transform = `translate3d(${px * -5}px, 0, 0)`;
			tintMountain(s.day, mtnFar, MTN_LOOP.far);
			tintMountain(s.day, mtnMid, MTN_LOOP.mid);
			tintMountain(s.day, mtnNear, MTN_LOOP.near);

			/*
			 * Clouds: always on; tint from closed CLOUD_LOOP; forever drift.
			 * wrapDrift maps past the edges so re-entry is off-screen.
			 */
			const cloudAmt = 0.28 + s.dayAmt * 0.42;
			const loopTint = sampleKey(CLOUD_LOOP, s.day, 'c');
			for (const puff of puffs) {
				/* Per-cloud bias toward its base tint, still on the shared loop */
				const tint = lerpHex(loopTint, puff.dayTint, 0.35 * s.dayAmt);
				puff.el.style.opacity = String(cloudAmt);
				puff.el.style.setProperty('--puff-tint', tint);
				puff.el.style.setProperty('--puff-lit', cloudLit(tint));
				puff.el.style.setProperty('--puff-shade', cloudShade(tint));

				if (!reduced) {
					puff.x = wrapDrift(puff.baseX + elapsed * puff.speed + scrubDrift, DRIFT_HALF);
					const bob = Math.sin(elapsed * 0.35 + puff.baseX) * 0.8;
					puff.el.style.left = `${driftToLeftPct(puff.x)}%`;
					puff.el.style.top = `${puff.baseY + bob}%`;
				} else {
					puff.el.style.left = `${driftToLeftPct(puff.baseX)}%`;
					puff.el.style.top = `${puff.baseY}%`;
				}
			}
		},
		dispose() {
			root.innerHTML = '';
			root.classList.remove('olympus-sky');
		}
	};
}
