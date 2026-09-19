-- 계정 통합: 스터디룸 계정(users)과 일반 계정(general_members)을 members 하나로 합침.
-- ensureSchema()가 배포 시 자동으로도 처리하지만(이 마이그레이션과 동일한 로직), 콘솔에서
-- 수동으로 반영하려면 아래를 순서대로 실행하세요.
-- ⚠️ 추천인 코드/실적(referral_codes 등)은 이번에도 다시 이전 대상이 아니라 초기화됩니다
--    (소유자 개념이 또 바뀌었기 때문 — 운영자 확인 사항).

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  uid TEXT UNIQUE,
  gate_api_key TEXT,
  gate_api_secret TEXT,
  gate_uid TEXT UNIQUE,
  trading_volume REAL NOT NULL DEFAULT 0,
  ranking_opt_in INTEGER NOT NULL DEFAULT 0,
  referral_partner_status TEXT NOT NULL DEFAULT 'none',
  created_at INTEGER NOT NULL
);

-- 예전 스터디룸 계정(users)이 있다면 members로 옮김 (이메일이 없으므로 uid-<UID>@legacy.local로 임시 채움 —
-- 회원이 로그인 후 "내 정보"에서 비밀번호 재설정 없이 실제 이메일로 바꾸고 싶다면 별도 절차 필요)
INSERT OR IGNORE INTO members (email, salt, password_hash, nickname, uid, created_at)
SELECT 'uid-' || uid || '@legacy.local', salt, password_hash, nickname, uid, created_at FROM users;

-- 예전 일반(추천인) 계정(general_members)이 있다면 members로 옮김
INSERT OR IGNORE INTO members (email, salt, password_hash, nickname, gate_uid, gate_api_key, gate_api_secret, trading_volume, ranking_opt_in, created_at)
SELECT email, salt, password_hash, nickname, gate_uid, gate_api_key, gate_api_secret, trading_volume, ranking_opt_in, created_at FROM general_members;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS general_members;

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  activity_plan TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE TABLE IF NOT EXISTS economic_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time INTEGER NOT NULL,
  country TEXT,
  title TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 1,
  forecast TEXT,
  previous TEXT,
  actual TEXT,
  created_at INTEGER NOT NULL
);

-- referral_codes/referral_signups/referral_withdrawals 재생성 (소유자 개념이 또 바뀌어서 초기화)
DROP TABLE IF EXISTS referral_withdrawals;
DROP TABLE IF EXISTS referral_signups;
DROP TABLE IF EXISTS referral_codes;

CREATE TABLE referral_codes (
  code TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE referral_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  referred_email TEXT NOT NULL UNIQUE,
  reward_krw INTEGER NOT NULL,
  qualified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE referral_withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_krw INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at INTEGER,
  created_at INTEGER NOT NULL
);
