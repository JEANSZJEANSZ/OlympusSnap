/**
 * PNG fallback is only worth it when the server rejects JPEG as a media type.
 * Retrying on 5xx/timeouts posts a much larger PNG after a failed upload.
 *
 * @param {number} status
 * @param {string} contentType
 * @returns {boolean}
 */
export function shouldRetryCaptureAsPng(status, contentType) {
	return contentType === 'image/jpeg' && status === 415;
}
