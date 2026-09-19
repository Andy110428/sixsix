// Cloudflare Worker (with static assets + D1)
//
// ⚠️ 계정이 두 종류로 완전히 분리되어 있음 (하나로 합치지 않음):
//   1) 스터디룸 계정 (users 테이블, UID+비밀번호 로그인, session 쿠키)
//      Gate.io 전용 링크로 가입한 UID만 생성 가능 — 회원가입 시 Gate.io 레퍼럴 확인만
//      통과하면 바로 이용 가능 (별도 관리자 승인 절차 없음, 원래 설계 그대로).
//      게시판(공지/브리핑/강의/질문/수익인증) 전용 계정.
//   2) 일반 계정 (general_members 테이블, 이메일+비밀번호 로그인, general_session 쿠키)
//      Gate UID/가입 여부와 전혀 무관하게 누구나 가입 가능. 추천인 코드 발급/사용,
//      랭킹 참여(선택), Gate.io Read-Only API 연동 전용 계정 — 스터디룸 게시판과는
//      전혀 연결되지 않음. 스터디룸에 들어가려면 위 1)번 계정을 별도로 만들어야 함.
//
// 스터디룸 회원 API (users 테이블, session 쿠키):
//   GET  /api/check-uid?uid=...      Gate.io 레퍼럴 확인만 (계정 생성 없음)
//   POST /api/signup                 스터디룸 계정 생성 (Gate.io 전용 링크 직속 가입자만 가능)
//   POST /api/login                  로그인
//   GET  /api/me                     로그인 상태 확인 (닉네임/등급/활동량)
//   POST /api/logout                 로그아웃
//   POST /api/account/change-password  비밀번호 변경
//   POST /api/account/nickname       닉네임 설정
//
// 게시판 API (글쓰기/댓글은 스터디룸 로그인 또는 관리자, 목록/상세는 공개):
//   GET  /api/posts?category=notice|briefing|lecture|question|profit
//   GET  /api/posts/detail?id=...
//   POST /api/posts                  글쓰기 (notice/lecture/briefing=관리자만, question/profit=회원+관리자)
//   POST /api/posts/update           글 수정 (관리자만)
//   POST /api/posts/delete           글 삭제 (관리자만)
//   POST /api/comments               댓글 작성 (회원 또는 관리자)
//   POST /api/comments/delete        댓글 삭제 (관리자만)
//
// 일반 계정 API (general_members 테이블, general_session 쿠키) — 추천인/랭킹/API 연동 전용:
//   POST /api/general/signup             이메일+비밀번호로 가입 (Gate UID 불필요)
//   POST /api/general/login
//   GET  /api/general/me                 로그인 상태 + 닉네임/연동 UID/거래량/랭킹 참여 여부
//   POST /api/general/logout
//   POST /api/general/change-password
//   POST /api/general/nickname
//   POST /api/general/connect-gate-api   Gate.io Read-Only API 키 연동 (키/시크릿만 받고,
//                                        /account/detail 응답의 user_id로 UID를 서버가 직접 확인)
//   POST /api/general/disconnect-gate-api
//   GET  /api/general/gate-account-raw   연동된 키로 계좌 정보 원본 조회 (베타, 진단용)
//   POST /api/general/ranking-opt-in     랭킹 시스템 참여/탈퇴 (참여하려면 API 연동 필요)
//   GET  /api/general/rankings           공개 랭킹 (참여 동의한 사람만, 닉네임/이메일 마스킹)
//
// 추천인 API (일반 계정 전용, 스터디룸과 무관):
//   POST /api/referral/issue-code        내 추천인 코드 발급 (제한 없음, 계정만 있으면 발급 가능)
//   GET  /api/referral/me                내 추천인 현황 (코드/확정 적립/대기중/출금내역)
//   POST /api/referral/withdraw          출금 신청 (텔레그램ID + USDT-TRC20 주소 + 금액)
//   GET  /api/referral/recent-withdrawals  최근 지급 완료 출금 내역 (공개, 닉네임/금액 마스킹, 실시간 피드용)
//   ※ 추천 보상은 "추천받은 사람의 거래량이 $100,000 달성"해야 확정됨 (가입만 하고 활동 안
//     하는 어뷰징 방지). 지금은 관리자가 admin.html에서 거래량을 직접 입력하면 자동으로
//     확정 처리됨 (checkAndQualifyReferral()). Gate Read-Only API 연동은 계정 소유 확인용이고,
//     거래량 자동 동기화는 아직 베타 — 확정 판단은 여전히 관리자 수동 입력 기준.
//
// 관리자 API:
//   POST /api/admin/login
//   GET  /api/admin/me
//   POST /api/admin/logout
//   GET  /api/admin/stats
//   GET  /api/admin/find-user?uid=...        스터디룸 회원 UID 검색 (비밀번호 재설정 전 조회용)
//   POST /api/admin/reset-password           스터디룸 회원 비밀번호 재설정
//   GET  /api/admin/general/find?query=...   일반 계정 검색 (이메일 또는 연동 UID)
//   POST /api/admin/general/set-volume       일반 계정 거래량 수동 입력 (추천인 확정 자동 체크)
//   POST /api/admin/general/reset-volumes    전체 거래량 0 초기화 (랭킹 리셋)
//   GET  /api/admin/referral/issuers         추천인 코드 발급자 전체 현황 (실적 한눈에 관리)
//   GET  /api/admin/gate-rebate-raw          Gate.io 파트너 리베이트 API 원본 응답 확인 (베타)
//   GET  /api/admin/referral/withdrawals     출금 신청 목록
//   POST /api/admin/referral/withdrawals/update  출금 신청 상태 변경
//
// 필요한 환경변수(Settings > Variables and Secrets):
//   GATE_API_KEY, GATE_API_SECRET   Gate.io 파트너 API (레퍼럴 확인용 — 회원 개인 키 아님)
//   ADMIN_USERNAME, ADMIN_PASSWORD  관리자 로그인
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID  (선택) 출금 신청 시 텔레그램 알림
// 필요한 바인딩: D1 데이터베이스 → env.DB

