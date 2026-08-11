# Photobooth API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point OlympusSnap cloud mode at OpenHouse Photobooth (`/api/photobooth`), rewrite session handoff to capability `ses` tokens, wire Admin recent captures, and delete the Cloudflare Worker stack.

**Architecture:** Thin Photobooth transport in `assetApi.js` + `sessionClient.js` (PascalCase multipart, `Auth` from env, separate frames/stickers/captures routes). Offline keeps IndexedDB + in-memory stub with the same `ses` shape. Worker tree and Cloudflare docs are removed.

**Tech Stack:** Vite + Svelte 5 (SPA), native `fetch`, `node --test` for pure helpers, SFOpenHouseAPI Photobooth at `{VITE_API_BASE}/api/photobooth`.

## Global Constraints

- Production base example: `https://sfapi.smartfactory.forum` (paths under `/api/photobooth`).
- Admin writes + recent captures: header `Auth: {VITE_ADMIN_AUTH}` — never hardcode; never send from guest Studio.
- Capture QR: `?ses={base64url(id + "::" + key)}` via history router + Vite base (`toFullPath('/studio')`).
- Capture GET is reusable (no primary `CONSUMED` path in cloud mode).
- Empty `VITE_API_BASE` → IndexedDB customs + session stub.
- Form field names for Photobooth: `File`, `Name`, `Slots`, `Motif` (and sticker multi `Files`/`Names` only if used).
- Do not send `Slots` on sticker create/patch.
- Spec: `docs/superpowers/specs/2026-08-11-photobooth-api-integration-design.md`.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/session/sesCodec.js` | Encode/decode `ses` payload |
| `src/lib/session/sesCodec.test.js` | Node tests for codec |
| `src/lib/session/sessionClient.js` | Photobooth captures + QR URL helpers |
| `src/lib/session/sessionStub.js` | Offline capture store (`id`+`key`, reusable GET) |
| `src/lib/assets/assetApi.js` | Photobooth frames/stickers transport + admin Auth |
| `src/lib/assets/assetStore.js` | Kind-aware cloud CRUD; local→cloud without client ids |
| `src/views/04_Reveal.svelte` | Create capture; QR/`ses` same-device open |
| `src/views/05_Studio.svelte` | Parse `ses`; load capture; soft-deprecate CONSUMED |
| `src/views/07_Admin.svelte` | Recent captures panel; Photobooth copy |
| `.env.example` | `VITE_API_BASE`, `VITE_ADMIN_AUTH`, `VITE_PUBLIC_ORIGIN` |
| `vite.config.js` | Dev proxy → Photobooth (`6101`) |
| `package.json` | Drop worker scripts; optional `test` script |
| `docs/photobooth-backend.md` | Replace Cloudflare deploy guide |
| `docs/storage-model.md` | Point at Photobooth / drop Worker claims |
| `README.md` | Env + backend note |
| `worker/**` | **Delete** |
| `docs/cloudflare-backend.md`, `docs/cloudflare-session-draft.md` | **Delete** |

---

### Task 1: `ses` codec (pure helper + tests)

**Files:**
- Create: `src/lib/session/sesCodec.js`
- Create: `src/lib/session/sesCodec.test.js`
- Modify: `package.json` (add `"test": "node --test src/**/*.test.js"`)

**Interfaces:**
- Consumes: none
- Produces:
  - `encodeSes({ id: string, key: string }): string`
  - `decodeSes(ses: string): { id: string, key: string } | null`
  - Uses URL-safe base64 without padding (`base64url`).

- [ ] **Step 1: Write the failing test**

