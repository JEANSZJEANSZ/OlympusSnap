/**
 * Olympus Snap API — frames, stickers, captures. No image transcode (10 ms Free CPU).
 */

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Auth',
	'Access-Control-Expose-Headers': 'X-Frame-Id'
};

export default {
	async fetch(request, env) {
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: CORS });
		}

		const url = new URL(request.url);
		if (!url.pathname.startsWith('/api/')) {
			return env.ASSETS.fetch(request);
		}

		try {
			return await handleApi(request, env, url);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Server error';
			const status = err.status || 500;
			return json({ message }, status);
		}
	},

	async scheduled(_controller, env) {
		await env.DB.prepare('DELETE FROM captures').run();
	}
};

/**
 * @param {Request} request
 * @param {Env} env
 * @param {URL} url
 */
async function handleApi(request, env, url) {
	const path = url.pathname.replace(/^\/api/, '') || '/';
	const method = request.method;

	if (method === 'GET' && path === '/health') {
		return json({ ok: true });
	}

	if (method === 'GET' && path === '/admin/verify') {
		requireAdmin(request, env);
		return json({ ok: true });
	}

	if (method === 'GET' && path === '/frames') {
		return json({ assets: await listAssets(env, 'frame') });
	}
	if (method === 'GET' && path === '/stickers') {
		return json({ assets: await listAssets(env, 'sticker') });
	}

	const fileMatch = path.match(/^\/files\/(frames|stickers)\/([^/]+)$/);
	if (method === 'GET' && fileMatch) {
		const kind = fileMatch[1] === 'frames' ? 'frame' : 'sticker';
		return serveAssetFile(env, kind, fileMatch[2]);
	}

	if (method === 'POST' && path === '/frames') {
		requireAdmin(request, env);
		return createAsset(request, env, 'frame');
	}
	if (method === 'POST' && path === '/stickers') {
		requireAdmin(request, env);
		return createAsset(request, env, 'sticker');
	}

	const assetMatch = path.match(/^\/(frames|stickers)\/([^/]+)$/);
	if (assetMatch) {
		const kind = assetMatch[1] === 'frames' ? 'frame' : 'sticker';
		const id = assetMatch[2];
		if (method === 'PATCH') {
			requireAdmin(request, env);
			return patchAsset(request, env, kind, id);
		}
		if (method === 'DELETE') {
			requireAdmin(request, env);
			return deleteAsset(env, kind, id);
		}
	}

	if (method === 'POST' && path === '/captures') {
		return createCapture(request, env);
	}

	const capMatch = path.match(/^\/captures\/([^/]+)$/);
	if (method === 'GET' && capMatch) {
		return loadCapture(env, capMatch[1], url.searchParams.get('key') || '');
	}

	return json({ message: 'Not found' }, 404);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
function requireAdmin(request, env) {
	const expected = String(env.ADMIN_PIN || '').trim();
	const got = (request.headers.get('Auth') || '').trim();
	if (!expected) {
		const err = new Error('Admin PIN is not configured on the Worker');
		err.status = 503;
		throw err;
	}
	if (got !== expected) {
		const err = new Error('Admin Auth missing/invalid');
		err.status = 401;
		throw err;
	}
}

/**
 * @param {Env} env
 * @param {'frame' | 'sticker'} kind
 */
async function listAssets(env, kind) {
	const { results } = await env.DB.prepare(
		'SELECT id, kind, name, motif, width, height, slots FROM assets WHERE kind = ? ORDER BY created_at'
	)
		.bind(kind)
		.all();

	return (results || []).map((row) => toAssetJson(row));
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {'frame' | 'sticker'} kind
 */
async function createAsset(request, env, kind) {
	const form = await request.formData();
	const file = form.get('File');
	if (!(file instanceof File) || !file.size) {
		const err = new Error('File required');
		err.status = 400;
		throw err;
	}

	const name = String(form.get('Name') || '').trim() || (kind === 'frame' ? 'CUSTOM FRAME' : 'CUSTOM STICKER');
	const motif = String(form.get('Motif') || '').trim() || null;
	const w = Number(form.get('Width') || form.get('W')) || null;
	const h = Number(form.get('Height') || form.get('H')) || null;
	let slots = null;
	if (kind === 'frame') {
		slots = parseSlots(form.get('Slots'));
		if (!slots?.length) {
			const err = new Error('Frames require slots');
			err.status = 400;
			throw err;
		}
	}

	const id = crypto.randomUUID();
	const contentType = file.type || 'image/png';
	await env.BUCKET.put(objectKey(kind, id), await file.arrayBuffer(), {
		httpMetadata: { contentType }
	});
	await env.DB.prepare(
		'INSERT INTO assets (id, kind, name, motif, content_type, width, height, slots) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
	)
		.bind(id, kind, name, motif, contentType, w, h, slots ? JSON.stringify(slots) : null)
		.run();

	return json(toAssetJson({ id, kind, name, motif, width: w, height: h, slots: slots ? JSON.stringify(slots) : null }), 201);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {'frame' | 'sticker'} kind
 * @param {string} id
 */
async function patchAsset(request, env, kind, id) {
	const existing = await env.DB.prepare('SELECT * FROM assets WHERE id = ? AND kind = ?')
		.bind(id, kind)
		.first();
	if (!existing) {
		const err = new Error('Not found');
		err.status = 404;
		throw err;
	}

	const form = await request.formData();
	let name = existing.name;
	let motif = existing.motif;
	let width = existing.width;
	let height = existing.height;
	let slots = existing.slots;
	let contentType = existing.content_type;

	if (form.has('Name')) name = String(form.get('Name') || '').trim() || name;
	if (form.has('Motif')) motif = String(form.get('Motif') || '').trim() || null;
	if (form.has('Width') || form.has('W')) width = Number(form.get('Width') || form.get('W')) || width;
	if (form.has('Height') || form.has('H')) height = Number(form.get('Height') || form.get('H')) || height;
	if (kind === 'frame' && form.has('Slots')) {
		const parsed = parseSlots(form.get('Slots'));
		if (!parsed?.length) {
			const err = new Error('Frames require slots');
			err.status = 400;
			throw err;
		}
		slots = JSON.stringify(parsed);
	}

	const file = form.get('File');
	if (file instanceof File && file.size) {
		contentType = file.type || contentType;
		await env.BUCKET.put(objectKey(kind, id), await file.arrayBuffer(), {
			httpMetadata: { contentType }
		});
	}

	await env.DB.prepare(
		'UPDATE assets SET name = ?, motif = ?, content_type = ?, width = ?, height = ?, slots = ? WHERE id = ?'
	)
		.bind(name, motif, contentType, width, height, slots, id)
		.run();

	return json(toAssetJson({ id, kind, name, motif, width, height, slots }));
}

/**
 * @param {Env} env
 * @param {'frame' | 'sticker'} kind
 * @param {string} id
 */
async function deleteAsset(env, kind, id) {
	const existing = await env.DB.prepare('SELECT id FROM assets WHERE id = ? AND kind = ?')
		.bind(id, kind)
		.first();
	if (!existing) {
		const err = new Error('Not found');
		err.status = 404;
		throw err;
	}
	await env.BUCKET.delete(objectKey(kind, id));
	await env.DB.prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
	return new Response(null, { status: 204, headers: CORS });
}

/**
 * @param {Env} env
 * @param {'frame' | 'sticker'} kind
 * @param {string} id
 */
async function serveAssetFile(env, kind, id) {
	const obj = await env.BUCKET.get(objectKey(kind, id));
	if (!obj) return json({ message: 'Not found' }, 404);
	const headers = new Headers(CORS);
	headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/png');
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	return new Response(obj.body, { headers });
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function createCapture(request, env) {
	const body = await request.json();
	const raw = String(body.imageBase64 || '');
	const frameId = body.frameId ? String(body.frameId) : null;
	const contentType = body.contentType === 'image/png' ? 'image/png' : 'image/jpeg';
	if (!raw) {
		const err = new Error('imageBase64 required');
		err.status = 400;
		throw err;
	}

	const bytes = base64ToBytes(raw);
	const id = crypto.randomUUID();
	const key = randomKey();
	const keyHash = await sha256Hex(key);

	await env.BUCKET.put(`captures/${id}`, bytes, {
		httpMetadata: { contentType }
	});
	await env.DB.prepare('INSERT INTO captures (id, key_hash, frame_id, content_type) VALUES (?, ?, ?, ?)')
		.bind(id, keyHash, frameId, contentType)
		.run();

	return json({ id, key, frameId }, 201);
}

/**
 * @param {Env} env
 * @param {string} id
 * @param {string} key
 */
async function loadCapture(env, id, key) {
	if (!id || !key) return json({ message: 'Missing session' }, 404);
	const row = await env.DB.prepare('SELECT id, key_hash, frame_id, content_type FROM captures WHERE id = ?')
		.bind(id)
		.first();
	if (!row) return json({ message: 'Session not found' }, 404);

	const incoming = await sha256Hex(key);
	if (incoming !== row.key_hash) return json({ message: 'Forbidden' }, 403);

	const obj = await env.BUCKET.get(`captures/${id}`);
	if (!obj) return json({ message: 'Session not found' }, 404);

	const headers = new Headers(CORS);
	headers.set('Content-Type', row.content_type || obj.httpMetadata?.contentType || 'image/jpeg');
	if (row.frame_id) headers.set('X-Frame-Id', row.frame_id);
	return new Response(obj.body, { headers });
}

/** @param {'frame' | 'sticker'} kind @param {string} id */
function objectKey(kind, id) {
	return kind === 'frame' ? `frames/${id}` : `stickers/${id}`;
}

/** @param {Record<string, unknown>} row */
function toAssetJson(row) {
	let slots;
	if (typeof row.slots === 'string' && row.slots) {
		try {
			slots = JSON.parse(row.slots);
		} catch {
			slots = undefined;
		}
	}
	const kind = row.kind === 'sticker' ? 'sticker' : 'frame';
	const folder = kind === 'frame' ? 'frames' : 'stickers';
	return {
		id: row.id,
		kind,
		name: row.name,
		motif: row.motif || undefined,
		src: `/api/files/${folder}/${row.id}`,
		w: row.width ?? undefined,
		h: row.height ?? undefined,
		slots,
		custom: true
	};
}

/** @param {unknown} raw */
function parseSlots(raw) {
	if (raw == null || raw === '') return null;
	let parsed = raw;
	if (typeof raw === 'string') {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!Array.isArray(parsed)) return null;
	const out = [];
	for (const item of parsed) {
		if (!item || typeof item !== 'object') continue;
		const x = Number(item.x);
		const y = Number(item.y);
		const w = Number(item.w);
		const h = Number(item.h);
		if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
		if (w < 0.01 || h < 0.01) continue;
		out.push({
			id: typeof item.id === 'string' ? item.id : `slot-${out.length + 1}`,
			x: Math.min(1, Math.max(0, x)),
			y: Math.min(1, Math.max(0, y)),
			w: Math.min(1, Math.max(0.01, w)),
			h: Math.min(1, Math.max(0.01, h))
		});
	}
	return out.length ? out : null;
}

/** @param {string} data */
function base64ToBytes(data) {
	const b64 = data.replace(/^data:[^;]+;base64,/, '');
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

function randomKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} text */
async function sha256Hex(text) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {unknown} body @param {number} status */
function json(body, status = 200) {
	return Response.json(body, { status, headers: CORS });
}

/**
 * @typedef {{
 *   DB: D1Database;
 *   BUCKET: R2Bucket;
 *   ASSETS: Fetcher;
 *   ADMIN_PIN: string;
 * }} Env
 */
