/**
 * Studio sticker editor — Konva Stage + Transformer at frame-native resolution.
 * Inspired by https://konvajs.org/docs/sandbox/Canvas_Editor.html
 */
import Konva from 'konva';

export const STICKER_BASE = 64;
const MIN_SCALE = 0.35;
const MAX_SCALE = 4;

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
		scale: w / STICKER_BASE,
		rotation: node.rotation()
	};
}

/**
 * @param {Konva.Image} node
 * @param {StudioSticker} sticker
 */
function applyStickerToNode(node, sticker) {
	const size = STICKER_BASE * sticker.scale;
	node.width(STICKER_BASE);
	node.height(STICKER_BASE);
	node.scaleX(sticker.scale);
	node.scaleY(sticker.scale);
	node.offsetX(STICKER_BASE / 2);
	node.offsetY(STICKER_BASE / 2);
	node.x(sticker.x + size / 2);
	node.y(sticker.y + size / 2);
	node.rotation(sticker.rotation ?? 0);
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Sticker image load failed'));
		img.src = src;
	});
}

/** Fixed screen-pixel chrome — Konva Transformer ignores parent stage scale by design. */
const TRANSFORMER_ANCHOR_PX = 16;
const TRANSFORMER_ROTATE_OFFSET_PX = 32;

/**
 * @param {Konva.Transformer} transformer
 */
function applyTransformerChrome(transformer) {
	transformer.anchorSize(TRANSFORMER_ANCHOR_PX);
	transformer.rotateAnchorOffset(TRANSFORMER_ROTATE_OFFSET_PX);
	transformer.borderStrokeWidth(2);
	transformer.anchorStrokeWidth(1.5);
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
 * }} opts
 */
export async function createStudioEditor(opts) {
	const { container, compositeDataUrl } = opts;
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
		applyTransformerChrome(transformer);
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
			applyTransformerChrome(transformer);
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

		node.on('dragend transformend', () => emitStickers());
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

	stage.on('pointerdown', (e) => {
		if (e.target === stage) selectNode(null);
	});

	for (const sticker of opts.stickers ?? []) {
		await addStickerNode(sticker);
	}

	if (selectedId && nodes.has(selectedId)) {
		selectNode(nodes.get(selectedId) ?? null);
	} else {
		selectNode(null);
	}

	/** Default scale so stickers feel similar across frame sizes. */
	function defaultSpawnScale() {
		return Math.max(1, Math.min(3, Math.round((Math.min(frameW, frameH) / 420) * 10) / 10));
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

		/** @returns {string} */
		exportDataUrl() {
			transformer.nodes([]);
			stickerLayer.batchDraw();
			uiLayer.batchDraw();

			const prevScale = stage.scaleX();
			const prevW = stage.width();
			const prevH = stage.height();

			stage.scale({ x: 1, y: 1 });
			stage.width(frameW);
			stage.height(frameH);
			stickerLayer.batchDraw();

			const out = stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });

			stage.scale({ x: prevScale, y: prevScale });
			stage.width(prevW);
			stage.height(prevH);
			applyTransformerChrome(transformer);
			uiLayer.moveToTop();
			stickerLayer.batchDraw();
			uiLayer.batchDraw();

			return out;
		},

		destroy() {
			window.removeEventListener('keydown', onKeyDown);
			stage.destroy();
		}
	};
}

/**
 * Export composited image + stickers at native resolution.
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
