/**
 * Studio sticker editor — Konva Stage + Transformer at frame-native resolution.
 * Inspired by https://konvajs.org/docs/sandbox/Canvas_Editor.html
 */
import Konva from 'konva';
import { loadImageForCanvas as loadImage } from '../utils/loadImageForCanvas.js';

export const STICKER_BASE = 64;
const MIN_SCALE = 0.35;

/** Fallback / OOM long-edge caps — never upsize the live display stage to native. */
const EXPORT_CAP_LONG_EDGE = 2048;
const EXPORT_RETRY_LONG_EDGE = 1280;
const EXPORT_MIME = 'image/jpeg';
const EXPORT_QUALITY = 0.92;

/**
 * @typedef {{
 *   id: string;
 *   src: string;
 *   x: number;
 *   y: number;
 *   scale: number;
 *   rotation: number;
 * }} StudioSticker
 */

/**
 * Fit natural image so the longest side equals STICKER_BASE at scale 1 (preserves aspect).
 * @param {CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }} img
 * @returns {{ w: number; h: number }}
 */
function baseSizeFromImage(img) {
	const nw = Number(img?.naturalWidth || img?.width) || STICKER_BASE;
	const nh = Number(img?.naturalHeight || img?.height) || STICKER_BASE;
	const longest = Math.max(nw, nh, 1);
	return {
		w: (nw / longest) * STICKER_BASE,
		h: (nh / longest) * STICKER_BASE
	};
}

/**
 * @param {Konva.Image} node
 * @returns {StudioSticker | null}
 */
function nodeToSticker(node) {
	const id = node.id();
	const src = node.getAttr('stickerSrc');
	if (!id || !src) return null;

	const w = node.width() * node.scaleX();
	const h = node.height() * node.scaleY();
	const cx = node.x();
	const cy = node.y();

	return {
		id,
		src,
		x: cx - w / 2,
		y: cy - h / 2,
		scale: node.scaleX(),
		rotation: node.rotation()
	};
}

/**
 * @param {Konva.Image} node
 * @param {StudioSticker} sticker
 */
function applyStickerToNode(node, sticker) {
	const img = node.image();
	const { w: baseW, h: baseH } = baseSizeFromImage(
		/** @type {HTMLImageElement} */ (img || { naturalWidth: STICKER_BASE, naturalHeight: STICKER_BASE })
	);
	const dispW = baseW * sticker.scale;
	const dispH = baseH * sticker.scale;
	node.width(baseW);
	node.height(baseH);
	node.scaleX(sticker.scale);
	node.scaleY(sticker.scale);
	node.offsetX(baseW / 2);
	node.offsetY(baseH / 2);
	node.x(sticker.x + dispW / 2);
	node.y(sticker.y + dispH / 2);
	node.rotation(sticker.rotation ?? 0);
}

/** Fixed screen-pixel chrome — Konva Transformer ignores parent stage scale by design. */
const TRANSFORMER_ANCHOR_PX = 16;
const TRANSFORMER_ROTATE_OFFSET_PX = 32;
const TRANSFORMER_ANCHOR_PX_COARSE = 28;
const TRANSFORMER_ROTATE_OFFSET_PX_COARSE = 46;

