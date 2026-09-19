// Cloudflare Worker (with static assets + D1)
//
// 회원 API:
//   GET  /api/check-uid?uid=...      Gate.io 레퍼럴 확인만 (계정 생성 없음)
//   POST /api/signup                 회원가입 (Gate.io 검증 후 계정 생성)
//   POST /api/login                  회원 로그인
//   GET  /api/me                     로그인 상태 확인 (닉네임 포함)
//   POST /api/logout                 로그아웃
//   POST /api/account/change-password  비밀번호 변경
//   POST /api/account/nickname       닉네임 설정
//
// 게시판 API:
//   GET  /api/posts?category=notice|lecture|question|profit
//   GET  /api/posts/detail?id=...
//   POST /api/posts                  글쓰기 (notice/lecture=관리자만, question/profit=회원+관리자)
//   POST /api/posts/delete           글 삭제 (관리자만)
//   POST /api/comments               댓글 작성 (회원 또는 관리자)
//
// 등급/거래량 API:
//   GET  /api/rankings                거래량 랭킹 목록 (로그인 필요)
//
// 추천인 API:
//   POST /api/referral/issue-code     내 추천인 코드 발급 (거래량 $100,000 이상만)
//   GET  /api/referral/me             내 추천인 현황 (코드/가입자수/적립액/출금내역)
//   POST /api/referral/withdraw       출금 신청 (텔레그램ID + USDT-TRC20 주소 + 금액)
//
// 관리자 API:
//   POST /api/admin/login            아이디/비번 확인
//   GET  /api/admin/me
//   POST /api/admin/logout
//   GET  /api/admin/find-user?uid=...  회원 UID 검색 (비밀번호 재설정/거래량 설정 전 조회용)
//   POST /api/admin/reset-password   회원 비밀번호 재설정 (newPassword 생략 시 임시 비밀번호 자동 생성)
//   POST /api/admin/set-volume       회원 거래량 수동 입력
//   POST /api/admin/reset-volumes    전체 거래량 0으로 초기화 (랭킹 리셋)
//   GET  /api/admin/gate-rebate-raw  Gate.io 파트너 리베이트 API 원본 응답 확인 (베타, 스키마 미확정)
//   GET  /api/admin/referral/withdrawals   출금 신청 목록
//   POST /api/admin/referral/withdrawals/update  출금 신청 상태 변경
//
// 필요한 환경변수(Settings > Variables and Secrets):
//   GATE_API_KEY, GATE_API_SECRET   Gate.io API
//   ADMIN_USERNAME, ADMIN_PASSWORD  관리자 로그인
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID  (선택) 출금 신청 시 텔레그램 알림 — 없으면 알림만 생략, 신청 자체는 정상 저장됨
// 필요한 바인딩: D1 데이터베이스 → env.DB

