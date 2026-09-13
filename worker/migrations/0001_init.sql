CREATE TABLE IF NOT EXISTS assets (
	id TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('frame', 'sticker')),
	name TEXT NOT NULL,
	motif TEXT,
	content_type TEXT NOT NULL DEFAULT 'image/png',
	width INTEGER,
	height INTEGER,
	slots TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets (kind);

CREATE TABLE IF NOT EXISTS captures (
	id TEXT PRIMARY KEY,
	key_hash TEXT NOT NULL,
	frame_id TEXT,
	content_type TEXT NOT NULL DEFAULT 'image/jpeg',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
