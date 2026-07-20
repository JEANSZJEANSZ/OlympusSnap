/**
 * Frame Select physics — Rapier 2D rope chain + rigid strip.
 * Idle: free hang (no floor). Swap: eagle fly-through. Confirm: snap + fall to page bottom.
 */
import { animate } from 'animejs';

const PX_PER_METER = 100;
const ROPE_NODES = 7;
const FIXED_STEP = 1 / 60;
const FLY_MS = 1280;

/** @param {number} px */
const m = (px) => px / PX_PER_METER;
/** @param {number} meters */
const px = (meters) => meters * PX_PER_METER;

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

	if (!stage || !hangGroup || !frameBodyEl || !ropeLine) {
		return {
			playSwap() {},
			/** @param {() => void} onDone */
			playConfirm(onDone) {
				onDone();
			},
			dispose() {}
		};
	}

	/** @type {import('@dimforge/rapier2d-compat').World | null} */
	let world = null;
	/** @type {import('@dimforge/rapier2d-compat').RigidBody | null} */
	let anchorBody = null;
	/** @type {import('@dimforge/rapier2d-compat').RigidBody[]} */
	let ropeBodies = [];
	/** @type {import('@dimforge/rapier2d-compat').RigidBody | null} */
	let frameBody = null;
	/** @type {import('@dimforge/rapier2d-compat').ImpulseJoint | null} */
	let anchorJoint = null;
	/** @type {import('@dimforge/rapier2d-compat').RigidBody | null} */
	let floorBody = null;
	/** @type {ReturnType<typeof animate> | null} */
	let wingLoop = null;
	/** @type {ReturnType<typeof animate> | null} */
	let birdFly = null;
	/** @type {ReturnType<typeof animate> | null} */
	let sparkBurst = null;
	/** @type {typeof import('@dimforge/rapier2d-compat') | null} */
	let RAPIER = null;

	let raf = 0;
	let finishTimer = 0;
	let midSwapTimer = 0;
	let disposed = false;
	let snapped = false;
	let confirming = false;
	let swapping = false;
	let lastTime = 0;
	let accumulator = 0;
	let startTime = 0;
	let stageWidth = 1;
	let stageHeight = 1;
	let frameWidth = 1;
	let frameHeight = 1;
	let anchorBaseX = 0;
	let anchorBaseY = 0;
	/** Kinematic offset driven by idle sway or fly-through */
	let driveX = 0;
	let driveY = 0;
	let birdScaleX = 1;
	let resizeQueued = false;

	function clearWorld() {
		world?.free();
		world = null;
		anchorBody = null;
		ropeBodies = [];
		frameBody = null;
		anchorJoint = null;
		floorBody = null;
	}

	function syncBirdTransform() {
		if (!birdRig) return;
		birdRig.style.transform = `translate3d(${driveX}px, ${driveY}px, 0) scaleX(${birdScaleX})`;
	}

	function buildWorld() {
		if (!RAPIER) return;
		clearWorld();
		const stageRect = stage.getBoundingClientRect();
		const frameRect = frameBodyEl.getBoundingClientRect();
		stageWidth = Math.max(1, stageRect.width);
		stageHeight = Math.max(1, stageRect.height);
		frameWidth = Math.max(1, frameRect.width);
		frameHeight = Math.max(1, frameRect.height);
		hangGroup.style.translate = '-50% 0';
		anchorBaseX = stageWidth / 2;
		anchorBaseY = Math.min(58, Math.max(42, stageHeight * 0.14));
		driveX = 0;
		driveY = 0;

		world = new RAPIER.World({ x: 0, y: 12.5 });
		world.timestep = FIXED_STEP;
		world.numSolverIterations = 12;
		world.numInternalPgsIterations = 2;

		anchorBody = world.createRigidBody(
			RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(m(anchorBaseX), m(anchorBaseY))
		);

		const ropeLengthPx = Math.min(118, Math.max(88, stageHeight * 0.28));
		const segmentPx = ropeLengthPx / ROPE_NODES;
		let previous = anchorBody;
		for (let i = 0; i < ROPE_NODES; i++) {
			const node = world.createRigidBody(
				RAPIER.RigidBodyDesc.dynamic()
					.setTranslation(m(anchorBaseX), m(anchorBaseY + segmentPx * (i + 1)))
					.setLinearDamping(0.03)
					.setAngularDamping(0.06)
					.setAdditionalMass(0.06)
					.setCanSleep(false)
			);
			world.createCollider(
				RAPIER.ColliderDesc.ball(0.01).setDensity(0.05).setCollisionGroups(0x00010002),
				node
			);
			const joint = world.createImpulseJoint(
				RAPIER.JointData.rope(m(segmentPx * 1.02), { x: 0, y: 0 }, { x: 0, y: 0 }),
				previous,
				node,
				true
			);
			if (i === 0) anchorJoint = joint;
			ropeBodies.push(node);
			previous = node;
		}

		const frameCenterY = anchorBaseY + ropeLengthPx + frameHeight / 2;
		frameBody = world.createRigidBody(
			RAPIER.RigidBodyDesc.dynamic()
				.setTranslation(m(anchorBaseX), m(frameCenterY))
				.setRotation(0.04)
				.setLinearDamping(0.04)
				.setAngularDamping(0.08)
				.setCanSleep(false)
				.setCcdEnabled(true)
		);
		world.createCollider(
			RAPIER.ColliderDesc.cuboid(m(frameWidth / 2), m(frameHeight / 2))
				.setDensity(0.06)
				.setFriction(0.5)
				.setRestitution(0.18)
				.setCollisionGroups(0x00020001),
			frameBody
		);
		world.createImpulseJoint(
			RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: -m(frameHeight / 2) }),
			previous,
			frameBody,
			true
		);

		// No idle floor — free hang. Floor is spawned only on confirm.

		root.classList.add('physics-ready');
		syncBirdTransform();
		renderPhysics();
	}

	function spawnPageFloor() {
		if (!RAPIER || !world || floorBody) return;
		const rootRect = root.getBoundingClientRect();
		const stageRect = stage.getBoundingClientRect();
		const floorY = rootRect.bottom - stageRect.top - 8;
		floorBody = world.createRigidBody(
			RAPIER.RigidBodyDesc.fixed().setTranslation(m(stageWidth / 2), m(floorY))
		);
		world.createCollider(
			RAPIER.ColliderDesc.cuboid(m(Math.max(stageWidth, rootRect.width) * 0.7), 0.1)
				.setFriction(0.75)
				.setRestitution(0.2),
			floorBody
		);
	}

	function renderPhysics() {
		if (!frameBody || !anchorBody) return;
		const framePos = frameBody.translation();
		const frameX = px(framePos.x);
		const frameY = px(framePos.y);
		hangGroup.style.transform = `translate3d(${frameX - stageWidth / 2}px, ${frameY - frameHeight / 2}px, 0) rotate(${frameBody.rotation()}rad)`;

		const anchorPos = anchorBody.translation();
		const points = [`${px(anchorPos.x).toFixed(1)},${px(anchorPos.y).toFixed(1)}`];
		for (const body of ropeBodies) {
			const p = body.translation();
			points.push(`${px(p.x).toFixed(1)},${px(p.y).toFixed(1)}`);
		}
		points.push(`${frameX.toFixed(1)},${(frameY - frameHeight / 2).toFixed(1)}`);
		ropeLine.setAttribute('points', points.join(' '));

		if (spark) {
			const first = ropeBodies[0]?.translation();
			if (first) {
				spark.style.left = `${(px(anchorPos.x) + px(first.x)) / 2}px`;
				spark.style.top = `${(px(anchorPos.y) + px(first.y)) / 2}px`;
			}
		}
	}

	/** @param {number} now */
	function tick(now) {
		if (disposed || !world) return;
		if (!lastTime) {
			lastTime = now;
			startTime = now;
		}
		accumulator += Math.min(0.05, (now - lastTime) / 1000);
		lastTime = now;

		while (accumulator >= FIXED_STEP) {
			if (!snapped && !swapping && anchorBody) {
				const t = (now - startTime) / 1000;
				driveX = Math.sin(t * 0.85) * 10;
				driveY = Math.sin(t * 1.35) * 3.2;
				syncBirdTransform();
			}
			if (!snapped && anchorBody) {
				anchorBody.setNextKinematicTranslation({
					x: m(anchorBaseX + driveX),
					y: m(anchorBaseY + driveY)
				});
			}
			world.step();
			accumulator -= FIXED_STEP;
		}
		renderPhysics();
		raf = requestAnimationFrame(tick);
	}

	const ready = import('@dimforge/rapier2d-compat').then(async (module) => {
		RAPIER = module;
		await RAPIER.init();
		if (disposed) return;
		buildWorld();
		if (!reduced && wings.length) {
			wingLoop = animate(wings, {
				scaleY: [1, 0.58, 1],
				duration: 520,
				loop: true,
				ease: 'inOutQuad'
			});
		}
		raf = requestAnimationFrame(tick);
	});

	const resizeObserver = new ResizeObserver(() => {
		if (disposed || snapped || swapping || resizeQueued) return;
		resizeQueued = true;
		requestAnimationFrame(() => {
			resizeQueued = false;
			if (world && !disposed && !snapped && !swapping) buildWorld();
		});
	});
	resizeObserver.observe(stage);

	/**
	 * Eagle flies across stage carrying the jointed strip.
	 * @param {number} direction +1 left→right, -1 right→left
	 * @param {() => void} [onMidFlight] swap strip content at midpoint
	 */
	function playSwap(direction, onMidFlight) {
		if (confirming || swapping) return;

		if (reduced) {
			onMidFlight?.();
			return;
		}

		swapping = true;
		const dir = direction < 0 ? -1 : 1;
		birdScaleX = dir;
			const span = stageWidth * 0.36;
			const startX = -dir * span;
			const endX = dir * span;
			let midFired = false;
			const t0 = performance.now();

			ready.then(() => {
				if (disposed || confirming) {
					swapping = false;
					onMidFlight?.();
					return;
				}

				/** @param {number} now */
				function flyStep(now) {
					if (disposed || confirming) {
						swapping = false;
						return;
					}
					const u = Math.min(1, (now - t0) / FLY_MS);
					// Smoothstep — gentler acceleration so the rope doesn't whip overhead
					const e = u * u * (3 - 2 * u);
					driveX = startX + (endX - startX) * e;
					driveY = Math.sin(e * Math.PI) * -8;
					syncBirdTransform();

					if (!midFired && u >= 0.48) {
						midFired = true;
						onMidFlight?.();
						if (frameBody) {
							frameBody.applyImpulse({ x: dir * 0.12, y: 0.02 }, true);
							frameBody.setAngvel(dir * 0.55, true);
						}
					}

					if (u < 1) {
						requestAnimationFrame(flyStep);
						return;
					}

					const settleStart = performance.now();
					const fromX = driveX;
					const fromY = driveY;
					/** @param {number} n */
					function settle(n) {
						if (disposed || confirming) {
							swapping = false;
							return;
						}
						const s = Math.min(1, (n - settleStart) / 520);
						const se = 1 - Math.pow(1 - s, 3);
						driveX = fromX + (0 - fromX) * se;
						driveY = fromY + (0 - fromY) * se;
						syncBirdTransform();
						if (s < 1) {
							requestAnimationFrame(settle);
							return;
						}
						driveX = 0;
						driveY = 0;
						birdScaleX = 1;
						syncBirdTransform();
						swapping = false;
						startTime = performance.now();
					}
					requestAnimationFrame(settle);
				}
				requestAnimationFrame(flyStep);
			});
		}

	/** @param {() => void} onDone */
	function playConfirm(onDone) {
		if (confirming) return;
		confirming = true;
		swapping = false;
		root.classList.add('confirming');
		if (reduced) {
			onDone();
			return;
		}
		ready
			.then(() => {
				if (!world || !anchorJoint || !frameBody || disposed) {
					onDone();
					return;
				}
				snapped = true;
				spawnPageFloor();
				world.removeImpulseJoint(anchorJoint, true);
				anchorJoint = null;
				frameBody.applyImpulse({ x: 0.12, y: 0.05 }, true);
				frameBody.setAngvel(1.4, true);
				sparkBurst = animate(sparkRays, {
					opacity: [0, 1, 0],
					scale: [0.35, 1.4, 0.65],
					duration: 280,
					ease: 'outExpo'
				});
				if (birdRig) {
					birdFly = animate(birdRig, {
						x: ['0', '55vw'],
						y: ['0', '-14vh'],
						rotate: [0, -8],
						duration: 780,
						ease: 'inOutQuad'
					});
				}
				finishTimer = window.setTimeout(onDone, 1400);
			})
			.catch(onDone);
	}

	function dispose() {
		disposed = true;
		cancelAnimationFrame(raf);
		window.clearTimeout(finishTimer);
		window.clearTimeout(midSwapTimer);
		resizeObserver.disconnect();
		wingLoop?.pause();
		birdFly?.pause();
		sparkBurst?.pause();
		clearWorld();
		hangGroup.style.removeProperty('translate');
		hangGroup.style.removeProperty('transform');
		if (birdRig) birdRig.style.removeProperty('transform');
		root.classList.remove('physics-ready', 'confirming');
	}

	return { playSwap, playConfirm, dispose };
}
