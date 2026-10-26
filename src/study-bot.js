// 스터디방(비공개 텔레그램 그룹) 관리 봇 — 2026-10-11 20-16단계
//
// 하는 일:
//   1) 사이트에서 UID 확인(direct_referral)을 통과한 사람에게 1회용 봇 딥링크(t.me/<봇>?start=<토큰>)를 발급.
//      그 사람이 봇에서 "시작"을 누르는 순간 텔레그램 숫자 ID(user_id, 아이디를 바꿔도 안 바뀜)와
//      Gate.io UID를 서버가 직접 연결해서 저장함 — @아이디를 손으로 칠 필요가 없고, @아이디가 없는 사람도 됨.
//   2) 운영자에게 승인/거절 버튼이 달린 알림을 보냄. 시드 예치는 API로 확인할 수 없어서 승인은 운영자가 직접 누름.
//      승인하면 봇이 1회용(1명, 24시간) 초대 링크를 만들어 신청자에게 DM으로 보냄.
//   3) 15분마다(크론) 승인된 멤버를 조금씩 순회하며:
//        - UID가 더 이상 전용 링크 direct_referral이 아니면 → 내보내기 대상
//        - 입장 후 30일이 지났는데 최근 30일 커미션 기록(=거래)이 없으면 → 내보내기 대상
//        - 23일 이상 거래가 없으면 → "7일 안에 거래 없으면 내보내져요" 경고 DM (자동 내보내기 켜져 있을 때만)
//      자동 내보내기는 기본 꺼짐(/autokick on 으로 켬) — 꺼져 있으면 운영자에게 "대상" 알림만 보냄.
//      내보내기는 ban → 즉시 unban 이라서 영구 차단이 아니고, 다시 신청하면 재입장 가능.
//      그룹 관리자/소유자는 절대 내보내지 않음.
//
// 텔레그램 봇 API는 남의 @아이디로 숫자 ID를 조회하는 기능이 없음 → 숫자 ID는 그 사람이 봇/그룹과
// 상호작용할 때만 알 수 있음. 그래서 딥링크(1번) + 그룹 입장/메시지 감지로 숫자 ID를 확보함.
// 이 봇이 생기기 전부터 그룹에 있던 사람은 봇이 모름 → 그룹에서 메시지를 쓰거나 입장할 때 "미등록"으로
// 기록되고, 운영자가 /unlinked 로 보고 /kick_unlinked confirm 으로 정리할 수 있음(자동으로는 안 내보냄).
//
// 환경변수:
//   TELEGRAM_BOT_TOKEN       기존 알림 봇 토큰 그대로 사용
//   TELEGRAM_ADMIN_CHAT_ID   운영자 본인 개인 채팅 ID(= 운영자 user_id) — 관리 명령/승인 버튼은 이 사람만 가능
//   TELEGRAM_WEBHOOK_SECRET  setWebhook 때 넣은 secret_token과 같은 값 — 없으면 봇 기능 전체가 꺼지고
//                            사이트는 예전 "@아이디 입력" 방식으로 자동 대체됨
//   TELEGRAM_GROUP_CHAT_ID   스터디방 그룹 chat_id(-100...) — 그룹에서 운영자가 /groupid 보내면 봇이 알려줌
//
// ⚠️ 이 봇 토큰에 웹훅을 걸면 다른 프로그램(예: PC의 Claude Code 텔레그램 채널)이 같은 봇으로
//    메시지를 받을 수 없음 — PC 원격작업용은 반드시 다른 봇을 써야 함.

const DAY_MS = 24 * 3600 * 1000;
const INACTIVE_DAYS = 30;
const WARN_DAYS = 23;
const CHECK_BATCH = 5; // 크론 1회당 검사 인원 — Workers 무료 플랜 서브요청 50개 제한 안에 들어오도록 작게 잡음
const LINK_TOKEN_TTL_MS = DAY_MS;

// ───────────────────────── 스키마 ─────────────────────────

