// Cloudflare Worker — TEAM SIXX 거래소 수수료 페이백 안내 페이지
//
// API:
//   GET  /api/check-uid?uid=...     Gate.io UID가 전용 링크로 가입했는지 확인 (Rebate API, direct_referral만 통과)
//   POST /api/telegram-join         UID + 텔레그램 아이디로 전용 텔레그램방 가입 신청
//                                    → 서버가 UID를 다시 한 번 검증(direct_referral만 허용)하고
//                                      telegram_join_requests에 저장 + 운영자에게 텔레그램 알림
//   GET  /api/payback-total?uid=... 그 UID의 누적 페이백 추정액 조회 (아래 "페이백 계산 방식" 참고)
//   GET  /api/payback-feed          최근 페이백 내역 공개 피드 (UID 마스킹, 최대 40건)
//   POST /api/telegram-link         UID 재검증 후 스터디방 신청용 1회용 봇 딥링크 발급 (study-bot.js)
//   POST /api/telegram-webhook      텔레그램 봇 웹훅 — 신청 연결/승인 버튼/그룹 입장 감지 (study-bot.js)
//
// 페이백 계산 방식(2026-10-10, 20-6단계):
//   Gate.io 커미션 분배 구조가 "유저 50% 자동 지급(거래소가 직접) : 파트너(우리) 25% : 거래소 25%"라서,
//   우리가 Gate.io Rebate API로 조회 가능한 건 우리 몫(25%)뿐임. 유저 몫(50%)은 거래소가 유저에게
//   바로 지급하므로 우리가 그 금액을 직접 조회할 방법이 없음 — 대신 비율이 고정이므로
//     유저 누적 페이백 = 우리가 받은 커미션(commission_history API) × PAYBACK_RATIO(=2, 50÷25)
//   로 계산함. PAYBACK_RATIO는 Gate.io 파트너 대시보드에 설정된 분배 비율이 바뀌면 같이 수정해야 함.
//   같은 논리로 50+25+25=100%이므로 커미션 × 4 = 그 구간 전체 수수료 풀 추정치(total_fee_usdt,
//   20-18단계) — 여기서 인플루언서·유튜버 20% 코드(GENERIC_INFLUENCER_RATE)였다면 받았을 금액과
//   지금 50% 페이백으로 추가로 받은 금액을 같이 보여줌. 전부 25% 커미션 하나에서 파생된 추정치라
//   이 값이 틀리면 나머지도 비례해서 같이 틀어짐.
//   ⚠️ 베타 — 이 프로젝트의 다른 Gate.io 개인 데이터 연동들과 마찬가지로 실제 키로 응답 필드를
//   검증한 적은 없음(이 세션은 egress 제약으로 공식 API 문서 원문을 못 읽고 GitHub SDK 문서 기반으로
//   구현함). 실제 운영 중 Gate.io 대시보드에 찍힌 커미션 실수령액과 /api/payback-total 결과를
//   한 번 대조해서 맞는지 확인 권장.
//
// 환경변수(Settings > Variables and Secrets):
//   GATE_API_KEY, GATE_API_SECRET        Gate.io 파트너 API (레퍼럴 확인 + 커미션 내역 조회, Rebate 권한만 필요 — 출금 권한 불필요)
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID  (선택) 가입 신청 알림 — 없으면 신청 저장만 되고 알림은 생략됨
//   TELEGRAM_WEBHOOK_SECRET, TELEGRAM_GROUP_CHAT_ID  (선택) 스터디방 관리 봇 — 자세한 건 study-bot.js 맨 위 주석
// 필요한 바인딩: D1 데이터베이스 → env.DB
//   (telegram_join_requests / known_uids / payback_feed / payback_cursor 테이블 사용)
//
// Cron(scheduled): MEMBERSHIP_CRON이면 스터디방 활동 검사(study-bot.js), 그 외엔 1분마다(Cloudflare Cron Trigger가 허용하는 최소 간격) known_uids에 쌓인 UID들의 최근 커미션 내역을 조회해서 payback_feed에 적재함
//   (실시간 피드용 — wrangler.jsonc의 triggers.crons 참고).
//
// ⚠️ 2026-10-07 20단계: 스터디룸(게시판/등급/UID 계정)·추천인 파트너 프로그램·거래량 랭킹·관리자
//    대시보드를 전부 폐기하고, "Gate.io 전용 링크 가입 → UID 확인 → 텔레그램 전용방 신청" 단일
//    랜딩페이지로 전환함. 예전 시스템이 쓰던 D1 테이블(members/posts/referral_* 등)은 데이터를
//    보존하기 위해 그대로 남겨뒀고 이 파일은 더 이상 그 테이블들을 건드리지 않음 — 필요하면 D1
//    콘솔에서 직접 조회 가능. 관리자 인터페이스는 이제 텔레그램 알림이 전부(별도 로그인/대시보드 없음).

