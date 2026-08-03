/**
 * Custom frame/sticker asset handlers (D1 metadata + R2 blobs).
 */

const MAX_ASSET_BYTES = 8 * 1024 * 1024;

/**
 * @param {string} urlBase
 * @param {string} id
 */
export function assetFileUrl(urlBase, id) {
	return `${urlBase.replace(/\/+$/, '')}/api/assets/${encodeURIComponent(id)}/file`;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} urlBase
 */
export async function listAssets(db, urlBase) {
	const { results } = await db
		.prepare('SELECT id, kind, name, motif, r2_key, w, h, slots_json FROM assets ORDER BY created_at ASC')
		.all();
	return (results ?? []).map((row) => serializeAssetRow(/** @type {Record<string, unknown>} */ (row), urlBase));
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} urlBase
 */
function serializeAssetRow(row, urlBase) {
	/** @type {{ id: string; x: number; y: number; w: number; h: number }[] | undefined} */
	let slots;
	if (row.slots_json) {
		try {
			slots = JSON.parse(String(row.slots_json));
		} catch {
			slots = undefined;
		}
	}
	return {
		id: String(row.id),
		kind: String(row.kind),
		name: String(row.name),
		motif: row.motif ? String(row.motif) : undefined,
		w: typeof row.w === 'number' ? row.w : undefined,
		h: typeof row.h === 'number' ? row.h : undefined,
		slots,
		src: assetFileUrl(urlBase, String(row.id)),
		custom: true
	};
}

/**
 * @param {import('@cloudflare/workers-types').R2Bucket} media
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} id
 */
export async function getAssetFile(media, db, id) {
	const row = await db.prepare('SELECT r2_key FROM assets WHERE id = ?').bind(id).first();
	if (!row) return new Response('Not found', { status: 404 });
	const obj = await media.get(String(row.r2_key));
	if (!obj) return new Response('Not found', { status: 404 });
	const headers = new Headers();
	if (obj.httpMetadata?.contentType) {
		headers.set('Content-Type', obj.httpMetadata.contentType);
	} else {
		headers.set('Content-Type', 'image/png');
	}
	headers.set('Cache-Control', 'public, max-age=3600');
	headers.set('Access-Control-Allow-Origin', '*');
	return new Response(obj.body, { headers });
}

/**
 * @param {Request} request
 * @param {import('@cloudflare/workers-types').R2Bucket} media
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} urlBase
 */
