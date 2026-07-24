/**
 * Frame Select motion — literal Matter.js port of Ropesimulator.html
 * (stack + chain + rect payload + MouseConstraint + stretch snap),
 * with DOM bird/strip/SVG sync and fade/glide swap kept on top.
 *
 * Source of truth: /Ropesimulator.html
 */
import Matter from 'matter-js';
import { animate, createTimeline, stagger } from 'animejs';

const { Engine, Bodies, Body, Constraint, Composite, Composites, Vector, World } = Matter;

const FALL_SAFETY_MS = 2200;
const FLY_OUT_MS = 480;
const FLY_IN_MS = 640;
const FLY_TRAVEL = 0.62;
const FLY_ARC_PX = 18;
const FIXED_MS = 1000 / 60;

// ——— Ropesimulator.html params, scaled to the flight stage ———
/** A bit longer hang under the bird (was 5×14 — too stubby). */
const ROPE_SEGMENTS = 8;
const SEG_W = 10;
const SEG_H = 16;
const CHAIN_STIFFNESS = 0.9;
const CHAIN_LENGTH = 2;
const CHAIN_DAMPING = 0.1;
const SNAP_THRESHOLD = 18;
const HAND_STIFFNESS = 0.1;
/** Booth-scale mass (demo’s raw density 0.05 on a full strip is far too heavy). */
const PAYLOAD_MASS = 8;
const PAYLOAD_AIR = 0.04;
const IDLE_SWAY_X = 6;

/**
 * @param {HTMLElement} root
 * @param {{ reduced?: boolean }} [opts]
 */