```js
// src/lib/session/sesCodec.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSes, decodeSes } from './sesCodec.js';

test('round-trips id and key', () => {
	const ses = encodeSes({ id: '550e8400-e29b-41d4-a716-446655440000', key: 'abcd'.repeat(8) });
	assert.equal(decodeSes(ses)?.id, '550e8400-e29b-41d4-a716-446655440000');
	assert.equal(decodeSes(ses)?.key.length, 32);
});

test('returns null for garbage', () => {
	assert.equal(decodeSes('%%%'), null);
	assert.equal(decodeSes(encodeSes({ id: 'a', key: 'b' }).slice(1)), null);
});

test('rejects missing separator', () => {
	const bad = Buffer.from('noidkey', 'utf8').toString('base64url');
	assert.equal(decodeSes(bad), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/session/sesCodec.test.js`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement codec**

```js
// src/lib/session/sesCodec.js
/** @param {string} raw */
function encodeBase64Url(raw) {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(raw, 'utf8').toString('base64url');
	}
	const bytes = new TextEncoder().encode(raw);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} s */
function decodeBase64Url(s) {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
	const bin = atob(b64);
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

/**
 * @param {{ id: string; key: string }} parts
 * @returns {string}
 */
export function encodeSes({ id, key }) {
	return encodeBase64Url(`${id}::${key}`);
}

/**
 * @param {string} ses
 * @returns {{ id: string; key: string } | null}
 */
export function decodeSes(ses) {
	if (!ses?.trim()) return null;
	try {
		const raw =
			typeof Buffer !== 'undefined'
				? Buffer.from(ses, 'base64url').toString('utf8')
				: decodeBase64Url(ses);
		const idx = raw.indexOf('::');
		if (idx <= 0) return null;
		const id = raw.slice(0, idx);
		const key = raw.slice(idx + 2);
		if (!id || !key) return null;
		return { id, key };
	} catch {
		return null;
	}
}
```

- [ ] **Step 4: Run tests**

Run: `node --test src/lib/session/sesCodec.test.js`  
Expected: PASS

- [ ] **Step 5: Add npm test script + commit**

```bash
# package.json scripts: "test": "node --test src/**/*.test.js"
git add package.json src/lib/session/sesCodec.js src/lib/session/sesCodec.test.js
git commit -m "feat(session): add base64url ses codec for capture QR"
```

---

### Task 2: Rewrite `assetApi.js` for Photobooth

**Files:**
- Modify: `src/lib/assets/assetApi.js` (full rewrite of cloud transport)
- Modify: `src/lib/assets/README.md` (if present — point at Photobooth)

**Interfaces:**
- Consumes: `import.meta.env.VITE_API_BASE`, `import.meta.env.VITE_ADMIN_AUTH`
- Produces (keep names used by `assetStore.js` where possible):
  - `getApiBase(): string`
  - `isCloudAssetsEnabled(): boolean`
  - `adminHeaders(extra?: Record<string,string>): Record<string,string>` — sets `Auth` when `VITE_ADMIN_AUTH` set
  - `listCustoms(): Promise<CloudAsset[]>` — merge frames + stickers
  - `createAsset(opts): Promise<CloudAsset>` — routes by `opts.kind`; **no client `id` field**
  - `patchAsset(id, patch, kind: 'frame'|'sticker'): Promise<CloudAsset>`
  - `deleteAsset(id, kind: 'frame'|'sticker'): Promise<void>`
  - `listRecentCaptures(): Promise<RecentCapture[]>`
  - Keep: `dataUrlToBlob`, `blobToDataUrl`, `fetchAsDataUrl`, `stripDataUrl`

```ts
// Types to include in JSDoc
type FrameSlot = { id: string; x: number; y: number; w: number; h: number };
type CloudAsset = {
  id: string;
  kind: 'frame' | 'sticker';
  name: string;
  motif?: string;
  src: string;
  w?: number;
  h?: number;
  slots?: FrameSlot[];
  custom?: boolean;
};
type RecentCapture = {
  id: string;
  frameId: string;
  createdAt: string;
  previewBase64: string | null;
};
```

- [ ] **Step 1: Replace auth helper**

Remove `boothHeaders` / `VITE_BOOTH_KEY`. Add:

```js
export function adminHeaders(extra = {}) {
	const headers = { ...extra };
	const auth = import.meta.env.VITE_ADMIN_AUTH;
	if (auth) headers['Auth'] = auth;
	return headers;
}

function photobooth(path) {
	return `${getApiBase()}/api/photobooth${path}`;
}
```

- [ ] **Step 2: Implement list / create / patch / delete**

```js
export async function listCustoms() {
	const [framesRes, stickersRes] = await Promise.all([
		fetch(photobooth('/frames')),
		fetch(photobooth('/stickers'))
	]);
	if (!framesRes.ok) throw new Error(await readError(framesRes));
	if (!stickersRes.ok) throw new Error(await readError(stickersRes));
	const frames = await framesRes.json();
	const stickers = await stickersRes.json();
	const a = Array.isArray(frames.assets) ? frames.assets : [];
	const b = Array.isArray(stickers.assets) ? stickers.assets : [];
	return [...a, ...b];
}

export async function createAsset(opts) {
	const blob = await dataUrlToBlob(opts.src);
	const form = new FormData();
	form.append('File', blob, `${opts.kind}.png`);
	form.append('Name', opts.name);
	if (opts.motif) form.append('Motif', opts.motif);
	if (opts.kind === 'frame') {
		if (!opts.slots?.length) throw new Error('Frames require slots');
		form.append('Slots', JSON.stringify(opts.slots));
		const res = await fetch(photobooth('/frames'), { method: 'POST', headers: adminHeaders(), body: form });
		if (!res.ok) throw new Error(await readError(res));
		return res.json();
	}
	const res = await fetch(photobooth('/stickers'), { method: 'POST', headers: adminHeaders(), body: form });
	if (!res.ok) throw new Error(await readError(res));
	return res.json();
}

export async function patchAsset(id, patch, kind) {
	const form = new FormData();
	if (patch.src) {
		const blob = await dataUrlToBlob(patch.src);
		form.append('File', blob, 'asset.png');
	}
	if (patch.name != null) form.append('Name', patch.name);
	if (patch.motif != null) form.append('Motif', patch.motif);
	if (kind === 'frame' && patch.slots) form.append('Slots', JSON.stringify(patch.slots));
	const path = kind === 'frame' ? `/frames/${encodeURIComponent(id)}` : `/stickers/${encodeURIComponent(id)}`;
	const res = await fetch(photobooth(path), { method: 'PATCH', headers: adminHeaders(), body: form });
	if (!res.ok) throw new Error(await readError(res));
	return res.json();
}

export async function deleteAsset(id, kind) {
	const path = kind === 'frame' ? `/frames/${encodeURIComponent(id)}` : `/stickers/${encodeURIComponent(id)}`;
	const res = await fetch(photobooth(path), { method: 'DELETE', headers: adminHeaders() });
	if (!res.ok && res.status !== 204) throw new Error(await readError(res));
}

export async function listRecentCaptures() {
	const res = await fetch(photobooth('/admin/captures/recent'), { headers: adminHeaders() });
	if (!res.ok) throw new Error(await readError(res));
	const data = await res.json();
	return Array.isArray(data.items) ? data.items : [];
}
```

For JSON error bodies `{ code, message }`, prefer showing `message` in `readError`.

- [ ] **Step 3: Smoke-check module loads in Vite**

Run: `npm run build`  
Expected: build succeeds (or only unrelated warnings). Fix import/syntax errors if any.

- [ ] **Step 4: Commit**

```bash
git add src/lib/assets/assetApi.js src/lib/assets/README.md
git commit -m "feat(assets): point cloud CRUD at Photobooth API"
```

---

### Task 3: Update `assetStore.js` for kind-aware API

**Files:**
- Modify: `src/lib/assets/assetStore.js`

**Interfaces:**
- Consumes: Task 2 `createAsset`, `patchAsset(id, patch, kind)`, `deleteAsset(id, kind)`, `listCustoms`
- Produces: same exported store functions (`addFrame`, `addStickers`, `updateAsset`, `removeCustomAsset`, `uploadLocalCustomsToCloud`)