export async function createAsset(request, media, db, urlBase) {
	const parsed = await parseAssetPayload(request);
	if (parsed.error) return parsed.error;

	const { kind, name, motif, w, h, slots, fileBytes, contentType, id } = parsed;
	if (!kind || (kind !== 'frame' && kind !== 'sticker')) {
		return new Response('Invalid kind', { status: 400 });
	}
	if (!name?.trim()) {
		return new Response('Name required', { status: 400 });
	}
	if (!fileBytes?.byteLength) {
		return new Response('File required', { status: 400 });
	}
	if (fileBytes.byteLength > MAX_ASSET_BYTES) {
		return new Response('Payload too large', { status: 413 });
	}
	if (kind === 'frame' && (!slots || !Array.isArray(slots) || slots.length === 0)) {
		return new Response('Frames require at least one slot', { status: 400 });
	}

	const assetId = id || crypto.randomUUID();
	const prefix = kind === 'frame' ? 'frames' : 'stickers';
	const r2Key = `${prefix}/${assetId}.png`;
	const now = Date.now();

	await media.put(r2Key, fileBytes, {
		httpMetadata: { contentType: contentType || 'image/png' }
	});

	await db
		.prepare(
			`INSERT INTO assets (id, kind, name, motif, r2_key, w, h, slots_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			assetId,
			kind,
			name.trim(),
			motif?.trim() || null,
			r2Key,
			w ?? null,
			h ?? null,
			kind === 'frame' && slots ? JSON.stringify(slots) : null,
			now,
			now
		)
		.run();

	const row = await db
		.prepare('SELECT id, kind, name, motif, r2_key, w, h, slots_json FROM assets WHERE id = ?')
		.bind(assetId)
		.first();

	return Response.json(serializeAssetRow(/** @type {Record<string, unknown>} */ (row), urlBase), {
		status: 201
	});
}

/**
 * @param {Request} request
 * @param {import('@cloudflare/workers-types').R2Bucket} media
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} id
 * @param {string} urlBase
 */
export async function patchAsset(request, media, db, id, urlBase) {
	const existing = await db.prepare('SELECT * FROM assets WHERE id = ?').bind(id).first();
	if (!existing) return new Response('Not found', { status: 404 });

	const parsed = await parseAssetPayload(request, { optionalFile: true });
	if (parsed.error) return parsed.error;

	const now = Date.now();
	let r2Key = String(existing.r2_key);
	const kind = String(existing.kind);

	if (parsed.fileBytes?.byteLength) {
		if (parsed.fileBytes.byteLength > MAX_ASSET_BYTES) {
			return new Response('Payload too large', { status: 413 });
		}
		await media.put(r2Key, parsed.fileBytes, {
			httpMetadata: { contentType: parsed.contentType || 'image/png' }
		});
	}

	const name = parsed.name?.trim() || String(existing.name);
	const motif =
		parsed.motif !== undefined ? parsed.motif?.trim() || null : existing.motif ?? null;
	const w = parsed.w !== undefined ? parsed.w : existing.w;
	const h = parsed.h !== undefined ? parsed.h : existing.h;

	let slotsJson = existing.slots_json;
	if (parsed.slots !== undefined) {
		if (kind !== 'frame') {
			return new Response('Only frames have slots', { status: 400 });
		}
		if (!parsed.slots?.length) {
			return new Response('Frames require at least one slot', { status: 400 });
		}
		slotsJson = JSON.stringify(parsed.slots);
	}

	await db
		.prepare(
			`UPDATE assets SET name = ?, motif = ?, w = ?, h = ?, slots_json = ?, updated_at = ? WHERE id = ?`
		)
		.bind(name, motif, w ?? null, h ?? null, slotsJson ?? null, now, id)
		.run();

	const row = await db
		.prepare('SELECT id, kind, name, motif, r2_key, w, h, slots_json FROM assets WHERE id = ?')
		.bind(id)
		.first();

	return Response.json(serializeAssetRow(/** @type {Record<string, unknown>} */ (row), urlBase));
}

/**
 * @param {import('@cloudflare/workers-types').R2Bucket} media
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} id
 */
export async function deleteAsset(media, db, id) {
	const row = await db.prepare('SELECT r2_key FROM assets WHERE id = ?').bind(id).first();
	if (!row) return new Response('Not found', { status: 404 });
	await db.prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
	try {
		await media.delete(String(row.r2_key));
	} catch {
		/* best effort */
	}
	return new Response(null, { status: 204 });
}

/**
 * @param {Request} request
 * @param {{ optionalFile?: boolean }} [opts]
 */
async function parseAssetPayload(request, opts = {}) {
	const contentType = request.headers.get('Content-Type') || '';

	if (contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		const file = form.get('file');
		/** @type {Uint8Array | undefined} */
		let fileBytes;
		/** @type {string | undefined} */
		let fileContentType;
		if (file instanceof File && file.size > 0) {
			fileBytes = new Uint8Array(await file.arrayBuffer());
			fileContentType = file.type || 'image/png';
		} else if (!opts.optionalFile) {
			return { error: new Response('File required', { status: 400 }) };
		}

		const slotsRaw = form.get('slots');
		/** @type {unknown[] | undefined} */
		let slots;
		if (typeof slotsRaw === 'string' && slotsRaw) {
			try {
				slots = JSON.parse(slotsRaw);
			} catch {
				return { error: new Response('Invalid slots JSON', { status: 400 }) };
			}
		}

		const idField = form.get('id');
		return {
			kind: String(form.get('kind') || ''),
			name: String(form.get('name') || ''),
			motif: form.get('motif') != null ? String(form.get('motif')) : undefined,
			w: parseOptionalInt(form.get('w')),
			h: parseOptionalInt(form.get('h')),
			slots,
			fileBytes,
			contentType: fileContentType,
			id: typeof idField === 'string' && idField ? idField : undefined
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

		/** @type {Uint8Array | undefined} */
		let fileBytes;
		if (body.imageBase64) {
			try {
				fileBytes = decodeBase64(String(body.imageBase64));
			} catch {
				return { error: new Response('Invalid imageBase64', { status: 400 }) };
			}
		} else if (!opts.optionalFile) {
			return { error: new Response('imageBase64 required', { status: 400 }) };
		}

		return {
			kind: String(body.kind || ''),
			name: String(body.name || ''),
			motif: body.motif != null ? String(body.motif) : undefined,
			w: typeof body.w === 'number' ? body.w : parseOptionalInt(body.w),
			h: typeof body.h === 'number' ? body.h : parseOptionalInt(body.h),
			slots: Array.isArray(body.slots) ? body.slots : undefined,
			fileBytes,
			contentType: typeof body.contentType === 'string' ? body.contentType : 'image/png',
			id: typeof body.id === 'string' ? body.id : undefined
		};
	}

	return { error: new Response('Unsupported Content-Type', { status: 415 }) };
}

/**
 * @param {FormDataEntryValue | null} value
 */
function parseOptionalInt(value) {
	if (value == null || value === '') return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
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
