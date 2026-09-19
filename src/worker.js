// Cloudflare Worker (with static assets + D1)
//
// ⚠️ 계정은 단일 시스템 — 이메일+비밀번호로 가입 (2026-09-19 5단계에서 계정 통합).
//    가입 자체는 누구나 동일하게 하고, "스터디룸 접근 권한"과 "추천인 파트너 권한"은
//    각각 계정 안에서 별도로 얻는 자격이다:
//      - 스터디룸: "내 정보"에서 Gate UID를 등록하면(전용 링크 직속 가입자인지 즉시 검증)
//        자동으로 접근 가능해짐. UID는 계정당 1개만 등록 가능 (UNIQUE).
//      - 추천인 파트너: referral.html에서 "파트너 신청하기" → 지갑주소/텔레그램/활동계획/기타사항
//        제출 → 관리자가 admin.html에서 승인해야 추천인 코드 발급/대시보드 이용 가능.
//
// 회원 API (members 테이블, session 쿠키):
//   POST /api/signup                 이메일+비밀번호로 가입 (referral_code 있으면 referral_signups에 기록, qualified=0으로 시작)
//   POST /api/login
//   GET  /api/me                     로그인 상태 + uid/닉네임/등급/파트너 상태/API 연동 여부/내가 가입할 때 쓴 추천인 코드 등
//   POST /api/logout
//   POST /api/account/change-password
//   POST /api/account/nickname
//   GET  /api/account/my-questions       내가 쓴 질문 중 관리자 답변 달린 개수 (질문 탭 알림 배지용)
//   POST /api/account/register-uid       Gate UID 등록 (전용 링크 직속 가입자 확인 → 스터디룸 접근 허용)
//   POST /api/account/connect-gate-api   Gate.io Read-Only API 키 연동 (랭킹용, 소유 확인은 /account/detail로)
//   POST /api/account/disconnect-gate-api
//   GET  /api/account/gate-account-raw   연동된 키로 계좌 정보 원본 조회 (베타, 진단용)
//   POST /api/account/ranking-opt-in     랭킹 시스템 참여/탈퇴 (참여하려면 API 연동 필요)
//   POST /api/account/sync-volume        연동된 키로 선물 거래내역을 조회해 거래량을 직접 계산/갱신 (베타, 선물거래 읽기 권한 필요)
//
// 게시판 API (Gate UID가 등록된 회원 또는 관리자만 글쓰기/댓글, 목록/상세는 공개):
//   GET  /api/posts?category=notice|briefing|lecture|question|profit
//   GET  /api/posts/detail?id=...
//   POST /api/posts / /api/posts/update / /api/posts/delete
//   POST /api/comments / /api/comments/delete
//
// 공개 API:
//   GET /api/rankings              랭킹 참여 동의한 회원만, 거래량 상위 50명 (닉네임 없으면 이메일 마스킹)
//   GET /api/economic-events       경제 캘린더 (관리자가 직접 입력한 일정, 위젯 아님)
//
// 추천인 API — "파트너 신청 → 관리자 승인"을 통과한 회원만 발급/대시보드/출금 이용 가능:
//   POST /api/referral/apply              파트너 신청 (지갑주소/텔레그램/활동계획/기타사항, 텔레그램 알림)
//   POST /api/referral/issue-code
//   GET  /api/referral/me
//   POST /api/referral/withdraw
//   GET  /api/referral/recent-withdrawals  최근 지급 완료 내역 (공개, 닉네임/금액 마스킹, 실시간 피드용)
//   ※ 리워드는 "추천받은 사람의 거래량이 $100,000 달성"해야 확정 (관리자가 admin.html에서 입력).
//
// 관리자 API:
//   POST /api/admin/login / GET /api/admin/me / POST /api/admin/logout / GET /api/admin/stats
//   GET  /api/admin/find-member?query=...     이메일 또는 UID로 회원 검색
//   POST /api/admin/reset-password            회원 비밀번호 재설정 (이메일 기준)
//   POST /api/admin/set-volume                거래량 수동 입력 (추천인 확정 자동 체크)
//   POST /api/admin/reset-volumes
//   GET  /api/admin/referral/issuers          추천인 코드 발급자 전체 현황
//   GET  /api/admin/referral/applications     파트너 신청 목록
//   POST /api/admin/referral/applications/update  파트너 신청 승인/거절
//   GET  /api/admin/gate-rebate-raw           Gate.io 파트너 리베이트 API 원본 응답 확인 (베타)
//   GET  /api/admin/referral/withdrawals / POST /api/admin/referral/withdrawals/update
//   GET  /api/admin/economic-events / POST .../create / .../update / .../delete
//
// 필요한 환경변수(Settings > Variables and Secrets):
//   GATE_API_KEY, GATE_API_SECRET   Gate.io 파트너 API (레퍼럴 확인용 — 회원 개인 키 아님)
//   ADMIN_USERNAME, ADMIN_PASSWORD  관리자 로그인
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID  (선택) 출금/파트너 신청 알림
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
      if (path === '/api/account/my-questions' && method === 'GET') return await handleMyQuestionsStatus(request, env);
      if (path === '/api/account/register-uid' && method === 'POST') return await handleRegisterUid(request, env);
      if (path === '/api/account/connect-gate-api' && method === 'POST') return await handleConnectGateApi(request, env);
      if (path === '/api/account/disconnect-gate-api' && method === 'POST') return await handleDisconnectGateApi(request, env);
      if (path === '/api/account/gate-account-raw' && method === 'GET') return await handleGateAccountRaw(request, env);
      if (path === '/api/account/ranking-opt-in' && method === 'POST') return await handleRankingOptIn(request, env);
      if (path === '/api/account/sync-volume' && method === 'POST') return await handleSyncVolume(request, env);

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
      if (path === '/api/economic-events' && method === 'GET') return await handleListEconomicEvents(request, env);

      if (path === '/api/referral/apply' && method === 'POST') return await handleReferralApply(request, env);
      if (path === '/api/referral/issue-code' && method === 'POST') return await handleReferralIssueCode(request, env);
      if (path === '/api/referral/me' && method === 'GET') return await handleReferralMe(request, env);
      if (path === '/api/referral/withdraw' && method === 'POST') return await handleReferralWithdraw(request, env);
      if (path === '/api/referral/recent-withdrawals' && method === 'GET') return await handleReferralRecentWithdrawals(request, env);

      if (path === '/api/admin/find-member' && method === 'GET') return await handleAdminFindMember(request, env);
      if (path === '/api/admin/reset-password' && method === 'POST') return await handleAdminResetPassword(request, env);
      if (path === '/api/admin/set-volume' && method === 'POST') return await handleAdminSetVolume(request, env);
      if (path === '/api/admin/reset-volumes' && method === 'POST') return await handleAdminResetVolumes(request, env);
      if (path === '/api/admin/reset-members' && method === 'POST') return await handleAdminResetMembers(request, env);
      if (path === '/api/admin/referral/issuers' && method === 'GET') return await handleAdminReferralIssuers(request, env);
      if (path === '/api/admin/referral/applications' && method === 'GET') return await handleAdminListApplications(request, env);
      if (path === '/api/admin/referral/applications/update' && method === 'POST') return await handleAdminUpdateApplication(request, env);
      if (path === '/api/admin/gate-rebate-raw' && method === 'GET') return await handleAdminGateRebateRaw(request, env);
      if (path === '/api/admin/referral/withdrawals' && method === 'GET') return await handleAdminListWithdrawals(request, env);
      if (path === '/api/admin/referral/withdrawals/update' && method === 'POST') return await handleAdminUpdateWithdrawal(request, env);

      if (path === '/api/admin/economic-events' && method === 'GET') return await handleAdminListEconomicEvents(request, env);
      if (path === '/api/admin/economic-events/create' && method === 'POST') return await handleAdminCreateEconomicEvent(request, env);
      if (path === '/api/admin/economic-events/update' && method === 'POST') return await handleAdminUpdateEconomicEvent(request, env);
      if (path === '/api/admin/economic-events/delete' && method === 'POST') return await handleAdminDeleteEconomicEvent(request, env);
    } catch (err) {
      return json({ ok: false, error: '서버 오류가 발생했습니다.', detail: String(err) }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};

// ───────────────────────── 회원 인증 (단일 계정 체계) ─────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleSignup(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const referralCode = (body.referral_code || '').trim().toUpperCase();
  if (!isValidEmail(email)) return json({ ok: false, error: '올바른 이메일 주소를 입력해주세요.' }, 400);
  if (password.length < 8) return json({ ok: false, error: '비밀번호는 8자 이상이어야 합니다.' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM members WHERE email = ?').bind(email).first();
  if (existing) return json({ ok: false, error: '이미 가입된 이메일입니다. 로그인해주세요.' }, 409);

  // 추천인 코드가 있으면 소유자를 미리 확인해둠 (가입 완료 후 referral_signups에 기록)
  let referralOwnerEmail = null;
  if (referralCode) {
    const codeRow = await env.DB.prepare('SELECT owner_email FROM referral_codes WHERE code = ?').bind(referralCode).first();
    if (codeRow && codeRow.owner_email !== email) referralOwnerEmail = codeRow.owner_email;
  }

  const { salt, hash } = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO members (email, salt, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(email, salt, hash, Date.now()).run();

  if (referralOwnerEmail) {
    try {
      await env.DB.prepare(
        'INSERT INTO referral_signups (code, owner_email, referred_email, reward_krw, qualified, created_at) VALUES (?, ?, ?, ?, 0, ?)'
      ).bind(referralCode, referralOwnerEmail, email, REFERRAL_REWARD_KRW, Date.now()).run();
    } catch (e) {
      // referred_email은 UNIQUE — 신규 가입 이메일이라 이론상 충돌 안 나지만 방어적으로 무시
    }
  }

  const token = await createSession(env, email);
  return json({ ok: true, email }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleLogin(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return json({ ok: false, error: '이메일과 비밀번호를 입력해주세요.' }, 400);

  const member = await env.DB.prepare('SELECT * FROM members WHERE email = ?').bind(email).first();
  const { hash } = member ? await hashPassword(password, member.salt) : { hash: null };

  if (!member || hash !== member.password_hash) {
    return json({ ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  const token = await createSession(env, email);
  return json({ ok: true, email, nickname: member.nickname || null }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleMe(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false });
  const member = await env.DB.prepare(
    'SELECT nickname, uid, gate_uid, trading_volume, ranking_opt_in, referral_partner_status FROM members WHERE email = ?'
  ).bind(email).first();
  if (!member) return json({ ok: false });

  let grade = null, activity = 0;
  if (member.uid) {
    activity = await getMemberActivity(env, member.uid);
    grade = gradeForActivity(activity);
  }

  const referredBy = await env.DB.prepare(
    `SELECT referral_signups.code, members.nickname AS owner_nickname, members.email AS owner_email
     FROM referral_signups LEFT JOIN members ON members.email = referral_signups.owner_email
     WHERE referral_signups.referred_email = ?`
  ).bind(email).first();

  return json({
    ok: true,
    email,
    nickname: member.nickname || null,
    uid: member.uid || null,
    grade: grade ? grade.key : null,
    grade_label: grade ? grade.label : null,
    activity,
    has_gate_api: !!member.gate_uid,
    gate_uid: member.gate_uid || null,
    trading_volume: member.trading_volume || 0,
    ranking_opt_in: !!member.ranking_opt_in,
    referral_partner_status: member.referral_partner_status || 'none',
    referred_by_code: referredBy ? referredBy.code : null,
    referred_by_label: referredBy ? (referredBy.owner_nickname || maskEmail(referredBy.owner_email)) : null,
  });
}

async function handleLogout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token && env.DB) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(SESSION_COOKIE) });
}

async function handleChangePassword(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const current = body.currentPassword || '';
  const next = body.newPassword || '';
  if (next.length < 8) return json({ ok: false, error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);

  const member = await env.DB.prepare('SELECT * FROM members WHERE email = ?').bind(email).first();
  const { hash: currentHash } = await hashPassword(current, member.salt);
  if (currentHash !== member.password_hash) return json({ ok: false, error: '현재 비밀번호가 올바르지 않습니다.' }, 401);

  const { salt, hash } = await hashPassword(next);
  await env.DB.prepare('UPDATE members SET salt = ?, password_hash = ? WHERE email = ?').bind(salt, hash, email).run();
  return json({ ok: true });
}

async function handleSetNickname(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const nickname = (body.nickname || '').trim();
  if (nickname.length < 1 || nickname.length > 20) {
    return json({ ok: false, error: '닉네임은 1~20자로 입력해주세요.' }, 400);
  }

  const dup = await env.DB.prepare('SELECT email FROM members WHERE nickname = ? AND email != ?').bind(nickname, email).first();
  if (dup) return json({ ok: false, error: '이미 사용 중인 닉네임입니다.' }, 409);

  await env.DB.prepare('UPDATE members SET nickname = ? WHERE email = ?').bind(nickname, email).run();
  return json({ ok: true, nickname });
}

// 내가 쓴 질문 중 관리자 답변이 달린 개수 — portal.html "질문" 탭 알림 배지용
// (읽음 처리는 서버에 저장하지 않고 프론트에서 localStorage로 마지막으로 본 개수를 기억해 비교함)
async function handleMyQuestionsStatus(request, env) {
  const uid = await getMemberUid(request, env);
  if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM posts
     WHERE posts.category = 'question' AND posts.author_type = 'member' AND posts.author_id = ?
       AND (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.author_type = 'admin') > 0`
  ).bind(uid).first();

  return json({ ok: true, answered_count: row ? row.c : 0 });
}

// "내 정보"에서 Gate UID를 등록 — 전용 링크 직속 가입자인지 즉시 확인하고, 통과하면
// 그 자리에서 스터디룸 접근 권한이 열림. UID는 계정당 1개, 그리고 한 UID는 한 계정만 쓸 수 있음(UNIQUE).
async function handleRegisterUid(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  if (!/^[0-9]{3,15}$/.test(uid)) return json({ ok: false, error: 'UID는 숫자만 입력해주세요.' }, 400);

  const existingOwner = await env.DB.prepare('SELECT email FROM members WHERE uid = ?').bind(uid).first();
  if (existingOwner && existingOwner.email !== email) {
    return json({ ok: false, error: '이미 다른 계정에 등록된 UID입니다.' }, 409);
  }

  let referral;
  try {
    referral = await checkGateReferral(uid, env);
  } catch (err) {
    return json({ ok: false, error: err.message || 'Gate.io 조회 중 오류' }, err.status || 500);
  }
  if (referral.status !== 'direct_referral') {
    return json({ ok: false, error: '전용 링크로 가입한 UID가 아닙니다. 먼저 가입 절차를 진행해주세요.' }, 403);
  }

  try {
    await env.DB.prepare('UPDATE members SET uid = ? WHERE email = ?').bind(uid, email).run();
  } catch (e) {
    return json({ ok: false, error: '이미 다른 계정에 등록된 UID입니다.' }, 409);
  }

  return json({ ok: true, uid });
}

// 관리자가 회원을 검색(비밀번호 재설정/거래량 설정/추천인 현황 확인용) — 이메일 또는 UID로
async function handleAdminFindMember(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim();
  if (!query) return json({ ok: false, error: '이메일 또는 UID를 입력해주세요.' }, 400);

  const member = await env.DB.prepare(
    'SELECT email, nickname, uid, gate_uid, trading_volume, ranking_opt_in, referral_partner_status, created_at FROM members WHERE email = ? OR uid = ?'
  ).bind(query.toLowerCase(), query).first();
  if (!member) return json({ ok: true, found: false });

  const codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_email = ?').bind(member.email).first();

  return json({
    ok: true,
    found: true,
    email: member.email,
    nickname: member.nickname || null,
    uid: member.uid || null,
    gate_uid: member.gate_uid || null,
    trading_volume: member.trading_volume || 0,
    ranking_opt_in: !!member.ranking_opt_in,
    referral_partner_status: member.referral_partner_status || 'none',
    referral_code: codeRow ? codeRow.code : null,
    created_at: member.created_at,
  });
}

// 관리자가 회원 비밀번호를 대신 재설정 (이메일 기준, newPassword 생략 시 임시 비밀번호 자동 생성)
async function handleAdminResetPassword(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const email = (body.email || '').trim().toLowerCase();
  let newPassword = body.newPassword || '';
  if (!email) return json({ ok: false, error: '이메일을 입력해주세요.' }, 400);
  if (newPassword && newPassword.length < 8) return json({ ok: false, error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);

  const member = await env.DB.prepare('SELECT id FROM members WHERE email = ?').bind(email).first();
  if (!member) return json({ ok: false, error: '해당 이메일로 가입된 계정이 없습니다.' }, 404);

  if (!newPassword) newPassword = generateTempPassword();

  const { salt, hash } = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE members SET salt = ?, password_hash = ? WHERE email = ?').bind(salt, hash, email).run();
  await env.DB.prepare('DELETE FROM sessions WHERE email = ?').bind(email).run();

  return json({ ok: true, newPassword });
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// ───────────────────────── 게시판 (Gate UID 등록된 회원 전용) ─────────────────────────

const ALLOWED_CATEGORIES = ['notice', 'lecture', 'question', 'profit', 'briefing'];
const ADMIN_ONLY_CATEGORIES = ['notice', 'lecture', 'briefing'];

// ───────────────────────── 등급 (활동량 기반) ─────────────────────────
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
    `SELECT posts.id, posts.title, posts.author_type, posts.author_id, posts.created_at, posts.thumb_data, posts.min_grade, members.nickname AS author_nickname,
      (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id AND comments.author_type = 'admin') > 0 AS has_admin_reply
     FROM posts LEFT JOIN members ON members.uid = posts.author_id
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
    `SELECT posts.*, members.nickname AS author_nickname
     FROM posts LEFT JOIN members ON members.uid = posts.author_id
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
    `SELECT comments.*, members.nickname AS author_nickname
     FROM comments LEFT JOIN members ON members.uid = comments.author_id
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
    if (!uid) return json({ ok: false, error: '스터디룸 접근 권한이 필요합니다. 내 정보에서 UID를 먼저 등록해주세요.' }, 401);
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
    if (!uid) return json({ ok: false, error: '스터디룸 접근 권한이 필요합니다. 내 정보에서 UID를 먼저 등록해주세요.' }, 401);
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

  const totalMembers = await env.DB.prepare('SELECT COUNT(*) AS c FROM members').first();
  const studyRoomMembers = await env.DB.prepare('SELECT COUNT(*) AS c FROM members WHERE uid IS NOT NULL').first();
  const partners = await env.DB.prepare("SELECT COUNT(*) AS c FROM members WHERE referral_partner_status = 'approved'").first();
  const totalNotices = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'notice'").first();
  const totalLectures = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'lecture'").first();
  const totalQuestions = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'question'").first();
  const totalProfit = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts WHERE category = 'profit'").first();
  const totalComments = await env.DB.prepare('SELECT COUNT(*) AS c FROM comments').first();

  return json({
    ok: true,
    members: totalMembers.c,
    study_room_members: studyRoomMembers.c,
    partners: partners.c,
    notices: totalNotices.c,
    lectures: totalLectures.c,
    questions: totalQuestions.c,
    profit: totalProfit.c,
    comments: totalComments.c,
  });
}

// ───────────────────────── Gate.io Read-Only API 연동 (랭킹용) ─────────────────────────

// 절대 출금/거래 권한을 요구하지 않음 — Read-Only 권한만 있는 키를 쓰도록 프론트에서 안내함.
// /account/detail 응답의 user_id로 실제 소유한 UID를 서버가 직접 확인함 (UID를 직접 입력받지 않음).
async function handleConnectGateApi(request, env) {
  const email = await getMemberEmail(request, env);
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
      'UPDATE members SET gate_uid = ?, gate_api_key = ?, gate_api_secret = ? WHERE email = ?'
    ).bind(gateUid, apiKey, apiSecret, email).run();
  } catch (e) {
    return json({ ok: false, error: '이미 다른 계정에 연동된 UID입니다.' }, 409);
  }

  return json({ ok: true, gate_uid: gateUid });
}

async function handleDisconnectGateApi(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  await env.DB.prepare(
    'UPDATE members SET gate_uid = NULL, gate_api_key = NULL, gate_api_secret = NULL, ranking_opt_in = 0 WHERE email = ?'
  ).bind(email).run();
  return json({ ok: true });
}

async function handleGateAccountRaw(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const member = await env.DB.prepare('SELECT gate_api_key, gate_api_secret FROM members WHERE email = ?').bind(email).first();
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

// Gate.io API v4 서명 GET 요청 공통 헬퍼 (path는 /api/v4 뒤 부분, query는 이미 인코딩된 문자열)
async function gateApiGet(apiKey, apiSecret, path, queryString) {
  const host = 'https://api.gateio.ws';
  const prefix = '/api/v4';
  const method = 'GET';
  const query = queryString || '';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = await sha512Hex('');
  const signStr = `${method}\n${prefix}${path}\n${query}\n${bodyHash}\n${timestamp}`;
  const sign = await hmacSha512Hex(apiSecret, signStr);

  const url = `${host}${prefix}${path}${query ? '?' + query : ''}`;
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', KEY: apiKey, SIGN: sign, Timestamp: timestamp },
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

// 연동된 키로 USDT 무기한 선물 체결 내역을 조회해 명목 거래량(USD)을 계산.
// 계약별 quanto_multiplier(공개 정보)를 곱해서 실제 달러 규모로 환산함.
// ⚠️ 베타 — 실제 API 키로 검증되지 않음. 거래소 정책상 조회 가능한 과거 내역 범위 안에서만 집계됨(전체 누적이 아닐 수 있음).
async function computeFuturesVolumeUsd(apiKey, apiSecret) {
  const settle = 'usdt';
  const limit = 1000;
  const maxPages = 5;
  const maxContracts = 30;
  const multiplierCache = {};
  let totalUsd = 0;
  let tradesSeen = 0;
  let lastId = '';

  for (let page = 0; page < maxPages; page++) {
    let query = `settle=${settle}&limit=${limit}`;
    if (lastId) query += `&last_id=${encodeURIComponent(lastId)}`;
    const trades = await gateApiGet(apiKey, apiSecret, `/futures/${settle}/my_trades`, query);
    if (!Array.isArray(trades) || trades.length === 0) break;

    for (const t of trades) {
      const contract = t.contract;
      if (!(contract in multiplierCache)) {
        if (Object.keys(multiplierCache).length >= maxContracts) {
          multiplierCache[contract] = 1;
        } else {
          try {
            const spec = await gateApiGet(apiKey, apiSecret, `/futures/${settle}/contracts/${encodeURIComponent(contract)}`, '');
            multiplierCache[contract] = Number(spec.quanto_multiplier || 1) || 1;
          } catch (e) {
            multiplierCache[contract] = 1;
          }
        }
      }
      const size = Math.abs(Number(t.size || 0));
      const price = Number(t.price || 0);
      totalUsd += size * price * multiplierCache[contract];
    }

    tradesSeen += trades.length;
    const newLastId = trades[trades.length - 1].id;
    if (!newLastId || newLastId === lastId) break;
    lastId = newLastId;
    if (trades.length < limit) break;
  }

  return { totalUsd, tradesSeen };
}

async function handleSyncVolume(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const member = await env.DB.prepare('SELECT gate_api_key, gate_api_secret FROM members WHERE email = ?').bind(email).first();
  if (!member || !member.gate_api_key) {
    return json({ ok: false, error: 'Gate.io API가 연동되어 있지 않습니다. 먼저 API 키를 연동해주세요.' }, 400);
  }

  try {
    const { totalUsd, tradesSeen } = await computeFuturesVolumeUsd(member.gate_api_key, member.gate_api_secret);
    await env.DB.prepare('UPDATE members SET trading_volume = ? WHERE email = ?').bind(totalUsd, email).run();
    await checkAndQualifyReferral(env, email, totalUsd);
    return json({ ok: true, trading_volume: totalUsd, trades_seen: tradesSeen });
  } catch (err) {
    const msg = err.status === 403 || err.status === 401
      ? 'API 키 권한이 부족합니다. Gate.io에서 "선물거래(Futures Trade)" 읽기 전용 권한이 켜져 있는지 확인해주세요.'
      : (err.message || 'Gate.io 거래내역 조회 중 오류가 발생했습니다.');
    return json({ ok: false, error: msg, detail: err.detail }, err.status || 500);
  }
}

// ───────────────────────── 랭킹 (선택 참여) ─────────────────────────

async function handleRankingOptIn(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const body = await safeJson(request);
  const optIn = !!body.opt_in;

  if (optIn) {
    const member = await env.DB.prepare('SELECT gate_uid FROM members WHERE email = ?').bind(email).first();
    if (!member || !member.gate_uid) {
      return json({ ok: false, error: '랭킹 시스템에 참여하려면 먼저 Gate.io Read-Only API를 연동해주세요.' }, 400);
    }
  }

  await env.DB.prepare('UPDATE members SET ranking_opt_in = ? WHERE email = ?').bind(optIn ? 1 : 0, email).run();
  return json({ ok: true, ranking_opt_in: optIn });
}

async function handleRankings(request, env) {
  const email = await getMemberEmail(request, env);
  const rows = await env.DB.prepare(
    'SELECT email, nickname, trading_volume FROM members WHERE ranking_opt_in = 1 AND trading_volume > 0 ORDER BY trading_volume DESC LIMIT 50'
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

// ───────────────────────── 경제 캘린더 (관리자가 직접 입력, 외부 위젯 아님) ─────────────────────────

async function handleListEconomicEvents(request, env) {
  const now = Date.now();
  const from = now - 3 * 24 * 60 * 60 * 1000;
  const rows = await env.DB.prepare(
    'SELECT id, event_time, country, title, importance, forecast, previous, actual FROM economic_events WHERE event_time >= ? ORDER BY event_time ASC LIMIT 100'
  ).bind(from).all();
  return json({ ok: true, events: rows.results || [] });
}

async function handleAdminListEconomicEvents(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  const rows = await env.DB.prepare(
    'SELECT * FROM economic_events ORDER BY event_time DESC LIMIT 200'
  ).all();
  return json({ ok: true, events: rows.results || [] });
}

async function handleAdminCreateEconomicEvent(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const eventTime = Number(body.event_time);
  const title = (body.title || '').trim();
  const importance = Math.min(3, Math.max(1, Number(body.importance) || 1));
  if (!eventTime || !title) return json({ ok: false, error: '일정 시각과 제목을 입력해주세요.' }, 400);

  const result = await env.DB.prepare(
    'INSERT INTO economic_events (event_time, country, title, importance, forecast, previous, actual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(eventTime, (body.country || '').trim() || null, title, importance, (body.forecast || '').trim() || null, (body.previous || '').trim() || null, (body.actual || '').trim() || null, Date.now()).run();

  return json({ ok: true, id: result.meta.last_row_id });
}

async function handleAdminUpdateEconomicEvent(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const id = Number(body.id);
  const eventTime = Number(body.event_time);
  const title = (body.title || '').trim();
  const importance = Math.min(3, Math.max(1, Number(body.importance) || 1));
  if (!id || !eventTime || !title) return json({ ok: false, error: '일정 시각과 제목을 입력해주세요.' }, 400);

  await env.DB.prepare(
    'UPDATE economic_events SET event_time = ?, country = ?, title = ?, importance = ?, forecast = ?, previous = ?, actual = ? WHERE id = ?'
  ).bind(eventTime, (body.country || '').trim() || null, title, importance, (body.forecast || '').trim() || null, (body.previous || '').trim() || null, (body.actual || '').trim() || null, id).run();

  return json({ ok: true });
}

async function handleAdminDeleteEconomicEvent(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  const body = await safeJson(request);
  const id = Number(body.id);
  if (!id) return json({ ok: false, error: '잘못된 요청입니다.' }, 400);
  await env.DB.prepare('DELETE FROM economic_events WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ───────────────────────── 추천인 파트너 신청/승인 ─────────────────────────

// 추천인 코드 발급/대시보드/출금은 파트너 승인(referral_partner_status = 'approved')된 회원만 가능.
async function requirePartner(env, email) {
  const member = await env.DB.prepare('SELECT referral_partner_status FROM members WHERE email = ?').bind(email).first();
  return !!member && member.referral_partner_status === 'approved';
}

async function handleReferralApply(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  const member = await env.DB.prepare('SELECT referral_partner_status FROM members WHERE email = ?').bind(email).first();
  if (member && member.referral_partner_status === 'approved') {
    return json({ ok: false, error: '이미 파트너로 승인된 계정입니다.' }, 409);
  }
  if (member && member.referral_partner_status === 'pending') {
    return json({ ok: false, error: '이미 심사 중인 신청이 있습니다.' }, 409);
  }

  const body = await safeJson(request);
  const walletAddress = (body.wallet_address || '').trim();
  const telegramId = (body.telegram_id || '').trim();
  const activityPlan = (body.activity_plan || '').trim();
  const notes = (body.notes || '').trim();
  if (!walletAddress) return json({ ok: false, error: 'USDT(TRC20) 지갑 주소를 입력해주세요.' }, 400);
  if (!telegramId) return json({ ok: false, error: '텔레그램 아이디를 입력해주세요.' }, 400);
  if (!activityPlan) return json({ ok: false, error: '활동 계획을 입력해주세요.' }, 400);

  await env.DB.prepare(
    'INSERT INTO referral_applications (email, wallet_address, telegram_id, activity_plan, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(email, walletAddress, telegramId, activityPlan, notes || null, 'pending', Date.now()).run();

  await env.DB.prepare("UPDATE members SET referral_partner_status = 'pending' WHERE email = ?").bind(email).run();

  await notifyAdminTelegram(env,
    `🤝 추천인 파트너 신청\n이메일: ${email}\n텔레그램: ${telegramId}\n지갑(USDT-TRC20): ${walletAddress}\n활동 계획: ${activityPlan}${notes ? `\n기타사항: ${notes}` : ''}\n\nadmin.html에서 확인 후 승인/거절해주세요.`
  );

  return json({ ok: true });
}

async function handleAdminListApplications(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  const rows = await env.DB.prepare(
    `SELECT referral_applications.*, members.nickname AS applicant_nickname
     FROM referral_applications LEFT JOIN members ON members.email = referral_applications.email
     ORDER BY referral_applications.id DESC LIMIT 200`
  ).all();
  return json({ ok: true, applications: rows.results || [] });
}

async function handleAdminUpdateApplication(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const id = Number(body.id);
  const status = body.status;
  if (!id || !['approved', 'rejected'].includes(status)) return json({ ok: false, error: '잘못된 요청입니다.' }, 400);

  const app = await env.DB.prepare('SELECT email FROM referral_applications WHERE id = ?').bind(id).first();
  if (!app) return json({ ok: false, error: '신청 내역을 찾을 수 없습니다.' }, 404);

  await env.DB.prepare('UPDATE referral_applications SET status = ?, reviewed_at = ? WHERE id = ?').bind(status, Date.now(), id).run();
  await env.DB.prepare('UPDATE members SET referral_partner_status = ? WHERE email = ?').bind(status, app.email).run();

  return json({ ok: true });
}

// ───────────────────────── 추천인 코드 (승인된 파트너 전용) ─────────────────────────
const REFERRAL_REWARD_KRW = 20000;
const REFERRAL_MIN_REFERRALS_TO_WITHDRAW = 5;
const REFERRAL_MIN_WITHDRAW_KRW = 100000;
const REFERRAL_QUALIFY_VOLUME_USD = 100000;

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function handleReferralIssueCode(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (!(await requirePartner(env, email))) return json({ ok: false, error: '추천인 파트너로 승인된 계정만 이용할 수 있습니다.' }, 403);

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
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (!(await requirePartner(env, email))) return json({ ok: false, error: '추천인 파트너로 승인된 계정만 이용할 수 있습니다.' }, 403);

  const codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE owner_email = ?').bind(email).first();
  const code = codeRow ? codeRow.code : null;

  let referredCount = 0, pendingCount = 0, totalEarned = 0, withdrawals = [], availableKrw = 0, signups = [];
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

    // 코드로 가입한 회원 한 명씩 — 확정(qualified) 여부와, 아직이면 $100k까지 얼마나 남았는지
    const signupRows = await env.DB.prepare(
      `SELECT referral_signups.referred_email, referral_signups.qualified, referral_signups.created_at,
              members.nickname, members.trading_volume
       FROM referral_signups LEFT JOIN members ON members.email = referral_signups.referred_email
       WHERE referral_signups.owner_email = ?
       ORDER BY referral_signups.qualified ASC, referral_signups.created_at DESC LIMIT 300`
    ).bind(email).all();
    signups = (signupRows.results || []).map((r) => {
      const volume = r.trading_volume || 0;
      return {
        label: r.nickname || maskEmail(r.referred_email),
        qualified: !!r.qualified,
        trading_volume: volume,
        remaining_usd: Math.max(0, REFERRAL_QUALIFY_VOLUME_USD - volume),
        joined_at: r.created_at,
      };
    });

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
    signups,
  });
}

async function handleReferralWithdraw(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (!(await requirePartner(env, email))) return json({ ok: false, error: '추천인 파트너로 승인된 계정만 이용할 수 있습니다.' }, 403);

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
            members.nickname, members.email
     FROM referral_withdrawals LEFT JOIN members ON members.email = referral_withdrawals.owner_email
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
    // 텔레그램 알림이 실패해도 신청 자체는 이미 저장돼있으니 무시
  }
}

// ───────────────────────── 관리자: 거래량 / 발급자 현황 ─────────────────────────

async function handleAdminSetVolume(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const email = (body.email || '').trim().toLowerCase();
  const volume = Number(body.volume);
  if (!email) return json({ ok: false, error: '이메일을 입력해주세요.' }, 400);
  if (!Number.isFinite(volume) || volume < 0) return json({ ok: false, error: '거래량 값이 올바르지 않습니다.' }, 400);

  const member = await env.DB.prepare('SELECT id FROM members WHERE email = ?').bind(email).first();
  if (!member) return json({ ok: false, error: '해당 이메일로 가입된 계정이 없습니다.' }, 404);

  await env.DB.prepare('UPDATE members SET trading_volume = ? WHERE email = ?').bind(volume, email).run();
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

async function handleAdminResetVolumes(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);
  await env.DB.prepare('UPDATE members SET trading_volume = 0').run();
  return json({ ok: true });
}

// 관리자용 — 회원 계정 전체 삭제(로그인/UID/API연동 정보 전부 초기화). 게시글·댓글·추천인 실적은 남기고 작성자 연결만 끊김. 되돌릴 수 없음.
async function handleAdminResetMembers(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  if (body.confirm !== 'RESET') {
    return json({ ok: false, error: '확인 문구가 일치하지 않습니다.' }, 400);
  }

  const before = await env.DB.prepare('SELECT COUNT(*) AS c FROM members').first();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM members'),
    env.DB.prepare('DELETE FROM sessions'),
  ]);
  return json({ ok: true, deleted: before ? before.c : 0 });
}

async function handleAdminReferralIssuers(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const rows = await env.DB.prepare(
    `SELECT
      referral_codes.code,
      referral_codes.owner_email,
      referral_codes.created_at AS issued_at,
      members.nickname,
      members.uid,
      (SELECT COUNT(*) FROM referral_signups WHERE referral_signups.owner_email = referral_codes.owner_email AND referral_signups.qualified = 1) AS referred_count,
      (SELECT COUNT(*) FROM referral_signups WHERE referral_signups.owner_email = referral_codes.owner_email AND referral_signups.qualified = 0) AS pending_count,
      (SELECT COALESCE(SUM(reward_krw),0) FROM referral_signups WHERE referral_signups.owner_email = referral_codes.owner_email AND referral_signups.qualified = 1) AS total_earned_krw,
      (SELECT COALESCE(SUM(amount_krw),0) FROM referral_withdrawals WHERE referral_withdrawals.owner_email = referral_codes.owner_email AND referral_withdrawals.status = 'paid') AS total_paid_krw
     FROM referral_codes
     LEFT JOIN members ON members.email = referral_codes.owner_email
     ORDER BY referred_count DESC, referral_codes.created_at ASC LIMIT 300`
  ).all();

  return json({ ok: true, issuers: rows.results || [] });
}

// Gate.io 파트너 리베이트 API 원본 응답 확인 (베타)
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
    `SELECT referral_withdrawals.*, members.nickname AS owner_nickname
     FROM referral_withdrawals LEFT JOIN members ON members.email = referral_withdrawals.owner_email
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

// 세션 → 이메일 (계정 기본 식별자)
async function getMemberEmail(request, env) {
  if (!env.DB) return null;
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, Date.now()).first();
  return session ? session.email : null;
}

// 세션 → 등록된 Gate UID (스터디룸 게시판 작성자 식별자 겸 접근 권한 체크) — 미등록이면 null
async function getMemberUid(request, env) {
  const email = await getMemberEmail(request, env);
  if (!email) return null;
  const member = await env.DB.prepare('SELECT uid FROM members WHERE email = ?').bind(email).first();
  return member && member.uid ? member.uid : null;
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

// ───────────────────────── 스키마 자동 초기화 ─────────────────────────
// D1 콘솔에 schema-console.sql을 붙여넣는 걸 깜빡해도 첫 API 요청에서
// 필요한 테이블을 자동으로 만들어준다 (이미 있으면 아무 것도 하지 않음).

let schemaReady = false;

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      uid TEXT UNIQUE,
      gate_api_key TEXT,
      gate_api_secret TEXT,
      gate_uid TEXT UNIQUE,
      trading_volume REAL NOT NULL DEFAULT 0,
      ranking_opt_in INTEGER NOT NULL DEFAULT 0,
      referral_partner_status TEXT NOT NULL DEFAULT 'none',
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS referral_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      telegram_id TEXT NOT NULL,
      activity_plan TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      reviewed_at INTEGER
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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS economic_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_time INTEGER NOT NULL,
      country TEXT,
      title TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 1,
      forecast TEXT,
      previous TEXT,
      actual TEXT,
      created_at INTEGER NOT NULL
    )`),
  ]);

  // 이전 세션들에서 있었던 users/general_members 분리 구조를 members 하나로 합치는 마이그레이션.
  // users 테이블이 남아있으면(예전 스터디룸 계정) members로 옮겨준다 — 비밀번호 해시/UID를 그대로 승계.
  try {
    const legacyUsers = await env.DB.prepare('SELECT uid, salt, password_hash, nickname, created_at FROM users LIMIT 500').all().catch(() => null);
    if (legacyUsers && legacyUsers.results && legacyUsers.results.length > 0) {
      for (const u of legacyUsers.results) {
        const placeholderEmail = `uid-${u.uid}@legacy.local`;
        try {
          await env.DB.prepare(
            'INSERT INTO members (email, salt, password_hash, nickname, uid, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(placeholderEmail, u.salt, u.password_hash, u.nickname || null, u.uid, u.created_at).run();
        } catch (e) {
          // 이미 옮겨졌거나 UID 충돌 — 건너뜀
        }
      }
    }
  } catch (e) {
    // users 테이블이 원래 없었으면 여기로 옴 — 무시
  }

  // general_members 테이블이 남아있으면(예전 일반/추천인 계정) members로 옮겨준다 — 이메일이 이미 있으니 그대로 승계.
  try {
    const legacyGeneral = await env.DB.prepare(
      'SELECT email, salt, password_hash, nickname, gate_uid, gate_api_key, gate_api_secret, trading_volume, ranking_opt_in, created_at FROM general_members LIMIT 500'
    ).all().catch(() => null);
    if (legacyGeneral && legacyGeneral.results && legacyGeneral.results.length > 0) {
      for (const g of legacyGeneral.results) {
        try {
          await env.DB.prepare(
            'INSERT INTO members (email, salt, password_hash, nickname, gate_uid, gate_api_key, gate_api_secret, trading_volume, ranking_opt_in, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(g.email, g.salt, g.password_hash, g.nickname || null, g.gate_uid || null, g.gate_api_key || null, g.gate_api_secret || null, g.trading_volume || 0, g.ranking_opt_in || 0, g.created_at).run();
        } catch (e) {
          // 이미 옮겨졌거나 이메일/UID 충돌 — 건너뜀
        }
      }
    }
  } catch (e) {
    // general_members 테이블이 원래 없었으면 여기로 옴 — 무시
  }

  try {
    await env.DB.batch([
      env.DB.prepare('DROP TABLE IF EXISTS users'),
      env.DB.prepare('DROP TABLE IF EXISTS general_members'),
    ]);
  } catch (e) {}

  // sessions 테이블이 예전 스터디룸 스키마(uid 컬럼)로 남아있으면 — CREATE TABLE IF NOT EXISTS는
  // 이미 있는 테이블을 건드리지 않으므로 email 컬럼이 없는 채로 남아 로그인/회원가입이 전부 실패함.
  // 세션은 어차피 재로그인하면 새로 생기는 휘발성 데이터라 그냥 통째로 재생성해도 안전함.
  try {
    const legacySession = await env.DB.prepare('SELECT uid FROM sessions LIMIT 1').first().catch(() => undefined);
    if (legacySession !== undefined) {
      await env.DB.batch([
        env.DB.prepare('DROP TABLE IF EXISTS sessions'),
        env.DB.prepare('DROP TABLE IF EXISTS general_sessions'),
      ]);
      await env.DB.prepare(`CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`).run();
    }
  } catch (e) {
    // 예전 sessions 테이블이 없거나 이미 새 스키마면 여기로 옴 — 무시
  }

  // referral_codes/referral_signups/referral_withdrawals가 예전 owner_uid 스키마로 남아있으면
  // (스터디룸 UID 소유 방식 → 이메일 소유 방식으로 두 번째 이전) 통째로 재생성 — 실적 초기화됨.
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

  try { await env.DB.prepare('ALTER TABLE referral_withdrawals ADD COLUMN paid_at INTEGER').run(); } catch (e) {}

  // 경제 캘린더가 비어있으면 근시일 내 실제 발표 일정 몇 건을 예시로 미리 넣어둠 (관리자가 자유롭게 추가/수정/삭제 가능)
  try {
    const countRow = await env.DB.prepare('SELECT COUNT(*) AS c FROM economic_events').first();
    if (countRow && countRow.c === 0) {
      const now = Date.now();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO economic_events (event_time, country, title, importance, forecast, previous, actual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(1790944200000, 'US', '9월 비농업고용지수(NFP)', 3, null, null, null, now),
        env.DB.prepare('INSERT INTO economic_events (event_time, country, title, importance, forecast, previous, actual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(1791981000000, 'US', '9월 소비자물가지수(CPI)', 3, null, null, null, now),
        env.DB.prepare('INSERT INTO economic_events (event_time, country, title, importance, forecast, previous, actual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(1792067400000, 'US', '9월 생산자물가지수(PPI)', 2, null, null, null, now),
        env.DB.prepare('INSERT INTO economic_events (event_time, country, title, importance, forecast, previous, actual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(1793210400000, 'US', 'FOMC 정례회의 결과 발표', 3, null, null, null, now),
      ]);
    }
  } catch (e) {}

  schemaReady = true;
}

// ───────────────────────── 세션 / 쿠키 ─────────────────────────

async function createSession(env, email) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const now = Date.now();
  const expires = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    'INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, email, now, expires).run();
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
