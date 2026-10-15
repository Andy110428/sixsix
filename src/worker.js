// Cloudflare Worker — TEAM SIXX 거래소 수수료 페이백 안내 페이지
//
// API:
//   GET  /api/check-uid?uid=...     Gate.io UID가 전용 링크로 가입했는지 확인 (Rebate API, direct_referral만 통과)
//   POST /api/telegram-join         UID + 텔레그램 아이디로 전용 텔레그램방 가입 신청
//                                    → 서버가 UID를 다시 한 번 검증(direct_referral만 허용)하고
//                                      telegram_join_requests에 저장 + 운영자에게 텔레그램 알림
//   GET  /api/payback-total?uid=... 그 UID의 누적 페이백 추정액 조회 (아래 "페이백 계산 방식" 참고)
//   GET  /api/payback-feed          최근 페이백 내역 공개 피드 (UID 마스킹, 최대 300건, 20-26단계)
//   POST /api/telegram-link         UID 재검증 후 스터디방 신청용 1회용 봇 딥링크 발급 (study-bot.js)
//   POST /api/telegram-webhook      텔레그램 봇 웹훅 — 신청 연결/승인 버튼/그룹 입장 감지 (study-bot.js)
//   GET  /api/events                공개 이벤트/공지 목록 (status='active'만, 20-28단계)
//   POST /api/admin/login           관리자 비밀번호 로그인 → 서명된 쿠키 발급 (ADMIN_PASSWORD 필요)
//   POST /api/admin/logout          관리자 쿠키 제거
//   GET  /api/admin/events          전체 이벤트 목록(비공개 포함) — 관리자 쿠키 필요
//   POST /api/admin/events/create|update|delete  이벤트 CRUD — 관리자 쿠키 필요
//   (20-28단계: 20단계에서 "관리자 대시보드 없음"으로 정리했던 방침을, 이번엔 사용자가 "이벤트 관리용
//    관리자 탭을 새로 만들어도 좋다"고 명시적으로 허용해서 이벤트 CRUD 한정으로 재도입함 — 텔레그램
//    신청/UID 확인 등 나머지 핵심 플로우는 여전히 로그인 없이 그대로 동작.)
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
//   (실시간 피드용 — wrangler.jsonc의 triggers.crons 참고. 20-24단계부터 커미션 레코드 단위로 그대로
//    적재하고(커서 이후만 보는 저비용 조회가 기본, Gate.io의 커미션 집계 지연에 대비해 10분에 한 번만
//    SYNC_SAFETY_LOOKBACK_SEC만큼 겹쳐서 재조회하는 넓은 스캔으로 전환 — 20-25단계, 매 틱마다 넓게
//    스캔하면 API 호출량이 너무 커져서 오히려 동기화가 막힐 수 있어서 빈도를 낮춤),
//    같은 사람이 짧은 시간에 여러 건 잡히는 건 GET /api/payback-feed가 보여줄 때 합쳐서 처리함).
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
      if (path === '/api/events' && method === 'GET') return await handleEventsPublic(request, env);
      if (path === '/api/admin/login' && method === 'POST') return await handleAdminLogin(request, env);
      if (path === '/api/admin/logout' && method === 'POST') return await handleAdminLogout(request, env);
      if (path === '/api/admin/events' && method === 'GET') return await handleAdminEventsList(request, env);
      if (path === '/api/admin/events/create' && method === 'POST') return await handleAdminEventCreate(request, env);
      if (path === '/api/admin/events/update' && method === 'POST') return await handleAdminEventUpdate(request, env);
      if (path === '/api/admin/events/delete' && method === 'POST') return await handleAdminEventDelete(request, env);
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

// 같은 사람이 짧은 시간 안에 여러 건 잡히면 피드에서 한 줄로 합쳐서 보여줌(20-21단계 요청) —
// 단, 원본 payback_feed는 커미션 레코드 단위로 그대로 쌓임(20-24단계, 아래 syncPaybackFeed 참고).
// 병합은 DB에 적재할 때가 아니라 "보여줄 때"만 하므로, 지연 집계된 과거 커미션을 UNIQUE 제약으로
// 안전하게 재조회/중복 제거할 수 있음.
const FEED_MERGE_WINDOW_MS = 15 * 60 * 1000;
// 20-26단계: 예전엔 병합 후 40건에서 끊었는데, 그날 실제 활동이 많으면 그 40건 안에
// 오늘치가 전부 못 들어가는 경우가 생길 수 있어서(원본 300건 fetch가 먼저 바닥남) 사용자가
// "40건밖에 못 보여주냐, 훨씬 늘려야 한다"고 지적함 — 원본 fetch/최종 표시 상한을 모두 크게 올림.
const FEED_RAW_FETCH_LIMIT = 2000;
const FEED_DISPLAY_LIMIT = 300;

