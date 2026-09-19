-- Cloudflare D1 스키마
-- Cloudflare 대시보드 > D1 > 방금 만든 DB > Console 탭에서 아래 내용을 그대로 붙여넣고 실행하세요.

-- ⚠️ 계정이 두 종류로 완전히 분리되어 있음:
--   1) users            스터디룸 계정 (Gate.io 전용 링크로 가입 확인된 UID만 생성 가능, UID+비번 로그인)
--   2) general_members   일반 계정 (Gate UID와 무관, 이메일+비번 로그인) — 추천인/랭킹/API 연동 전용

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT UNIQUE NOT NULL,          -- Gate.io UID, 계정당 1개만 (중복 가입 방지)
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,                     -- 회원이 직접 설정하는 닉네임 (선택, 없으면 UID로 표시)
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,            -- 로그인 세션 토큰 (쿠키에 저장됨)
  uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 관리자 전용 세션 (일반 회원 세션과 분리)
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 게시글: 공지(notice) · 코인 브리핑(briefing) · 강의(lecture) · 질문(question) · 수익인증(profit)
-- 공지/강의/브리핑은 관리자만 작성, 질문/수익인증은 로그인한 스터디룸 회원이면 누구나 작성
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data TEXT,             -- 이미지(base64), 없으면 NULL
  thumb_data TEXT,             -- 목록에 보여줄 작은 미리보기 이미지(base64), 없으면 NULL
  min_grade TEXT,              -- 강의(lecture) 전용: 이 등급 이상만 열람 가능, NULL이면 전체 공개
  author_type TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 댓글: 로그인한 스터디룸 회원 또는 관리자가 게시글에 작성
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,   -- 'admin' | 'member'
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 일반 계정: 이메일+비밀번호, Gate UID와 무관하게 누구나 가입 가능.
-- 추천인 코드 발급/사용, 랭킹 참여(선택), Gate.io Read-Only API 연동 전용 — 스터디룸과 무관.
CREATE TABLE IF NOT EXISTS general_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  gate_uid TEXT UNIQUE,           -- Read-Only API 연동 시 /account/detail 응답으로 서버가 직접 확인해서 채움
  gate_api_key TEXT,              -- Read-Only 권한 전용 (출금/거래 권한 요구 안 함)
  gate_api_secret TEXT,
  trading_volume REAL NOT NULL DEFAULT 0,   -- 지금은 관리자가 수동 입력 (자동 동기화는 베타)
  ranking_opt_in INTEGER NOT NULL DEFAULT 0,  -- 랭킹 시스템 참여 여부 (선택, API 연동 필요)
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS general_sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 추천인 코드: 일반 계정 1명당 1개, 제한 없이 누구나 발급 가능
CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- 추천인 코드로 가입한 일반 계정 기록 (가입 1건당 2만원 적립 예정)
-- qualified: 추천받은 사람(referred_email)의 거래량이 $100,000를 넘어야 1로 바뀜 (어뷰징 방지, 되돌리지 않음)
CREATE TABLE IF NOT EXISTS referral_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  referred_email TEXT NOT NULL UNIQUE,
  reward_krw INTEGER NOT NULL,
  qualified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 추천인 적립금 출금 신청 (관리자가 직접 심사 후 수동 송금, 자동 송금 없음)
CREATE TABLE IF NOT EXISTS referral_withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,   -- USDT(TRC20) 지갑 주소
  amount_krw INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | paid
  paid_at INTEGER,                -- status가 paid로 바뀐 시각 (공개 실시간 피드 정렬용)
  created_at INTEGER NOT NULL
);