export async function ensureBotSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tg_link_tokens (
    token TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tg_members (
    user_id INTEGER PRIMARY KEY,
    uid TEXT NOT NULL,
    username TEXT,
    first_name TEXT,
    status TEXT NOT NULL,
    linked_at INTEGER,
    approved_at INTEGER,
    joined_at INTEGER,
    in_group INTEGER NOT NULL DEFAULT 0,
    invite_link TEXT,
    last_check_at INTEGER,
    last_active_at INTEGER,
    warned_at INTEGER,
    flagged_at INTEGER,
    flag_reason TEXT,
    kicked_at INTEGER,
    kick_reason TEXT
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tg_seen (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    in_group INTEGER NOT NULL DEFAULT 1
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_kv (
    key TEXT PRIMARY KEY,
    value TEXT
  )`).run();
  // 20-51단계: Bitget 회원도 같은 봇 흐름을 쓰게 되면서 어느 거래소 UID인지 같이 저장함(기존 행은 gate).
  // D1(SQLite)은 ADD COLUMN IF NOT EXISTS가 없어서, 이미 있으면 나는 "duplicate column" 에러는 무시함.
  for (const table of ['tg_link_tokens', 'tg_members']) {
    try {
      await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN exchange TEXT NOT NULL DEFAULT 'gate'`).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e && e.message))) throw e;
    }
  }
}

async function kvGet(env, key) {
  const row = await env.DB.prepare(`SELECT value FROM app_kv WHERE key = ?`).bind(key).first();
  return row ? row.value : null;
}
async function kvSet(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO app_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(key, value).run();
}

// ───────────────────────── 텔레그램 API ─────────────────────────

async function tg(env, method, params) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  try { return await res.json(); } catch { return { ok: false }; }
}

async function sendText(env, chatId, text, extra) {
  return tg(env, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...(extra || {}) });
}

async function notifyAdmin(env, text, extra) {
  if (!env.TELEGRAM_ADMIN_CHAT_ID) return;
  await sendText(env, env.TELEGRAM_ADMIN_CHAT_ID, text, extra);
}

let cachedBotUsername = null;
async function getBotUsername(env) {
  if (cachedBotUsername) return cachedBotUsername;
  const me = await tg(env, 'getMe', {});
  if (me.ok && me.result && me.result.username) cachedBotUsername = me.result.username;
  return cachedBotUsername;
}

function isAdmin(env, userId) {
  return !!env.TELEGRAM_ADMIN_CHAT_ID && String(userId) === String(env.TELEGRAM_ADMIN_CHAT_ID);
}
function isGroup(env, chatId) {
  return !!env.TELEGRAM_GROUP_CHAT_ID && String(chatId) === String(env.TELEGRAM_GROUP_CHAT_ID);
}
function displayName(u) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return (u.username ? '@' + u.username : '(아이디 없음)') + (name ? ` ${name}` : '');
}
const EXCHANGE_NAMES = { gate: 'Gate.io', bitget: 'Bitget' };
function exchangeName(ex) {
  return EXCHANGE_NAMES[ex] || EXCHANGE_NAMES.gate;
}
function memberLabel(m) {
  return `${m.username ? '@' + m.username : '(아이디 없음)'}${m.first_name ? ' ' + m.first_name : ''} · ${exchangeName(m.exchange)} UID ${m.uid}`;
}

function botEnabled(env) {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET);
}

// ───────────────────────── 사이트 → 딥링크 발급 ─────────────────────────

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function handleTelegramLink(request, env, deps) {
  const { json, safeJson, checkGateReferral, checkBitgetViaRelay } = deps;
  if (!botEnabled(env)) {
    return json({ ok: false, fallback: true, error: '텔레그램 봇 신청이 아직 준비되지 않았어요.' }, 503);
  }
  const body = await safeJson(request);
  const uid = String(body.uid || '').trim();
  const exchange = body.exchange === 'bitget' ? 'bitget' : 'gate';

  if (exchange === 'bitget') {
    // 20-51단계: Bitget은 고정 IP 중계 서버로 재검증(worker.js checkBitgetViaRelay). 중계기 문제면
    // fallback:true를 돌려줘서 프론트가 예전 수동 제출(@아이디 → /api/bitget-join)로 자동 대체하게 함.
    if (!/^[0-9]{4,20}$/.test(uid)) return json({ ok: false, error: 'UID는 숫자만 입력해주세요.' }, 400);
    const check = await checkBitgetViaRelay(uid, env);
    if (check.status === 'not_customer') {
      return json({ ok: false, error: '전용 링크로 가입이 확인된 UID만 신청할 수 있습니다.' }, 403);
    }
    if (check.status !== 'customer') {
      return json({ ok: false, fallback: true, error: 'Bitget 자동 확인이 잠시 안 돼요.' }, 503);
    }
  } else {
    if (!/^[0-9]{3,15}$/.test(uid)) return json({ ok: false, error: 'UID는 숫자만 입력해주세요.' }, 400);
    let referral;
    try {
      referral = await checkGateReferral(uid, env);
    } catch (err) {
      return json({ ok: false, error: err.message || 'Gate.io 조회 중 오류', detail: err.detail }, err.status || 500);
    }
    if (referral.status !== 'direct_referral') {
      return json({ ok: false, error: '전용 링크로 가입이 확인된 UID만 신청할 수 있습니다.' }, 403);
    }
  }

  const username = await getBotUsername(env);
  if (!username) return json({ ok: false, fallback: true, error: '텔레그램 봇 정보를 불러오지 못했어요.' }, 503);

  const token = randomToken();
  await env.DB.prepare(`INSERT INTO tg_link_tokens (token, uid, created_at, exchange) VALUES (?, ?, ?, ?)`)
    .bind(token, uid, Date.now(), exchange).run();

  return json({ ok: true, url: `https://t.me/${username}?start=${token}` });
}