async function handlePaybackFeed(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  // commission_time은 Gate.io API가 내려주는 값을 그대로 저장한 것이라 베타 단계에서
  // 비정상적인 값(0에 가까운 값 등)이 관측됨 — 정렬/표시 모두 우리가 직접 기록한
  // created_at(동기화 시각, ms)을 기준으로 해서 Gate.io 응답 품질과 무관하게 항상 정확하도록 함.
  const rows = await env.DB.prepare(
    `SELECT uid, amount_usdt, created_at FROM payback_feed ORDER BY id DESC LIMIT ?1`
  ).bind(FEED_RAW_FETCH_LIMIT).all();
  const list = rows.results || [];

  const merged = [];
  for (const row of list) {
    const last = merged[merged.length - 1];
    if (last && last.uid === row.uid && (last.created_at - row.created_at) <= FEED_MERGE_WINDOW_MS) {
      last.amount_usdt = round2(last.amount_usdt + row.amount_usdt);
      continue;
    }
    if (merged.length >= FEED_DISPLAY_LIMIT) break;
    merged.push({ uid: row.uid, amount_usdt: row.amount_usdt, created_at: row.created_at });
  }

  return json({ ok: true, items: merged });
}

// 커서보다 이만큼 더 과거까지 겹쳐서 다시 조회함(초) — Gate.io가 커미션을 실제 거래 시점보다
// 늦게 집계/노출하는 경우(베타, 실 키로 검증 안 됨, 운영 중 "커미션은 들어오는데 피드는 7시간
// 전에 멈춰있다"는 증상으로 확인됨, 20-24단계)를 대비한 안전 여유분. 실제 관측된 지연(7시간)보다
// 넉넉한 여유를 두려고 24시간으로 잡음 — 겹쳐서 다시 읽은 레코드는 payback_feed의
// UNIQUE(uid, commission_time, amount_usdt, source) 제약 + INSERT OR IGNORE로 자동 중복 제거되므로
// 안전함.
const SYNC_SAFETY_LOOKBACK_SEC = 24 * 3600;

// 위 24시간 lookback을 매 틱(1분)마다 전체 known_uids에 걸어버리면, 활동이 많은 UID는 매분
// 24시간치 구간을 다시 스캔하게 돼서(5페이지까지 페이지네이션 가능) Gate.io API 호출량이 20-24단계
// 이전보다 훨씬 커짐 — 최악의 경우 Gate.io 레이트리밋이나 Cloudflare 서브요청 한도에 걸려 동기화
// 자체가 실패하고, 그 결과 피드가 또 멈춰 보이는 "같은 증상, 다른 원인"이 재발할 수 있음(20-25단계
// 발견). 그래서 넓은 24시간 lookback은 10분에 한 번(크론 10틱마다)만 적용하고, 그 사이 9번은 원래
// 하던 대로 커서 이후만 조회하는 저비용 경로를 씀 — 지연된 커미션도 늦어도 10분 안에는 다음
// lookback 틱에서 잡히므로 완전성은 거의 그대로 유지하면서 평소 API 호출량은 20-24단계 이전 수준으로
// 되돌림.
const WIDE_SCAN_INTERVAL_MIN = 10;

