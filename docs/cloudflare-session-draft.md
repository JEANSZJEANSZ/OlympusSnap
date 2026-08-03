# Cloudflare Session API — Draft Design

One-time image handoff from booth PC → guest phone for mobile Studio (`/studio?s={sessionId}`).

**Status:** Design only — production deploy not wired yet. The frontend uses `src/lib/session/sessionStub.js` (localStorage, same-origin dev) until this API replaces it.

---

## Stack (free-tier friendly)

| Component | Role |
|-----------|------|
| **Cloudflare Worker** | HTTP API, one-time token logic, CORS |
| **R2 bucket** | Store composite PNG/JPEG (too large for KV) |
| **D1** (or KV) | Session metadata: `{ id, r2Key, frameId, createdAt, consumed }` |

---

## API contract

### `POST /api/sessions` (booth only)

Creates a session after Reveal composites the unstickered capture.

**Headers (optional):**

```
X-Booth-Key: <shared secret>
Content-Type: application/json
```

**Body:**

```json
{
  "imageBase64": "<base64 without data: prefix or with>",
  "frameId": "zeus-strip",
  "contentType": "image/png"
}
```

**Response `201`:**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:** `401` (bad booth key), `413` (payload too large), `500`.

---

### `GET /api/sessions/:id` (guest phone, one-time)

**Response `200` (first open):**

```json
{
  "imageUrl": "https://…signed-r2-url…",
  "frameId": "zeus-strip"
}
```

Marks `consumed: true` atomically before returning.

**Response `410`:** Session already consumed.

**Response `404`:** Unknown or expired session.

**Response `410` vs `404`:** Use `410` when the row exists but `consumed = 1`; `404` when missing or past TTL.

---

## One-time guarantee

1. **Unguessable ID** — cryptographically random UUID v4.
2. **Atomic consume** — D1 `UPDATE sessions SET consumed = 1 WHERE id = ? AND consumed = 0`; if `changes === 0`, return `410`.
3. **Short-lived signed R2 URL** — ~5 minutes, enough for one page load.
4. **Booth auth on POST only** — `X-Booth-Key` header; GET is public given the UUID.

---

## TTL

- Sessions expire after **24 hours** (configurable).
- R2 lifecycle rule deletes objects under `sessions/` prefix after 24h.
- Worker **scheduled trigger** (cron) purges expired D1 rows nightly.

---

## CORS

Allow `GET` from Studio origin only (your public booth domain + dev localhost).

```js
const ALLOWED = ['https://your-domain.com', 'http://localhost:5173'];

function cors(origin) {
  if (ALLOWED.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
  }
  return {};
}
```

POST from booth can use same origin or a dedicated booth subdomain with stricter rate limits.

---

## QR URL on booth

After `POST /api/sessions` succeeds, Reveal renders QR to:

```
https://{your-domain}{APP_BASE}/studio?s={sessionId}
```

Example production path:

```
https://events.example.com/Debug/TestDeploy3/studio?s=550e8400-e29b-41d4-a716-446655440000
```

Set `VITE_PUBLIC_ORIGIN=https://events.example.com` at build time. The booth must use a **LAN-reachable hostname or public URL**, not `localhost`, so guest phones on event Wi‑Fi can open the link.

---

## Frontend integration

Swap `sessionStub.js` for HTTP in `sessionClient.js`:

```js
export async function createSession({ imageDataUrl, frameId }) {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Booth-Key': import.meta.env.VITE_BOOTH_KEY
    },
    body: JSON.stringify({
      imageBase64: stripDataUrl(imageDataUrl),
      frameId,
      contentType: 'image/png'
    })
  });
  if (!res.ok) throw new Error('Session create failed');
  return res.json(); // { sessionId }
}

export async function consumeSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (res.status === 410) {
    const err = new Error('Session already used');
    err.code = 'CONSUMED';
    throw err;
  }
  if (!res.ok) {
    const err = new Error('Session not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const { imageUrl, frameId } = await res.json();
  // Fetch blob or use imageUrl directly as compositeUrl
  const imgRes = await fetch(imageUrl);
  const blob = await imgRes.blob();
  const imageDataUrl = await blobToDataUrl(blob);
  return { imageDataUrl, frameId };
}
```

---

## Worker sketch (pseudocode)

```js
// wrangler.toml bindings: R2_BUCKET, DB (D1)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/sessions' && request.method === 'POST') {
      if (request.headers.get('X-Booth-Key') !== env.BOOTH_KEY) {
        return new Response('Unauthorized', { status: 401 });
      }
      const { imageBase64, frameId, contentType } = await request.json();
      const id = crypto.randomUUID();
      const r2Key = `sessions/${id}.png`;
      await env.R2_BUCKET.put(r2Key, decodeBase64(imageBase64), {
        httpMetadata: { contentType: contentType || 'image/png' }
      });
      await env.DB.prepare(
        'INSERT INTO sessions (id, r2_key, frame_id, created_at, consumed) VALUES (?, ?, ?, ?, 0)'
      ).bind(id, r2Key, frameId, Date.now()).run();
      return Response.json({ sessionId: id }, { status: 201 });
    }

    const match = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (match && request.method === 'GET') {
      const id = match[1];
      const row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first();
      if (!row || isExpired(row)) return new Response('Not found', { status: 404 });
      if (row.consumed) return new Response('Gone', { status: 410 });

      const updated = await env.DB.prepare(
        'UPDATE sessions SET consumed = 1 WHERE id = ? AND consumed = 0'
      ).bind(id).run();
      if (!updated.changes) return new Response('Gone', { status: 410 });

      const signed = await env.R2_BUCKET.createSignedUrl(row.r2_key, { expiresIn: 300 });
      return Response.json(
        { imageUrl: signed, frameId: row.frame_id },
        { headers: cors(request.headers.get('Origin')) }
      );
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) {
    await env.DB.prepare('DELETE FROM sessions WHERE created_at < ?').bind(Date.now() - 864e5).run();
  }
};
```

---

## D1 schema

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  frame_id TEXT,
  created_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_created ON sessions(created_at);
```

---

## wrangler.toml (outline)

```toml
name = "olympus-snap-sessions"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "olympus-snap-sessions"

[[d1_databases]]
binding = "DB"
database_name = "olympus-snap-sessions"
database_id = "<uuid>"

[vars]
# BOOTH_KEY set via wrangler secret put BOOTH_KEY

[triggers]
crons = ["0 4 * * *"]
```

---

## Rate limiting (optional)

- POST `/api/sessions`: 30 req/min per booth IP.
- GET `/api/sessions/:id`: 10 req/min per IP (brute-force mitigation; UUID space makes guessing infeasible).

---

## Dev stub vs production

| | Dev stub (`sessionStub.js`) | Production (this API) |
|--|----------------------------|------------------------|
| Storage | localStorage, same origin | R2 + D1 |
| Cross-device | No (needs Cloudflare) | Yes |
| One-time | Delete key after consume | Atomic D1 update |
| QR testing | Same machine, second tab | Real guest phones |

---

## Security notes

- Never embed `X-Booth-Key` in guest-facing bundles; booth build only.
- Signed R2 URLs must be short-lived.
- Do not log full session IDs with image payloads in production logs.
- Consider max body size on Worker (e.g. 6 MB) to match largest booth composite.
