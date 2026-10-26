-- TEAM SIXX D1 스키마 (2026-10-07, 20단계 기준)
--
-- ⚠️ 스터디룸/추천인 파트너/게시판/랭킹 시스템을 전면 폐기하면서(20단계) 이 파일도
-- 그 시스템이 쓰던 테이블(members/sessions/posts/comments/referral_*/economic_events 등)
-- 정의를 전부 뺐습니다. 운영 DB(D1)에는 그 테이블들이 데이터와 함께 여전히 남아있지만
-- (삭제하지 않고 보존하기로 함), src/worker.js의 ensureSchema()는 더 이상 이 테이블들을
-- 만들거나 건드리지 않습니다 — 필요하면 D1 콘솔에서 직접 조회/복구하면 됩니다.
--
-- 2026-10-10 20-6단계: 누적 페이백 조회 / 실시간 페이백 피드 기능 추가하면서 테이블 3개 추가.

CREATE TABLE IF NOT EXISTS telegram_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,              -- Gate.io UID (전용 링크 direct_referral 확인된 UID만 저장됨)
  telegram_id TEXT NOT NULL,      -- 신청자가 입력한 텔레그램 아이디
  created_at INTEGER NOT NULL     -- epoch ms
);

-- /api/check-uid에서 direct_referral 확인된 UID를 전부 기록 — 실시간 페이백 피드 크론이
-- 이 목록을 순회하면서 각 UID의 커미션 내역을 조회함.
CREATE TABLE IF NOT EXISTS known_uids (
  uid TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL     -- epoch ms
);

-- 실시간 페이백 피드(공개). commission_time은 Gate.io 응답의 유닉스초, amount_usdt는
-- 우리가 받은 커미션 × PAYBACK_RATIO(2) = 유저 몫 추정액.
CREATE TABLE IF NOT EXISTS payback_feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  commission_time INTEGER NOT NULL,
  amount_usdt REAL NOT NULL,
  source TEXT,                    -- SPOT / FUTURES
  created_at INTEGER NOT NULL,    -- epoch ms
  UNIQUE(uid, commission_time, amount_usdt, source)
);

-- UID별로 "어디까지 조회했는지" 커서 — 크론이 매번 전체 기간을 다시 훑지 않도록.
CREATE TABLE IF NOT EXISTS payback_cursor (
  uid TEXT PRIMARY KEY,
  last_checked INTEGER NOT NULL   -- epoch 초 (Gate.io API 파라미터와 단위 통일)
);

-- 2026-10-25 20-40단계: BYDFi 가입 신청(수동 확인) 테이블 추가. BYDFi는 Gate.io 같은 공개
-- 레퍼럴확인 API가 없어서 서버 재검증 없이 그냥 저장 + 운영자 알림만 보냄.
CREATE TABLE IF NOT EXISTS bydfi_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,              -- BYDFi UID (서버 검증 없음 — 운영자가 수동 확인)
  telegram_id TEXT NOT NULL,
  created_at INTEGER NOT NULL     -- epoch ms
);

-- 2026-10-26 20-44단계: Bitget 가입 신청(자동 확인) 테이블 추가. Bitget은 어필리에이트
-- customer-list API로 UID 포함 여부를 서버가 자동 재검증한 뒤에만 저장함(Gate.io와 동일 패턴).
CREATE TABLE IF NOT EXISTS bitget_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,              -- Bitget UID (서버가 자동 재검증한 UID만 저장됨)
  telegram_id TEXT NOT NULL,
  created_at INTEGER NOT NULL     -- epoch ms
);

-- 2026-10-11 20-16단계: 스터디방 관리 봇(src/study-bot.js) 테이블 4개 추가.

-- 사이트에서 발급하는 1회용 봇 딥링크 토큰(24시간 유효) — 신청자가 봇에서 "시작"을 누르면 소비됨.
CREATE TABLE IF NOT EXISTS tg_link_tokens (
  token TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,    -- epoch ms
  used_at INTEGER
);

-- 텔레그램 숫자 ID(user_id, 아이디를 바꿔도 불변) ↔ Gate.io UID 연결 + 스터디방 상태.
-- status: pending(승인 대기) / approved / rejected / kicked
CREATE TABLE IF NOT EXISTS tg_members (
  user_id INTEGER PRIMARY KEY,
  uid TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  status TEXT NOT NULL,
  linked_at INTEGER,
  approved_at INTEGER,
  joined_at INTEGER,              -- 30일 유예 기간의 기준
  in_group INTEGER NOT NULL DEFAULT 0,
  invite_link TEXT,               -- 이 사람 전용 1회용 초대 링크(다른 사람이 쓰면 내보냄)
  last_check_at INTEGER,
  last_active_at INTEGER,
  warned_at INTEGER,
  flagged_at INTEGER,             -- 자동 내보내기 꺼짐 상태에서 "대상"으로 알린 시각
  flag_reason TEXT,
  kicked_at INTEGER,
  kick_reason TEXT
);

-- 사이트 신청 없이 그룹에서 감지된(입장/메시지) 미등록 멤버.
CREATE TABLE IF NOT EXISTS tg_seen (
  user_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  in_group INTEGER NOT NULL DEFAULT 1
);

-- 단순 설정값 저장(autokick = on/off 등).
CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
