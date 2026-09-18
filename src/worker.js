// Cloudflare Worker (with static assets + D1)
//
// 회원 API:
//   GET  /api/check-uid?uid=...      Gate.io 레퍼럴 확인만 (계정 생성 없음)
//   POST /api/signup                 회원가입 (Gate.io 검증 후 계정 생성)
//   POST /api/login                  회원 로그인
//   GET  /api/me                     로그인 상태 확인
//   POST /api/logout                 로그아웃
//   POST /api/account/change-password  비밀번호 변경
//
// 게시판 API:
//   GET  /api/posts?category=notice|lecture|question
//   GET  /api/posts/detail?id=...
//   POST /api/posts                  글쓰기 (notice/lecture=관리자만, question=회원만)
//   POST /api/posts/delete           글 삭제 (관리자만)
//   POST /api/comments               댓글 작성 (회원 또는 관리자)
//
// 관리자 API:
//   POST /api/admin/login            IP 허용목록 + 아이디/비번 확인
//   GET  /api/admin/me
//   POST /api/admin/logout
//   POST /api/admin/reset-password   회원 비밀번호 강제 재설정 (본인 문의 시 수동 처리)
//
// 필요한 환경변수(Settings > Variables and Secrets):
//   GATE_API_KEY, GATE_API_SECRET   Gate.io API
//   ADMIN_USERNAME, ADMIN_PASSWORD  관리자 로그인
//   ADMIN_ALLOWED_IPS               콤마로 구분한 허용 IP 목록 (예: "1.2.3.4,5.6.7.8")
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
      if (path === '/api/check-uid' && method === 'GET') return await handleCheckUid(request, env);
      if (path === '/api/signup' && method === 'POST') return await handleSignup(request, env);
      if (path === '/api/login' && method === 'POST') return await handleLogin(request, env);
      if (path === '/api/me' && method === 'GET') return await handleMe(request, env);
      if (path === '/api/logout' && method === 'POST') return await handleLogout(request, env);
      if (path === '/api/account/change-password' && method === 'POST') return await handleChangePassword(request, env);
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

  const token = await createSession(env, uid);
  return json({ ok: true, uid }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleLogin(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  const password = body.password || '';
  if (!uid || !password) return json({ ok: false, error: 'UID와 비밀번호를 입력해주세요.' }, 400);

  const now = Date.now();
  const attempt = await env.DB.prepare('SELECT * FROM login_attempts WHERE uid = ?').bind(uid).first();
  if (attempt && attempt.locked_until > now) {
    const minutes = Math.ceil((attempt.locked_until - now) / 60000);
    return json({ ok: false, error: `너무 많은 시도가 있었습니다. ${minutes}분 후 다시 시도해주세요.` }, 429);
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();
  const { hash } = user ? await hashPassword(password, user.salt) : { hash: null };

  if (!user || hash !== user.password_hash) {
    const failCount = (attempt ? attempt.fail_count : 0) + 1;
    const lockedUntil = failCount >= 5 ? now + 15 * 60 * 1000 : 0;
    await env.DB.prepare(
      'INSERT INTO login_attempts (uid, fail_count, locked_until) VALUES (?, ?, ?) ' +
      'ON CONFLICT(uid) DO UPDATE SET fail_count = ?, locked_until = ?'
    ).bind(uid, failCount, lockedUntil, failCount, lockedUntil).run();
    return json({ ok: false, error: 'UID 또는 비밀번호가 올바르지 않습니다.' }, 401);
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE uid = ?').bind(uid).run();
  const token = await createSession(env, uid);
  return json({ ok: true, uid }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleMe(request, env) {
  const uid = await getMemberUid(request, env);
  return uid ? json({ ok: true, uid }) : json({ ok: false });
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

// 관리자가 회원 UID의 비밀번호를 대신 재설정 (비밀번호 찾기 - 수동 처리)
async function handleAdminResetPassword(request, env) {
  const isAdmin = await getIsAdmin(request, env);
  if (!isAdmin) return json({ ok: false, error: '관리자만 사용할 수 있습니다.' }, 403);

  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  const newPassword = body.newPassword || '';
  if (!uid) return json({ ok: false, error: 'UID를 입력해주세요.' }, 400);
  if (newPassword.length < 8) return json({ ok: false, error: '새 비밀번호는 8자 이상이어야 합니다.' }, 400);

  const user = await env.DB.prepare('SELECT id FROM users WHERE uid = ?').bind(uid).first();
  if (!user) return json({ ok: false, error: '해당 UID로 가입된 계정이 없습니다.' }, 404);

  const { salt, hash } = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE uid = ?').bind(salt, hash, uid).run();

  // 재설정되면 기존 로그인 세션은 모두 만료시켜 안전하게 처리
  await env.DB.prepare('DELETE FROM sessions WHERE uid = ?').bind(uid).run();

  return json({ ok: true });
}

// ───────────────────────── 게시판 ─────────────────────────

const ALLOWED_CATEGORIES = ['notice', 'lecture', 'question', 'profit'];
const ADMIN_ONLY_CATEGORIES = ['notice', 'lecture', 'profit'];

async function handleListPosts(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || '';
  if (!ALLOWED_CATEGORIES.includes(category)) return json({ ok: false, error: '잘못된 카테고리입니다.' }, 400);

  const order = category === 'lecture' ? 'ASC' : 'DESC';
  const rows = await env.DB.prepare(
    `SELECT id, title, author_type, author_id, created_at FROM posts WHERE category = ? ORDER BY id ${order} LIMIT 100`
  ).bind(category).all();

  return json({ ok: true, posts: rows.results || [] });
}

async function handlePostDetail(request, env) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return json({ ok: false, error: '잘못된 요청입니다.' }, 400);

  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return json({ ok: false, error: '게시글을 찾을 수 없습니다.' }, 404);

  const comments = await env.DB.prepare(
    'SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC LIMIT 500'
  ).bind(id).all();

  return json({ ok: true, post, comments: comments.results || [] });
}

async function handleCreatePost(request, env) {
  const body = await safeJson(request);
  const category = body.category || '';
  const title = (body.title || '').trim();
  const content = (body.content || '').trim();
  const imageData = body.image_data || null;

  if (!ALLOWED_CATEGORIES.includes(category)) return json({ ok: false, error: '잘못된 카테고리입니다.' }, 400);
  if (!title || !content) return json({ ok: false, error: '제목과 내용을 입력해주세요.' }, 400);
  if (imageData && imageData.length > 2_000_000) return json({ ok: false, error: '이미지 용량이 너무 큽니다. (최대 약 1.5MB)' }, 400);

  let authorType, authorId;

  if (ADMIN_ONLY_CATEGORIES.includes(category)) {
    const isAdmin = await getIsAdmin(request, env);
    if (!isAdmin) return json({ ok: false, error: '관리자만 작성할 수 있습니다.' }, 403);
    authorType = 'admin';
    authorId = 'admin';
  } else {
    const uid = await getMemberUid(request, env);
    if (!uid) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
    authorType = 'member';
    authorId = uid;
  }

  const result = await env.DB.prepare(
    'INSERT INTO posts (category, title, content, image_data, author_type, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(category, title, content, imageData, authorType, authorId, Date.now()).run();

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

// ───────────────────────── 관리자 인증 ─────────────────────────

function isAllowedAdminIp(request, env) {
  const list = (env.ADMIN_ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true; // 설정 안 했으면 막지 않음 (설정 권장)
  const ip = request.headers.get('CF-Connecting-IP') || '';
  return list.includes(ip);
}

async function handleAdminLogin(request, env) {
  if (!isAllowedAdminIp(request, env)) {
    return json({ ok: false, error: '허용되지 않은 접속입니다.' }, 403);
  }
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
