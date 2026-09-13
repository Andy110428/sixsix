// Cloudflare Worker (with static assets)
//
// - "/api/check-uid?uid=..." 요청은 이 파일이 직접 처리해서 Gate.io 레퍼럴 API를 조회합니다.
// - 그 외 모든 요청(index.html, join.html 등)은 정적 파일(ASSETS)로 그대로 전달합니다.
//
// ⚠️ API KEY / SECRET은 이 파일에 절대 직접 적지 않습니다.
// Cloudflare 대시보드 > 프로젝트 > Settings > Variables and Secrets 에서
//   GATE_API_KEY, GATE_API_SECRET
// 두 개를 등록해야 정상 작동합니다.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/check-uid') {
      return handleCheckUid(request, env);
    }

    // 그 외에는 전부 정적 파일로 서빙 (index.html, join.html, requirements.html 등)
    return env.ASSETS.fetch(request);
  },
};

async function handleCheckUid(request, env) {
  const url = new URL(request.url);
  const uid = (url.searchParams.get('uid') || '').trim();

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (!uid || !/^[0-9]{3,15}$/.test(uid)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'UID는 숫자만 입력해주세요.' }),
      { status: 400, headers: cors }
    );
  }

  const KEY = env.GATE_API_KEY;
  const SECRET = env.GATE_API_SECRET;

  if (!KEY || !SECRET) {
    return new Response(
      JSON.stringify({ ok: false, error: '서버에 API 키가 설정되지 않았습니다. (환경변수 GATE_API_KEY / GATE_API_SECRET 확인)' }),
      { status: 500, headers: cors }
    );
  }

  const host = 'https://api.gateio.ws';
  const prefix = '/api/v4';
  const path = '/rebate/user/sub_relation';
  const method = 'GET';
  const query = `user_id_list=${encodeURIComponent(uid)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    const bodyHash = await sha512Hex('');
    const signStr = `${method}\n${prefix}${path}\n${query}\n${bodyHash}\n${timestamp}`;
    const sign = await hmacSha512Hex(SECRET, signStr);

    const gateRes = await fetch(`${host}${prefix}${path}?${query}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        KEY: KEY,
        SIGN: sign,
        Timestamp: timestamp,
      },
    });

    const data = await gateRes.json();

    if (!gateRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Gate.io API 오류', detail: data }),
        { status: gateRes.status, headers: cors }
      );
    }

    // data.list: [{ uid, belong, type, ref_uid }, ...]
    // type: 0-시스템에 없음 / 1,2-하위 에이전트 / 3-직속 고객 / 4-간접 고객 / 5-일반 회원(내 레퍼럴 아님)
    const entry = (data.list || [])[0] || { uid: Number(uid), type: 0 };

    let status = 'not_found';
    let message = '이 UID는 Gate.io에 등록되어 있지 않거나 확인할 수 없습니다.';

    if (entry.type === 3) {
      status = 'direct_referral';
      message = '전용 링크로 가입한 회원이 맞습니다. (직속 레퍼럴)';
    } else if (entry.type === 4) {
      status = 'indirect_referral';
      message = '레퍼럴 관계는 확인되지만 직속 가입은 아닙니다. 확인이 필요합니다.';
    } else if (entry.type === 1 || entry.type === 2) {
      status = 'agent';
      message = '이 UID는 하위 에이전트로 등록되어 있습니다. (일반 가입자 아님)';
    } else if (entry.type === 5) {
      status = 'not_my_referral';
      message = 'Gate.io 회원은 맞지만, 전용 링크로 가입한 회원이 아닙니다.';
    } else {
      status = 'not_found';
      message = 'UID를 확인할 수 없습니다. 다시 확인해주세요.';
    }

    return new Response(
      JSON.stringify({ ok: true, uid: entry.uid, type: entry.type, status, message }),
      { status: 200, headers: cors }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: '조회 중 오류가 발생했습니다.', detail: String(err) }),
      { status: 500, headers: cors }
    );
  }
}

// Gate.io APIv4 서명 방식: HexEncode(HMAC_SHA512(secret, signString))
async function hmacSha512Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(sig);
}

async function sha512Hex(message) {
  const enc = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-512', enc);
  return toHex(hash);
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
