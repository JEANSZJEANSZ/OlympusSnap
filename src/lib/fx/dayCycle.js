/**
 * Shared day/night clock — sky colors, sun/moon windows, celestial arcs.
 * Used by olympusSkyDom.js; temple reads getDay() only.
 */
import { Color } from 'three';
import { lerpDay, smooth01 } from './pixelShared.js';

/** Start/end fully off-frame so bodies creep in/out (view half-width ≈ 2.1) */
export const CELESTIAL_X0 = -2.85;
export const CELESTIAL_X1 = 2.85;
/** Cloud/bird loop half-span — well outside ortho view so wrap is never seen */
export const DRIFT_HALF = 5.8;

/** Exclusive handoff — sun & moon never share a day slice */
export const SUN_DAY0 = 0.24;
export const SUN_DAY1 = 0.74;
export const MOON_DAY0 = 0.74;
export const MOON_DAY1 = 0.24;

export const SKY_KEYS = [
	{ t: 0.0, zenith: '#040a14', horizon: '#081018' },
	{ t: 0.1, zenith: '#0a1830', horizon: '#102438' },
	{ t: 0.18, zenith: '#183858', horizon: '#486888' },
	{ t: 0.24, zenith: '#2a6090', horizon: '#c89870' },
	{ t: 0.32, zenith: '#3f88c0', horizon: '#d8c8a0' },
	{ t: 0.42, zenith: '#4a9ad4', horizon: '#dce8f4' },
	{ t: 0.52, zenith: '#3f90cc', horizon: '#e8f2fc' },
	{ t: 0.62, zenith: '#3578b0', horizon: '#d0c0a0' },
	{ t: 0.72, zenith: '#2a5888', horizon: '#c88058' },
	{ t: 0.8, zenith: '#142848', horizon: '#784838' },
	{ t: 0.88, zenith: '#0a1830', horizon: '#201820' },
	{ t: 0.95, zenith: '#050d18', horizon: '#0a1420' },
	{ t: 1.0, zenith: '#040a14', horizon: '#081018' }
];

const _cA = new Color();
const _cB = new Color();
const _out = new Color();

/**
 * Seamless horizontal loop (no on-screen teleport pop).
 * @param {number} x
 * @param {number} [half]
 */
export function wrapDrift(x, half = DRIFT_HALF) {
	const span = half * 2;
	return ((((x + half) % span) + span) % span) - half;
}

/**
 * Closed-loop keyframe sample. Keys must start at t=0 and end at t=1 with equal values.
 * @param {{ t: number, [k: string]: any }[]} keys
 * @param {number} day
 * @param {string} channel
 * @returns {string} css color
 */
export function sampleKey(keys, day, channel) {
	const t = ((day % 1) + 1) % 1;
	let i = 0;
	while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
	const a = keys[i];
	const b = keys[Math.min(i + 1, keys.length - 1)];
	const span = b.t - a.t || 1;
	const u = smooth01((t - a.t) / span);
	_cA.set(a[channel]);
	_cB.set(b[channel]);
	return _out.copy(_cA).lerp(_cB, u).getStyle();
}

/**
 * Closed-loop scalar sample (t=0 and t=1 values must match).
 * @param {{ t: number, v: number }[]} keys
 * @param {number} day
 */
export function sampleScalar(keys, day) {
	const t = ((day % 1) + 1) % 1;
	let i = 0;
	while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
	const a = keys[i];
	const b = keys[Math.min(i + 1, keys.length - 1)];
	const span = b.t - a.t || 1;
	const u = smooth01((t - a.t) / span);
	return a.v + (b.v - a.v) * u;
}

/**
 * Night amount — one smooth loop, no branch jumps at sun/moon handoff.
 * Peak night at midnight; peak day near noon. t=0 and t=1 both = 1.
 */
const NIGHT_KEYS = [
	{ t: 0.0, v: 1.0 },
	{ t: 0.1, v: 0.92 },
	{ t: 0.18, v: 0.7 },
	{ t: 0.24, v: 0.42 },
	{ t: 0.32, v: 0.12 },
	{ t: 0.42, v: 0.02 },
	{ t: 0.52, v: 0.0 },
	{ t: 0.62, v: 0.02 },
	{ t: 0.7, v: 0.14 },
	{ t: 0.76, v: 0.42 },
	{ t: 0.84, v: 0.72 },
	{ t: 0.92, v: 0.92 },
	{ t: 1.0, v: 1.0 }
];