const SESSION_COOKIE = 'session';
const ADMIN_COOKIE = 'admin_session';
const SESSION_DAYS = 7;
const ADMIN_SESSION_HOURS = 12;

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

      if (path === '/api/rankings' && method === 'GET') return await handleRankings(request, env);
      if (path === '/api/referral/issue-code' && method === 'POST') return await handleReferralIssueCode(request, env);
      if (path === '/api/referral/me' && method === 'GET') return await handleReferralMe(request, env);
      if (path === '/api/referral/withdraw' && method === 'POST') return await handleReferralWithdraw(request, env);

      if (path === '/api/admin/set-volume' && method === 'POST') return await handleAdminSetVolume(request, env);
      if (path === '/api/admin/reset-volumes' && method === 'POST') return await handleAdminResetVolumes(request, env);
      if (path === '/api/admin/gate-rebate-raw' && method === 'GET') return await handleAdminGateRebateRaw(request, env);
      if (path === '/api/admin/referral/withdrawals' && method === 'GET') return await handleAdminListWithdrawals(request, env);
      if (path === '/api/admin/referral/withdrawals/update' && method === 'POST') return await handleAdminUpdateWithdrawal(request, env);
    } catch (err) {
      return json({ ok: false, error: '서버 오류가 발생했습니다.', detail: String(err) }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};

// ───────────────────────── 회원 인증 ─────────────────────────

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

  // 추천인 코드로 가입한 경우, 코드 발급자에게 적립 (코드가 잘못됐거나 자기 자신이어도 가입 자체는 계속 진행)
  const referralCode = (body.referral_code || '').trim().toUpperCase();
  if (referralCode) {
    try {
      const owner = await env.DB.prepare('SELECT owner_uid FROM referral_codes WHERE code = ?').bind(referralCode).first();
      if (owner && owner.owner_uid !== uid) {
        await env.DB.prepare(
          'INSERT INTO referral_signups (code, owner_uid, referred_uid, reward_krw, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(referralCode, owner.owner_uid, uid, REFERRAL_REWARD_KRW, Date.now()).run();
      }
    } catch (e) {
      // referred_uid UNIQUE 위반 등 — 가입 자체는 막지 않고 적립만 건너뜀
    }
  }

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
  const user = await env.DB.prepare('SELECT nickname, trading_volume FROM users WHERE uid = ?').bind(uid).first();
  const volume = (user && user.trading_volume) || 0;
  const activity = await getMemberActivity(env, uid);
  const grade = gradeForActivity(activity);
  const rankRow = await env.DB.prepare('SELECT COUNT(*) AS c FROM users WHERE trading_volume > ?').bind(volume).first();
  return json({
    ok: true,
    uid,
    nickname: (user && user.nickname) || null,
    trading_volume: volume,
    rank: (rankRow ? rankRow.c : 0) + 1,
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

  const user = await env.DB.prepare('SELECT uid, nickname, trading_volume, created_at FROM users WHERE uid = ?').bind(uid).first();
  if (!user) return json({ ok: true, found: false });
  return json({ ok: true, found: true, uid: user.uid, nickname: user.nickname || null, trading_volume: user.trading_volume || 0, created_at: user.created_at });
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

// ───────────────────────── 추천인 코드 ─────────────────────────
const REFERRAL_REWARD_KRW = 20000;
const REFERRAL_MIN_REFERRALS_TO_WITHDRAW = 5;
const REFERRAL_MIN_WITHDRAW_KRW = 100000;
const REFERRAL_ELIGIBLE_VOLUME_USD = 100000;

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
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
  const totalNotices = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'notice'").first();
  const totalLectures = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'lecture'").first();
  const totalQuestions = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'question'").first();
  const totalProfit = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'profit'").first();
  const totalComments = await env.DB.prepare('SELECT COUNT(*) AS c FROM comments').first();

  return json({
    ok: true,
    members: totalUsers.c,
    notices: totalNotices.c,
    lectures: totalLectures.c,
    questions: totalQuestions.c,
    profit: totalProfit.c,
    comments: totalComments.c,
  });
}

// ───────────────────────── 거래량 랭킹 ─────────────────────────

async function handleRankings(request, env) {
  const uid = await getMemberUid(request, env);
  const isAdmin = await getIsAdmin(request, env);
  if (!uid && !isAdmin) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const rows = await env.DB.prepare(
    'SELECT uid, nickname, trading_volume FROM users WHERE trading_volume > 0 ORDER BY trading_volume DESC LIMIT 50'
  ).all();
  const rankings = (rows.results || []).map((r, i) => ({
    rank: i + 1,
    label: r.nickname || ('UID ****' + String(r.uid).slice(-4)),
    trading_volume: r.trading_volume,
    is_me: r.uid === uid,
  }));
  return json({ ok: true, rankings });
}

// ───────────────────────── 추천인 코드 ─────────────────────────

async function handleReferralIssueCode(request, env) {
  const uid = await getMemberUid(request, env);
  if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const user = await env.DB.prepare('SELECT trading_volume FROM users WHERE uid = ?').bind(uid).first();
  const volume = (user && user.trading_volume) || 0;
  if (volume < REFERRAL_ELIGIBLE_VOLUME_USD) {
    return json({ ok: false, error: `추천인 코드는 거래량 $${REFERRAL_ELIGIBLE_VOLUME_USD.toLocaleString()} 이상부터 발급할 수 있습니다. (현재 $${volume.toLocaleString()})` }, 403);
  }

  const existing = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_uid = ?').bind(uid).first();
  if (existing) return json({ ok: true, code: existing.code });

  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    try {
      await env.DB.prepare('INSERT INTO referral_codes (code, owner_uid, created_at) VALUES (?, ?, ?)').bind(code, uid, Date.now()).run();
      return json({ ok: true, code });
    } catch (e) {
      // 코드 중복이면 재시도
    }
  }
  return json({ ok: false, error: '코드 발급에 실패했습니다. 다시 시도해주세요.' }, 500);
}

async function handleReferralMe(request, env) {
  const uid = await getMemberUid(request, env);
  if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const user = await env.DB.prepare('SELECT trading_volume FROM users WHERE uid = ?').bind(uid).first();
  const volume = (user && user.trading_volume) || 0;
  const eligible = volume >= REFERRAL_ELIGIBLE_VOLUME_USD;

  const codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_uid = ?').bind(uid).first();
  const code = codeRow ? codeRow.code : null;

  let referredCount = 0, totalEarned = 0, withdrawals = [], availableKrw = 0;
  if (code) {
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) AS c, COALESCE(SUM(reward_krw),0) AS total FROM referral_signups WHERE owner_uid = ?'
    ).bind(uid).first();
    referredCount = countRow ? countRow.c : 0;
    totalEarned = countRow ? countRow.total : 0;

    const wRows = await env.DB.prepare(
      'SELECT id, telegram_id, wallet_address, amount_krw, status, created_at FROM referral_withdrawals WHERE owner_uid = ? ORDER BY id DESC'
    ).bind(uid).all();
    withdrawals = wRows.results || [];

    const reservedRow = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount_krw),0) AS reserved FROM referral_withdrawals WHERE owner_uid = ? AND status IN ('pending','approved','paid')"
    ).bind(uid).first();
    availableKrw = totalEarned - (reservedRow ? reservedRow.reserved : 0);
  }

  return json({
    ok: true,
    trading_volume: volume,
    eligible,
    eligible_volume_required: REFERRAL_ELIGIBLE_VOLUME_USD,
    code,
    referred_count: referredCount,
    total_earned_krw: totalEarned,
    available_krw: availableKrw,
    min_referrals_to_withdraw: REFERRAL_MIN_REFERRALS_TO_WITHDRAW,
    min_withdraw_krw: REFERRAL_MIN_WITHDRAW_KRW,
    withdrawals,
  });
}