const SESSION_COOKIE = 'session';
const ADMIN_COOKIE = 'admin_session';
const GENERAL_SESSION_COOKIE = 'general_session';
const SESSION_DAYS = 7;
const ADMIN_SESSION_HOURS = 12;
const GENERAL_SESSION_DAYS = 7;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path.startsWith('/api/') && env.DB) await ensureSchema(env);

      if (path === '/api/check-uid' && method === 'GET') return await handleCheckUid(request, env);
      if (path === '/api/signup' && method === 'POST') return await handleSignup(request, env);
      if (path === '/api/login' && method === 'POST') return await handleLogin(request, env);
      if (path === '/api/me' && method === 'GET') return await handleMe(request, env);
      if (path === '/api/logout' && method === 'POST') return await handleLogout(request, env);
      if (path === '/api/account/change-password' && method === 'POST') return await handleChangePassword(request, env);
      if (path === '/api/account/nickname' && method === 'POST') return await handleSetNickname(request, env);
      if (path === '/api/admin/find-user' && method === 'GET') return await handleAdminFindUser(request, env);
      if (path === '/api/admin/reset-password' && method === 'POST') return await handleAdminResetPassword(request, env);

      if (path === '/api/posts' && method === 'GET') return await handleListPosts(request, env);
      if (path === '/api/posts/detail' && method === 'GET') return await handlePostDetail(request, env);
      if (path === '/api/posts' && method === 'POST') return await handleCreatePost(request, env);
      if (path === '/api/posts/update' && method === 'POST') return await handleUpdatePost(request, env);
      if (path === '/api/posts/delete' && method === 'POST') return await handleDeletePost(request, env);
      if (path === '/api/comments' && method === 'POST') return await handleCreateComment(request, env);
      if (path === '/api/comments/delete' && method === 'POST') return await handleDeleteComment(request, env);

      if (path === '/api/admin/login' && method === 'POST') return await handleAdminLogin(request, env);
      if (path === '/api/admin/me' && method === 'GET') return await handleAdminMe(request, env);
      if (path === '/api/admin/logout' && method === 'POST') return await handleAdminLogout(request, env);
      if (path === '/api/admin/stats' && method === 'GET') return await handleAdminStats(request, env);

      // 일반 계정 (추천인/랭킹/API 연동 전용)
      if (path === '/api/general/signup' && method === 'POST') return await handleGeneralSignup(request, env);
      if (path === '/api/general/login' && method === 'POST') return await handleGeneralLogin(request, env);
      if (path === '/api/general/me' && method === 'GET') return await handleGeneralMe(request, env);
      if (path === '/api/general/logout' && method === 'POST') return await handleGeneralLogout(request, env);
      if (path === '/api/general/change-password' && method === 'POST') return await handleGeneralChangePassword(request, env);
      if (path === '/api/general/nickname' && method === 'POST') return await handleGeneralSetNickname(request, env);
      if (path === '/api/general/connect-gate-api' && method === 'POST') return await handleGeneralConnectGateApi(request, env);
      if (path === '/api/general/disconnect-gate-api' && method === 'POST') return await handleGeneralDisconnectGateApi(request, env);
      if (path === '/api/general/gate-account-raw' && method === 'GET') return await handleGeneralGateAccountRaw(request, env);
      if (path === '/api/general/ranking-opt-in' && method === 'POST') return await handleGeneralRankingOptIn(request, env);
      if (path === '/api/general/rankings' && method === 'GET') return await handleGeneralRankings(request, env);

      if (path === '/api/referral/issue-code' && method === 'POST') return await handleReferralIssueCode(request, env);
      if (path === '/api/referral/me' && method === 'GET') return await handleReferralMe(request, env);
      if (path === '/api/referral/withdraw' && method === 'POST') return await handleReferralWithdraw(request, env);
      if (path === '/api/referral/recent-withdrawals' && method === 'GET') return await handleReferralRecentWithdrawals(request, env);

      if (path === '/api/admin/general/find' && method === 'GET') return await handleAdminFindGeneralMember(request, env);
      if (path === '/api/admin/general/set-volume' && method === 'POST') return await handleAdminSetGeneralVolume(request, env);
      if (path === '/api/admin/general/reset-volumes' && method === 'POST') return await handleAdminResetGeneralVolumes(request, env);
      if (path === '/api/admin/referral/issuers' && method === 'GET') return await handleAdminReferralIssuers(request, env);
      if (path === '/api/admin/gate-rebate-raw' && method === 'GET') return await handleAdminGateRebateRaw(request, env);
      if (path === '/api/admin/referral/withdrawals' && method === 'GET') return await handleAdminListWithdrawals(request, env);
      if (path === '/api/admin/referral/withdrawals/update' && method === 'POST') return await handleAdminUpdateWithdrawal(request, env);
    } catch (err) {
      return json({ ok: false, error: '서버 오류가 발생했습니다.', detail: String(err) }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};

// ───────────────────────── 스터디룸 회원 인증 ─────────────────────────

async function handleCheckUid(request, env) {
  const url = new URL(request.url);
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid || !/^[0-9]{3,15}$/.test(uid)) {
    return json({ ok: false, error: 'UID는 숫자만 입력해주세요.' }, 400);
  }
  try {
    const result = await checkGateReferral(uid, env);
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ ok: false, error: err.message || 'Gate.io 조회 중 오류', detail: err.detail }, err.status || 500);
  }
}