// ───────────────────────── 웹훅 ─────────────────────────

export async function handleTelegramWebhook(request, env, ctx) {
  if (!env.TELEGRAM_WEBHOOK_SECRET ||
      request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  let update;
  try { update = await request.json(); } catch { return new Response('ok'); }
  const origin = new URL(request.url).origin;
  // 텔레그램은 응답이 늦으면 같은 업데이트를 재전송하므로 바로 200을 주고 처리는 뒤에서 함
  ctx.waitUntil(processUpdate(update, env, origin).catch(() => {}));
  return new Response('ok');
}

async function processUpdate(update, env, origin) {
  if (update.callback_query) return handleCallback(update.callback_query, env);
  if (update.chat_member) return handleChatMember(update.chat_member, env);
  const msg = update.message;
  if (!msg || !msg.chat || !msg.from) return;
  if (msg.chat.type === 'private') return handlePrivate(msg, env, origin);
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') return handleGroupMessage(msg, env);
}

// ───────────────────────── 개인 대화 ─────────────────────────

const ADMIN_HELP = [
  '🛠 스터디방 관리 봇 명령어',
  '/status — 멤버 현황 + 내보내기 대상 목록',
  '/autokick on | off — 자동 내보내기 켜기/끄기 (기본 꺼짐)',
  '/unlinked — 사이트 신청 없이 그룹에 있는 미등록 멤버 목록',
  '/kick_unlinked confirm — 미등록 멤버 내보내기 (한 번에 최대 10명)',
  '',
  '그룹 안에서 /groupid — 그 그룹의 chat_id 확인 (TELEGRAM_GROUP_CHAT_ID에 넣는 값)',
].join('\n');

async function handlePrivate(msg, env, origin) {
  const text = (msg.text || '').trim();
  const from = msg.from;

  if (text.startsWith('/start')) {
    const param = text.split(/\s+/)[1];
    if (param) return handleStartToken(param, msg, env, origin);
    if (isAdmin(env, from.id)) return sendText(env, from.id, ADMIN_HELP);
    return sendText(env, from.id,
      `안녕하세요! TEAM SIXX 스터디방 신청은 사이트에서 UID 확인 후 "텔레그램으로 신청하기" 버튼을 눌러주세요.\n${origin}/#verify`);
  }

  if (!isAdmin(env, from.id)) return;

  const [cmd, arg] = text.split(/\s+/);
  if (cmd === '/help') return sendText(env, from.id, ADMIN_HELP);
  if (cmd === '/autokick') {
    if (arg !== 'on' && arg !== 'off') return sendText(env, from.id, '사용법: /autokick on 또는 /autokick off');
    await kvSet(env, 'autokick', arg);
    return sendText(env, from.id, arg === 'on'
      ? '✅ 자동 내보내기를 켰어요. 대상자에게 경고 DM(23일차)과 내보내기(30일차)가 자동으로 진행돼요.'
      : '⏸ 자동 내보내기를 껐어요. 대상자는 알림으로만 알려드려요.');
  }
  if (cmd === '/status') return sendText(env, from.id, await buildStatus(env));
  if (cmd === '/unlinked') return sendText(env, from.id, await buildUnlinkedList(env));
  if (cmd === '/kick_unlinked') {
    if (arg !== 'confirm') return sendText(env, from.id, '정말 내보내려면 /kick_unlinked confirm 을 보내주세요. 먼저 /unlinked 로 목록을 확인하는 걸 추천해요.');
    return sendText(env, from.id, await kickUnlinked(env));
  }
}

async function handleStartToken(token, msg, env, origin) {
  const from = msg.from;
  const now = Date.now();
  const row = await env.DB.prepare(`SELECT uid, created_at, used_at, exchange FROM tg_link_tokens WHERE token = ?`).bind(token).first();
  if (!row || row.used_at || now - row.created_at > LINK_TOKEN_TTL_MS) {
    return sendText(env, from.id, `신청 링크가 만료됐거나 이미 사용됐어요. 사이트에서 다시 신청해주세요.\n${origin}/#verify`);
  }

  const exchange = row.exchange || 'gate';
  const taken = await env.DB.prepare(
    `SELECT user_id FROM tg_members WHERE uid = ? AND exchange = ? AND user_id != ? AND status IN ('pending', 'approved')`
  ).bind(row.uid, exchange, from.id).first();
  if (taken) {
    await notifyAdmin(env, `⚠️ 이미 다른 텔레그램 계정(숫자 ID ${taken.user_id})에 연결된 ${exchangeName(exchange)} UID ${row.uid}로 신청 시도\n시도한 계정: ${displayName(from)} (숫자 ID ${from.id})`);
    return sendText(env, from.id, '이 UID는 이미 다른 텔레그램 계정으로 신청돼 있어요. 운영자에게 문의해주세요.');
  }

  const existing = await env.DB.prepare(`SELECT status, uid, exchange, in_group FROM tg_members WHERE user_id = ?`).bind(from.id).first();
  await env.DB.prepare(`UPDATE tg_link_tokens SET used_at = ? WHERE token = ?`).bind(now, token).run();

  if (existing && existing.status === 'approved' && existing.uid === row.uid && (existing.exchange || 'gate') === exchange) {
    return sendText(env, from.id, existing.in_group
      ? '이미 승인된 계정이에요. 스터디방에서 만나요!'
      : '이미 승인된 계정이에요. 초대 링크가 만료됐다면 운영자에게 문의해주세요.');
  }

  await env.DB.prepare(
    `INSERT INTO tg_members (user_id, uid, username, first_name, status, linked_at, exchange)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET uid = excluded.uid, username = excluded.username,
       first_name = excluded.first_name, status = 'pending', linked_at = excluded.linked_at,
       exchange = excluded.exchange, warned_at = NULL, flagged_at = NULL, flag_reason = NULL`
  ).bind(from.id, row.uid, from.username || null, from.first_name || null, now, exchange).run();

  // 예전 신청 기록 테이블에도 남겨둠(D1 콘솔에서 한 곳만 봐도 되도록) — 거래소별 테이블에 맞춰 기록
  const joinTable = exchange === 'bitget' ? 'bitget_join_requests' : 'telegram_join_requests';
  await env.DB.prepare(`INSERT INTO ${joinTable} (uid, telegram_id, created_at) VALUES (?, ?, ?)`)
    .bind(row.uid, `${from.username ? '@' + from.username : '(아이디 없음)'} #${from.id}`, now).run();

  await sendText(env, from.id,
    '✅ 스터디방 입장 신청이 접수됐어요!\n운영자가 시드 예치를 확인한 뒤 이 대화창으로 초대 링크를 보내드릴게요.');

  await notifyAdmin(env,
    `📨 스터디방 입장 신청\n거래소: ${exchangeName(exchange)} (전용 링크 가입 자동 확인 ✅)\nUID: ${row.uid}\n텔레그램: ${displayName(from)}\n숫자 ID: ${from.id}` +
    (existing && existing.status === 'kicked' ? '\n(이전에 내보내진 적 있는 계정)' : ''),
    { reply_markup: { inline_keyboard: [[
      { text: '✅ 승인 (초대 링크 발송)', callback_data: `ap:${from.id}` },
      { text: '❌ 거절', callback_data: `rj:${from.id}` },
    ]] } });
}

// ───────────────────────── 승인/거절 버튼 ─────────────────────────

async function handleCallback(cq, env) {
  const answer = (text) => tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: text || '' });
  if (!isAdmin(env, cq.from.id)) return answer('권한이 없어요.');

  const m = /^(ap|rj):(\d+)$/.exec(cq.data || '');
  if (!m) return answer();
  const userId = Number(m[2]);
  const member = await env.DB.prepare(`SELECT * FROM tg_members WHERE user_id = ?`).bind(userId).first();
  if (!member) return answer('신청 정보를 찾을 수 없어요.');

  const editAdmin = (suffix) => cq.message && tg(env, 'editMessageText', {
    chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: `${cq.message.text}\n\n→ ${suffix}`,
  });

  if (m[1] === 'rj') {
    await env.DB.prepare(`UPDATE tg_members SET status = 'rejected' WHERE user_id = ?`).bind(userId).run();
    await sendText(env, userId, '스터디방 입장 신청이 반려됐어요. 궁금한 점은 운영자에게 문의해주세요.');
    await editAdmin('❌ 거절됨');
    return answer('거절했어요.');
  }

  if (member.status === 'approved' && member.in_group) {
    await editAdmin('이미 승인되어 그룹에 있는 멤버예요.');
    return answer('이미 승인된 멤버예요.');
  }
  if (!env.TELEGRAM_GROUP_CHAT_ID) {
    return answer('TELEGRAM_GROUP_CHAT_ID가 설정되지 않았어요. 그룹에서 /groupid 로 확인 후 설정해주세요.');
  }

  // 예전에 내보내진 사람이면 혹시 남아있을 차단을 먼저 풀어줌
  await tg(env, 'unbanChatMember', { chat_id: env.TELEGRAM_GROUP_CHAT_ID, user_id: userId, only_if_banned: true });
  const link = await tg(env, 'createChatInviteLink', {
    chat_id: env.TELEGRAM_GROUP_CHAT_ID,
    name: `UID ${member.uid}`.slice(0, 32),
    member_limit: 1,
    expire_date: Math.floor(Date.now() / 1000) + 24 * 3600,
  });
  if (!link.ok || !link.result) {
    return answer('초대 링크 생성 실패 — 봇이 그룹 관리자(초대 권한)인지 확인해주세요.');
  }
  const inviteLink = link.result.invite_link;

  await env.DB.prepare(
    `UPDATE tg_members SET status = 'approved', approved_at = ?, invite_link = ?, kicked_at = NULL, kick_reason = NULL,
       warned_at = NULL, flagged_at = NULL, flag_reason = NULL, last_check_at = NULL WHERE user_id = ?`
  ).bind(Date.now(), inviteLink, userId).run();

  const dm = await sendText(env, userId,
    `🎉 승인됐어요! 아래 링크로 스터디방에 입장해주세요. (24시간 안에 1번만 쓸 수 있는 링크예요)\n${inviteLink}\n\n` +
    `안내: 입장 후 ${INACTIVE_DAYS}일 동안 거래 기록이 없거나 전용 링크 가입이 확인되지 않으면 자동으로 내보내질 수 있어요.`);

  await editAdmin(dm.ok ? '✅ 승인됨 (초대 링크 DM 발송)' : `✅ 승인됨 — ⚠️ DM 발송 실패(봇 차단 등). 이 링크를 직접 전달해주세요: ${inviteLink}`);
  return answer('승인했어요.');
}

