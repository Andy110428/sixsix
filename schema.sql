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