async function handleSignup(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  const password = body.password || '';

  if (!/^[0-9]{3,15}$/.test(uid)) return json({ ok: false, error: 'UID는 숫자만 입력해주세요.' }, 400);
  if (password.length < 8) return json({ ok: false, error: '비밀번호는 8자 이상이어야 합니다.' }, 400);

  let referral;
  try {
    referral = await checkGateReferral(uid, env);
  } catch (err) {
    return json({ ok: false, error: err.message || 'Gate.io 조회 중 오류' }, err.status || 500);
  }
  if (referral.status !== 'direct_referral') {
    return json({ ok: false, error: '전용 링크로 가입한 UID가 아닙니다. 먼저 가입 절차를 진행해주세요.' }, 403);
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE uid = ?').bind(uid).first();
  if (existing) return json({ ok: false, error: '이미 가입된 UID입니다. 로그인해주세요.' }, 409);

  const { salt, hash } = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO users (uid, salt, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(uid, salt, hash, Date.now()).run();

  const token = await createSession(env, uid);
  return json({ ok: true, uid }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleLogin(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  const password = body.password || '';
  if (!uid || !password) return json({ ok: false, error: 'UID와 비밀번호를 입력해주세요.' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();
  const { hash } = user ? await hashPassword(password, user.salt) : { hash: null };

  if (!user || hash !== user.password_hash) {
    return json({ ok: false, error: 'UID 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  const token = await createSession(env, uid);
  return json({ ok: true, uid, nickname: user.nickname || null }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleMe(request, env) {
  const uid = await getMemberUid(request, env);
  if (!uid) return json({ ok: false });
  const user = await env.DB.prepare('SELECT nickname FROM users WHERE uid = ?').bind(uid).first();
  const activity = await getMemberActivity(env, uid);
  const grade = gradeForActivity(activity);
  return json({
    ok: true,
    uid,
    nickname: (user && user.nickname) || null,
    grade: grade.key,
    grade_label: grade.label,
    activity,
  });
}

async function handleLogout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token && env.DB) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(SESSION_COOKIE) });
}

async function handleChangePassword(request, env) {
  const uid = await getMemberUid(request, env);
  if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const current = body.currentPassword || '';
  const next = body.newPassword || '';
  if (next.length < 8) return json({ ok: false, error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();
  const { hash: currentHash } = await hashPassword(current, user.salt);
  if (currentHash !== user.password_hash) return json({ ok: false, error: '현재 비밀번호가 올바르지 않습니다.' }, 401);

  const { salt, hash } = await hashPassword(next);
  await env.DB.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE uid = ?').bind(salt, hash, uid).run();
  return json({ ok: true });
}

async function handleSetNickname(request, env) {
  const uid = await getMemberUid(request, env);
  if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const nickname = (body.nickname || '').trim();
  if (nickname.length < 1 || nickname.length > 20) {
    return json({ ok: false, error: '닉네임은 1~20자로 입력해주세요.' }, 400);
  }

  const dup = await env.DB.prepare('SELECT uid FROM users WHERE nickname = ? AND uid != ?').bind(nickname, uid).first();
  if (dup) return json({ ok: false, error: '이미 사용 중인 닉네임입니다.' }, 409);

  await env.DB.prepare('UPDATE users SET nickname = ? WHERE uid = ?').bind(nickname, uid).run();
  return json({ ok: true, nickname });
}

// 관리자가 회원 UID를 조회 (비밀번호 재설정 전 확인용)
async function handleAdminFindUser(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const url = new URL(request.url);
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ ok: false, error: 'UID를 입력해주세요.' }, 400);

  const user = await env.DB.prepare('SELECT uid, nickname, created_at FROM users WHERE uid = ?').bind(uid).first();
  if (!user) return json({ ok: true, found: false });
  return json({ ok: true, found: true, uid: user.uid, nickname: user.nickname || null, created_at: user.created_at });
}

// 관리자가 회원 UID의 비밀번호를 대신 재설정 (비밀번호 찾기 - 수동 처리)
// newPassword를 안 보내면 임시 비밀번호를 자동 생성해서 응답으로 돌려준다.
async function handleAdminResetPassword(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  let newPassword = body.newPassword || '';
  if (!uid) return json({ ok: false, error: 'UID를 입력해주세요.' }, 400);
  if (newPassword && newPassword.length < 8) return json({ ok: false, error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);

  const user = await env.DB.prepare('SELECT id FROM users WHERE uid = ?').bind(uid).first();
  if (!user) return json({ ok: false, error: '해당 UID로 가입된 계정이 없습니다.' }, 404);

  if (!newPassword) newPassword = generateTempPassword();

  const { salt, hash } = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE uid = ?').bind(salt, hash, uid).run();

  // 재설정되면 기존 로그인 세션은 모두 만료시켜 안전하게 처리
  await env.DB.prepare('DELETE FROM sessions WHERE uid = ?').bind(uid).run();

  return json({ ok: true, newPassword });
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// ───────────────────────── 게시판 ─────────────────────────

const ALLOWED_CATEGORIES = ['notice', 'lecture', 'question', 'profit', 'briefing'];
const ADMIN_ONLY_CATEGORIES = ['notice', 'lecture', 'briefing'];

// ───────────────────────── 등급 (활동량 기반) ─────────────────────────
// 활동량 = 작성한 댓글 수 + 질문/수익인증 게시글 수. 기준값은 여기서만 조정하면 됨.
const GRADES = [
  { key: 'bronze', label: '브론즈', min: 0 },
  { key: 'silver', label: '실버', min: 10 },
  { key: 'gold', label: '골드', min: 30 },
  { key: 'platinum', label: '플래티넘', min: 60 },
];
function gradeForActivity(count) {
  let g = GRADES[0];
  for (const item of GRADES) { if (count >= item.min) g = item; }
  return g;
}
function gradeRank(key) {
  const idx = GRADES.findIndex((g) => g.key === key);
  return idx === -1 ? 0 : idx;
}
async function getMemberActivity(env, uid) {
  const row = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM comments WHERE author_type = 'member' AND author_id = ?) +
      (SELECT COUNT(*) FROM posts WHERE author_type = 'member' AND author_id = ? AND category IN ('question','profit')) AS cnt`
  ).bind(uid, uid).first();
  return row ? row.cnt : 0;
}
async function getMemberGrade(env, uid) {
  const activity = await getMemberActivity(env, uid);
  return gradeForActivity(activity).key;
}

// 강의(lecture) 열람 등급 확인 — 관리자는 항상 통과, 회원은 활동량 기반 등급, 비로그인은 항상 최하위 취급
async function getViewerGradeRank(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (isAdmin) return 999;
  const uid = await getMemberUid(request, env);
  if (!uid) return -1;
  const grade = await getMemberGrade(env, uid);
  return gradeRank(grade);
}

async function handleListPosts(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || '';
  if (!ALLOWED_CATEGORIES.includes(category)) return json({ ok: false, error: '잘못된 카테고리입니다.' }, 400);

  const order = category === 'lecture' ? 'ASC' : 'DESC';
  const rows = await env.DB.prepare(
    `SELECT posts.id, posts.title, posts.author_type, posts.author_id, posts.created_at, posts.thumb_data, posts.min_grade, users.nickname AS author_nickname
     FROM posts LEFT JOIN users ON users.uid = posts.author_id
     WHERE posts.category = ? ORDER BY posts.id ${order} LIMIT 100`
  ).bind(category).all();

  let posts = rows.results || [];
  if (category === 'lecture') {
    const viewerRank = await getViewerGradeRank(request, env);
    posts = posts.map((p) => {
      if (p.min_grade && gradeRank(p.min_grade) > viewerRank) {
        return { id: p.id, title: p.title, created_at: p.created_at, min_grade: p.min_grade, locked: true };
      }
      return p;
    });
  }

  return json({ ok: true, posts });
}

async function handlePostDetail(request, env) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return json({ ok: false, error: '잘못된 요청입니다.' }, 400);

  const post = await env.DB.prepare(
    `SELECT posts.*, users.nickname AS author_nickname
     FROM posts LEFT JOIN users ON users.uid = posts.author_id
     WHERE posts.id = ?`
  ).bind(id).first();
  if (!post) return json({ ok: false, error: '게시글을 찾을 수 없습니다.' }, 404);

  if (post.category === 'lecture' && post.min_grade) {
    const viewerRank = await getViewerGradeRank(request, env);
    if (gradeRank(post.min_grade) > viewerRank) {
      const label = (GRADES.find((g) => g.key === post.min_grade) || {}).label || post.min_grade;
      return json({ ok: false, error: `${label} 등급 이상만 볼 수 있는 강의입니다.` }, 403);
    }
  }

  const comments = await env.DB.prepare(
    `SELECT comments.*, users.nickname AS author_nickname
     FROM comments LEFT JOIN users ON users.uid = comments.author_id
     WHERE comments.post_id = ? ORDER BY comments.id ASC LIMIT 500`
  ).bind(id).all();

  return json({ ok: true, post, comments: comments.results || [] });
}

async function handleCreatePost(request, env) {
  const body = await safeJson(request);
  const category = body.category || '';
  const title = (body.title || '').trim();
  const content = (body.content || '').trim();
  const imageData = body.image_data || null;
  const thumbData = body.thumb_data || null;
  const minGrade = category === 'lecture' && GRADES.some((g) => g.key === body.min_grade) ? body.min_grade : null;

  if (!ALLOWED_CATEGORIES.includes(category)) return json({ ok: false, error: '잘못된 카테고리입니다.' }, 400);
  if (!title || !content) return json({ ok: false, error: '제목과 내용을 입력해주세요.' }, 400);
  if (imageData && imageData.length > 2_000_000) return json({ ok: false, error: '이미지 용량이 너무 큽니다. (최대 약 1.5MB)' }, 400);
  if (thumbData && thumbData.length > 150_000) return json({ ok: false, error: '미리보기 이미지 생성에 실패했습니다.' }, 400);

  let authorType, authorId;
  const isAdmin = await getIsAdmin(request, env);

  if (ADMIN_ONLY_CATEGORIES.includes(category)) {
    if (!isAdmin) return json({ ok: false, error: '관리자만 작성할 수 있습니다.' }, 403);
    authorType = 'admin';
    authorId = 'admin';
  } else if (isAdmin) {
    authorType = 'admin';
    authorId = 'admin';
  } else {
    const uid = await getMemberUid(request, env);
    if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
    authorType = 'member';
    authorId = uid;
  }

  const result = await env.DB.prepare(
    'INSERT INTO posts (category, title, content, image_data, thumb_data, min_grade, author_type, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(category, title, content, imageData, thumbData, minGrade, authorType, authorId, Date.now()).run();

  return json({ ok: true, id: result.meta.last_row_id });
}

async function handleDeletePost(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 삭제할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const id = Number(body.id);
  if (!id) return json({ ok: false, error: '잘못된 요청입니다.' }, 400);

  await env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function handleUpdatePost(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 수정할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const id = Number(body.id);
  const title = (body.title || '').trim();
  const content = (body.content || '').trim();
  if (!id || !title || !content) return json({ ok: false, error: '제목과 내용을 입력해주세요.' }, 400);

  const post = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(id).first();
  if (!post) return json({ ok: false, error: '게시글을 찾을 수 없습니다.' }, 404);

  await env.DB.prepare('UPDATE posts SET title = ?, content = ? WHERE id = ?').bind(title, content, id).run();
  return json({ ok: true });
}

async function handleCreateComment(request, env) {
  const body = await safeJson(request);
  const postId = Number(body.post_id);
  const content = (body.content || '').trim();
  if (!postId || !content) return json({ ok: false, error: '내용을 입력해주세요.' }, 400);

  const isAdmin = await getIsAdmin(request, env);
  let authorType, authorId;
  if (isAdmin) {
    authorType = 'admin';
    authorId = 'admin';
  } else {
    const uid = await getMemberUid(request, env);
    if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
    authorType = 'member';
    authorId = uid;
  }

  await env.DB.prepare(
    'INSERT INTO comments (post_id, author_type, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(postId, authorType, authorId, content, Date.now()).run();

  return json({ ok: true });
}

async function handleDeleteComment(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 삭제할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const id = Number(body.id);
  if (!id) return json({ ok: false, error: '잘못된 요청입니다.' }, 400);

  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function handleAdminStats(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 볼 수 있습니다.' }, 403);

  const totalUsers = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  const totalGeneral = await env.DB.prepare('SELECT COUNT(*) AS c FROM general_members').first();
  const totalNotices = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'notice'").first();
  const totalLectures = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'lecture'").first();
  const totalQuestions = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'question'").first();
  const totalProfit = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'profit'").first();
  const totalComments = await env.DB.prepare('SELECT COUNT(*) AS c FROM comments').first();

  return json({
    ok: true,
    members: totalUsers.c,
    general_members: totalGeneral.c,
    notices: totalNotices.c,
    lectures: totalLectures.c,
    questions: totalQuestions.c,
    profit: totalProfit.c,
    comments: totalComments.c,
  });
}

// ───────────────────────── 일반 계정 (추천인/랭킹 전용, 이메일 로그인) ─────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleGeneralSignup(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!isValidEmail(email)) return json({ ok: false, error: '올바른 이메일 주소를 입력해주세요.' }, 400);
  if (password.length < 8) return json({ ok: false, error: '비밀번호는 8자 이상이어야 합니다.' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM general_members WHERE email = ?').bind(email).first();
  if (existing) return json({ ok: false, error: '이미 가입된 이메일입니다. 로그인해주세요.' }, 409);

  const { salt, hash } = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO general_members (email, salt, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(email, salt, hash, Date.now()).run();

  // 추천인 코드로 가입한 경우 기록해둠 — 보상은 이 사람(추천받은 사람)의 거래량이
  // $100,000를 넘는 순간 확정됨 (qualified=0으로 시작, checkAndQualifyReferral()이 나중에 올림)
  const referralCode = (body.referral_code || '').trim().toUpperCase();
  if (referralCode) {
    try {
      const owner = await env.DB.prepare('SELECT owner_email FROM referral_codes WHERE code = ?').bind(referralCode).first();
      if (owner && owner.owner_email !== email) {
        await env.DB.prepare(
          'INSERT INTO referral_signups (code, owner_email, referred_email, reward_krw, qualified, created_at) VALUES (?, ?, ?, ?, 0, ?)'
        ).bind(referralCode, owner.owner_email, email, REFERRAL_REWARD_KRW, Date.now()).run();
      }
    } catch (e) {
      // referred_email UNIQUE 위반 등 — 가입 자체는 막지 않고 적립만 건너뜀
    }
  }

  const token = await createGeneralSession(env, email);
  return json({ ok: true, email }, 200, { 'Set-Cookie': generalSessionCookie(token) });
}

async function handleGeneralLogin(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return json({ ok: false, error: '이메일과 비밀번호를 입력해주세요.' }, 400);

  const member = await env.DB.prepare('SELECT * FROM general_members WHERE email = ?').bind(email).first();
  const { hash } = member ? await hashPassword(password, member.salt) : { hash: null };

  if (!member || hash !== member.password_hash) {
    return json({ ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  const token = await createGeneralSession(env, email);
  return json({ ok: true, email, nickname: member.nickname || null }, 200, { 'Set-Cookie': generalSessionCookie(token) });
}

async function handleGeneralMe(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false });
  const member = await env.DB.prepare(
    'SELECT nickname, gate_uid, trading_volume, ranking_opt_in FROM general_members WHERE email = ?'
  ).bind(email).first();
  return json({
    ok: true,
    email,
    nickname: (member && member.nickname) || null,
    gate_uid: (member && member.gate_uid) || null,
    has_gate_api: !!(member && member.gate_uid),
    trading_volume: (member && member.trading_volume) || 0,
    ranking_opt_in: !!(member && member.ranking_opt_in),
  });
}

async function handleGeneralLogout(request, env) {
  const token = getCookie(request, GENERAL_SESSION_COOKIE);
  if (token && env.DB) await env.DB.prepare('DELETE FROM general_sessions WHERE token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(GENERAL_SESSION_COOKIE) });
}

async function handleGeneralChangePassword(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const current = body.currentPassword || '';
  const next = body.newPassword || '';
  if (next.length < 8) return json({ ok: false, error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);

  const member = await env.DB.prepare('SELECT * FROM general_members WHERE email = ?').bind(email).first();
  const { hash: currentHash } = await hashPassword(current, member.salt);
  if (currentHash !== member.password_hash) return json({ ok: false, error: '현재 비밀번호가 올바르지 않습니다.' }, 401);

  const { salt, hash } = await hashPassword(next);
  await env.DB.prepare('UPDATE general_members SET salt = ?, password_hash = ? WHERE email = ?').bind(salt, hash, email).run();
  return json({ ok: true });
}

async function handleGeneralSetNickname(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const nickname = (body.nickname || '').trim();
  if (nickname.length < 1 || nickname.length > 20) {
    return json({ ok: false, error: '닉네임은 1~20자로 입력해주세요.' }, 400);
  }

  const dup = await env.DB.prepare('SELECT email FROM general_members WHERE nickname = ? AND email != ?').bind(nickname, email).first();
  if (dup) return json({ ok: false, error: '이미 사용 중인 닉네임입니다.' }, 409);

  await env.DB.prepare('UPDATE general_members SET nickname = ? WHERE email = ?').bind(nickname, email).run();
  return json({ ok: true, nickname });
}

// Gate.io Read-Only API 키 연동 — 회원 본인 소유 확인 + (베타) 계좌 조회용.
// 절대 출금/거래 권한을 요구하지 않음 — Read-Only 권한만 있는 키를 쓰도록 프론트에서 안내함.
// /account/detail 응답의 user_id로 실제 소유한 UID를 서버가 직접 확인함 (UID를 직접 입력받지 않음).
async function handleGeneralConnectGateApi(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const apiKey = (body.api_key || '').trim();
  const apiSecret = (body.api_secret || '').trim();
  if (!apiKey || !apiSecret) return json({ ok: false, error: 'API 키와 시크릿을 모두 입력해주세요.' }, 400);

  let detail;
  try {
    detail = await gateAccountDetail(apiKey, apiSecret);
  } catch (err) {
    return json({ ok: false, error: err.message || 'Gate.io API 연결에 실패했습니다. 키를 다시 확인해주세요.', detail: err.detail }, err.status || 400);
  }

  const gateUid = detail && (detail.user_id != null ? String(detail.user_id) : (detail.uid != null ? String(detail.uid) : null));
  if (!gateUid) {
    return json({ ok: false, error: 'API는 연결됐지만 UID를 확인하지 못했습니다. 베타 진단(계좌 정보 원본 조회)으로 응답을 확인해주세요.' }, 502);
  }

  try {
    await env.DB.prepare(
      'UPDATE general_members SET gate_uid = ?, gate_api_key = ?, gate_api_secret = ? WHERE email = ?'
    ).bind(gateUid, apiKey, apiSecret, email).run();
  } catch (e) {
    return json({ ok: false, error: '이미 다른 계정에 연동된 UID입니다.' }, 409);
  }

  return json({ ok: true, gate_uid: gateUid });
}

async function handleGeneralDisconnectGateApi(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  await env.DB.prepare(
    'UPDATE general_members SET gate_uid = NULL, gate_api_key = NULL, gate_api_secret = NULL, ranking_opt_in = 0 WHERE email = ?'
  ).bind(email).run();
  return json({ ok: true });
}

// 연동된 API 키로 계좌 정보를 원본 그대로 보여주는 베타 진단용 — 거래량 자동 계산 로직은 아직 미확정
async function handleGeneralGateAccountRaw(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const member = await env.DB.prepare('SELECT gate_api_key, gate_api_secret FROM general_members WHERE email = ?').bind(email).first();
  if (!member || !member.gate_api_key) return json({ ok: false, error: 'Gate.io API가 연동되어 있지 않습니다.' }, 400);

  try {
    const detail = await gateAccountDetail(member.gate_api_key, member.gate_api_secret);
    return json({ ok: true, data: detail });
  } catch (err) {
    return json({ ok: false, error: err.message || 'Gate.io 호출 중 오류', detail: err.detail }, err.status || 500);
  }
}

async function gateAccountDetail(apiKey, apiSecret) {
  const host = 'https://api.gateio.ws';
  const prefix = '/api/v4';
  const path = '/account/detail';
  const method = 'GET';
  const query = '';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = await sha512Hex('');
  const signStr = `${method}\n${prefix}${path}\n${query}\n${bodyHash}\n${timestamp}`;
  const sign = await hmacSha512Hex(apiSecret, signStr);

  const res = await fetch(`${host}${prefix}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', KEY: apiKey, SIGN: sign, Timestamp: timestamp },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Gate.io API 오류');
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

// ───────────────────────── 랭킹 (선택 참여, 일반 계정 전용) ─────────────────────────

async function handleGeneralRankingOptIn(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const optIn = !!body.opt_in;

  if (optIn) {
    const member = await env.DB.prepare('SELECT gate_uid FROM general_members WHERE email = ?').bind(email).first();
    if (!member || !member.gate_uid) {
      return json({ ok: false, error: '랭킹 시스템에 참여하려면 먼저 Gate.io Read-Only API를 연동해주세요.' }, 400);
    }
  }

  await env.DB.prepare('UPDATE general_members SET ranking_opt_in = ? WHERE email = ?').bind(optIn ? 1 : 0, email).run();
  return json({ ok: true, ranking_opt_in: optIn });
}

async function handleGeneralRankings(request, env) {
  const email = await getGeneralEmail(request, env);
  const rows = await env.DB.prepare(
    'SELECT email, nickname, trading_volume FROM general_members WHERE ranking_opt_in = 1 AND trading_volume > 0 ORDER BY trading_volume DESC LIMIT 50'
  ).all();
  const rankings = (rows.results || []).map((r, i) => ({
    rank: i + 1,
    label: r.nickname || maskEmail(r.email),
    trading_volume: r.trading_volume,
    is_me: r.email === email,
  }));
  return json({ ok: true, rankings });
}

function maskEmail(email) {
  const at = email.indexOf('@');
  if (at <= 1) return '****' + email.slice(at);
  return email.slice(0, 2) + '***' + email.slice(at);
}

// ───────────────────────── 추천인 코드 (일반 계정 전용) ─────────────────────────
const REFERRAL_REWARD_KRW = 20000;
const REFERRAL_MIN_REFERRALS_TO_WITHDRAW = 5;
const REFERRAL_MIN_WITHDRAW_KRW = 100000;
// 코드 발급 자체는 제한 없음. 이 값은 "추천받은 사람"의 거래량이 이 이상이어야
// 그 추천 건이 확정(적립)되는 기준 — 발급자 자격 조건이 아님.
const REFERRAL_QUALIFY_VOLUME_USD = 100000;

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function handleReferralIssueCode(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const existing = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_email = ?').bind(email).first();
  if (existing) return json({ ok: true, code: existing.code });

  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    try {
      await env.DB.prepare('INSERT INTO referral_codes (code, owner_email, created_at) VALUES (?, ?, ?)').bind(code, email, Date.now()).run();
      return json({ ok: true, code });
    } catch (e) {
      // 코드 중복이면 재시도
    }
  }
  return json({ ok: false, error: '코드 발급에 실패했습니다. 다시 시도해주세요.' }, 500);
}

async function handleReferralMe(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_email = ?').bind(email).first();
  const code = codeRow ? codeRow.code : null;

  let referredCount = 0, pendingCount = 0, totalEarned = 0, withdrawals = [], availableKrw = 0;
  if (code) {
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) AS c, COALESCE(SUM(reward_krw),0) AS total FROM referral_signups WHERE owner_email = ? AND qualified = 1'
    ).bind(email).first();
    referredCount = countRow ? countRow.c : 0;
    totalEarned = countRow ? countRow.total : 0;

    const pendingRow = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM referral_signups WHERE owner_email = ? AND qualified = 0'
    ).bind(email).first();
    pendingCount = pendingRow ? pendingRow.c : 0;

    const wRows = await env.DB.prepare(
      'SELECT id, telegram_id, wallet_address, amount_krw, status, created_at FROM referral_withdrawals WHERE owner_email = ? ORDER BY id DESC'
    ).bind(email).all();
    withdrawals = wRows.results || [];

    const reservedRow = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount_krw),0) AS reserved FROM referral_withdrawals WHERE owner_email = ? AND status IN ('pending','approved','paid')"
    ).bind(email).first();
    availableKrw = totalEarned - (reservedRow ? reservedRow.reserved : 0);
  }

  return json({
    ok: true,
    code,
    referred_count: referredCount,
    pending_count: pendingCount,
    qualify_volume_required: REFERRAL_QUALIFY_VOLUME_USD,
    total_earned_krw: totalEarned,
    available_krw: availableKrw,
    min_referrals_to_withdraw: REFERRAL_MIN_REFERRALS_TO_WITHDRAW,
    min_withdraw_krw: REFERRAL_MIN_WITHDRAW_KRW,
    withdrawals,
  });
}

async function handleReferralWithdraw(request, env) {
  const email = await getGeneralEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_email = ?').bind(email).first();
  if (!codeRow) return json({ ok: false, error: '추천인 코드를 먼저 발급해주세요.' }, 403);

  const body = await safeJson(request);
  const telegramId = (body.telegram_id || '').trim();
  const walletAddress = (body.wallet_address || '').trim();
  const amount = Number(body.amount_krw);

  if (!telegramId) return json({ ok: false, error: '텔레그램 아이디를 입력해주세요.' }, 400);
  if (!walletAddress) return json({ ok: false, error: 'USDT(TRC20) 지갑 주소를 입력해주세요.' }, 400);
  if (!amount || amount < REFERRAL_MIN_WITHDRAW_KRW) {
    return json({ ok: false, error: `최소 출금 금액은 ${REFERRAL_MIN_WITHDRAW_KRW.toLocaleString()}원입니다.` }, 400);
  }

  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS c, COALESCE(SUM(reward_krw),0) AS total FROM referral_signups WHERE owner_email = ? AND qualified = 1'
  ).bind(email).first();
  const referredCount = countRow ? countRow.c : 0;
  if (referredCount < REFERRAL_MIN_REFERRALS_TO_WITHDRAW) {
    return json({ ok: false, error: `추천인 코드로 가입한 회원이 최소 ${REFERRAL_MIN_REFERRALS_TO_WITHDRAW}명 이상이어야 출금 신청이 가능합니다. (현재 ${referredCount}명)` }, 403);
  }

  const reservedRow = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount_krw),0) AS reserved FROM referral_withdrawals WHERE owner_email = ? AND status IN ('pending','approved','paid')"
  ).bind(email).first();
  const available = (countRow ? countRow.total : 0) - (reservedRow ? reservedRow.reserved : 0);
  if (amount > available) {
    return json({ ok: false, error: `출금 가능 금액(${available.toLocaleString()}원)을 초과했습니다.` }, 400);
  }

  const result = await env.DB.prepare(
    'INSERT INTO referral_withdrawals (owner_email, telegram_id, wallet_address, amount_krw, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(email, telegramId, walletAddress, amount, 'pending', Date.now()).run();

  await notifyAdminTelegram(env,
    `📩 추천인 출금 신청\n이메일: ${email}\n텔레그램: ${telegramId}\n지갑(USDT-TRC20): ${walletAddress}\n금액: ${amount.toLocaleString()}원\n추천 가입자: ${referredCount}명\n\nadmin.html에서 확인 후 처리해주세요.`
  );

  return json({ ok: true, id: result.meta.last_row_id });
}

