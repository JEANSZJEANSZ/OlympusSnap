/**
 * Camera helpers — navigator.mediaDevices getUserMedia + device switching.
 */

/** @type {MediaStream | null} */
let activeStream = null;

const CAMERA_ID_KEY = 'olympus-snap-camera-id';
const ATTEMPT_TIMEOUT_MS = 12000;

const EXTERNAL_HINTS = [
	'elgato',
	'cam link',
	'capture',
	'hdmi',
	'blackmagic',
	'sony',
	'canon',
	'nikon',
	'obs',
	'stream',
	'external',
	'usb',
	'webcam',
	'video capture',
	'avermedia',
	'razer'
];

const BUILTIN_HINTS = [
	'integrated',
	'facetime',
	'internal',
	'ir camera',
	'windows hello',
	'built-in',
	'builtin',
	'laptop'
];

/**
 * @param {string} key
 * @returns {string | null}
 */
function readSession(key) {
	try {
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

/**
 * @param {string} key
 * @param {string} value
 */
function writeSession(key, value) {
	try {
		sessionStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

/**
 * @param {MediaDeviceInfo} device
 */
function scoreCamera(device) {
	const label = (device.label || '').toLowerCase();
	let score = 0;

	for (const hint of EXTERNAL_HINTS) {
		if (label.includes(hint)) score += 12;
	}
	for (const hint of BUILTIN_HINTS) {
		if (label.includes(hint)) score -= 10;
	}
	if (device.deviceId && device.deviceId !== 'default') score += 2;
	if (label.includes('virtual')) score -= 6;

	return score;
}

/**
 * @param {MediaDeviceInfo[]} devices
 * @param {string | null | undefined} savedId
 */
export function pickPreferredCamera(devices, savedId) {
	const inputs = devices.filter((d) => d.kind === 'videoinput');
	if (!inputs.length) return null;

	if (savedId && inputs.some((d) => d.deviceId === savedId)) {
		return savedId;
	}

	const ranked = [...inputs].sort((a, b) => scoreCamera(b) - scoreCamera(a));
	return ranked[0]?.deviceId ?? null;
}

/**
 * @param {string} [deviceId]
 * @param {{ strict?: boolean; relaxed?: boolean }} [opts]
 */
function buildVideoConstraints(deviceId, opts = {}) {
	const { strict = false, relaxed = false } = opts;
	const size = relaxed
		? {
				width: { ideal: 1280, min: 640 },
				height: { ideal: 720, min: 480 }
			}
		: {
				width: { ideal: 1920, min: 640 },
				height: { ideal: 1080, min: 480 }
			};

	if (deviceId) {
		return {
			video: {
				deviceId: strict ? { exact: deviceId } : { ideal: deviceId },
				...size
			},
			audio: false
		};
	}

	return { video: size, audio: false };
}

/**
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, ms) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('Camera request timed out')), ms);
		promise
			.then((value) => {
				clearTimeout(timer);
				resolve(value);
			})
			.catch((err) => {
				clearTimeout(timer);
				reject(err);
			});
	});
}

/** Ensure device labels are available for scoring. */
async function ensureDeviceLabels() {
	if (!navigator.mediaDevices?.getUserMedia) return [];
	let devices = await listCameras();
	if (devices.some((d) => d.label)) return devices;

	try {
		const probe = await withTimeout(
			navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
			ATTEMPT_TIMEOUT_MS
		);
		for (const track of probe.getTracks()) track.stop();
		devices = await listCameras();
	} catch (err) {
		console.warn('[camera] permission probe failed', err);
	}

	return devices;
}

/**
 * @param {MediaStream} stream
 * @param {HTMLVideoElement} videoEl
 */
async function waitForVideoReady(stream, videoEl) {
	videoEl.srcObject = stream;
	await videoEl.play();

	const deadline = Date.now() + ATTEMPT_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) return;
		await new Promise((r) => setTimeout(r, 50));
	}

	throw new Error('Video metadata never became ready');
}

/**
 * @param {MediaStream} stream
 */
async function upgradeVideoTrack(stream) {
	const track = stream.getVideoTracks()[0];
	if (!track) return;
	try {
		const caps = track.getCapabilities?.();
		if (!caps) return;
		const width = caps.width?.max;
		const height = caps.height?.max;
		if (width && height) {
			await track.applyConstraints({
				width: { ideal: Math.min(width, 1920) },
				height: { ideal: Math.min(height, 1080) }
			});
		}
	} catch (err) {
		console.warn('[camera] resolution upgrade skipped', err);
	}
}

/**
 * @param {HTMLVideoElement} videoEl
 * @param {MediaTrackConstraints | boolean} constraints
 */
async function tryOpen(videoEl, constraints) {
	const stream = await withTimeout(
		navigator.mediaDevices.getUserMedia({ video: constraints, audio: false }),
		ATTEMPT_TIMEOUT_MS
	);
	await waitForVideoReady(stream, videoEl);
	await upgradeVideoTrack(stream);
	return stream;
}

/**
 * @param {HTMLVideoElement} videoEl
 * @param {string | null | undefined} deviceId
 * @param {{ strict?: boolean; relaxed?: boolean }} [opts]
 */
async function tryDevice(videoEl, deviceId, opts) {
	if (deviceId) {
		return await tryOpen(videoEl, buildVideoConstraints(deviceId, opts).video);
	}
	return await tryOpen(videoEl, buildVideoConstraints(undefined, opts).video);
}

/**
 * @param {HTMLVideoElement} videoEl
 * @param {string} [preferredDeviceId]
 * @returns {Promise<MediaStream | null>}
 */
export async function startCamera(videoEl, preferredDeviceId) {
	stopCamera();
	if (!navigator.mediaDevices?.getUserMedia) {
		console.warn('[camera] mediaDevices unavailable');
		return null;
	}

	const savedId = readSession(CAMERA_ID_KEY);
	const devices = await ensureDeviceLabels();
	const pickedId = preferredDeviceId ?? pickPreferredCamera(devices, savedId);

	/** @type {Array<{ label: string; fn: () => Promise<MediaStream> }>} */
	const attempts = [];

	if (pickedId) {
		attempts.push({
			label: `preferred:${pickedId.slice(0, 8)}`,
			fn: () => tryDevice(videoEl, pickedId, { strict: false })
		});
		attempts.push({
			label: `preferred-exact:${pickedId.slice(0, 8)}`,
			fn: () => tryDevice(videoEl, pickedId, { strict: true })
		});
	}

	const ranked = [...devices]
		.filter((d) => d.kind === 'videoinput')
		.sort((a, b) => scoreCamera(b) - scoreCamera(a));

	for (const device of ranked) {
		if (device.deviceId === pickedId) continue;
		attempts.push({
			label: `device:${device.label || device.deviceId.slice(0, 8)}`,
			fn: () => tryDevice(videoEl, device.deviceId, { strict: false })
		});
	}

	attempts.push(
		{ label: 'relaxed-default', fn: () => tryDevice(videoEl, null, { relaxed: true }) },
		{ label: 'generic', fn: () => tryOpen(videoEl, true) }
	);

	for (const attempt of attempts) {
		try {
			activeStream = await attempt.fn();
			const track = activeStream.getVideoTracks()[0];
			const settings = track?.getSettings?.();
			if (settings?.deviceId) writeSession(CAMERA_ID_KEY, settings.deviceId);
			return activeStream;
		} catch (err) {
			console.warn(`[camera] ${attempt.label} failed`, err);
			stopCamera();
			videoEl.srcObject = null;
		}
	}

	activeStream = null;
	return null;
}

export function stopCamera() {
	if (!activeStream) return;
	for (const track of activeStream.getTracks()) track.stop();
	activeStream = null;
}

/**
 * @returns {Promise<MediaDeviceInfo[]>}
 */
export async function listCameras() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((d) => d.kind === 'videoinput');
	} catch {
		return [];
	}
}

/**
 * Capture current video frame as base64 PNG (mirrored to match preview).
 * @param {HTMLVideoElement} videoEl
 * @returns {string | null}
 */
export function captureFrame(videoEl) {
	if (!videoEl.videoWidth) return null;
	const canvas = document.createElement('canvas');
	canvas.width = videoEl.videoWidth;
	canvas.height = videoEl.videoHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.translate(canvas.width, 0);
	ctx.scale(-1, 1);
	ctx.drawImage(videoEl, 0, 0);
	return canvas.toDataURL('image/png');
}