- [ ] **Step 1: Pass kind into patch/delete**

In `updateAsset` cloud branch:

```js
const kind = get(stickers).some((s) => s.id === id) ? 'sticker' : 'frame';
await apiPatchAsset(id, apiPatch, kind);
```

In `removeCustomAsset`:

```js
const kind = get(stickers).some((s) => s.id === id) ? 'sticker' : 'frame';
await apiDeleteAsset(id, kind);
```

Ensure frame/sticker store objects expose enough to distinguish (stickers list vs frames list).

- [ ] **Step 2: Fix local→cloud upload**

Photobooth assigns ids — stop sending `id` in `apiCreateAsset`. Update `uploadLocalCustomsToCloud` to create without `id`. Matching “already present” by id will rarely hit; acceptable: upload all locals as new remote assets, or skip by exact `name`+`kind` if already in `listCustoms()`. Prefer skip when `cloud.some(c => c.kind === row.kind && c.name === row.name)`.

Remove any `id: row.id` from create payload.

- [ ] **Step 3: Update file header comment**

Change “Cloudflare or IndexedDB” → “Photobooth API or IndexedDB”.

- [ ] **Step 4: Commit**

```bash
git add src/lib/assets/assetStore.js
git commit -m "fix(assets): pass kind to Photobooth patch/delete"
```

---

### Task 4: Rewrite session stub for `id` + `key` (reusable)

**Files:**
- Modify: `src/lib/session/sessionStub.js`

**Interfaces:**
- Consumes: none
- Produces:
  - `stubCreateSession({ imageDataUrl, frameId }): Promise<{ id: string, key: string, frameId: string | null }>`
  - `stubLoadCapture(id, key): Promise<{ imageDataUrl: string, frameId: string | null }>` — reusable; wrong key → `FORBIDDEN`; missing → `NOT_FOUND`

- [ ] **Step 1: Rewrite stub storage**

```js
/** @typedef {{ imageDataUrl: string; frameId: string | null; key: string; createdAt: number }} StubCapture */

/** @type {Map<string, StubCapture>} */
const memory = new Map();

function randomKey() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function stubCreateSession({ imageDataUrl, frameId }) {
	if (!imageDataUrl) {
		const err = new Error('Missing image');
		err.code = 'NOT_FOUND';
		throw err;
	}
	const id = crypto.randomUUID();
	const key = randomKey();
	memory.set(id, { imageDataUrl, frameId, key, createdAt: Date.now() });
	return { id, key, frameId };
}

export async function stubLoadCapture(id, key) {
	const record = memory.get(id);
	if (!record) {
		const err = new Error('Session not found');
		err.code = 'NOT_FOUND';
		throw err;
	}
	if (record.key !== key) {
		const err = new Error('Forbidden');
		err.code = 'FORBIDDEN';
		throw err;
	}
	return { imageDataUrl: record.imageDataUrl, frameId: record.frameId };
}
```

Remove one-time consume / `CONSUMED` / localStorage consumed index (or keep index only as optional debug — default: delete consumed logic).

- [ ] **Step 2: Manual same-tab check later** (covered in Task 5–6). Commit stub alone:

```bash
git add src/lib/session/sessionStub.js
git commit -m "refactor(session): offline stub uses reusable id+key"
```

---

### Task 5: Rewrite `sessionClient.js`

**Files:**
- Modify: `src/lib/session/sessionClient.js`

**Interfaces:**
- Consumes: `sesCodec`, `sessionStub`, `assetApi` (`getApiBase`, `stripDataUrl`, `blobToDataUrl`)
- Produces:
  - `createSession({ imageDataUrl, frameId }): Promise<{ id: string, key: string, frameId: string | null }>`
  - `loadCapture(id, key): Promise<{ imageDataUrl: string, frameId: string | null }>`
  - `getSessionFromUrl(): { id: string, key: string } | null` — reads `ses`
  - `buildStudioSessionUrl({ id, key }): string`