import { ensureBotSchema, handleTelegramLink, handleTelegramWebhook, runMembershipCheck } from './study-bot.js';

// 스터디방 활동 검사 크론 — wrangler.jsonc triggers.crons의 두 번째 항목과 같은 문자열이어야 함
const MEMBERSHIP_CRON = '5,20,35,50 * * * *';

// 유저 50% : 파트너(우리) 25% — Gate.io가 우리에게 지급하는 커미션 × 이 값 = 유저 누적 페이백 추정액
const PAYBACK_RATIO = 2;

// 유저 50% + 파트너(우리) 25% + 거래소 25% = 100%이므로, 우리가 받는 커미션(25%) × 4 = 그 구간에서
// 발생한 전체 수수료 풀(추정). "여태까지 낸 대략적인 수수료"/"인플루언서·유튜버 20% 코드였다면" 비교에 사용.
const TOTAL_FEE_MULTIPLIER = 4;

// 인플루언서·유튜버 등이 흔히 제공하는 20% 코드와 비교하기 위한 참고 수치 — "우리 50% 페이백 vs
// 보통 20% 코드" 비교에만 사용, 실제 다른 코드의 정확한 수치를 조사해서 확정한 값이 아니라
// 업계에서 흔히 보이는 수준의 참고치임.
const GENERIC_INFLUENCER_RATE = 0.2;

// 2026-10-08 00:00 KST부터 페이백 요율이 20%→50%로 인상됨(20-4단계) — 그 이전 커미션에는
// 지금 비율(PAYBACK_RATIO=2)을 적용하면 안 되므로, 페이백 집계는 이 시점부터만 계산함.
const PAYBACK_START_SEC = 1791385200; // 2026-10-08T00:00:00+09:00

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path.startsWith('/api/') && env.DB) await ensureSchema(env);

      if (path === '/api/check-uid' && method === 'GET') return await handleCheckUid(request, env);
      if (path === '/api/telegram-join' && method === 'POST') return await handleTelegramJoin(request, env);
      if (path === '/api/payback-total' && method === 'GET') return await handlePaybackTotal(request, env);
      if (path === '/api/payback-feed' && method === 'GET') return await handlePaybackFeed(request, env);
      if (path === '/api/telegram-link' && method === 'POST') return await handleTelegramLink(request, env, botDeps);
      if (path === '/api/telegram-webhook' && method === 'POST') return await handleTelegramWebhook(request, env, ctx);
    } catch (err) {
      return json({ ok: false, error: '서버 오류가 발생했습니다.', detail: String(err) }, 500);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    if (event.cron === MEMBERSHIP_CRON) {
      ctx.waitUntil((async () => { await ensureSchema(env); await runMembershipCheck(env, botDeps); })());
      return;
    }
    ctx.waitUntil(syncPaybackFeed(env));
  },
};

// study-bot.js가 쓰는 공통 함수들(순환 import 대신 넘겨줌)
const botDeps = {
  json: (...a) => json(...a),
  safeJson: (...a) => safeJson(...a),
  checkGateReferral: (...a) => checkGateReferral(...a),
  fetchPartnerCommissionHistory: (...a) => fetchPartnerCommissionHistory(...a),
};

// ───────────────────────── Gate.io API 공통 ─────────────────────────

async function gateApiGet(path, query, env) {
  const KEY = env.GATE_API_KEY;
  const SECRET = env.GATE_API_SECRET;
  if (!KEY || !SECRET) {
    const err = new Error('서버에 API 키가 설정되지 않았습니다.');
    err.status = 500;
    throw err;
  }

  const host = 'https://api.gateio.ws';
  const prefix = '/api/v4';
  const method = 'GET';
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
  return data;
}

