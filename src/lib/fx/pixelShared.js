/**
 * Shared Three.js helpers for Olympus pixel layers.
 */
import { BoxGeometry, Color, Mesh, MeshBasicMaterial, OrthographicCamera, WebGLRenderer } from 'three';

/** @param {number} t */
export function smooth01(t) {
	return t * t * (3 - 2 * t);
}

/**
 * @param {number} from
 * @param {number} to
 * @param {number} k
 */
export function lerpDay(from, to, k) {
	let d = ((to - from) % 1 + 1.5) % 1 - 0.5;
	return (from + d * k + 1) % 1;
}

/**
 * @param {import('three').Group} parent
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} w
 * @param {number} h
 * @param {number} d
 * @param {MeshBasicMaterial} mat
 */
export function box(parent, x, y, z, w, h, d, mat) {
	const m = new Mesh(new BoxGeometry(w, h, d), mat);
	m.position.set(x, y, z);
	parent.add(m);
	return m;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} pxW
 * @param {boolean} alpha
 * @param {{ powerPreference?: 'low-power' | 'high-performance' | 'default', pixelRatio?: number, imageRendering?: string }} [opts]
 */
export function makeRenderer(canvas, pxW, alpha, opts = {}) {
	const renderer = new WebGLRenderer({
		canvas,
		antialias: false,
		alpha,
		powerPreference: opts.powerPreference || 'low-power'
	});
	const pr = opts.pixelRatio ?? 1;
	renderer.setPixelRatio(pr);
	if (alpha) renderer.setClearColor(0x000000, 0);

	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
	camera.position.z = 10;
	const imageRendering = opts.imageRendering ?? 'pixelated';

	/**
	 * @param {number} viewH
	 */
	function resize(viewH = 2.35) {
		const parent = canvas.parentElement;
		if (!parent) return;
		const rect = parent.getBoundingClientRect();
		const aspect = Math.max(0.5, rect.width / Math.max(1, rect.height));
		const w = pxW;
		const h = Math.max(90, Math.round(pxW / aspect));
		renderer.setSize(w, h, false);
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		canvas.style.imageRendering = imageRendering;

		const viewW = viewH * (w / h);
		camera.left = -viewW / 2;
		camera.right = viewW / 2;
		camera.top = viewH / 2;
		camera.bottom = -viewH / 2;
		camera.updateProjectionMatrix();
	}

	return { renderer, camera, resize };
}

/**
 * @param {import('three').Scene} scene
 */
export function disposeScene(scene) {
	scene.traverse((obj) => {
		const mesh = /** @type {Mesh} */ (obj);
		if (mesh.geometry) mesh.geometry.dispose();
		const mat = mesh.material;
		if (mat) {
			if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
			else mat.dispose();
		}
	});
}

export { Color, MeshBasicMaterial };
