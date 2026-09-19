-- 계정 분리: 스터디룸 계정(users)과 일반 계정(general_members, 추천인/랭킹 전용)을 완전히 분리.
-- 지난 마이그레이션(migration-add-approval-qualified.sql)에서 추가했던
-- users.study_room_approved / users.trading_volume는 이번에 되돌리고, 추천인 관련 테이블은
-- Gate UID 소유가 아닌 일반 계정(이메일) 소유로 완전히 옮겨졌습니다.
-- ensureSchema()가 배포 시 자동으로도 처리하지만, 콘솔에서 수동 적용하려면 아래 실행하세요.
-- ⚠️ 기존에 스터디룸 계정이 발급했던 추천인 코드/실적은 이번 이전 대상이 아니라 초기화됩니다
--    (소유자가 UID → 이메일로 바뀌어서 자동 이전이 불가능 — 운영자 확인 사항).

-- 1) 일반 계정 테이블 신설
CREATE TABLE IF NOT EXISTS general_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  gate_uid TEXT UNIQUE,
  gate_api_key TEXT,
  gate_api_secret TEXT,
  trading_volume REAL NOT NULL DEFAULT 0,
  ranking_opt_in INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS general_sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 2) 스터디룸 계정(users)에서 승인 플래그 / 거래량 제거 (지난 마이그레이션 되돌리기)
ALTER TABLE users DROP COLUMN study_room_approved;
ALTER TABLE users DROP COLUMN trading_volume;

-- 3) 추천인 테이블을 이메일 소유로 재생성 (기존 실적 초기화)
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
