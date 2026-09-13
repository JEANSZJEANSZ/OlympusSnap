-- One-shot remote fix. Do not add to d1_migrations — local 0001 already has this shape.
CREATE TABLE IF NOT EXISTS assets_v2 (
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

INSERT INTO assets_v2 (id, kind, name, motif, content_type, width, height, slots, created_at)
SELECT
	id,
	kind,
	name,
	motif,
	'image/png',
	w,
	h,
	slots_json,
	datetime('now')
FROM assets;

DROP TABLE assets;

ALTER TABLE assets_v2 RENAME TO assets;

CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets (kind);