// Cron(scheduled)에서 호출 — known_uids에 쌓인 UID들의 최근 커미션 내역을 payback_feed에 적재.
// 개별 UID 조회가 실패해도 건너뛰고 계속 진행함(한 명 때문에 전체가 멈추지 않도록).
async function syncPaybackFeed(env) {
  if (!env.DB) return;
  await ensureSchema(env);

  const uidsRes = await env.DB.prepare(`SELECT uid FROM known_uids ORDER BY first_seen DESC LIMIT 200`).all();
  const uids = (uidsRes.results || []).map((r) => r.uid);
  const now = Math.floor(Date.now() / 1000);
  const isWideScanTick = Math.floor(now / 60) % WIDE_SCAN_INTERVAL_MIN === 0;

  for (const uid of uids) {
    try {
      const cursorRow = await env.DB.prepare(`SELECT last_checked FROM payback_cursor WHERE uid = ?`).bind(uid).first();
      const baseline = cursorRow ? cursorRow.last_checked : Math.max(now - 24 * 3600, PAYBACK_START_SEC);
      const since = isWideScanTick
        ? Math.max(baseline - SYNC_SAFETY_LOOKBACK_SEC, PAYBACK_START_SEC)
        : baseline;

      // 레코드 단위로 그대로 적재(커미션 레코드 하나당 한 줄) — UNIQUE 제약이 중복 삽입을
      // 막아주므로 lookback으로 겹쳐서 다시 읽어도 안전함. 한 번에 최대 100건만 오므로,
      // 그 구간에 100건 넘게 쌓였으면 최대 5페이지(500건)까지 이어서 가져옴.
      let offset = 0;
      for (let p = 0; p < 5; p++) {
        const list = await fetchPartnerCommissionHistory(uid, since, now, offset, env);
        if (!list.length) break;
        for (const item of list) {
          if ((item.commission_asset || 'USDT') !== 'USDT') continue;
          const amount = (parseFloat(item.commission_amount) || 0) * PAYBACK_RATIO;
          await env.DB.prepare(
            `INSERT OR IGNORE INTO payback_feed (uid, commission_time, amount_usdt, source, created_at) VALUES (?, ?, ?, ?, ?)`
          ).bind(uid, item.commission_time, round2(amount), item.source || '', Date.now()).run();
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
      // cursor를 안 건드리므로 다음 크론 때 같은 since부터(사실상 더 넓은 lookback으로) 자동 재시도됨.
      console.error('syncPaybackFeed failed for uid', uid, String(e));
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

// ───────────────────────── 관리자 로그인 (이벤트 관리 전용, 20-28단계) ─────────────────────────
// ADMIN_PASSWORD 환경변수가 있어야 동작함(20단계에서 관리자 로그인 자체를 없앴지만, 이번엔 사용자가
// "이벤트 관리용 관리자 탭은 새로 만들어도 좋다"고 명시적으로 허용해서 이 기능 한정으로 재도입).
// 세션은 별도 DB 테이블 없이 서명된 쿠키(HMAC, 비밀키=ADMIN_PASSWORD)로 처리 — 쿠키 값 자체가
// 만료시각+서명이라 위조하려면 어차피 ADMIN_PASSWORD를 알아야 하므로(그러면 그냥 로그인하면 됨)
// 별도 세션 테이블 없이도 안전함.
const ADMIN_SESSION_MAX_AGE_SEC = 7 * 24 * 3600;

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

async function createAdminToken(env) {
  const exp = Date.now() + ADMIN_SESSION_MAX_AGE_SEC * 1000;
  const sig = await hmacSha512Hex(env.ADMIN_PASSWORD, `admin:${exp}`);
  return `${exp}.${sig}`;
}

async function verifyAdminToken(token, env) {
  if (!token || !env.ADMIN_PASSWORD) return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!exp || Date.now() > exp) return false;
  const expected = await hmacSha512Hex(env.ADMIN_PASSWORD, `admin:${exp}`);
  return expected === sig;
}

async function requireAdmin(request, env) {
  const token = getCookie(request, 'admin_session');
  return await verifyAdminToken(token, env);
}

// 로컬 wrangler dev는 http://localhost라서 Secure 쿠키를 브라우저가 아예 저장 안 함 —
// 실제 요청 스킴이 https일 때만 Secure를 붙여서, 운영(항상 https)은 그대로 안전하게 하고
// 로컬 테스트에서도 로그인 쿠키가 정상 동작하도록 함.
function cookieSecureAttr(request) {
  return new URL(request.url).protocol === 'https:' ? ' Secure;' : '';
}

async function handleAdminLogin(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return json({ ok: false, error: '관리자 기능이 아직 설정되지 않았습니다. ADMIN_PASSWORD 환경변수를 등록해주세요.' }, 500);
  }
  const body = await safeJson(request);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, 401);
  }
  const token = await createAdminToken(env);
  return json({ ok: true }, 200, {
    'Set-Cookie': `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly;${cookieSecureAttr(request)} SameSite=Strict; Max-Age=${ADMIN_SESSION_MAX_AGE_SEC}`,
  });
}

async function handleAdminLogout(request, env) {
  return json({ ok: true }, 200, {
    'Set-Cookie': `admin_session=; Path=/; HttpOnly;${cookieSecureAttr(request)} SameSite=Strict; Max-Age=0`,
  });
}

// ───────────────────────── 이벤트/공지 (20-28단계) ─────────────────────────

const EVENT_TITLE_MAX = 200;
const EVENT_DESC_MAX = 1000;
const EVENT_EXCHANGE_MAX = 50;
const EVENT_URL_MAX = 500;

function isValidEventUrl(url) {
  if (!url) return true; // 선택값
  return typeof url === 'string' && url.length <= EVENT_URL_MAX && /^https?:\/\//.test(url);
}

function validateEventInput(body) {
  const title = (body.title || '').trim();
  const description = (body.description || '').trim();
  const exchange = (body.exchange || 'gate').trim();
  const image_url = (body.image_url || '').trim();
  const link_url = (body.link_url || '').trim();
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const starts_at = Number.isFinite(body.starts_at) ? Math.trunc(body.starts_at) : null;
  const ends_at = Number.isFinite(body.ends_at) ? Math.trunc(body.ends_at) : null;

  if (!title || title.length > EVENT_TITLE_MAX) return { error: `제목은 1~${EVENT_TITLE_MAX}자로 입력해주세요.` };
  if (description.length > EVENT_DESC_MAX) return { error: `설명은 ${EVENT_DESC_MAX}자 이하로 입력해주세요.` };
  if (!exchange || exchange.length > EVENT_EXCHANGE_MAX) return { error: '거래소를 입력해주세요.' };
  if (!isValidEventUrl(image_url)) return { error: '이미지 URL은 http(s)://로 시작해야 해요.' };
  if (!isValidEventUrl(link_url)) return { error: '링크 URL은 http(s)://로 시작해야 해요.' };

  return { value: { title, description, exchange, image_url, link_url, status, starts_at, ends_at } };
}

async function handleEventsPublic(request, env) {
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const rows = await env.DB.prepare(
    `SELECT id, title, description, exchange, image_url, link_url, starts_at, ends_at FROM events
     WHERE status = 'active' ORDER BY created_at DESC LIMIT 100`
  ).all();
  const now = Date.now();
  const items = (rows.results || []).map((r) => ({ ...r, ended: !!(r.ends_at && r.ends_at < now) }));
  return json({ ok: true, items });
}

async function handleAdminEventsList(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const rows = await env.DB.prepare(`SELECT * FROM events ORDER BY created_at DESC LIMIT 200`).all();
  return json({ ok: true, items: rows.results || [] });
}

async function handleAdminEventCreate(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const { error, value } = validateEventInput(body);
  if (error) return json({ ok: false, error }, 400);
  await env.DB.prepare(
    `INSERT INTO events (title, description, exchange, image_url, link_url, status, starts_at, ends_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(value.title, value.description, value.exchange, value.image_url, value.link_url, value.status, value.starts_at, value.ends_at, Date.now()).run();
  return json({ ok: true });
}

async function handleAdminEventUpdate(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const id = Number(body.id);
  if (!id) return json({ ok: false, error: 'id가 필요합니다.' }, 400);
  const { error, value } = validateEventInput(body);
  if (error) return json({ ok: false, error }, 400);
  await env.DB.prepare(
    `UPDATE events SET title=?, description=?, exchange=?, image_url=?, link_url=?, status=?, starts_at=?, ends_at=? WHERE id=?`
  ).bind(value.title, value.description, value.exchange, value.image_url, value.link_url, value.status, value.starts_at, value.ends_at, id).run();
  return json({ ok: true });
}

async function handleAdminEventDelete(request, env) {
  if (!(await requireAdmin(request, env))) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (!env.DB) return json({ ok: false, error: 'DB가 연결되지 않았습니다.' }, 500);
  const body = await safeJson(request);
  const id = Number(body.id);
  if (!id) return json({ ok: false, error: 'id가 필요합니다.' }, 400);
  await env.DB.prepare(`DELETE FROM events WHERE id=?`).bind(id).run();
  return json({ ok: true });
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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    exchange TEXT NOT NULL DEFAULT 'gate',
    image_url TEXT,
    link_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    starts_at INTEGER,
    ends_at INTEGER,
    created_at INTEGER NOT NULL
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
