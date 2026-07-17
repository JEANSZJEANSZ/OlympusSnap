/**
 * Camera helpers — navigator.mediaDevices getUserMedia + device switching.
 * Stubbed for the UI / layout pass.
 */

/** @type {MediaStream | null} */
let activeStream = null;

/**
 * @param {HTMLVideoElement} videoEl
 * @param {string} [deviceId]
 * @returns {Promise<MediaStream | null>}
 */
export async function startCamera(videoEl, deviceId) {
	stopCamera();
	try {
		const constraints = {
			video: deviceId
				? { deviceId: { exact: deviceId }, facingMode: 'user' }
				: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
			audio: false
		};
		activeStream = await navigator.mediaDevices.getUserMedia(constraints);
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
