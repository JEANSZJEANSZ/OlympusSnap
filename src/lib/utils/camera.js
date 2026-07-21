/**
 * Camera helpers — navigator.mediaDevices getUserMedia + device switching.
 */

/** @type {MediaStream | null} */
let activeStream = null;

/** @param {string} [deviceId] */
function buildVideoConstraints(deviceId) {
	const size = {
		width: { ideal: 1920, min: 640 },
		height: { ideal: 1080, min: 480 }
	};
	if (deviceId) {
		return {
			video: { deviceId: { exact: deviceId }, facingMode: 'user', ...size },
			audio: false
		};
	}
	return {
		video: { facingMode: 'user', ...size },
		audio: false
	};
}

/** @param {MediaStream} stream */
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
				width: { ideal: width },
				height: { ideal: height }
			});
		}
	} catch {
		/* best effort — keep negotiated stream */
	}
}

/**
 * @param {HTMLVideoElement} videoEl
 * @param {string} [deviceId]
 * @returns {Promise<MediaStream | null>}
 */
export async function startCamera(videoEl, deviceId) {
	stopCamera();
	try {
		activeStream = await navigator.mediaDevices.getUserMedia(buildVideoConstraints(deviceId));
		await upgradeVideoTrack(activeStream);
		videoEl.srcObject = activeStream;
		await videoEl.play();
		return activeStream;
	} catch {
		activeStream = null;
		return null;
	}
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