/**
 * Progress 0..1 along a day window. End is exclusive so abutting windows never overlap.
 * Wrap windows (end < start) cover night across midnight.
 * @param {number} day
 * @param {number} start
 * @param {number} end
 */
export function windowProgress(day, start, end) {
	const d = ((day % 1) + 1) % 1;
	if (end > start) {
		if (d < start || d >= end) return -1;
		return (d - start) / (end - start);
	}
	const span = 1 - start + end;
	let t;
	if (d >= start) t = (d - start) / span;
	else if (d < end) t = (d + (1 - start)) / span;
	else return -1;
	return t;
}

/**
 * Arc across the sky. t=0 / t=1 sit off-screen; mid-arc peaks high.
 * @param {number} t 0..1
 */
export function celestialXY(t) {
	const ease = t * t * (3 - 2 * t);
	return {
		x: CELESTIAL_X0 + ease * (CELESTIAL_X1 - CELESTIAL_X0),
		y: -0.05 + Math.sin(t * Math.PI) * 1.05
	};
}

/**
 * Soft edge fade while still mostly off-frame (extra creep, no hard pop).
 * @param {number} t
 */
export function celestialEdgeFade(t) {
	const edge = 0.07;
	if (t < edge) return smooth01(t / edge);
	if (t > 1 - edge) return smooth01((1 - t) / edge);
	return 1;
}

/**
 * Continuous night 0..1 for the full day loop (no discontinuities).
 * @param {number} day
 */
export function nightAmount(day) {
	return sampleScalar(NIGHT_KEYS, day);
}

/**
 * @param {number} day
 */
export function sampleDay(day) {
	const zenith = sampleKey(SKY_KEYS, day, 'zenith');
	const horizon = sampleKey(SKY_KEYS, day, 'horizon');
	const sunT = windowProgress(day, SUN_DAY0, SUN_DAY1);
	const moonT = windowProgress(day, MOON_DAY0, MOON_DAY1);
	const showSun = sunT >= 0 && moonT < 0;
	const showMoon = moonT >= 0 && sunT < 0;

	let sunXY = { x: 0, y: 0 };
	let moonXY = { x: 0, y: 0 };
	let sunFade = 0;
	let moonFade = 0;

	if (showSun) {
		sunXY = celestialXY(sunT);
		sunFade = celestialEdgeFade(sunT);
	}
	if (showMoon) {
		moonXY = celestialXY(moonT);
		moonFade = celestialEdgeFade(moonT);
	}

	const nightAmt = nightAmount(day);
	const dayAmt = 1 - nightAmt;

	return {
		day,
		dayAmt,
		nightAmt,
		zenith,
		horizon,
		sunT,
		moonT,
		sunXY,
		moonXY,
		sunFade,
		moonFade,
		showSun,
		showMoon
	};
}

/**
 * Stateful day clock with auto-advance and pointer-free sampling.
 * @param {{ reduced?: boolean }} [opts]
 */
export function createDayClock(opts = {}) {
	const reduced = !!opts.reduced;
	let day = 0.35;
	let dayTarget = 0.35;

	return {
		get day() {
			return day;
		},
		/** @param {number} d @param {boolean} [immediate] */
		setDay(d, immediate = false) {
			dayTarget = ((d % 1) + 1) % 1;
			if (immediate) day = dayTarget;
		},
		/** @param {number} delta */
		nudgeDay(delta) {
			dayTarget = (dayTarget + delta + 1) % 1;
		},
		getDay: () => day,
		/** @param {number} dt */
		tick(dt) {
			if (!reduced) {
				dayTarget = (dayTarget + dt / 70) % 1;
				day = lerpDay(day, dayTarget, 1 - Math.exp(-dt * 2.1));
			} else {
				day = dayTarget;
			}
		},
		sample: () => sampleDay(day)
	};
}
