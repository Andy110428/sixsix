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


CREATE TABLE IF NOT EXISTS tg_link_tokens (
  token TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS tg_members (
  user_id INTEGER PRIMARY KEY,
  uid TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  status TEXT NOT NULL,
  linked_at INTEGER,
  approved_at INTEGER,
  joined_at INTEGER,
  in_group INTEGER NOT NULL DEFAULT 0,
  invite_link TEXT,
  last_check_at INTEGER,
  last_active_at INTEGER,
  warned_at INTEGER,
  flagged_at INTEGER,
  flag_reason TEXT,
  kicked_at INTEGER,
  kick_reason TEXT
);

CREATE TABLE IF NOT EXISTS tg_seen (
  user_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  in_group INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
