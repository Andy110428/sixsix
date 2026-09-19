ALTER TABLE posts ADD COLUMN min_grade TEXT;
ALTER TABLE users ADD COLUMN trading_volume REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  owner_uid TEXT NOT NULL,
  referred_uid TEXT NOT NULL UNIQUE,
  reward_krw INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_uid TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_krw INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