// ───────────────────────── 그룹 입장/퇴장/메시지 감지 ─────────────────────────

async function markJoined(env, user, now) {
  const member = await env.DB.prepare(`SELECT user_id FROM tg_members WHERE user_id = ?`).bind(user.id).first();
  if (member) {
    await env.DB.prepare(
      `UPDATE tg_members SET in_group = 1, joined_at = COALESCE(joined_at, ?), username = ?, first_name = ? WHERE user_id = ?`
    ).bind(now, user.username || null, user.first_name || null, user.id).run();
    await env.DB.prepare(`DELETE FROM tg_seen WHERE user_id = ?`).bind(user.id).run();
    return true;
  }
  await touchSeen(env, user, now);
  return false;
}

async function touchSeen(env, user, now) {
  await env.DB.prepare(
    `INSERT INTO tg_seen (user_id, username, first_name, first_seen, last_seen, in_group) VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name,
       last_seen = excluded.last_seen, in_group = 1`
  ).bind(user.id, user.username || null, user.first_name || null, now, now).run();
}

async function markLeft(env, userId) {
  await env.DB.prepare(`UPDATE tg_members SET in_group = 0 WHERE user_id = ?`).bind(userId).run();
  await env.DB.prepare(`UPDATE tg_seen SET in_group = 0 WHERE user_id = ?`).bind(userId).run();
}

