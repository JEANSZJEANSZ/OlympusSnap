-- Prior 0001 on this account created `sessions`, not `captures`.
CREATE TABLE IF NOT EXISTS captures (
	id TEXT PRIMARY KEY,
	key_hash TEXT NOT NULL,
	frame_id TEXT,
	content_type TEXT NOT NULL DEFAULT 'image/jpeg',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
