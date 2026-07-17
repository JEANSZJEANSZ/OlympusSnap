/**
 * Frame Select physics — Rapier 2D drives a real rope chain and rigid frame.
 */
import { animate } from 'animejs';

const PX_PER_METER = 100;
const ROPE_NODES = 6;
const FIXED_STEP = 1 / 60;

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

	/** @type {RAPIER.World | null} */
	let world = null;
	/** @type {RAPIER.RigidBody | null} */
	let anchorBody = null;
	/** @type {RAPIER.RigidBody[]} */
	let ropeBodies = [];
	/** @type {RAPIER.RigidBody | null} */
	let frameBody = null;
	/** @type {RAPIER.ImpulseJoint | null} */
	let anchorJoint = null;
	/** @type {ReturnType<typeof animate> | null} */
	let wingLoop = null;
	/** @type {ReturnType<typeof animate> | null} */
	let birdFly = null;
	/** @type {ReturnType<typeof animate> | null} */
	let sparkBurst = null;
	let raf = 0;
	let finishTimer = 0;
	let disposed = false;
	let snapped = false;
	let confirming = false;
	let lastTime = 0;
	let accumulator = 0;
	let startTime = 0;
	let stageWidth = 1;
	let stageHeight = 1;
	let frameWidth = 1;
	let frameHeight = 1;
	let anchorBaseX = 0;
	let anchorBaseY = 0;
	let resizeQueued = false;
	/** @type {typeof import('@dimforge/rapier2d-compat') | null} */
	let RAPIER = null;

	function clearWorld() {
		world?.free();
		world = null;
		anchorBody = null;
		ropeBodies = [];
		frameBody = null;
		anchorJoint = null;
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
		anchorBaseY = Math.min(62, Math.max(46, stageHeight * 0.2));

		world = new RAPIER.World({ x: 0, y: 11.5 });
		world.timestep = FIXED_STEP;
		world.numSolverIterations = 12;
		world.numInternalPgsIterations = 2;

		anchorBody = world.createRigidBody(
			RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(m(anchorBaseX), m(anchorBaseY))
		);

		const ropeLengthPx = Math.min(62, Math.max(38, stageHeight * 0.2));
		const segmentPx = ropeLengthPx / ROPE_NODES;
		let previous = anchorBody;
		for (let i = 0; i < ROPE_NODES; i++) {
			const node = world.createRigidBody(
				RAPIER.RigidBodyDesc.dynamic()
					.setTranslation(m(anchorBaseX), m(anchorBaseY + segmentPx * (i + 1)))
					.setLinearDamping(0.06)
					.setAngularDamping(0.12)
					.setAdditionalMass(0.08)
					.setCanSleep(false)
			);
			world.createCollider(
				RAPIER.ColliderDesc.ball(0.012).setDensity(0.08).setCollisionGroups(0x00010002),
				node
			);
			const joint = world.createImpulseJoint(
				RAPIER.JointData.rope(m(segmentPx), { x: 0, y: 0 }, { x: 0, y: 0 }),
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
				.setRotation(0.025)
				.setLinearDamping(0.06)
				.setAngularDamping(0.14)
				.setCanSleep(false)
				.setCcdEnabled(true)
		);
		world.createCollider(
			RAPIER.ColliderDesc.cuboid(m(frameWidth / 2), m(frameHeight / 2))
				.setDensity(0.08)
				.setFriction(0.55)
				.setRestitution(0.22)
				.setCollisionGroups(0x00020001),
			frameBody
		);
		world.createImpulseJoint(
			RAPIER.JointData.revolute(
				{ x: 0, y: 0 },
				{ x: 0, y: -m(frameHeight / 2) }
			),
			previous,
			frameBody,
			true
		);

		// A hidden physical floor gives the released relic one real bounce.
		const floor = world.createRigidBody(
			RAPIER.RigidBodyDesc.fixed().setTranslation(m(stageWidth / 2), m(stageHeight + frameHeight * 0.25))
		);
		world.createCollider(
			RAPIER.ColliderDesc.cuboid(m(stageWidth), 0.08).setFriction(0.7).setRestitution(0.28),
			floor
		);

		root.classList.add('physics-ready');
		renderPhysics();
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
			if (!snapped && anchorBody) {
				const t = (now - startTime) / 1000;
				const offsetX = Math.sin(t * 0.9) * 8;
				const offsetY = Math.sin(t * 1.45) * 2.5;
				anchorBody.setNextKinematicTranslation({
					x: m(anchorBaseX + offsetX),
					y: m(anchorBaseY + offsetY)
				});
				if (birdRig) {
					birdRig.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
				}
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
		if (disposed || snapped || resizeQueued) return;
		resizeQueued = true;
		requestAnimationFrame(() => {
			resizeQueued = false;
			if (world && !disposed && !snapped) buildWorld();
		});
	});
	resizeObserver.observe(stage);

	/** @param {number} direction */
	function playSwap(direction) {
		if (reduced || confirming) return;
		ready.then(() => {
			if (!frameBody || confirming) return;
			const dir = direction < 0 ? -1 : 1;
			const center = frameBody.translation();
			frameBody.applyImpulseAtPoint(
				{ x: dir * 0.42, y: -0.06 },
				{ x: center.x, y: center.y + m(frameHeight * 0.38) },
				true
			);
			frameBody.setAngvel(dir * 0.85, true);
		});
	}

	/** @param {() => void} onDone */
	function playConfirm(onDone) {
		if (confirming) return;
		confirming = true;
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
				world.removeImpulseJoint(anchorJoint, true);
				anchorJoint = null;
				frameBody.applyImpulse({ x: 0.16, y: -0.02 }, true);
				frameBody.setAngvel(1.65, true);
				sparkBurst = animate(sparkRays, {
					opacity: [0, 1, 0],
					scale: [0.35, 1.4, 0.65],
					duration: 280,
					ease: 'outExpo'
				});
				if (birdRig) {
					birdFly = animate(birdRig, {
						x: ['0', '52vw'],
						y: ['0', '-12vh'],
						rotate: [0, -7],
						duration: 760,
						ease: 'inOutQuad'
					});
				}
				finishTimer = window.setTimeout(onDone, 1250);
			})
			.catch(onDone);
	}

	function dispose() {
		disposed = true;
		cancelAnimationFrame(raf);
		window.clearTimeout(finishTimer);
		resizeObserver.disconnect();
		wingLoop?.pause();
		birdFly?.pause();
		sparkBurst?.pause();
		clearWorld();
		hangGroup.style.removeProperty('translate');
		hangGroup.style.removeProperty('transform');
		root.classList.remove('physics-ready', 'confirming');
	}

	return { playSwap, playConfirm, dispose };
}