async function handleChatMember(cm, env) {
  if (!isGroup(env, cm.chat.id)) return;
  const user = cm.new_chat_member && cm.new_chat_member.user;
  if (!user || user.is_bot) return;
  const status = cm.new_chat_member.status;
  const now = Date.now();
  const inGroup = status === 'member' || status === 'administrator' || status === 'creator' ||
    (status === 'restricted' && cm.new_chat_member.is_member);

  if (!inGroup) return markLeft(env, user.id);

  const linked = await markJoined(env, user, now);

  // 봇이 특정 신청자용으로 만든 1회용 링크를 다른 사람이 쓴 경우 → 바로 내보내고 운영자에게 알림
  const used = cm.invite_link && cm.invite_link.invite_link;
  if (used) {
    const owner = await env.DB.prepare(`SELECT user_id, uid FROM tg_members WHERE invite_link = ?`).bind(used).first();
    if (owner && Number(owner.user_id) !== Number(user.id)) {
      await kickUser(env, user.id);
      await markLeft(env, user.id);
      await notifyAdmin(env, `🚫 UID ${owner.uid}용 초대 링크로 다른 사람이 입장해서 내보냈어요: ${displayName(user)} (숫자 ID ${user.id})`);
      return;
    }
  }
  if (!linked) {
    await notifyAdmin(env, `ℹ️ 사이트 신청 없이 스터디방에 입장한 멤버: ${displayName(user)} (숫자 ID ${user.id})`);
  }
}

