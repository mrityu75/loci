CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  summary TEXT,
  embedding_id TEXT,
  metadata TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes (session_id);
CREATE INDEX IF NOT EXISTS idx_episodes_user ON episodes (user_id);
CREATE INDEX IF NOT EXISTS idx_episodes_started_at ON episodes (started_at);

CREATE TABLE IF NOT EXISTS learnings (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  reinforcement_count INTEGER NOT NULL DEFAULT 1,
  embedding_id TEXT,
  created_at INTEGER NOT NULL,
  last_reinforced_at INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (episode_id) REFERENCES episodes (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learnings_episode ON learnings (episode_id);
CREATE INDEX IF NOT EXISTS idx_learnings_user ON learnings (user_id);
CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings (category);
CREATE INDEX IF NOT EXISTS idx_learnings_confidence ON learnings (confidence);

CREATE TABLE IF NOT EXISTS working_memory (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL,
  active_episode_id TEXT,
  context_window TEXT DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (active_episode_id) REFERENCES episodes (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_working_memory_session ON working_memory (session_id);
CREATE INDEX IF NOT EXISTS idx_working_memory_user ON working_memory (user_id);
