/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @returns {Response | null} null when authorized
 */
export function requireBoothKey(request, env) {
	const expected = env.BOOTH_KEY;
	if (!expected) {
		return new Response('Server misconfigured: BOOTH_KEY missing', { status: 503 });
	}
	const key = request.headers.get('X-Booth-Key');
	if (key !== expected) {
		return new Response('Unauthorized', { status: 401 });
	}
	return null;
}
