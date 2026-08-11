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
 * Cover-fit pixel canvases to a host (crop on portrait, no stretch).
 * Bottom-anchored so cloud/ground art meets the viewport edge — no dead band.
 * @param {HTMLElement} el
 * @param {HTMLElement} host
 * @param {number} bitmapW
 * @param {number} bitmapH
 * @param {number} [pad]
 */
export function applyCoverFitCanvas(el, host, bitmapW, bitmapH, pad = 1.08) {
	const cw = host.clientWidth;
	const ch = host.clientHeight;
	if (cw < 1 || ch < 1) return;
	const bitmapAr = bitmapW / bitmapH;
	const viewAr = cw / ch;
	let dw;
	let dh;
	if (viewAr > bitmapAr) {
		dw = cw * pad;
		dh = dw / bitmapAr;
	} else {
		dh = ch * pad;
		dw = dh * bitmapAr;
	}
	el.style.position = 'absolute';
	el.style.left = '50%';
	el.style.bottom = '0';
	el.style.top = 'auto';
	el.style.width = `${dw}px`;
	el.style.height = `${dh}px`;
	el.style.transform = 'translateX(-50%)';
}

/**
 * Fill host 1:1 — bitmap matches CSS pixels (sharp photos, no upscale blur).
 * @param {HTMLElement} el
 */
export function applyFillCanvas(el) {
	el.style.position = 'absolute';
	el.style.left = '0';
	el.style.top = '0';
	el.style.width = '100%';
	el.style.height = '100%';
	el.style.transform = 'none';
}

/**
 * @param {HTMLElement[]} elements
 * @param {HTMLElement} host
 * @param {number} bitmapW
 * @param {number} bitmapH
 * @param {number} [pad]
 */
export function observeCoverFit(elements, host, bitmapW, bitmapH, pad = 1.08) {
	const fit = () => {
		for (const el of elements) applyCoverFitCanvas(el, host, bitmapW, bitmapH, pad);
	};
	const ro = new ResizeObserver(fit);
	ro.observe(host);
	fit();
	return () => ro.disconnect();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} pxW
 * @param {boolean} alpha
 * @param {{
 *   powerPreference?: 'low-power' | 'high-performance' | 'default';
 *   pixelRatio?: number;
 *   imageRendering?: string;
 *   minAspect?: number;
 * }} [opts]
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
	let currentPxW = pxW;
	/** @type {'cover' | 'fill'} */
	let layoutMode = 'cover';

	/** @param {number} w */
	function setRenderWidth(w) {
		currentPxW = Math.max(90, Math.round(w));
	}

	/** @param {'cover' | 'fill'} mode */
	function setLayoutMode(mode) {
		layoutMode = mode;
	}

	/**
	 * @param {number} viewH
	 * @returns {{ aspect: number, viewH: number, viewW: number, bitmapW: number, bitmapH: number } | undefined}
	 */
	function resize(viewH = 2.35) {
		const parent = canvas.parentElement;
		if (!parent) return;
		const rect = parent.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return;
		const aspect = rect.width / Math.max(1, rect.height);
		const w = currentPxW;
		const h = Math.max(90, Math.round(w / aspect));
		renderer.setSize(w, h, false);
		canvas.style.imageRendering = imageRendering;
		if (layoutMode === 'fill') {
			applyFillCanvas(canvas);
		} else {
			applyCoverFitCanvas(canvas, parent, w, h);
		}

		const viewW = viewH * (w / h);
		camera.left = -viewW / 2;
		camera.right = viewW / 2;
		camera.top = viewH / 2;
		camera.bottom = -viewH / 2;
		camera.updateProjectionMatrix();
		return { aspect, viewH, viewW, bitmapW: w, bitmapH: h };
	}

	return { renderer, camera, resize, setRenderWidth, setLayoutMode };
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