// 공개: 지급 완료된 출금 내역을 트랜잭션 피드처럼 보여줌 (닉네임/금액 마스킹, 실시간 신뢰용)
async function handleReferralRecentWithdrawals(request, env) {
  const rows = await env.DB.prepare(
    `SELECT referral_withdrawals.amount_krw, referral_withdrawals.paid_at, referral_withdrawals.created_at,
            general_members.nickname, general_members.email
     FROM referral_withdrawals LEFT JOIN general_members ON general_members.email = referral_withdrawals.owner_email
     WHERE referral_withdrawals.status = 'paid'
     ORDER BY COALESCE(referral_withdrawals.paid_at, referral_withdrawals.created_at) DESC LIMIT 20`
  ).all();
  const feed = (rows.results || []).map((r) => ({
    label: maskNickname(r.nickname || maskEmail(r.email || '익명')),
    amount_label: maskAmount(r.amount_krw),
    at: r.paid_at || r.created_at,
  }));
  return json({ ok: true, feed });
}

function maskNickname(name) {
  if (!name) return '익명';
  if (name.length <= 1) return name + '*';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function maskAmount(amount) {
  const str = String(amount);
  if (str.length <= 2) return str.replace(/./g, '*') + '원';
  return str[0] + '*'.repeat(str.length - 1) + '원';
}

async function notifyAdminTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_ADMIN_CHAT_ID, text }),
    });
  } catch (e) {
    // 텔레그램 알림이 실패해도 출금 신청 자체는 이미 저장돼있으니 무시
  }
}