- [ ] **Step 1: Implement cloud create/load**

```js
import { encodeSes, decodeSes } from './sesCodec.js';
import { stubCreateSession, stubLoadCapture } from './sessionStub.js';
import { blobToDataUrl, getApiBase, stripDataUrl } from '../assets/assetApi.js';
import { toFullPath } from '../../router/index.js';

function useCloud() {
	return !!getApiBase();
}

export async function createSession(payload) {
	if (!useCloud()) return stubCreateSession(payload);

	const res = await fetch(`${getApiBase()}/api/photobooth/captures`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			imageBase64: stripDataUrl(payload.imageDataUrl),
			frameId: payload.frameId,
			contentType: 'image/png'
		})
	});
	if (!res.ok) {
		const err = new Error('Capture create failed');
		err.code = 'NETWORK';
		throw err;
	}
	const data = await res.json();
	return { id: data.id, key: data.key, frameId: data.frameId ?? payload.frameId ?? null };
}

export async function loadCapture(id, key) {
	if (!id?.trim() || !key?.trim()) {
		const err = new Error('Missing session');
		err.code = 'NOT_FOUND';
		throw err;
	}
	if (!useCloud()) return stubLoadCapture(id.trim(), key.trim());

	const url = `${getApiBase()}/api/photobooth/captures/${encodeURIComponent(id.trim())}?key=${encodeURIComponent(key.trim())}`;
	const res = await fetch(url);
	if (res.status === 401 || res.status === 403) {
		const err = new Error('Forbidden');
		err.code = 'FORBIDDEN';
		throw err;
	}
	if (!res.ok) {
		const err = new Error('Session not found');
		err.code = 'NOT_FOUND';
		throw err;
	}
	const frameId = res.headers.get('X-Frame-Id');
	const imageDataUrl = await blobToDataUrl(await res.blob());
	return { imageDataUrl, frameId: frameId || null };
}

export function getSessionFromUrl() {
	if (typeof location === 'undefined') return null;
	const ses = new URLSearchParams(location.search).get('ses');
	return decodeSes(ses || '');
}

export function buildStudioSessionUrl({ id, key }) {
	const origin =
		(import.meta.env.VITE_PUBLIC_ORIGIN || '').replace(/\/+$/, '') ||
		(typeof location !== 'undefined' ? location.origin : '');
	const path = `${toFullPath('/studio')}?ses=${encodeURIComponent(encodeSes({ id, key }))}`;
	return `${origin}${path}`;
}
```

Remove exports `consumeSession`, `getSessionIdFromUrl` (update call sites in Task 6). Do **not** send `Auth` on capture routes.

- [ ] **Step 2: Commit**

```bash
git add src/lib/session/sessionClient.js
git commit -m "feat(session): Photobooth captures + ses QR helpers"
```

---

### Task 6: Wire Reveal + Studio to `ses`

**Files:**
- Modify: `src/views/04_Reveal.svelte`
- Modify: `src/views/05_Studio.svelte`

**Interfaces:**
- Consumes: Task 5 `createSession`, `buildStudioSessionUrl`, `getSessionFromUrl`, `loadCapture`

- [ ] **Step 1: Update Reveal**

Replace session create / QR / same-device open:

```js
const created = await createSession({
	imageDataUrl: unstickered,
	frameId: get(selectedFrameId)
});
if (!cancelled) {
	sessionId = created.id; // or store { id, key }
	sessionKey = created.key;
	await renderQr(buildStudioSessionUrl({ id: created.id, key: created.key }));
}

function openStudioFromQr() {
	if (!sessionId || !sessionKey) return;
	go('studio', `?ses=${encodeURIComponent(encodeSes({ id: sessionId, key: sessionKey }))}`);
}
```

Import `encodeSes` from `sesCodec.js` (or build search via `buildStudioSessionUrl` then `go` with its search portion — simplest: keep `id`/`key` state and use `encodeSes`).

