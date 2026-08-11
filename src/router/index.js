/**
 * Tiny history router (Vue Router–style), no library.
 * Browser URLs always include the deploy folder:
 *   /olympussnap/ | /olympussnap/frame | /olympussnap/camera | …
 *
 * Must match Vite `base` in vite.config.js (same as IIS / Cloudflare Pages path).
 */
import { writable, derived } from 'svelte/store';
import { routes, routesByName, routesByPath, landingRoute } from './routes.js';

/**
 * @typedef {import('./routes.js').AppRoute} AppRoute
 */

/** @type {AppRoute} */
const FALLBACK = landingRoute;

/** Deploy subpath — keep in sync with vite.config.js `base`. */
const APP_BASE = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/olympussnap';

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
 * Strip deploy base → app-relative path (`/frame`).
 * @param {string} pathname
 * @returns {string}
 */
export function toAppPath(pathname) {
	const full = normalizePath(pathname);
	if (!APP_BASE) return full;
	if (full === APP_BASE) return '/';
	if (full.startsWith(`${APP_BASE}/`)) {
		return full.slice(APP_BASE.length) || '/';
	}
	return full;
}

/**
 * App-relative path → full browser URL path for history API.
 * @param {string} appPath
 * @returns {string}
 */
export function toFullPath(appPath) {
	const path = normalizePath(appPath);
	if (!APP_BASE) return path;
	if (path === '/') return `${APP_BASE}/`;
	return `${APP_BASE}${path}`;
}

/**
 * Resolve a route by path (`/frame`) or name (`frame`).
 * @param {string} to
 * @returns {AppRoute}
 */
export function resolve(to) {
	if (!to) return FALLBACK;
	if (to.startsWith('/')) {
		return routesByPath.get(toAppPath(to)) ?? FALLBACK;
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
		history.replaceState(null, '', toFullPath(matched.path));
		return matched;
	}

	const appPath = toAppPath(location.pathname);
	if (appPath === '/export') {
		const matched = routesByName.get('reveal') ?? FALLBACK;
		history.replaceState(null, '', toFullPath('/reveal'));
		return matched;
	}

	return resolve(appPath);
}

/** @type {import('svelte/store').Writable<AppRoute>} */
export const currentRoute = writable(matchLocation());

/** Route name to restore when leaving admin (set before entering admin). */
export const adminReturnTo = writable('landing');

/** Route name only — keeps existing `$route === 'landing'` style if needed */
export const route = derived(currentRoute, ($r) => $r.name);

/**
 * Navigate by name (`frame`) or path (`/frame`).
 * @param {string} to
 * @param {string} [search] Optional query string, e.g. `?ses=...`
 */
export function go(to, search = '') {
	const matched = resolve(to);
	if (typeof history === 'undefined' || typeof location === 'undefined') {
		currentRoute.set(matched);
		return;
	}
	const next = toFullPath(matched.path) + (search || '');
	const current = normalizePath(location.pathname) + (location.search || '');
	if (current !== next) {
		history.pushState(null, '', next);
	}
	currentRoute.set(matched);
}

function syncFromLocation() {
	const matched = matchLocation();
	currentRoute.set(matched);
}

if (typeof window !== 'undefined') {
	window.addEventListener('popstate', syncFromLocation);
	syncFromLocation();
}

export { routes };