// ───────────────────────── 관리자: 일반 계정 거래량 / 추천인 관리 ─────────────────────────

// 이메일 또는 연동된 Gate UID로 일반 계정 검색
async function handleAdminFindGeneralMember(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim();
  if (!query) return json({ ok: false, error: '이메일 또는 UID를 입력해주세요.' }, 400);

  const member = await env.DB.prepare(
    'SELECT email, nickname, gate_uid, trading_volume, ranking_opt_in, created_at FROM general_members WHERE email = ? OR gate_uid = ?'
  ).bind(query.toLowerCase(), query).first();
  if (!member) return json({ ok: true, found: false });

  const codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_email = ?').bind(member.email).first();

  return json({
    ok: true,
    found: true,
    email: member.email,
    nickname: member.nickname || null,
    gate_uid: member.gate_uid || null,
    trading_volume: member.trading_volume || 0,
    ranking_opt_in: !!member.ranking_opt_in,
    referral_code: codeRow ? codeRow.code : null,
    created_at: member.created_at,
  });
}

async function handleAdminSetGeneralVolume(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const email = (body.email || '').trim().toLowerCase();
  const volume = Number(body.volume);
  if (!email) return json({ ok: false, error: '이메일을 입력해주세요.' }, 400);
  if (!Number.isFinite(volume) || volume < 0) return json({ ok: false, error: '거래량 값이 올바르지 않습니다.' }, 400);

  const member = await env.DB.prepare('SELECT id FROM general_members WHERE email = ?').bind(email).first();
  if (!member) return json({ ok: false, error: '해당 이메일로 가입된 계정이 없습니다.' }, 404);

  await env.DB.prepare('UPDATE general_members SET trading_volume = ? WHERE email = ?').bind(volume, email).run();
  await checkAndQualifyReferral(env, email, volume);
  return json({ ok: true });
}

