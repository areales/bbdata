-- Response cache: keyed by source + query hash
CREATE TABLE IF NOT EXISTS response_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  query_params TEXT NOT NULL,
  response_data TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(source, query_hash)
);

-- Player ID mapping across sources
CREATE TABLE IF NOT EXISTS player_ids (
  mlbam_id TEXT PRIMARY KEY,
  fangraphs_id TEXT,
  bbref_id TEXT,
  player_name TEXT NOT NULL,
  team TEXT,
  position TEXT,
  updated_at TEXT NOT NULL
);

-- Query history for convenience (rerun last query)
CREATE TABLE IF NOT EXISTS query_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  template_id TEXT NOT NULL,
  params TEXT NOT NULL,
  ran_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_lookup ON response_cache(source, query_hash);
CREATE INDEX IF NOT EXISTS idx_player_name ON player_ids(player_name);