async function handleGroupMessage(msg, env) {
  const text = (msg.text || '').trim();
  if (/^\/groupid(@\w+)?$/.test(text) && isAdmin(env, msg.from.id)) {
    return sendText(env, msg.chat.id, `이 그룹의 chat_id: ${msg.chat.id}`);
  }
  if (!isGroup(env, msg.chat.id)) return;
  const now = Date.now();

  // chat_member 업데이트가 누락될 때를 대비해 서비스 메시지(입장/퇴장)도 같이 처리
  if (Array.isArray(msg.new_chat_members)) {
    for (const u of msg.new_chat_members) if (!u.is_bot) await markJoined(env, u, now);
  }
  if (msg.left_chat_member && !msg.left_chat_member.is_bot) await markLeft(env, msg.left_chat_member.id);

  if (msg.from.is_bot) return;
  const member = await env.DB.prepare(`SELECT user_id FROM tg_members WHERE user_id = ?`).bind(msg.from.id).first();
  if (member) {
    await env.DB.prepare(`UPDATE tg_members SET in_group = 1, joined_at = COALESCE(joined_at, ?) WHERE user_id = ?`)
      .bind(now, msg.from.id).run();
  } else {
    await touchSeen(env, msg.from, now);
  }
}

// ───────────────────────── 내보내기 ─────────────────────────

// ban 후 바로 unban → 그룹에서 빠지기만 하고 영구 차단은 아님(재신청하면 다시 입장 가능)
async function kickUser(env, userId) {
  const ban = await tg(env, 'banChatMember', {
    chat_id: env.TELEGRAM_GROUP_CHAT_ID, user_id: userId, until_date: Math.floor(Date.now() / 1000) + 60,
  });
  await tg(env, 'unbanChatMember', { chat_id: env.TELEGRAM_GROUP_CHAT_ID, user_id: userId, only_if_banned: true });
  return !!ban.ok;
}

async function isGroupAdminOrGone(env, userId) {
  const res = await tg(env, 'getChatMember', { chat_id: env.TELEGRAM_GROUP_CHAT_ID, user_id: userId });
  if (!res.ok || !res.result) return { error: true };
  const s = res.result.status;
  return {
    admin: s === 'administrator' || s === 'creator',
    gone: s === 'left' || s === 'kicked' || (s === 'restricted' && !res.result.is_member),
  };
}

async function buildStatus(env) {
  const count = async (sql) => ((await env.DB.prepare(sql).first()) || {}).c || 0;
  const approvedIn = await count(`SELECT COUNT(*) AS c FROM tg_members WHERE status = 'approved' AND in_group = 1`);
  const approvedOut = await count(`SELECT COUNT(*) AS c FROM tg_members WHERE status = 'approved' AND in_group = 0`);
  const pending = await count(`SELECT COUNT(*) AS c FROM tg_members WHERE status = 'pending'`);
  const kicked = await count(`SELECT COUNT(*) AS c FROM tg_members WHERE status = 'kicked'`);
  const unlinked = await count(`SELECT COUNT(*) AS c FROM tg_seen WHERE in_group = 1`);
  const autokick = (await kvGet(env, 'autokick')) === 'on';
  const flagged = await env.DB.prepare(
    `SELECT * FROM tg_members WHERE status = 'approved' AND in_group = 1 AND flagged_at IS NOT NULL ORDER BY flagged_at DESC LIMIT 15`
  ).all();

  const lines = [
    '📊 스터디방 현황',
    `자동 내보내기: ${autokick ? '켜짐 ✅' : '꺼짐 ⏸ (/autokick on)'}`,
    `그룹 설정: ${env.TELEGRAM_GROUP_CHAT_ID ? env.TELEGRAM_GROUP_CHAT_ID : '❌ TELEGRAM_GROUP_CHAT_ID 미설정'}`,
    '',
    `승인·입장 완료: ${approvedIn}명`,
    `승인됐지만 아직 미입장: ${approvedOut}명`,
    `승인 대기: ${pending}명`,
    `내보낸 멤버(누적): ${kicked}명`,
    `미등록 멤버(그룹에서 감지됨): ${unlinked}명 — /unlinked`,
  ];
  const rows = flagged.results || [];
  if (rows.length) {
    lines.push('', '⚠️ 내보내기 대상 (자동 내보내기 꺼짐이라 대기 중):');
    for (const m of rows) lines.push(`· ${memberLabel(m)} — ${m.flag_reason || ''}`);
  }
  return lines.join('\n');
}