// 추천받은 사람(email)의 거래량이 기준을 넘으면 그 추천 건을 확정(qualified) 처리 — 한 번 확정되면 되돌리지 않음
async function checkAndQualifyReferral(env, email, volume) {
  if (volume < REFERRAL_QUALIFY_VOLUME_USD) return;
  await env.DB.prepare(
    "UPDATE referral_signups SET qualified = 1 WHERE referred_email = ? AND qualified = 0"
  ).bind(email).run();
}

async function handleAdminResetGeneralVolumes(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  await env.DB.prepare('UPDATE general_members SET trading_volume = 0').run();
  return json({ ok: true });
}

// 추천인 코드를 발급한 사람들 전체 현황 — 관리자가 한 화면에서 실적 관리
async function handleAdminReferralIssuers(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const rows = await env.DB.prepare(
    `SELECT
      referral_codes.code,
      referral_codes.owner_email,
      referral_codes.created_at AS issued_at,
      general_members.nickname,
      general_members.gate_uid,
      (SELECT COUNT(*) FROM referral_signups WHERE referral_signups.owner_email = referral_codes.owner_email AND referral_signups.qualified = 1) AS referred_count,
      (SELECT COUNT(*) FROM referral_signups WHERE referral_signups.owner_email = referral_codes.owner_email AND referral_signups.qualified = 0) AS pending_count,
      (SELECT COALESCE(SUM(reward_krw),0) FROM referral_signups WHERE referral_signups.owner_email = referral_codes.owner_email AND referral_signups.qualified = 1) AS total_earned_krw,
      (SELECT COALESCE(SUM(amount_krw),0) FROM referral_withdrawals WHERE referral_withdrawals.owner_email = referral_codes.owner_email AND referral_withdrawals.status = 'paid') AS total_paid_krw
     FROM referral_codes
     LEFT JOIN general_members ON general_members.email = referral_codes.owner_email
     ORDER BY referred_count DESC, referral_codes.created_at ASC LIMIT 300`
  ).all();

  return json({ ok: true, issuers: rows.results || [] });
}

