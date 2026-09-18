-- Cloudflare D1 스키마
-- Cloudflare 대시보드 > D1 > 방금 만든 DB > Console 탭에서 아래 내용을 그대로 붙여넣고 실행하세요.

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

-- 게시글: 공지(notice) · 강의(lecture) · 질문(question) · 수익인증(profit)
-- 공지/강의는 관리자만 작성, 질문/수익인증은 로그인한 회원이면 누구나 작성
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data TEXT,             -- 이미지(base64), 수익인증용, 없으면 NULL
  author_type TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 댓글: 로그인한 회원 또는 관리자가 게시글에 작성
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,   -- 'admin' | 'member'
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 로그인 실패 잠금 (무차별 대입 방지)
CREATE TABLE IF NOT EXISTS login_attempts (
  uid TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);