// ───────────────────────── Gate.io UID 확인 ─────────────────────────

async function checkGateReferral(uid, env) {
  const query = `user_id_list=${encodeURIComponent(uid)}`;
  const data = await gateApiGet('/rebate/user/sub_relation', query, env);

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
    if (result.status === 'direct_referral' && env.DB) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO known_uids (uid, first_seen) VALUES (?, ?)`
      ).bind(uid, Date.now()).run();
    }
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

// ───────────────────────── 페이백 누적 조회 / 실시간 피드 ─────────────────────────

// Gate.io 파트너 커미션 내역(우리가 받는 25% 몫)을 user_id로 필터해서 조회.
// 조회 기간은 요청 1회당 30일로 제한돼 있어서(공식 SDK 문서 기준) 호출하는 쪽에서 구간을 나눠야 함.
async function fetchPartnerCommissionHistory(uid, fromSec, toSec, offset, env) {
  const query = `user_id=${encodeURIComponent(uid)}&from=${fromSec}&to=${toSec}&limit=100&offset=${offset}`;
  const data = await gateApiGet('/rebate/partner/commission_history', query, env);
  return data.list || [];
}

// 30일 구간을 과거로 훑어가다가, 2구간(60일) 연속으로 기록이 없으면 "그 이전엔 활동 없음"으로
// 보고 중단함. PAYBACK_START_SEC(50% 요율 적용 시작일) 이전으로는 절대 내려가지 않음 — 그
// 이전 커미션은 20% 요율 시절 데이터라 지금 비율(PAYBACK_RATIO)을 적용하면 금액이 틀어짐.
async function getUidPaybackTotal(uid, env) {
  const WINDOW_SEC = 30 * 24 * 3600;
  const MAX_WINDOWS = 24;
  const now = Math.floor(Date.now() / 1000);
  let windowEnd = now;
  let totalCommission = 0;
  let emptyStreak = 0;

  for (let w = 0; w < MAX_WINDOWS; w++) {
    if (windowEnd <= PAYBACK_START_SEC) break;
    const windowStart = Math.max(windowEnd - WINDOW_SEC, PAYBACK_START_SEC);
    let offset = 0;
    let sawRecord = false;
    for (let p = 0; p < 5; p++) {
      const list = await fetchPartnerCommissionHistory(uid, windowStart, windowEnd, offset, env);
      if (!list.length) break;
      sawRecord = true;
      for (const item of list) {
        if ((item.commission_asset || 'USDT') === 'USDT') {
          totalCommission += parseFloat(item.commission_amount) || 0;
        }
      }
      if (list.length < 100) break;
      offset += 100;
    }
    windowEnd = windowStart;
    emptyStreak = sawRecord ? 0 : emptyStreak + 1;
    if (emptyStreak >= 2) break;
  }

  return totalCommission;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function handlePaybackTotal(request, env) {
  const url = new URL(request.url);
  const uid = (url.searchParams.get('uid') || '').trim();
  if (!uid || !/^[0-9]{3,15}$/.test(uid)) {
    return json({ ok: false, error: 'UID는 숫자만 입력해주세요.' }, 400);
  }
  try {
    const referral = await checkGateReferral(uid, env);
    if (referral.status === 'not_found') {
      return json({ ok: false, error: '존재하지 않는 UID예요. 다시 확인해주세요.' }, 404);
    }
    if (referral.status !== 'direct_referral') {
      return json({ ok: false, error: '전용 링크로 가입된 계정이 아니에요. UID를 다시 확인해주세요.' }, 403);
    }
    // 우리 몫 커미션(25%, API로 조회 가능한 유일한 값)을 기준으로 나머지는 전부 추정임(베타) —
    // total_fee_usdt: 그 구간에서 발생한 전체 수수료 풀 추정(커미션 × 4, 50:25:25 분배 전제)
    // received_usdt: 지금 50% 페이백으로 실제 받은 누적 금액(기존 total_usdt와 동일, 호환 유지)
    // generic20_usdt: 인플루언서·유튜버 20% 코드였다면 받았을 금액(총 수수료 풀 × 20%)
    // extra_usdt: 지금 50% 페이백 덕분에 추가로 더 받은 금액(received - generic20)
    const commission = await getUidPaybackTotal(uid, env);
    const received = commission * PAYBACK_RATIO;
    const totalFee = commission * TOTAL_FEE_MULTIPLIER;
    const generic20 = totalFee * GENERIC_INFLUENCER_RATE;
    const extra = received - generic20;
    return json({
      ok: true,
      uid,
      total_usdt: round2(received),
      received_usdt: round2(received),
      total_fee_usdt: round2(totalFee),
      generic20_usdt: round2(generic20),
      extra_usdt: round2(extra),
    });
  } catch (err) {
    return json({ ok: false, error: err.message || '조회 중 오류', detail: err.detail }, err.status || 500);
  }
}

async function handlePaybackFeed(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  // commission_time은 Gate.io API가 내려주는 값을 그대로 저장한 것이라 베타 단계에서
  // 비정상적인 값(0에 가까운 값 등)이 관측됨 — 정렬/표시 모두 우리가 직접 기록한
  // created_at(동기화 시각, ms)을 기준으로 해서 Gate.io 응답 품질과 무관하게 항상 정확하도록 함.
  const rows = await env.DB.prepare(
    `SELECT uid, commission_time, amount_usdt, source, created_at FROM payback_feed ORDER BY id DESC LIMIT 40`
  ).all();
  return json({ ok: true, items: rows.results || [] });
}

// Cron(scheduled)에서 호출 — known_uids에 쌓인 UID들의 최근 커미션 내역을 payback_feed에 적재.
// 개별 UID 조회가 실패해도 건너뛰고 계속 진행함(한 명 때문에 전체가 멈추지 않도록).
async function syncPaybackFeed(env) {
  if (!env.DB) return;
  await ensureSchema(env);

  const uidsRes = await env.DB.prepare(`SELECT uid FROM known_uids ORDER BY first_seen DESC LIMIT 200`).all();
  const uids = (uidsRes.results || []).map((r) => r.uid);
  const now = Math.floor(Date.now() / 1000);

  for (const uid of uids) {
    try {
      const cursorRow = await env.DB.prepare(`SELECT last_checked FROM payback_cursor WHERE uid = ?`).bind(uid).first();
      const since = cursorRow ? cursorRow.last_checked : Math.max(now - 24 * 3600, PAYBACK_START_SEC);

      // 한 번에 최대 100건만 오므로, 그 구간에 100건 넘게 쌓였으면(크론이 한동안 못 돈 경우 등)
      // 페이지네이션 안 하면 나머지가 조용히 누락됨 — getUidPaybackTotal()과 같은 패턴으로 최대
      // 3페이지(300건)까지 이어서 가져옴.
      let offset = 0;
      for (let p = 0; p < 3; p++) {
        const list = await fetchPartnerCommissionHistory(uid, since, now, offset, env);
        if (!list.length) break;
        for (const item of list) {
          if ((item.commission_asset || 'USDT') !== 'USDT') continue;
          const amount = (parseFloat(item.commission_amount) || 0) * PAYBACK_RATIO;
          await env.DB.prepare(
            `INSERT OR IGNORE INTO payback_feed (uid, commission_time, amount_usdt, source, created_at) VALUES (?, ?, ?, ?, ?)`
          ).bind(uid, item.commission_time, amount, item.source || '', Date.now()).run();
        }
        if (list.length < 100) break;
        offset += 100;
      }

      await env.DB.prepare(
        `INSERT INTO payback_cursor (uid, last_checked) VALUES (?, ?)
         ON CONFLICT(uid) DO UPDATE SET last_checked = excluded.last_checked`
      ).bind(uid, now).run();
    } catch (e) {
      // 개별 UID 실패(권한 문제, 일시적 오류 등)는 건너뛰고 다음 UID 계속 처리 —
      // cursor를 안 건드리므로 다음 크론 때 같은 since부터 자동으로 재시도됨.
    }
  }
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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS known_uids (
    uid TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS payback_feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    commission_time INTEGER NOT NULL,
    amount_usdt REAL NOT NULL,
    source TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(uid, commission_time, amount_usdt, source)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS payback_cursor (
    uid TEXT PRIMARY KEY,
    last_checked INTEGER NOT NULL
  )`).run();
  await ensureBotSchema(env);
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