// Gate.io 파트너 리베이트 API 원본 응답 확인 (베타) — 응답 스키마가 공개 문서화 안 돼있어서
// UID별로 쪼개지는지 전체 합산만 나오는지 실제로 호출해서 눈으로 확인하기 위한 진단용 엔드포인트
async function handleAdminGateRebateRaw(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const KEY = env.GATE_API_KEY;
  const SECRET = env.GATE_API_SECRET;
  if (!KEY || !SECRET) return json({ ok: false, error: '서버에 API 키가 설정되지 않았습니다.' }, 500);

  const host = 'https://api.gateio.ws';
  const prefix = '/api/v4';
  const path = '/rebate/partner/data/aggregated';
  const method = 'GET';
  const query = '';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = await sha512Hex('');
  const signStr = `${method}\n${prefix}${path}\n${query}\n${bodyHash}\n${timestamp}`;
  const sign = await hmacSha512Hex(SECRET, signStr);

  try {
    const res = await fetch(`${host}${prefix}${path}`, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', KEY, SIGN: sign, Timestamp: timestamp },
    });
    const data = await res.json();
    return json({ ok: res.ok, status: res.status, data });
  } catch (e) {
    return json({ ok: false, error: 'Gate.io 호출 중 오류', detail: String(e) }, 500);
  }
}

async function handleAdminListWithdrawals(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  const rows = await env.DB.prepare(
    `SELECT referral_withdrawals.*, general_members.nickname AS owner_nickname
     FROM referral_withdrawals LEFT JOIN general_members ON general_members.email = referral_withdrawals.owner_email
     ORDER BY referral_withdrawals.id DESC LIMIT 200`
  ).all();
  return json({ ok: true, withdrawals: rows.results || [] });
}

async function handleAdminUpdateWithdrawal(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  const body = await safeJson(request);
  const id = Number(body.id);
  const status = body.status;
  const allowed = ['pending', 'approved', 'rejected', 'paid'];
  if (!id || !allowed.includes(status)) return json({ ok: false, error: '잘못된 요청입니다.' }, 400);
  const paidAt = status === 'paid' ? Date.now() : null;
  await env.DB.prepare('UPDATE referral_withdrawals SET status = ?, paid_at = COALESCE(?, paid_at) WHERE id = ?').bind(status, paidAt, id).run();
  return json({ ok: true });
}

// ───────────────────────── 관리자 인증 ─────────────────────────