async function handleReferralWithdraw(request, env) {
  const uid = await getMemberUid(request, env);
  if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_uid = ?').bind(uid).first();
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
    'SELECT COUNT(*) AS c, COALESCE(SUM(reward_krw),0) AS total FROM referral_signups WHERE owner_uid = ?'
  ).bind(uid).first();
  const referredCount = countRow ? countRow.c : 0;
  if (referredCount < REFERRAL_MIN_REFERRALS_TO_WITHDRAW) {
    return json({ ok: false, error: `추천인 코드로 가입한 회원이 최소 ${REFERRAL_MIN_REFERRALS_TO_WITHDRAW}명 이상이어야 출금 신청이 가능합니다. (현재 ${referredCount}명)` }, 403);
  }

  const reservedRow = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount_krw),0) AS reserved FROM referral_withdrawals WHERE owner_uid = ? AND status IN ('pending','approved','paid')"
  ).bind(uid).first();
  const available = (countRow ? countRow.total : 0) - (reservedRow ? reservedRow.reserved : 0);
  if (amount > available) {
    return json({ ok: false, error: `출금 가능 금액(${available.toLocaleString()}원)을 초과했습니다.` }, 400);
  }

  const result = await env.DB.prepare(
    'INSERT INTO referral_withdrawals (owner_uid, telegram_id, wallet_address, amount_krw, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(uid, telegramId, walletAddress, amount, 'pending', Date.now()).run();

  await notifyAdminTelegram(env,
    `📩 추천인 출금 신청\nUID: ${uid}\n텔레그램: ${telegramId}\n지갑(USDT-TRC20): ${walletAddress}\n금액: ${amount.toLocaleString()}원\n추천 가입자: ${referredCount}명\n\nadmin.html에서 확인 후 처리해주세요.`
  );

  return json({ ok: true, id: result.meta.last_row_id });
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

// ───────────────────────── 관리자: 거래량 / 출금 관리 ─────────────────────────

async function handleAdminSetVolume(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  const volume = Number(body.volume);
  if (!uid) return json({ ok: false, error: 'UID를 입력해주세요.' }, 400);
  if (!Number.isFinite(volume) || volume < 0) return json({ ok: false, error: '거래량 값이 올바르지 않습니다.' }, 400);

  const user = await env.DB.prepare('SELECT id FROM users WHERE uid = ?').bind(uid).first();
  if (!user) return json({ ok: false, error: '해당 UID로 가입된 계정이 없습니다.' }, 404);

  await env.DB.prepare('UPDATE users SET trading_volume = ? WHERE uid = ?').bind(volume, uid).run();
  return json({ ok: true });
}

async function handleAdminResetVolumes(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  await env.DB.prepare('UPDATE users SET trading_volume = 0').run();
  return json({ ok: true });
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
    `SELECT referral_withdrawals.*, users.nickname AS owner_nickname
     FROM referral_withdrawals LEFT JOIN users ON users.uid = referral_withdrawals.owner_uid
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
  await env.DB.prepare('UPDATE referral_withdrawals SET status = ? WHERE id = ?').bind(status, id).run();
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
      trading_volume REAL NOT NULL DEFAULT 0,
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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_codes (
      code TEXT PRIMARY KEY,
      owner_uid TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      owner_uid TEXT NOT NULL,
      referred_uid TEXT NOT NULL UNIQUE,
      reward_krw INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_uid TEXT NOT NULL,
      telegram_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      amount_krw INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )`),
  ]);
  // 예전 DB에 없던 컬럼들 보강 (이미 있으면 무시)
  try {
    await env.DB.prepare('ALTER TABLE posts ADD COLUMN image_data TEXT').run();
  } catch (e) {
    // 컬럼이 이미 있으면 여기로 오는 게 정상
  }
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN nickname TEXT').run();
  } catch (e) {
    // 컬럼이 이미 있으면 여기로 오는 게 정상
  }
  try {
    await env.DB.prepare('ALTER TABLE posts ADD COLUMN thumb_data TEXT').run();
  } catch (e) {
    // 컬럼이 이미 있으면 여기로 오는 게 정상
  }
  try {
    await env.DB.prepare('ALTER TABLE posts ADD COLUMN min_grade TEXT').run();
  } catch (e) {
    // 컬럼이 이미 있으면 여기로 오는 게 정상
  }
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN trading_volume REAL NOT NULL DEFAULT 0').run();
  } catch (e) {
    // 컬럼이 이미 있으면 여기로 오는 게 정상
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

function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
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
