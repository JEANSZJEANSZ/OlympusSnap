/**
 * Tiny history router (Vue Router–style), no library.
 * URLs: / | /frame | /camera | /studio | /reveal | /export | /admin
 */
import { writable, derived } from 'svelte/store';
import { routes, routesByName, routesByPath, landingRoute } from './routes.js';

/**
 * @typedef {import('./routes.js').AppRoute} AppRoute
 */

/** @type {AppRoute} */
const FALLBACK = landingRoute;

/**
 * Normalize pathname: strip trailing slash (except root), drop query/hash.
 * @param {string} [pathname]
 * @returns {string}
 */
export function normalizePath(pathname = typeof location !== 'undefined' ? location.pathname : '/') {
	const raw = (pathname.split(/[?#]/)[0] || '/').trim() || '/';
	if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1);
	return raw;
}

/**
 * Resolve a route by path (`/frame`) or name (`frame`).
 * @param {string} to
 * @returns {AppRoute}
 */
export function resolve(to) {
	if (!to) return FALLBACK;
	if (to.startsWith('/')) {
		return routesByPath.get(normalizePath(to)) ?? FALLBACK;
	}
	return routesByName.get(to) ?? FALLBACK;
}

/**
 * Match current URL (pathname). Migrates legacy `#/frame` hashes once.
 * @returns {AppRoute}
 */
export function matchLocation() {
	if (typeof location === 'undefined') return FALLBACK;

	// One-time migrate old hash URLs → history paths
	const hash = location.hash.replace(/^#\/?/, '').split(/[/?#]/)[0]?.trim();
	if (hash && routesByName.has(hash)) {
		const matched = routesByName.get(hash) ?? FALLBACK;
		history.replaceState(null, '', matched.path);
		return matched;
	}

	return resolve(normalizePath(location.pathname));
}

/** @type {import('svelte/store').Writable<AppRoute>} */
export const currentRoute = writable(matchLocation());

/** Route name only — keeps existing `$route === 'landing'` style if needed */
export const route = derived(currentRoute, ($r) => $r.name);

/**
 * Navigate by name (`frame`) or path (`/frame`).
 * @param {string} to
 */
export function go(to) {
	const matched = resolve(to);
	if (typeof history === 'undefined' || typeof location === 'undefined') {
		currentRoute.set(matched);
		return;
	}
	if (normalizePath(location.pathname) !== matched.path) {
		history.pushState(null, '', matched.path);
	}
	currentRoute.set(matched);
}

function syncFromLocation() {
	const matched = matchLocation();
	currentRoute.set(matched);
	if (typeof location !== 'undefined' && normalizePath(location.pathname) !== matched.path) {
		history.replaceState(null, '', matched.path);
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('popstate', syncFromLocation);
	syncFromLocation();
}

export { routes };
