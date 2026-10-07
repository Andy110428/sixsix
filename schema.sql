-- TEAM SIXX D1 스키마 (2026-10-07, 20단계 기준)
--
-- ⚠️ 스터디룸/추천인 파트너/게시판/랭킹 시스템을 전면 폐기하면서(20단계) 이 파일도
-- 그 시스템이 쓰던 테이블(members/sessions/posts/comments/referral_*/economic_events 등)
-- 정의를 전부 뺐습니다. 운영 DB(D1)에는 그 테이블들이 데이터와 함께 여전히 남아있지만
-- (삭제하지 않고 보존하기로 함), src/worker.js의 ensureSchema()는 더 이상 이 테이블들을
-- 만들거나 건드리지 않습니다 — 필요하면 D1 콘솔에서 직접 조회/복구하면 됩니다.
--
-- 지금 앱이 실제로 쓰는 테이블은 아래 하나뿐입니다.

CREATE TABLE IF NOT EXISTS telegram_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,              -- Gate.io UID (전용 링크 direct_referral 확인된 UID만 저장됨)
  telegram_id TEXT NOT NULL,      -- 신청자가 입력한 텔레그램 아이디
  created_at INTEGER NOT NULL     -- epoch ms
);