- [ ] **Step 2: Update Studio**

```js
import { getSessionFromUrl, loadCapture } from '../lib/session/sessionClient.js';

const parts = getSessionFromUrl();
if (parts) {
	mobileSession = true;
	// ...
	try {
		const payload = await loadCapture(parts.id, parts.key);
		// set stores as before
	} catch (err) {
		const existing = get(capturedImageData);
		if (existing && err?.code !== 'FORBIDDEN') {
			// same-device fallback
			...
			return;
		}
		sessionError = 'not_found';
	}
}
```

Simplify error UI: map all failures to “LINK NOT FOUND” (or keep a distinct FORBIDDEN copy). Remove primary “LINK ALREADY USED” / `consumed` path, or leave dead branch unused.

- [ ] **Step 3: Offline smoke**

Run: `npm run dev` with empty `VITE_API_BASE`  
Flow: camera → reveal → click QR → studio loads image.  
Expected: works same-tab via stub.

- [ ] **Step 4: Commit**

```bash
git add src/views/04_Reveal.svelte src/views/05_Studio.svelte
git commit -m "feat(booth): QR handoff uses Photobooth ses tokens"
```

---

### Task 7: Admin recent captures + copy

**Files:**
- Modify: `src/views/07_Admin.svelte`

**Interfaces:**
- Consumes: `listRecentCaptures`, `isCloudAssetsEnabled` from asset layer
- Produces: UI panel “RECENT CAPTURES”

- [ ] **Step 1: Add panel state + load**

```js
import { listRecentCaptures } from '../lib/assets/assetApi.js';

let recent = $state(/** @type {import('../lib/assets/assetApi.js').RecentCapture[] | null} */ ([]));
let recentError = $state('');

async function refreshRecent() {
	if (!isCloudAssetsEnabled()) return;
	try {
		recent = await listRecentCaptures();
		recentError = '';
	} catch (e) {
		recentError = e?.message || 'Failed to load recent captures';
		recent = [];
	}
}

onMount(() => {
	// existing pin/setup...
	refreshRecent();
});
```

Export `RecentCapture` typedef from `assetApi.js` if needed, or inline JSDoc.

- [ ] **Step 2: Markup (cloud only)**

Place near footer / after customs list:

```svelte
{#if cloudEnabled}
	<div class="recent-panel">
		<p class="panel-kicker">RECENT CAPTURES</p>
		{#if recentError}
			<p class="hint">{recentError}</p>
		{:else if !recent?.length}
			<p class="hint">No recent captures (or API restarted).</p>
		{:else}
			<ul class="recent-grid">
				{#each recent as item}
					<li>
						{#if item.previewBase64}
							<img
								src={`data:image/png;base64,${item.previewBase64}`}
								alt=""
							/>
						{/if}
						<span>{item.frameId}</span>
						<span>{item.createdAt}</span>
					</li>
				{/each}
			</ul>
		{/if}
		<PixelButton label="REFRESH" variant="ghost" onclick={refreshRecent} />
	</div>
{/if}
```

Style with existing Admin pixel panel classes (grid of thumbs, no new design system). Match current Admin chrome.

- [ ] **Step 3: Replace Cloudflare copy**

Change hint from `Cloudflare R2 + D1 when VITE_API_BASE is set` → `OpenHouse Photobooth API when VITE_API_BASE is set`.

- [ ] **Step 4: Commit**

```bash
git add src/views/07_Admin.svelte
git commit -m "feat(admin): show Photobooth recent capture previews"
```

---

### Task 8: Env, Vite proxy, docs, delete Worker

**Files:**
- Modify: `.env.example`
- Modify: `vite.config.js`
- Modify: `package.json` (remove `worker:*` scripts)
- Modify: `README.md`
- Modify: `docs/storage-model.md` (session = reusable capability; backend = Photobooth)
- Create: `docs/photobooth-backend.md`
- Delete: `worker/` (entire tree)
- Delete: `docs/cloudflare-backend.md`, `docs/cloudflare-session-draft.md`

