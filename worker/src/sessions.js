/**
 * One-time booth → phone session handoff (R2 image + D1 metadata).
 */

const MAX_SESSION_BYTES = 6 * 1024 * 1024;

/**
 * @param {Record<string, string | undefined>} env
 */
function sessionTtlMs(env) {
	const n = Number(env.SESSION_TTL_MS || 86400000);
	return Number.isFinite(n) && n > 0 ? n : 86400000;
}

/**
 * @param {Request} request
 * @param {import('@cloudflare/workers-types').R2Bucket} media
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
export async function createSession(request, media, db) {
	const parsed = await parseSessionCreate(request);
	if (parsed.error) return parsed.error;

	const { fileBytes, contentType, frameId } = parsed;
	if (!fileBytes?.byteLength) {
		return new Response('Image required', { status: 400 });
	}
	if (fileBytes.byteLength > MAX_SESSION_BYTES) {
		return new Response('Payload too large', { status: 413 });
	}

	const id = crypto.randomUUID();
	const r2Key = `sessions/${id}.png`;
	const now = Date.now();

	await media.put(r2Key, fileBytes, {
		httpMetadata: { contentType: contentType || 'image/png' }
	});

	await db
		.prepare(
			'INSERT INTO sessions (id, r2_key, frame_id, created_at, consumed) VALUES (?, ?, ?, ?, 0)'
		)
		.bind(id, r2Key, frameId || null, now)
		.run();

	return Response.json({ sessionId: id }, { status: 201 });
}

/**
 * @param {import('@cloudflare/workers-types').R2Bucket} media
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} id
 * @param {Record<string, string | undefined>} env
 */
export async function consumeSession(media, db, id, env) {
	const row = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first();
	if (!row) return new Response('Not found', { status: 404 });

	const createdAt = Number(row.created_at);
	if (!Number.isFinite(createdAt) || Date.now() - createdAt > sessionTtlMs(env)) {
		return new Response('Not found', { status: 404 });
	}

	if (row.consumed) {
		return new Response('Session already used', { status: 410 });
	}

	const updated = await db
		.prepare('UPDATE sessions SET consumed = 1 WHERE id = ? AND consumed = 0')
		.bind(id)
		.run();

	if (!updated.meta.changes) {
		return new Response('Session already used', { status: 410 });
	}

	const obj = await media.get(String(row.r2_key));
	if (!obj) return new Response('Not found', { status: 404 });

	const headers = new Headers();
	headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/png');
	if (row.frame_id) {
		headers.set('X-Frame-Id', String(row.frame_id));
	}
	headers.set('Cache-Control', 'no-store');

	return new Response(obj.body, { status: 200, headers });
}

/**
 * @param {import('@cloudflare/workers-types').R2Bucket} media
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {Record<string, string | undefined>} env
 */
export async function purgeExpiredSessions(media, db, env) {
	const cutoff = Date.now() - sessionTtlMs(env);
	const { results } = await db
		.prepare('SELECT id, r2_key FROM sessions WHERE created_at < ?')
		.bind(cutoff)
		.all();

	for (const row of results ?? []) {
		try {
			await media.delete(String(row.r2_key));
		} catch {
			/* best effort */
		}
	}

	await db.prepare('DELETE FROM sessions WHERE created_at < ?').bind(cutoff).run();
}

/**
 * @param {Request} request
 */
async function parseSessionCreate(request) {
	const contentType = request.headers.get('Content-Type') || '';

	if (contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || !file.size) {
			return { error: new Response('File required', { status: 400 }) };
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (bytes.byteLength > MAX_SESSION_BYTES) {
			return { error: new Response('Payload too large', { status: 413 }) };
		}
		return {
			fileBytes: bytes,
			contentType: file.type || 'image/png',
			frameId: form.get('frameId') != null ? String(form.get('frameId')) : null
		};
	}

	if (contentType.includes('application/json')) {
		/** @type {Record<string, unknown>} */
		let body;
		try {
			body = await request.json();
		} catch {
			return { error: new Response('Invalid JSON', { status: 400 }) };
		}
		if (!body.imageBase64) {
			return { error: new Response('imageBase64 required', { status: 400 }) };
		}
		try {
			const fileBytes = decodeBase64(String(body.imageBase64));
			if (fileBytes.byteLength > MAX_SESSION_BYTES) {
				return { error: new Response('Payload too large', { status: 413 }) };
			}
			return {
				fileBytes,
				contentType: typeof body.contentType === 'string' ? body.contentType : 'image/png',
				frameId: body.frameId != null ? String(body.frameId) : null
			};
		} catch {
			return { error: new Response('Invalid imageBase64', { status: 400 }) };
		}
	}

	if (contentType.startsWith('image/')) {
		const buf = new Uint8Array(await request.arrayBuffer());
		if (!buf.byteLength) {
			return { error: new Response('Empty body', { status: 400 }) };
		}
		if (buf.byteLength > MAX_SESSION_BYTES) {
			return { error: new Response('Payload too large', { status: 413 }) };
		}
		const frameId = new URL(request.url).searchParams.get('frameId');
		return {
			fileBytes: buf,
			contentType: contentType.split(';')[0],
			frameId
		};
	}

	return { error: new Response('Unsupported Content-Type', { status: 415 }) };
}

/**
 * @param {string} input
 */
function decodeBase64(input) {
	const cleaned = input.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
	const binary = atob(cleaned);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
