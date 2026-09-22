-- Cloudflare D1 스키마
-- Cloudflare 대시보드 > D1 > 방금 만든 DB > Console 탭에서 아래 내용을 그대로 붙여넣고 실행하세요.

-- ⚠️ 계정은 단일 시스템(members). 가입은 이메일+비밀번호로 누구나 동일하게 하고,
--    스터디룸 접근(uid 등록)과 추천인 파트너 자격(referral_partner_status)은
--    가입 이후 계정 안에서 별도로 얻는 권한이다.

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  uid TEXT UNIQUE,                        -- Gate UID, "내 정보"에서 등록. 전용 링크 직속 가입자 확인되면 스터디룸 접근 허용
  gate_api_key TEXT,                      -- Read-Only API 연동 (랭킹용, uid와 별개 트랙)
  gate_api_secret TEXT,
  gate_uid TEXT UNIQUE,                   -- API 연동으로 확인된 UID (소유 증명용)
  trading_volume REAL NOT NULL DEFAULT 0,  -- 관리자가 수동 입력 (랭킹/추천인 확정에 사용)
  ranking_opt_in INTEGER NOT NULL DEFAULT 0,  -- 랭킹 시스템 참여 여부 (선택, API 연동 필요)
  referral_partner_status TEXT NOT NULL DEFAULT 'none',  -- none | pending | approved | rejected
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
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
-- 공지/강의/브리핑은 관리자만 작성, 질문/수익인증은 Gate UID가 등록된 회원이면 누구나 작성
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data TEXT,
  thumb_data TEXT,
  min_grade TEXT,
  external_url TEXT,                     -- 강의(lecture) 카드의 "수강하러가기" 외부 링크
  author_type TEXT NOT NULL,
  author_id TEXT NOT NULL,               -- member면 members.uid 값
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 추천인 파트너 신청 (referral.html "파트너 신청하기" → 관리자가 admin.html에서 승인/거절)
CREATE TABLE IF NOT EXISTS referral_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  wallet_address TEXT NOT NULL,           -- USDT(TRC20)
  telegram_id TEXT NOT NULL,
  activity_plan TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

-- 추천인 코드: 승인된 파트너 1명당 1개
CREATE TABLE IF NOT EXISTS referral_codes (
  code TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- 추천인 코드로 가입한 회원 기록 (가입 1건당 2만원 적립 예정)
-- qualified: 추천받은 사람(referred_email)의 거래량이 $100,000를 넘어야 1로 바뀜 (어뷰징 방지)
CREATE TABLE IF NOT EXISTS referral_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  referred_email TEXT NOT NULL UNIQUE,
  reward_krw INTEGER NOT NULL,
  qualified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 추천인 적립금 출금 신청 (관리자가 직접 심사 후 수동 송금)
CREATE TABLE IF NOT EXISTS referral_withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_krw INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | paid
  paid_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 경제 캘린더: 관리자가 직접 입력하는 일정 (외부 위젯 아님)
CREATE TABLE IF NOT EXISTS economic_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time INTEGER NOT NULL,   -- epoch ms
  country TEXT,
  title TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 1,  -- 1~3, 별 개수로 표시
  forecast TEXT,
  previous TEXT,
  actual TEXT,
  created_at INTEGER NOT NULL
);
