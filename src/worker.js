// Cloudflare Worker — TEAM SIXX 거래소 수수료 페이백 안내 페이지
//
// API:
//   GET  /api/check-uid?uid=...   Gate.io UID가 전용 링크로 가입했는지 확인 (Rebate API, direct_referral만 통과)
//   POST /api/telegram-join       UID + 텔레그램 아이디로 전용 텔레그램방 가입 신청
//                                  → 서버가 UID를 다시 한 번 검증(direct_referral만 허용)하고
//                                    telegram_join_requests에 저장 + 운영자에게 텔레그램 알림
//
// 환경변수(Settings > Variables and Secrets):
//   GATE_API_KEY, GATE_API_SECRET        Gate.io 파트너 API (레퍼럴 확인용 — 회원 개인 키 아님)
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID  (선택) 가입 신청 알림 — 없으면 신청 저장만 되고 알림은 생략됨
// 필요한 바인딩: D1 데이터베이스 → env.DB (telegram_join_requests 테이블만 사용)
//
// ⚠️ 2026-10-07 20단계: 스터디룸(게시판/등급/UID 계정)·추천인 파트너 프로그램·거래량 랭킹·관리자
//    대시보드를 전부 폐기하고, "Gate.io 전용 링크 가입 → UID 확인 → 텔레그램 전용방 신청" 단일
//    랜딩페이지로 전환함. 예전 시스템이 쓰던 D1 테이블(members/posts/referral_* 등)은 데이터를
//    보존하기 위해 그대로 남겨뒀고 이 파일은 더 이상 그 테이블들을 건드리지 않음 — 필요하면 D1
//    콘솔에서 직접 조회 가능. 관리자 인터페이스는 이제 텔레그램 알림이 전부(별도 로그인/대시보드 없음).

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path.startsWith('/api/') && env.DB) await ensureSchema(env);

      if (path === '/api/check-uid' && method === 'GET') return await handleCheckUid(request, env);
      if (path === '/api/telegram-join' && method === 'POST') return await handleTelegramJoin(request, env);
    } catch (err) {
      return json({ ok: false, error: '서버 오류가 발생했습니다.', detail: String(err) }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};

// ───────────────────────── Gate.io UID 확인 ─────────────────────────

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

// ───────────────────────── 텔레그램 전용방 가입 신청 ─────────────────────────

function isValidTelegramId(id) {
  return typeof id === 'string' && id.trim().length >= 2 && id.trim().length <= 100;
}

async function handleTelegramJoin(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const uid = (body.uid || '').trim();
  const telegramId = (body.telegram_id || '').trim();

  if (!uid || !/^[0-9]{3,15}$/.test(uid)) {
    return json({ ok: false, error: 'UID는 숫자만 입력해주세요.' }, 400);
  }
  if (!isValidTelegramId(telegramId)) {
    return json({ ok: false, error: '텔레그램 아이디를 2~100자로 입력해주세요.' }, 400);
  }

  let referral;
  try {
    referral = await checkGateReferral(uid, env);
  } catch (err) {
    return json({ ok: false, error: err.message || 'Gate.io 조회 중 오류', detail: err.detail }, err.status || 500);
  }
  if (referral.status !== 'direct_referral') {
    return json({ ok: false, error: '전용 링크로 가입이 확인된 UID만 신청할 수 있습니다. 먼저 UID 확인을 통과해주세요.' }, 403);
  }

  await env.DB.prepare(
    `INSERT INTO telegram_join_requests (uid, telegram_id, created_at) VALUES (?, ?, ?)`
  ).bind(uid, telegramId, Date.now()).run();

  await notifyAdminTelegram(env, `📨 텔레그램 전용방 가입 신청\nUID: ${uid}\n텔레그램: ${telegramId}`);

  return json({ ok: true });
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

// ───────────────────────── 스키마 자동 초기화 ─────────────────────────

let schemaReady = false;

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS telegram_join_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    telegram_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  schemaReady = true;
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
