-- 스터디룸 입장 승인 시스템 + 추천인 확정(qualified) 플래그 추가
-- (ensureSchema()가 배포 시 자동으로도 처리하지만, 콘솔에서 수동 적용하려면 아래 실행)

ALTER TABLE users ADD COLUMN study_room_approved INTEGER NOT NULL DEFAULT 0;

-- 기존 회원들은 이미 스터디룸을 쓰고 있었으므로 전부 승인 상태로 백필
-- (이 UPDATE는 한 번만 실행할 것 — 이후 신규 가입자는 기본값 0으로 두고 관리자가 개별 승인)
UPDATE users SET study_room_approved = 1;

ALTER TABLE referral_signups ADD COLUMN qualified INTEGER NOT NULL DEFAULT 0;
