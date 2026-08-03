CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('frame', 'sticker')),
  name TEXT NOT NULL,
  motif TEXT,
  r2_key TEXT NOT NULL,
  w INTEGER,
  h INTEGER,
  slots_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  frame_id TEXT,
  created_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_assets_kind ON assets(kind);
CREATE INDEX idx_sessions_created ON sessions(created_at);
