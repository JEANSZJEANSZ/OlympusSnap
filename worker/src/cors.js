const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
function allowedOrigins(env) {
	const extra = (env.CORS_ORIGINS || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return [...DEFAULT_ORIGINS, ...extra];
}

/**
 * @param {string | null} origin
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
export function corsHeaders(origin, env) {
	if (!origin || !allowedOrigins(env).includes(origin)) {
		return {};
	}
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, X-Booth-Key',
		'Access-Control-Expose-Headers': 'X-Frame-Id',
		Vary: 'Origin'
	};
}

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @returns {Response | null}
 */
export function handleOptions(request, env) {
	if (request.method !== 'OPTIONS') return null;
	return new Response(null, {
		status: 204,
		headers: corsHeaders(request.headers.get('Origin'), env)
	});
}

/**
 * @param {Response} response
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @returns {Response}
 */
export function withCors(response, request, env) {
	const headers = new Headers(response.headers);
	const cors = corsHeaders(request.headers.get('Origin'), env);
	for (const [key, value] of Object.entries(cors)) {
		if (key === 'Access-Control-Allow-Origin' && headers.has('Access-Control-Allow-Origin')) {
			continue;
		}
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