async function buildUnlinkedList(env) {
  const res = await env.DB.prepare(`SELECT * FROM tg_seen WHERE in_group = 1 ORDER BY last_seen DESC LIMIT 30`).all();
  const rows = res.results || [];
  if (!rows.length) return '미등록 멤버가 없어요. (봇은 입장하거나 메시지를 쓴 사람만 감지할 수 있어요)';
  return ['👤 미등록 멤버 (사이트 신청 없이 그룹에 있음, 최근 활동순 최대 30명)',
    ...rows.map((r) => `· ${r.username ? '@' + r.username : '(아이디 없음)'}${r.first_name ? ' ' + r.first_name : ''} — 숫자 ID ${r.user_id}`),
    '', '이분들은 사이트에서 UID 확인 → "텔레그램으로 신청하기"를 하면 자동으로 등록돼요.',
    '정리하려면 /kick_unlinked confirm'].join('\n');
}

async function kickUnlinked(env) {
  if (!env.TELEGRAM_GROUP_CHAT_ID) return 'TELEGRAM_GROUP_CHAT_ID가 설정되지 않았어요.';
  const res = await env.DB.prepare(`SELECT * FROM tg_seen WHERE in_group = 1 ORDER BY first_seen ASC LIMIT 10`).all();
  const rows = res.results || [];
  let kicked = 0, skipped = 0;
  for (const r of rows) {
    if (isAdmin(env, r.user_id)) { skipped++; await markLeft(env, r.user_id); continue; }
    const st = await isGroupAdminOrGone(env, r.user_id);
    if (st.error) { skipped++; continue; }
    if (st.admin || st.gone) { skipped++; await markLeft(env, r.user_id); continue; }
    if (await kickUser(env, r.user_id)) { kicked++; await markLeft(env, r.user_id); } else skipped++;
  }
  const left = ((await env.DB.prepare(`SELECT COUNT(*) AS c FROM tg_seen WHERE in_group = 1`).first()) || {}).c || 0;
  return `미등록 멤버 ${kicked}명 내보냄 (관리자/이미 나간 사람 등 ${skipped}명 건너뜀).` +
    (left ? `\n남은 미등록 ${left}명 — 계속하려면 /kick_unlinked confirm 을 다시 보내주세요.` : '');
}

// ───────────────────────── 크론: 활동 검사 ─────────────────────────

export async function runMembershipCheck(env, deps) {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_GROUP_CHAT_ID || !env.TELEGRAM_WEBHOOK_SECRET) return;
  const now = Date.now();
  const autokick = (await kvGet(env, 'autokick')) === 'on';

  // 오래된 신청 토큰 정리
  await env.DB.prepare(`DELETE FROM tg_link_tokens WHERE created_at < ?`).bind(now - 7 * DAY_MS).run();

  const res = await env.DB.prepare(
    `SELECT * FROM tg_members WHERE status = 'approved' AND in_group = 1 AND (last_check_at IS NULL OR last_check_at < ?)
     ORDER BY COALESCE(last_check_at, 0) ASC LIMIT ?`
  ).bind(now - 20 * 3600 * 1000, CHECK_BATCH).all();

  for (const m of res.results || []) {
    try {
      await checkMember(m, env, deps, autokick, now);
    } catch (e) {
      // Gate.io/텔레그램 일시 오류 — 이번엔 건너뛰고 약 2시간 뒤 다시 검사(절대 오류 때문에 내보내지 않음)
      await env.DB.prepare(`UPDATE tg_members SET last_check_at = ? WHERE user_id = ?`)
        .bind(now - 18 * 3600 * 1000, m.user_id).run();
    }
  }
}