async function handleAdminLogin(request, env) {
  const body = await safeJson(request);
  const username = body.username || '';
  const password = body.password || '';

  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const now = Date.now();
  const expires = now + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  await env.DB.prepare(
    'INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)'
  ).bind(token, now, expires).run();

  const maxAge = ADMIN_SESSION_HOURS * 60 * 60;
  return json({ ok: true }, 200, {
    'Set-Cookie': `${ADMIN_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
  });
}

async function handleAdminMe(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  return json({ ok: isAdmin });
}

async function handleAdminLogout(request, env) {
  const token = getCookie(request, ADMIN_COOKIE);
  if (token && env.DB) await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(ADMIN_COOKIE) });
}

async function getIsAdmin(request, env) {
  if (!env.DB) return false;
  const token = getCookie(request, ADMIN_COOKIE);
  if (!token) return false;
  const session = await env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first();
  return !!session;
}

async function getMemberUid(request, env) {
  if (!env.DB) return null;
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first();
  return session ? session.uid : null;
}

async function getGeneralEmail(request, env) {
  if (!env.DB) return null;
  const token = getCookie(request, GENERAL_SESSION_COOKIE);
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT * FROM general_sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first();
  return session ? session.email : null;
}

// ───────────────────────── Gate.io 레퍼럴 확인 (공용 로직) ─────────────────────────

async function checkGateReferral(uid, env) {
  const KEY = env.GATE_API_KEY;
  const SECRET = env.GATE_API_SECRET;
  if (!KEY || !SECRET) {
    const err = new Error('서버에 API 키가 설정되지 않았습니다.');
    err.status = 500;
    throw err;
  }

  const host = 'https://api.gateio.ws';
  const prefix = '/api/v4';
  const path = '/rebate/user/sub_relation';
  const method = 'GET';
  const query = `user_id_list=${encodeURIComponent(uid)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const bodyHash = await sha512Hex('');
  const signStr = `${method}\n${prefix}${path}\n${query}\n${bodyHash}\n${timestamp}`;
  const sign = await hmacSha512Hex(SECRET, signStr);

  const gateRes = await fetch(`${host}${prefix}${path}?${query}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', KEY, SIGN: sign, Timestamp: timestamp },
  });

  const data = await gateRes.json();
  if (!gateRes.ok) {
    const err = new Error('Gate.io API 오류');
    err.status = gateRes.status;
    err.detail = data;
    throw err;
  }

  const entry = (data.list || [])[0] || { uid: Number(uid), type: 0 };
  let status = 'not_found';
  let message = '등록되지 않은 UID입니다.';

  if (entry.type === 3) { status = 'direct_referral'; message = '전용 링크로 가입한 회원입니다.'; }
  else if (entry.type === 4) { status = 'indirect_referral'; message = '간접 관계만 확인됩니다. 직접 문의해주세요.'; }
  else if (entry.type === 1 || entry.type === 2) { status = 'agent'; message = '에이전트 계정으로 등록되어 있습니다.'; }
  else if (entry.type === 5) { status = 'not_my_referral'; message = '전용 링크로 가입한 회원이 아닙니다.'; }

  return { uid: entry.uid, type: entry.type, status, message };
}

// ───────────────────────── 스키마 자동 초기화 ─────────────────────────
// D1 콘솔에 schema-console.sql을 붙여넣는 걸 깜빡해도 첫 API 요청에서
// 필요한 테이블을 자동으로 만들어준다 (이미 있으면 아무 것도 하지 않음).

let schemaReady = false;

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_data TEXT,
      thumb_data TEXT,
      min_grade TEXT,
      author_type TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_type TEXT NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS general_members (
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
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS general_sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_codes (
      code TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      referred_email TEXT NOT NULL UNIQUE,
      reward_krw INTEGER NOT NULL,
      qualified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL,
      telegram_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount_krw INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at INTEGER,
      created_at INTEGER NOT NULL
    )`),
  ]);

  // 예전 DB에 없던 컬럼들 보강 (이미 있으면 무시)
  try { await env.DB.prepare('ALTER TABLE posts ADD COLUMN image_data TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE users ADD COLUMN nickname TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE posts ADD COLUMN thumb_data TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE posts ADD COLUMN min_grade TEXT').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE referral_withdrawals ADD COLUMN paid_at INTEGER').run(); } catch (e) {}

  // 지난 세션에서 시도했던 "스터디룸 입장 관리자 승인" + users.trading_volume은 이번에
  // 완전히 되돌림(계정 분리 설계로 재설계) — 더는 쓰지 않는 컬럼이라 제거를 시도한다.
  // (D1이 DROP COLUMN을 지원 안 하거나 컬럼이 이미 없으면 그냥 무시됨, 앱 동작엔 영향 없음)
  try { await env.DB.prepare('ALTER TABLE users DROP COLUMN study_room_approved').run(); } catch (e) {}
  try { await env.DB.prepare('ALTER TABLE users DROP COLUMN trading_volume').run(); } catch (e) {}

  // referral_codes/referral_signups/referral_withdrawals는 원래 스터디룸 UID 소유였는데
  // 이번에 일반 계정(이메일) 소유로 완전히 이전됨 — 기존 실적은 초기화하기로 했으므로
  // (컬럼명이 달라 그대로 이어붙일 수 없음) 예전 스키마가 남아있으면 통째로 지우고 새로 만든다.
  try {
    const legacyCheck = await env.DB.prepare('SELECT owner_uid FROM referral_codes LIMIT 1').first().catch(() => undefined);
    if (legacyCheck !== undefined) {
      await env.DB.batch([
        env.DB.prepare('DROP TABLE IF EXISTS referral_withdrawals'),
        env.DB.prepare('DROP TABLE IF EXISTS referral_signups'),
        env.DB.prepare('DROP TABLE IF EXISTS referral_codes'),
      ]);
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE referral_codes (
          code TEXT PRIMARY KEY,
          owner_email TEXT NOT NULL UNIQUE,
          created_at INTEGER NOT NULL
        )`),
        env.DB.prepare(`CREATE TABLE referral_signups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          referred_email TEXT NOT NULL UNIQUE,
          reward_krw INTEGER NOT NULL,
          qualified INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )`),
        env.DB.prepare(`CREATE TABLE referral_withdrawals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_email TEXT NOT NULL,
          telegram_id TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          amount_krw INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          paid_at INTEGER,
          created_at INTEGER NOT NULL
        )`),
      ]);
    }
  } catch (e) {
    // 예전 테이블이 없거나 이미 새 스키마면 여기로 옴 — 무시
  }

  schemaReady = true;
}

// ───────────────────────── 세션 / 쿠키 ─────────────────────────

async function createSession(env, uid) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const now = Date.now();
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    'INSERT INTO sessions (token, uid, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, uid, now, expires).run();
  return token;
}

async function createGeneralSession(env, email) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const now = Date.now();
  const expires = now + GENERAL_SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    'INSERT INTO general_sessions (token, email, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, email, now, expires).run();
  return token;
}

function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
function generalSessionCookie(token) {
  const maxAge = GENERAL_SESSION_DAYS * 24 * 60 * 60;
  return `${GENERAL_SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : null;
}

// ───────────────────────── 비밀번호 해시 (PBKDF2-SHA256) ─────────────────────────

async function hashPassword(password, existingSaltHex) {
  const enc = new TextEncoder();
  const salt = existingSaltHex ? hexToBytes(existingSaltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return { salt: toHex(salt), hash: toHex(bits) };
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// ───────────────────────── 유틸 ─────────────────────────

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
}
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', ...extraHeaders },
  });
}
async function hmacSha512Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(sig);
}
async function sha512Hex(message) {
  const hash = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(message));
  return toHex(hash);
}
function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