/** @returns {boolean} */
function prefersCoarsePointer() {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * @param {TouchList | Touch[]} touches
 */
function touchSpan(touches) {
	const a = touches[0];
	const b = touches[1];
	if (!a || !b) return 0;
	return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

/**
 * @param {TouchList | Touch[]} touches
 * @returns {number} degrees
 */
function touchAngleDeg(touches) {
	const a = touches[0];
	const b = touches[1];
	if (!a || !b) return 0;
	return (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI;
}

/**
 * @param {Event | undefined} evt
 * @returns {number}
 */
function eventTouchCount(evt) {
	if (!evt || typeof evt !== 'object') return 1;
	if ('touches' in evt && evt.touches && typeof evt.touches.length === 'number') {
		return evt.touches.length;
	}
	return 1;
}

/**
 * @param {Konva.KonvaEventObject<PointerEvent | TouchEvent | MouseEvent>} e
 * @returns {{ clientX: number; clientY: number }}
 */
function pointerClient(e) {
	const evt = e?.evt;
	if (evt && typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
		return { clientX: evt.clientX, clientY: evt.clientY };
	}
	const t =
		evt && 'changedTouches' in evt
			? evt.changedTouches?.[0]
			: evt && 'touches' in evt
				? evt.touches?.[0]
				: null;
	if (t) return { clientX: t.clientX, clientY: t.clientY };
	return { clientX: 0, clientY: 0 };
}

/**
 * @param {Konva.Transformer} transformer
 * @param {boolean} touchMode
 */
function applyTransformerChrome(transformer, touchMode) {
	const coarse = prefersCoarsePointer();
	if (touchMode) {
		transformer.enabledAnchors([]);
		transformer.rotateEnabled(false);
		transformer.borderEnabled(true);
		transformer.padding(10);
		transformer.shouldOverdrawWholeArea(true);
		transformer.borderStrokeWidth(3);
		transformer.anchorSize(1);
		transformer.rotateAnchorOffset(0);
		transformer.rotateLineVisible(false);
	} else {
		transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
		transformer.rotateEnabled(true);
		transformer.borderEnabled(true);
		transformer.padding(0);
		transformer.shouldOverdrawWholeArea(false);
		transformer.anchorSize(coarse ? TRANSFORMER_ANCHOR_PX_COARSE : TRANSFORMER_ANCHOR_PX);
		transformer.rotateAnchorOffset(
			coarse ? TRANSFORMER_ROTATE_OFFSET_PX_COARSE : TRANSFORMER_ROTATE_OFFSET_PX
		);
		transformer.borderStrokeWidth(coarse ? 2.5 : 2);
		transformer.anchorStrokeWidth(coarse ? 2 : 1.5);
		transformer.rotateLineVisible(true);
		for (const anchor of transformer.find('._anchor')) {
			if (typeof anchor.hitStrokeWidth === 'function') {
				anchor.hitStrokeWidth(18);
			}
		}
	}
	transformer.forceUpdate();
}

/**
 * @param {{
 *   container: HTMLElement;
 *   compositeDataUrl: string;
 *   stickers?: StudioSticker[];
 *   selectedId?: string | null;
 *   onStickersChange?: (stickers: StudioSticker[]) => void;
 *   onSelect?: (id: string | null) => void;
 *   onDragActive?: (active: boolean) => void;
 *   onDragMove?: (pos: { id: string; clientX: number; clientY: number }) => void;
 *   onDragEnd?: (pos: { id: string; clientX: number; clientY: number }) => boolean | void;
 *   touchMode?: boolean;
 * }} opts
 */
export async function createStudioEditor(opts) {
	const { container, compositeDataUrl } = opts;
	let touchMode = !!opts.touchMode;
	const bgImg = await loadImage(compositeDataUrl);
	const frameW = bgImg.naturalWidth || bgImg.width || 600;
	const frameH = bgImg.naturalHeight || bgImg.height || 800;

	const stage = new Konva.Stage({
		container,
		width: frameW,
		height: frameH
	});

	const bgLayer = new Konva.Layer({ listening: false });
	bgLayer.add(
		new Konva.Image({
			image: bgImg,
			x: 0,
			y: 0,
			width: frameW,
			height: frameH,
			listening: false
		})
	);

	const stickerLayer = new Konva.Layer();
	/** Dedicated top layer so sticker images never cover Transformer anchors. */
	const uiLayer = new Konva.Layer();

	const transformer = new Konva.Transformer({
		rotateEnabled: true,
		keepRatio: true,
		enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
		borderStroke: '#e8dfd0',
		borderStrokeWidth: 2,
		anchorFill: '#c4b49a',
		anchorStroke: '#1a1a1a',
		anchorStrokeWidth: 1.5,
		anchorSize: TRANSFORMER_ANCHOR_PX,
		rotateAnchorOffset: TRANSFORMER_ROTATE_OFFSET_PX,
		anchorStyleFunc: (anchor) => {
			if (anchor.hasName('rotater')) {
				anchor.fill('#d4a017');
				anchor.stroke('#1a1a1a');
			}
		},
		boundBoxFunc: (oldBox, newBox) => {
			if (Math.abs(newBox.width) < 12 || Math.abs(newBox.height) < 12) return oldBox;
			return newBox;
		}
	});
	applyTransformerChrome(transformer, touchMode);

	uiLayer.add(transformer);
	stage.add(bgLayer);
	stage.add(stickerLayer);
	stage.add(uiLayer);

	/** Fit stage canvas to container while keeping logical coords at frame-native size. */
	function fitToContainer(cw, ch) {
		if (!cw || !ch) return;
		const scale = Math.min(cw / frameW, ch / frameH);
		stage.width(frameW * scale);
		stage.height(frameH * scale);
		stage.scale({ x: scale, y: scale });
		applyTransformerChrome(transformer, touchMode);
		uiLayer.moveToTop();
		stage.batchDraw();
	}

	fitToContainer(container.clientWidth, container.clientHeight);

	/** @type {Map<string, Konva.Image>} */
	const nodes = new Map();
	let selectedId = opts.selectedId ?? null;
	let syncing = false;

	function emitStickers() {
		if (syncing) return;
		const list = [];
		for (const node of nodes.values()) {
			const s = nodeToSticker(node);
			if (s) list.push(s);
		}
		opts.onStickersChange?.(list);
	}

	function selectNode(/** @type {Konva.Image | null} */ node) {
		if (node) {
			transformer.nodes([node]);
			applyTransformerChrome(transformer, touchMode);
			selectedId = node.id();
			uiLayer.moveToTop();
			transformer.moveToTop();
		} else {
			transformer.nodes([]);
			selectedId = null;
		}
		opts.onSelect?.(selectedId);
		stickerLayer.batchDraw();
		uiLayer.batchDraw();
	}

	/**
	 * @param {StudioSticker} sticker
	 */
	async function addStickerNode(sticker) {
		let htmlImg;
		try {
			htmlImg = await loadImage(sticker.src);
		} catch {
			return null;
		}

		const node = new Konva.Image({
			image: htmlImg,
			id: sticker.id,
			draggable: true,
			stickerSrc: sticker.src
		});

		applyStickerToNode(node, sticker);

		node.on('dragstart', () => {
			if (!touchMode) return;
			opts.onDragActive?.(true);
		});
		node.on('dragmove', (e) => {
			if (!touchMode) return;
			const pos = pointerClient(e);
			opts.onDragMove?.({ id: node.id(), clientX: pos.clientX, clientY: pos.clientY });
		});
		node.on('dragend', (e) => {
			const pos = pointerClient(e);
			let dropped = false;
			if (touchMode) {
				dropped = !!opts.onDragEnd?.({
					id: node.id(),
					clientX: pos.clientX,
					clientY: pos.clientY
				});
				opts.onDragActive?.(false);
			}
			if (dropped) {
				const id = node.id();
				requestAnimationFrame(() => removeSticker(id));
			} else {
				emitStickers();
			}
		});
		node.on('transformend', () => emitStickers());
		node.on('pointerdown', (e) => {
			e.cancelBubble = true;
			selectNode(node);
		});

		nodes.set(sticker.id, node);
		stickerLayer.add(node);
		if (selectedId === sticker.id) selectNode(node);
		stickerLayer.batchDraw();
		return node;
	}

	/** Skip empty-stage deselect after a pinch so lifting fingers does not clear selection. */
	let ignoreEmptyTap = false;
	/** @type {{ active: boolean; dist: number; angle: number }} */
	let pinch = { active: false, dist: 0, angle: 0 };

	function onEmptyStageTap(e) {
		if (e.target !== stage) return;
		if (pinch.active || ignoreEmptyTap) return;
		if (eventTouchCount(e.evt) >= 2) return;
		selectNode(null);
	}

	stage.on('click tap', onEmptyStageTap);

	for (const sticker of opts.stickers ?? []) {
		await addStickerNode(sticker);
	}

	if (selectedId && nodes.has(selectedId)) {
		selectNode(nodes.get(selectedId) ?? null);
	} else {
		selectNode(null);
	}

	/** Default scale so stickers feel similar across frame sizes — sized for Instagram-style first place. */
	function defaultSpawnScale() {
		const dim = Math.min(frameW, frameH);
		const divisor = touchMode ? 200 : 280;
		const floor = touchMode ? 2.4 : 1.7;
		const cap = touchMode ? 4.5 : 3.5;
		return Math.max(floor, Math.min(cap, Math.round((dim / divisor) * 10) / 10));
	}

	/**
	 * Map a client point onto the stage and resolve a sticker node (image or transformer chrome).
	 * @param {number} clientX
	 * @param {number} clientY
	 * @returns {Konva.Image | null}
	 */
	function stickerFromClient(clientX, clientY) {
		const content = stage.getContent();
		const rect = content.getBoundingClientRect();
		if (!rect.width || !rect.height) return null;
		const pos = {
			x: ((clientX - rect.left) / rect.width) * stage.width(),
			y: ((clientY - rect.top) / rect.height) * stage.height()
		};
		const shape = stage.getIntersection(pos);
		if (!shape) return null;
		if (nodes.has(shape.id())) return nodes.get(shape.id()) ?? null;
		const parent = shape.getParent();
		if (parent && nodes.has(parent.id())) return nodes.get(parent.id()) ?? null;
		if (shape.getParent() === transformer || transformer.nodes().includes(shape)) {
			return transformer.nodes()[0] ?? null;
		}
		return null;
	}

	/**
	 * @param {string} id
	 * @returns {boolean}
	 */
	function removeSticker(id) {
		const node = nodes.get(id);
		if (!node) return false;
		node.destroy();
		nodes.delete(id);
		if (selectedId === id) selectNode(null);
		emitStickers();
		return true;
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	function onKeyDown(e) {
		if (e.key !== 'Delete' && e.key !== 'Backspace') return;
		const t = e.target;
		if (t instanceof HTMLElement) {
			const tag = t.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
		}
		if (!selectedId || !nodes.has(selectedId)) return;
		e.preventDefault();
		removeSticker(selectedId);
	}

	window.addEventListener('keydown', onKeyDown);

	/** Two-finger pinch (scale) + rotate on the selected sticker — Instagram-style, second finger anywhere. */
	/**
	 * @param {TouchEvent} e
	 * @returns {Konva.Image | null}
	 */
	function resolvePinchNode(e) {
		if (selectedId) {
			const current = nodes.get(selectedId);
			if (current) return current;
		}
		const a = e.touches[0];
		const b = e.touches[1];
		const fromA = a ? stickerFromClient(a.clientX, a.clientY) : null;
		const fromB = b ? stickerFromClient(b.clientX, b.clientY) : null;
		return fromA || fromB;
	}

	/** @param {TouchEvent} e */
	function onTouchStart(e) {
		if (e.touches.length !== 2) return;
		const node = resolvePinchNode(e);
		if (!node) return;
		if (selectedId !== node.id()) selectNode(node);
		if (typeof node.isDragging === 'function' && node.isDragging()) {
			node.stopDrag();
		}
		if (touchMode) opts.onDragActive?.(false);
		node.draggable(false);
		pinch.active = true;
		ignoreEmptyTap = true;
		pinch.dist = touchSpan(e.touches);
		pinch.angle = touchAngleDeg(e.touches);
		e.preventDefault();
	}

	/** @param {TouchEvent} e */
	function onTouchMove(e) {
		if (!pinch.active || e.touches.length !== 2 || !selectedId) return;
		const node = nodes.get(selectedId);
		if (!node) return;

		const dist = touchSpan(e.touches);
		const angle = touchAngleDeg(e.touches);
		if (pinch.dist > 0) {
			const ratio = dist / pinch.dist;
			const next = Math.max(MIN_SCALE, node.scaleX() * ratio);
			node.scaleX(next);
			node.scaleY(next);
		}
		node.rotation(node.rotation() + (angle - pinch.angle));
		pinch.dist = dist;
		pinch.angle = angle;
		transformer.forceUpdate();
		stickerLayer.batchDraw();
		uiLayer.batchDraw();
		e.preventDefault();
	}

	/** @param {TouchEvent} e */
	function onTouchEnd(e) {
		if (e.touches.length >= 2) return;
		if (!pinch.active) return;
		pinch.active = false;
		const node = selectedId ? nodes.get(selectedId) : null;
		if (node) node.draggable(true);
		emitStickers();
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				ignoreEmptyTap = false;
			});
		});
	}

	container.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
	container.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
	container.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
	container.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });

	/**
	 * Hide transformer chrome for export. Does NOT resize the stage to native —
	 * pixelRatio below maps display-sized layers to a capped output size.
	 * @returns {{ prevNodes: Konva.Node[] }}
	 */
	function prepareExportChrome() {
		const prevNodes = transformer.nodes().slice();
		transformer.nodes([]);
		stickerLayer.batchDraw();
		uiLayer.batchDraw();
		return { prevNodes };
	}

	/**
	 * @param {{ prevNodes: Konva.Node[] }} snap
	 */
	function restoreExportChrome(snap) {
		transformer.nodes(snap.prevNodes ?? []);
		applyTransformerChrome(transformer, touchMode);
		uiLayer.moveToTop();
		stickerLayer.batchDraw();
		uiLayer.batchDraw();
	}

	/**
	 * Export ~min(native, longEdgeCap) while the stage stays display-sized.
	 * @param {number} longEdgeCap
	 * @returns {number}
	 */
	function exportPixelRatio(longEdgeCap) {
		const capScale = Math.min(1, longEdgeCap / Math.max(frameW, frameH, 1));
		return capScale / Math.max(stage.scaleX(), 1e-6);
	}

	/**
	 * @param {number} pixelRatio
	 * @returns {Promise<Blob | null>}
	 */
	async function stageToJpegBlob(pixelRatio) {
		const opts = {
			pixelRatio,
			mimeType: EXPORT_MIME,
			quality: EXPORT_QUALITY
		};
		if (typeof stage.toBlob !== 'function') return null;
		try {
			const result = stage.toBlob(opts);
			if (result != null && typeof result.then === 'function') {
				return (await result) ?? null;
			}
			return await new Promise((resolve) => {
				stage.toBlob({
					...opts,
					callback: (b) => resolve(b ?? null)
				});
			});
		} catch {
			return null;
		}
	}

	return {
		stage,
		frameW,
		frameH,

		fitToContainer,

		/** @param {string | null} id */
		setSelectedId(id) {
			if (id === selectedId) return;
			selectNode(id ? nodes.get(id) ?? null : null);
		},

		/** @param {StudioSticker[]} stickers */
		async syncStickers(stickers) {
			syncing = true;
			const incoming = new Map(stickers.map((s) => [s.id, s]));
			for (const [id, node] of [...nodes.entries()]) {
				if (!incoming.has(id)) {
					node.destroy();
					nodes.delete(id);
				}
			}
			for (const sticker of stickers) {
				const existing = nodes.get(sticker.id);
				if (existing) {
					applyStickerToNode(existing, sticker);
				} else {
					await addStickerNode(sticker);
				}
			}
			if (selectedId && !nodes.has(selectedId)) selectNode(null);
			else if (selectedId) selectNode(nodes.get(selectedId) ?? null);
			stickerLayer.batchDraw();
			uiLayer.batchDraw();
			syncing = false;
		},

		/**
		 * @param {{ id: string; src: string; x?: number; y?: number; scale?: number; rotation?: number }} item
		 */
		async spawnSticker(item) {
			const scale = item.scale ?? defaultSpawnScale();
			const size = STICKER_BASE * scale;
			const sticker = {
				id: item.id,
				src: item.src,
				x: item.x ?? frameW / 2 - size / 2 + (Math.random() - 0.5) * size * 0.4,
				y: item.y ?? frameH / 2 - size / 2 + (Math.random() - 0.5) * size * 0.4,
				scale,
				rotation: item.rotation ?? 0
			};
			const node = await addStickerNode(sticker);
			if (node) {
				selectNode(node);
				emitStickers();
			}
			return sticker;
		},

		clearStickers() {
			for (const node of nodes.values()) node.destroy();
			nodes.clear();
			selectNode(null);
			emitStickers();
		},

		removeSticker,

		/**
		 * @param {boolean} on
		 */
		setTouchMode(on) {
			touchMode = !!on;
			applyTransformerChrome(transformer, touchMode);
			uiLayer.batchDraw();
		},

		/**
		 * @param {number} factor
		 * @returns {boolean}
		 */
		nudgeScale(factor) {
			if (!selectedId || !Number.isFinite(factor) || factor <= 0) return false;
			const node = nodes.get(selectedId);
			if (!node) return false;
			const next = Math.max(MIN_SCALE, node.scaleX() * factor);
			node.scaleX(next);
			node.scaleY(next);
			transformer.forceUpdate();
			stickerLayer.batchDraw();
			uiLayer.batchDraw();
			emitStickers();
			return true;
		},

		/**
		 * @param {number} degrees
		 * @returns {boolean}
		 */
		nudgeRotate(degrees) {
			if (!selectedId || !Number.isFinite(degrees)) return false;
			const node = nodes.get(selectedId);
			if (!node) return false;
			node.rotation(node.rotation() + degrees);
			transformer.forceUpdate();
			stickerLayer.batchDraw();
			uiLayer.batchDraw();
			emitStickers();
			return true;
		},

		/**
		 * Capped JPEG data URL (no stage resize). Prefer exportBlob for save/share.
		 * @returns {string}
		 */
		exportDataUrl() {
			const snap = prepareExportChrome();
			try {
				const caps = [EXPORT_CAP_LONG_EDGE, EXPORT_RETRY_LONG_EDGE];
				for (const cap of caps) {
					try {
						const url = stage.toDataURL({
							pixelRatio: exportPixelRatio(cap),
							mimeType: EXPORT_MIME,
							quality: EXPORT_QUALITY
						});
						if (typeof url === 'string' && url.startsWith('data:')) return url;
					} catch {
						/* retry smaller cap */
					}
				}
				return '';
			} finally {
				restoreExportChrome(snap);
			}
		},

		/**
		 * JPEG blob at uploaded native size via stage.toBlob (no toDataURL/atob).
		 * Retries at EXPORT_RETRY_LONG_EDGE if the native encode fails (OOM).
		 * @returns {Promise<Blob | null>}
		 */
		async exportBlob() {
			const snap = prepareExportChrome();
			try {
				const nativeRatio = 1 / Math.max(stage.scaleX(), 1e-6);
				const first = await stageToJpegBlob(nativeRatio);
				if (first) return first;
				return await stageToJpegBlob(exportPixelRatio(EXPORT_RETRY_LONG_EDGE));
			} finally {
				restoreExportChrome(snap);
			}
		},

		destroy() {
			window.removeEventListener('keydown', onKeyDown);
			container.removeEventListener('touchstart', onTouchStart, { capture: true });
			container.removeEventListener('touchmove', onTouchMove, { capture: true });
			container.removeEventListener('touchcancel', onTouchEnd, { capture: true });
			container.removeEventListener('touchend', onTouchEnd, { capture: true });
			stage.off('click tap', onEmptyStageTap);
			stage.destroy();
		}
	};
}

/**
 * Export composited image + stickers as a capped JPEG data URL (no live-stage upsize).
 * @param {string} compositeDataUrl
 * @param {StudioSticker[]} stickers
 * @returns {Promise<string>}
 */
export async function exportStudioComposite(compositeDataUrl, stickers) {
	if (!compositeDataUrl) return '';
	const container = document.createElement('div');
	container.style.position = 'fixed';
	container.style.left = '-9999px';
	container.style.top = '0';
	document.body.appendChild(container);

	try {
		const editor = await createStudioEditor({
			container,
			compositeDataUrl,
			stickers
		});
		container.style.width = `${editor.frameW}px`;
		container.style.height = `${editor.frameH}px`;
		editor.fitToContainer(editor.frameW, editor.frameH);
		const out = editor.exportDataUrl();
		editor.destroy();
		return out;
	} finally {
		container.remove();
	}
}