export function createFrameSelectMotion(root, opts = {}) {
	const reduced = !!opts.reduced;
	const stage = /** @type {HTMLElement | null} */ (root.querySelector('.flight-stage'));
	const birdRig = /** @type {HTMLElement | null} */ (root.querySelector('.bird-rig'));
	const wings = root.querySelectorAll('.bird .wing');
	const ropeLine = /** @type {SVGPolylineElement | null} */ (root.querySelector('.rope-line'));
	const hangGroup = /** @type {HTMLElement | null} */ (root.querySelector('.hang-group'));
	const frameBodyEl = /** @type {HTMLElement | null} */ (root.querySelector('.frame-body'));
	const spark = /** @type {HTMLElement | null} */ (root.querySelector('.snap-spark'));
	const sparkRays = root.querySelectorAll('.snap-spark i');

	/** @type {{ onBroken?: () => void, onGone?: () => void }} */
	let selectHandlers = {};

	if (!stage || !hangGroup || !frameBodyEl || !ropeLine) {
		return {
			playSwap() {},
			/** @param {() => void} onDone */
			playConfirm(onDone) {
				onDone();
			},
			/** @param {() => void} onDone */
			playBackToLanding(onDone) {
				onDone();
			},
			setSelectHandlers() {},
			dispose() {}
		};
	}

	const stageEl = stage;
	const hangEl = hangGroup;
	const stripEl = frameBodyEl;
	const ropeEl = ropeLine;

	/** @type {ReturnType<typeof animate> | null} */
	let wingLoop = null;
	/** @type {ReturnType<typeof animate> | null} */
	let birdFly = null;
	/** @type {ReturnType<typeof animate> | null} */
	let sparkBurst = null;
	/** @type {ReturnType<typeof animate> | null} */
	let flyAnim = null;

	/** @type {Matter.Engine | null} */
	let engine = null;
	/** @type {Matter.Body | null} */
	let anchorBody = null;
	/** @type {Matter.Body | null} */
	let frameBody = null;
	/** @type {Matter.Body | null} */
	let handBody = null;
	/** @type {Matter.Composite | null} */
	let ropeComposite = null;
	/** @type {Matter.Body[]} */
	let linkBodies = [];
	/** @type {Matter.Constraint[]} */
	let breakableConstraints = [];
	/** @type {Matter.Constraint | null} */
	let anchorJoint = null;
	/** @type {Matter.Constraint | null} */
	let payloadJoint = null;
	/** @type {Matter.Constraint | null} */
	let handConstraint = null;

	let raf = 0;
	let finishTimer = 0;
	let disposed = false;
	let snapped = false;
	let confirming = false;
	/** @type {'idle' | 'swapping' | 'dragging' | 'falling'} */
	let mode = 'idle';
	let fallDone = false;
	let lastTime = 0;
	let startTime = 0;
	let accumulator = 0;
	let stageWidth = 1;
	let stageHeight = 1;
	let frameWidth = 1;
	let frameHeight = 1;
	let restRopePx = ROPE_SEGMENTS * SEG_H;
	let anchorBaseX = 0;
	let anchorBaseY = 0;
	let driveX = 0;
	let driveY = 0;
	let birdScaleX = 1;
	let resizeQueued = false;
	let pointerId = -1;
	let lockDx = 0;
	let lockDy = 0;
	let lockRot = 0;
	/** Keep snap armed briefly after release so a taut yank still breaks. */
	let snapArmFrames = 0;
	/** @type {{ x: number, y: number }[]} */
	let lockLinkOffsets = [];

	function clearWorld() {
		handConstraint = null;
		if (engine) {
			World.clear(engine.world, false);
			Engine.clear(engine);
		}
		engine = null;
		anchorBody = null;
		frameBody = null;
		handBody = null;
		ropeComposite = null;
		linkBodies = [];
		breakableConstraints = [];
		anchorJoint = null;
		payloadJoint = null;
	}

	function syncBirdTransform() {
		if (!birdRig) return;
		birdRig.style.transform = `translate3d(${driveX}px, ${driveY}px, 0) scaleX(${birdScaleX})`;
	}

	function finishGone() {
		if (fallDone) return;
		fallDone = true;
		window.clearTimeout(finishTimer);
		selectHandlers.onGone?.();
	}

	/** @param {number} opacity */
	function setFlightOpacity(opacity) {
		const o = String(Math.max(0, Math.min(1, opacity)));
		hangEl.style.opacity = o;
		ropeEl.style.opacity = o;
		if (birdRig) birdRig.style.opacity = o;
	}

	function frameHookWorld() {
		if (!frameBody) return { x: 0, y: 0 };
		const { x, y } = frameBody.position;
		const rot = frameBody.angle;
		// Top-most edge of the visual strip (matches payload joint pointB).
		const localY = -frameHeight / 2;
		const cos = Math.cos(rot);
		const sin = Math.sin(rot);
		return {
			x: x - localY * sin,
			y: y + localY * cos
		};
	}

	function applyHangTransform() {
		if (!frameBody) return;
		const { x, y } = frameBody.position;
		hangEl.style.transform = `translate3d(${x - stageWidth / 2}px, ${y - frameHeight / 2}px, 0) rotate(${frameBody.angle}rad)`;
	}

	function renderRope() {
		/** @type {string[]} */
		const pts = [];
		if (!snapped && anchorBody) {
			pts.push(`${anchorBody.position.x.toFixed(1)},${(anchorBody.position.y + 10).toFixed(1)}`);
		}
		for (const link of linkBodies) {
			pts.push(`${link.position.x.toFixed(1)},${link.position.y.toFixed(1)}`);
		}
		const hook = frameHookWorld();
		pts.push(`${hook.x.toFixed(1)},${hook.y.toFixed(1)}`);
		ropeEl.setAttribute('points', pts.join(' '));
		if (spark && !snapped && anchorBody) {
			spark.style.left = `${anchorBody.position.x}px`;
			spark.style.top = `${anchorBody.position.y}px`;
		}
	}

	function render() {
		applyHangTransform();
		renderRope();
		if ((mode === 'falling' || snapped) && !fallDone && frameBody) {
			if (frameBody.position.y > stageHeight + frameHeight) finishGone();
		}
	}

	/**
	 * @param {Matter.Body} body
	 * @param {number} x
	 * @param {number} y
	 * @param {number} [angle]
	 */
	function placeBody(body, x, y, angle) {
		Body.setPosition(body, { x, y });
		if (angle !== undefined) Body.setAngle(body, angle);
		Body.setVelocity(body, { x: 0, y: 0 });
		Body.setAngularVelocity(body, 0);
	}

	/** @param {number} x @param {number} y */
	function moveAnchor(x, y) {
		if (!anchorBody) return;
		Body.setPosition(anchorBody, { x, y });
	}

	/**
	 * Build world exactly like Ropesimulator.html.
	 * @param {number} [offsetX]
	 */
	function buildWorld(offsetX = 0) {
		clearWorld();

		const stageRect = stageEl.getBoundingClientRect();
		const frameRect = stripEl.getBoundingClientRect();
		stageWidth = Math.max(1, stageRect.width);
		stageHeight = Math.max(1, stageRect.height);
		frameWidth = Math.max(1, frameRect.width);
		frameHeight = Math.max(1, frameRect.height);

		hangEl.style.translate = '-50% 0';
		hangEl.style.removeProperty('opacity');

		if (birdRig) {
			birdRig.style.top = '0px';
			birdRig.style.removeProperty('opacity');
			const birdRect = birdRig.getBoundingClientRect();
			anchorBaseY = birdRect.top - stageRect.top + birdRect.height * 0.95;
		} else {
			anchorBaseY = Math.min(72, Math.max(56, stageHeight * 0.16));
		}
		anchorBaseX = stageWidth / 2;
		driveX = offsetX;
		driveY = 0;
		snapped = false;
		restRopePx = ROPE_SEGMENTS * SEG_H;
		syncBirdTransform();

		const ax = anchorBaseX + offsetX;
		const ay = anchorBaseY;

		engine = Engine.create({
			constraintIterations: 8,
			positionIterations: 8
		});

		const group = Body.nextGroup(true);
		/** Constraints only — no solid hits with links/anchor (that read as “floating on air”). */
		const noCollide = { group, category: 0x0001, mask: 0 };

		// Simulator: Bodies.rectangle(400, 50, 60, 20, { isStatic: true })
		anchorBody = Bodies.rectangle(ax, ay, 60, 20, {
			isStatic: true,
			collisionFilter: noCollide,
			label: 'anchor'
		});

		// Short stack under the talons — total hang ≈ ROPE_SEGMENTS * SEG_H.
		ropeComposite = Composites.stack(ax, ay + 12, 1, ROPE_SEGMENTS, 0, 0, (x, y) =>
			Bodies.rectangle(x, y, SEG_W, SEG_H, {
				collisionFilter: noCollide,
				frictionAir: 0.08,
				label: 'rope-seg'
			})
		);

		// Simulator: Composites.chain(..., stiffness 0.9, length 2)
		Composites.chain(ropeComposite, 0, 0.5, 0, -0.5, {
			stiffness: CHAIN_STIFFNESS,
			length: CHAIN_LENGTH,
			damping: CHAIN_DAMPING
		});

		linkBodies = ropeComposite.bodies.slice();

		const last = linkBodies[linkBodies.length - 1];
		// Physics body = actual strip size; joint at the top-most edge.
		const frameY = last.position.y + SEG_H / 2 + frameHeight / 2 + 2;

		frameBody = Bodies.rectangle(ax, frameY, frameWidth, frameHeight, {
			frictionAir: PAYLOAD_AIR,
			collisionFilter: noCollide,
			label: 'frame'
		});
		Body.setMass(frameBody, PAYLOAD_MASS);

		handBody = Bodies.circle(ax, frameY, 2, {
			isStatic: true,
			collisionFilter: noCollide,
			label: 'hand'
		});

		// Simulator anchorConstraint
		anchorJoint = Constraint.create({
			bodyA: anchorBody,
			pointA: { x: 0, y: 10 },
			bodyB: linkBodies[0],
			pointB: { x: 0, y: -SEG_H / 2 },
			stiffness: CHAIN_STIFFNESS,
			damping: CHAIN_DAMPING,
			label: 'anchor-joint'
		});

		// Rope meets the strip at its top-most center (simulator payloadConstraint pattern).
		payloadJoint = Constraint.create({
			bodyA: last,
			pointA: { x: 0, y: SEG_H / 2 },
			bodyB: frameBody,
			pointB: { x: 0, y: -frameHeight / 2 },
			stiffness: CHAIN_STIFFNESS,
			damping: CHAIN_DAMPING,
			label: 'payload-joint'
		});

		breakableConstraints = [anchorJoint, ...ropeComposite.constraints, payloadJoint];

		Composite.add(engine.world, [
			anchorBody,
			ropeComposite,
			anchorJoint,
			frameBody,
			payloadJoint,
			handBody
		]);

		root.classList.add('physics-ready');
		render();
	}

	function setAssemblyStatic(isStatic) {
		if (frameBody) Body.setStatic(frameBody, isStatic);
		for (const link of linkBodies) Body.setStatic(link, isStatic);
		if (isStatic) {
			if (frameBody) {
				Body.setVelocity(frameBody, { x: 0, y: 0 });
				Body.setAngularVelocity(frameBody, 0);
			}
			for (const link of linkBodies) {
				Body.setVelocity(link, { x: 0, y: 0 });
				Body.setAngularVelocity(link, 0);
			}
		}
	}

	function lockToAnchor() {
		if (!frameBody || !anchorBody) return;
		const a = anchorBody.position;
		lockDx = frameBody.position.x - a.x;
		lockDy = frameBody.position.y - a.y;
		lockRot = frameBody.angle;
		lockLinkOffsets = linkBodies.map((link) => ({
			x: link.position.x - a.x,
			y: link.position.y - a.y
		}));
		setAssemblyStatic(true);
	}

	function unlockHang() {
		if (!frameBody || !anchorBody) return;
		const a = anchorBody.position;
		placeBody(frameBody, a.x + lockDx, a.y + lockDy, 0);
		linkBodies.forEach((link, i) => {
			const o = lockLinkOffsets[i] || { x: 0, y: SEG_H * (i + 1) };
			placeBody(link, a.x + o.x, a.y + o.y, 0);
		});
		setAssemblyStatic(false);
	}

	function syncLockedFlight() {
		syncBirdTransform();
		if (mode !== 'swapping' || !anchorBody || !frameBody) return;
		const ax = anchorBaseX + driveX;
		const ay = anchorBaseY + driveY;
		placeBody(anchorBody, ax, ay);
		placeBody(frameBody, ax + lockDx, ay + lockDy, lockRot);
		linkBodies.forEach((link, i) => {
			const o = lockLinkOffsets[i] || { x: 0, y: SEG_H * (i + 1) };
			placeBody(link, ax + o.x, ay + o.y, 0);
		});
		render();
	}

	/**
	 * @param {{ fromX: number, toX: number, fromY?: number, toY?: number, fromOpacity?: number, toOpacity?: number, duration: number, ease: string, onDone?: () => void }} opts
	 */
	function flyAssembly(opts) {
		const {
			fromX,
			toX,
			fromY = 0,
			toY = 0,
			fromOpacity = 1,
			toOpacity = 1,
			duration,
			ease,
			onDone
		} = opts;
		flyAnim?.pause();
		const slide = { x: fromX, y: fromY, o: fromOpacity };
		driveX = fromX;
		driveY = fromY;
		setFlightOpacity(fromOpacity);
		syncLockedFlight();
		flyAnim = animate(slide, {
			x: [fromX, toX],
			y: [fromY, toY],
			o: [fromOpacity, toOpacity],
			duration,
			ease,
			onUpdate: () => {
				driveX = slide.x;
				driveY = slide.y;
				setFlightOpacity(slide.o);
				syncLockedFlight();
			},
			onComplete: () => {
				driveX = toX;
				driveY = toY;
				setFlightOpacity(toOpacity);
				syncLockedFlight();
				onDone?.();
			}
		});
	}

	function detachHand() {
		if (handConstraint && engine) {
			Composite.remove(engine.world, handConstraint);
			handConstraint = null;
		}
	}

	/**
	 * @param {Matter.Constraint | null} [cut]
	 */
	function beginFall(cut) {
		if (snapped || !engine || !frameBody || !anchorBody) return;
		snapped = true;
		confirming = true;
		mode = 'falling';
		root.classList.add('confirming');
		root.classList.remove('pulling');
		detachHand();

		if (cut && breakableConstraints.includes(cut)) {
			Composite.remove(engine.world, cut);
			breakableConstraints = breakableConstraints.filter((c) => c !== cut);
		} else if (anchorJoint && breakableConstraints.includes(anchorJoint)) {
			Composite.remove(engine.world, anchorJoint);
			breakableConstraints = breakableConstraints.filter((c) => c !== anchorJoint);
			anchorJoint = null;
		}

		setAssemblyStatic(false);

		selectHandlers.onBroken?.();
		sparkBurst = animate(sparkRays, {
			opacity: [0, 1, 0],
			scale: [0.35, 1.45, 0.6],
			duration: 280,
			ease: 'outExpo'
		});
		if (birdRig) {
			const fleeX = birdScaleX >= 0 ? '52vw' : '-52vw';
			birdFly = animate(birdRig, {
				x: ['0', fleeX],
				y: ['0', '-12vh'],
				rotate: [0, birdScaleX >= 0 ? -8 : 8],
				duration: 760,
				ease: 'inOutQuad'
			});
		}
		finishTimer = window.setTimeout(finishGone, FALL_SAFETY_MS);
	}

	/** Ropesimulator.html stretch snap — only while pulling (or just after), never idle auto-break. */
	function checkStretchSnaps() {
		if (snapped || confirming || mode === 'swapping' || !engine) return;

		const armed = mode === 'dragging' || snapArmFrames > 0;
		if (snapArmFrames > 0) snapArmFrames -= 1;
		if (!armed) return;

		for (let i = breakableConstraints.length - 1; i >= 0; i--) {
			const constraint = breakableConstraints[i];
			if (!constraint.bodyA || !constraint.bodyB) continue;

			const pA = Vector.add(constraint.bodyA.position, constraint.pointA);
			const pB = Vector.add(constraint.bodyB.position, constraint.pointB);
			const currentDistance = Vector.magnitude(Vector.sub(pA, pB));
			const stretch = Math.abs(currentDistance - (constraint.length || 0));

			if (stretch > SNAP_THRESHOLD) {
				Composite.remove(engine.world, constraint);
				breakableConstraints.splice(i, 1);
				if (constraint === anchorJoint) anchorJoint = null;
				if (constraint === payloadJoint) payloadJoint = null;
				beginFall(null);
				return;
			}
		}
	}

	/** @param {number} now */
	function tick(now) {
		if (disposed || !engine) return;
		if (!lastTime) {
			lastTime = now;
			startTime = now;
		}
		accumulator += Math.min(50, now - lastTime);
		lastTime = now;

		while (accumulator >= FIXED_MS) {
			// Simulator beforeUpdate: move anchor on X only (conveyor).
			if (!snapped && anchorBody && mode !== 'swapping') {
				if (mode === 'idle') {
					const t = (now - startTime) / 1000;
					driveX = Math.sin(t * 0.55) * IDLE_SWAY_X;
					driveY = 0;
					syncBirdTransform();
				}
				moveAnchor(anchorBaseX + driveX, anchorBaseY + driveY);
			}

			if (mode !== 'swapping') {
				Engine.update(engine, FIXED_MS);
				checkStretchSnaps();
			}
			accumulator -= FIXED_MS;
		}

		render();
		raf = requestAnimationFrame(tick);
	}

	/** @param {PointerEvent} e */
	function stagePointer(e) {
		const rect = stageEl.getBoundingClientRect();
		return {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top
		};
	}

	function endDrag() {
		if (pointerId !== -1) {
			try {
				stripEl.releasePointerCapture?.(pointerId);
			} catch {
				/* ignore */
			}
		}
		pointerId = -1;
		root.classList.remove('pulling');
		if (snapped || confirming || mode === 'falling') {
			detachHand();
			return;
		}
		if (mode !== 'dragging') return;

		detachHand();
		snapArmFrames = 45;
		mode = 'idle';
		startTime = performance.now();
	}

	/** @param {PointerEvent} e */
	function onPointerDown(e) {
		if (
			reduced ||
			confirming ||
			mode === 'swapping' ||
			mode === 'falling' ||
			snapped ||
			!frameBody ||
			!handBody ||
			!engine
		) {
			return;
		}
		if (e.button !== undefined && e.button !== 0) return;
		e.preventDefault();
		mode = 'dragging';
		pointerId = e.pointerId;
		try {
			stripEl.setPointerCapture?.(e.pointerId);
		} catch {
			/* ignore */
		}

		const p = stagePointer(e);
		Body.setPosition(handBody, { x: p.x, y: p.y });
		detachHand();
		const halfW = frameWidth / 2;
		const halfH = frameHeight / 2;
		const localX = Math.max(-halfW, Math.min(halfW, p.x - frameBody.position.x));
		const localY = Math.max(-halfH, Math.min(halfH, p.y - frameBody.position.y));
		handConstraint = Constraint.create({
			bodyA: handBody,
			bodyB: frameBody,
			pointB: { x: localX, y: localY },
			stiffness: HAND_STIFFNESS,
			render: { visible: false },
			label: 'hand'
		});
		Composite.add(engine.world, handConstraint);
		root.classList.add('pulling');
	}

	/** @param {PointerEvent} e */
	function onPointerMove(e) {
		if (mode !== 'dragging' || snapped || !handBody || e.pointerId !== pointerId) return;
		e.preventDefault();
		const p = stagePointer(e);
		Body.setPosition(handBody, { x: p.x, y: p.y });
	}

	/** @param {PointerEvent} e */
	function onPointerUp(e) {
		if (pointerId !== -1 && e.pointerId !== pointerId) return;
		endDrag();
	}

	function bindPull() {
		stripEl.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
	}

	function unbindPull() {
		stripEl.removeEventListener('pointerdown', onPointerDown);
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	}

	buildWorld(0);
	if (!reduced) bindPull();
	if (!reduced && wings.length) {
		wingLoop = animate(wings, {
			scaleY: [1, 0.58, 1],
			duration: 520,
			loop: true,
			ease: 'inOutQuad'
		});
	}
	raf = requestAnimationFrame(tick);

	const resizeObserver = new ResizeObserver(() => {
		if (
			disposed ||
			snapped ||
			mode === 'swapping' ||
			mode === 'dragging' ||
			mode === 'falling' ||
			resizeQueued
		) {
			return;
		}
		resizeQueued = true;
		requestAnimationFrame(() => {
			resizeQueued = false;
			if (disposed || snapped || mode === 'swapping' || mode === 'dragging' || mode === 'falling') {
				return;
			}
			const face = birdScaleX;
			buildWorld(0);
			birdScaleX = face;
			syncBirdTransform();
			mode = 'idle';
			startTime = performance.now();
		});
	});
	resizeObserver.observe(stageEl);
	/* Frame aspect changes often leave stage size unchanged — observe the hang visual too. */
	if (stripEl) resizeObserver.observe(stripEl);

	/**
	 * @param {number} direction
	 * @param {() => void} [onMidFlight]
	 */
	function playSwap(direction, onMidFlight) {
		if (confirming || mode === 'swapping' || mode === 'dragging' || snapped) return;

		if (reduced) {
			onMidFlight?.();
			return;
		}

		mode = 'swapping';
		flyAnim?.pause();
		detachHand();
		const dir = direction < 0 ? -1 : 1;
		const face = dir;
		birdScaleX = face;
		syncBirdTransform();
		lockToAnchor();
		setFlightOpacity(1);

		const exitX = dir * stageWidth * FLY_TRAVEL;
		const enterX = -dir * stageWidth * FLY_TRAVEL;
		const startX = driveX;
		const startY = driveY;

		flyAssembly({
			fromX: startX,
			toX: exitX,
			fromY: startY,
			toY: -FLY_ARC_PX,
			fromOpacity: 1,
			toOpacity: 0,
			duration: FLY_OUT_MS,
			ease: 'inCubic',
			onDone: () => {
				if (disposed || confirming) {
					mode = 'idle';
					setFlightOpacity(1);
					return;
				}
				onMidFlight?.();
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						if (disposed || confirming) {
							mode = 'idle';
							setFlightOpacity(1);
							return;
						}
						birdScaleX = face;
						buildWorld(enterX);
						birdScaleX = face;
						driveY = -FLY_ARC_PX;
						syncBirdTransform();
						lockToAnchor();
						mode = 'swapping';
						setFlightOpacity(0);

						flyAssembly({
							fromX: enterX,
							toX: 0,
							fromY: -FLY_ARC_PX,
							toY: 0,
							fromOpacity: 0,
							toOpacity: 1,
							duration: FLY_IN_MS,
							ease: 'outCubic',
							onDone: () => {
								if (disposed || confirming) {
									mode = 'idle';
									setFlightOpacity(1);
									return;
								}
								driveX = 0;
								driveY = 0;
								birdScaleX = face;
								setFlightOpacity(1);
								syncBirdTransform();
								lockDx = 0;
								lockDy = restRopePx + frameHeight / 2;
								lockRot = 0;
								lockLinkOffsets = linkBodies.map((_, i) => ({
									x: 0,
									y: SEG_H * (i + 0.5)
								}));
								unlockHang();
								mode = 'idle';
								startTime = performance.now();
								render();
							}
						});
					});
				});
			}
		});
	}

	/** @param {() => void} onDone */
	function playConfirm(onDone) {
		if (confirming) return;
		selectHandlers.onGone = onDone;
		if (reduced) {
			selectHandlers.onBroken?.();
			finishGone();
			return;
		}
		beginFall(anchorJoint);
	}

	/**
	 * Retreat from the courier hall — relic rises back toward Olympus, then hand off to Landing.
	 * @param {() => void} onDone
	 */
	function playBackToLanding(onDone) {
		if (disposed || confirming) {
			onDone();
			return;
		}
		confirming = true;
		unbindPull();
		wingLoop?.pause();
		birdFly?.pause();
		flyAnim?.pause();
		root.classList.add('exiting', 'backing');
		root.classList.remove('pulling');

		const chrome = root.querySelectorAll('.head, .pager, .footer, .nav');
		const mountains = root.querySelectorAll('.mountains');
		const veil = root.querySelector('.back-veil');

		if (reduced) {
			const tl = createTimeline({
				defaults: { ease: 'linear' },
				onComplete: onDone
			});
			if (veil) tl.add(veil, { opacity: [0, 1], duration: 180 }, 0);
			else tl.add(root, { opacity: [1, 0], duration: 180 }, 0);
			return;
		}

		const tl = createTimeline({
			defaults: { ease: 'inCubic' },
			onComplete: onDone
		});

		if (chrome.length) {
			tl.add(
				chrome,
				{ opacity: [1, 0], y: ['0rem', '0.55rem'], duration: 320, delay: stagger(28) },
				0
			);
		}
		if (mountains.length) {
			tl.add(
				mountains,
				{ opacity: [1, 0.35], y: ['0%', '6%'], duration: 520, ease: 'inQuad' },
				40
			);
		}
		if (birdRig) {
			tl.add(
				birdRig,
				{
					opacity: [1, 0],
					y: ['0px', '-140px'],
					x: ['0px', '36px'],
					scale: [1, 0.72],
					duration: 620,
					ease: 'inExpo'
				},
				60
			);
		}
		tl.add(
			hangEl,
			{
				opacity: [1, 0],
				y: ['0px', '-180px'],
				scale: [1, 0.78],
				rotate: [0, -6],
				duration: 680,
				ease: 'inExpo'
			},
			80
		);
		tl.add(ropeEl, { opacity: [1, 0], duration: 280, ease: 'outQuad' }, 40);
		if (veil) {
			tl.add(veil, { opacity: [0, 1], duration: 360, ease: 'inQuad' }, 380);
		} else {
			tl.add(root, { opacity: [1, 0], duration: 320, ease: 'inQuad' }, 420);
		}
	}

	/** @param {{ onBroken?: () => void, onGone?: () => void }} handlers */
	function setSelectHandlers(handlers) {
		selectHandlers = handlers || {};
	}

	function dispose() {
		disposed = true;
		cancelAnimationFrame(raf);
		window.clearTimeout(finishTimer);
		resizeObserver.disconnect();
		unbindPull();
		flyAnim?.pause();
		wingLoop?.pause();
		birdFly?.pause();
		sparkBurst?.pause();
		clearWorld();
		hangEl.style.removeProperty('translate');
		hangEl.style.removeProperty('transform');
		hangEl.style.removeProperty('opacity');
		if (birdRig) {
			birdRig.style.removeProperty('transform');
			birdRig.style.removeProperty('top');
			birdRig.style.removeProperty('opacity');
		}
		ropeEl.style.removeProperty('opacity');
		root.classList.remove('physics-ready', 'confirming', 'pulling', 'backing');
	}

	return { playSwap, playConfirm, playBackToLanding, setSelectHandlers, dispose };
}
