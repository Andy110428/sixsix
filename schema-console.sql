CREATE TABLE IF NOT EXISTS telegram_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS known_uids (
  uid TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payback_feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  commission_time INTEGER NOT NULL,
  amount_usdt REAL NOT NULL,
  source TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(uid, commission_time, amount_usdt, source)
);

CREATE TABLE IF NOT EXISTS payback_cursor (
  uid TEXT PRIMARY KEY,
  last_checked INTEGER NOT NULL
);
