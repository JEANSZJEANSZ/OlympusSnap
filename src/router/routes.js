/**
 * Vue-style route table — path ↔ view component.
 * Paths are real URLs (history mode): /, /frame, /camera, …
 */

import Landing from "../views/01_Landing.svelte";
import FrameSelect from "../views/02_FrameSelect.svelte";
import Camera from "../views/03_Camera.svelte";
import Studio from "../views/04_Studio.svelte";
import Reveal from "../views/05_Reveal.svelte";
import Export from "../views/06_Export.svelte";
import Admin from "../views/07_Admin.svelte";

/** @typedef {{ path: string, name: string, component: import('svelte').Component }} AppRoute */

/** @type {readonly AppRoute[]} */
export const routes = Object.freeze([
	{ path: '/', name: 'landing', component: Landing },
	{ path: '/frame', name: 'frame', component: FrameSelect },
	{ path: '/camera', name: 'camera', component: Camera },
	{ path: '/studio', name: 'studio', component: Studio },
	{ path: '/reveal', name: 'reveal', component: Reveal },
	{ path: '/export', name: 'export', component: Export },
	{ path: '/admin', name: 'admin', component: Admin }
]);

/** Always defined — first entry in the table. */
export const landingRoute = routes[0];

/** @type {ReadonlyMap<string, AppRoute>} */
export const routesByName = new Map(routes.map((r) => [r.name, r]));

/** @type {ReadonlyMap<string, AppRoute>} */
export const routesByPath = new Map([
	...routes.map((r) => /** @type {[string, AppRoute]} */ ([r.path, r])),
	/** @type {[string, AppRoute]} */ (['/landing', landingRoute])
]);