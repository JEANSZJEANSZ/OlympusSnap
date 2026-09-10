/** Long-edge cap for booth → phone session upload (Studio stickers, not print). */
export const HANDOFF_MAX_LONG_EDGE = 3200;
export const HANDOFF_JPEG_QUALITY = 0.8;

/**
 * Scale a source size so the long edge never exceeds `maxLong`.
 * @param {number} srcW
 * @param {number} srcH
 * @param {number} [maxLong=HANDOFF_MAX_LONG_EDGE]
 * @returns {{ width: number; height: number }}
 */
export function handoffOutputSize(srcW, srcH, maxLong = HANDOFF_MAX_LONG_EDGE) {
	if (!srcW || !srcH) return { width: 1, height: 1 };
	const long = Math.max(srcW, srcH);
	const scale = long > maxLong ? maxLong / long : 1;
	return {
		width: Math.max(1, Math.round(srcW * scale)),
		height: Math.max(1, Math.round(srcH * scale))
	};
}
