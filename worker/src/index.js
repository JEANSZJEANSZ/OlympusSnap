import { requireBoothKey } from './auth.js';
import { handleOptions, withCors } from './cors.js';
import {
	createAsset,
	deleteAsset,
	getAssetFile,
	listAssets,
	patchAsset
} from './assets.js';
import { consumeSession, createSession, purgeExpiredSessions } from './sessions.js';

export default {
	/**
	 * @param {Request} request
	 * @param {Record<string, string | undefined> & { MEDIA: R2Bucket; DB: D1Database }} env
	 * @param {ExecutionContext} ctx
	 */
	async fetch(request, env, ctx) {
		const options = handleOptions(request, env);
		if (options) return options;

		const url = new URL(request.url);
		const urlBase = `${url.protocol}//${url.host}`;

		try {
			let response;

			if (url.pathname === '/api/assets' && request.method === 'GET') {
				const assets = await listAssets(env.DB, urlBase);
				response = Response.json({ assets });
			} else if (url.pathname === '/api/assets' && request.method === 'POST') {
				const denied = requireBoothKey(request, env);
				if (denied) response = denied;
				else response = await createAsset(request, env.MEDIA, env.DB, urlBase);
			} else {
				const assetFileMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/file$/);
				if (assetFileMatch && request.method === 'GET') {
					response = await getAssetFile(env.MEDIA, env.DB, assetFileMatch[1]);
				} else {
					const assetMatch = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
					if (assetMatch && request.method === 'PATCH') {
						const denied = requireBoothKey(request, env);
						if (denied) response = denied;
						else response = await patchAsset(request, env.MEDIA, env.DB, assetMatch[1], urlBase);
					} else if (assetMatch && request.method === 'DELETE') {
						const denied = requireBoothKey(request, env);
						if (denied) response = denied;
						else response = await deleteAsset(env.MEDIA, env.DB, assetMatch[1]);
					} else if (url.pathname === '/api/sessions' && request.method === 'POST') {
						const denied = requireBoothKey(request, env);
						if (denied) response = denied;
						else response = await createSession(request, env.MEDIA, env.DB);
					} else {
						const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
						if (sessionMatch && request.method === 'GET') {
							response = await consumeSession(env.MEDIA, env.DB, sessionMatch[1], env);
						} else if (url.pathname === '/api/health' && request.method === 'GET') {
							response = Response.json({ ok: true });
						} else {
							response = new Response('Not found', { status: 404 });
						}
					}
				}
			}

			return withCors(response, request, env);
		} catch (err) {
			console.error('[worker]', err);
			return withCors(new Response('Internal error', { status: 500 }), request, env);
		}
	},

	/**
	 * @param {ScheduledEvent} event
	 * @param {Record<string, string | undefined> & { MEDIA: R2Bucket; DB: D1Database }} env
	 * @param {ExecutionContext} ctx
	 */
	async scheduled(event, env, ctx) {
		ctx.waitUntil(purgeExpiredSessions(env.MEDIA, env.DB, env));
	}
};