async function checkMember(m, env, deps, autokick, now) {
  const setChecked = () => env.DB.prepare(`UPDATE tg_members SET last_check_at = ? WHERE user_id = ?`).bind(now, m.user_id).run();

  if (isAdmin(env, m.user_id)) return setChecked();
  const st = await isGroupAdminOrGone(env, m.user_id);
  if (st.error) throw new Error('getChatMember failed');
  if (st.gone) { await markLeft(env, m.user_id); return setChecked(); }
  if (st.admin) return setChecked();

  // 20-51단계: Bitget 회원은 활동 검사 대상에서 뺌 — customer-list는 문서 버전에 따라 "가입 30일 이내"만
  // 조회될 수 있어서, 오래된 정상 고객이 "레퍼럴 아님"으로 잘못 잡혀 내보내질 위험이 있고, 거래 기록
  // (Gate의 commission_history에 해당하는 것)도 중계기로 아직 조회하지 않음. 그래서 Bitget 회원은
  // 운영자가 직접 관리하고, 봇은 그룹 입장/퇴장 기록만 함.
  if (m.exchange === 'bitget') return setChecked();

  let reason = null;
  let warn = false;

  const referral = await deps.checkGateReferral(m.uid, env); // 실패하면 throw → 위에서 건너뜀
  if (referral.status !== 'direct_referral') {
    reason = '전용 링크 레퍼럴이 확인되지 않음';
  } else {
    const graceStart = m.joined_at || m.approved_at || m.linked_at || now;
    const ageDays = (now - graceStart) / DAY_MS;
    if (ageDays >= WARN_DAYS) {
      const nowSec = Math.floor(now / 1000);
      const recent = await deps.fetchPartnerCommissionHistory(m.uid, nowSec - WARN_DAYS * 86400, nowSec, 0, env);
      if (recent.length) {
        await env.DB.prepare(
          `UPDATE tg_members SET last_active_at = ?, warned_at = NULL, flagged_at = NULL, flag_reason = NULL WHERE user_id = ?`
        ).bind(now, m.user_id).run();
      } else if (ageDays >= INACTIVE_DAYS) {
        const older = await deps.fetchPartnerCommissionHistory(
          m.uid, nowSec - INACTIVE_DAYS * 86400, nowSec - WARN_DAYS * 86400, 0, env);
        if (older.length) warn = true;
        else reason = `최근 ${INACTIVE_DAYS}일 동안 거래 기록 없음`;
      } else {
        warn = true;
      }
    }
  }

  if (reason) {
    if (autokick) {
      const ok = await kickUser(env, m.user_id);
      if (ok) {
        await env.DB.prepare(
          `UPDATE tg_members SET status = 'kicked', in_group = 0, kicked_at = ?, kick_reason = ?, last_check_at = ? WHERE user_id = ?`
        ).bind(now, reason, now, m.user_id).run();
        await sendText(env, m.user_id,
          `스터디방에서 내보내졌어요. (사유: ${reason})\n거래를 다시 시작하신 뒤 사이트에서 재신청하시면 다시 입장할 수 있어요.`);
        await notifyAdmin(env, `🚪 자동 내보내기: ${memberLabel(m)}\n사유: ${reason}`);
        return;
      }
      await notifyAdmin(env, `⚠️ 내보내기 실패(봇의 차단 권한 확인 필요): ${memberLabel(m)}`);
      return setChecked();
    }
    if (!m.flagged_at) {
      await env.DB.prepare(`UPDATE tg_members SET flagged_at = ?, flag_reason = ? WHERE user_id = ?`).bind(now, reason, m.user_id).run();
      await notifyAdmin(env, `⚠️ 내보내기 대상 (자동 내보내기 꺼짐): ${memberLabel(m)}\n사유: ${reason}\n자동으로 처리하려면 /autokick on`);
    }
    return setChecked();
  }

  if (warn && autokick && (!m.warned_at || now - m.warned_at > 6 * DAY_MS)) {
    await env.DB.prepare(`UPDATE tg_members SET warned_at = ? WHERE user_id = ?`).bind(now, m.user_id).run();
    await sendText(env, m.user_id,
      `안내: 최근 ${WARN_DAYS}일 동안 거래 기록이 없어요. 7일 안에 거래 기록이 없으면 스터디방에서 자동으로 내보내져요.`);
  }
  return setChecked();
}