- [ ] **Step 1: Update `.env.example`**

```env
# Photobooth API (SFOpenHouseAPI). Leave empty for offline IndexedDB + session stub.
VITE_API_BASE=https://sfapi.smartfactory.forum

# Admin Auth header value for frame/sticker writes + recent captures
VITE_ADMIN_AUTH=

# Public origin guest phones use for QR links (NOT localhost in production)
VITE_PUBLIC_ORIGIN=

# Local Backend example:
# VITE_API_BASE=http://localhost:6101
# VITE_ADMIN_AUTH=SFOpenAdmin@1!#
# VITE_PUBLIC_ORIGIN=http://localhost:5173
```

Do not commit real secrets into tracked files beyond the partner-doc example in comments if already public in partner reference.

- [ ] **Step 2: Point Vite proxy at local Photobooth**

```js
// vite.config.js server.proxy
'/api': {
	target: 'http://localhost:6101',
	changeOrigin: true
}
```

- [ ] **Step 3: Write `docs/photobooth-backend.md`**

Short guide: set three env vars, production vs `localhost:6101`, QR `ses` convention, offline mode, pointer to partner reference / design spec. No Worker deploy steps.

- [ ] **Step 4: Delete Worker + Cloudflare docs; strip scripts**

```bash
# PowerShell from repo root
Remove-Item -Recurse -Force worker
Remove-Item -Force docs/cloudflare-backend.md, docs/cloudflare-session-draft.md
```

Edit `package.json` to remove `worker:dev`, `worker:deploy`, `worker:db:local`, `worker:db:remote`.

- [ ] **Step 5: Update README + storage-model**

README: note Photobooth backend + env.  
`storage-model.md`: replace “Cloudflare D1 + R2 test stack” / one-time session language with Photobooth + reusable `id`+`key`.

- [ ] **Step 6: Commit**

```bash
git add -A
git status   # confirm worker/ and cloudflare docs deleted; no secrets
git commit -m "chore: remove Cloudflare Worker; document Photobooth backend"
```

---

### Task 9: End-to-end verification

**Files:** none (manual)

- [ ] **Step 1: Offline path**

`VITE_API_BASE=` empty → `npm run dev` → full booth → Reveal QR → Studio.  
Expected: image loads; re-open same `ses` still works (stub reusable).

- [ ] **Step 2: Cloud path (local or prod)**

Set:

```env
VITE_API_BASE=http://localhost:6101
VITE_ADMIN_AUTH=<valid Auth>
VITE_PUBLIC_ORIGIN=http://localhost:5173
```

Restart Vite. Admin: upload frame with slots + sticker; list refreshes. Reveal: POST capture; QR contains `ses=`. Phone or second browser: open QR URL; Studio loads PNG; `X-Frame-Id` selects frame. Re-open QR: still works. Admin recent: shows preview after capture. Wrong Auth: Admin write fails with clear message; public GETs still work.

- [ ] **Step 3: Regression build**

Run: `npm test`  
Expected: PASS  
Run: `npm run build`  
Expected: PASS

- [ ] **Step 4: Final commit if verification fixes needed**

```bash
git add -A
git commit -m "fix: Photobooth integration verification follow-ups"
```

(Skip empty commit if nothing changed.)

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Photobooth-only cloud backend | 2, 5, 8 |
| `VITE_ADMIN_AUTH` → `Auth` | 2, 8 |
| Offline IDB + stub | 3, 4, 6, 9 |
| Frames/stickers separate endpoints + PascalCase form | 2 |
| Captures POST/GET + `ses` QR | 1, 5, 6 |
| Reusable GET (no CONSUMED primary) | 4, 5, 6 |
| Admin recent captures UI | 7 |
| Delete `worker/` + Cloudflare docs | 8 |
| Env / README / proxy | 8 |
| Verification | 9 |
