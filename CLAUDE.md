# TEAM SIXX — 프로젝트 요약 (Claude Code용)

이 문서는 claude.ai에서 진행하던 작업을 Claude Code로 이어받기 위한 요약입니다.
세션 시작 시 이 내용을 참고해서 이어서 작업해주세요.

## 프로젝트 개요 (2026-10-07 20단계 기준 — 현재 상태)

**⚠️ 2026-10-07에 "코인 선물 스터디룸" 비즈니스를 전면 폐기하고, "거래소 전용 링크 가입 → 수수료 페이백" 단일 랜딩페이지로 완전히 피벗함.** 아래가 현재 실제로 동작하는 전부이고, 이보다 아래 "레거시 히스토리" 섹션(1~19-2단계)은 전부 과거 기록이며 지금은 적용되지 않음 — 혼동하지 말 것.

- 사이트는 `public/index.html` 한 페이지뿐 (단일 랜딩페이지, 로그인/계정 없음).
- 사람들이 TEAM SIXX 전용 링크로 거래소(현재는 Gate.io만)에 새로 가입하면, 거래 수수료의 일부를 페이백 받을 수 있다는 걸 안내하는 사이트.
- 핵심 플로우 3단계: ① 전용 링크로 거래소 가입 → ② 사이트에서 UID 입력해 "전용 링크로 가입된 게 맞는지" 확인(Gate.io API) → ③ 확인되면 텔레그램 아이디+UID를 입력해 전용 텔레그램방 가입 신청 → 신청 즉시 운영자에게 텔레그램 봇 메시지로 알림이 감.
- **관리자 인터페이스가 따로 없음** — 운영자는 텔레그램으로 오는 알림만 보고 수동으로 개별 연락/안내함 (옛날 admin.html 같은 로그인형 대시보드는 없앰).
- 현재 Gate.io 페이백율은 50% — **Gate.io에서 제공 가능한 최대 요율**(2026-10-08 20-4단계에서 20%→50%로 인상, 사용자가 "게이트에서 내가 해줄 수 있는 최대 페이백"이라고 명시 확인). 정산은 매일, 보통 1시간 내외(상황에 따라 변동 가능). 다른 메이저 거래소(이름 미정)도 추가할 예정이라 index.html에 "준비중" 카드로 미리 노출해둠 — 요율이 더 오를 여지가 있다면 Gate.io 자체보다는 이 다른 거래소 쪽에서 나올 가능성이 큼.

## 배포 환경

- **호스팅**: Cloudflare Workers (Workers + Static Assets 통합 방식, "Pages" 아님)
- **배포 방식**: GitHub 저장소(`Andy110428/sixsix`)를 Cloudflare에 Git 연동 → `main` 브랜치가 업데이트되면 자동 재배포 (다른 브랜치는 배포 안 됨)
- **Deploy 명령어**: `npx wrangler deploy` (wrangler.jsonc 기반)
- **DB**: Cloudflare D1 (SQLite), 바인딩 이름 `DB`, database_name `sixsix-db` — 20단계부터는 `telegram_join_requests` 테이블 하나만 씀 (아래 "20단계" 섹션 참고)
- ⚠️ 드래그앤드롭 방식 "Upload assets"로는 `functions`/서버 코드가 인식 안 됨 — 반드시 Git 연동 + wrangler.jsonc 방식 유지할 것
- **운영 방침(중요)**: 작업은 `claude/github-file-upload-followup-lu95ef` 브랜치에서 커밋하되, 완료되면 매번 사용자한테 병합해도 되는지 묻지 말고 바로 `main`에 병합해서 push할 것 (사용자가 명시적으로 요청함 — "앞으로는 바로 병합해서 배포"). 병합 전에는 항상 `node --check src/worker.js`와 `npx wrangler deploy --dry-run`으로 검증하고 병합할 것

## 파일 구조 (20단계 기준)

```
wrangler.jsonc          Workers 설정 (assets + D1 바인딩, cron trigger는 20단계에서 제거됨)
schema.sql / schema-console.sql   D1 스키마 (telegram_join_requests 테이블 하나만 정의 — 예전 테이블은 운영 DB에 데이터와 함께 남아있지만 이 파일/ensureSchema()가 더 이상 관리하지 않음)
migration-*.sql          예전(스터디룸 시절) 마이그레이션 기록 — 지금은 미사용, 과거 기록용으로만 남겨둠
src/worker.js           서버 코드 — /api/check-uid, /api/telegram-join, /api/payback-total, /api/payback-feed + 크론
src/study-bot.js        스터디방 관리 텔레그램 봇 — /api/telegram-link, /api/telegram-webhook + 활동 검사 크론 (20-16단계)
docs/telegram-setup.md  사용자용 설정 가이드 — PC 원격작업(새 봇, Claude Code Channels) + 스터디방 봇(기존 봇) 설정 절차
public/index.html       유일한 페이지. 히어로 + 거래소 카드(Gate.io) + 이용방법 + UID 확인/텔레그램 신청 폼 + FAQ
```

예전에 있던 `public/portal.html`(스터디룸), `public/referral.html`(추천인 파트너), `public/requirements.html`/`public/join.html`(입장 조건/절차), `public/admin.html`(관리자 대시보드)은 20단계에서 전부 삭제됨.

## 핵심 플로우 & API (20단계 기준)

- `GET /api/check-uid?uid=...` — Gate.io Rebate API(`/rebate/user/sub_relation`)로 그 UID가 TEAM SIXX 전용 링크의 **직속 레퍼럴(type=3)**인지 확인. `direct_referral`이어야 통과, 그 외(간접/에이전트/무관/미등록)는 전부 실패 메시지 반환. 서명은 HMAC-SHA512, API 키에 Gate.io "Rebate" 권한이 켜져 있어야 함(레거시 히스토리에서 이미 겪은 이슈).
- `POST /api/telegram-join` — body로 `uid`/`telegram_id`를 받아서, 서버가 **다시 한 번** `checkGateReferral()`로 `direct_referral`인지 재검증(클라이언트 응답을 신뢰하지 않음) → 통과하면 `telegram_join_requests`에 저장하고 `notifyAdminTelegram()`으로 운영자에게 텔레그램 메시지 전송. 프론트는 UID 확인(①)이 성공해야만 이 2단계 입력창을 보여주지만, 어차피 서버에서도 막기 때문에 UI를 건너뛰고 API를 직접 호출해도 안전함.
- 이 두 함수 모두 `env.DB`/`env.GATE_API_KEY`/`env.GATE_API_SECRET`/`env.TELEGRAM_BOT_TOKEN`/`env.TELEGRAM_ADMIN_CHAT_ID`에 의존 — 텔레그램 쪽 두 개는 선택값(없으면 알림만 생략, 신청 저장 자체는 항상 됨).

## Gate.io API 연동

- API 키/시크릿은 절대 코드에 하드코딩하지 않음 — 환경변수(`GATE_API_KEY`, `GATE_API_SECRET`)로만 사용
- 엔드포인트: `GET /rebate/user/sub_relation` (APIv4), 서명 방식은 HMAC-SHA512
- 이 API 키에는 Gate.io 대시보드에서 "Rebate" 권한을 별도로 켜야 함 (처음에 이걸 몰라서 403 에러 겪음)
- 응답의 `type` 필드로 관계 판별: `3` = 직속 레퍼럴(가입 인정), `4` = 간접, `1/2` = 에이전트, `5` = 무관, 그 외 = 미등록
- ⚠️ Gate.io API로는 "가입 여부"만 확인 가능, 수수료/거래량은 API로 조회 불가 — 그래서 페이백 지급 자체는 사이트 밖(텔레그램)에서 운영자가 개별 안내하는 방식

## 아직 안 만든 것 / 다음에 할 일 (20단계 기준)

1. **다른 거래소 추가**: index.html 거래소 섹션에 "준비중" 카드로 자리만 잡아둔 상태 — 실제 거래소(OKX/Bybit 등)와 링크/요율이 정해지면 Gate.io 카드와 같은 구조로 하나 더 추가하면 됨(`checkGateReferral()`/`handleCheckUid`는 Gate.io 전용이라 다른 거래소를 붙이려면 그 거래소의 레퍼럴 확인 API를 별도로 조사/구현해야 함 — 거래소마다 API가 다름).
2. **텔레그램 신청 내역 조회 UI 없음**: 관리자 대시보드가 없어서, `telegram_join_requests` 테이블 내용을 보려면 D1 콘솔에서 직접 SQL로 조회해야 함. 신청이 많아지면 간단한 조회 전용 페이지가 필요할 수 있음.
3. **스터디방 봇(20-16단계)은 사용자가 웹훅/환경변수를 설정해야 동작** — `docs/telegram-setup.md` B절. 설정 전엔 사이트가 예전 @아이디 입력 방식으로 자동 대체됨.
4. **중복/스팸 신청 방지 없음**: 같은 UID/텔레그램 아이디로 여러 번 신청해도 막지 않음 — 지금은 트래픽이 적어서 문제 없지만 늘어나면 고려.
5. 레거시 히스토리에 남아있던 "아직 안 만든 것"(비밀번호 찾기, 회원 탈퇴 등)은 계정 시스템 자체가 없어졌으므로 전부 해당 없음.

---

# ⚠️ 레거시 히스토리 (2026-09-19 ~ 2026-09-23, 스터디룸+추천인+게시판 시스템 시절 기록)

**아래 2단계~19-2단계는 전부 2026-10-07 20단계에서 폐기된 옛날 비즈니스(코인 선물 스터디룸 + 추천인 파트너 프로그램 + 게시판/랭킹/관리자 대시보드)의 작업 기록입니다. 지금 코드베이스에는 적용되지 않으니, "지금 상태가 뭐지?"를 알고 싶으면 이 섹션을 읽지 말고 위쪽 "프로젝트 개요"/"파일 구조"/"핵심 플로우 & API" 섹션과 맨 아래 "20단계" 섹션만 보면 됩니다.** 그래도 이 기록을 지우지 않고 남겨둔 이유는:
- 같은 종류의 버그(CSS 캐스케이드 순서, `position:fixed`의 containing block, 모바일 `html` 배경색 누락, 폰트 `@import` 렌더링 차단 등)가 새 랜딩페이지에서도 재발할 수 있어서, 그 원인/교훈 자체는 여전히 유효함.
- D1에 그 시절 데이터(members/posts/referral_* 등)가 삭제되지 않고 그대로 남아있어서(20단계에서 "정보는 남겨두고 기능만 지워달라"고 명시적으로 확인받음), 나중에 복구하거나 참고할 일이 생기면 이 기록이 설계 의도를 설명해줌.

## 2단계 구현 완료 (2026-09-19)

사용자가 2026-09-19에 한꺼번에 요청한 등급/거래량/추천인 시스템, 전부 구현 완료:

1. **회원 등급 시스템**: `GRADES` 상수(worker.js) — 브론즈(0)/실버(10)/골드(30)/플래티넘(60), 기준은 "댓글 수 + question/profit 게시글 수" 합산(`getMemberActivity()`). 등급은 저장 안 하고 매번 계산함 (동기화 어긋날 일 없음). 강의(`lecture`) 글마다 `posts.min_grade` 설정 가능 — admin.html 글쓰기 폼에서 카테고리를 강의로 바꾸면 등급 선택 셀렉트가 나타남. `handleListPosts`/`handlePostDetail`이 조회자 등급을 확인해서 등급 미달이면 목록에서는 잠금 표시(`locked:true`)만, 상세는 403으로 막음.
2. **거래량 랭킹** (⚠️ 4단계에서 스터디룸이 아니라 일반/추천인 계정 쪽 기능으로 완전히 옮겨감 — `users.trading_volume`는 삭제되고 `general_members.trading_volume` + opt-in 방식으로 재설계됨, 아래 4단계 섹션 참고)
3. **내 정보에 거래량/랭킹/등급 표시** (⚠️ 4단계에서 portal.html "내 정보"는 등급/활동량만 남고 거래량/순위는 빠짐 — 거래량/랭킹은 이제 일반 계정 전용 기능이라 스터디룸 세션으로는 알 수 없음)
4. **추천인 코드 시스템 (2026-09-19 3단계에서 자격 조건 수정됨 — 아래 3단계 섹션 참고)**: 가입 1건당 2만원 KRW 적립, USDT-TRC20 전용, 최소 5명 추천해야 출금 가능, 최소 출금 10만원, 출금 신청 시 텔레그램 알림(설정했으면), 자동 송금 없음 — admin.html에서 관리자가 상태를 pending→approved/rejected/paid로 수동 변경. DB: `referral_codes`(회원당 1개), `referral_signups`(가입 1건당 1행, referred_uid UNIQUE로 중복 적립 방지, `qualified` 컬럼으로 확정 여부 표시), `referral_withdrawals`. 전용 페이지 `public/referral.html` 새로 만듦 — 로그인 안 해도 소개/조건은 보이고, 로그인하면 발급/대시보드/출금신청까지 한 화면에서. index.html에 배너 섹션, portal.html 하단에 프로모 카드(항상 노출) + "추천인 코드" 메뉴는 코드를 이미 발급한 회원에게만 노출(`unlock()`에서 `/api/referral/me` 조회해서 토글). 회원가입 폼(portal.html signup-form)에 "추천인 코드(선택)" 입력란 있고 `/api/signup`이 `referral_code` 받아서 처리.
5. **텔레그램 알림 인프라**: `notifyAdminTelegram()` — `TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_CHAT_ID` 환경변수 없으면 그냥 조용히 스킵(출금 신청 저장 자체는 항상 됨). 봇 생성은 @BotFather에서, chat_id는 봇과 대화 시작 후 `https://api.telegram.org/bot<TOKEN>/getUpdates`로 확인 — 사용자가 직접 설정해야 함.

## 3단계: 계정/스터디룸 분리 + 추천인 확정 조건 수정 (2026-09-19)

사용자가 Gate.io 파트너 대시보드 원본 응답(JSON)을 직접 확인해준 결과, `/rebate/partner/data/aggregated`는 **파트너 전체 합산만 주고 회원별로는 쪼개지지 않는다는 게 확정**됨 (`trading_user_count`, 합산 `trade_volume` 필드만 존재). 이와 함께 두 가지 설계 오류를 바로잡음:

1. **추천인 확정 조건이 반대로 구현되어 있었음**: "코드 발급자가 거래량 $100k 이상이어야 발급 가능" → ❌. 올바른 규칙은 **"코드 발급은 누구나 제한 없이 가능하고, 그 코드로 가입한 사람(추천받은 사람)의 거래량이 $100,000를 넘어야 그 추천 건이 확정(적립)된다"** (가입만 하고 활동 안 하는 어뷰징 방지 목적). `referral_signups.qualified` (0/1) 컬럼을 추가해서 구현 — 가입 시 0으로 시작, 관리자가 admin.html에서 그 사람의 거래량을 $100,000 이상으로 입력(`/api/admin/set-volume`)하는 순간 `checkAndQualifyReferral()`이 자동으로 1로 올림 (한 번 올라가면 되돌리지 않음). `referred_count`/`total_earned_krw`/출금 자격 심사는 전부 `qualified = 1`인 행만 집계. `/api/referral/me`가 `pending_count`(qualified=0)도 같이 내려줌.
2. **추천인 프로그램은 스터디룸 회원이 아니어도 이용 가능해야 함**: "계정이 있다"(회원가입 통과)와 "스터디룸(게시판/랭킹) 입장이 가능하다"를 분리함.
   - `users.study_room_approved` (0/1, 기본 0) 추가. 회원가입은 지금처럼 Gate.io 레퍼럴 확인만 통과하면 되고, 가입 직후엔 `study_room_approved = 0`.
   - 기존에 이미 가입해있던 회원들은 마이그레이션 때 전부 `1`로 백필됨 (안 그러면 갑자기 전원 입장 불가 되니까) — `ensureSchema()`의 ALTER 블록 안에서 컬럼이 "이번에 처음 추가된 경우"에만 실행되도록 처리해서 재실행 안전.
   - 관리자가 admin.html "회원 관리" 패널에서 UID 조회 후 "스터디룸 입장 승인"/"승인 취소" 버튼으로 토글 (`POST /api/admin/approve-member`). 지금까지 해오던 것처럼 예치 스크린샷을 텔레그램으로 받아서 수동 확인 후 승인하면 됨.
   - `getMemberUid()`(계정만 확인) vs `getApprovedMemberUid()`(계정 + 승인 확인) 두 헬퍼로 구분. 게시판(`handleListPosts`/`handlePostDetail`/`handleCreatePost`/`handleCreateComment`)과 랭킹(`handleRankings`)은 `getApprovedMemberUid` 사용, 추천인 API(`handleReferralIssueCode`/`handleReferralMe`/`handleReferralWithdraw`)는 의도적으로 `getMemberUid`만 사용 (승인 여부 무관).
   - portal.html: 로그인/회원가입은 됐는데 아직 미승인이면 `#pending-gate` 화면("승인 대기중" + 추천인 코드 링크 + 로그아웃)을 보여주고, 게시판/랭킹 탭(`#gated-content`)은 승인된 회원에게만 노출. `checkSession()`/로그인/회원가입 핸들러가 `/api/me`, `/api/login`, `/api/signup` 응답의 `study_room_approved` 필드를 보고 `unlock('member')` vs `showPending()` 분기.
   - referral.html: 기존에 있던 "$100k 미만이면 발급 불가" 안내 패널(`#not-eligible-panel`)은 완전히 제거 — 로그인만 되면(계정만 있으면) 바로 발급 가능하도록 단순화. 대시보드에 "대기중(거래량 미달)" 통계 칸 추가.

### 다음에 볼 것
- Gate.io API로는 회원별 거래량을 못 뽑는 게 확정됐으므로, 거래량은 계속 admin.html에서 관리자가 수동 입력하는 방식 유지 (자동화 시도는 보류)
- 강의 수정(UpdatePost) 시 `min_grade` 변경은 아직 UI 없음 — 필요하면 admin.html 수정 폼에 추가
- 사용자가 언급한 "Gate 파트너 대시보드 UI에는 회원별 자산 구간(0<5000, 5000<10000 식)이 부등호로 표시된다"는 점은 API로 재현 방법을 못 찾음 — 확정된 사실 아니고 참고만

⚠️ **이 3단계의 "계정 하나 + `study_room_approved` 승인 플래그" 설계는 아래 4단계에서 완전히 되돌려지고, 스터디룸 계정과 추천인 계정을 아예 다른 테이블/로그인 체계로 분리하는 쪽으로 바뀜.** 이 섹션은 그 과정을 남겨두는 기록용이고, 현재 동작하는 설계는 "4단계" 섹션 기준.

## 4단계: 스터디룸 계정과 일반(추천인) 계정 완전 분리 + Gate Read-Only API 연동 (2026-09-19)

⚠️ **이 4단계의 "계정 완전 분리(users vs general_members)" 설계는 아래 5단계에서 사용자가 반려하고 되돌림** — "회원가입을 다 똑같이 하는데, 스터디룸이나 일반 회원이나." 계정은 다시 하나(`members`)로 합쳐지고, 스터디룸 접근은 "내 정보"에서 UID를 등록하는 방식으로 바뀜. Gate Read-Only API 연동(랭킹용) 개념 자체는 5단계에서도 그대로 유지됨(테이블만 `members`로 흡수). 이 섹션은 그 과정을 남겨두는 기록용이고, 현재 동작하는 설계는 "5단계" 섹션 기준.

3단계에서 만든 "계정 하나 + `study_room_approved` 승인 플래그" 방식을 사용자가 명시적으로 반려함 — "두 개로 분리하는거야. 합치지 말고." 그리고 세 가지를 추가 요청:
1. 추천인 코드 발급자들 정보/초대현황을 한 번에 관리하는 관리자 창
2. 거래량 확인을 회원이 직접 발급하는 **Read-Only 권한 Gate.io API 키**로 받아오기 (파트너 API는 3단계에서 합산만 나온다고 확정됐으므로, 대안으로 회원 개인 키를 쓰는 방식)
3. 랭킹 시스템을 회원이 참여 여부를 직접 고를 수 있게, 참여하려면 API 연동 화면으로 안내

**계정 분리** (질문 3개로 사용자에게 직접 확인받은 설계):
- 스터디룸 계정: 기존 `users` 테이블 그대로, Gate 레퍼럴 인증만 통과하면 바로 활성화(3단계에서 추가했던 관리자 승인 절차는 삭제 — 원래 설계로 복귀). `users.study_room_approved`/`users.trading_volume` 컬럼은 `ensureSchema()`에서 `ALTER TABLE ... DROP COLUMN`으로 제거 시도(D1이 지원 안 하면 조용히 무시, 앱 동작엔 영향 없음).
- 일반(추천인) 계정: `general_members` 테이블 신설 — 이메일+비밀번호, Gate UID/스터디룸 가입 여부와 완전 무관. 세션은 `general_sessions` 테이블 + `general_session` 쿠키(7일).
- **추천인 관련 테이블(`referral_codes`/`referral_signups`/`referral_withdrawals`)은 소유자가 "스터디룸 UID"에서 "일반 계정 이메일"로 완전히 바뀜** (`owner_uid`→`owner_email`, `referred_uid`→`referred_email`). 기존 실적은 이전 대상이 아니라서 **초기화됨** (사용자가 "새로 가입 요구"로 명시적으로 확인) — `ensureSchema()`가 예전 스키마(`owner_uid` 컬럼 존재 여부로 감지)를 발견하면 3개 테이블을 통째로 DROP 후 새 스키마로 재생성.
- 회원가입 폼에서 "추천인 코드(선택)" 입력란은 portal.html(스터디룸)에서 완전히 빠지고 referral.html(일반 계정 회원가입)로 옮겨감.

**Gate.io Read-Only API 연동** (`handleGeneralConnectGateApi`, referral.html):
- 회원이 자기 Gate.io 계정에서 **Read-Only 권한만 있는** API 키/시크릿을 발급받아 입력 (UID는 직접 입력 안 받음)
- 서버가 `GET /account/detail`을 그 키로 직접 호출해서 응답의 `user_id`를 UID로 서버가 자동 확인 → `general_members.gate_uid`에 저장 (UNIQUE라서 한 UID가 여러 일반 계정에 중복 연동 안 됨)
- ⚠️ UI에 "Read-Only 권한만 쓰세요, 출금/거래 권한 요구 안 함" 문구를 명확히 노출함 (사용자가 요청한 안전 안내)
- **정확한 "거래량" 계산 로직은 아직 미확정** — Gate.io 개인 계좌 API로 누적 거래량을 어떤 엔드포인트로 뽑아야 하는지 실제 키로 테스트 못 해봐서 확정 불가 (3단계 때 파트너 API 조사와 같은 이유). 지금은 연동=소유 확인 용도까지만 구현하고, `GET /api/general/gate-account-raw`(베타 진단용, admin의 gate-rebate-raw와 같은 패턴)로 `/account/detail` 원본 응답을 볼 수 있게만 해둠. 거래량은 여전히 admin.html에서 관리자가 수동 입력(`/api/admin/general/set-volume`)하는 게 기준.

**랭킹 시스템** (opt-in, 일반 계정 전용):
- `general_members.ranking_opt_in` — 회원이 referral.html에서 체크박스로 직접 켜고 끔
- 참여를 켜려면 먼저 Gate API 연동이 되어 있어야 함(`handleGeneralRankingOptIn`이 체크) — 연동 안 했으면 에러 메시지로 API 연동부터 안내
- `GET /api/general/rankings` — 참여 동의한 사람만, 거래량 내림차순 상위 50명, 닉네임 없으면 이메일 마스킹(`maskEmail()`, 예: `ab***@gmail.com`)

**추천인 코드 발급자 관리 (관리자)**:
- `GET /api/admin/referral/issuers` — 코드를 발급한 모든 일반 계정의 코드/확정 가입자 수/대기중 수/총 적립액/총 지급완료액을 한 화면에 리스트로 보여줌 (admin.html "추천인 코드 발급자 현황" 패널)
- admin.html의 "일반 회원(추천인) 관리" 패널에서 이메일 또는 연동된 Gate UID로 검색해서 거래량을 수동 입력하면, `checkAndQualifyReferral()`이 자동으로 해당 회원이 추천받은 건들의 `qualified`를 올려줌 — 로직 자체는 3단계와 동일, 소유자만 이메일 기준으로 바뀜

**실시간 출금 피드 (공개, referral.html)**:
- `GET /api/referral/recent-withdrawals` — `status = 'paid'`인 출금만, 최근 20건, 로그인 불필요
- 닉네임/이메일과 금액을 마스킹해서 트랜잭션 피드처럼 보여줌 (`maskNickname()`: 첫/끝 글자만 남기고 `*` 처리, `maskAmount()`: 첫 자리만 남기고 나머지 `*` 처리)
- `referral_withdrawals.paid_at` 컬럼 신설(관리자가 상태를 `paid`로 바꾸는 순간 서버가 자동 기록) — 정렬 기준으로 사용
- 프론트에서 20초 간격 폴링으로 "실시간"처럼 보이게 함 (웹소켓 아님, 단순 polling)

### 다음에 볼 것 (4단계 시점 — 5단계에서 일부 내용이 바뀜, 아래 5단계 섹션 참고)
- Gate.io Read-Only 개인 키로 "누적 거래량"을 정확히 뽑아내는 엔드포인트/계산 방식 확정 — 실제 키로 테스트 후 계좌 정보 원본 응답 스키마 보고 붙이기 (5단계에서도 여전히 미해결)

## 5단계: 계정 재통합 + 추천인 파트너 승인제 + 경제 캘린더 직접 입력 + 청산맵/모바일 내비 (2026-09-19)

사용자가 4단계의 계정 분리 설계를 반려하고 다음을 요청함(요약):
1. 회원가입은 스터디룸이든 추천인이든 다 똑같이 — 스터디룸 접근은 "내 정보"에서 UID 등록 → 즉시 검증 → 통과 시 자동 허용. UID는 계정당 1개만.
2. 추천인 프로그램은 승인받은 사람만 접근 — "파트너 신청하기"(지갑주소/텔레그램/활동계획/기타사항) → 관리자 승인 필요. 신청 오면 admin.html + 텔레그램 알림.
3. 거래량 랭킹 탭은 추천인 페이지에서 빼고, 스터디룸/메인 페이지에 작은 사이드 위젯으로.
4. 경제 캘린더는 외부 위젯 대신 직접 정리 — 중요도는 별 개수, 오늘 일정뿐 아니라 다음 일정도.
5. 비트코인 청산맵 기능을 새 메뉴로 추가.
6. 게시판/메뉴가 늘어나서 모바일에서 보기 힘들어질 수 있으니 대응.

**계정 재통합**:
- `users`(스터디룸)와 `general_members`(추천인)를 `members` 테이블 하나로 합침 — `email`(로그인 식별자, UNIQUE) + `uid`(선택, UNIQUE, 스터디룸 접근용) + `gate_uid`/`gate_api_key`/`gate_api_secret`(선택, Read-Only API 연동용, 4단계 그대로 유지) + `trading_volume` + `ranking_opt_in` + `referral_partner_status`.
- `POST /api/account/register-uid` — "내 정보"(portal.html) 또는 로그인 직후 UID 미등록 게이트 화면에서 UID 입력 → `checkGateReferral()`로 direct_referral 확인 → 통과하면 `members.uid`에 저장하고 그 자리에서 스터디룸 열림. UID가 이미 다른 계정에 등록돼 있으면 409.
- `getMemberUid()`가 이제 "세션 → 이메일 → 등록된 uid" 순으로 조회 (이메일과 UID를 잇는 다리 역할). 게시판(`handleListPosts`/`handleCreatePost`/`handleCreateComment` 등)은 이 uid가 없으면 401.
- portal.html: 로그인/회원가입 폼이 이메일+비밀번호로 바뀜 (referral.html과 완전히 같은 계정/세션 공유). 로그인은 됐는데 UID 미등록이면 `#uid-gate` 화면(전용 UID 입력 폼)을 보여주고, 등록되면 바로 `unlock()`. "내 정보" 모달에 UID 등록/표시 + Gate API 연동(4단계 UI를 그대로 이쪽으로 옮김) + 랭킹 참여 토글이 다 들어감 — referral.html에는 더 이상 API 연동/랭킹 UI가 없음(스터디룸 쪽으로 통합).
- **기존 실적 초기화**: `users`/`general_members`에 있던 계정은 `ensureSchema()`가 감지해서 `members`로 마이그레이션 시도함(비밀번호 해시는 승계, `users` 쪽은 이메일이 없어서 `uid-<UID>@legacy.local` 임시 이메일로 옮겨짐 — 실사용자는 비밀번호 재설정을 통해 실제 이메일 계정을 새로 만드는 게 맞음). 추천인 코드/실적(`referral_codes` 등)은 소유자 개념이 또 바뀌어서(UID/이메일 혼재 → 통일된 이메일) 이번에도 초기화됨.

**추천인 파트너 승인제**:
- `members.referral_partner_status`: `none` → `pending`(신청함) → `approved`/`rejected`. `POST /api/referral/apply`(로그인 필요, wallet_address/telegram_id/activity_plan 필수, notes 선택)로 신청 — `referral_applications` 테이블에 기록되고 텔레그램 알림(`notifyAdminTelegram`) 발송, `members.referral_partner_status`도 같이 `pending`으로 바뀜.
- `GET /api/admin/referral/applications` + `POST /api/admin/referral/applications/update`(id, status: approved|rejected) — admin.html "추천인 파트너 신청 관리" 패널에서 승인/거절. 승인해야 `requirePartner()`를 통과해서 `handleReferralIssueCode`/`handleReferralMe`/`handleReferralWithdraw`를 쓸 수 있음(그 전엔 403).
- referral.html: 로그인 후 `members.referral_partner_status`에 따라 신청 폼 / "심사중" 안내 / 코드 발급 버튼(승인됐는데 코드 미발급) / 대시보드 중 하나를 보여줌. 거절된 경우 다시 신청 폼이 뜸(재신청 가능).

**랭킹 위젯 이동**:
- 추천인 페이지(referral.html)에서 랭킹 리더보드 섹션을 완전히 제거.
- portal.html에 작은 "🏆 거래량 랭킹 TOP 5" 사이드 위젯 추가(게시판 아래, promo-card 위) — `GET /api/rankings`(공개, 참여 동의자만) 상위 5명만 표시.
- index.html의 추천인 티저 섹션 아래에도 같은 스타일의 TOP 5 위젯 추가 — 로그인 없이도 보임.

**경제 캘린더 — 위젯 → 직접 입력**:
- `economic_events` 테이블 신설(`event_time`, `country`, `title`, `importance` 1~3, `forecast`/`previous`/`actual`). admin.html "경제 캘린더 관리" 패널에서 CRUD(`GET/POST /api/admin/economic-events`, `.../create`, `.../update`, `.../delete`).
- `GET /api/economic-events`(공개) — 최근 3일 전부터 앞으로의 일정까지 최대 100건, 시간순. portal.html 캘린더 탭이 이걸 목록으로 렌더링, 중요도는 `★★★`/`★★☆` 식으로 표시.
- investing.com iframe 위젯(`sslecal2.investing.com`)은 완전히 제거됨.
- **시드 데이터**: `ensureSchema()`가 `economic_events`가 비어있으면 실제로 조사한 근시일 일정 4건을 자동으로 넣어둠(2026-09-19 기준, WebSearch로 확인) — 9월 비농업고용지수(NFP, 10/2), 9월 CPI(10/14), 9월 PPI(10/15), FOMC 정례회의(10/28). 전부 미국 동부시간(EDT, UTC-4) 발표 시각을 UTC epoch ms로 미리 환산해서 넣음. 관리자가 이후 자유롭게 추가/수정/삭제 가능 — 이 시드는 "완전 자동 수집"이 아니라 최초 1회성 예시 데이터.

**청산맵 (새 메뉴)**:
- portal.html에 "청산맵" 탭 추가. **iframe 임베드는 하지 않음** — CoinGlass 등 청산 히트맵 서비스가 공식 무료 embed/iframe 위젯을 제공하는지 조사했지만(WebSearch) 확인 못 했고, 이 샌드박스에서 실제로 iframe이 뜨는지 테스트도 불가능해서(`X-Frame-Options`로 막혀 있으면 빈 화면만 보임) 안정성을 위해 **새 창에서 여는 링크 카드**로 구현함(`coinglass.com/pro/futures/LiquidationHeatMap?coin=BTC&type=symbol`). 나중에 실제로 iframe이 되는 게 확인되면 economic-calendar 때처럼 바꿀 수 있음.

**모바일 내비 대응**:
- portal.html 상단 탭(`#tabs`)이 게시판 5개 + 캘린더 + 청산맵 + 추천인 링크 + 내정보 + 로그아웃까지 늘어나서, `@media (max-width:860px)`에서 `#tabs`를 index.html의 햄버거 드롭다운과 같은 패턴(절대 위치 드롭다운 패널)으로 바꿈. 새 햄버거 버튼(`#tabs-menu-btn`)이 모바일에서만 보이고 클릭하면 `#tabs`에 `.open` 클래스 토글. 데스크톱에서는 기존처럼 가로 탭바 그대로.
- index.html은 원래부터 모든 화면 크기에서 햄버거 메뉴(`#menu-dropdown`)를 쓰고 있어서 추가 대응 불필요.

### 다음에 볼 것
- ~~Gate.io Read-Only 개인 키로 "누적 거래량"을 정확히 뽑아내는 엔드포인트/계산 방식 확정~~ — **6단계에서 베타로 구현.** 아래 "6단계" 섹션 참고
- CoinGlass(또는 다른 서비스)의 청산 히트맵이 실제로 iframe 임베드 가능한지 확인되면 portal.html 청산맵 탭을 링크 카드 → 임베드로 교체
- 경제 캘린더는 지금 관리자가 수동으로 계속 채워야 함 — 나중에 BLS/Fed 등 공식 일정 API를 서버에서 주기적으로 당겨오는 자동화로 업그레이드할 수도 있음 (지금은 범위 밖)
- `uid-<UID>@legacy.local` 형태로 마이그레이션된 예전 스터디룸 계정들은 실사용자가 실제 이메일로 다시 가입하거나, 관리자가 비밀번호를 재설정해서 그 임시 이메일로 로그인 후 진짜 이메일을 쓰도록 안내가 필요할 수 있음 (지금은 이메일 변경 기능 자체가 없음)

### 배포 직후 발견된 버그 2건 (같은 날 수정 완료)

5단계 배포 직후 "회원가입/로그인하면 서버 오류"가 실제로 발생함 — 원인과 교훈을 남겨둠:

1. **`sessions` 테이블 스키마 불일치**: 4단계 때 `sessions`는 `uid` 컬럼 기반(스터디룸 전용)이었는데, 5단계에서 `email` 컬럼 기반으로 스키마를 바꿨음. `CREATE TABLE IF NOT EXISTS`는 테이블이 이미 있으면 아무것도 안 하기 때문에, 운영 DB에 남아있던 예전 `uid` 기반 `sessions` 테이블이 그대로 유지되면서 `createSession()`의 `INSERT INTO sessions (token, email, ...)`가 없는 컬럼에 쓰려다 매번 실패함 — 회원가입/로그인 둘 다 막힘. **교훈: 기존 테이블 이름을 재사용하면서 컬럼 구성을 바꿀 때는 `CREATE TABLE IF NOT EXISTS`만으로는 절대 안 되고, 예전 스키마인지 감지(예: 없어야 할 컬럼으로 SELECT 시도 후 실패 여부 확인)해서 명시적으로 DROP 후 재생성하거나 마이그레이션해야 함.** 지금은 `ensureSchema()`가 `SELECT uid FROM sessions LIMIT 1`로 예전 스키마를 감지하면 `sessions`/`general_sessions`를 지우고 새로 만듦 (세션은 휘발성이라 그냥 재로그인시키는 걸로 충분, 데이터 손실 아님).
2. **`general_members` 데이터 유실 위험**: `users`→`members` 마이그레이션 코드가 `users` 테이블 데이터만 옮기고 `general_members`는 옮기지도 않은 채 그냥 DROP 하고 있었음 (실사용자 있었으면 계정이 조용히 사라졌을 것). `general_members`도 동일한 패턴으로 옮기도록 수정함.

두 버그 모두 "테이블 이름은 같은데 스키마가 여러 세션에 걸쳐 여러 번 바뀌었다"는 이 프로젝트 특유의 상황에서 나온 것 — 앞으로 스키마를 또 바꿀 일이 생기면, 컬럼이 추가되는 경우(`ALTER TABLE ADD COLUMN`)뿐 아니라 **컬럼이 이름을 바꾸거나 테이블 소유 주체가 바뀌는 경우**엔 반드시 "예전 스키마 감지 → 명시적 마이그레이션/재생성" 패턴을 써야 함 (이 파일 곳곳의 `legacyCheck`/`legacySession` 코드가 그 예시).

## 6단계: 거래량 자동 동기화(베타) + 관리자 탭 UI + 위험 구역 초기화 버튼 (2026-09-19)

사용자가 "관리자가 확인 후 반영"이라는 거래량 방식에 불만을 표해서, 계속 미해결로 남아있던 "Gate.io 개인 API 키로 거래량 자동 계산" 문제를 베타로 구현함:

- **`POST /api/account/sync-volume`**: 연동된 Read-Only API 키로 USDT 무기한 선물 체결 내역(`GET /futures/usdt/my_trades`)을 최대 5페이지(페이지당 1000건, 총 최대 5000건)까지 페이지네이션(`last_id` 커서)해서 가져오고, 계약별 `quanto_multiplier`(공개 정보, `GET /futures/usdt/contracts/{contract}`, 최대 30개 계약까지 캐싱)를 곱해 명목 거래량(USD)을 계산 → `members.trading_volume`에 직접 반영하고 `checkAndQualifyReferral()`도 같이 실행됨.
- portal.html "내 정보"에 "🔄 내 거래량 동기화 (베타)" 버튼 추가 — API 연동된 회원에게만 보이고, 누르면 그 자리에서 계산해서 갱신. **자동 스케줄러 아님, 사용자가 직접 눌러야 갱신됨** (사용자가 "자동으로 반영 안하더라도 괜찮다"고 명시적으로 확인함).
- ⚠️ **베타 — 실제 Gate.io 키로 검증되지 않음.** `my_trades`의 `last_id` 커서 파라미터명, `size`(계약 수량) × `price` × `quanto_multiplier` 계산식이 실제 API 응답과 정확히 맞는지, 그리고 거래소 정책상 조회 가능한 과거 내역 범위(전체 누적인지 최근 N개월만인지)는 전부 Gate.io 공식 문서 기반 추정이고 실제 키로 테스트해본 적은 없음. 오류 응답의 403/401은 "선물거래 읽기 권한 부족"으로 안내 메시지를 보여주지만, 이것도 추정임 — 실제로 연동해본 회원이 생기면 응답을 보고 조정 필요.
- 이 기능은 **선물(futures)만 계산**함 (현물/마진 거래량은 포함 안 됨) — 사이트가 "코인 선물" 스터디룸이라 선물 거래량이 기준이라고 판단함.
- API 키 발급 가이드(portal.html "API 키는 어떻게 발급하나요?")도 수정 — 기존엔 "지갑(Wallet)만 읽기 전용으로 켜면 충분"이라고 안내했는데, 거래량 동기화에는 `my_trades` 조회를 위한 **"선물거래(Futures Trade)" 읽기 전용 권한도 추가로 필요**해서 두 항목(지갑 + 선물거래)만 읽기 전용으로 켜라고 수정함. 나머지(현물/마진/옵션)는 여전히 비활성 권장.
- **관리자 대시보드 UI 개편**: admin.html이 패널을 전부 세로로 나열하던 방식에서 상단 탭바(현황/회원 관리/추천인/경제 캘린더/게시판 관리)로 분리됨. 회원 조회 결과도 한 줄 텍스트 대신 `.info-grid` 카드 그리드로 표시.
- **`POST /api/admin/reset-members`**: 관리자 전용, 전체 회원 계정(`members`+`sessions`) 삭제. 게시글/댓글/추천인 실적은 남기고 작성자 연결만 끊김. body에 `confirm:"RESET"` 필수, admin.html에서도 확인창 + "RESET" 직접 타이핑 요구. 테스트 중 UID가 이미 다른(마이그레이션된 legacy) 계정에 등록되어 재가입이 막히는 문제 때문에 추가됨. ⚠️ 이 세션엔 Cloudflare API 토큰이 없어서 Claude가 직접 실행 못 하고, 관리자가 admin.html 버튼을 직접 눌러야 함.

### 다음에 볼 것
- `computeFuturesVolumeUsd()`의 계산식/페이지네이션이 실제 Gate.io 응답과 맞는지 실사용자 연동 후 확인 필요 — 안 맞으면 `my_trades`/`contracts` 응답 원본을 보고 조정
- 거래량 동기화가 선물만 다루므로, 나중에 현물/마진까지 포함해야 한다는 요구가 나오면 `computeFuturesVolumeUsd`와 별개로 spot `my_trades` 합산 로직 추가 필요

## 7단계: 추천인 가입 기록 버그 수정 + 파트너 대시보드 확정/대기 분리 + 청산맵 인라인 임베드 + 내 정보 재설계 (2026-09-19)

**🐛 발견 및 수정된 심각한 버그: `/api/signup`이 `referral_code`를 완전히 무시하고 있었음.** referral.html의 회원가입 폼은 `referral_code`를 계속 body에 담아 보내고 있었지만(4단계부터), 5단계 계정 통합 때 `handleSignup`을 다시 짜면서 이 파라미터를 읽는 코드가 통째로 빠짐 — `referral_signups` 테이블에 INSERT하는 코드가 어디에도 없었음. 즉 **5단계 배포 이후로 추천인 코드로 가입해도 그 어떤 통계에도 절대 안 잡히고 있었음** (코드 발급자 대시보드, 관리자 발급자 현황, 확정 조건 전부 무의미한 상태). 사용자가 "코드를 통해 가입한 사람이 거래량을 넘어선게 확인되어야 통계에 나타나는거지?"라고 물어본 걸 계기로 코드 전체를 다시 훑다가 발견 → 즉시 수정: `handleSignup`이 이제 `referral_code`를 받아서 `referral_codes`에서 소유자를 찾고(자기 자신 코드는 무시), 가입 성공 직후 `referral_signups`에 `qualified=0`으로 INSERT함.

**파트너 대시보드에 확정/대기 회원 목록 + 남은 거래량 추가**:
- `GET /api/referral/me`가 `signups` 배열을 추가로 내려줌 — 내 코드로 가입한 회원 한 명씩, `qualified` 여부·닉네임(또는 마스킹된 이메일)·`trading_volume`·`remaining_usd`(= max(0, $100,000 - 현재 거래량)).
- referral.html 대시보드에 "내가 추천한 회원" 패널 신설 — 확정된 사람은 "✅ 확정" 배지, 아직이면 "⏳ 남은 거래량 $X" 배지로 한눈에 구분.

**내 정보(portal.html)에 가입 시 사용한 추천인 코드 표시**:
- `GET /api/me`가 `referred_by_code`/`referred_by_label`을 추가로 내려줌 — `referral_signups.referred_email = 내 이메일`로 역조회(별도 컬럼 추가 없이 기존 테이블만 사용). "내 정보 → 요약" 탭에 "추천인 코드 XXXX로 가입했어요" 박스로 표시(코드로 안 가입했으면 안 보임).

**내 정보 모달 재설계**: 한 화면에 통계/UID/API연동/랭킹/닉네임/비밀번호가 전부 세로로 나열되던 걸 admin.html 패턴과 같은 서브탭 3개(요약 / UID·API 연동 / 계정 설정)로 분리. 기존 `.auth-tabs`/`.auth-tab` 스타일 재사용. 모달 열 때마다 "요약" 탭으로 리셋됨.

**청산맵을 링크 카드 → iframe 인라인 임베드로 전환**:
- portal.html 청산맵 탭에 CoinGlass 페이지를 실제 `<iframe>`으로 삽입(반응형 `padding-top` 트릭으로 비율 유지). "새 창에서 크게 열기" 버튼은 그대로 남겨둠(iframe이 차단되거나 깨지는 경우 대비 — 아래 caveat 참고).
- ⚠️ **이 iframe이 실제로 뜨는지는 이번에도 검증 못 함.** 이 세션의 네트워크 정책이 `coinglass.com` 자체를 프록시 단에서 차단하고 있어서(Bash curl, WebFetch 둘 다 `EGRESS_BLOCKED`) `X-Frame-Options`/CSP `frame-ancestors` 헤더를 직접 확인할 방법이 없었음. 게다가 URL에 `/pro/`가 붙어있어 CoinGlass 쪽에서 유료 기능으로 취급해 임베드/비로그인 접근을 막아뒀을 가능성도 있음. 그래서 최선의 시도(best-effort)로 iframe을 넣었고, 실패해도 바로 아래 링크 버튼으로 대체 가능하게 해둠 — 실제로 배포 후 브라우저에서 빈 화면이면 그대로 링크 카드 방식으로 되돌리는 게 맞음.

**경제 캘린더 — 자동화/데이터 확장 시도했으나 보류**:
- 사용자가 "중요한 일정 아니어도 그날그날 경제일정을 올려달라"고 요청 — 실제로 코드상 중요도로 걸러내는 필터는 전혀 없고(`GET /api/economic-events`는 최근 3일 이후 전부 반환), 그냥 admin이 4개 주요 일정만 입력해놔서 적어 보였던 것뿐.
- **실제 일자별 경제지표를 조사해서 채워 넣으려 시도했으나, 이 세션의 네트워크 정책이 investing.com/tradingeconomics/bls.gov/litefinance 등 경제 캘린더 데이터를 제공하는 사이트를 전부 `EGRESS_BLOCKED`로 막고 있어서(github.com 같은 코드/문서 사이트만 허용되는 걸로 보임) 검증된 날짜를 가져올 방법이 없었음.** 확인 안 된 날짜를 지어내면 트레이딩 사이트 특성상 위험해서 임의로 채워넣지 않음.
- 대신 admin.html 경제 캘린더 관리 폼에 **"⚡ 빠른 등록" 드롭다운**을 추가함 — 자주 나오는 지표(CPI/PPI/NFP/ISM PMI/실업수당청구/소매판매/FOMC 등 30개) 제목·국가·중요도를 미리 담아둬서, 관리자가 실제 날짜/시각만 채우면 되도록 입력 속도를 높임. 자동 수집은 여전히 아님 — 관리자가 매번 직접 확인해서 등록해야 함.
- 다음에 이 작업을 다시 볼 때: (1) 이 세션 네트워크 정책에서 경제 캘린더 데이터 사이트 접근이 열리면 그때 실제 조사해서 채워넣기, 또는 (2) 진짜 자동화하려면 Cloudflare Cron Trigger + 안정적인 무료/유료 경제 캘린더 API(FMP, Trading Economics 등) 연동을 별도 프로젝트로 검토.

### 다음에 볼 것
- 청산맵 iframe이 실제로 뜨는지 배포 후 브라우저에서 직접 확인 필요 — 안 뜨면 6단계 이전의 링크 카드 방식으로 되돌릴 것
- 경제 캘린더 실제 데이터 자동 수집/주기적 갱신은 여전히 미해결 (위 캐비엇 참고)
- 7단계에서 고친 추천인 가입 기록 버그 때문에, 5단계~7단계 사이에 실제로 추천인 코드로 가입한 회원이 있었다면 그 사람들의 `referral_signups` 행이 없음 — 필요하면 관리자가 admin.html에서 수동으로 파악해서 보정해야 할 수 있음 (자동 복구 로직 없음)

## 8단계: PNL 캘린더 + 로그인 환영 토스트 + 인트로 스플래시 + 다크 그라데이션 톤 (2026-09-20)

사용자가 인스타그램 릴스(직접 접근은 이 세션 네트워크 정책상 instagram.com이 막혀있어서 못 봄 — 사용자가 말로 설명해준 걸 기반으로 구현)에서 본 "어둡고 부드러운 애니메이션, 검정-회색 그라데이션, 로그인 시 페이드인/아웃 환영 메시지, 첫 진입 시 애플 재부팅 같은 로고 스플래시" 느낌으로 리모델링 요청 + PNL 캘린더 기능 추가 요청.

**Gate.io API 파라미터 정정 (중요)**: 6단계에서 `my_trades` 페이지네이션에 `last_id` 커서를 썼는데, 이번에 GitHub의 `gateapi-php` 공식 문서(`raw.githubusercontent.com`, 이건 egress 프록시가 안 막아서 확인 가능했음)를 직접 확인해보니 **`last_id`는 Deprecated 파라미터였고, 공식적으로는 `offset` 기반 페이지네이션**을 쓰게 되어 있었음. `computeFuturesVolumeUsd()`를 `offset=page*limit` 방식으로 수정함. 그리고 `my_trades`는 "최근 6개월치만 조회 가능"하다는 공식 제약도 이때 확인함(주석에 남겨둠).

**`GET /api/account/pnl-stats` (베타)**: 연동된 Read-Only API 키로 `GET /futures/usdt/account_book?type=pnl`(실현손익 항목만 필터)을 최근 70일치, 최대 5페이지(`offset` 페이지네이션) 가져와서:
- 날짜별(UTC 기준, `FuturesAccountBook.time`이 초 단위인지 공식 문서에 명시가 안 돼있어서 다른 Gate time 필드들과의 일관성으로 추정) `change` 합산 → PNL 캘린더 데이터
- `win_rate` = change>0인 정산 건수 / 전체 정산 건수
- `pnl_30d` = 최근 30일 내 `change` 합
- `total_trades` = 전체 정산(실현손익 발생) 건수 — 체결 1건이 아니라 "포지션 정산 이벤트" 기준이라는 점 유의
- ⚠️ 이 필드들도 `computeFuturesVolumeUsd`와 마찬가지로 실제 키로 검증은 안 됨 — 베타.

**portal.html에 "내 PNL" 탭 신설**: API 미연동이면 "내 정보에서 연동하기" 안내만 보이고, 연동됐으면 승률/최근30일손익/총거래횟수 통계 카드 3개 + 월별 캘린더 그리드(초록=플러스, 빨강=마이너스, 이전 달/이번 달만 이동 가능 — 70일 fetch 윈도우 밖은 지원 안 함). "🔄 불러오기" 버튼으로 수동 갱신(자동 폴링 아님).

**디자인 리모델링**:
- `body` 배경을 단색(`--bg`)에서 위쪽이 밝은 검정-회색 방사형 그라데이션(`radial-gradient(... #1b1b20 → #101013 → --bg)`)으로 교체 — index.html/portal.html 둘 다.
- 모달(`#profile-modal`, `#post-modal`)을 `display:none/flex` 토글 방식에서 `opacity/visibility/transform` 트랜지션 방식으로 바꿔서 열고 닫을 때 부드럽게 페이드+스케일되도록 함 (기존 `.tabs` 모바일 드롭다운과 같은 패턴).
- **인트로 스플래시**: index.html/portal.html 둘 다 body 최상단에 `#intro-splash` 오버레이 추가 — "TEAM SIXX" 로고가 페이드인했다가(0.9s) 약 1.35초 유지 후 전체가 페이드아웃(0.5s)되면서 실제 페이지가 드러남. `prefers-reduced-motion: reduce`면 애니메이션 없이 바로 숨김. **페이지 로드할 때마다(첫 방문에만이 아니라) 매번 재생됨** — 애플 재부팅 애니메이션처럼 매번 보여달라는 요청이라 세션/로컬스토리지로 1회성 처리 안 함.
- **로그인 환영 토스트**: portal.html에서 로그인 성공(UID 등록까지 완료된 상태) 시에만 "환영합니다, {닉네임 또는 UID}님"이 상단에 알약 모양으로 페이드인 → 약 2.6초 유지 → 페이드아웃(총 3.4초). 세션 복원(`checkSession()`)이나 회원가입 시엔 안 뜨고, 실제 로그인 폼 제출 성공 시에만 뜸.

### 다음에 볼 것
- PNL 캘린더/통계가 실제 Gate.io 응답과 맞는지 실사용자 연동 후 확인 필요 (6단계 거래량 동기화와 같은 종류의 미검증 리스크)
- 인스타 릴스 원본을 못 봐서 사용자 설명만으로 재현함 — 실제로 보시고 "이게 아니다" 싶은 디테일 있으면 알려주면 조정
- 인트로 스플래시가 페이지 로드마다 매번 재생되는 게 반복 방문 시 거슬릴 수 있음 — 불편하다는 피드백 오면 `localStorage`로 세션당 1회만 보여주는 방식으로 바꿀 것

## 9단계: 인트로 스플래시 재설계 + PNL 진단 개선 + 전 페이지 다크 그라데이션/리빌 애니메이션 (2026-09-20)

8단계 결과물에 대한 사용자 피드백 3건을 반영:

1. **인트로 스플래시 재설계**: 작은 점(dot)+로고 조합 대신 "TEAM SIXX" 텍스트 자체를 화면 중앙에 크게(clamp(2.4rem, 9vw, 4.6rem), 흰색→골드 그라데이션 텍스트) 배치. 타이밍도 느리게 조정 — 페이드인 → 유지 → 페이드아웃 전체 3.6초(기존 1.9초에서 대폭 늘림). index.html/portal.html 둘 다 동일한 디자인으로 통일.
2. **PNL 캘린더가 안 보이는 문제**: 원인을 확정하진 못했음(실제 키로 재현 불가) — 대신 진단 가능하게 프론트를 고침. 기존엔 API 응답을 기다리는 동안, 그리고 에러 시에도 조건에 따라 화면에 아무것도 안 뜨는 경우가 있었음. 이제 탭 클릭 즉시 "불러오는 중..." 표시 → 성공/실패/거래없음 전부 명시적으로 표시되고, 실패 시 서버가 준 원본 에러 상세(`data.detail`, Gate.io 응답 그대로)까지 화면에 같이 찍어줌. **다음에 안 보이면 그 에러 메시지 내용을 그대로 캡처해서 전달해주면 진짜 원인(권한 문제인지 파라미터 문제인지)을 바로 알 수 있음.**
3. **전 페이지 다크 그라데이션 + 애니메이션 확대**: index.html/portal.html에만 있던 검정→회색 방사형 그라데이션 배경을 requirements.html/join.html/referral.html/admin.html까지 전부 적용. index.html에만 있던 스크롤 리빌 애니메이션(`.reveal` + IntersectionObserver)을 requirements.html/join.html/referral.html에도 이식(단, referral.html은 로그인 상태에 따라 JS로 `hidden` 토글되는 패널들은 제외 — `display:none`이던 요소는 IntersectionObserver가 애초에 관찰을 못 해서 나중에 `hidden=false`로 바뀌어도 `.reveal`이 계속 opacity:0으로 박혀버리는 문제가 있어서, 페이지 로드 시점에 항상 보이는 카드/패널에만 적용함). 카드류(`.cond-card`, `.full-req-card`, `.full-step`)에 hover 시 살짝 뜨는 트랜지션 추가. PNL 캘린더 날짜 칸도 순차적으로(12ms씩 지연) 페이드인되도록 함.

### 다음에 볼 것
- PNL 캘린더가 여전히 안 보이면, 이번에 추가된 에러 상세 메시지 내용을 받아서 정확한 원인(예: `account_book`이 "선물거래" 권한이 아니라 "지갑" 권한을 요구하는 경우 등) 파악 후 고칠 것
- 인스타 릴스 원본을 계속 못 보고 있음(instagram.com이 이 세션에서 막혀있음) — 사용자가 스크린샷을 첨부해주면 더 정확하게 맞출 수 있음

## 10단계: requirements.html 모바일 2단 버그의 진짜 원인 발견 (2026-09-20)

7단계에서 "고쳤다"고 한 requirements.html 모바일 2단 버그가 배포 후에도 그대로였음 — 사용자가 스크린샷으로 재현해줘서 진짜 원인을 찾음.

**진짜 원인: CSS 캐스케이드 순서 문제.** `.full-req{ grid-template-columns: 1fr 1fr; }`의 "무조건 적용" 본체 정의가 파일 안에서 `@media (max-width:860px){ .full-req{ grid-template-columns: 1fr; } }` 미디어쿼리보다 **뒤에** 있었음. CSS는 명시도(specificity)가 같으면 미디어쿼리 안이든 밖이든 상관없이 **소스 코드상 나중에 나오는 규칙이 이김** — 그래서 모바일 폭에서도 미디어쿼리가 무시되고 본체의 `1fr 1fr`이 계속 적용되고 있었음. 지난번엔 미디어쿼리 목록에 `.full-req`를 추가하기만 했지 이 순서 문제를 생각 못 해서 실질적으로 아무 효과가 없었음. 같은 파일에 있던 520px 이하용 패딩 축소 규칙(`.full-req-card{ padding:24px 20px; }`)도 똑같은 이유로 무효화되고 있었음.
**고친 방법**: 두 미디어쿼리를 각각 `.full-req`/`.full-req-card`의 본체 정의 **바로 뒤**로 옮김 (소스 순서상 나중에 오도록). 다른 파일들(index/portal/join/referral/admin)도 스크립트로 전수 검사해서 같은 패턴의 버그가 더 없는지 확인함 — 발견 안 됨.
**교훈**: 이 프로젝트에서 미디어쿼리를 추가/수정할 때는 "그 클래스를 셀렉터 목록에 넣었는지"뿐 아니라 **"그 클래스의 무조건 적용 본체 정의가 이 미디어쿼리보다 소스상 앞에 있는지"**도 반드시 확인해야 함. 확실한 방법은 미디어쿼리를 아예 그 클래스의 본체 정의 바로 뒤에 붙이는 것.

### 다음에 볼 것
- 사용자가 인스타그램 릴스를 화면 녹화(mp4)로 보내줬는데, 이 세션에 영상을 읽을 수 있는 도구가 없어서(Read 도구는 바이너리 비디오 거부, ffmpeg 설치도 패키지 미러 404로 실패) 여전히 내용을 확인 못 함 — 다음엔 영상 대신 핵심 장면 스크린샷 여러 장으로 받는 게 유일한 방법
- 사용자가 "애니메이션을 3D로 넣으면 좋겠다"는 의견을 제시함 — 아직 실제 구현 지시는 아니고 의견을 물은 것이라 바로 구현하진 않음. 다음에 논의 이어갈 것 (라이트한 호버 틸트 정도가 무거운 3D 전체 적용보다 안전하다는 게 이 세션의 추천 방향)

## 11단계: 로그인 환영 화면을 풀스크린 wipe 리빌로 교체 (2026-09-20)

사용자가 참고 앱(TradeMove로 보이는 트레이딩 대시보드) 스크린샷 2장을 보내줌 — "Welcome Back, Brandon"이 왼쪽에서 오른쪽으로 서서히 드러나며(wipe reveal) 뜨고, 잠시 후 사라지면서 대시보드가 나타나는 구조. 기존에 만들어둔 작은 알약 모양 토스트(`#welcome-toast`, 그냥 페이드인/아웃)는 이 요청과 맞지 않아서 완전히 교체함.

- `#welcome-toast` → `#welcome-splash`로 전면 재작성: 화면 전체를 덮는 풀스크린 오버레이(인트로 스플래시와 같은 검정-회색 그라데이션 배경)에 "환영합니다, {닉네임 또는 UID}님" 텍스트를 `clip-path: inset(0 100% 0 0)` → `inset(0 0% 0 0)`로 애니메이션시켜서 왼쪽→오른쪽 wipe 리빌 효과를 냄 (1.4초). 이후 0.6초간 유지하다가(정확히는 delay 2.4s에 페이드아웃 시작) 오버레이 전체가 페이드아웃되면서 사라짐 — 총 재생시간 약 3초.
- **순서를 명확히 바꿈**: 기존엔 로그인 성공 즉시 `unlock('member')`로 대시보드부터 보여주고 그 위에 토스트를 얹었는데, 이번엔 사용자가 보여준 참고 화면처럼 "환영 화면이 먼저 뜨고 → 사라지면서 → 그제서야 대시보드가 드러나는" 순서가 맞아서, `showWelcomeSplash(name, onDone)`이 콜백 패턴으로 바뀌어 **splash가 다 끝난 뒤에** `onDone` 콜백 안에서 `unlock('member')`을 호출하도록 구조를 바꿈. 로그인 폼이 있던 화면은 스플래시 오버레이(z-index 250)에 가려져서 사용자 눈엔 안 보이다가, 스플래시가 사라지는 순간 뒤에 있던 대시보드가 바로 드러나는 방식.
- 인스타 릴스 영상 자체는 이번에도 이 세션에서 재생/분석 못 함 — 사용자가 대신 보내준 핵심 장면 스크린샷 2장(정지 이미지)으로 구현함. 참고 이미지의 배경은 보라-회색 톤이었지만, 사이트의 기존 다크+골드 톤을 유지하려고 배경은 우리 테마(검정-회색 그라데이션) 그대로 쓰고 텍스트만 골드(`--cyan`)로 유지함 — 색감까지 똑같이 따라간 건 아님.

### 다음에 볼 것
- 스플래시 wipe 리빌 타이밍(1.4초 리빌 + 유지 + 0.6초 페이드아웃, 총 3초)이 실제로 봤을 때 너무 길거나 짧다는 피드백이 오면 조정
- 참고 스크린샷의 대시보드(Account Balance/PNL/Win Rate/Total Trades/Psychology Score/캘린더 위젯 레이아웃)는 이번 요청 범위 밖 — PNL 캘린더(8~9단계)와 유사한 컨셉이라 나중에 이 레이아웃도 참고해서 다듬어달라는 요청이 올 수 있음

## 12단계: 최초 진입 인트로 스플래시도 wipe 리빌로 통일 (2026-09-20)

11단계에서 로그인 후 환영 화면에만 적용했던 wipe 리빌을, 사용자가 "사이트를 처음 시작했을 때도 그렇게 바꿔달라"고 요청 — index.html/portal.html의 `#intro-splash`(로그인 여부와 무관하게 페이지 로드마다 뜨는 스플래시)도 똑같은 패턴으로 교체함.

- 텍스트를 "TEAM SIXX"에서 **"Welcome to TEAM SIXX"**로 변경(사용자가 영문으로 지정).
- 애니메이션을 기존 fade+scale(`introWordInOut`)에서 `#welcome-splash`와 동일한 `clip-path` 왼쪽→오른쪽 wipe 리빌(`introWipe`, 1.4초)로 교체. 작은 태그라인("코인 선물 프라이빗 스터디룸")은 메인 문구 wipe가 끝난 직후(1.1초 지점) 페이드인.
- 전체 재생시간을 기존 3.6초에서 **3.05초로 단축**해서 로그인 환영 화면(11단계, 총 3초)과 타이밍을 맞춤 — 사이트 전체에서 "wipe 리빌 + 약 3초"가 하나의 일관된 패턴이 되도록 통일. JS의 `hidden=true` 처리 타임아웃도 3700ms → 3050ms로 같이 조정.
- 문구 길이가 늘어나서("TEAM SIXX" → "Welcome to TEAM SIXX") 모바일에서 안 잘리도록 `font-size` clamp를 낮추고(`clamp(1.7rem, 6.5vw, 3.2rem)`) `text-align:center; max-width:90vw`를 추가해 좁은 화면에서 줄바꿈되더라도 중앙 정렬 유지.
- index.html/portal.html 양쪽 다 동일하게 적용 — 사용자가 "로그인 화면 말고도" 라고 콕 집어서 index.html(최초 진입)과 portal.html(로그인 전 진입 시의 인트로 스플래시, 로그인 후 환영 화면과는 별개)에 모두 반영.

## 13단계: 무채색 테마 전환 + 스플래시 시간 연장 + PNL 버그 수정 + 왼쪽 사이드바/대시보드 재구성 + 추천인 점검 + 가이드 확장 + PNL 거래소풍 리디자인 (2026-09-20)

사용자가 한 메시지에 8가지를 한꺼번에 요청해서 작업 단위 8개로 쪼개 순서대로 처리함:

1. **무채색(검정+회색) 테마 전환**: `:root`의 `--cyan`(#d4a24e 뮤트 골드 → **#2dd4f5 네온 시안**), `--violet`(#8a6633 딥 브론즈 → **#5b6270 뉴트럴 그레이**)로 교체 — 변수명은 프로젝트 관례대로 그대로 유지, 값만 스왑. "주황색 빼고 검은색 회색으로만" 요청에 맞춰 기본 톤은 무채색으로 가되, 버튼/강조 텍스트처럼 눈에 잘 안 띄면 곤란한 요소는 네온 시안으로 살려둠(사용자가 "눈에 안띄면 네온 추가해도 될 것 같다"고 명시적으로 허용). 6개 HTML 파일 전부 파이썬 스크립트로 일괄 치환 후 grep으로 잔존 구값 0건 확인.
2. **스플래시/환영 문구 노출 시간 연장**: index.html/portal.html의 `#intro-splash`, portal.html의 `#welcome-splash` 둘 다 CSS `animation-delay`와 JS `setTimeout` hide 값을 늘림(대략 2.4s→3.8s 딜레이, JS 타임아웃 3050ms→4450ms) — "문구 뜨는 시간이 조금 더 길어야 할 것 같다"는 요청 반영.
3. **PNL 캘린더 "연동하면 오히려 칸이 사라지는" 버그 수정**: 원인은 `loadPnlStats()`가 fetch 응답을 기다리는 동안 `#pnl-content`를 미리 보여주고 있었던 것 — 연동 전(에러 상태)엔 이 임시 표시가 우연히 남아있다가, 연동 후 실제 API가 400을 주는 예외 케이스 등에서 오히려 숨겨지는 식으로 상태가 꼬였음. `setPnlView(view)` 헬퍼를 추가해서 loading/connect/error/content 4개 상태 컨테이너를 매번 전부 hidden으로 리셋한 뒤 정확히 하나만 켜는 명시적 상태 머신으로 재작성.
4. **스터디룸 내비게이션을 상단 탭 → 왼쪽 사이드바로, 기본 화면을 "대시보드"로 전환**:
   - `#tabs`를 `@media (min-width:861px)`에서 `position:fixed; left:0; top:65px; bottom:0; width:208px;`로 고정 사이드바화(DOM 위치는 그대로 두고 CSS만으로 전환 — `position:fixed`는 부모 요소와 무관하게 뷰포트 기준으로 배치되므로 가능). `#gated-content`/`#promo-wrap`에 `margin-left:208px`을 줘서 본문이 밀리게 함. 860px 이하에서 쓰던 기존 햄버거 드롭다운(`.tabs-menu-btn`, `.tabs.open`)은 그대로 유지 — 두 미디어쿼리가 겹치지 않게 `min-width:861px`/`max-width:860px`로 정확히 나눔(10단계에서 발견한 캐스케이드 순서 버그를 의식해서, 사이드바 규칙 뒤에 그걸 덮어쓰는 무조건 적용 규칙이 소스상 뒤에 없는지 확인함).
   - 새 `<section id="dashboard-section">`을 `#gated-content` 안 첫 번째 섹션으로 추가하고, 첫 진입 시 이 섹션이 보이도록 `unlock()`의 기본 진입점을 `dashboardSection`으로 변경(기존 `#board`는 더 이상 기본 노출 아님, `hidden` 속성 추가). 대시보드는 `.dash-grid`(2열, 720px 이하에서 1열) 안에 카드 4개: 📅 다가오는 경제 일정(상위 5건), 📊 내 PNL 요약(승률/30일손익/거래횟수 미니 통계), 📢 최근 공지(상위 3건), 🏆 거래량 랭킹 TOP 5. 각 카드(랭킹 제외)에 "더보기 →" 버튼이 있어서 클릭하면 해당 전체 탭으로 이동(`data-goto`/`data-goto-cat` 속성 + 범용 클릭 위임). "거래량이나 공지사항은 사이드에 작게 떴으면 좋겠고, 눌러야 자세히 볼 수 있게"라는 요청을 이 방식으로 구현.
   - 기존에 promo-card 위에 항상 펼쳐져 있던 별도 `#rank-widget-wrap` 블록(랭킹 TOP 5)은 삭제하고 대시보드 카드 안(`#dash-rank-list`)으로 흡수 — 기존 `loadRankWidget()` 함수를 재사용하되 타겟 엘리먼트 id만 `dash-rank-list`로 변경(같은 함수가 "내 정보" 랭킹 참여 토글 성공 시에도 호출되므로 그대로 재사용).
5. **추천인 파트너 프로그램 재점검 — 실제 버그 2건 발견 및 수정**:
   - `public/referral.html`의 `loadReferralMe()`가 호출될 때마다(멤버가 승인 상태인데 코드 미발급일 때 페이지 진입/새로고침마다) `#issue-btn`에 클릭 리스너를 매번 새로 붙이고 있어서, 버튼을 누르면 발급 요청이 중복으로 나갈 수 있는 상태였음 — 리스너 등록을 함수 밖으로 빼서 `init()` 직전에 한 번만 실행되도록 수정.
   - `src/worker.js`의 `handleReferralRecentWithdrawals()`(공개 실시간 출금 피드)가 닉네임이 없는 회원의 이메일을 `maskEmail()`로 먼저 마스킹한 결과를 다시 `maskNickname()`에 넣고 있어서, 이미 마스킹된 문자열이 한 번 더 뭉개져 이상한 값으로 표시되는 버그였음 — 닉네임 있으면 `maskNickname(nickname)`, 없으면 `maskEmail(email)` 중 하나만 적용하도록 분기 수정.
6. **추천인 배너 축소/재배치**: index.html의 `#referral-teaser`를 큰 히어로 섹션에서 `.referral-banner`(가로 한 줄, 반투명 카드 + 호버 시 살짝 뜨는 트랜지션) 형태로 축소, portal.html의 `.promo-card`도 한 줄짜리 컴팩트 카드로 축소. 위치/크기는 사용자가 "너가 알아서 해"라고 명시적으로 위임한 부분이라 별도 확인 없이 진행.
7. **UID/API 키 가이드 대폭 확장**: 이 세션 네트워크 정책상 `gate.com` 도메인으로의 직접 WebFetch는 막혀있어서(`EGRESS_BLOCKED`) 스크린샷을 직접 가져다 붙이는 건 불가능했음 — 대신 WebSearch로 실제 존재하는 Gate.io 공식 헬프센터 URL을 확인해서(`https://www.gate.com/help/guide/functional_guidelines/43847/how-to-find-my-gate.io-user-id`, `https://www.gate.com/help/guide/faq/17521/how-to-utilize-api`) 가이드 본문에 "공식 가이드 바로가기(스크린샷 포함) ↗" 링크로 삽입. 검증 안 된 이미지 URL을 지어내서 `<img>`로 박아넣는 대신 정직하게 외부 링크로 처리하기로 판단. 이 과정에서 기존 가이드에 없던 새 사실도 발견해서 반영함 — **IP 화이트리스트를 비워두고 발급한 Read-Only 키는 Gate.io 정책상 90일 뒤 자동 만료**된다는 점(관련 안내 문구 추가). UID 가이드는 `#uid-gate` 화면과 "내 정보" 모달의 연동 패널 두 곳에 동일하게 있어서, 처음엔 `Edit`이 비-`replace_all` 방식이라 한쪽만 반영됐다가 grep으로 확인 후 나머지 한 곳도 동일하게 수정함.
8. **PNL 탭을 코인 거래소 스타일로 리디자인**: 기존엔 통계 박스 3개 + 밋밋한 색상(진하기 고정)의 달력만 있었는데, "게이트아이오처럼" 요청에 맞춰 아래처럼 개편:
   - **히어로 카드**(`.pnl-hero`) 신설 — 최근 70일 누적 실현손익을 큰 mono 폰트로 보여주고, 옆에 ▲수익우위/▼손실우위 배지(`.pnl-hero-badge`)와 "🔄 불러오기" 버튼을 배치(기존에 따로 있던 새로고침 버튼을 여기로 통합).
   - **통계 카드 3개**(승률/30일손익/거래횟수)에 좌측 3px 컬러 악센트(`accent-good`/`accent-bad`, 각 값의 방향에 따라 JS가 동적으로 클래스 부여)를 추가해서 증권 앱 느낌의 "티커 카드"처럼 보이게 함.
   - **일별 손익 막대그래프**(`.pnl-chart-card`) 신설 — 0선을 기준으로 위/아래로 뻗는 CSS-only 바 차트(외부 차트 라이브러리 없이 `position:absolute; bottom:50%/top:50%; height:비율*50%`로 구현), 달력과 같은 달의 데이터를 보여주고 달 이동(`renderPnlCalendar()`)에 같이 연동됨. 막대에 `title` 속성으로 날짜+정확한 금액 네이티브 툴팁도 붙임.
   - **달력 히트맵화**: 기존엔 손익이 플러스/마이너스면 무조건 같은 진하기(고정 opacity 0.1)였는데, 이제 그 달의 최대 절대값(`maxAbs`) 대비 상대적 비율로 배경/테두리 투명도를 계산해서(`0.14~0.64` 범위) 큰 손익일수록 진하게, 작은 손익일수록 연하게 — 실제 거래소 히트맵 캘린더처럼 한눈에 "이날이 유독 컸다"를 알 수 있게 함.
   - ⚠️ 이번에도 실제 Gate.io API 응답으로 검증된 건 아님(8~9단계에서 이미 밝힌 베타 상태 그대로) — 시각화만 개편했고 `computeFuturesPnlCalendar()`/`handleAccountPnlStats`의 데이터 계산 로직 자체는 이번에 건드리지 않음.

### 다음에 볼 것
- 왼쪽 사이드바가 실제 브라우저에서 860px 경계 근처(모바일 햄버거 ↔ 데스크톱 사이드바 전환 지점)에서 레이아웃이 깨지지 않는지 실기기로 확인 필요 — 이 세션에선 라이브 브라우저 테스트가 불가능해서 코드 리뷰(미디어쿼리 겹침 여부, 마진 계산)만으로 검증함
- PNL 막대그래프/히트맵도 8~9단계와 마찬가지로 실제 Gate.io 키로 받은 데이터로 눈으로 확인된 적은 없음 — 실사용자 연동 후 막대 높이/색상 강도가 기대한 대로 나오는지 확인 필요
- UID/API 가이드에 실제 스크린샷 이미지를 넣어달라는 요청은 이번에도 완전히는 못 채움(네트워크 정책상 gate.com 이미지 직접 가져오기 불가) — 나중에 이 세션 네트워크 정책이 바뀌거나, 사용자가 직접 스크린샷을 첨부해주면 실제 이미지로 교체 가능
- 추천인 배너 위치/크기는 이번에 다시 크게 바꿀 수 있는 여지를 사용자가 열어뒀음("너가 알아서 해") — 보시고 마음에 안 들면 언제든 추가 피드백 받아서 조정

## 14단계: 사이드바 진짜 원인 수정 + PNL 기능 전면 제거 + gate_api_key 불일치 버그 + 민트색 전면 재제거 + 거래량 시간별 자동 동기화 + 강의 전자책 렌더링 (2026-09-22)

13단계에서 "완료"로 기록했던 것들 중 실제로는 안 고쳐졌거나 부분적으로만 고쳐진 게 여럿 있었음 — 사용자가 스크린샷으로 재현해줘서 진짜 원인을 찾아 고침. 그리고 사용자가 "캘린더 대신 그냥 다 빼버려", "민트색 쓰지 말라고"(반복), "직접 테스트 해보고 푸시해" 등 명확한 지시를 줘서 그대로 따름. 마지막으로 강의를 전자책처럼 볼 수 있게 하는 기능을 새로 추가함.

**왼쪽 사이드바가 작은 상자로 찌그러져 보이던 버그의 진짜 원인**: `header{ backdrop-filter:blur(14px); }`가 걸려있으면, 그 `header`가 `position:fixed`인 자손 요소(`#tabs`)의 containing block이 되어버림 — `backdrop-filter`/`filter`/`transform`/`perspective`/`will-change` 중 하나라도 조상 요소에 걸려있으면 `position:absolute`뿐 아니라 **`position:fixed`도 뷰포트가 아니라 그 조상 기준으로 배치됨** (CSS 스펙 동작, 브라우저 버그 아님). 13단계에서 사이드바를 `position:fixed`로 만들 때 이 상호작용을 놓쳐서, 실제로는 header 안에 눌려있는 작은 박스로 보였던 것. `header`에 직접 걸려있던 blur를 `header::before` 가상 요소로 옮겨서 해결 — header 자체는 이제 어떤 필터도 안 걸려있어서 `#tabs{ position:fixed }`가 정상적으로 뷰포트 기준 전체 높이 사이드바로 렌더링됨.

**PNL(손익 캘린더) 기능 전면 제거**: 8~9단계에서 만들고 13단계에서 리디자인까지 했던 PNL 캘린더/히스토그램/통계 카드가 사용자 환경에서 끝내 정상 작동 확인이 안 됐고(이 세션은 실제 Gate.io 키로 검증 불가능한 구조적 한계), 사용자가 "캘린더 기능은 그냥 다 빼버려. 거래량 확인이랑 랭킹, 추천인 시스템만 멀쩡하면 돼"라고 명시적으로 요청 → `handleAccountPnlStats`/`computeFuturesPnlCalendar`, `GET /api/account/pnl-stats` 라우트, portal.html의 "내 PNL" 탭과 관련 CSS/JS 전부 삭제. 거래량 동기화(`computeFuturesVolumeUsd`/`handleSyncVolume`)와 랭킹은 이 기능과 무관해서 그대로 유지.

**`gate_api_key` vs `gate_uid` 불일치 버그**: "API 연동을 분명 했는데 계속 '연동 안 됨'으로 뜬다"는 사용자 신고로 발견. `handleMe()`가 `has_gate_api`를 `!!member.gate_uid`로 계산하고 있었음(4단계 이전 스키마의 잔재로 추정) — 그래서 UID만 등록되고 실제 Read-Only API 키/시크릿(`gate_api_key`/`gate_api_secret`)은 없는 상태에서도 "연동됨"으로 잘못 표시됐고, 반대로 진짜 연동 기능(거래량 동기화 등)은 `gate_api_key` 기준으로 정확히 막고 있어서 "UI는 연동됐다는데 기능은 안 먹는다"는 모순이 발생했음. `handleMe`와 `handleRankingOptIn`의 연동 확인 로직을 전부 `gate_api_key` 기준으로 통일해서 고침.

**민트/시안 색상 재제거 (진짜 전체 적용)**: 13단계에서 "민트 빼고 무채색으로" 요청에 `--cyan`을 `#2dd4f5`(네온 시안)로 바꿨는데, 사용자가 "민트색 쓰지 말라고"를 두 번이나 반복해서 지적함 — 그 네온 시안 자체가 민트처럼 보였던 것. 6개 HTML 파일 전부에서 `--cyan`을 완전한 무채색 계열(`#d7d9dc`)로, `--violet`도 뉴트럴 그레이로 재조정. **이 프로젝트에서 반복되는 교훈이 또 한 번 확인됨: 색상 값은 파일마다 독립된 `:root` 블록에 있어서, grep으로 6개 파일 전부를 확인하지 않으면 "고쳤다고 생각했는데 한 파일만 고쳐져 있다"는 상황이 계속 재발함.**

**거래량 시간별 자동 동기화**: 사용자가 "거래량 동기화를 자동으로 해줄 순 없어? 시간마다?"라고 요청 — `wrangler.jsonc`에 `triggers.crons:["0 * * * *"]` 추가하고 `export default`에 `scheduled(event, env, ctx)` 핸들러를 새로 구현(`syncAllVolumes()` — API 키가 연동된 회원 전원(최대 200명)을 순회하며 `computeFuturesVolumeUsd()`로 거래량을 다시 계산해서 갱신하고 `checkAndQualifyReferral()`도 같이 실행, 개별 회원 실패는 건너뛰고 계속 진행). 기존 수동 버튼("🔄 지금 바로 동기화")은 "지금 바로 반영하고 싶을 때만" 쓰는 용도로 문구만 수정해서 유지. ⚠️ Cloudflare 계정에 실제로 Cron Trigger가 등록됐는지는 이 세션에서 Cloudflare API 인증이 없어서 확인 불가 — 대시보드 Workers → sixsix → Settings → Triggers에서 직접 확인 필요.

**강의를 전자책처럼 볼 수 있게 렌더링하는 기능 신설**: ⚠️ **이 기능은 배포 직후 15단계에서 사용자가 전면 반려하고 완전히 다른 방식(카드 + 외부 링크)으로 교체됨 — 아래 "15단계" 섹션 참고.** 이 문단은 그 과정을 남겨두는 기록용이고, 현재 동작하는 설계는 "15단계" 기준. 사용자가 노션 페이지와 스크린샷 2장을 예시로 보여주며 요청 — 강의 게시글을 제목+자동 목차+소제목+굵은 글씨+정의박스(콜아웃)+태그 칩으로 꾸밀 수 있게, 그리고 "나중에 영상 강의도 올릴 거라 미리 몇 가지 기능을 추가해달라"고 함.
- **DB**: `posts.images_data` 컬럼 신설(JSON 문자열로 저장된 base64 이미지 배열) — 기존에 목록 썸네일로 쓰이는 단일 `image_data`/`thumb_data`와는 완전히 별개, 본문 안에 여러 장 삽입하는 용도.
- **문법(마크다운 라이트, `category==='lecture'`에만 적용)**: `## 소제목`(목차 자동 생성), `**굵게**`, `---`(구분선), `> 제목 | 내용`(콜아웃 박스), `> 제목 | 내용 | 태그1,태그2`(콜아웃 + 태그 칩), `[img:N]`(N번째로 올린 이미지를 그 위치에 삽입), `[video:유튜브URL]`(유튜브 링크면 그 자리에 iframe 임베드, 아니면 "🎬 영상 보기" 링크로 대체 — 영상 강의를 미리 대비해둔 부분).
- **admin.html**: 카테고리를 "강의"로 바꾸면 문법 도움말(`<details>`)과 다중 이미지 업로드 입력(`#post-images`, 최대 10개)이 나타남 — 선택한 파일들을 base64로 변환해서 `[img:N]` 번호가 매겨진 썸네일 미리보기로 보여줌. 글 수정 시에도 기존 `min_grade`를 정확히 복원하도록 고침(예전엔 수정 폼을 열어도 등급이 항상 "제한 없음"으로 초기화되는 자잘한 버그가 있었음 — 이번에 같이 고침). 이미지를 새로 선택하지 않고 수정하면 기존 이미지가 그대로 유지됨("기존 이미지 N개가 등록돼 있어요" 안내 문구로 알려줌).
- **portal.html**: `renderLectureContent()`가 위 문법을 파싱해서 HTML로 렌더링 — 목차는 클릭하면 모달 안에서 해당 소제목으로 부드럽게 스크롤됨. 강의가 아닌 다른 카테고리(공지/브리핑/질문/수익인증)는 기존처럼 그냥 텍스트로만 표시되고 이 렌더러를 전혀 타지 않음.
- 로컬 `wrangler dev` + Playwright로 실제 검증함: admin.html에서 이미지 2장 + 위 문법 전부를 넣어 강의 글을 등록 → 수정까지 테스트(이미지/등급 유지 확인) → 실제 회원 계정으로 로그인해서 portal.html에서 목차 4개·콜아웃 박스(태그 2개)·이미지 2장·영상 임베드 1개가 전부 정상 렌더링되는 걸 스크린샷으로 확인.

### 다음에 볼 것
- Cron Trigger가 실제 Cloudflare 계정에 등록됐는지 대시보드에서 직접 확인 필요 (이 세션은 확인 불가)
- 강의 렌더링에 `[video:URL]`을 실제로 써서 영상 강의를 올려본 적은 아직 없음 — 유튜브가 아닌 다른 영상 플랫폼(예: Vimeo, 직접 업로드한 mp4 등)을 쓰고 싶어지면 `extractYoutubeId()` 옆에 그 플랫폼용 분기를 추가하면 됨
- 사이드바 컨테이닝 블록 버그는 이 프로젝트에 재발 가능성이 있는 패턴 — 앞으로 `header`나 다른 상위 요소에 `backdrop-filter`/`filter`/`transform`을 추가할 일이 생기면, 그 안에 `position:fixed` 자손이 있는지 먼저 확인할 것

## 15단계: 강의 전자책 기능 전면 반려 → 카드+외부링크 방식으로 교체 + 사이드바 여백 조정 (2026-09-22)

14단계에서 막 배포한 "강의를 노션처럼" 기능을 사용자가 바로 반려함 — "그냥 강의 관련 기능 다 지우고, 내가 1강 2강 이런식으로 버튼 누르면 내가 입력한 링크로 이동하게 해줘." 사이트의 메인 기능은 시황 브리핑·거래량 랭킹·공지사항이고 강의는 부차적인 기능이라는 점을 명확히 함. 요구사항을 정리하면: (1) 강의 게시글마다 미리보기 사진을 네모박스에 넣고, (2) 그 밑에 제목, (3) 그 밑에 작은 소개 문구, (4) 맨 밑에 "수강하러가기" 버튼을 누르면 관리자가 입력해둔 외부 링크로 이동. 추가로 "메뉴가 왼쪽 사이드에 너무 따닥따닥 붙어있는데 사이트엔 빈 공간(여백)이 너무 많다"는 지적도 함께 처리.

**강의 렌더링 전면 교체 (전자책 → 링크 카드)**: 14단계에서 만든 `renderLectureContent()`(목차/콜아웃/굵게/이미지 삽입/영상 임베드 파서), `buildLectureWatermarkSvg()`(워터마크), 복사/캡처 방지 이벤트 리스너, 관련 CSS(`.lecture-toc`/`.lecture-content`/`.callout-*`/`.tag-chip`/`.lecture-wrap`/`.lecture-watermark` 등)를 portal.html에서 전부 삭제. admin.html의 다중 이미지 업로드(`#post-images`, 최대 10장)와 마크다운 문법 도움말(`<details>`)도 전부 삭제.
- **DB**: `posts.images_data`(JSON 이미지 배열) 컬럼을 `posts.external_url`(TEXT, 단일 링크)로 교체 — `ensureSchema()`가 `ALTER TABLE posts DROP COLUMN images_data`를 시도(D1이 지원 안 하면 조용히 무시, 이 프로젝트에서 반복돼온 안전한 컬럼 정리 패턴)하고 `ALTER TABLE posts ADD COLUMN external_url TEXT`로 새 컬럼을 추가함. `schema.sql`/`schema-console.sql`에도 문서화 차원에서 `external_url TEXT`를 반영해둠(실제 운영 DB는 `ensureSchema()`가 처리하고 이 파일들은 참고용).
- **worker.js**: `validateImagesData()` → `validateExternalUrl()`로 교체 — 강의 게시글은 `http://` 또는 `https://`로 시작하는 링크가 필수(없으면 400). `handleListPosts`가 강의 카테고리일 때만 `posts.content`/`posts.external_url`을 목록 응답에 같이 내려주도록 수정(다른 카테고리는 기존처럼 목록에서 본문을 안 내려서 payload를 가볍게 유지) — 카드에 짧은 소개와 링크를 보여주는 데 상세 조회 API를 한 번 더 안 타도 되게 하기 위함.
- **admin.html**: 강의 카테고리를 선택하면 기존 대표 이미지 업로드(`#post-image`, 다른 카테고리의 "썸네일"과 같은 필드를 재사용 — 강의 카드의 미리보기 사진으로 그대로 씀)에 더해 "수강 링크" 텍스트 입력(`#post-external-url`)이 나타남. 링크를 안 넣으면 등록/수정 버튼을 눌러도 클라이언트에서부터 막힘("강의는 수강 링크(외부 URL)를 입력해야 합니다.").
- **portal.html**: "강의" 탭을 클릭하면 기존의 세로 리스트(`.post-list`) 대신 그리드 카드(`.lecture-grid` → `.lecture-card`)로 렌더링됨 — 카드 순서는 위에서부터 `.lecture-card-img`(미리보기 사진, 없으면 🎬 플레이스홀더) → `.lecture-card-title`(제목) → `.lecture-card-desc`(짧은 소개, 3줄 초과 시 말줄임) → `.lecture-card-btn`("수강하러가기 →", `target="_blank"`로 새 탭에서 외부 링크로 이동). 카드를 클릭해도 게시글 상세 모달은 더 이상 열리지 않음 — 버튼이 클릭 대상의 전부. 등급 제한(`min_grade`) 걸린 강의는 자물쇠 아이콘 플레이스홀더 카드로 표시되고 버튼도 비활성(3단계부터 있던 `posts.min_grade`/등급 게이팅 로직 자체는 이번에 안 건드림 — 렌더링 방식만 바뀜).
- **버그 발견 및 수정**: 이 작업을 테스트하다가 `startEdit(post)`가 게시글 카테고리 `<select>`의 값을 절대 설정하지 않고 그냥 `disabled`만 시키고 있었다는 걸 발견함 — 그래서 "수정" 버튼을 눌렀을 때 폼의 카테고리 값이 그 글의 실제 카테고리가 아니라 "관리자가 마지막으로 선택해뒀던 값"(대부분 드롭다운 첫 항목인 "공지사항")으로 남아있었음. 이번 작업 전까지는 수정 시 카테고리 값을 실제로 참조하는 로직이 없어서 티가 안 났는데, 강의 수정 시 "카테고리가 강의인지"로 외부링크 필수 여부를 판단하는 로직을 넣으면서 처음으로 드러남(강의를 수정하는데 카테고리가 "공지사항"으로 읽혀서 "링크를 입력하라"는 오류가 계속 뜸). `startEdit()` 맨 앞에 `document.getElementById('post-category').value = post.category;`를 추가해서 수정 — 이 프로젝트에 실제로 존재하던 버그였고, 앞으로 카테고리 값에 의존하는 다른 수정 로직을 추가할 때도 이 부분을 먼저 확인해야 함.

**왼쪽 사이드바 여백/크기 조정**: `#tabs`(데스크톱 고정 사이드바, `min-width:861px`)의 `gap`을 2px→8px, `padding`을 `22px 14px`→`32px 18px`, `width`를 208px→240px로 늘리고, `.tab-link`/`.icon-btn`의 `padding`을 `13px 16px`, `font-size`를 1rem으로 키움. 또한 메뉴 항목을 논리적으로 묶어주는 `.tabs-divider`(얇은 구분선)를 "경제 캘린더"(게시판/캘린더 탭 끝) 뒤와 "관리자 페이지로"(외부 링크류 끝) 뒤에 추가해서 그룹을 시각적으로 나눔 — 모바일 햄버거 드롭다운(`max-width:860px`)은 이 구분선에 별도 스타일을 안 줘서(빈 `<div>`라 높이 0) 기존 모습 그대로 유지됨. Playwright로 데스크톱/모바일 스크린샷을 비교해서 모바일 쪽은 전혀 안 바뀌었고 데스크톱 사이드바만 여유 있게 커진 것을 확인함.

### 다음에 볼 것
- 강의 카드용 "미리보기 사진"은 기존 `image_data`/`thumb_data`(다른 카테고리의 썸네일과 같은 필드)를 그대로 재사용함 — PDF 업로드도 여전히 허용되는 필드라서, 관리자가 실수로 PDF를 강의 미리보기로 올리면 카드에 이미지가 하나도 안 뜨고 플레이스홀더(🎬)만 보임. 지금은 별도 경고 문구가 없음 — 필요하면 admin.html에 안내 추가할 것
- `posts.external_url` 검증은 `http(s)://`로 시작하는지만 확인함 — 실제로 접속 가능한 주소인지까지는 서버가 확인 안 함(관리자가 오타/깨진 링크를 넣으면 그대로 저장됨)
- 등급 제한(`min_grade`) 걸린 강의 카드는 자물쇠 플레이스홀더로 표시되는데, 실제 등급 시스템으로 막힌 강의를 실제로 만들어서 화면으로 확인하지는 않음(로직상 카드 렌더링 분기만 코드 리뷰로 확인) — 필요하면 실제로 등급 낮은 계정으로 확인해볼 것

## 16단계: 로그인 전에도 사이드바 메뉴가 보이던 버그 수정 (2026-09-23)

사용자가 "스터디룸 이동해서 로그인하기 전엔 메뉴들이 안 떴으면 좋겠다"고 요청 — 실제로 로그인 전(로그인 폼 화면, 회원가입 직후 UID 미등록 게이트 화면)에도 왼쪽 메뉴(데스크톱 사이드바)/햄버거 버튼(모바일)이 그대로 노출되고 있던 진짜 버그였음.

**원인**: JS(`lock()`/`showUidGate()`)는 처음부터 `#tabs`에 `hidden` 속성을 정확히 걸고 있었는데, CSS가 이걸 다시 덮어쓰고 있었음.
- 데스크톱(`@media (min-width:861px)`): 13단계에서 사이드바를 만들 때 넣은 `#tabs{ display:flex !important; ... }`가 무조건 적용되면서, 브라우저 기본 스타일(`[hidden]{ display:none }`, `!important` 아님)을 author 쪽 `!important` 선언이 그냥 이겨버림 — `hidden` 속성 자체는 살아있지만 화면엔 계속 떠 있었음.
- 모바일(`@media (max-width:860px)`): `!important`는 없었지만, 미디어쿼리 밖의 기본 규칙 `.tabs{ display:flex; ... }`가 이미 author 우선순위로 UA의 `[hidden]` 규칙을 이겨버리는 상태였음. 모바일에서 그나마 안 보였던 건 `.tabs`가 `.open` 클래스 없이는 `opacity:0; visibility:hidden;`이라 우연히 가려져 있었던 것뿐 — 정작 햄버거 버튼(`#tabs-menu-btn`)은 `hidden` 속성이 아예 없는 별개 요소라 로그인 여부와 무관하게 항상 노출되고 있었고, 눌러버리면(`.open` 토글) 로그인 전에도 전체 메뉴가 드러날 수 있는 상태였음.

**고친 방법**: `hidden` 속성과 CSS 캐스케이드를 계속 힘겨루기 시키는 대신, `body.studyroom-active`라는 단일 상태 클래스를 새로 도입 — `unlock()`/`lock()`/`showUidGate()`가 이 클래스를 켜고 끄는 걸로 통일하고, `body:not(.studyroom-active) #tabs, body:not(.studyroom-active) .tabs-menu-btn{ display:none !important; }` 한 줄로 두 요소(데스크톱 사이드바 + 모바일 햄버거 버튼) 모두를 화면 크기와 무관하게 확실히 숨김. 13단계 때 사이드바 폭만큼 본문을 밀어주던 `#gated-content`/`#promo-wrap`의 `margin-left:240px`도 같은 클래스가 있을 때만 적용되도록 바꿔서, 로그인 전에 (공개로 노출되는) 추천인 프로모 카드가 사이드바 없이 240px 빈 여백만 먹는 어색한 레이아웃이 되는 것도 같이 방지함.
- 로컬에서 Playwright로 데스크톱(1440px)/모바일(390px) 둘 다 로그인 전 화면을 스크린샷·`display` 값으로 확인해서 완전히 안 보이는 것 확인, 회원가입 직후 UID 미등록 상태에서도 계속 안 보이는 것 확인, UID 등록 후 새로고침하면 정상적으로 다시 나타나는 것까지 확인 후 배포함.

### 다음에 볼 것
- 이 프로젝트에서 `display:flex !important`나 무조건 적용되는 `display` 규칙을 요소에 걸 때는, 그 요소가 `hidden` 속성으로 토글되는 대상인지 먼저 확인해야 함 — 필요하면 이번처럼 상태를 나타내는 body/부모 클래스를 만들어서 그 클래스 기준으로 `display:none !important`를 명시적으로 얹어주는 패턴을 재사용할 것

## 17단계: 실사용자 오픈 전 전체 코드 리뷰 + 입력 검증 강화 (2026-09-23)

사용자가 "이제 진짜 사람들한테 배포할건데... 처음 첫자부터 마지막 한자까지 오류 없는지, 개선하면 좋을 점 뭐가있는지 확인해서 배포해줘"라고 요청 — `src/worker.js` 전체(약 1800줄)와 `public/*.html` 6개 파일 전부를 처음부터 끝까지 읽으며 점검함.

**점검 결과**: 심각한 버그는 발견되지 않음. 특히 아래 항목들을 집중 확인함:
- 모든 API 핸들러의 인증 체크(`getIsAdmin`/`getMemberEmail`/`getMemberUid`) 누락 여부 — 전부 정상.
- SQL 인젝션 — 모든 쿼리가 예외 없이 `.bind()` 파라미터 바인딩을 사용, 문자열 결합으로 값을 끼워넣는 곳 없음 (카테고리별 `ORDER BY`/추가 컬럼처럼 SQL에 직접 꽂아넣는 부분은 화이트리스트로 걸러진 고정 상수만 사용해서 안전).
- XSS — 6개 파일의 `.innerHTML` 대입 지점을 전부 확인, 사용자 입력(닉네임/제목/댓글/지갑주소/텔레그램아이디/활동계획 등)을 넣는 곳은 예외 없이 `escapeHtml()`을 거치고 있었음. `target="_blank"` 링크도 전부 `rel="noopener"` 동반 확인.
- 문법 오류 — `node --check`(worker.js) + 6개 파일의 인라인 `<script>`를 전부 추출해서 `new Function()`으로 구문 검사, `<div>` 개수 균형, 내부 링크(`href="*.html"`) 존재 여부, HTML `id` 중복 여부까지 전수 확인 — 전부 이상 없음.

**발견해서 고친 개선점 (실제 버그는 아니지만 실사용자 오픈 전에 막아두는 게 맞다고 판단한 것들)**:
1. **첨부파일 데이터 URI 검증 없음**: `handleCreatePost`가 `image_data`/`thumb_data`를 용량 제한(1.5MB/150KB)만 확인하고 실제로 `data:image/...`나 `data:application/pdf...` 형식인지는 전혀 확인하지 않고 있었음. 업로드 UI를 거치지 않고 API를 직접 호출하면(예: 브라우저 개발자도구, curl) 임의의 `data:` URI 문자열을 그대로 저장할 수 있는 구조였음. `isValidImageDataUri()`/`isValidAttachmentDataUri()` 정규식 검증을 추가해서 실제 이미지/PDF data URI 형식이 아니면 거부하도록 막음.
2. **자유 입력 필드에 길이 제한이 전혀 없었음**: 게시글 제목/내용(작성·수정 둘 다), 댓글 내용, 추천인 파트너 신청서(지갑주소/텔레그램아이디/활동계획/기타사항), 추천인 출금 신청서(텔레그램아이디/지갑주소) — 전부 "비어있지 않은지"만 확인하고 상한이 없어서, 요청 한 번으로 임의로 큰 텍스트를 DB에 저장할 수 있었음. 제목 200자, 게시글 내용 20,000자, 댓글 3,000자, 지갑주소 200자, 텔레그램아이디 100자, 활동계획/기타사항 3,000자로 각각 상한을 추가함.
- 로컬 `wrangler dev` + Playwright로 검증: (1) admin.html/portal.html에서 정상적인 이미지 첨부 업로드가 여전히 잘 되는지, (2) API를 직접 호출해서 악성 `data:text/html,...` 문자열을 넣었을 때 거부되는지, (3) 300자짜리 제목이 거부되는지, (4) 6개 페이지 전부 콘솔 에러 없이 로드되는지까지 전부 확인 후 배포.

**검토했지만 이번엔 손대지 않기로 한 것들** (버그는 아니고, 손댈 경우 리스크/범위가 더 커서 사용자에게 알리고 넘어간 항목):
- 관리자 로그인(`/api/admin/login`)에 브루트포스 방지(IP 제한/시도 횟수 제한)가 없음 — 6단계에서 운영자 IP가 계속 바뀌는 문제로 의도적으로 제거했던 것이라, 되살리려면 D1에 시도 기록을 남기는 새 로직이 필요해서 이번 범위 밖으로 둠. `ADMIN_PASSWORD`가 충분히 길고 무작위인 값인지 확인하는 걸 권장.
- 회원가입/로그인/UID 확인(`/api/check-uid`)에 캡차나 요청 속도 제한이 없음 — 지금은 트래픽이 적은 비공개 스터디룸이라 당장 문제는 아니지만, 실사용자가 늘어나면 스팸 가입 방지책을 고려할 수 있음.
- "회원 탈퇴(계정 자진 삭제)" 기능은 여전히 없음(문서에 계속 todo로 남아있던 항목) — 관리자가 admin.html에서 대신 처리하거나 "전체 회원 초기화" 버튼으로만 가능.
- `Access-Control-Allow-Origin: *`가 모든 JSON 응답에 붙어있음 — `Access-Control-Allow-Credentials`가 같이 설정되어 있지 않아서 실제로 쿠키 인증이 필요한 요청을 외부 사이트가 크로스 오리진으로 가로채는 건 브라우저가 막아주지만(자격증명 미포함 요청만 가능), 애초에 프론트/API가 같은 오리진(Cloudflare Workers 하나)이라 이 헤더 자체가 불필요함 — 제거해도 되지만 지금 당장 위험한 상태는 아니라 이번엔 그대로 둠.

### 다음에 볼 것
- 위 "검토했지만 손대지 않은 것들" 중 실사용자가 늘어나면서 실제로 문제가 될 조짐(스팸 가입, 관리자 계정 무차별 대입 시도 등)이 보이면 그때 우선순위 높여서 다룰 것

## 18단계: 스터디룸 빈 공간 재조정 + 추천인 파트너 등록 현황/권한 해제 기능 (2026-09-23)

사용자가 "스터디룸에 빈 공간이 너무 많아, 메뉴를 키우든 뭘 키우든 해서 여백을 조금만 채우자"고 요청. 실제로 1920px 데스크톱 화면에서 렌더링을 직접 측정해보니 사이드바(240px) 다음에 본문(`.wrap`)이 `max-width:920px`로 제한된 채 남은 공간 안에서 다시 가운데 정렬되고 있어서, 화면 양옆에 각각 최대 380px씩(!) 빈 여백이 뜨고 있었음(화면이 넓을수록 더 심해지는 구조적 문제) — 15단계에서 사이드바 자체의 padding/폰트는 키웠지만 이 본문 폭 문제는 그대로 남아있었던 것.

**본문 폭 확장**: `.wrap`의 `max-width`를 920px → **1240px**로 확장(대시보드/게시판/캘린더 섹션이 전부 이 클래스를 공유해서 한 번에 적용됨). 사이드바도 240px → 264px로 한 번 더 키우고 탭/아이콘 버튼 패딩·폰트도 소폭 확대. 대시보드 카드(`.dash-grid`/`.dash-card`)도 gap/padding을 키워서 넓어진 폭에 맞게 카드 내용이 더 여유 있어 보이도록 함. 이 작업 중에 **`footer`가 사이드바 폭만큼 밀어주는 `margin-left` 보정 대상에서 빠져 있던 것도 함께 발견해서 고침** — 이전까지는 화면 폭이 861~920px 사이의 좁은 데스크톱 구간에서는 footer 텍스트가 고정된 사이드바 뒤에 가려질 수 있는 상태였음(`body.studyroom-active footer`도 같이 `margin-left` 적용).

**추천인 파트너 "등록 회원" 현황 + 권한 해제 기능**: 사용자가 "추천인 프로그램 같은 경우는 등록 회원을 따로 볼 수 있게 해서 필요할 경우 권한을 제거하는 기능도 넣어달라"고 요청. 기존엔 admin.html에 "파트너 신청 관리"(대기/승인/거절 신청 목록)와 "코드 발급자 현황"(코드를 실제로 발급받은 사람만)만 있어서, "승인은 됐지만 아직 코드는 안 받은 사람"을 포함한 전체 파트너 현황을 한눈에 보거나 승인을 되돌릴 방법이 없었음.
- `members.referral_partner_status`에 새 값 **`revoked`**를 추가(기존 none/pending/approved/rejected에 추가) — 승인을 되돌리는 전용 상태로, "거절"(애초에 승인 안 됨)과 의미를 구분함.
- `GET /api/admin/referral/partners`(신설) — 현재 승인됐거나(approved) 과거에 해제된(revoked) 회원 전체를 코드/확정·대기 추천수/적립액과 함께 목록으로 보여줌. admin.html "추천인" 탭에 "파트너 현황 (권한 관리)" 패널로 신설.
- `POST /api/admin/referral/partners/revoke`(신설, 이메일 기준) — 현재 `approved`인 회원만 `revoked`로 전환 가능. **코드/추천 실적/출금 이력은 전혀 안 건드리고 그대로 남김** — 그 순간부터 `requirePartner()`가 막혀서 코드 재발급·대시보드·출금 신청만 못 하게 됨(`requirePartner()`는 원래도 `=== 'approved'`만 통과시키는 구조라 별도 수정 불필요).
- **`handleSignup`도 같이 고침**: 기존엔 추천인 코드로 가입하면 코드 소유자의 현재 파트너 상태를 전혀 안 보고 무조건 `referral_signups`에 적립 기록을 남기고 있었음 — 권한을 해제해도 그 사람 코드로 계속 새 가입이 적립될 수 있는 허점이라, 코드 소유자를 조회할 때 `members.referral_partner_status = 'approved'`인 경우에만 적립하도록 조건을 추가함. **권한 해제가 실질적인 효과를 갖도록 하는 핵심 수정.**
- referral.html은 기존에 이미 "pending/approved가 아니면 전부 신청 폼으로 폴백"하는 구조였어서(`renderPartnerState`), `revoked` 상태도 별도 분기 없이 자동으로 "재신청 가능" 화면이 뜸 — `partnerStatusLabel`에 `revoked:'권한 해제됨'` 배지 문구만 추가(admin.html에도 동일하게 추가, `.app-status.revoked` 스타일도 rejected와 동일하게 빨간 톤으로 추가).
- 로컬에서 전체 플로우 실측 검증: 회원가입 → 파트너 신청 → 관리자 승인 → 코드 발급 → 그 코드로 신규 가입(적립 1건 확인) → 관리자가 "파트너 현황" 패널에서 "권한 해제" 클릭 → DB 상태 `revoked` 확인 → **같은 코드로 또 가입해봐도 이번엔 적립이 안 되는 것(카운트 그대로) 확인** → referral.html 재방문 시 "권한 해제됨" 배지와 함께 신청 폼이 다시 뜨는 것까지 확인.

### 다음에 볼 것
- "권한 해제" 후 재신청하면 다시 `pending`부터 시작하는 정상적인 심사 플로우를 타는데, 이 왕복(승인→해제→재신청→재승인)을 여러 번 반복했을 때 `referral_applications` 테이블에 신청 이력이 계속 누적되는 구조라 — 지금은 문제 없지만 아주 나중에 특정 회원이 이 과정을 비정상적으로 반복하면 admin.html "파트너 신청 관리" 목록이 그 사람 이력으로 길어질 수 있음. 지금은 딱히 손댈 필요 없음(이력 자체가 감사 기록으로 유용함).

## 19단계: 모바일에서 인트로/환영 스플래시가 아예 안 뜨던 버그 수정 (2026-09-23)

사용자가 "모바일에서는 왜 사이트 처음 들어가면 뜨는 애니메이션이 안뜨지?"라고 질문 — 실제 원인을 코드로 확인하고 바로 고침.

**원인**: index.html/portal.html의 `#intro-splash`(최초 진입 스플래시)와 portal.html의 `#welcome-splash`(로그인 환영 화면) 둘 다 `@media (prefers-reduced-motion: reduce){ .intro-splash{ animation:none; opacity:0; visibility:hidden; } }` 규칙을 갖고 있었음(8단계에서 접근성 배려로 추가). 문제는 "애니메이션만 끄기"가 아니라 **`opacity:0; visibility:hidden`으로 스플래시 전체를 완전히 숨겨버리는** 방식이었다는 것 — 이 미디어쿼리가 매칭되면 텍스트/배경이 통째로 안 보이게 됨.

`prefers-reduced-motion: reduce`는 데스크톱보다 모바일에서 훨씬 자주 매칭됨 — 대표적으로 **iOS는 저전력 모드(배터리 절약 모드)가 켜져 있으면 실제 "동작 줄이기" 손쉬운 사용 설정과 무관하게 WebKit이 `prefers-reduced-motion: reduce`를 자동으로 true로 평가**하고, 안드로이드도 일부 기기의 배터리 절약 모드에서 비슷하게 동작함. 트레이딩 사이트를 모바일 데이터로 보는 사용자들은 저전력 모드를 켜두는 경우가 흔해서, 실제로는 "리듀스 모션 접근성 설정을 켠 사람"이 아니라 그냥 배터리 아끼려던 일반 모바일 사용자 상당수가 스플래시를 아예 못 보고 있었을 가능성이 높음. 로컬에서 Playwright로 iPhone 뷰포트 + `prefers-reduced-motion: reduce` 에뮬레이션을 걸어 직접 재현 확인함(고치기 전엔 `opacity:0/visibility:hidden`으로 완전히 안 보임 → 고친 후 텍스트가 즉시 나타나는 것까지 스크린샷으로 확인).

**고친 방법**: "스플래시를 숨기는" 대신 "애니메이션만 끄고 최종 상태(다 드러난 모습)를 즉시 보여주는" 방식으로 교체 — 접근성 취지(불필요한 모션 제거)는 그대로 지키면서 콘텐츠 자체는 계속 보이게 함.
```css
@media (prefers-reduced-motion: reduce){
  .intro-splash{ animation:none; }
  .intro-word{ animation:none; clip-path:none; }
  .intro-tag{ animation:none; opacity:1; }
}
```
portal.html의 `.welcome-splash`/`.welcome-splash-text`도 동일한 패턴으로 수정. JS의 `setTimeout(...).hidden = true` 타이머는 그대로 유지되므로, 리듀스 모션 환경에서도 스플래시가 (움직임 없이) 나타났다가 정해진 시간 뒤 사라지는 흐름 자체는 유지됨.

### 다음에 볼 것
- 이 프로젝트에서 세 번째로 나온 패턴("의도는 좋았는데 접근성/조건부 CSS가 핵심 콘텐츠를 통째로 숨겨버림") — 앞으로 `prefers-reduced-motion`이나 비슷한 조건부 미디어쿼리를 추가할 때는 "애니메이션만 끄는지" vs "durationless라도 좋으니 최종 상태는 보여주는지"를 구분해서 후자로 작성할 것

## 19-1단계: 모바일 "하얀 화면" 진짜 원인 2건 추가 수정 (2026-09-23)

19단계 배포 직후 사용자가 실제 모바일로 확인해보니 여전히 "하얀 화면이 뜨는데 첫 문구(Welcome to TEAM SIXX)가 안 보인다"고 재보고함 — `prefers-reduced-motion` 수정과는 다른 원인이었음. 코드를 다시 훑어서 두 가지 실제 원인을 찾아 수정:

1. **`html` 엘리먼트에 배경색이 없었음**: `body{ background: radial-gradient(...) }`는 6개 페이지 전부에 있었지만, **`html{ scroll-behavior:smooth; }`에는 `background`가 전혀 없었음** — 브라우저 기본값은 흰색. 모바일 사파리/크롬에서 스크롤 바운스(iOS의 고무줄 오버스크롤)나 동적 주소창 접힘/펼침으로 뷰포트 높이가 바뀔 때 `body` 바깥 영역(=`html`의 배경)이 순간적으로 드러나는데, 이게 흰색이었던 것. `.intro-word`의 텍스트 색(`--cyan: #d7d9dc`, 거의 흰색에 가까운 밝은 회색)이 이 흰 배경 위에서는 명암 대비가 거의 없어서 "글씨가 안 보인다"는 증상과 정확히 일치함. **고침**: 6개 파일 전부 `html{ background: var(--bg); }` 추가.
2. **구글 폰트를 `@import`로 불러오고 있었음**: `<style>` 블록 맨 첫 줄이 `@import url('https://fonts.googleapis.com/css2?...')`였음 — CSS `@import`는 렌더링 차단(render-blocking) 리소스라서, 이 요청이 끝나야(성공/실패/타임아웃 불문) 브라우저가 페이지를 그리기 시작함. 모바일 데이터망이 느리거나, 통신사/공유기 DNS 필터링, 광고 차단 확장 등으로 `fonts.googleapis.com` 접속이 지연되면 그 시간 동안 화면 전체가 백지(브라우저 기본 흰 배경) 상태로 멈춰있고, 인트로 스플래시의 애니메이션 타이머(`animation-delay`)는 실제로 화면에 그려지기 시작한 시점부터 카운트되기 때문에 타이밍이 꼬일 수 있음. **고침**: `@import`를 제거하고 `<link rel="preload" as="style" ... onload="this.rel='stylesheet'">` + `<noscript>` 폴백 패턴으로 교체 — 폰트 CSS를 비동기로 가져오면서 렌더링을 절대 막지 않도록 함(폰트가 늦게 와도 시스템 폴백 폰트로 즉시 렌더링되고, 로드되면 자연스럽게 교체됨). 6개 파일 전부 동일하게 수정.

로컬 `wrangler dev` + Playwright(iPhone 뷰포트)로 확인: `document.documentElement`의 `background-color`가 로드 즉시 `rgb(9,9,11)`(어두운 색)로 적용되는 것 확인, 콘솔 에러 없음, 스크린샷상 텍스트가 정상적으로 보임. `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

**교훈**: `body`에만 배경을 주고 `html`은 빼먹는 실수는 데스크톱에서는 절대 안 드러남(스크롤 바운스가 없어서) — 모바일 전용 버그를 코드 리뷰만으로 잡으려면 "이 페이지가 모바일 사파리의 오버스크롤/동적 뷰포트 상황에서도 똑같이 보일까?"를 별도로 점검해야 함. 폰트나 외부 스타일시트를 `@import`로 넣는 습관도 이 프로젝트 전체에서 지양할 것 — 항상 `<link rel="preload">` 비동기 패턴 사용.

## 19-2단계: 모바일에서는 인트로/환영 스플래시 자체를 완전히 생략 (2026-09-23)

19-1단계에서 원인 2건을 고쳤지만, 사용자가 "그냥 모바일에서는 애니메이션 없애고 바로 뜨게 해줘라"고 요청 — 모바일에서 스플래시가 제대로 뜨는지 계속 씨름하는 대신, 아예 모바일에서는 스플래시 자체를 생략하고 실제 콘텐츠가 곧바로 보이도록 단순화함(데스크톱은 기존 wipe 리빌 애니메이션 그대로 유지).

- **CSS**: index.html/portal.html의 `.intro-splash`, portal.html의 `.welcome-splash`에 프로젝트 기존 모바일 기준(`max-width:860px`, 사이드바/햄버거 전환 기준과 동일)으로 `display:none !important;`를 추가 — JS가 실행되기 전에도 CSS만으로 화면에 아예 그려지지 않도록 함(깜빡임 없음).
- **JS**: `window.matchMedia('(max-width:860px)').matches`로 모바일 여부를 확인해서,
  - 인트로 스플래시(index.html/portal.html 둘 다): 모바일이면 기존 4450ms 대기 없이 `hidden = true`를 즉시 실행.
  - 로그인 환영 스플래시(`showWelcomeSplash()`, portal.html): 모바일이면 애니메이션 시작조차 안 하고 콜백(`onDone`, 즉 `unlock('member')`)을 곧바로 호출 — 이 함수는 원래 스플래시가 다 끝난 뒤에야 대시보드를 열어주는 구조(11단계)라, CSS로만 스플래시를 숨기고 JS 타이머를 그대로 뒀다면 모바일에서 화면이 4초 넘게 멈춘 것처럼 보였을 것 — JS도 함께 우회해야 실제로 "바로 뜨는" 효과가 남.
- 로컬 `wrangler dev` + Playwright로 확인: 모바일 뷰포트(iPhone 13)에서 페이지 로드 200ms 만에 `#intro-splash`가 `hidden:true, display:none` 상태이고 실제 히어로 콘텐츠가 바로 보이는 것 확인, 데스크톱(1440px)에서는 같은 시점에 여전히 스플래시가 `display:flex`로 정상 재생 중인 것도 함께 확인 — 두 환경이 서로 영향 안 주는 것 검증.

---

# 20단계: 스터디룸 전면 폐기 → Gate.io 수수료 페이백 + 텔레그램 가입 신청 단일 랜딩페이지로 전환 (2026-10-07)

**여기서부터는 다시 "지금 상태" 기록입니다.**

사용자가 다른 서비스("Partner X")의 스크린샷 2장(크립토 거래소 제휴 프로그램 랜딩페이지 — 히어로에 "Become a partner. Earn 40%." + 그라데이션 버튼, Exchanges 섹션에 거래소별 카드(커미션율/정산방식/전용링크+복사버튼/가입방법·UID확인 버튼))을 보여주며 요청:
1. 스터디룸(게시판/등급/UID 계정) 기능 전부 삭제
2. 추천인 파트너 프로그램, 거래량 랭킹 API 등 나머지도 전부 삭제 — **거래소 가입 기능과 UID 체크 기능만 남기기**
3. UI를 참고 스크린샷처럼 리뉴얼
4. 지금은 Gate.io 수수료 페이백 요율 20%, 추후 5~60%까지 상향 예정이고 OKX/바이비트 같은 메이저 거래소도 추가할 예정 (단, 아직 실제 링크/요율은 없음)
5. UID 체크로 가입 여부 확인 + 거래소 가입한 사람들을 위한 전용 텔레그램방 가입 신청 옵션 — 텔레그램 아이디+UID 입력하면 기존에 있던 봇 알림 시스템(`notifyAdminTelegram`)으로 운영자에게 메시지가 가도록
6. 로그인 시스템은 지워도 됨

**작업 전 확인한 것 3가지** (AskUserQuestion으로 직접 확인):
- 기존 DB 데이터(계정/게시글/추천인 코드·출금 기록 등)는 **삭제하지 않고 D1에 그대로 보존**, 앱 코드에서만 더 이상 참조하지 않기로 함.
- `admin.html`(관리자 로그인 대시보드)은 **완전히 삭제** — 새 구조에서는 텔레그램 알림이 관리자 인터페이스의 전부.
- 아직 링크/요율이 없는 타 거래소는 **특정 이름(OKX/Bybit 등)을 넣지 않고** "다른 메이저 거래소 준비중"이라는 generic 카드로만 미리 노출.

**구현**:
- **`src/worker.js` 전면 재작성** (1866줄 → 약 190줄): 계정/세션/게시판/댓글/등급/랭킹/추천인 코드·출금·파트너 신청/경제 캘린더/관리자 전체 핸들러와 `ensureSchema()`의 레거시 마이그레이션 로직, `scheduled()`(시간별 거래량 동기화 크론)을 전부 삭제. 남긴 것은 `GET /api/check-uid`(Gate.io `rebate/user/sub_relation` 조회, 기존 로직 그대로 재사용)와 신설한 `POST /api/telegram-join`(UID+텔레그램 아이디 받아서 **서버에서 재검증**(`checkGateReferral` 재호출, `direct_referral`만 통과) 후 `telegram_join_requests`에 저장 + `notifyAdminTelegram()` 호출) 둘뿐. `json`/`safeJson`/`hmacSha512Hex`/`sha512Hex`/`toHex`/`notifyAdminTelegram` 등 유틸은 기존 코드 그대로 재사용.
- **`wrangler.jsonc`**: `triggers.crons` 블록 제거(계정이 없어져서 자동 거래량 동기화 자체가 무의미해짐).
- **`public/`**: `portal.html`/`referral.html`/`requirements.html`/`join.html`/`admin.html` 전부 삭제, `index.html`만 남기고 전면 새로 작성 — 헤더(로고+스크롤 앵커 네비 "이용방법/거래소/UID 확인/FAQ"+모바일 햄버거), 히어로(그라데이션 타이틀 "수수료 페이백 받기" + 통계 칩), 거래소 섹션(Gate.io 실 카드 + "다른 메이저 거래소 준비중" generic 카드), 이용방법 3단계, UID 확인→텔레그램 신청 2단계 폼(①에서 `direct_referral` 확인되면 ②가 나타나는 구조), FAQ, 푸터로 구성. 디자인은 참고 스크린샷처럼 cyan→purple→pink 그라데이션 포인트 컬러(`--accent-a/b/c`)를 새로 도입 — 13~14단계에서 "무채색만 쓰라"고 반복 지시했던 건 그 시절 스터디룸 브랜드 톤 얘기였고, 이번엔 사용자가 직접 이 그라데이션 톤의 참고 이미지를 주면서 요청한 거라 그대로 따름(과거 지시와 다른 방향이지만 최신 명시적 요청이 우선).
- **레거시 히스토리에서 얻은 교훈을 처음부터 반영**: `html{ background: var(--bg); }`를 처음부터 넣어둠(19-1단계 모바일 흰 화면 버그 재발 방지), 구글 폰트는 `@import` 대신 처음부터 `<link rel="preload">` 비동기 패턴 사용, `header`에는 `backdrop-filter`를 직접 안 걸고 `header::before` 가상 요소로 분리(14단계 사이드바 containing block 버그 재발 방지 — 이번엔 `position:fixed` 사이드바가 없어서 당장 문제는 없지만 습관적으로 적용), 미디어쿼리는 전부 해당 클래스의 무조건 적용 본체 정의 바로 뒤에 배치(10단계 캐스케이드 순서 교훈).
- **`schema.sql`/`schema-console.sql`**: `telegram_join_requests` 테이블 하나만 정의하도록 전면 교체, 예전 테이블들은 운영 DB에 데이터와 함께 남아있지만 이 파일이 더 이상 관리하지 않는다는 주석 추가. `migration-*.sql` 파일들은 과거 기록으로 그대로 둠(삭제 안 함).
- 로컬 `wrangler dev` + Playwright로 검증: 데스크톱(1440px)/모바일(iPhone 13) 둘 다 콘솔 에러 없이 렌더링되는 것 확인, 삭제된 5개 페이지가 전부 404 뜨는 것 확인, UID 확인 버튼 클릭 시 `/api/check-uid` 호출→(로컬엔 `GATE_API_KEY` 없어서 "서버에 API 키가 설정되지 않았습니다" 에러가 UI에 올바르게 표시되는 것까지만) 확인, `/api/telegram-join`도 같은 방식으로 구조 검증, 모바일 햄버거 메뉴 동작 확인. `node --check` + `wrangler deploy --dry-run`(결과: 파일 1개만 읽힘, 7.13 KiB — 전보다 훨씬 작아짐) 검증 후 배포.

### 다음에 볼 것
- `GATE_API_KEY`/`GATE_API_SECRET`는 그대로 쓰므로 환경변수 재설정 불필요. `ADMIN_USERNAME`/`ADMIN_PASSWORD`는 이제 안 쓰이므로 Cloudflare 대시보드에서 지워도 되고 그냥 둬도 무해함(코드가 안 읽음).
- 다른 거래소(OKX/Bybit 등)가 실제로 정해지면: ① 그 거래소의 레퍼럴 확인 API를 새로 조사/구현(Gate.io와 API가 다름), ② index.html의 "준비중" 카드를 실제 카드로 교체, ③ 요율 상향 시 index.html의 "20%" 표기들(히어로 통계 칩 + 거래소 카드)을 함께 갱신.
- 텔레그램 신청이 쌓이기 시작하면 `telegram_join_requests` 조회용 간단한 읽기 전용 페이지가 필요해질 수 있음 — 지금은 D1 콘솔에서 직접 SQL로 보는 방식.
- 실제 Gate.io 키로 UID 확인/텔레그램 신청 플로우가 끝까지 동작하는지는 이 세션에서 검증 불가(로컬에 키가 없음) — 배포 후 실제 UID로 한 번 확인해볼 것.

## 20-1단계: 혜택 구조 보강 + 폰트 확대 + 색상 톤 차별화 (2026-10-07)

20단계 배포 직후 사용자 피드백 4건을 반영:

1. **수수료 정산이 즉시가 아니라 일정 주기 단위**라는 사실 확인 — 거래소 카드의 "정산 방식"을 "가입 확인 후 텔레그램 안내"(마치 가입만 하면 바로 안내받는 것처럼 읽힘)에서 **"정기 정산 (주기적으로 지급)"**으로 정정. 히어로 통계 칩에도 "정기 정산 · 주기적으로 지급"을 추가하고, FAQ에 "페이백은 언제 받나요?" 항목을 새로 추가(정확한 일정은 비공개 텔레그램에서 안내한다고 안내).
2. **"페이백도 좋지만, 비공개 텔레그램 채널 입장 권한도 중요하게 보여달라"** — 기존엔 텔레그램이 "UID 확인 후 부가적으로 신청하는 절차"처럼 3단계 중 하나로만 등장해서 페이백에 비해 비중이 작아 보였음. 히어로 바로 아래에 `#benefits` 섹션을 새로 만들어 "💰 수수료 페이백"과 "🔒 비공개 텔레그램 커뮤니티 입장"을 **동급의 카드 2개**로 나란히 배치(왼쪽 보더 컬러만 다르게 줘서 구분). 히어로 h1도 "수수료 페이백 받기" 단일 문구에서 "페이백 + 비공개 커뮤니티"로 바꿔서 두 혜택을 처음부터 동시에 제시, 히어로 보조 버튼도 "UID 확인하기" → "비공개 텔레그램 입장 신청"으로 문구를 바꿔 텔레그램 쪽 CTA를 더 적극적으로 노출. 이용방법 3단계의 마지막 스텝 제목도 "텔레그램 전용방 신청" → "비공개 텔레그램 입장 신청"으로 통일.
3. **"전체적으로 깔끔하고 글씨가 좀 커졌으면"** — `html{ font-size:17px }`로 기준 폰트를 올리고, 본문/버튼/네비/카드 텍스트의 `rem` 값을 전반적으로 한 단계씩 키움(예: 버튼 0.92rem→1rem, 섹션 설명 0.96rem→1.08rem, FAQ 본문 0.88rem→0.98rem 등). 버튼도 각진 사각형(`border-radius:10px`)에서 완전한 알약 모양(`border-radius:999px`)으로 바꿔서 더 정돈된 느낌을 줌.
4. **"내가 준 참고 사진이랑 너무 똑같이 하진 말고, 다른 스타일/색상으로, 표절 느낌 안 나게"** — 20단계에서 썼던 cyan→purple→pink 그라데이션(참고 스크린샷의 시그니처 컬러와 거의 동일한 톤)을 **emerald→teal→sky-blue 그라데이션**(`--accent-a:#34d399`, `--accent-b:#22c3b6`, `--accent-c:#2dd4ec`)으로 전면 교체 — 보라/핑크 계열을 완전히 빼고 "캐시백=돈=초록"이라는 다른 연상으로 방향을 바꿔서 참고 이미지와 색상 계열 자체가 겹치지 않게 함. 버튼 모양(알약형)·카드 강조 방식(상단 뱃지 대신 좌측 보더 바를 추가로 사용하는 혜택 카드)도 참고 이미지와 디테일이 다르게 가도록 함.

로컬 `wrangler dev` + Playwright로 데스크톱/모바일 둘 다 재확인(콘솔 에러 없음, 새 `#benefits` 섹션과 커진 폰트·새 색상이 정상 렌더링되는 것 스크린샷으로 확인). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- "정기 정산"의 정확한 주기(매주/매월 등)는 아직 사이트에 구체적으로 명시하지 않음 — 확정되면 거래소 카드/FAQ에 구체적인 주기를 적어주는 게 신뢰도에 좋을 것 같음.
- 색상을 emerald/teal 계열로 바꿨는데, 이 프로젝트 히스토리상 "민트/시안 계열은 쓰지 말라"는 지시가 과거(13~14단계, 스터디룸 시절)에 반복됐던 적이 있음 — 이번 요청은 그것과 다른 맥락(새 비즈니스, 참고 이미지와 차별화 목적)이라 그대로 진행했지만, 혹시 사용자가 민트 계열 자체에 대한 거부감이 여전하다면 다른 색 계열(예: amber/rose)로 다시 바꿔야 할 수 있음 — 다음 피드백에서 확인할 것. → **20-2단계에서 "색깔은 괜찮네"로 확인받음, 더 이상 우려 안 해도 됨.**

## 20-2단계: "이미 가입하셨나요?" 지름길 배너 + 거래소 준비중 카드 축소 + 모바일 폰트 재조정 (2026-10-07)

20-1단계 배포 직후 사용자 피드백 4건 추가 반영 (색상은 "괜찮다"고 확인받음, 아래는 그 외 변경사항):

1. **"가입했다면? 채널 입장 신청하기 칸도 하나 더 만들어서 비슷한거, 사람들이 글을 제대로 안 읽고 UID 확인하기 기능을 안쓰면 입장 신청을 못할 수도 있잖아"** — 기존엔 "비공개 텔레그램 입장 신청"이 히어로의 보조 버튼 하나, 그리고 `#verify` 섹션의 UID 확인(①)을 통과해야만 텔레그램 신청(②) 입력창이 나타나는 구조였음 — 글을 안 읽고 쭉 내려가는 사람은 이 흐름 자체를 놓칠 수 있다는 지적. 히어로 바로 아래에 눈에 띄는 가로형 배너 섹션(`.promo-banner`, 테두리/배경에 민트 톤 강조)을 새로 추가 — "📨 이미 거래소에 가입하셨나요?" + "UID만 확인되면 바로 비공개 채널 입장을 신청할 수 있어요." + "채널 입장 신청하기 →" 버튼, 클릭하면 `#verify`로 스크롤. 전체가 `<a>` 하나라 어디를 눌러도 이동됨. 모바일(`max-width:520px`)에서는 세로로 쌓이게 처리.
2. **"타 거래소 추가 예정은 좀 작게 해도 되"** — "다른 메이저 거래소" 준비중 카드가 Gate.io 카드와 똑같은 비중(상세 행 3개 + 가짜 입력창 + 비활성 버튼)으로 나란히 있어서 실제 제공 중인 혜택과 "나중에 추가될 것"이 비슷한 무게로 보였음. `.ex-grid`를 `1fr 1fr`(동률) → `1.6fr 1fr`(Gate.io가 더 넓게)로 바꾸고, 준비중 카드 내용은 핀/제목/한 줄 설명만 남기고 페이백율·정산방식 행, 가짜 링크 입력창, "준비중" 버튼을 전부 제거해서 훨씬 가볍고 작아 보이게 정리. `align-items:start`를 줘서 두 카드 높이가 안 맞아도 어색하지 않게 함.
3. **"모바일에서는 보기 편하게 글씨를 좀 줄여도 좋을 것 같다"** — 20-1단계에서 전역 `html{ font-size:17px }`로 올렸던 걸 `@media (max-width:640px){ html{ font-size:15px; } }`로 모바일에서만 살짝 낮춤(전체 rem 기반 텍스트가 비례해서 같이 줄어듦). 히어로 제목은 rem 축소만으로는 부족해서(`clamp()`의 하한값이 그대로 적용돼 큰 폭 감소가 안 됨) 별도로 `@media (max-width:640px)` 안에 `.hero h1{ font-size:clamp(1.9rem, 8vw, 2.6rem); }` 등 히어로 전용 축소값을 추가로 얹음 — 데스크톱 사이즈는 그대로 유지.

로컬 `wrangler dev` + Playwright로 데스크톱(1440px)/모바일(iPhone 13) 재확인: 새 배너가 히어로 바로 아래 눈에 띄게 렌더링되는 것, 준비중 카드가 Gate.io 카드보다 눈에 띄게 작아진 것, 모바일 히어로 제목이 전보다 작고 읽기 편해진 것 전부 스크린샷으로 확인. `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- `.promo-banner`가 `<a>` 태그 하나로 전체를 감싸는 구조라, 혹시 나중에 배너 안에 복사 버튼 같은 별도 상호작용 요소를 추가하게 되면 `<a>` 중첩 문제(중첩된 인터랙티브 요소)가 생길 수 있음 — 그때는 구조를 `<div>` + 버튼으로 바꿔야 함.
- 거래소가 하나 더 추가되면 `.ex-grid`의 `1.6fr 1fr` 비율은 "메인 거래소 하나 + 준비중 카드 하나"를 가정한 레이아웃이라, 실제 거래소 카드가 2개 이상이 되는 시점에 레이아웃을 다시 봐야 함(아마 `1fr 1fr`로 되돌리거나 3열로 확장).

## 20-3단계: 정산 문구를 "정기 정산"에서 "매일 1~4시간 간격"으로 구체화 (2026-10-07)

사용자가 "주기적으로 지급 말고 매일 시간마다 지급이라고 해줘, 매일 지급해 매일, 1~4시간 간격으로!"라고 요청 — 20-1/20-2단계에서 "정기 정산 (주기적으로 지급)"으로 뭉뚱그려뒀던 표현을 실제 운영 방식(하루 중 1~4시간 간격으로 지급)에 맞게 전부 구체적인 문구로 교체함. 수정한 위치 4곳 전부 동일한 톤으로 통일:
- 히어로 통계 칩: "정기 정산 · 주기적으로 지급" → **"매일 지급 · 1~4시간 간격"**
- 히어로 설명 문구: "정기적으로 페이백 받고" → **"매일 페이백 받고"**
- 혜택 섹션의 "수수료 페이백" 카드 설명: "일정 주기로 정기 정산돼요" → **"매일, 1~4시간 간격으로 지급돼요"**
- Gate.io 거래소 카드의 "정산 방식" 행: "정기 정산 (주기적으로 지급)" → **"매일 · 1~4시간 간격"**(값 색상도 회색 `muted`에서 "20%" 페이백율 행과 같은 골드 강조색으로 바꿔서, 이제 애매한 안내가 아니라 확정된 스펙처럼 보이게 함)
- FAQ "페이백은 언제 받나요?" 답변: "일정 주기(정기 정산)로 모아서 지급돼요" → **"매일 지급돼요. 하루 중 1~4시간 간격으로 정산이 이루어져요."** (정확한 시각은 비공개 텔레그램에서 안내한다는 문구는 유지)

로컬 `wrangler dev` + Playwright로 히어로/거래소 카드 스크린샷 재확인(새 문구와 골드 강조색 정상 반영). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- "1~4시간 간격"이라는 구체적인 숫자를 사이트에 명시했으므로, 실제 운영에서 이 간격이 바뀌면(예: 더 빨라지거나 느려지면) 위 4곳을 전부 같이 고쳐야 함 — grep으로 "1~4시간"을 검색하면 전부 찾을 수 있음. → **20-4단계에서 "1시간 내외"로 다시 바뀜, 아래 참고.**

## 20-4단계: 페이백율 20%→50% 인상 + 정산 시간 "1시간 내외"로 정정 + "Gate 최대 요율/업계 상위권" 문구 추가 (2026-10-08)

사용자가 "수수료 페이백 50%로 향상 완료, 페이백 시간은 1시간 정도 내외(시스템에 따라서 조금 더 빠르거나 늦을 순 있음), 업계 상위 페이백, 게이트에서 내가 해줄 수 있는 최대 페이백임"이라고 요청 — 실제 운영 요율이 20%→50%로 오른 것과 정산 타이밍이 20-3단계에서 적어둔 "1~4시간 간격"이 아니라 "1시간 내외(변동 가능)"라는 걸 반영. 그리고 이 50%가 "Gate.io에서 해줄 수 있는 최대치"이자 "업계 상위권 수준"이라는 신뢰도 문구도 추가함.

**수정한 위치**:
- 히어로 통계 칩: `20% 페이백율 (Gate.io)` → **`50% 페이백율 (Gate.io)`**, `매일 지급 · 1~4시간 간격` → **`매일 지급 · 1시간 내외`**
- 혜택 섹션 "수수료 페이백" 카드 설명: 요율을 `50%`로 올리고 **"Gate.io에서 해드릴 수 있는 최대 요율이자 업계 상위권 수준"**이라는 문구를 새로 추가, 정산 타이밍도 "1시간 내외(시스템 상황에 따라 조금 더 빠르거나 늦을 수 있음)"로 정정
- Gate.io 거래소 카드: 페이백율 `20%` → `50%`, 정산 방식 `매일 · 1~4시간 간격` → `매일 · 1시간 내외`
- FAQ "페이백 요율이 얼마인가요?": `50%`로 수정 + "게이트에서 제공해드릴 수 있는 최대 요율이자 업계 상위권 수준"이라는 신뢰도 문구 추가
- FAQ "페이백은 언제 받나요?": "하루 중 1~4시간 간격" → **"보통 1시간 내외로 정산되지만, 시스템 상황에 따라 조금 더 빠르거나 늦어질 수 있음"**으로 정정(간격 폭을 좁히면서 "상황에 따라 달라질 수 있다"는 단서는 그대로 유지)

**"Gate.io에서 해줄 수 있는 최대 요율"이라는 의미**: 이건 "앞으로 Gate.io 요율을 더 올릴 예정"이라는 기존 문구(20단계 초기 설계 메모)와 모순됨 — 사용자가 명시적으로 "게이트에서 내가 해줄 수 있는 최대 페이백"이라고 했으므로, **Gate.io 자체의 요율은 50%가 상한선이고, 앞으로의 요율 상향 여지는 다른 거래소가 추가될 때(그 거래소가 더 좋은 조건을 주는 경우)에서 나온다**는 뜻으로 이해하고 문구를 그에 맞게 조정함. index.html에는 애초에 "Gate.io 요율을 더 올릴 예정"이라는 문구가 없어서(20-1단계에서 이미 애매하게 적어뒀던 부분) 별도 수정은 불필요했음 — 환경변수/운영 메모 섹션의 "앞으로 5~60%까지 상향 예정"이라는 기록만 이 사실에 맞게 아래에서 같이 정리함.

로컬 `wrangler dev` + Playwright로 히어로/거래소 카드 스크린샷 재확인(50%, "1시간 내외" 정상 반영). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- "50%가 Gate.io 최대 요율"이라는 게 사이트에 명시됐으므로, 나중에 Gate.io 요율이 실제로 더 바뀌면(올라가든 내려가든) 이 "최대 요율" 문구도 같이 재검토해야 함 — 단순히 숫자만 바꾸면 "최대"라는 표현이 거짓이 될 수 있음.
- "업계 상위권"이라는 비교 우위 주장은 실제 경쟁사 요율과 비교 검증된 건 아니고 사용자가 알려준 대로 반영한 것 — 나중에 문제가 되면(예: 과장 광고 이슈) 순화하거나 근거를 보강해야 할 수 있음.

## 20-5단계: 거래소 카드에 Gate.io 로고 배지 추가 (2026-10-08)

사용자가 "게이트 아이오 사진이나 로고도 좀 같이 넣으면 좋을 것 같네"라고 요청.

**실제 Gate.io 로고 이미지는 쓰지 않음**: `gate.com`은 이 세션 네트워크 정책상 계속 egress 차단 상태라(레거시 히스토리에서 반복 확인된 것과 동일, 이번에 WebFetch로 `www.gate.com/media-kit` 접근 시도해서 재확인) 공식 로고 파일을 직접 받아올 방법이 없었고, WebSearch로도 공식 브랜드/프레스킷 페이지를 찾지 못함. 검증 안 된 제3자 사이트의 이미지 URL을 하드링크하는 건 이 프로젝트가 13단계부터 반복해서 피해온 패턴(출처 불명 이미지 하드링크 금지)이라 그대로 따름.

**대신 자체 제작 SVG 배지로 대체**: `public/index.html`의 `#exchanges` 섹션, Gate.io 카드(`.ex-card`) 제목 왼쪽에 46×46px 인라인 SVG 배지(`.ex-logo`)를 추가 — 블루→그린(`#1557ff → #17d492`, Gate.io 실제 브랜드 팔레트로 WebSearch에서 확인된 톤) 그라데이션 배경에 원형 호(arc) + 점으로 이루어진 추상적인 마크. Gate.io의 실제 로고 아트워크를 베끼거나 모방한 게 아니라 "거래소 느낌을 주는 자체 아이콘"으로, 상표권/핫링크 리스크 없이 사용자가 요청한 "로고 같은 시각 요소"를 충족시킴. 카드 상단에 `.ex-head`(flex row)로 배지+뱃지(`크립토 거래소`)+제목(`Gate.io`)을 묶어서 배치.

로컬 `wrangler dev` + Playwright로 데스크톱(1440px)/모바일(390px) 둘 다 배지가 정상 렌더링되는 것 확인. `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- 사용자가 실제 Gate.io 로고 파일(이미지)을 직접 전달해주면, 지금의 자체 제작 SVG 배지를 그 파일로 교체하는 게 더 정확함 — 지금 배지는 "로고 자리"를 채우는 정직한 대안이지 진짜 로고가 아님.
- 다른 거래소가 추가될 때도 같은 이유(네트워크 정책상 이미지 직접 확보 불가)로 실제 로고를 못 구하면, 이번과 같은 패턴(브랜드 톤 참고한 자체 제작 아이콘)을 재사용하면 됨.

## 20-6단계: UID별 누적 페이백 조회 + 실시간 페이백 피드 (2026-10-10)

사용자가 다른 페이백 플랫폼(tetherMaker.com) 스크린샷을 보여주며 "최대 환급률" 통계 + 실시간 지급 피드(마스킹된 UID, 거래소, 금액, 경과시간) 같은 걸 구현할 수 있는지 물어봄. 논의 과정에서 중요한 사실이 정리됨:

**실제 운영 구조 확인**: 사용자 거래 수수료 중 우리가 받는 요율 75% 안에서 **50%p는 거래소(Gate.io)가 유저에게 직접 자동 지급**, **25%p는 우리 파트너 커미션으로 입금**, 나머지 25%p는 거래소가 가짐. 즉 유저 몫은 우리가 손대지 않고 거래소가 알아서 지급 중 — "거래소→우리→유저"로 우리가 재분배하는 구조가 **아님**. (처음엔 Claude가 "우리가 모아서 유저에게 송금해야 한다"고 잘못 가정하고 Gate.io 출금 API(`/withdrawals/push`, UID로 바로 송금 가능)까지 조사했었는데, 사용자가 바로잡아줌 — 이 조사 자체는 기록만 남기고 실제로는 사용 안 함.)

**그래서 공식은 단순 곱셈**: 우리가 API로 조회 가능한 건 우리 몫(25%)뿐(`GET /rebate/partner/commission_history?user_id=UID`, 공식 GitHub SDK 문서 기준 — UID별 필터링 가능, 응답에 `commission_time`/`user_id`/`commission_amount`/`commission_asset`/`source` 포함, 요청 1회당 조회 기간 30일 제한). 유저 몫과 우리 몫의 비율이 50:25=2:1로 고정이므로:
```
유저 누적 페이백 = 우리가 받은 커미션(API 조회) × PAYBACK_RATIO(2)
```
이 비율이 바뀌면(Gate.io 파트너 대시보드 설정을 바꾸면) `src/worker.js` 맨 위 `PAYBACK_RATIO` 상수도 같이 고쳐야 함.

**구현** (완전히 읽기 전용 — 출금 권한이나 자금 이동 로직 전혀 없음, 기존 Rebate 전용 `GATE_API_KEY` 그대로 사용):
- `gateApiGet()` 공통 헬퍼로 기존 `checkGateReferral()`의 HMAC 서명 로직을 추출·재사용(중복 제거), `fetchPartnerCommissionHistory(uid, from, to, offset, env)` 신설.
- `GET /api/payback-total?uid=` — 30일 구간을 과거로 훑어가며(`getUidPaybackTotal()`) 합산, 2구간(60일) 연속 기록이 없으면 "그 이전엔 활동 없음"으로 보고 중단(최대 24구간≈2년 안전장치). 합산 × `PAYBACK_RATIO` 반환.
- `GET /api/payback-feed` — `payback_feed` 테이블에서 최근 20건 반환(공개, UID는 프론트에서 마스킹).
- `known_uids` 테이블 신설 — `/api/check-uid`가 `direct_referral`을 확인할 때마다 UID를 기록(최초 발견 시각 포함). 실시간 피드 크론이 이 목록을 순회함.
- `payback_feed`/`payback_cursor` 테이블 신설 — 15분마다 도는 `scheduled()` 크론(`syncPaybackFeed()`)이 `known_uids` 최대 200개를 순회하며 각자의 커서 이후 신규 커미션 레코드를 찾아 `payback_feed`에 적재(UNIQUE 제약으로 중복 방지), 커서 갱신. 개별 UID 조회 실패는 건너뛰고 계속 진행(레거시 `syncAllVolumes()` 패턴과 동일한 방어적 처리).
- `wrangler.jsonc`에 `triggers.crons: ["*/15 * * * *"]` 재도입(20단계에서 스터디룸 거래량 동기화 크론을 지웠던 자리에 다른 용도로 다시 생김).
- `public/index.html`에 `#payback` 섹션 신설(`#verify` 바로 다음) — UID 입력하면 누적 페이백 조회, 실시간 피드는 20초 폴링. 네비게이션에 "페이백 조회" 링크 추가(데스크톱 nav + 모바일 드롭다운 둘 다).

**버그 발견 및 수정(배포 전)**: Playwright로 모바일(390px) 스크린샷 찍어보니 `.payback-card`가 뷰포트보다 넓게(404px vs 가용폭 342px) 렌더링돼 가로 스크롤이 생기는 게 보임 — 원인은 CSS Grid의 잘 알려진 함정인 `min-width:auto` 기본값(그리드 아이템은 기본적으로 내용의 min-content 크기 밑으로 줄어들지 않음, flexbox의 같은 문제와 동일 계열). `.payback-card`에 `min-width:0`을 추가해서 해결 — 수정 후 Playwright로 재확인해서 겹침/오버플로우 없는 것 확인.

⚠️ **베타 — 실제 Gate.io 키로 검증 안 됨.** 이 프로젝트의 다른 모든 Gate.io 개인/파트너 데이터 연동(6·8·13단계)과 같은 종류의 리스크: `commission_history` 응답 필드 의미, `commission_amount`의 정확한 단위, 요청 기간 제한이 공식 문서(GitHub SDK 레퍼런스 기반, 이 세션은 `gate.com` 직접 접근이 막혀있어서 공식 API 레퍼런스 원문을 못 읽음) 그대로인지 확인 안 됨. **배포 후 실제로 커미션이 들어온 UID 하나를 골라서, Gate.io 파트너 대시보드에 찍힌 실제 수령액과 `/api/payback-total` 결과를 한 번 대조해보는 걸 강력 권장** — 사용자가 직접 확인해줘야 하는 부분(이 세션엔 실 키가 없음).

로컬 `wrangler dev` + Playwright로 검증: `/api/payback-total`/`/api/payback-feed` 라우팅 정상 동작(로컬엔 `GATE_API_KEY` 없어서 payback-total은 "서버에 API 키가 설정되지 않았습니다" 에러로 구조만 확인), `known_uids`/`payback_feed`/`payback_cursor` 테이블이 `ensureSchema()`로 정상 생성되는 것 `wrangler d1 execute --local`로 확인, `#payback` 섹션 데스크톱/모바일 렌더링 확인(오버플로우 버그 수정 후 재확인). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- **사용자 확인 필요**: 실제 커미션 입금 하나 골라서 Gate.io 대시보드 실수령액 vs `/api/payback-total` 결과 대조 — 맞으면 안심, 안 맞으면 `commission_amount` 필드 해석이나 `PAYBACK_RATIO` 전제가 틀렸을 가능성.
- Cloudflare 계정에 크론 트리거가 실제로 등록됐는지 대시보드(Workers → sixsix → Settings → Triggers)에서 확인 필요(이 세션은 Cloudflare API 인증이 없어서 확인 불가 — 14단계 때도 같은 제약).
- `getUidPaybackTotal()`은 사용자가 UID를 입력할 때마다 최대 24구간×5페이지(최악의 경우 최대 120회 Gate API 호출)까지 돌 수 있어서, 오래된/활동 많은 UID는 조회가 느릴 수 있음 — 실사용 트래픽이 늘면 결과를 캐싱하는 걸 고려할 것(지금은 매번 라이브 계산).
- 다른 거래소가 추가되면 그 거래소의 커미션 분배 비율이 다를 수 있어서, `PAYBACK_RATIO`를 거래소별로 분리해야 할 수 있음(지금은 Gate.io 전용 상수 하나).

## 20-7단계: 페이백 집계를 2026-10-08(50% 요율 시작일) 이후로 제한 (2026-10-10)

사용자가 "2026년 10월 8일 기록부터만 기록하는 게 좋을 것 같음. 그때부터 요율이 50% 페이백이고 그전에는 20%였다"고 지적 — 정확히 맞는 지적임. 20단계~20-3단계 사이엔 페이백율이 20%였고, 20-4단계(2026-10-08)에서 50%로 올랐는데, `getUidPaybackTotal()`은 UID의 전체 커미션 내역(최대 2년치)을 전부 끌어와서 **지금 비율(`PAYBACK_RATIO`=2, 50%:25%)을 과거 20% 시절 커미션에도 그대로 곱하고 있었음** — 20% 시절엔 유저:파트너 비율이 달랐을 가능성이 높아서(정확한 과거 비율은 알 수 없음) 그 구간 금액이 부정확하게 계산될 수 있는 버그였음.

**고친 방법**: `PAYBACK_START_SEC = 1791385200`(2026-10-08 00:00 KST를 UTC epoch초로 변환한 값) 상수를 추가하고,
- `getUidPaybackTotal()`의 30일 구간 역탐색 루프가 이 시점 이전으로는 절대 내려가지 않도록 `windowStart`를 `Math.max(windowEnd - WINDOW_SEC, PAYBACK_START_SEC)`로 클램프하고, `windowEnd <= PAYBACK_START_SEC`이면 루프 자체를 종료.
- `syncPaybackFeed()`에서 처음 보는 UID의 조회 시작점(`since`)도 `Math.max(now - 24*3600, PAYBACK_START_SEC)`로 동일하게 클램프(지금 시점 기준으론 항상 10/8 이후라 실질적 영향은 없지만, 코드 일관성과 향후 안전을 위해 동일하게 처리).

로컬 `wrangler dev`로 `/api/payback-total`/`/api/payback-feed` 라우팅이 깨지지 않았는지 재확인(로컬엔 키가 없어서 구조만 확인). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- `PAYBACK_START_SEC`는 하드코딩된 epoch 상수라서, 혹시 날짜 계산이 맞는지 의심되면 `new Date(1791385200 * 1000)`로 역변환해서 "2026-10-07T15:00:00.000Z"(=KST 10/8 00:00)가 맞는지 확인하면 됨.
- 20% 시절(20단계~20-3단계, 즉 2026-10-07 이전)의 실제 유저:파트너 분배 비율을 모르기 때문에, 그 기간 데이터는 아예 집계에서 제외하는 쪽으로 처리함 — 혹시 그 기간 가입자의 페이백도 소급해서 보여줘야 한다면, 그때 비율을 알아내서 별도 상수(예: `PAYBACK_RATIO_LEGACY`)로 분리하고 `PAYBACK_START_SEC` 이전 구간엔 그 비율을 적용하는 식으로 확장 가능.

## 20-8단계: 누적 페이백 조회 결과를 전체화면 전용 뷰로 재설계 (2026-10-10)

사용자가 "여태까지 받은 페이백 확인할 때 창이 너무 단순해, 사용하는 거래소도 같이 뜨게 해줬으면 좋겠고, 모바일에선 더 보기 쉽게, 너무 한 페이지에 다 넣으려 하지 말고 버튼 누르면 다른 페이지로 넘어가서 보여주는 것도 나쁘지 않을 것 같다"고 피드백 — 20-6단계에서 만든 결과 표시가 `#payback` 카드 안의 작은 인라인 `<div>`(숫자 하나 + 한 줄 설명)뿐이라 거래소 정보도 없고 좁았던 걸 지적한 것.

**"다른 페이지로 넘어가는" 느낌을 실제 라우팅 없이 구현**: 이 프로젝트는 `public/index.html` 한 페이지 구조(20단계 핵심 설계)를 유지하는 게 맞다고 판단해서, 진짜 새 HTML 파일/URL을 만드는 대신 **전체화면 오버레이 뷰**(`#payback-result-view`, `position:fixed; inset:0; z-index:200`)를 추가함 — "조회하기"를 누르면 이 오버레이가 뜨면서 입력 폼이 있던 화면을 완전히 덮어버려서, 사용자 입장에선 실제로 다른 페이지로 이동한 것처럼 느껴짐(뒤에 있던 홈 화면은 가려질 뿐 그대로 남아있고, "← 돌아가기"를 누르면 다시 드러남 — 11단계 `welcome-splash`가 로그인 폼을 가렸다가 드러내던 패턴과 비슷한 발상).

**결과 카드 구성**(`.prv-card`): Gate.io 로고(20-5단계에서 만든 블루→그린 그라데이션 SVG 배지를 재사용) + "Gate.io" 텍스트를 알약 모양 뱃지로 상단에 배치해서 "어느 거래소 기준 금액인지" 명확히 보여줌 → UID → 큰 글씨(`clamp(2.3rem, 9vw, 3.2rem)`)로 금액 → 집계 기간("2026.10.08 ~ 지금") → 안내 문구, 순서로 카드 하나에 정리. 로딩/성공/에러 세 가지 상태를 전부 같은 카드 레이아웃(거래소 뱃지 + UID는 공통, 그 아래만 상태별로 교체) 안에서 처리해서 레이아웃이 튀지 않게 함.

**다른 UID로 바로 재조회 가능**: 오버레이 하단에 UID 입력창 + "조회하기" 버튼을 따로 둬서, 결과 화면을 나가지 않고도 다른 UID를 바로 조회할 수 있게 함. `Esc` 키로도 닫히도록 처리.

**모바일 가독성**: 전체화면이라 `.payback-grid`의 좁은 카드 폭 제약에서 완전히 벗어나서, 모바일에서도 데스크톱과 똑같이 여유 있는 레이아웃으로 보임(별도 모바일 전용 로직 없이 반응형 `clamp()` 폰트 크기만으로 자연스럽게 적응).

**버그 없이 한 번에 통과**: Playwright로 데스크톱(1440px)/모바일(390px) 둘 다 로딩→에러 상태(로컬엔 키 없음) 확인, API 응답을 목(mock)으로 가로채서 성공 상태(1,234.56 USDT 예시)도 렌더링 확인, 전체 페이지 요소 overflow 검사로 가로 스크롤 없는 것 확인, "← 돌아가기" 클릭 시 오버레이가 정상적으로 닫히는 것까지 확인 — 18단계 이후 CSS Grid `min-width:auto` 류의 문제가 재발하지 않도록 이번엔 처음부터 `.prv-card`에 overflow 안전한 레이아웃(고정폭 대신 `max-width:560px; margin:0 auto`)을 적용해서 추가 수정 없이 통과함.

`node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- 지금은 거래소가 Gate.io 하나뿐이라 뱃지가 하드코딩돼 있음 — 다른 거래소가 추가되면 `exchangeBadge()` 함수를 그 UID가 어느 거래소 소속인지에 따라 분기하도록 확장해야 함.
- 오버레이가 열려있는 동안 `document.body.style.overflow = 'hidden'`으로 배경 스크롤을 막아두는데, 혹시 나중에 이 패턴(전체화면 오버레이)을 다른 기능에도 재사용하게 되면 여러 오버레이가 동시에 열렸을 때 overflow 복원 타이밍이 꼬일 수 있음 — 지금은 오버레이가 이거 하나뿐이라 문제 없음.

## 20-9단계: Gate.io 자체 제작 SVG 배지 → 실제 공식 로고 이미지로 교체 (2026-10-10)

20-5단계에서 "로고 쓰고 싶은데 gate.com 접근이 막혀있어서 자체 제작 SVG로 대체했다"고 기록해뒀던 부분 — 사용자가 이번에 Gate.io 공식 앱 아이콘 스크린샷(iOS 홈스크린 캡처, 흰 라운드 사각형 배경에 블루 "G" 마크 + 그린 사각형)을 보내주면서 "저작권 문제 허가 받았으니 공식 로고 이미지 검색해서 써달라"고 요청.

**다시 확인해봐도 네트워크로는 못 받아옴**: `gate.com`뿐 아니라 로고를 호스팅하는 제3자 사이트(logowik.com, seeklogo.com, iconape.com)에 `curl`로 직접 연결 시도했지만 전부 이 세션의 egress 프록시에서 403으로 차단됨(레거시 히스토리에서 반복 확인된 것과 동일한 제약, 이번엔 third-party 로고 사이트까지 전부 막혀있다는 것까지 새로 확인). WebSearch로는 로고 설명(3/4 원 + 블록 모양, 블루/그린 — 2024년 리브랜딩)과 여러 제3자 다운로드 페이지 링크는 찾았지만 실제 파일을 가져올 방법은 끝내 없었음.

**사용자가 보내준 스크린샷을 소스로 직접 가공**: 이 세션에 `Pillow`/`numpy`가 기본 설치돼 있지 않아서 `pip install`로 설치한 뒤, 업로드된 이미지(228×310px, iOS 홈스크린 캡처)에서 흰색 아이콘 영역의 정확한 픽셀 경계를 행/열 단위 밝기 분석으로 찾아냄(하단의 "Gate" 텍스트 라벨과 아이콘 자체를 색상 분포로 구분) → 아이콘만 192×192px 정사각형으로 정밀 크롭 → `public/gate-logo.png`로 저장(29.5KB). 모서리에 약간 남는 배경색 비침은 기존 `.ex-logo`/`.prv-exchange` CSS의 `border-radius` + `overflow:hidden`이 그대로 깔끔하게 잘라줘서 별도 알파 마스킹 처리 없이 해결됨.

**적용 위치 2곳**: 거래소 카드(`#exchanges`의 `.ex-logo`)와 페이백 결과 화면(`.prv-exchange`, 20-8단계에서 추가) 둘 다 자체 제작 SVG를 지우고 `<img src="/gate-logo.png">`로 교체. CSS는 `.ex-logo svg, .ex-logo img{...}` / `.prv-exchange svg, .prv-exchange img{...}`처럼 두 태그를 같이 셀렉터에 묶어서 기존 크기/라운딩 스타일을 그대로 재사용.

로컬 `wrangler dev` + Playwright로 거래소 카드와 페이백 결과 카드(API 응답 목 처리) 둘 다 실제 로고가 깨짐 없이 렌더링되는 것 스크린샷으로 확인. `node --check` + `wrangler deploy --dry-run`(결과: assets 디렉터리에서 2개 파일 읽음 — `index.html` + `gate-logo.png`) 검증 후 배포.

### 다음에 볼 것
- 소스가 사용자의 휴대폰 스크린샷(JPG 압축 + 192px 저해상도)이라, 지금 쓰는 46px/30px 배지 크기에선 문제없지만 혹시 나중에 로고를 더 크게 써야 할 일이 생기면(예: 파비콘, 큰 배너) 화질이 부족할 수 있음 — 그땐 사용자에게 더 고해상도 원본(공식 미디어킷 등)을 요청하는 게 좋음.
- 이 세션 네트워크 정책상 제3자 로고 사이트까지 전부 막혀있다는 게 이번에 새로 확인된 사실 — 앞으로 다른 거래소 로고도 필요해지면 "사용자가 깨끗한 스크린샷/이미지 파일을 직접 보내주고, 그걸 소스로 크롭/가공" 패턴을 재사용하면 됨(이번에 쓴 Pillow+numpy 기반 자동 경계 탐지 스크립트도 재사용 가능).

## 20-10단계: 페이백 조회를 모달로 변경 + FAQ 아코디언 + 브랜드 마크 교체 (2026-10-10)

사용자 피드백 4건:
1. "페이백 조회하기 창 이거 그냥 원래대로가 더 나을 것 같음. 대신에 원래 형식 말고 버튼 누르면 창 떠서 거기서 조회할 수 있게 하자" — 20-8단계에서 만든 전체화면 전용 뷰(`.payback-result-view`)가 과했다는 피드백. 완전히 되돌리는 대신, 세 번째 방식(모달)로 재설계: `#payback` 섹션 왼쪽 카드는 설명 한 줄 + "UID로 조회하기" 버튼만 남기고, 누르면 화면 중앙에 뜨는 모달(`.payback-modal-backdrop`/`.payback-modal`, 반투명 블러 배경 + 닫기 X 버튼)이 열리면서 그 안에서 UID 입력→조회→결과(거래소 뱃지/금액/기간, 20-8단계에서 만든 `.prv-*` 클래스 재사용)까지 전부 처리됨. 배경 클릭/Esc/닫기 버튼 셋 다로 닫힘.
2. "실시간 페이백 피드 말고 실시간 페이백 내역으로 바꿔주고" — 섹션 제목 문구만 교체(`#payback-feed-list` 등 내부 id/class 이름은 그대로 둠, 사용자 눈에 보이는 텍스트만).
3. "자주 묻는 질문은 접었다 펴서 볼수 있게" — `.faq-item`을 `<div>`+`<h3>`에서 `<details>`+`<summary>`로 전환, `+`/`×` 회전 아이콘으로 열림 상태 표시. 별도 JS 없이 브라우저 네이티브 `<details>` 토글만으로 구현.
4. "로고에 S대신 다른걸 넣었으면 함, 페이백 플랫폼이니 관련된 이름을 만들어도 좋고" — 이름 자체("TEAM SIXX")는 20단계부터 계속 써온 확립된 브랜드라 그대로 유지하고, 요청의 핵심(마크 아이콘 교체)만 처리 — 헤더의 `.mark` 배지 안 텍스트 "S"를 퍼센트(%) 기호를 형상화한 자체 제작 인라인 SVG(원 2개 + 대각선, 기존 글자와 같은 다크 색상)로 교체함. "수수료 페이백(%)" 플랫폼이라는 정체성을 로고 레벨에서 바로 드러내는 선택 — Gate.io 로고 때와 달리 이건 단순 기하학적 아이콘이라 저작권 이슈 없이 바로 구현 가능했음.

**버그 발견 및 수정(배포 전)**: Playwright로 모달 열기 테스트 중 "모달이 `hidden`인데도 클릭을 가로챈다"는 증상 발견 — 원인은 16단계에서 이미 한 번 겪었던 것과 똑같은 패턴: `.payback-modal-backdrop{ display:flex; ... }`처럼 무조건 적용되는 author 스타일이 브라우저 기본 `[hidden]{display:none}` 규칙을 origin(출처) 우선순위상 그냥 이겨버리는 것(동일 명시도여도 author 스타일시트가 UA 스타일시트보다 항상 우선). `.payback-modal-backdrop[hidden]{ display:none; }` 규칙을 바로 뒤에 추가해서 해결 — 이 프로젝트에서 세 번째로 재발한 패턴이라, 앞으로 `hidden` 속성으로 토글하는 요소에 무조건 `display`를 주는 CSS를 작성할 때는 습관적으로 `[hidden]` 오버라이드를 같이 넣을 것.

로컬 `wrangler dev` + Playwright로 데스크톱/모바일 둘 다 확인: 모달 열기/닫기(배경 클릭·닫기 버튼), UID 조회 결과 렌더링(API 목 처리), FAQ 아코디언 열림/닫힘, 모바일에서 모달 레이아웃 오버플로우 없는 것까지 스크린샷으로 확인. `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- `<details>` 아코디언은 여러 개를 동시에 열어둘 수 있음(배타적 아코디언 아님) — 혹시 "하나 열면 나머지는 자동으로 닫히게" 원하시면 `name` 속성(HTML 표준, 최신 브라우저 지원) 하나만 추가하면 바로 구현 가능.
- 브랜드 마크를 %로 바꿨지만 "TEAM SIXX"라는 이름 자체는 그대로 둠 — 사용자가 "이름을 만들어도 좋고"라고 열어둔 부분이라, 정말 새 이름(페이백 플랫폼 느낌)으로 리브랜딩하고 싶으면 다음에 구체적으로 요청해주면 좋음.

## 20-11단계: 페이백 조회 "없는 계정" 처리 + 다크 로고 제작 + 헤더 마크 교체 (2026-10-10)

사용자 요청 3건:

1. **"페백 조회할때 없는 계정은 없다고 해줘야되"** — `/api/payback-total`이 `commission_history`만 조회해서, 등록 안 됐거나 존재하지 않는 UID도 그냥 커미션 합산 0으로 응답하고 있었음(= "아직 페이백이 없다"처럼 보임, "그런 계정 자체가 없다"와 구분이 안 됨). `handlePaybackTotal`에 `checkGateReferral()` 선행 호출을 추가해서: UID가 Gate.io에 아예 없으면 404 "존재하지 않는 UID예요", 있어도 전용 링크 `direct_referral`이 아니면 403 "전용 링크로 가입된 계정이 아니에요"로 명확히 분리. 프론트는 기존 에러 렌더링(`renderError`)을 그대로 재사용하니 추가 수정 불필요 — `data.error` 메시지만 자연스럽게 달라짐.
2. **"로고 하나 만들어줘 어두운 버전으로 세련되고"** — SVG로 직접 디자인(검정~짙은 그린 라디얼 그라데이션 배경의 둥근 사각 카드 + 에메랄드→틸→스카이블루 그라데이션의 글로우 퍼센트(%) 마크, `feGaussianBlur` 소프트 글로우 필터)한 뒤 Playwright로 HTML에 임베드해서 고해상도 PNG로 렌더링(`deviceScaleFactor:2`) — 이미지 생성 모델이 아니라 코드로 직접 그린 벡터라 선명하고 브랜드 색상과 정확히 일치함. 아이콘 단독 버전 + "TEAM SIXX" 워드마크 버전 두 가지를 `SendUserFile`로 전달해서 사용자가 고르게 함.
3. **"이름은 빼고 팀식스 들어가있는 두번째 로고로 정할게 저걸로 넣어줘"** — 이름(브랜드명) 교체는 보류하고, 워드마크 버전(검정 배경 + 글로우 % 마크 + "TEAM SIXX")의 비주얼을 헤더에 적용. ⚠️ **"TEAM SIXX" 텍스트는 래스터 이미지로 굳히지 않고 실제 텍스트로 유지** — 워드마크 PNG를 통째로 `<img>`로 박아넣는 대신, 헤더의 `.mark` 아이콘만 새 스타일(다크 사각 배경 `#0d1210` + 그라데이션 글로우 링 아이콘, SVG `filter`로 작은 글로우 적용)로 교체하고 "TEAM SIXX" 글자는 기존처럼 라이브 텍스트 그대로 둠 — 접근성(스크린리더)·선명도(어떤 배율에서도 안 흐려짐)·SEO 관점에서 텍스트를 이미지로 굳히는 것보다 항상 낫다고 판단해서 내린 구현 선택. 결과적으로 사용자가 고른 로고와 시각적으로 동일하게 보이면서 텍스트는 여전히 진짜 텍스트.

로컬 `wrangler dev` + Playwright로 새 헤더 마크를 데스크톱(2x 레티나 캡처)/모바일 둘 다 확인 — 글로우·그라데이션이 작은 크기(32px)에서도 뭉개지지 않고 선명하게 나오는 것 확인. `node --check` + `wrangler deploy --dry-run` 검증 후 두 변경사항(페이백 404/403 처리, 헤더 마크 교체) 각각 배포.

### 다음에 볼 것
- 생성한 다크 로고 PNG 2종(아이콘 단독/워드마크)은 `SendUserFile`로만 전달했고 리포지토리에는 커밋 안 함(배포에 쓰인 건 헤더의 인라인 SVG뿐) — 나중에 파비콘이나 소셜 공유 이미지(OG image) 등 다른 곳에도 이 로고를 쓰고 싶다면 다시 요청하면 됨, 그때 `public/`에 정식 에셋으로 저장하고 `<link rel="icon">` 등을 연결하면 됨.
- 브랜드명("TEAM SIXX") 자체는 이번에도 안 바뀜 — 사용자가 "이름은 빼고"라고 명시적으로 보류함.

## 20-12단계: 텔레그램 신청에 "시드 예치 여부" O/X 확인 단계 추가 (2026-10-10)

사용자가 "텔레그램 아이디 입력해서 스터디방 신청하는 칸에 부가 설명을 추가하면 좋을 것 같아. 스터디방 입장을 원할경우 텔레그램 아이디 적어달라고. 그리고 시드 예치여부도 물어보는게 있으면 좋을 것 같음 예치해야 입장 가능하거든 o로 하면 다음 단계, X로 하면 시드 예치 후 다시 신청해달라고"라고 요청. ("스터디방"은 레거시 시절 명칭이 그대로 구어체로 남은 것 — 지금 코드베이스에 스터디룸 기능은 없고, 실제로는 "비공개 텔레그램 커뮤니티"를 가리킴.)

**`#verify` 섹션의 UID 확인 → 텔레그램 신청 흐름을 3단계로 확장**:
- ① Gate.io UID 확인 (기존과 동일)
- ② **시드 예치 여부**(신설) — "스터디방 입장은 시드 예치가 완료돼야 가능해요. 예치를 마치셨으면 O를 선택해주세요." 설명 + O/X 버튼 두 개. **O 선택 시**에만 ③ 텔레그램 아이디 입력 단계가 열림. **X 선택 시**엔 "❌ 시드 예치 후 다시 신청해주세요." 메시지만 뜨고 텔레그램 입력 단계는 계속 숨겨짐(언제든 다시 O를 눌러 전환 가능, 한쪽으로 고정되는 구조 아님).
- ③ 텔레그램 아이디(기존 "②"였던 단계 — 번호만 밀림) — "스터디방 입장을 원하시면 텔레그램 아이디를 입력해주세요." 설명 문구를 새로 추가.
- 서버(`worker.js`)는 전혀 안 건드림 — 시드 예치 여부는 API로 검증할 방법이 없어서(그런 데이터 자체가 없음) 순수 프론트엔드 안내용 게이트. 실제 예치 확인은 기존처럼 운영자가 텔레그램에서 개별 확인.
- UID를 다시 확인하면(`verifyBtn` 클릭) 시드 선택 상태와 텔레그램 입력 단계가 전부 초기화됨(`resetSeedChoice()`) — 이전 UID에서 고른 O/X가 새 UID 확인 결과에 잘못 남아있지 않도록.

**버그 발견 및 수정(배포 전)**: Playwright로 테스트하다가, UID 확인에 성공하자마자(O/X를 아직 누르지도 않았는데) "❌ 시드 예치 후 다시 신청해주세요" 에러 메시지가 미리 떠 있는 걸 발견함 — 20-10단계에서 이미 겪은 것과 **완전히 같은 패턴의 버그**: `#seed-x-result`를 처음부터 `class="verify-result show bad" hidden`으로 마크업에 박아뒀더니, author 스타일시트의 `.verify-result.show{ display:block }` 규칙이 origin(출처) 우선순위상 브라우저 기본 `[hidden]{display:none}` 규칙을 그냥 이겨버린 것. 이번엔 완전히 다른 고침 방법을 씀 — `hidden` 속성과 CSS를 힘겨루기 시키는 대신, 애초에 `show` 클래스를 마크업에 절대 안 넣고 기존 `showResult()` 헬퍼 함수(className을 매번 완전히 새로 대입)로만 보이기/숨기기를 관리하도록 바꿈(`#verify-result`/`#tg-result`가 원래부터 쓰던 패턴과 동일하게 통일). **이 프로젝트에서 이 패턴(`[hidden]` vs 무조건 적용 `display` 규칙의 충돌)이 네 번째로 재발함** — 원인은 매번 다르지만(13단계 `!important`, 16단계 사이드바, 20-10단계 모달, 이번엔 `.show` 클래스 선반영) 전부 "같은 요소를 `hidden` 속성과 클래스 기반 `display` 양쪽으로 동시에 제어하려다 생기는 충돌"이라는 공통 뿌리 — **앞으로는 가능하면 한 요소의 표시/숨김을 `hidden` 속성 또는 클래스 토글 중 하나로만 제어하고 섞지 않는 게 근본적으로 안전함.**

로컬 `wrangler dev` + Playwright로 UID 확인 직후(에러 선반영 없음) → X 선택(경고 메시지만 뜨고 텔레그램 입력창 숨김) → O 선택(텔레그램 입력창 열림) 전체 흐름을 데스크톱/모바일 둘 다 스크린샷으로 확인, 모바일 오버플로우 없는 것도 확인. `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- "시드 예치"가 정확히 뭘 의미하는지(최소 금액, 예치 방법 등)는 이번 요청 범위 밖이라 사이트에 구체적으로 설명하지 않음 — 필요하면 FAQ나 시드 단계 설명에 더 자세한 안내를 추가할 수 있음.
- `[hidden]`+클래스 혼용 충돌 패턴이 네 번째로 재발한 만큼, 이 프로젝트에 새 토글형 UI(모달/스텝/아코디언 등)를 추가할 때는 처음부터 "hidden 속성 전용" 또는 "클래스 토글 전용" 중 하나로 설계 원칙을 통일하는 걸 고려할 것.

## 20-13단계: 법적 리스크 관련 논의 + 푸터 투자 유의사항 문구 추가 (2026-10-11)

사용자가 "게이트아이오 같은 미신고 해외거래소 레퍼럴은 특금법 위반으로 처벌될 수 있다"는 내용의 캡처(법률 자문 성격)를 보여주며 "걸리지 않도록 '강요·홍보가 아니다'라는 보험 멘트를 넣어달라"고 요청.

**"홍보 아님" 류 방어 문구는 추가하지 않기로 함**: 법원/금융당국은 문구가 아니라 사이트의 실제 구조(전용 레퍼럴 링크 + 캐시백 유인 + "가입하기" CTA + 입장 조건부 비공개 커뮤니티)로 판단하므로, 면피성 문구가 실질적 법적 보호가 안 된다고 판단해서 그대로 구현하지 않음(오히려 "인지하고도 회피 문구를 넣었다"는 게 불리하게 작용할 수 있다고 설명함).

**추가로 확인된 사실 — "시드 예치"의 정확한 의미**: 사용자가 "시드 예치는 본인이 그 거래소(Gate.io)에 본인 계정으로 하는 것"이라고 명확히 확인해줌. 즉 운영자나 운영자가 지정한 곳으로 돈이 전혀 넘어가지 않고, 사용자가 자기 명의 거래소 계좌에 직접 입금하는 구조 — **유사수신행위(불특정 다수로부터 운영자가 출자금 성격의 돈을 모으는 행위) 쪽 우려는 해당 없음이 확인됨.** (다만 레퍼럴/알선 쪽 이슈는 이 설명과 무관하게 별개로 남아있음 — "시드 예치가 본인 계좌로 가는지"와 "전용 링크로 가입시키고 수수료를 나눠 받는 구조인지"는 서로 다른 질문.)

사용자가 "레퍼럴 알선 건은 아직 관련 판례가 없고, '코드로 가입 후 교육을 바탕으로 자율적인 거래 환경을 조성하는 것'이라면 문제없다는 담당자 의견을 받았다"며 리스크 문구만 추가해달라고 요청 — Claude 쪽에서는 "판례가 없다"는 게 "성문법(특금법) 자체가 적용 안 된다"는 뜻은 아니라는 점을 짧게 짚어주되, 최종 판단과 사업 운영 방식 결정은 사용자(및 사용자가 상담받은 전문가)의 몫이므로 더 이상 반복해서 재론하지 않고 요청받은 작업만 수행함.

**구현한 것 — 정직한 투자 유의사항 문구(법적 방어 문구 아님)**: 푸터에 `.disclaimer` 문단 추가 — "⚠️ 투자 유의사항: TEAM SIXX는 거래소 전용 링크 가입 안내와 수수료 페이백 정보를 제공할 뿐, 투자 자문이나 수익을 보장하지 않습니다. 가상자산 거래는 가격 변동성이 크며 원금 손실 위험이 있습니다. 모든 거래의 판단과 책임은 투자자 본인에게 있습니다." — 이건 "홍보가 아니다"라고 사실을 왜곡하는 문구가 아니라, 가상자산 서비스 사이트에서 흔히 쓰이는 정직한 리스크 고지(투자 자문 아님, 원금 손실 가능성, 책임 소재)라서 추가하는 게 맞다고 판단함.

로컬 `wrangler dev` + Playwright로 데스크톱/모바일 둘 다 푸터 레이아웃 확인(줄바꿈 자연스러운 것, 겹침 없는 것). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- 레퍼럴/알선 관련 법적 리스크는 이 세션에서 해소된 게 아니라 사용자가 자체적으로(또는 상담받은 바에 따라) 감수하기로 한 영역 — 코드/문구로 해결할 수 있는 문제가 아니라는 점을 분명히 인지하고 있을 것.
- "시드 예치 = 본인 계좌"라는 사실이 이번에 명확해졌으니, 혹시 나중에 "② 시드 예치 여부" 단계 설명 문구에도 이 부분(운영자에게 돈을 보내는 게 아니라 본인 명의 계좌에 본인이 예치하는 것)을 명시하면 사용자 신뢰도와 설명의 정확성 둘 다에 도움이 될 수 있음 — 20-12단계에서 한 번 제안했었고 사용자가 이번엔 다른 요청(리스크 문구)을 먼저 처리해달라고 해서 보류된 상태.

## 20-14단계: 실시간 페이백 피드 날짜가 "20737일 전"으로 뜨는 버그 수정 (2026-10-11)

사용자가 실제 배포된 사이트의 "실시간 페이백 내역" 섹션 스크린샷을 보내줌 — 3건 전부 "Gate.io · 20737일 전"으로 표시되고 있었음(56년 전 = 거의 1970년 에포크 기준).

**원인 조사**: `timeAgo()`는 `payback_feed.commission_time`(Gate.io `/rebate/partner/commission_history` 응답의 `commission_time` 필드를 그대로 저장한 값, 초 단위 Unix epoch)을 기준으로 "며칠 전"을 계산하고 있었음. 이 세션은 `gate.com` 공식 문서에 직접 접근할 수 없어서(egress 차단), GitHub의 공식 `gate/gateapi-python` SDK 리포지토리를 `add_repo`로 추가해 클론한 뒤 `gate_api/models/agency_commission.py`를 직접 확인함 — `commission_time` 필드명과 "Unix timestamp in seconds"라는 단위 설명 둘 다 기존 코드와 정확히 일치했음(필드명 오타나 단위 혼동이 아님). 즉 코드 쪽 필드 매핑은 공식 스펙과 맞게 짜여 있었는데도, 실제 운영 데이터에서 `commission_time` 값이 0에 가까운 값으로 들어와서(diff가 거의 "지금 시각 자체"가 되어 "20737일 전"으로 계산됨) 날짜가 깨진 것 — 20-6단계 기록에 적어뒀던 "베타, 실제 키로 응답 필드 검증 안 됨" 리스크가 실제로 처음 드러난 사례.

**고친 방법**: Gate.io가 내려주는 `commission_time` 값의 신뢰성과 무관하게 날짜가 항상 정확하도록, 신뢰 가능한 필드로 교체함 — `payback_feed.created_at`은 우리 서버가 동기화할 때 직접 `Date.now()`로 기록하는 값이라 Gate.io 응답 품질과 상관없이 항상 올바름.
- `src/worker.js`의 `handlePaybackFeed()`: `SELECT`에 `created_at` 추가, 정렬 기준도 `commission_time DESC`(불안정할 수 있음) → `id DESC`(삽입/동기화 순서 기준, 항상 안정적)로 변경.
- `public/index.html`의 `timeAgo()`: 파라미터를 `commission_time`(초)에서 `created_at`(밀리초)으로 바꾸고, 렌더링 호출부도 `timeAgo(it.commission_time)` → `timeAgo(it.created_at)`로 수정. 음수 diff 방어 코드(`if(diff < 0) diff = 0`)도 추가.
- `commission_time` 자체는 DB 컬럼/페이백 중복 방지(`UNIQUE` 제약)용으로는 계속 그대로 저장/사용 — 화면 표시에만 안 쓰는 것으로 범위를 좁힘(전체 데이터 모델을 바꾸지 않고 사용자에게 보이는 증상만 정확히 고치는 쪽을 선택함).

`node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- `commission_time`이 왜 비정상적인 값으로 들어오는지(Gate.io 쪽 실제 원인)는 이번에도 끝내 확인 못 함 — 실 키로 직접 응답을 로깅해볼 수 있는 상황이 되면 원인을 더 파봐도 좋음. 지금 고친 방식은 "원인 불문하고 화면에 항상 정확한 날짜가 뜨게" 하는 우회 수정이라, 당장 운영에는 문제 없음.
- 혹시 나중에 `commission_time`을 다시 신뢰해서 쓸 일이 생기면(예: 커미션 발생 시각 기준 집계), 이번에 확인한 공식 `AgencyCommission` 모델(필드명 `commission_time`, 초 단위, source `SPOT`/`FUTURES`)을 참고하면 됨 — 클론해둔 `/home/user/gate/gateapi-python` 경로에 전체 SDK 소스가 남아있음(이 세션 한정, 세션 종료 시 사라짐).

## 20-15단계: 페이지 분량 축소 + 실시간 페이백 내역을 UID 확인 카드 옆으로 이동 (2026-10-11)

사용자 요청 3건: (1) 페이지 내용이 너무 길게 늘어지지 않게 줄여달라, (2) 실시간 페이백 지급 내역을 조금 더 올려줘도 될 것 같다, (3) 그 내역을 레퍼럴(UID 확인·텔레그램 신청) 카드 옆에 뜨게 해도 좋겠다.

**독립돼 있던 `#payback` 섹션을 `#verify` 섹션 안으로 흡수**: 기존엔 "UID 확인/텔레그램 신청" 카드 하나짜리 섹션과 "누적 페이백 조회 CTA + 실시간 내역" 2카드짜리 섹션이 완전히 분리된 두 섹션이었음 — 이번에 `#verify` 섹션 하나로 합치고 `.payback-grid`(기존 2단 그리드 CSS 재사용)로 왼쪽엔 UID 확인/텔레그램 신청 카드, 오른쪽엔 "실시간 페이백 내역" 카드를 나란히 배치함. "누적 페이백 조회" 전용 카드는 없애고, 그 역할을 하던 버튼("내 누적 조회 →")을 오른쪽 카드 헤더 안으로 옮겨서 모달을 그대로 띄우게 함(모달 자체 마크업/로직은 안 건드림). nav의 "페이백 조회" 앵커(`#payback`)는 이 오른쪽 카드 div에 그대로 유지해서 깨지지 않게 함. 섹션 하나를 통째로 줄인 효과로 전체 페이지 길이가 줄어듦.

**버그 발견 및 수정(배포 전)**: 합치는 과정에서 모바일(390px)에서 54px 가로 스크롤이 생기는 버그가 터짐. 처음엔 20-6단계에서 `.payback-card`에 썼던 것과 같은 CSS Grid `min-width:auto` 함정이라고 보고 `.verify-card`에도 `min-width:0`을 추가했는데 그걸로는 안 고쳐짐 — 진짜 원인은 따로 있었음: 원래 `.verify-card`가 섹션 단독으로 쓰일 때 썼던 `max-width:580px; margin:0 auto;`(가운데 정렬용)를 그리드 안에서도 그대로 모바일 미디어쿼리로 살려뒀었는데, **그리드 아이템에 `margin:auto`를 주면 그 아이템이 트랙 너비에 맞춰 늘어나지 않고(stretch) 자기 콘텐츠의 최대 콘텐츠 너비(max-content)에 맞춰 줄어들려고(shrink-to-fit) 하면서 트랙보다 넓어질 수 있음** — `verify-row`(input+button) 같은 자식들이 요구하는 너비가 모바일 트랙 폭(342px)보다 넓어서 카드 자체가 420px로 튀어나왔던 것. `min-width:0`은 "더 안 줄어드는 하한선" 문제만 막아줄 뿐 이 문제와는 무관했음. **고친 방법**: 모바일 전용 `max-width:580px; margin:0 auto;` 오버라이드를 아예 삭제하고, 그리드 안에서는 항상 `max-width:none; margin:0;`(트랙에 꽉 차게 stretch)만 적용하도록 단순화 — 중앙 정렬을 포기하는 대신 그 어떤 폭에서도 트랙을 벗어나지 않게 됨. Playwright로 1440/820/800/390px 전부 가로 오버플로우 0px 확인.
- **교훈**: 이 프로젝트에 `min-width:0`으로 고쳐지는 "그리드 아이템이 안 줄어드는" 문제와, `margin:auto`로 인한 "그리드 아이템이 트랙보다 커지는" 문제는 증상(가로 오버플로우)은 똑같아 보이지만 원인과 처방이 다름 — 그리드 안에 넣는 요소에 원래 있던 `margin:0 auto` 중앙정렬 스타일이 남아있지 않은지 꼭 확인할 것.

**실시간 피드 표시 건수 증가**: `src/worker.js`의 `handlePaybackFeed()` 쿼리 `LIMIT 20` → `LIMIT 40`으로 증가(상단 라우트 주석도 동일하게 수정). `.feed-list`의 `max-height`도 420px → 480px로 살짝 늘려서 스크롤 전에 더 많이 보이게 함.

**텍스트 트리밍**: `section{ padding:76px 0 }` → `60px 0`, `.hero{ padding:92px 0 60px }` → `72px 0 44px`, `.promo-wrap{ padding:0 0 76px }` → `0 0 60px`로 섹션 간 여백을 전반적으로 줄임. 히어로 설명 문구, 혜택(`#benefits`) 섹션의 소개 문구(`sec-head p`, 아예 삭제)와 카드 설명, 이용방법(`#how`) 3개 카드 설명을 전부 한두 문장으로 축약 — 핵심 정보(50% 요율, 매일·1시간 내외 정산, 전용 링크 필수 등)는 유지하고 부연 설명만 덜어냄.

로컬 `wrangler dev` + Playwright로 데스크톱(1440px)/태블릿(820·800px)/모바일(390px) 전부 가로 오버플로우 0px 확인, `.reveal` 스크롤 애니메이션을 강제로 켜서(`classList.add('is-visible')`) 실제 레이아웃(UID 확인 카드 + 실시간 페이백 내역 카드가 나란히, 모바일에선 세로로 쌓임)을 스크린샷으로 확인, 페이백 모달 열기/닫기 정상 동작 확인. `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- `.reveal` + `IntersectionObserver` 스크롤 리빌 애니메이션은 자동화 스크린샷 도구(Playwright 등)로 전체 페이지를 한 번에 캡처하면 아직 스크롤 안 된 아래쪽 섹션들이 빈 화면으로 찍히는 게 정상 동작임(실제 사용자는 스크롤하면서 순서대로 보임) — 다음에 이 사이트를 스크린샷으로 점검할 때는 `.reveal` 요소에 `is-visible` 클래스를 강제로 붙이거나, 충분히 긴 대기시간을 주고 스크롤을 실제로 끝까지 내린 뒤 캡처해야 "콘텐츠가 사라졌다"는 오판을 피할 수 있음.
- 실시간 페이백 내역이 40건까지 쌓이려면 시간이 걸림 — 지금 당장은 신청이 적어서 체감이 안 될 수 있지만 구조는 이미 늘려둔 상태.

## 20-16단계: 스터디방 관리 봇(신청 연결·승인·비활성 자동 내보내기) + PC 원격작업 가이드 (2026-10-11)

사용자 요청: ① 텔레그램 봇에 메시지를 보내면 사용자 PC(Windows)의 Claude가 브라우저 검색·앱 실행·문서 작성을 처리하는 구조, ③ 스터디방(비공개 텔레그램 그룹)에서 레퍼럴이 아니거나 30일간 거래 없는 멤버 자동 내보내기. (② "채널 '빗각에 대한 모든것' 글을 Threads API로 올리기"는 처음엔 하기로 했다가 사용자가 "1번과 3번만"으로 범위를 줄여서 **구현 안 함**.)

**봇 분리(중요)**: 한 봇 토큰은 웹훅과 getUpdates 폴링을 동시에 못 씀. 스터디방 기능은 사이트 서버가 웹훅으로 받아야 하므로 **기존 봇 = 스터디방 관리(웹훅)**, **새 봇 = PC 원격작업(Claude Code Channels 플러그인이 폴링)**으로 나눔. 사용자가 "봇은 전에 쓰던거 똑같이"라고 했지만 이 제약 때문에 PC용은 새 봇이 필요하다고 안내함.

**① PC 원격작업**: 코드 변경 없음 — 사용자 PC에서 설정하는 것이라 `docs/telegram-setup.md` A절에 Windows 단계별 가이드만 작성. Claude Code의 Channels(리서치 프리뷰, `telegram@claude-plugins-official` 플러그인, Bun 필요) + `--chrome`(Claude in Chrome 확장) 조합: `claude --chrome --channels plugin:telegram@claude-plugins-official`, 페어링 후 `/telegram:access policy allowlist`로 본인만 허용. PC가 켜져 있고 세션이 열려 있어야 동작, 자리 비울 땐 권한 확인 창에서 멈추므로 auto 모드 권장.

**③ 스터디방 봇 (`src/study-bot.js` 신설)**:
- **숫자 ID 확보 방식**: 사용자는 "@아이디로 봇이 숫자 ID를 검색하면 되지 않나"라고 제안했지만 **Bot API는 개인의 @username → user_id 조회가 불가능**(getChat은 공개 채널/그룹만). 그래서 사이트 ③단계를 "텔레그램으로 신청하기" 딥링크 버튼으로 바꿈 — `POST /api/telegram-link`가 UID를 서버에서 재검증(direct_referral) 후 1회용 토큰(24h)을 `tg_link_tokens`에 저장하고 `t.me/<봇>?start=<토큰>`을 돌려줌 → 신청자가 봇에서 시작을 누르면 웹훅이 `from.id`(불변 숫자 ID)와 UID를 `tg_members`에 연결. @아이디 오타/미보유 문제 없음. 예전 `telegram_join_requests`에도 같이 기록.
- **승인은 운영자 수동**(시드 예치는 API로 확인 불가): 운영자에게 승인/거절 인라인 버튼 알림 → 승인 시 `createChatInviteLink`(member_limit=1, 24h)로 전용 링크 생성해 신청자에게 DM. 그 링크로 다른 사람이 들어오면(`chat_member.invite_link` 비교) 즉시 내보내고 알림.
- **활동 검사 크론**(`5,20,35,50 * * * *`, 기존 페이백 크론과 별도 invocation — 서브요청 한도 분리 목적): 1회 5명씩(무료 플랜 서브요청 50개 한도 고려). referral이 direct_referral 아니면 대상, 입장(joined_at) 30일 경과 + 최근 30일 `commission_history` 기록 0건이면 대상, 23일 무거래면 경고 DM. Gate/텔레그램 오류 시 절대 내보내지 않고 약 2시간 후 재검사. 그룹 관리자/운영자는 제외. 내보내기 = ban(60초) 후 즉시 unban(재입장 가능).
- **자동 내보내기 기본 꺼짐**(`app_kv.autokick`) — 꺼져 있으면 운영자에게 "대상" 알림만 1회. `/autokick on`으로 켬. 경고 DM도 켜져 있을 때만 보냄.
- **기존 멤버**: Bot API로 그룹 멤버 목록을 못 가져와서, 입장/메시지로 감지된 미등록자를 `tg_seen`에 쌓고 운영자가 `/unlinked`로 확인 후 `/kick_unlinked confirm`(1회 10명)으로 정리 — 자동으로는 안 내보냄.
- 관리 명령(운영자 DM): `/status`, `/autokick on|off`, `/unlinked`, `/kick_unlinked confirm`, 그룹 안 `/groupid`.
- **안전한 배포**: `TELEGRAM_WEBHOOK_SECRET`이 없으면 `/api/telegram-link`가 `fallback:true`(503)를 주고 프론트가 예전 @아이디 입력 폼으로 자동 대체 → 사용자가 설정하기 전에도 기존 신청 흐름이 안 깨짐. 웹훅은 `X-Telegram-Bot-Api-Secret-Token` 헤더 불일치 시 403.
- 검증: node:sqlite 기반 가짜 D1 + 텔레그램/Gate.io fetch 목으로 시나리오 26개(딥링크 발급, 토큰 재사용 거부, 비관리자 승인 거부, 승인→1회용 링크, 링크 도용 내보내기, 미등록 감지, 자동 꺼짐 시 flag만, Gate 실패 시 미처리, 활동자 유지, 그룹 관리자 제외, 25일 경고, 31일 내보내기, 레퍼럴 해제 내보내기, 관리 명령) 전부 통과. Playwright로 ③단계 두 모드(봇/대체) 데스크톱·모바일 확인, 가로 오버플로우 0.

### 다음에 볼 것
- 사용자가 `docs/telegram-setup.md` B절대로 웹훅/환경변수(`TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_GROUP_CHAT_ID`)를 설정해야 실제 동작함 — 실제 텔레그램에서 end-to-end로 돌려본 적은 없음(이 세션엔 봇 토큰 없음).
- "거래 여부" 판단이 `commission_history`(베타, 20-6단계 리스크 그대로)에 의존 — 자동 내보내기 켜기 전에 꺼진 상태의 "대상" 알림이 실제와 맞는지 사용자 확인 필요.
- `TELEGRAM_ADMIN_CHAT_ID`가 운영자 개인 ID가 아니라 그룹/채널 ID로 설정돼 있으면 관리 명령·승인 버튼이 안 먹음(가이드 B-3-4에 확인법 적어둠).
- 멤버가 하루 약 480명(15분×5명) 넘게 늘어나면 CHECK_BATCH/크론 주기 조정 필요(유료 플랜이면 배치 키워도 됨).

## 20-17단계: 실시간 페이백 동기화 크론을 15분 → 5분 간격으로 단축 (2026-10-12)

사용자가 "실시간 페이백 내역 확인하는거를 15분마다 말고 5분마다로 줄이는 것도 가능?"이라고 요청 — `wrangler.jsonc`의 `triggers.crons` 첫 번째 항목(`syncPaybackFeed()` 트리거)을 `*/15 * * * *` → `*/5 * * * *`로 변경. `src/worker.js` 상단 주석(`scheduled()` 설명)도 동일하게 수정.

**작업 중 main에 다른 세션의 큰 변경이 먼저 들어와 있던 걸 발견 → 신중하게 머지함**: 작업 브랜치에서 커밋 후 `main`에 병합하려는데, 그 사이 **다른 Claude 세션(Opus 5.5, 별도 session_019U7u...)이 "스터디방 관리 텔레그램 봇"(20-16단계, `src/study-bot.js` 595줄 신설 — 딥링크 신청/운영자 승인/비활성 멤버 자동 내보내기)을 이미 `main`에 병합해놓은 상태**였음. `wrangler.jsonc`와 `src/worker.js`에서 충돌 발생 — 그냥 내 쪽 변경으로 덮어쓰지 않고 먼저 상대 커밋(`git show adb4859 --stat`)과 `scheduled()`의 cron 분기 로직(`event.cron === MEMBERSHIP_CRON`이면 스터디방 활동검사, 그 외엔 페이백 동기화)을 읽어서 두 크론이 서로 다른 독립적인 용도라는 걸 확인한 뒤: `wrangler.jsonc`의 `triggers.crons`를 `["*/5 * * * *", "5,20,35,50 * * * *"]`(페이백 동기화만 5분으로 변경, 스터디방 봇의 `MEMBERSHIP_CRON`은 그대로 유지)로, `worker.js`의 안내 주석도 두 크론을 모두 설명하도록 합쳐서 해결함. 머지 커밋 메시지에 충돌 해결 근거를 남겨둠.

`node --check` (worker.js + study-bot.js 둘 다) + `wrangler deploy --dry-run`(합쳐진 결과 43.36 KiB — 20-16단계의 study-bot.js가 번들에 포함돼서 이전보다 커짐) 검증 후 배포.

### 다음에 볼 것
- 페이백 동기화가 5분마다 돌면서 `known_uids` 최대 200개를 순회 — 15분→5분으로 Gate.io API 호출 빈도가 3배 늘어남. 지금은 UID 수가 적어서 문제 없지만, 나중에 UID가 많이 쌓이면 Gate.io API 레이트리밋에 걸릴 가능성을 염두에 둘 것(에러 시 개별 UID만 건너뛰는 기존 방어 로직은 그대로 있음).
- 이번에 확인된 대로 **이 프로젝트는 지금 여러 세션(claude.ai 웹 세션 포함)이 동시에 같은 `main`을 건드릴 수 있는 상태** — 앞으로 병합 전엔 항상 `git log origin/main`으로 내가 모르는 커밋이 먼저 들어와 있지 않은지 먼저 확인하고, 충돌이 나면 상대 커밋의 의도를 먼저 파악한 뒤 병합할 것(이번처럼 그냥 내 변경으로 덮어쓰면 스터디방 봇 크론이 통째로 사라질 뻔했음).

## 20-18단계: 누적 페이백 조회에 "총 수수료 추정치 / 20% 코드 비교" 추가 (2026-10-12)

사용자가 "여태까지 받은 페이백 조회하기 할 때 ① 여태까지 낸 대략적인 수수료량, ② 그중 환급 받은 수수료, ③ 원래 인플루언서 코드(20%)였다면 얼마를 받았을지, ④ 지금은 얼마를 더 받았는지도 같이 보여달라"고 요청.

**계산 근거 — 기존 20-6단계 공식을 그대로 확장**: 우리가 API로 조회 가능한 건 우리 몫 커미션(25%, `C`)뿐이고, 유저 몫(50%)은 `C × PAYBACK_RATIO(2)`로 이미 추정해오고 있었음. 이번엔 같은 논리를 한 단계 더 확장함 — "유저 50% : 파트너(우리) 25% : 거래소 25%"가 합쳐서 100%이므로, **그 구간에서 발생한 전체 수수료 풀 추정치 = `C × 4`**(새 상수 `TOTAL_FEE_MULTIPLIER = 4`)로 계산. 여기에 "일반적인 인플루언서/추천인 코드가 흔히 주는 20% 요율"(새 상수 `GENERIC_INFLUENCER_RATE = 0.2` — 실제 타사 요율을 조사해서 확정한 값이 아니라 업계에서 흔히 보이는 수준의 참고치, 코드 주석에도 명시) 가정을 적용해서 비교 금액을 뽑음:
```
total_fee_usdt   = C × 4                                (여태까지 낸 수수료 추정)
received_usdt    = C × PAYBACK_RATIO(2)                 (지금 50% 요율로 실제 받은 금액 — 기존 total_usdt와 동일)
generic20_usdt   = total_fee_usdt × GENERIC_INFLUENCER_RATE(0.2)  (일반 20% 코드였다면 받았을 금액)
extra_usdt       = received_usdt - generic20_usdt        (50% 요율 덕분에 더 받은 금액)
```
⚠️ 전부 하나의 관측값(25% 커미션 `C`)에서 파생된 추정치라, `C`나 전제(50:25:25 분배 구조)가 실제와 다르면 네 값 전부 비례해서 같이 틀어짐 — 20-6단계부터 이어온 베타 리스크와 동일 선상.

**구현**: `src/worker.js`의 `getUidPaybackTotal()`이 이제 (기존처럼 ×2한 값이 아니라) **원본 커미션 `C`를 그대로 반환**하도록 바꾸고, `handlePaybackTotal()`에서 위 4개 값을 전부 계산해서 응답에 추가(`total_usdt`/`received_usdt`는 호환을 위해 동일한 값을 계속 내려줌). `public/index.html`의 페이백 조회 모달(`renderResult()`)에 새 `.prv-breakdown` 박스를 추가 — 기존 큰 금액(이제 "받은 페이백" 라벨이 붙음) 아래에 "여태까지 낸 수수료(추정) / 일반 20% 코드였다면 / 50% 요율로 더 받은 금액(강조색)" 3줄을 표로 보여줌. 페이백이 0인 경우(아직 집계된 내역 없음)엔 이 breakdown 박스 자체를 숨겨서 전부 0으로 도배된 비교표가 뜨는 어색함을 피함.

로컬 `wrangler dev` + Playwright로 `/api/payback-total` 응답을 목(mock) 처리해서 데스크톱(480px)/모바일(390px) 둘 다 breakdown 박스가 정상 렌더링되고 가로 오버플로우 0px인 것 확인, 0건(페이백 없음) 케이스에서 breakdown이 안 뜨고 기존 안내문만 보이는 것도 확인. 병합 전엔 20-17단계 교훈대로 `git log origin/main`으로 다른 세션의 새 커밋이 없는지 먼저 확인(없었음). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- `TOTAL_FEE_MULTIPLIER`(=4)와 `GENERIC_INFLUENCER_RATE`(=20%) 둘 다 추정/참고치 상수 — 실제 Gate.io 분배 비율이 바뀌거나, "일반 인플루언서 코드 요율"에 대해 더 정확한 근거가 생기면 `src/worker.js` 상단에서 이 두 상수만 고치면 전체 계산이 같이 갱신됨.
- 이 값들도 20-6단계부터 이어진 베타 리스크 그대로(실제 Gate.io 키로 검증 안 됨) — 사용자가 실제 UID로 조회해서 Gate.io 파트너 대시보드 수치와 대조해볼 때, `received_usdt`(기존 total_usdt)뿐 아니라 `total_fee_usdt`/`generic20_usdt`/`extra_usdt`도 같이 눈대중으로 말이 되는 범위인지 확인해보면 좋음.

## 20-19단계: 페이백 계산 검증 + 실시간 피드 동기화 데이터 누락 버그 수정 + 크론 1분으로 단축 (2026-10-12)

사용자가 "계산에 오류 없는지 확인해보고, 동기화를 최대한 빨리 했으면 좋겠어, 실시간 페이백 기록이 너무 느려"라고 요청.

**계산 검증 결과 — 수식 자체는 정상**: `PAYBACK_RATIO`(2) / `TOTAL_FEE_MULTIPLIER`(4) / `GENERIC_INFLUENCER_RATE`(0.2) 세 상수로 파생되는 4개 값(받은 페이백/총 수수료 추정/20% 코드였다면/추가로 받은 금액)의 수식 일관성을 Node 스크립트로 여러 입력값(0, 1, 소수점, 백만 단위)에 돌려서 `받은 페이백 - 20%코드금액 = 추가금액` 항등식이 반올림 오차(0.01 USDT) 범위 안에서 항상 성립하고 `extra`가 절대 음수가 안 되는 것 확인 — 로직 버그 없음.

**실시간 피드 동기화에서 진짜 버그 발견 — 100건 넘는 커미션 기록이 조용히 누락되고 있었음**: `syncPaybackFeed()`가 Gate.io `commission_history` 조회 시 `offset=0` 고정, 즉 **1페이지(최대 100건)만** 가져오고 있었음(같은 파일의 `getUidPaybackTotal()`은 처음부터 페이지네이션을 했는데, 실시간 피드 쪽은 안 돼 있었음). 크론이 한동안 못 돌았거나(배포 중단 등) 거래량이 많은 UID의 경우 그 구간에 100건 넘게 쌓이면 101번째부터는 그냥 버려지고, `payback_cursor`는 그래도 `now`로 갱신되기 때문에 **그 누락분은 다음 크론에서도 영영 재조회되지 않고 사라짐** — 이게 "실시간 페이백 기록이 느리다/빠진다"는 체감의 실제 원인 중 하나였을 가능성이 높음. `getUidPaybackTotal()`과 같은 패턴으로 **최대 3페이지(300건)까지 이어받도록** 수정(1분 주기로 바뀌면서 한 UID가 1분 안에 300건 넘게 쌓일 일은 사실상 없다고 보고 3페이지로 설정 — `getUidPaybackTotal()`의 5페이지보다 적게 잡은 건 그쪽은 사용자가 직접 조회를 누른 1회성 요청이라 페이지를 더 돌아도 괜찮지만, 이쪽은 크론마다 반복 실행되는 백그라운드 작업이라 서브요청 예산을 더 보수적으로 씀). 수정한 페이지네이션 루프는 Node로 가짜 fetch를 넣어 0/50/100/150/250/300/350건 케이스를 전부 시뮬레이션해서 300건까지는 정확히 다 걷어오고 그 이상만 이번 실행에서 남는 것까지 확인.

**동기화 주기 단축**: `wrangler.jsonc`의 페이백 동기화 크론(`triggers.crons` 첫 번째 항목)을 `*/5 * * * *`(5분) → **`* * * * *`(1분, Cloudflare Cron Trigger가 지원하는 최소 간격)**로 변경. 스터디방 활동 검사용 `MEMBERSHIP_CRON`(`5,20,35,50 * * * *`)은 그대로 둠(서로 다른 cron 문자열이라 독립적으로 동작, 20-17단계 참고).

⚠️ **속도 향상의 트레이드오프**: 크론이 5배 더 자주 돌면서 `known_uids`(최대 200개)를 순회하는 Gate.io API 호출 빈도도 같이 늘어남 — 페이지네이션까지 더해지면 UID 하나당 최대 3배(최대 3페이지)까지 호출이 생길 수 있어서, 최악의 경우 분당 최대 600회(200 UID × 3페이지) Gate.io API 호출이 발생할 수 있음. 지금은 UID 수가 적어서 당장 문제 없지만, 나중에 UID가 많이 쌓이면 Gate.io API 레이트리밋이나 Cloudflare Workers 요금제별 서브요청 한도(무료 플랜은 호출당 50개)에 걸릴 수 있음 — 에러 발생 시 개별 UID만 건너뛰고(`cursor`를 안 건드려서 다음 크론에 자동 재시도) 전체가 멈추진 않도록 기존 방어 로직이 그대로 있지만, 실제 Cloudflare 요금제/Gate.io 쪽 레이트리밋 정책은 이 세션에서 확인 불가.

`node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- Cloudflare 계정이 무료 플랜이면 `known_uids`가 많아졌을 때(대략 17개 UID × 3페이지 ≈ 50 서브요청) 한 크론 실행 안에서 서브요청 한도에 걸려 뒷순위 UID들이 매번 조용히 실패할 수 있음 — 현재 `ORDER BY first_seen DESC`라 최근에 확인된 UID가 우선 처리되는 구조라 당장 큰 문제는 아니지만, UID 수가 많이 늘어나면 멤버십 체크 크론(`runMembershipCheck`, study-bot.js)처럼 배치 분할 방식으로 바꿔야 할 수 있음.
- 3페이지(300건) 상한을 넘는 극단적 케이스(한 UID가 1분 안에 300건 넘는 커미션 레코드)는 여전히 이번 실행에서는 누락되고 다음 크론에서도 재조회 안 됨(cursor가 `now`로 갱신되므로) — 이론상 가능성은 낮다고 보고 받아들인 한계치. 실사용 중 이런 대량 거래 유저가 확인되면 페이지 수를 늘리거나 cursor를 "마지막으로 성공한 페이지의 끝 시각"으로 더 정교하게 관리하는 로직이 필요.

## 20-20단계: 누적 페이백 조회 결과 문구/계산 재수정 + 폰트 교체 (2026-10-12)

사용자 피드백 3건:

1. **"받은 금액"을 "팀식스 50% 페이백으로 받은 금액"으로** — 20-18단계부터 이어진 breakdown 박스의 강조 행(`.prv-bd-row.highlight`) 라벨을 "받은 금액"에서 브랜드/요율을 명시한 문구로 교체.
2. **"받은 금액엔 총 페이백 받은 금액을 써야지, 인플루언서 코드보다 더 받은 페이백을 말하는게 아니라"** — 1번 요청 직후 사용자가 강조 행의 **값**이 잘못됐다고 지적함. 그 행은 1번 요청 전부터 계속 `data.extra_usdt`(인플루언서 20% 코드 대비 "더 받은" 차액)를 보여주고 있었는데, 라벨이 "팀식스 50% 페이백으로 받은 금액"으로 바뀌면서 "받은 금액 = 차액"이라는 게 명백히 어색해짐(라벨은 총액을 말하는데 값은 차액이었음). `public/index.html`의 `renderResult()`에서 그 행의 값을 `data.extra_usdt` → `data.total_usdt`(실제 받은 총 페이백, 카드 상단 큰 숫자와 동일한 값)로 수정 — "인플루언서 코드보다 더 받은 금액"은 바로 아래 `.prv-bd-note`("🎉 인플루언서 코드에 비해 X USDT 더 받았어요!")에 여전히 남아있어서 그 정보 자체는 안 사라짐, 강조 행과 역할만 분리됨.
3. **"폰트도 좀 다른걸로 색다른걸로 바꿔도 좋을 것 같아, 보기 편한걸로 일반 글씨체처럼"** — 기존엔 본문 `Inter`, 제목/강조 `Sora`를 쓰고 있었는데, **둘 다 한글(Hangul) 글리프가 없는 서체라 사이트의 거의 모든 한글 텍스트가 이 서체들로 지정돼 있는 것과 무관하게 실제로는 브라우저 기본 시스템 폰트로 조용히 폴백되고 있었음**(지정한 적도 의도한 적도 없는 폰트가 쓰이고 있었던 셈). 이번 요청을 계기로 Latin+한글을 모두 지원하는 서체 하나로 통일 — `IBM Plex Sans KR`(Google Fonts 제공, 기존처럼 `<link rel="preload">` 비동기 패턴 재사용)로 교체. 깔끔하고 가독성 좋으면서도("일반 글씨체처럼") 기존 브라우저 기본 폰트와는 분명히 다른 느낌("색다른")이라 두 요구를 동시에 만족한다고 판단. `h1,h2,h3`/`.ex-row .val.muted`/`.feed-avatar`/`.how-num`/`.choice-btn`/`.faq-item summary` 등 `Sora`/`Inter`를 명시하던 모든 지점을 동일하게 교체(`sed`로 일괄 치환 후 grep으로 잔존 0건 확인). 숫자/UID/금액 전용 `JetBrains Mono`는 이번 요청과 무관해서 그대로 유지.

로컬 `wrangler dev` + Playwright로 폰트가 실제로 로드/적용되는지 확인(`document.fonts.check('16px "IBM Plex Sans KR"')` → true, body/h1 `font-family` computed style 확인) + 전체 페이지 스크린샷으로 한글 렌더링 깨짐 없는 것 확인. `node --check` + `wrangler deploy --dry-run` 검증 후 3건 각각 개별 커밋으로 배포(병합 전마다 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인, 20-17단계 교훈 그대로 준수).

### 다음에 볼 것
- breakdown의 네 값(받은 금액/낸 수수료 추정/20% 코드였다면/차액)은 전부 20-6단계부터 이어진 베타 리스크(`commission_history` 응답 필드가 실제 키로 검증 안 됨) 위에 쌓인 추정치 — 이번 수정은 "어떤 값을 어느 라벨에 붙일지"만 바로잡은 것이고, 근본적인 데이터 신뢰도 이슈는 그대로 남아있음.
- `IBM Plex Sans KR`은 Google Fonts(`fonts.googleapis.com`)로 서빙됨 — 이 프로젝트가 이미 프로덕션에서 안정적으로 써온 도메인이라 리스크는 낮지만, 혹시 이 서체가 느리다거나 마음에 안 든다는 피드백이 오면 같은 `<link rel="preload">` 패턴으로 다른 Google Fonts 한글 서체(`Noto Sans KR`/`Gothic A1`/`Pretendard`는 Google Fonts에 없어서 별도 CDN 필요)로 교체 가능.

## 20-21단계: 실시간 페이백 내역에서 같은 사람 기록이 여러 줄로 쪼개지던 문제 수정 (2026-10-12)

사용자가 "실시간 페이백 내역을 같은 사람거를 너무 여러개로 쪼개지 말고 한번에 합쳐서 보여줘 왠만하면"이라고 요청.

**원인**: `syncPaybackFeed()`가 Gate.io `commission_history`에서 가져온 커미션 레코드 **하나당 `payback_feed`에 한 줄씩** 넣고 있었음(20-19단계에서 페이지네이션을 3페이지까지 늘린 것과 맞물려서 더 두드러짐) — 한 사람이 그 동기화 구간 동안 여러 번 체결했거나, 크론이 밀렸다가 한 번에 따라잡을 때(최대 300건)는 그 사람 한 명의 내역이 실시간 피드 상위 40건 중 여러 줄을 동시에 차지하는 식으로 보였음.

**고친 방법**: `syncPaybackFeed()`의 UID별 루프에서 레코드 건건이 바로 INSERT하던 걸, 그 동기화 구간에서 가져온 해당 UID의 모든 USDT 커미션을 **먼저 다 합산한 뒤 UID당 한 줄만** `payback_feed`에 적재하도록 변경(`totalAmount` 누적 → 루프 끝나고 한 번만 INSERT, 0건이면 INSERT 자체를 생략). 날짜 표시는 20-14단계부터 이미 우리가 직접 기록하는 `created_at`(동기화 시각) 기준이라 이번 변경과 무관하게 그대로 정확함 — `commission_time`은 DB에는 참고용으로 남기되(이번엔 합산 구간 중 가장 늦은 시각을 저장) 화면 표시엔 안 씀. `source` 컬럼은 합산된 값이라 의미가 없어져서 `'merged'`로 고정.

로컬 Node 스크립트로 집계 로직만 따로 시뮬레이션해서(여러 건의 가짜 커미션 레코드를 넣고 합산액/최신시각/삽입건수 검증, 0건일 때 삽입 안 되는 것도 확인) 정확성 확인 — 실제 Gate.io 키가 없어서 end-to-end 크론 실행 자체는 이번에도 검증 못 함(20-6단계부터 이어진 베타 리스크 그대로). 기존에 이미 쌓인 과거 `payback_feed` 행(건건이 분리된 채 저장된 것)은 손대지 않음 — 이 프로젝트의 "데이터는 보존, 코드만 수정" 원칙대로 과거 데이터를 지우거나 합치지 않고, 이후 새로 쌓이는 행부터 합쳐진 형태로 나감. `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- "UID당 한 줄"은 크론 한 틱(1분) 기준으로만 합쳐짐 — 같은 사람이 연속된 여러 크론 틱(분)에 걸쳐 계속 체결하면 그만큼 여러 줄이 다시 생길 수 있음. 지금은 "같은 틱 안에서는 반드시 합쳐진다"까지만 보장하는 수준이고, 더 긴 시간 창(예: 최근 N분 내 같은 UID는 무조건 합침)으로 강화하고 싶으면 `handlePaybackFeed()`의 조회 쿼리 쪽에서 추가로 묶어주는 방식을 고려할 것.
- `source` 컬럼이 이제 `'merged'` 고정값이라, 혹시 나중에 SPOT/FUTURES 구분이 다시 필요해지면(지금은 어디서도 안 씀) 합산 시점에 소스별로 따로 더해서 여러 줄을 유지하거나 별도 컬럼으로 분리해야 함.

## 20-22단계: 전체 회원 누적 페이백 합계를 히어로 통계 칩으로 노출 (2026-10-13)

⚠️ **이 기능은 배포 직후 20-23단계에서 사용자가 바로 반려하고 전체 제거됨 — 아래 "20-23단계" 섹션 참고.** 이 문단은 그 과정(특히 중간에 발견/수정한 버그와 교훈)을 남겨두는 기록용이고, 현재 코드베이스에는 이 기능 자체가 없음.

사용자가 "그 사이트에 여태까지 페이백 가입한 회원이 받은 모든 페이백 액수를 합쳐서 보여주면 좋을 것 같음"이라고 요청 — 기존 `/api/payback-total`은 UID 하나를 입력해야 그 사람 개인 누적액만 보여주는데, 이번 요청은 **특정 UID가 아니라 사이트 전체(모든 회원 합산)** 누적 지급액을 보여달라는 것.

**구현 — 매번 Gate.io를 라이브 조회하지 않고, 이미 쌓여있는 `payback_feed` 테이블을 그대로 합산**: `payback_feed`는 20-6단계부터 1분(또는 그 이전엔 5/15분)마다 도는 크론이 `known_uids`의 각 UID에 대해 그 구간의 커미션을 적재해온 누적 로그이고, 20-21단계부터는 UID+동기화 구간당 한 줄로 합쳐져서 쌓임 — 즉 이 테이블 전체를 `SUM(amount_usdt)` 하면 "지금까지 집계된 전체 회원의 페이백 합계"가 그대로 나옴. 전체 회원을 대상으로 매번 Gate.io API를 라이브로 호출하는 것(`getUidPaybackTotal()`을 모든 UID에 대해 반복 — 느리고 API 호출량도 큼)보다 훨씬 가볍고 빠름.
- `GET /api/payback-grand-total`(신설, 공개) — `SELECT COALESCE(SUM(amount_usdt),0) FROM payback_feed`만 실행하고 반올림해서 반환.
- `public/index.html` 히어로 통계 칩 줄 맨 앞에 강조 칩(`#grand-total-chip`, `.stat-chip.highlight` — 민트 톤 테두리/배경으로 다른 칩들과 구분) 추가 — 페이지 로드 시 이 API를 호출해서 값이 0보다 클 때만 칩을 드러내고(`hidden` 속성 토글, 20-18단계처럼 "전부 0으로 도배된" 어색한 표시를 피하는 패턴 재사용), 60초 간격으로 갱신.

**버그 발견 및 수정(배포 전) — 이 프로젝트에서 처음 나온 새로운 패턴**: Playwright로 API 응답을 mock해서 테스트했는데, 칩이 끝까지 `hidden`인 채로 안 뜸. 원인을 추적해보니 이 파일의 모든 기능이 각각 독립된 최상위 `(function(){...})();` IIFE로 분리돼 있고(메뉴 토글/페이백 모달/실시간 피드 등), **그 중 하나(페이백 모달 쪽)가 정의한 `formatAmount()` 헬퍼는 그 IIFE 안에서만 접근 가능한 지역 함수**라서, 새로 추가한 별도의 IIFE에서 그 이름을 그대로 호출하면 `ReferenceError`가 남. 이 에러가 `fetch().then(...).catch(function(){})`의 `then` 콜백 안에서 발생해서 마지막 `catch`에 조용히 삼켜지는 바람에, 네트워크 요청은 성공하는데도(개발자도구 네트워크 탭엔 정상 200으로 보임) 화면은 아무 변화 없이 그대로인 상태가 됐음 — 증상만 보면 "API는 되는데 화면에 안 반영된다"로 보여서 원인을 바로 못 찾고, 실제로 `formatAmount`가 `window`에 전역으로 안 걸려있다는 걸 Playwright로 `typeof formatAmount` 직접 찍어봐서 확인한 뒤에야 알아냄. **고친 방법**: 다른 IIFE의 헬퍼를 참조하는 대신, 같은 포맷팅 로직(`toLocaleString` 소수점 2자리)을 새 IIFE 안에 자체적으로 작게 복제해서 넣음 — 공유 함수로 빼서 재사용하는 대신 각 IIFE가 필요한 걸 자기 안에 작게 들고 있는 이 파일의 기존 구조(기능별로 독립된 IIFE, 공유 전역 유틸이 거의 없음)에 맞춘 선택.
- **교훈**: 이 프로젝트의 `public/index.html`은 기능마다 별도의 `(function(){...})();`로 캡슐화돼 있어서, 새 기능을 추가할 때 "다른 기능이 쓰던 헬퍼 함수(`formatAmount`/`escapeHtml` 등)를 그대로 가져다 쓸 수 있겠지"라고 가정하면 안 됨 — 그 함수가 전역(`window`)에 걸려있는지, 아니면 어떤 IIFE 안에 갇혀있는지 먼저 확인해야 하고, 갇혀있다면 작게 복제하거나(이번 선택) 그 IIFE 바깥/전역으로 끌어올려야 함. 또한 이런 종류의 실패(비동기 콜백 안에서 발생한 `ReferenceError`가 trailing `.catch()`에 조용히 삼켜짐)는 `curl`로 API 응답만 확인해서는 절대 못 잡고, 실제 브라우저(Playwright)에서 DOM 결과까지 확인해야 드러남 — API가 200을 반환한다고 프론트가 그 값을 제대로 쓰고 있다는 보장은 없다는 걸 보여준 사례.

로컬 `wrangler dev` + Playwright로: (1) API 응답을 12,345.67 USDT로 mock했을 때 칩이 `hidden=false`로 바뀌고 "💰 누적 페이백 지급액 12,345.67 USDT"로 정상 표시되는 것, (2) 0으로 mock했을 때 계속 `hidden`인 것, (3) 모바일(390px)에서 큰 숫자(98,765.43)로도 가로 오버플로우 0px인 것까지 스크린샷으로 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- `payback_feed`는 20-6단계(2026-10-10)에 테이블이 생기고부터 쌓인 기록이고, 모든 UID 최초 조회 시작점이 `PAYBACK_START_SEC`(2026-10-08) 이상으로 클램프돼 있어서 — 이 SUM은 "2026-10-08 이후 집계 시작된 전체 페이백"을 의미함. 숫자가 작아 보일 수 있다는 걸 감안할 것(트래픽이 늘고 시간이 지나면 자연히 커짐).
- 이 총합도 `payback_feed`에 실제로 적재된 내역에만 의존 — 그 적재 자체가 20-6단계부터 이어진 베타 리스크(Gate.io `commission_history` 응답 필드 미검증) 위에 있다는 점은 동일. 사용자가 실제 Gate.io 파트너 대시보드 전체 커미션 합계와 한 번 대조해보면 신뢰도를 더 높일 수 있음.
- 같은 페이지 안에 "formatAmount 같은 이름의 지역 함수가 여러 IIFE에 따로 존재"하는 구조라서, 앞으로 또 새 기능을 추가할 때 이번과 같은 실수가 재발할 수 있음 — 새 IIFE를 추가할 때는 그 안에서 쓰는 모든 함수가 정말 그 스코프 안에 있는지(또는 전역인지) 먼저 `grep`으로 확인하는 습관을 들일 것.

## 20-23단계: 누적 페이백 합계 칩 반려 → 완전 제거 (2026-10-13)

20-22단계 배포 직후 사용자가 "아니야 그냥 빼줘"라고 요청 — 별다른 이유 설명 없이 바로 반려함. `GET /api/payback-grand-total` 핸들러/라우트/API 문서 주석을 `src/worker.js`에서 전부 삭제하고, `public/index.html`의 `#grand-total-chip` 마크업·`.stat-chip.highlight` CSS·해당 IIFE(폴링 JS)도 전부 삭제 — 20-22단계 커밋이 추가한 내용을 그대로 되돌림(diff가 정확히 반대 방향). `node --check` + `wrangler deploy --dry-run`으로 번들 크기가 기능 추가 전 수치(44.19 KiB)로 돌아온 것까지 확인 후 배포.

20-22단계 중간에 발견했던 "별도 IIFE에서 다른 IIFE의 지역 함수(`formatAmount`)를 잘못 참조하면 에러가 `.catch()`에 조용히 삼켜진다"는 교훈 자체는 이 기능과 무관하게 이 프로젝트 구조에 계속 유효하므로 20-22단계 섹션에 그대로 남겨둠 — 기능은 없어졌지만 패턴은 재발 가능.

### 다음에 볼 것
- 누적 총액 자체에 대한 수요가 완전히 사라진 건지, 아니면 다른 형태(예: 별도 섹션, 다른 위치, 다른 문구)로 다시 요청이 올 수도 있는지는 불명확 — 사용자가 "그냥 빼줘"라고만 했고 이유를 안 밝혔으므로, 비슷한 요청이 다시 오면 이번과 다른 접근(예: 위치/문구를 바꿔서)으로 제안해볼 수 있음.

## 20-24단계: 실시간 페이백 내역이 몇 시간씩 뒤처지는 버그 수정 (2026-10-13)

사용자가 "실시간 페이백 내역 관련된 코드 오류 없는지 체크 좀 해봐. 딜레이가 계속 있는거 같아 길게. 커미션은 들어오는데 마지막 페이백은 7시간전이래 무슨"이라고 요청 — Gate.io 쪽에서는 커미션이 계속 들어오는 게 보이는데, 사이트의 "실시간 페이백 내역" 피드는 가장 최근 항목이 7시간 전에 멈춰있는 증상.

**진짜 원인 — `syncPaybackFeed()`의 동기화 창이 너무 얇아서, 늦게 집계되는 커미션을 영영 놓치는 구조였음**: 크론이 매 틱(1분)마다 `since = 직전 틱에서 기록해둔 커서(last_checked)`, `to = now`로 Gate.io `commission_history`를 조회하고, 틱이 끝나면 커서를 그 틱의 `now`로 전진시키는 구조였음 — 매 틱 딱 "지난 1분 치"만 보는 셈. 문제는 **Gate.io가 커미션을 실제 거래 시점보다 몇 시간 늦게 집계/노출할 수 있다는 것**(베타, 실 키로 검증된 적은 없지만 이번 증상과 정확히 들어맞음 — 20-14단계에서도 `commission_time` 필드 자체가 신뢰할 수 없다는 게 이미 한 번 확인된 바 있음, 그 연장선). 거래가 일어난 지 7시간 뒤에야 Gate.io API에 그 커미션이 "방금 잡힌 것"처럼 나타난다면, 그 시점엔 우리 커서(`since`)가 이미 몇 시간이나 더 전진해있는 상태라 — 7시간 전 시각을 가진 그 레코드는 `since`(최근 몇 분 전)보다 더 오래된 시각이라서 `from=since` 필터에 걸려 아예 조회조차 안 됨. **한 번 이렇게 지나가면 커서는 계속 앞으로만 가고 뒤를 돌아보지 않으므로, 그 커미션은 영원히 다시 조회되지 않음** — "실시간 피드가 특정 시점에 멈춘 것처럼 보인다"는 증상을 정확히 설명하는 구조적 버그였음.

**고친 방법**: 매 틱마다 커서보다 **24시간 더 과거까지 겹쳐서 다시 조회**하도록 바꿈(`SYNC_SAFETY_LOOKBACK_SEC`, 사용자가 관측한 7시간 지연보다 넉넉한 여유). 겹쳐서 다시 읽은 레코드가 중복으로 쌓이지 않도록, 20-21단계에서 "같은 사람 건 UID당 한 줄로 합산해서 적재"하던 걸 **레코드 단위로 그대로 적재하는 방식으로 되돌림** — `payback_feed`의 `UNIQUE(uid, commission_time, amount_usdt, source)` 제약 + `INSERT OR IGNORE`가 이미 봤던 레코드는 자동으로 걸러주므로, 창을 넓게 겹쳐도 안전함(공짜 멱등성). 다만 이러면 20-21단계가 고치려던 "같은 사람이 짧은 시간에 여러 줄로 쪼개져 보이는" 문제가 다시 생기므로, 그 병합은 **적재 시점이 아니라 `GET /api/payback-feed`가 응답을 만들 때(보여줄 때)**로 옮김 — 최근 300건을 가져와서 같은 UID가 15분 이내로 연달아 나오면 한 줄로 합쳐서 최대 40줄까지 내려줌. 이렇게 하면 "데이터 완전성(지연 커미션도 놓치지 않기)"과 "화면상 깔끔함(같은 사람 안 쪼개기)"이라는 서로 다른 두 요구가 적재 로직과 표시 로직으로 깔끔하게 분리됨.

**부가 수정**: `syncPaybackFeed()`의 per-UID `catch` 블록이 모든 에러를 완전히 조용히 삼키고 있어서(한 명 실패해도 전체가 안 멈추게 하려는 의도 자체는 맞지만, 그 결과 어떤 실패가 일어나고 있는지 전혀 알 방법이 없었음) — `console.error(...)`로 로그를 남기도록 추가. Cloudflare 대시보드 Workers → sixsix → Logs(또는 `wrangler tail`)에서 실제로 반복되는 실패가 있는지 다음에 또 지연 증상이 생기면 확인할 수 있게 됨.

**⚠️ 확인 못 한 것(이 세션의 한계)**: 이 가설(Gate.io 커미션 집계 지연)은 증상과 정확히 들어맞고 코드로 재현 가능한 구체적 메커니즘이 있어서 확신을 갖고 고쳤지만, 실제로 Gate.io가 정말 몇 시간씩 늦게 커미션을 노출하는지는 이 세션에 실 키가 없어서 직접 확인은 못 했음(20-6단계부터 이어진 베타 리스크 동일). 또한 **크론 자체가 Cloudflare 계정에 정상 등록돼서 1분마다 실제로 실행되고 있는지도 이 세션에선 확인 불가**(Cloudflare API 인증 없음, 14·20-6·20-16단계에서도 반복된 제약) — 이번 수정 이후에도 피드가 계속 멈춰있다면, 코드 문제가 아니라 크론 자체가 하나도 안 돌고 있을 가능성을 대시보드에서 먼저 확인해볼 것(Workers → sixsix → Settings → Triggers, 그리고 Logs에서 `syncPaybackFeed failed` 로그가 반복되는지).

로컬 Node 스크립트로: (1) 24시간 lookback이 있으면 7시간 지연된 레코드를 실제로 캡처할 수 있다는 것(있기 전엔 못 캡처하는 것도 같이 재현해서 버그 자체를 증명), (2) 겹쳐서 다시 읽어도 `INSERT OR IGNORE` 방식의 중복 제거가 정확히 동작하는 것, (3) `GET /api/payback-feed`의 신규 표시-시점 병합 로직이 같은 UID를 15분 이내로만 합치고 다른 UID와는 안 섞이며 40줄 상한을 정확히 지키는 것(상한 도달 직후에도 바로 다음 레코드가 같은 UID면 계속 합쳐지는 것까지)을 각각 시뮬레이션으로 확인. 로컬 `wrangler dev` + Playwright로 `/api/payback-feed` mock 응답을 넣어 프론트 렌더링(마스킹된 UID/경과시간/금액)이 응답 필드 변경(`commission_time`/`source` 제거) 이후에도 깨짐 없이 동작하는 것 확인(프론트는 애초에 `uid`/`amount_usdt`/`created_at`만 썼어서 영향 없었음). `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인 후 배포.

### 다음에 볼 것
- **사용자 확인 필요**: 배포 후 실제로 피드가 다시 움직이기 시작하는지, "마지막 항목이 N시간 전"이라는 증상이 재발하는지 며칠 지켜봐줄 것 — 재발하면 24시간 lookback으로도 부족한 더 긴 지연이 있다는 뜻이므로 `SYNC_SAFETY_LOOKBACK_SEC`를 더 늘리거나, 애초에 크론이 전혀 안 돌고 있는 건 아닌지(Cloudflare 대시보드 Logs) 먼저 확인.
- 창을 24시간으로 넓히면서, 활동이 아주 많은(24시간 안에 500건 넘는) UID는 여전히 5페이지(500건) 상한을 넘는 분량이 누락될 수 있음 — 20-19/20-21단계부터 이어진 동일한 종류의 받아들인 한계치, 지금 당장 그 정도 활동량의 UID는 없다고 보고 손 안 댐.
- `known_uids`가 많이 늘어나면(200개 한도까지) 크론 한 번에 처리할 Gate API 호출량이 늘어나서 Cloudflare 서브요청 한도/Gate 레이트리밋에 걸릴 수 있다는 리스크는 20-19단계에서 이미 적어둔 그대로 — 이번 수정으로 "창이 넓어졌다"고 해서 평소(저활동 UID 기준) 호출량이 크게 늘지는 않음(대부분 틱당 UID 1건이 여전히 Gate API 1회 호출로 끝남), 단 고활동 UID는 페이지네이션이 더 자주 돌 수 있음. → **20-25단계에서 이 리스크가 실제로 "매 틱마다 24시간 lookback을 전체 known_uids에 거는" 형태로 구체화돼서 빈도를 낮춤, 아래 참고.**

## 20-25단계: 20-24단계 수정이 만든 새 문제 — 매 틱 24시간 lookback의 API 부하 (2026-10-14)

사용자가 "실시간 페이백 내역 또 이상하다 체크해라"라고 요청 — 20-24단계에서 "7시간 지연" 문제를 고친 바로 다음 날 다시 이상 증상 보고. 실 키/실 로그가 없어서 이번에도 라이브로 재현은 못 했지만, 20-24단계가 바꾼 코드를 다시 처음부터 정독하다가 **그 수정 자체가 만들어낸 새로운 회귀(regression)를 발견함**.

**발견한 문제**: 20-24단계에서 "커서보다 24시간 더 과거까지 겹쳐서 재조회"하도록 고쳤는데, 이걸 **1분마다 도는 크론의 매 틱마다, known_uids 최대 200개 전부에 대해** 적용하고 있었음. 즉 20-24단계 이전엔 매 틱 "커서 이후(보통 1분 치)"만 조회해서 Gate API 호출이 가벼웠는데, 20-24단계 이후로는 매 틱마다 "24시간 치" 구간을 다시 훑게 됨 — 활동이 많은 UID일수록 100건 넘는 레코드가 그 24시간 창 안에 쌓여있을 가능성이 높아지고, 그러면 최대 5페이지까지 페이지네이션이 돌게 됨. 평소엔 활동이 적은 UID는 여전히 호출 1회로 끝나서 당장 티가 안 날 수 있지만, UID 수가 늘거나 활동이 많은 회원이 하나라도 생기면 **"7시간 지연 버그를 고치려다 만든 수정이, 그 수정 자체의 API 호출량 증가 때문에 Gate.io 레이트리밋이나 Cloudflare 서브요청 한도에 걸려서 동기화가 실패하고, 결과적으로 똑같은 '피드가 멈춘 것처럼 보이는' 증상이 다른 경로로 재발할 수 있는" 상황이었음 — 20-19단계에서 이미 "다음에 볼 것"으로 적어뒀던 리스크가 20-24단계의 변경으로 훨씬 현실화되기 쉬운 형태로 바뀐 것.

**고친 방법**: 24시간 lookback을 "매 틱"이 아니라 **10분에 한 번(크론 10틱마다)**만 적용하도록 바꿈(`WIDE_SCAN_INTERVAL_MIN = 10`, `Math.floor(now/60) % 10 === 0`로 판정 — 분 단위 경계 기준이라 크론 타이밍이 흔들려도 안정적). 나머지 9번의 틱은 20-24단계 이전과 동일하게 "커서 이후만" 보는 저비용 경로를 그대로 씀. 이렇게 하면:
- 지연된 커미션을 놓치지 않는다는 20-24단계의 핵심 목적은 거의 그대로 유지됨 — 최악의 경우에도 10분 안에는 다음 wide scan 틱에서 잡힘(24시간 지연 허용치에 비하면 10분은 무시할 수 있는 수준).
- 평소(9/10 틱) API 호출량은 20-24단계 이전 수준으로 되돌아가서, 20-24단계가 만든 부하 증가 자체를 없앰.

로컬 Node 스크립트로 60분·120분을 시뮬레이션해서 10틱마다 정확히 1번 wide scan이 걸리는 것, wide scan 사이 최대 간격이 정확히 10분인 것을 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인 후 배포.

⚠️ **여전히 확인 못 한 것**: 이번에도 사용자가 구체적으로 "어떻게" 이상한지(여전히 지연인지, 다른 증상인지) 알려주지 않아서, 이게 정확히 "또 이상하다"의 원인이라고 100% 확신하고 고친 건 아님 — 코드 리뷰로 찾아낸, 20-24단계가 만들었을 법한 가장 그럴듯한 회귀를 선제적으로 고친 것. 이 수정 후에도 문제가 계속되면, 다음엔 꼭 구체적인 증상(예: "마지막 항목이 몇 시간 전인지", "금액이 이상한지", "특정 UID가 중복으로 보이는지" 등)을 알려주면 훨씬 정확하게 짚을 수 있음 — 이 세션은 운영 DB/Cloudflare 로그/실 Gate 키 전부 접근 불가라 코드 리뷰 이상의 직접 관측이 불가능함.

### 다음에 볼 것
- **사용자 확인 필요**: 이번에도 배포 후 실제로 피드가 정상 동작하는지 지켜봐줄 것, 그리고 "이상하다"가 정확히 어떤 증상인지(화면 캡처나 구체적 설명) 알려주면 다음엔 더 정확하게 진단 가능.
- `WIDE_SCAN_INTERVAL_MIN`(10분)도 추정치 — 만약 Gate.io 레이트리밋이 생각보다 더 빡빡하다면 더 늘려야 할 수 있고, 반대로 지연이 10분보다 훨씬 자주 발생한다면 더 줄여야 할 수 있음. 지금은 둘 다 확인된 사실이 없어서 "24시간 지연을 10분 해상도로 잡는다"는 보수적인 중간값으로 잡음.
- 근본적으로 이 프로젝트에서 "Gate.io 응답 품질/타이밍을 검증할 실 키가 이 세션에 없다"는 제약이 이번 두 단계(20-24, 20-25)에서 특히 크게 발목을 잡음 — 두 수정 다 "증상과 들어맞는 그럴듯한 메커니즘"을 코드 리뷰로 찾아 고친 것이지, 실제로 그게 맞는지 라이브로 검증된 적은 없음. 운영 중 Cloudflare 대시보드 Logs에서 `syncPaybackFeed failed` 로그가 찍히는지 한 번 확인해주면 "API 호출이 실패하고 있는지"를 직접 알 수 있어서 가장 확실한 다음 디버깅 단서가 될 것.

## 20-26단계: 실시간 페이백 내역 표시 상한을 40건 → 300건으로 대폭 확대 (2026-10-15)

사용자가 "40건이라는게 무슨소리야 / 40건 밖에 못본다고 ? / 훨씬 늘려야지, / 예전껀 안뜨더라도 오늘 실시간 페이백 내역은 계속해서 뜨게 해줘야지"라고 요청 — 20-21/20-24단계에서 "같은 사람을 한 줄로 합치는" 로직을 넣을 때 화면에 보여주는 최종 개수를 40건으로 못박아뒀던 게, 활동이 많은 날엔 정작 오늘 내역도 다 못 보여줄 만큼 좁은 상한이었다는 지적.

**고친 방법**: `src/worker.js`의 `handlePaybackFeed()` — 병합 전 원본을 가져오는 `SELECT ... LIMIT 300`을 `LIMIT 2000`으로, 병합 후 최종 표시 상한(`merged.length >= 40`)을 `FEED_DISPLAY_LIMIT = 300`으로 각각 올림(상수로 분리해서 `FEED_RAW_FETCH_LIMIT`/`FEED_DISPLAY_LIMIT` 두 개로 이름 붙임). 원본 fetch를 표시 상한보다 넉넉히 크게 잡아야(기존엔 원본 300건 안에서 병합 후 40건을 뽑는 구조라, 활동이 많아 병합이 적게 일어나는 날엔 원본 300건 자체가 금방 소진돼서 더 가져올 수 있는 데이터가 있어도 못 보여주는 구조였음) 병합 로직이 바닥나지 않고 실제로 300건까지 채울 수 있음. 프론트(`public/index.html`)는 서버가 주는 `items` 배열을 그대로 렌더링하고 `.feed-list`가 이미 `max-height:480px; overflow-y:auto`로 스크롤 처리하고 있어서 별도 수정 불필요 — 개수가 늘어도 레이아웃이 깨지지 않음. 상단 API 문서 주석(`// GET /api/payback-feed ... 최대 40건`)도 `최대 300건`으로 같이 수정.

로컬 `wrangler dev`로 라우팅이 깨지지 않는지 재확인(로컬엔 `GATE_API_KEY`가 없어서 구조만 확인 가능). `node --check` + `wrangler deploy --dry-run` 검증 후 배포.

### 다음에 볼 것
- "오늘 내역이 항상 뜨게"는 이번 수정으로 사실상 보장됨 — `id DESC` 정렬이라 항상 최신 건이 우선이고, 300건은 현재 트래픽 규모에서 하루치를 넉넉히 덮을 수 있는 크기. 나중에 트래픽이 훨씬 늘어서 하루에 300건 넘는 병합 그룹이 쌓이면 그때는 "오늘 00:00 이후는 개수 무관하게 전부 포함" 같은 날짜 기준 보장으로 바꾸는 걸 고려할 것(지금은 개수 기반 상한만으로 충분하다고 판단).
- `FEED_RAW_FETCH_LIMIT`(2000)은 D1 SQLite 쿼리 비용상 전혀 부담 없는 크기라 넉넉하게 잡음 — 나중에 `FEED_DISPLAY_LIMIT`을 더 올리고 싶어지면 이 값도 그에 맞게 비례해서 같이 올려야 병합 로직이 데이터 부족으로 일찍 멈추지 않음.

## 20-27단계: CashMine.io 참고 UI로 전면 리디자인 — 거래소 비교 테이블 + 플로우 카드 + 페이백 계산기 (2026-10-15)

사용자가 다른 페이백 플랫폼(CashMine.io) 스크린샷 5장을 보여주며 "UI 도 이런식으로 고급지게 바뀌었으면 좋겠음. 너무 똑같이는 말고, 최대한 활용해서"라고 요청 — 구조/구성 아이디어는 적극적으로 차용하되, 색감·카피·배치 디테일은 다르게 가져가서 그대로 베낀 것처럼 보이지 않게 해달라는 주문.

**참고 이미지에서 가져온 요소 중 실제로 구현한 것 3가지**:
1. **파트너 거래소 비교 테이블** — 기존엔 Gate.io 카드와 "준비중" 카드가 나란히 놓인 단순 2카드 그리드(`.ex-grid`)였는데, CashMine의 "파트너 거래소" 표(플랫폼/VIP수수료수준/지정가수수료/시장가수수료/총할인율 컬럼)에서 아이디어를 가져와 `.ex-table` 컴포넌트로 교체 — 헤더 행(거래소/페이백율/정산 주기) + Gate.io를 강조색 배경으로 하이라이트한 활성 행 + 자물쇠 아이콘의 흐린 "준비중" 행으로 구성. 다만 우리는 VIP 등급별 수수료 데이터가 없어서(단일 요율 구조) 컬럼 자체는 더 단순하게(페이백율/정산 주기 2개만) 유지함 — 테이블 느낌은 차용하되 데이터 구조까지 똑같이 베끼지는 않음. "준비중" 행은 실제로 확정된 거래소가 없어서 20단계부터 이어온 정책대로 이름 없이 1행만 유지(표를 채우려고 가짜로 여러 줄을 만들지 않음 — 사실과 다른 정보를 보여주지 않기 위함).
2. **"거래소에 낸 수수료, 돌려받을 수 있어요" 2단 레이아웃** — 기존 3카드 그리드(`.how-grid`)였던 "이용 방법" 섹션을 좌측 소개 카피 + 우측 아이콘 체인 플로우 카드(`.how-flow-card`, 숫자 아이콘 3개를 화살표로 연결) + 하단 정산 안내 콜아웃 박스로 재구성 — CashMine의 "수수료가 절감되는 과정" 카드(아이콘 3개 + 하단 안내 박스) 구조를 우리 3단계 가입 플로우(전용 링크 가입 → UID 확인 → 텔레그램 입장 신청)에 맞게 재해석. 모바일에서는 화살표가 90도 회전해 세로 플로우로 자연스럽게 바뀜.
3. **예상 페이백 계산기(`#calc`, 신설)** — CashMine의 레버리지·VIP 등급까지 고려하는 복잡한 계산기와 달리, 우리는 그런 세분화된 수수료 데이터가 없어서 훨씬 단순화함: 일 거래대금 슬라이더 하나만 받아서, 가정한 시장가 수수료율(0.05%, 추정치임을 명시)과 현재 50% 페이백율을 곱해 1일/1개월/6개월 예상 페이백을 보여줌. 순수 클라이언트 JS 계산이라 서버 변경 전혀 없음 — 다른 IIFE의 함수를 참조하지 않고 자체적으로 포맷 함수를 들고 있어서 20-22단계에서 겪은 "스코프 밖 헬퍼 참조로 인한 조용한 실패" 패턴을 처음부터 피함.

**참고 이미지에서 가져오지 않기로 한 것**: ① 공지사항 목록 페이지 — DB 테이블과 작성 수단이 새로 필요한데, 20단계에서 "관리자 전용 대시보드는 두지 않는다"고 확정한 운영 방침과 충돌해서 범위 밖으로 둠. ② 상세 지갑 지급 플로우 다이어그램(투명 지갑 지급/온체인 공개 등) — 우리 구조(거래소가 직접 50%를 지급, 우리는 텔레그램으로만 안내)와 전제 자체가 달라서 그대로 옮기면 사실과 다른 내용이 됨. ③ 오렌지 계열 색상 — 20-1단계에서 "참고 이미지와 색이 겹치지 않게" emerald/teal/sky로 이미 분화해둔 상태라 그대로 유지(사용자가 "너무 똑같이는 말고"라고 재확인했으니 색상은 안 건드리는 게 맞다고 판단).

**그 외 전역 폴리시**: 카드 전반(`benefit-card`/`ex-table`/`how-flow-card`/`payback-card`/`verify-card`/`calc-card`)에 `box-shadow:var(--card-shadow)`(깊은 그림자) 공통 적용, 히어로 영역 위에 은은한 민트톤 비네트 글로우(`.bg-vignette`) 추가 — "고급지게"라는 요청에 맞춰 카드가 배경에서 더 떠 보이도록 하는 전역적인 톤 보정. nav/드롭다운 메뉴에 "계산기" 링크 추가, "혜택" 링크는 히어로 바로 아래라 네비에서 제외(앵커 수를 과하게 늘리지 않기 위함).

로컬 `wrangler dev` + Playwright로 데스크톱(1440px)/모바일(390px) 전체 섹션(거래소 테이블/플로우 카드/계산기/UID 확인) 스크린샷 확인 — 가로 오버플로우 0px, 계산기 슬라이더 조작 시 값 정상 갱신(25,000 USDT 입력 시 1일 6.25 / 1개월 187.50 / 6개월 1,137.50 USDT로 정확히 계산), 기존 기능(Gate 링크 복사 버튼 `#copy-gate-link`, UID 확인/텔레그램 신청 폼)의 엘리먼트 id가 전부 그대로라 JS 로직 변경 없이 그대로 동작. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- "준비중" 거래소 행은 여전히 자리만 잡아둔 상태 — 실제 거래소가 정해지면 `.ex-row-card.soon`을 `.ex-row-card.active`로 교체하고 로고/요율/정산 주기를 채우면 테이블에 행이 하나 더 늘어나는 구조로 자연스럽게 확장 가능.
- 계산기의 `FEE_RATE`(0.05% 가정)는 실제 거래소/상품별 수수료와 다를 수 있는 예시 추정치 — 정확한 수수료 구간(예: Gate.io 일반 등급 실제 시장가 수수료율)을 확인할 수 있게 되면 그 값으로 교체하는 게 좋음. 지금은 "추정치"라는 문구로 명확히 선을 그어둠.
- 사용자가 참고 이미지로 보여준 공지사항 페이지는 이번에 구현하지 않았음 — 나중에 실제로 필요해지면 관리자 인터페이스 없이도(예: CLAUDE.md에 공지 목록을 적어두고 거기서 index.html에 직접 반영하는 수동 방식, 또는 간단한 D1 테이블 + 텔레그램 명령으로 등록하는 방식) 20단계의 "관리자 대시보드 없음" 원칙을 지키면서 구현할 방법을 고민해볼 것.

## 20-28단계: 계산기 거래소 선택 + 상단 메뉴 그룹화 + 이벤트/공지 탭 + 관리자 탭(이벤트 전용) 신설 (2026-10-15)

사용자가 CashMine.io 스크린샷을 추가로 보여주며 4가지를 요청: ① "페이백 계산기 할때 거래소를 직접 고를 수 있게 해야지, 나중에 다른 거래소 추가됨면 또 확인 할 수 있게" ② "처음에 뜨는 랜딩 페이지가 좀 바뀌었으면... 상단에 메뉴를 좀 나눴으면 좋겠고" ③ "이런식으로 공지사항이 이벤트 탭도 확인할 수 있도록" ④ "관리자 탭을 하나 새로 만들어도 좋아" — ③·④는 20-27단계 "다음에 볼 것"에서 이미 예상했던 요청이 실제로 들어온 것.

**① 계산기 거래소 선택기**: `#calc` 섹션 상단에 거래소 아이콘 버튼 행(`#calc-ex-row`)을 추가 — 프론트 JS에 `EXCHANGES` 배열(`{id, name, logo, feeRate, paybackRate, active}`)을 두고, 지금은 Gate.io(활성, 로고+요율 적용)와 "준비중"(비활성, 🔒 아이콘, 클릭 불가) 두 항목만 있지만 **나중에 다른 거래소가 추가되면 이 배열에 한 줄만 추가하면 계산기에 자동으로 선택지가 늘어나는 구조**로 만듦. 선택한 거래소의 `feeRate`/`paybackRate`로 계산식이 바뀜(지금은 Gate.io 하나뿐이라 결과는 기존과 동일).

**② 상단 메뉴 그룹화**: 기존엔 "거래소/이용방법/계산기/UID 확인/페이백 조회/FAQ"가 전부 한 줄로 나열돼 있었음 — CashMine의 드롭다운 그룹 구조(거래소/이용방법/소리매매/도구/이벤트)에서 "메뉴를 그룹으로 나눈다"는 아이디어만 가져오되, 우리한테 없는 기능(소리매매 등)은 그대로 안 베끼고 실제 우리 콘텐츠에 맞게 재구성함: **거래소 / 이용 방법 / 도구▾(계산기·UID 확인·페이백 조회) / 이벤트(신설) / FAQ / 관리자(흐리게, 신설)**. "도구" 드롭다운은 새 `.nav-drop`/`.nav-drop-menu` 컴포넌트로, 데스크톱에서 `:hover`/`:focus-within`만으로 열리는 CSS 전용 방식(추가 JS 불필요, 키보드 포커스로도 접근 가능). 모바일 햄버거 드롭다운은 기존처럼 평평한 목록 유지(그룹 UI는 복잡도만 늘릴 뿐 모바일에선 이점이 적다고 판단) — 이벤트/관리자 링크만 추가.

**③ 이벤트/공지 탭 (`#events`, 공개)**: `GET /api/events`(공개, `status='active'`만, 최근 100건)로 받아온 항목을 카드 그리드로 렌더링 — 이미지(없으면 🎉 플레이스홀더) + 진행중/종료 배지(`ends_at`이 지났으면 자동으로 "종료"로 표시) + 거래소 칩 + 제목 + 설명(3줄 말줄임) + "자세히 보기 →"(링크가 있을 때만, 새 탭). 거래소가 2개 이상 등록되면 자동으로 필터 칩("전체" + 거래소별)이 나타나고, 지금처럼 1개뿐이면 필터 자체를 숨김 — 가짜로 여러 줄을 보여주지 않고 실제 등록된 데이터만큼만 보여주는 이 프로젝트의 기존 원칙(20-27단계 "준비중" 거래소 1행만 유지한 것과 동일 선상) 그대로 따름.

**④ 관리자 탭 (`#admin`, 이벤트 CRUD 전용)**: **20단계에서 "관리자 전용 대시보드는 없다"고 확정했던 방침을, 이번엔 사용자가 "이벤트 관리용 관리자 탭은 새로 만들어도 좋다"고 명시적으로 허용해서 이 기능 한정으로 재도입함** — 나머지 핵심 플로우(UID 확인, 텔레그램 신청)는 여전히 로그인 없이 그대로 동작, 관리자 로그인은 이벤트 등록/수정/삭제에만 관여함.
- **인증 방식**: 6단계 이후 쓰이지 않던 `ADMIN_PASSWORD` 환경변수를 이번에 다시 활성화함(CLAUDE.md에 "Cloudflare 대시보드에 남아있어도 무해하다"고 적어뒀던 바로 그 값 — **⚠️ 운영 환경에 이 값이 설정돼 있지 않거나 사용자가 기억 못 하는 값이면 로그인이 안 되니, 배포 후 Cloudflare 대시보드 Settings → Variables and Secrets에서 `ADMIN_PASSWORD`를 확인/새로 설정해야 함**). 별도 세션 테이블 없이 **서명된 쿠키**로 처리 — `admin_session` 쿠키 값 = `만료시각.HMAC-SHA512(ADMIN_PASSWORD, "admin:"+만료시각)`, 7일 유효. 위조하려면 어차피 `ADMIN_PASSWORD`를 알아야 하는데 그러면 그냥 로그인하면 되므로 DB 세션 테이블 없이도 안전함.
- **버그 발견 및 수정(배포 전)**: Playwright로 "수정" 버튼을 눌러 폼을 채운 뒤 "수정 취소"를 눌러도 그 버튼(`#admin-ev-cancel`)이 `hidden` 속성이 걸려도 계속 화면에 남아있는 걸 발견함 — **이 프로젝트에서 다섯 번째로 재발한 "`[hidden]` 속성 vs 무조건 적용되는 author `display` 규칙" 충돌**(13·16·20-10·20-12단계에 이어). 이번 범인은 `.btn{ display:inline-flex; ... }` — 모든 버튼/링크에 공통으로 걸리는 핵심 클래스라서, 여태 `hidden`으로 토글되는 `.btn` 요소가 없었다가 이번에 처음 생기면서 드러난 잠재 버그였음. `.btn[hidden]{ display:none; }`를 `.btn` 정의 바로 뒤에 추가해서 해결 — 앞으로 `.btn` 클래스가 붙은 요소를 `hidden`으로 숨길 일이 생겨도 이 한 줄이 전부 커버함.
- **로컬 세션 쿠키 관련 주의사항**: 로그인 쿠키에 `Secure` 속성을 무조건 붙이면 `http://localhost`인 로컬 `wrangler dev`에서는 브라우저가 쿠키 저장을 거부해서 로그인 자체가 로컬에서 테스트 불가능해짐 — 요청 URL의 스킴이 `https:`일 때만 `Secure`를 붙이도록(`cookieSecureAttr()`) 분기해서, 운영(Cloudflare는 항상 https)은 그대로 안전하고 로컬 테스트도 가능하게 함.
- **CRUD**: `POST /api/admin/events/create|update|delete` 전부 `requireAdmin()`으로 쿠키 검증, 입력값은 `validateEventInput()`로 제목(1~200자)/설명(≤1000자)/거래소(1~50자)/이미지·링크 URL(`http(s)://`로 시작해야 함, 20-15단계 때 이미 썼던 `external_url` 검증 패턴 재사용) 검증. `events` 테이블 신설(`ensureSchema()`).

로컬 `wrangler dev --var ADMIN_PASSWORD:testpass123`(배포되는 코드엔 전혀 없는, 로컬 테스트 전용 값)로 서버를 띄우고 Playwright로 전 과정 실측 검증: 로그인 실패(틀린 비번)/성공, 로그인 후 이벤트 등록→목록에 반영→"수정" 클릭 시 폼에 기존값 채워짐→"수정 취소" 클릭 시 정상적으로 다시 숨겨짐(버그 수정 확인)→"삭제" 클릭 시 목록에서 즉시 제거, 공개 `GET /api/events`에 등록한 이벤트가 바로 반영되는 것, 데스크톱(1440px)/모바일(390px) 전부 가로 오버플로우 0px 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인 후 배포.

### 다음에 볼 것
- **사용자 확인 필요**: Cloudflare 대시보드에 `ADMIN_PASSWORD`가 설정돼 있는지, 설정돼 있다면 그 값을 기억하고 있는지 확인 필요 — 없거나 모르면 새로 설정해야 `/#admin`에서 로그인 가능. 비밀번호는 충분히 길고 무작위인 값을 권장(17단계에서도 같은 권고를 한 적 있음).
- 관리자 쿠키에 브루트포스 방지(로그인 시도 횟수 제한)가 없음 — 17단계에서 같은 이유(운영자 IP가 계속 바뀜)로 의도적으로 생략했던 것과 같은 판단, 이번에도 범위 밖으로 둠. 비밀번호 자체의 강도로 방어하는 구조.
- 계산기의 `EXCHANGES` 배열과 거래소 카드(`#exchanges`)/이벤트 거래소 필드가 지금은 서로 독립적으로 관리됨(하드코딩된 JS 배열 vs DB의 자유 텍스트 필드) — 다른 거래소가 실제로 추가되면 계산기 배열에 새 항목을 추가하는 것과 거래소 테이블에 새 행을 추가하는 것을 같이 해줘야 함, 자동 연동은 안 돼 있음.
- 이벤트 이미지가 `image_url`(외부 링크) 방식이라 관리자가 직접 이미지 파일을 업로드할 방법은 없음 — 레거시 히스토리(14~15단계)의 교훈대로 base64 직접 업로드는 용량/검증 이슈가 있어서 의도적으로 피했음, 이미지 호스팅은 관리자가 직접 다른 곳에 올리고 URL만 입력하는 방식.

## 20-29단계: 히어로를 CashMine 스크린샷과 거의 동일한 split 레이아웃으로 전면 교체 (2026-10-15)

20-27/20-28단계까지는 "참고 이미지와 너무 똑같이는 말고"라는 사용자 지시를 따라 구조만 차용하고 색/배치를 의도적으로 다르게 가져갔는데, 사용자가 이번엔 CashMine 홈페이지 전체 스크린샷을 다시 보여주며 "전용 링크로 가입하고 페이백 비공개 커뮤니티 저걸 없애고 내가 보낸 사진과 거의 비슷하게 해달라고"라고 **명시적으로 더 가깝게 맞춰달라고 요청** — 이전 지시와 반대 방향이지만, 이 프로젝트의 확립된 원칙대로(20단계: "최신 명시적 요청이 우선") 그대로 따름.

**핵심 요청 두 가지**: ① 기존 히어로의 중앙 정렬 대형 그라데이션 헤드라인("전용 링크로 가입하고 / 페이백 + 비공개 커뮤니티")을 없앨 것, ② CashMine 스크린샷(좌측에 작은 카피+CTA, 우측에 파트너 거래소 비교표가 스크롤 없이 바로 보이는 split 레이아웃)과 거의 비슷하게 만들 것.

**구현**: 히어로를 `.hero-grid`(데스크톱 2단, `0.85fr 1.15fr`) 구조로 전면 재작성.
- **왼쪽(`.hero-left`)**: 기존 "현재 가입 모집중" 배지는 유지, 헤드라인을 중앙정렬 대형 그라데이션 2줄에서 **좌측정렬 흰색 1줄 + 머즈 톤 1줄**("거래소 수수료, / 다시 돌려받으세요")로 교체(폰트 크기도 `clamp(2.5rem,6.5vw,4.3rem)` → `clamp(2rem,3.6vw,3.1rem)`로 축소 — 참고 이미지의 헤드라인이 화면을 압도하지 않고 모던한 크기였던 것 반영). 서브타이틀도 CashMine 원문("페이백 과 포인트 를 동시에! 정산 내역과 지급 기록을 직접 확인해 보세요.")의 문장 구조를 그대로 차용하되 우리 서비스에 맞게 단어만 교체("포인트"→"비공개 커뮤니티", 둘 다 강조 색상). CTA 버튼 문구도 "가입하러 가기 →"에서 참고 이미지와 동일한 **"시작하기 →"**로 교체.
- **오른쪽(`.hero-right`, `id="exchanges"`)**: 기존에 `#how` 섹션 앞에 별도로 있던 "파트너 거래소" `.ex-table`(Gate.io 활성 행 + 준비중 행)을 그대로 히어로 안으로 옮겨옴 — 이게 CashMine 스크린샷의 핵심 특징(테이블이 스크롤 없이 첫 화면에 바로 보임)을 재현하는 부분. 위에 작은 라벨 `"파트너 거래소"`만 붙이고 기존 `sec-head`(큰 제목+설명)는 공간상 생략. **중복을 피하기 위해 기존에 별도 섹션으로 있던 `#exchanges`는 통째로 삭제**(마크업이 완전히 동일해서 그대로 두면 테이블이 페이지에 두 번 나오게 됨) — nav의 "거래소" 링크(`href="#exchanges"`)는 이제 이 히어로 우측 컬럼으로 바로 스크롤됨(앵커 id를 그대로 이 자리로 옮겨서 깨짐 없음).
- 모바일(`max-width:900px`)에서는 `.hero-grid`가 1열로 바뀌어 텍스트 → 테이블 순서로 자연스럽게 쌓임(DOM 순서 그대로라 추가 처리 불필요).

로컬 `wrangler dev` + Playwright로 데스크톱(1440px)/모바일(390px) 스크린샷 확인 — 가로 오버플로우 0px, `#copy-gate-link` 복사 버튼과 nav "거래소" 앵커(새 위치로 정상 스크롤)까지 실제 동작 확인, 페이지 전체 섹션 수가 9개(중복 제거 후)로 줄어든 것도 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인 후 배포.

### 다음에 볼 것
- 혜택(`#benefits`) 섹션의 "💰 수수료 페이백"/"🔒 비공개 텔레그램 커뮤니티" 카드 2개가 이제 히어로 서브타이틀과 메시지가 살짝 겹침(둘 다 "페이백+커뮤니티"를 언급) — 중복이 거슬린다는 피드백이 오면 benefits 섹션 문구를 더 구체적인 디테일(요율/정산 주기 등) 위주로 재조정하거나 섹션 자체를 축약하는 걸 고려할 것.
- 참고 이미지의 "VIP 수수료 수준/지정가 수수료/시장가 수수료" 같은 세분화된 컬럼은 이번에도 안 가져옴(20-27단계와 같은 이유 — 우리는 VIP 등급별 수수료 데이터 자체가 없음, 거짓 정보를 보여주지 않기 위해 단순한 2컬럼 구조 유지).
- 다른 거래소가 추가되면 히어로 우측의 `.ex-table`에 행을 하나 더 추가하면 됨 — 구조는 그대로 재사용 가능.

## 20-30단계: 히어로/거래소 테이블 폰트·여백 추가 축소 (2026-10-15)

20-29단계 배포 직후 사용자가 참고 이미지(CashMine)와 우리 사이트를 나란히 비교한 스크린샷 2장을 더 보여주며 "글씨가 화면을 너무 꽥 채우고 글이 너무 많아 안보여 ?"라고 재지적 — split 레이아웃 구조 자체는 맞게 따라갔지만, 참고 이미지 쪽은 헤드라인·배지·버튼·특히 거래소 테이블의 글자 크기와 줄 간격이 눈에 띄게 더 작고 여유로운 반면 우리 쪽은 여전히 크고 빽빽해서 화면을 꽉 채우는 느낌이었다는 지적.

**수정 범위**: 새 섹션/구조 변경 없이, 20-29단계에서 만든 히어로·거래소 테이블 컴포넌트의 글자 크기/패딩/간격 값만 전반적으로 한 단계씩 축소함.
- **히어로**: `.hero` 상하 패딩 축소, `.hero-grid` gap 축소(`50px`→`44px`), `.hero h1` 폰트 `clamp(2rem,3.6vw,3.1rem)` → `clamp(1.6rem,2.6vw,2.3rem)`, `.hero p.desc` 0.92rem로 축소 + `max-width:420px`로 줄바꿈 폭 제한, `.hero-actions .btn`/`.stat-chip`도 패딩·폰트 소폭 축소. `@media (max-width:640px)` 모바일 오버라이드 값도 동일 비율로 같이 낮춤.
- **거래소 테이블**: `.ex-table-head`/`.ex-row-main`의 패딩을 줄이고, `.ex-logo` 32px로 축소, `.ex-row-id h3`/`.ex-pill`/`.ex-row-stat b`/`.ex-row-actions .btn`/`.ex-link-box input,button`/`.ex-desc-row` 전부 폰트 크기를 0.68~0.96rem 범위로 낮춰서 한 행이 차지하는 높이와 시각적 무게를 줄임 — Gate.io 활성 행과 "준비중" 행 둘 다 적용.
- 구조(그리드 컬럼 수, `.hero-grid`/`.ex-table` 반응형 분기 지점 860px/900px/640px)는 전혀 안 건드림 — 순수하게 크기값만 조정.

로컬 `wrangler dev`(포트 8791, 로컬 전용 `ADMIN_PASSWORD=testpass123`) + Playwright로 데스크톱(1920px)/모바일(390px) 스크린샷 재확인 — 가로 오버플로우 0px 둘 다 확인, 데스크톱 스크린샷을 직접 눈으로 봐서 헤드라인/배지/테이블 행이 전체적으로 작아지고 여백이 생겨 참고 이미지와 비례감이 비슷해진 것 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- 지금 줄인 크기값들은 히어로/거래소 테이블 영역에만 적용됨 — 페이지의 다른 섹션(혜택/이용방법/계산기/UID 확인/이벤트 등)은 이번에 안 건드려서 폰트 체감이 섹션마다 다를 수 있음, 전체적으로 더 작게 가고 싶다는 피드백이 오면 다른 섹션도 같은 비율로 맞출 것.
- 20-1단계에서 "글씨가 좀 커졌으면"이라는 요청으로 전역 기준 폰트를 키웠던 적이 있음(`html{ font-size:17px }`) — 이번 축소는 그 전역값은 안 건드리고 히어로/테이블 컴포넌트의 `rem` 값만 줄인 것이라 전역 기준과는 별개. 혹시 또 반대 방향 피드백(너무 작다)이 오면 이번에 줄인 컴포넌트별 값들부터 되돌리면 됨.
- CashMine 비교 스크린샷을 보면 테이블 외에 FAQ/카드류 텍스트도 상대적으로 작은 편이었음 — 이번엔 "글이 너무 많아 안보여"의 핵심이던 히어로+테이블만 좁혀서 범위를 한정했는데, 다음 피드백이 다른 섹션을 지목하면 그때 같은 패턴(폰트/패딩만 축소, 구조는 유지)으로 확장하면 됨.

## 20-31단계: 혜택 카드가 그냥 "팝업"되던 CSS 버그 수정 + 혜택 섹션 위치를 더 아래로 이동 (2026-10-15)

사용자가 배포된 사이트 스크린샷을 보여주며 "내리면서 보이게 하지 말고 내리면서 칸별로 나눠지게 해줘" + "두가지 혜택 저런게 더 밑에 있게"라고 요청 — 스크롤 리빌 애니메이션이 매끄럽게 나뉘어 보이지 않고 혜택 카드/프로모 배너가 뭉텅이로 갑자기 나타나는 느낌이라는 지적, 그리고 "두 가지 혜택" 섹션이 프로모 배너 바로 아래 너무 일찍 나온다는 지적.

**진짜 원인 — CSS 캐스케이드로 `.reveal`의 페이드 애니메이션 자체가 소리 없이 사라져 있었음**: `.benefit-card`와 `.promo-banner`가 각자 자기 호버 효과용 `transition:` 선언(`transform .2s ease, border-color .2s ease`)을 갖고 있었는데, 이게 소스 코드상 `.reveal`의 `transition: opacity .7s ..., transform .7s ...` 선언보다 **뒤에** 있었음 — 두 선택자 모두 단일 클래스라 명시도가 같고, 이런 경우 소스상 나중에 나오는 규칙이 `transition` 속성 전체를 완전히 덮어씀(병합 아님). 그 결과 이 두 요소는 `.is-visible`이 붙는 순간 `opacity`에 아무 트랜지션도 안 걸려서 **즉시 뙇 나타나고**, `transform`도 0.7s 대신 0.2s로 매우 빠르게 움직였음 — 페이지의 다른 모든 `.reveal` 요소(섹션 제목, FAQ, 테이블 등)는 이런 충돌이 없어서 정상적으로 부드럽게 페이드인되는데 이 둘만 "팝업"처럼 보였던 것. 10단계(캐스케이드 순서)·13/16/20-10/20-12/20-28단계(`[hidden]` 충돌)에 이어, 이 프로젝트에서 또 다른 형태로 재발한 CSS 캐스케이드 함정.

**고친 방법**: `.benefit-card`/`.promo-banner`의 `transition` 선언을 `.reveal`의 타이밍(opacity/transform 0.7s cubic-bezier)과 각자의 호버 타이밍(border-color 0.2s ease)을 모두 포함하도록 다시 작성 — transform은 양쪽 용도(리빌 슬라이드업 + 호버 들림)를 같이 써야 해서 0.3s cubic-bezier로 절충. 추가로 `.benefit-card:nth-child(2)`에 `transition-delay:.15s`를 줘서 두 카드가 동시에 나타나지 않고 **하나씩 나뉘어(칸별로)** 순차적으로 드러나도록 만듦.

**혜택 섹션 위치 이동**: `#benefits` 섹션 전체를 DOM 순서상 `#how`(이용 방법) 다음, `#calc`(계산기) 앞으로 옮김 — 기존엔 `hero → promo-wrap → benefits → how → calc`였는데 `hero → promo-wrap → how → benefits → calc`로 변경. 프로모 배너 바로 아래 혜택 재설명이 중복처럼 붙어있던 걸 한 섹션 뒤로 미뤄서 "더 밑에" 요청을 반영. `id="benefits"`를 그대로 유지해서 혹시 모를 외부/내부 앵커 링크는 안 깨짐(실제로 이 id를 가리키는 nav 링크는 없었음, grep으로 확인).

로컬 `wrangler dev`(포트 8793, 로컬 전용 `ADMIN_PASSWORD=testpass123`) + Playwright로: (1) 섹션 DOM 순서가 `hero→promo-wrap→how→benefits→calc→verify→events→faq→admin`로 바뀐 것 확인, (2) `.benefit-card`/`.promo-banner`의 computed `transitionProperty`에 이제 `opacity, transform, border-color`가 전부 포함되는 것 확인(버그 수정 확인), (3) 두 혜택 카드의 computed `transitionDelay`가 각각 `0s`/`0.15s`로 스태거 적용된 것 확인, (4) 실제로 `.is-visible`을 트리거한 직후 opacity가 0에서 시작해 900ms 후 양쪽 다 ~1로 올라가되 2번째 카드가 지연 적용분만큼 살짝 늦게 올라가는 것 확인, (5) `scroll-behavior:smooth`(19-1단계부터 있던 설정) 때문에 Playwright의 `window.scrollTo(x,y)` 2-인자 호출이 비동기 스무스 스크롤로 처리돼 스크린샷이 어긋나는 걸 발견해서 `{behavior:'instant'}`로 바꿔 정확한 섹션 위치 스크린샷 확보, (6) 데스크톱(1440px)/모바일(390px) 가로 오버플로우 0px 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- 이번에 찾은 "같은 명시도의 두 클래스가 `transition` 같은 shorthand 속성을 각자 선언하면 소스상 나중 것이 완전히 덮어쓴다"는 패턴은 `.benefit-card`/`.promo-banner` 외에 다른 곳에도 잠재돼 있을 수 있음 — 새 카드/배너 컴포넌트를 `.reveal`과 함께 쓸 때는 그 컴포넌트가 `transition`을 따로 선언하지 않는지, 선언한다면 `.reveal`의 opacity/transform도 같이 포함시켰는지 확인할 것. 이번 점검에서 `.reveal`과 겹치는 다른 `transition:` 선언은 이 두 곳뿐이었음(grep으로 전체 확인).
- 혜택 섹션 위치는 "더 밑으로" 한 단계만 옮긴 것(how 다음) — 더 아래로(예: verify 다음, 또는 맨 아래 FAQ 직전)까지 원하는 거였다면 추가 피드백 필요.
- Playwright로 `scroll-behavior:smooth`가 걸린 페이지를 테스트할 때는 `window.scrollTo(x,y)` 2-인자 형태 대신 `window.scrollTo({top,left,behavior:'instant'})`를 써야 정확한 스크롤 위치를 즉시 캡처할 수 있음 — 이번에 겪은 디버깅 삽질이라 다음 세션을 위해 기록해둠.

## 20-32단계: 섹션 간격 추가 확대 + 전역 폰트 재축소 + 히어로 CTA 1개로 단순화 (2026-10-15)

사용자가 "두가지 혜택 하고 거래소에 낸 수수료 돌려받을 수 있어요 사이에 공간을 좀 더 넓혀 줬으면 해 전부다" + "글씨를 지금보다 조금 더 줄이자"라고 요청 — "전부다"는 그 한 쌍의 간격만이 아니라 페이지 전체 섹션 간 간격을 넓혀달라는 뜻으로 해석. 작업 도중 사용자가 추가로 "이것도 시작하기 하나만 냅두고 지워죠"(히어로의 두 번째 버튼 "비공개 텔레그램 입장 신청"과 통계 칩 2개를 스크린샷으로 가리키며)라고 요청해서 같이 처리함.

**섹션 간격 확대**: 범용 `section{ padding:60px 0; }`을 `92px 0`으로(모바일 640px 이하는 `64px 0`로 별도 추가), `.hero`의 하단 패딩을 56px→72px(모바일 40→48px), `.promo-wrap`을 60px→84px로 — 둘 다 범용 `section` 선택자보다 명시도가 높은 클래스 선택자라 별도로 안 올리면 "전부다"에서 빠지기 때문에 같이 처리.

**전역 폰트 재축소**: `html{font-size:17px}`(20-1단계에서 올렸던 값) → `16px`, 모바일 640px 이하 `15px` → `14px`. 거의 모든 텍스트가 `rem` 기반이라 이 루트 값 하나로 사이트 전체 글자가 비례해서 줄어듦 — 20-1/20-2단계가 확립한 "루트 폰트 크기로 전역 텍스트 톤 조절" 패턴을 반대 방향으로 재사용.

**히어로 CTA 단순화**: `.hero-actions`에서 "비공개 텔레그램 입장 신청" 고스트 버튼을 제거하고 "시작하기 →" 하나만 남김, `.hero-stats`의 통계 칩 2개("50% 페이백율", "매일 지급·1시간 내외")도 통째로 제거 — 이제 쓰이는 곳이 없어진 `.hero-stats`/`.stat-chip` CSS(모바일 오버라이드 포함)도 같이 삭제. 텔레그램 신청 CTA는 promo-banner/verify 섹션에 이미 있어서 기능 손실 없음.

로컬 `wrangler dev`(포트 8794) + Playwright로 `.hero-actions` 자식 요소가 1개뿐인 것, `.hero-stats` 엘리먼트가 더 이상 존재하지 않는 것, 데스크톱(1440px)/모바일(390px) 가로 오버플로우 0px인 것 확인, how→benefits 사이 간격이 스크린샷상 눈에 띄게 넓어진 것 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 동시 커밋 없는지 확인 후 배포.

### 다음에 볼 것
- 전역 폰트가 17px→16px로 또 한 번 바뀌었음 — 이 프로젝트에서 루트 폰트 크기가 오르내린 이력(20-1단계 15→17px, 지금 17→16px)이 있으니 다음에 "너무 작다/크다" 피드백이 오면 이 한 줄(`html{font-size}`)부터 확인할 것.
- 히어로 통계 칩(50% 페이백율 등 수치)이 빠지면서 첫 화면에서 요율을 바로 못 보게 됨 — 대신 우측 거래소 테이블에 바로 "50%"가 보이므로 정보 손실은 아님, 혹시 "다시 보여달라"는 피드백이 오면 쉽게 복구 가능(git에서 이전 커밋 확인).

## 20-33단계: 프로모 배너 축소 + 계산기에 레버리지/거래횟수 추가 + 이벤트 팝업 신설 (2026-10-15)

사용자가 CashMine 참고 스크린샷들을 보여주며 세 가지 요청: "이것도 작게 바꿔주고"(프로모 배너 "이미 거래소에 가입하셨나요?"를 가리키며), "계산기는 더 자세하게"(참고 이미지의 레버리지/하루 거래 횟수 슬라이더 + 상세 결과 패널), "저런 팝업 창 광고창 기능도 넣어주고"(참고 이미지의 "72% 수수료 할인" 이벤트 팝업 — 닫기 버튼, CTA, "오늘 하루 보지 않기" 링크 구조).

**프로모 배너 축소**: `.promo-banner` 패딩 26px 30px→18px 24px, `.promo-text h3` 1.14rem→0.98rem, `.promo-text p` 0.96rem→0.84rem, `.promo-icon` 1.8rem→1.5rem. `.promo-btn`은 기존에 전용 크기 지정이 없어서 기본 `.btn` 크기(패딩 12px 22px, 1rem)를 그대로 쓰고 있었는데, 이번에 `padding:9px 16px; font-size:0.86rem;`을 명시적으로 추가.

**계산기 상세화**: 기존 "일 거래대금" 슬라이더 하나를 "거래 원금(USDT) × 레버리지(1~100x) × 하루 거래 횟수(1~30회)" 3개 슬라이더로 교체 — 셋을 곱해 일 거래대금을 유도하고, 이 값을 새 `.calc-volume-summary` 줄로 먼저 보여준 다음 기존 1일/1개월/6개월 페이백 결과로 이어짐. 기본값(원금 500 × 레버리지 5 × 횟수 2 = 5,000)을 예전 슬라이더의 기본값(5,000)과 정확히 같게 맞춰서, 처음 들어온 방문자가 보는 숫자는 바뀌지 않음.
- **참고 이미지의 "총 절감액 vs 캐시마인 페이백" 분리 구조는 의도적으로 안 가져옴**: CashMine은 거래소 자체 할인과 자사 레퍼럴 페이백을 별도 항목으로 보여주는데, TEAM SIXX는 그런 "거래소 자체 기본 할인" 개념이 아예 없고 50% 페이백이 혜택의 전부라서, 그 구조를 그대로 베끼면 존재하지 않는 할인 항목을 지어내는 셈이 됨 — 입력을 더 세분화하는 아이디어만 차용하고 출력 구조(1일/1개월/6개월 단일 페이백)는 기존 그대로 유지.

**프로모 팝업 신설** (`#promo-popup-backdrop`): 페이지 로드 약 1.4초 후 자동으로 뜨는 전체화면 오버레이 팝업 — Gate.io 로고 배지, 큰 그라데이션 "50%" 숫자, "수수료 페이백" 타이틀, 짧은 설명, "지금 확인하기 →" CTA(#verify로 스크롤), "오늘 하루 보지 않기" 링크로 구성. 닫기(X)/배경 클릭/Esc는 그냥 닫기만, "오늘 하루 보지 않기"는 `localStorage`에 자정까지의 타임스탬프를 저장해서 그날 하루는 재방문해도 안 뜨게 함. 기존 `.payback-modal-backdrop[hidden]{ display:none; }` 패턴을 그대로 재사용해서(`.promo-popup-backdrop[hidden]{ display:none; }`을 base 규칙 바로 뒤에 명시) 이 프로젝트에서 여러 번 재발했던 `[hidden]` vs 무조건 적용 `display` 캐스케이드 버그를 처음부터 피함.

로컬 `wrangler dev`(포트 8795) + Playwright로: (1) `.promo-text h3`/`p`의 computed font-size가 줄어든 것 확인, (2) 계산기 기본값이 정확히 예전과 같은 결과(일 거래대금 5,000 USDT, 1일 페이백 1.25 USDT)를 내는 것, 입력 3개를 바꾸면(1000×20×3=60,000) 거래대금/페이백이 정확히 재계산되는 것 확인, (3) 팝업이 1.4초 후 `hidden:false` + `.show` 클래스로 나타나는 것, "오늘 하루 보지 않기" 클릭 시 닫히고 `localStorage`에 값이 저장되는 것, 페이지를 새로고침해도 그날은 다시 안 뜨는 것 확인, (4) 데스크톱(1440px)/모바일(390px) 둘 다 팝업 포함 가로 오버플로우 0px 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 동시 커밋 없는지 확인 후 배포.

### 다음에 볼 것
- 팝업은 지금 Gate.io 50% 페이백 고정 문구 — 나중에 실제 "기간 한정 이벤트" 같은 시간 제한 프로모션을 돌리고 싶으면 `#events`처럼 관리자 탭에서 등록 가능한 구조로 확장할 수 있음(지금은 하드코딩된 정적 문구).
- 팝업의 "오늘 하루 보지 않기"는 `localStorage` 기반이라 브라우저/기기를 바꾸면 다시 뜸(의도된 동작, 서버에 저장 안 함).
- 계산기 레버리지 슬라이더(1~100x)는 선물 계산 시 실제로 레버리지가 명목가치(notional)에 비례해서 수수료에 영향을 준다는 전제를 깔고 있음 — 이것도 `calc-note`에 적힌 기존 "추정치" 단서 안에 포함되는 가정.

## 20-34단계: 팝업을 관리자가 고른 이벤트로 교체 + 이벤트 상세 모달 + 이미지 업로드 + 혜택 섹션 제거 (2026-10-15)

사용자 요청 4건: ① "팝업창은 광고를 내가 선택할 수 있게... 공지사항이나 이벤트 올린것중에 내가 골라서 뜨게" ② "이벤트는 누르면 바로 링크로 넘아가는게 아니라 한번 더 설명과 글 자세히 보여주고 넘어가야지" ③ "사진을 링크로 첨부 말고 파일이나 사진으로 업로드 해서 첨부 가능하게" ④ "사이트 좀 간단하게 해줘... 쓸때 없는 내용은 최대한 정리하고 깔쌈하게".

**① 팝업을 관리자가 고른 이벤트로 교체**: 20-33단계에서 만든 팝업은 "Gate.io 50%" 고정 문구였는데, 이제 `events` 테이블에 `is_popup`(0/1) 컬럼을 추가하고 admin.html 이벤트 등록 폼에 "팝업 광고로 표시(한 번에 하나만 가능해요)" 체크박스를 추가 — `GET /api/popup-event`가 `status='active' AND is_popup=1`인 이벤트 1건을 반환(없으면 `item:null`, 그러면 프론트가 팝업 자체를 아예 안 띄움). 한 번에 하나만 팝업일 수 있도록, create/update 핸들러에서 `is_popup=true`로 저장하는 순간 다른 이벤트의 `is_popup`을 먼저 0으로 내림.

**② 이벤트 상세 모달**: 이벤트 그리드 카드와 팝업 둘 다 클릭하면 더 이상 바로 `link_url`로 안 넘어가고, 새로 만든 공유 모달(`#event-modal-backdrop`)이 먼저 뜸 — 이미지 전체·거래소 칩·제목·**잘리지 않은 전체 설명**·"바로가기 →" 링크(실제로 사이트를 벗어나는 유일한 경로)를 보여줌. 이벤트 그리드 IIFE와 팝업 IIFE를 이 모달 로직과 함께 **하나의 IIFE로 합침** — 둘이 같은 모달을 열어야 해서 분리해두면 20-22단계에서 실제로 겪었던 "다른 IIFE의 지역 함수를 잘못 참조하는" 버그가 재발할 위험이 있었음.

**③ 이미지 업로드**: admin.html 이벤트 폼의 "이미지 URL" 텍스트 입력을 `<input type="file">`로 교체 — 선택한 파일을 `FileReader`로 base64 data URI로 읽어서 미리보기(+제거 버튼)를 보여주고, 제출 시 그 값을 그대로 `image_url`로 보냄. 클라이언트에서 1.4MB로 먼저 거르고, 서버(`isValidEventImage()`)는 `data:image/(png|jpe?g|gif|webp);base64,...`(최대 base64 약 1.5MB) 또는 기존 `http(s)://` 링크 둘 다 허용 — 예전에 URL로 등록해둔 이벤트는 그대로 유지됨.

**④ 혜택(`#benefits`) 섹션 제거**: "두 가지 혜택" 섹션을 통째로 삭제 — 50% 요율은 이미 거래소 테이블에, 비공개 텔레그램 커뮤니티는 이미 프로모 배너/히어로에 나와 있어서 완전히 중복이었음(20-29/20-30단계 "다음에 볼 것"에서 이미 이 중복을 지적해뒀던 부분). 관련 CSS(`.benefit-grid`/`.benefit-card` 등)도 같이 삭제.

**사전에 막은 버그**: 새로 `hidden` 속성으로 토글되는 요소(`.admin-img-preview`/`.promo-popup-img`/`.event-modal-img`) 전부가 자기 own `display` 선언을 갖고 있어서, 이 프로젝트에서 여섯 번 넘게 재발한 "`[hidden]` vs 무조건 적용 `display`" 캐스케이드 버그가 또 생길 뻔했음 — 이번엔 배포 전에 미리 알아채서 세 곳 다 `[hidden]{ display:none; }` 오버라이드를 바로 뒤에 추가해둠.

로컬 `wrangler dev`(포트 8796, 로컬 전용 `ADMIN_PASSWORD=testpass123`) + Playwright로 실제 PNG 파일을 업로드해 전체 플로우 검증: 관리자 로그인 → 이미지 업로드+팝업 체크박스로 이벤트 등록 → 그리드에 업로드된 이미지로 카드가 뜨는 것 → 카드를 눌러도 바로 안 나가고 상세 모달(전체 설명·올바른 링크)이 뜨는 것 → 새 방문자에게 그 이벤트가 팝업으로(~1.4초 후) 뜨는 것 → 팝업의 "자세히 보기" 클릭 시 팝업이 닫히고 같은 상세 모달이 뜨는 것(팝업→모달 연계 확인) → "오늘 하루 보지 않기"가 새로고침 후에도 유지되는 것 → 데스크톱(1440px)/모바일(390px) 전부 가로 오버플로우 0px까지 전부 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- 팝업/이벤트 이미지가 이제 base64로 DB에 직접 저장됨 — 이벤트가 많이 쌓이고 이미지를 자주 올리면 `events` 테이블 용량이 예전(URL만 저장)보다 꽤 커질 수 있음, D1 자체는 문제 없는 수준이지만 참고.
- "팝업으로 표시"는 한 번에 하나만 가능하도록 서버에서 강제함 — 여러 개를 동시에 켜고 싶다는 요청이 오면(예: 순환 노출) 별도 설계가 필요함.
- 혜택 섹션을 지우면서 "50%"/"비공개 커뮤니티"라는 핵심 메시지가 히어로 서브타이틀 한 줄과 거래소 테이블로만 전달되게 됨 — 혹시 이 정보가 너무 눈에 안 띈다는 피드백이 오면 다른 자리에 작게 다시 넣는 것을 고려할 것.
- 사이트 "간단하게" 요청 중 혜택 섹션 삭제만 처리함 — 계산기/FAQ/페이백 조회 등 나머지 섹션은 전부 실사용 기능이라고 판단해서 그대로 둠, 다른 특정 섹션을 더 빼달라는 피드백이 오면 콕 집어 알려주면 좋음.

## 20-35단계: 실시간 페이백 내역 "영구 정지" 가능성 있는 버그 수정 + 입장 신청 칸 가시성 강화 (2026-10-22)

사용자가 "페이백 내역 실시간 왜 멈춘거야" + "스터디방 신청칸이랑 uid 확인하기 칸 대충하지 말고 좀 확실하게 표시나 명시 해줬으면 좋겠어 한눈에 알아 볼수 있게, 스터디방 신청 어디서 하냐고 문의가 너무 들어오네"라고 요청 — 두 가지 별개 문제.

**실시간 페이백 내역 정지 — 이번엔 "지연"이 아니라 "영구 정지" 가능성이 있는 새로운 버그 발견**: 20-24/20-25단계에서 이미 지연·API 부하 문제를 각각 다뤘지만, 이번엔 `syncPaybackFeed()`를 코드 리뷰로 다시 훑다가 더 치명적인 패턴을 발견함 — 커미션 레코드를 `payback_feed`에 INSERT할 때 `commission_amount`/`source`는 각각 `|| 0`/`|| ''` 기본값 가드가 있는데 **`commission_time`만 가드 없이 그대로 `.bind()`하고 있었음**. Cloudflare D1은 파라미터 값이 JS `undefined`면 바인딩 자체를 타입 에러로 던지는데(값이 `null`이면 괜찮음, `undefined`일 때만 문제), 이 INSERT가 `payback_cursor` 갱신과 **같은 try/catch 블록** 안에 있어서 — Gate.io가 `commission_time` 필드가 비어있는 레코드를 단 하나라도 섞어서 응답하면, 그 즉시 예외가 던져지면서 그 UID의 `payback_cursor` 갱신까지 통째로 실행이 안 됨. 커서가 전진을 못 하니 **다음 틱(1분 후)에도 같은 `since`로 같은 레코드를 다시 읽어서 똑같이 실패** — 한 번 이 레코드를 만난 UID는 그 뒤로 영원히 막혀버리는 구조였음. "피드가 멈췄다"는 사용자 체감과 정확히 들어맞는 메커니즘.

**고친 방법**: `item.commission_time ?? 0`으로 기본값을 주고, 그와 별개로 **레코드 하나당 INSERT를 개별 try/catch로 감싸서** 혹시 다른 이유로 또 다른 필드가 문제를 일으켜도 그 레코드 하나만 건너뛰고 나머지 레코드/`payback_cursor` 갱신은 계속 진행되도록 방어를 이중으로 걸어둠(`console.error`로 어떤 레코드가 왜 걸렸는지 로그도 남김 — Cloudflare Logs에서 확인 가능). 로컬 Node.js 시뮬레이션(가짜 D1 드라이버가 `undefined` bind 시 실제로 던지도록 재현)으로 (1) 가드 없이는 재현되고 가드를 걸면 막히는 것, (2) 예상 못 한 다른 이유로 레코드가 실패해도 개별 try/catch 덕분에 커서는 계속 전진하는 것 둘 다 확인.

⚠️ **이번에도 실 Gate.io 키/Cloudflare Logs 접근이 이 세션에 없어서 라이브로 검증은 못 함** — 20-24/20-25단계와 마찬가지로 "증상과 정확히 들어맞는, 코드 리뷰로 찾아낸 가장 그럴듯한 메커니즘"을 고친 것이지 실제 원인이라고 100% 확신하는 건 아님. 다만 이번 건 "영구적으로 멈춘다"는 명확한 인과관계가 있어서 지금까지 중 가장 설명력이 높다고 판단함.

**입장 신청 칸 가시성 강화**: nav 어디에도 "신청"이나 "스터디방"이라는 단어가 없고, 유일한 진입점이 "도구" 드롭다운 안의 "UID 확인"이라는 드롭다운 항목 하나뿐이었음 — UID 확인은 입장 신청의 첫 단계일 뿐인데 그 라벨만 보고는 여기가 신청하는 곳이라는 게 전혀 안 드러남. **데스크톱 nav와 모바일 드롭다운 양쪽에 최상위 레벨로 강조된 알약 버튼 `📩 입장 신청`을 새로 추가**(`#verify`로 스크롤, `.nav-apply-link` — 기존 `.nav-admin-link`와 같은 이유로 `color`/`font-size`에 `!important` 필요, `.nav-links a`라는 더 높은 명시도의 규칙을 이겨야 해서). 기존 "도구" 드롭다운의 "UID 확인" 항목은 중복 경로로 그대로 유지(안 깨짐). 메인 헤더 CTA("가입하기 →")는 **의도적으로 그대로 둠** — 이건 신규 거래소 가입을 유도하는 최상단 전환 버튼이라, "입장 신청이 어디 있는지 안 보인다"는 요청과는 다른 문제라고 판단해서 건드리지 않음(처음엔 이 버튼도 `#verify`로 바꿨다가, 범위를 벗어난다고 판단해서 원복함).

`#verify` 카드 자체도 "대충"하지 않도록 재디자인 — 테두리를 옅은 회색에서 에메랄드 톤 강조 테두리+은은한 글로우로 바꾸고, 각 단계(①②③)를 작고 흐린 회색 텍스트 라벨에서 **큼직한 원형 숫자 배지(`.verify-step-num`, 이용방법 섹션의 `.flow-icon` 패턴 재사용) + 굵은 흰색 텍스트**로 교체. sec-head 제목에도 📩 이모지와 "스터디방 입장 신청은 바로 여기서 해요"라는 굵은 안내 문장을 추가.

로컬 `wrangler dev`(포트 8797) + Playwright로 데스크톱(1440px)/모바일(390px) 둘 다 확인: `.nav-apply-link`가 정상 렌더링되고 텍스트가 "📩 입장 신청"인 것, `.verify-step-num` 배지 3개(1/2/3)가 전부 렌더링되는 것, 라벨 폰트가 0.94rem/600 → 1.08rem/800(굵게)으로 커진 것, 가로 오버플로우 0px인 것, 카드 테두리가 에메랄드 톤으로 강조된 것을 스크린샷으로 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- **사용자 확인 필요**: 이번 수정 후 며칠 지켜보고 실시간 페이백 내역이 더 이상 멈추지 않는지 확인 부탁 — 여전히 멈추면 이번 가설도 전체 원인은 아니었다는 뜻이므로, 그땐 Cloudflare 대시보드 Logs에서 `syncPaybackFeed: skipping malformed commission record` 로그가 실제로 찍히고 있는지(찍히면 이 가드가 작동 중이라는 뜻, 그런데도 멈추면 다른 원인이 있다는 뜻) 확인해보면 가장 확실한 단서가 될 것.
- 메인 헤더의 "가입하기 →" CTA는 이번에 안 건드렸음 — 만약 "신규 가입"과 "입장 신청" 두 전환 경로가 헷갈린다는 피드백이 오면, 그때 CTA 자체의 문구/목적지를 재검토할 것.
- `.verify-step-num` 배지는 `.flow-icon`과 같은 그라데이션을 쓰지만 별도 CSS 클래스로 독립적으로 관리됨(디자인이 바뀌면 두 곳 다 손봐야 함, 공유 클래스로 통합하지 않음 — 이 프로젝트의 "기능별로 독립적인 스타일 블록" 관례를 따름).

## 20-36단계: 모바일 전용 하단 고정 "입장 신청" 바 추가 (2026-10-22)

사용자가 "모바일에서 더 한눈에 볼 수 있게 해줘, PC보다 보통 핸드폰으로 많이 접근하거든"이라고 요청 — 20-35단계에서 만든 `.nav-apply-link`("📩 입장 신청" 알약)가 데스크톱에선 헤더에 바로 보이지만, **모바일에선 햄버거 메뉴 드롭다운 안에 숨어있어서 탭을 한 번 더 해야만 보임** — "PC보다 모바일 접근이 많다"는 사용자 설명과 맞물려, 정작 가장 많이 쓰이는 화면에서는 지난 단계의 개선이 체감되지 않는 구조였음.

**구현**: 화면 폭 860px 이하(기존 햄버거 전환 기준과 동일)에서만 보이는 `.mobile-apply-bar`를 신설 — 화면 하단에 항상 떠있는 전체 폭 알약 버튼("📩 지금 입장 신청하기 →", `#verify`로 스크롤), 은은한 펄스 애니메이션(`applyBarPulse`, 2.6초 주기로 그림자가 커졌다 작아짐)으로 시선을 끌게 함(`prefers-reduced-motion: reduce`에서는 19단계 교훈대로 애니메이션만 끄고 요소 자체는 그대로 보이게 처리). 스크롤 위치와 무관하게 항상 화면에 떠 있어서, 메뉴를 열거나 페이지를 내릴 필요 없이 어디서든 한 번에 신청 화면으로 이동 가능.

**버그 발견 및 수정(배포 전)**: 처음엔 기존 플로팅 텔레그램 버튼(`.float-tg`, 화면 우하단 고정)과 새 하단 바가 겹치는 문제가 있어서 모바일 전용 미디어쿼리로 `.float-tg`의 위치를 위로 옮기려 했는데, 그 오버라이드를 소스 코드상 **`.float-tg` 본체(무조건 적용) 정의보다 앞쪽**(다른 모바일 전용 스타일들이 모여있는 구역)에 넣어버림 — 10단계부터 이 프로젝트에 반복돼온 "명시도가 같으면 소스상 나중에 나오는 규칙이 이긴다"는 캐스케이드 함정 그대로 재발할 뻔했음(이번엔 실제 배포 전 Playwright로 두 요소의 bounding rect를 비교해서 겹침을 직접 검출, 배포 전에 잡음). `.float-tg` 본체 정의 바로 뒤로 미디어쿼리를 옮겨서 해결. 추가로 하단 바가 스크롤 끝까지 내려도 푸터의 투자 유의사항 문구를 영구적으로 가리지 않도록, 모바일 전용으로 `footer`에 하단 패딩을 더 줌(바 높이만큼 + `env(safe-area-inset-bottom)`).

로컬 `wrangler dev`(포트 8799) + Playwright로: 모바일(390px)에서 하단 바가 `display:flex`로 보이고 텍스트가 정확한 것, `.float-tg`와 겹치지 않는 것(bounding rect 비교로 확인), 가로 오버플로우 0px인 것, 페이지 최하단까지 스크롤해도 푸터 문구가 바에 가려지지 않는 것(스크린샷 확인), 바를 클릭하면 실제로 `#verify`로 스크롤되는 것, 데스크톱(1440px)에서는 바가 `display:none`으로 전혀 안 보이는 것까지 전부 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- 펄스 애니메이션이 너무 눈에 띄거나 거슬린다는 피드백이 오면 `applyBarPulse`를 빼거나 더 은은하게 줄일 것(지금은 일부러 "한눈에" 요청에 맞춰 약간 공격적으로 잡음).
- 하단 바와 `.float-tg`(텔레그램 문의)가 모바일 화면에서 같이 떠 있어 다소 북적일 수 있음 — 혹시 번잡하다는 피드백이 오면 `.float-tg`를 모바일에서만 숨기는 것도 고려 가능(텔레그램 문의는 헤더 아이콘과 하단 바를 통한 신청 플로우로도 닿을 수 있어서 완전히 못 쓰게 되는 건 아님).
- 이 하단 바는 `#verify`로만 연결됨 — 나중에 다른 핵심 전환 지점(예: 페이백 조회)도 모바일에서 더 눈에 띄게 하고 싶다는 요청이 오면 같은 패턴(고정 바 또는 유사한 강조 요소)을 재사용할 수 있음.

## 20-37단계: 멈춰있던 동안 밀린 페이백 내역 "지금이라도" 따라잡기 + 누적 조회는 원래 영향 없었음 확인 (2026-10-22)

사용자가 "페이백 내역 그동안 멈춰서 못 불러왔던 것까지 합쳐서 지금이라도 띄어줘, 그리고 페이백 얼마 받았는지 조회하는 것도 업데이트 해주고"라고 요청 — 20-35단계에서 고친 영구 정지 버그 이후, 밀렸던 과거분까지 실제로 화면에 나타나게 해달라는 것.

**실시간 피드(`syncPaybackFeed`) — 한 번에 따라잡을 수 있는 분량을 5페이지(500건)→20페이지(2000건)로 확장**: 20-35단계 수정으로 "영구 정지"는 막혔지만, 커서가 멈춰있던 동안 쌓인 백로그가 **500건을 넘으면** 여전히 문제가 있었음 — 그 UID의 커서가 멈춰있던 시점부터 `now`까지의 구간에서 최대 500건만 가져온 뒤, 더 가져올 게 남아있는지 여부와 무관하게 커서를 무조건 `now`로 전진시키고 있었음. 즉 500건을 넘는 백로그가 있었다면, 넘는 분량은 커서가 이미 `now`로 점프해버려서 다음 틱에도 다시 조회되지 않고 **그대로 영영 유실**되는 구조였음 — 이번 요청("멈춰서 못 가져온 것까지 합쳐서")과 정확히 충돌하는 지점.

**고친 방법**: 페이지 상한을 5→20(최대 2000건)으로 올리고, **그 상한에 실제로 걸렸을 때만**(마지막 페이지까지 꽉 찬 100건으로 끝난 경우) 커서 전진을 보류하도록 바꿈 — 그 구간을 다 못 훑었으면 커서를 그대로 둬서 다음 틱(1분 후)에 같은 `since`로 다시 시도하게 함(완전히 못 건지는 것보단 나음). 반대로 그 구간을 끝까지 다 읽었으면(마지막 페이지가 100건 미만이거나 애초에 빈 응답) 평소처럼 커서를 `now`로 전진시킴. 로컬 Node 시뮬레이션으로 50/500/1950/2000/2500건 백로그 5가지 케이스를 돌려서, 2000건 이하는 전부 한 틱에 정확히 다 긁어오고 커서가 정상 전진하는 것, 2000건을 초과하는 케이스(2500건)는 이번 틱에 2000건만 가져오고 커서를 전진시키지 않아 다음 틱에 나머지를 계속 시도하는 것까지 확인.

**이 프로젝트 현재 규모에선 2000건 상한에 실제로 걸릴 가능성은 낮음** — CLAUDE.md 운영 메모 전반에 걸쳐 이 사이트가 트래픽이 적은 초기 단계임이 반복 확인돼 있어서, 거의 모든 경우 한 틱 안에 밀린 분량이 전부 따라잡힐 것으로 예상함. 다만 혹시라도 못 따라잡는 극단적인 경우를 위한 안전장치로 "상한에 걸리면 커서를 보류"하는 로직을 넣어둠.

**⚠️ 이 세션은 실 Gate.io 키/Cloudflare 대시보드/운영 D1 접근이 전혀 없어서, 실제로 지금 운영 중인 사이트에서 밀린 내역이 몇 건이었는지, 이 수정 배포 후 정말 전부 따라잡혔는지는 직접 확인할 수 없음** — 배포되면 1분마다 도는 크론이 자동으로 다음 틱부터 이 로직을 타게 되므로, 배포 후 몇 분 안에 "실시간 페이백 내역"에 밀렸던 과거분이 나타나는지 직접 확인해주시면 좋음. 계속 비어있거나 이상하면 Cloudflare 대시보드 Logs에서 `syncPaybackFeed failed` 로그가 찍히는지 확인해줄 것(권한 문제 등 다른 원인일 수 있음).

**"페이백 얼마 받았는지 조회"(`GET /api/payback-total`, 누적 조회 모달)는 애초에 이 버그와 무관했음**: 코드를 다시 확인해보니 이 기능은 `getUidPaybackTotal()`을 통해 **조회할 때마다 Gate.io에 직접 라이브로 질의**하는 구조 — `payback_feed`/`payback_cursor` 어느 쪽도 거치지 않고, 캐싱도 전혀 없음(`grep`으로 전체 파일에 "cache" 관련 코드가 없는 것도 확인). 즉 실시간 피드가 멈춰있던 동안에도 "내 누적 조회"는 항상 그 순간 기준 정확한 값을 라이브로 계산해서 보여주고 있었음 — 고칠 코드가 없어서 별도 수정 없음, 사용자에게 이 사실을 명확히 안내함.

`node --check` + `wrangler deploy --dry-run` 검증, 로컬 `wrangler dev`(포트 8801)로 `/api/payback-feed`/`/api/payback-total` 라우팅이 구조적으로 깨지지 않은 것 확인(로컬엔 `GATE_API_KEY` 없어서 구조 확인까지만 가능, 기존 단계들과 동일한 한계). 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- **사용자 확인 필요**: 배포 후 실시간 페이백 내역에 밀렸던 과거분까지 포함해서 제대로 뜨는지 확인 부탁 — 이게 이번 요청의 핵심인데 이 세션에선 라이브로 검증할 방법이 없음.
- `PAGE_CAP`(20, 2000건)은 추정 기반 여유값 — 나중에 트래픽이 훨씬 늘어서 한 틱에 2000건 넘는 백로그가 실제로 쌓이는 UID가 생기면, 커서 보류 로직 덕분에 데이터가 유실되진 않지만 따라잡는 데 여러 틱이 걸릴 수 있음(해당 UID만 그 기간 동안 느리게 갱신).
- 20-6단계부터 이어진 베타 리스크(Gate.io `commission_history` 응답 필드가 실 키로 검증된 적 없음)는 이번 수정과 무관하게 그대로 남아있음.

## 20-38단계: UID 확인 ↔ 스터디방 신청 완전 분리 + 모달화 + 모바일 바 문구/크기 조정 (2026-10-22)

사용자 요청 4건: ① "UID 확인칸이랑 스터디방 신청칸 그냥 분리를 해줘, UID 확인은 메뉴 통해서 들어갈 수 있게, 메뉴 통해서 들어가면 다른 탭으로 넘어가서 조회 할 수 있게 해주고" ② "지금 입장 신청하기 말고 비공개 빗각 스터디방 입장 신청하기 이런식으로도 괜찮을것 같아" ③ "버튼이 너무 커" ④ "스터디방 신청도 버튼 누르면 다른 페이지로 넘어가서 하면 좋겠어".

**UID 확인과 스터디방 신청을 완전히 다른 두 모달로 분리**: 20-35단계까지는 `#verify` 섹션 하나의 `.verify-card` 안에 ①UID 확인 → ②시드 예치 O/X → ③텔레그램 신청이 한 흐름으로 쌓여 있었음 — 사용자가 이걸 "UID 확인칸"과 "스터디방 신청칸"으로 분리해달라고 요청. "다른 탭/페이지로 넘어가서"는 이 프로젝트가 처음부터(20-8/20-10단계) 유지해온 "실제 라우팅 없는 단일 페이지 + 모달로 페이지 전환 흉내" 패턴 그대로 적용.
- **UID 확인 전용 모달**(`#uid-modal-backdrop`, 신설) — 입력 한 칸 + 확인 버튼 + 결과만 있는 가벼운 모달, `/api/check-uid`만 호출하고 다음 단계로 이어지지 않음. **오직 nav 메뉴(데스크톱 "도구" 드롭다운, 모바일 드롭다운)를 통해서만 열림** — 페이지 안 어디에도 이 모달을 여는 인라인 버튼을 두지 않음(요청 그대로 "메뉴 통해서 들어갈 수 있게").
- **스터디방 신청 모달**(`#apply-modal-backdrop`, 신설) — 기존 3단계 플로우(UID 확인→시드 예치→텔레그램 신청) 마크업/JS를 그대로 이 모달 안으로 옮김(id 그대로 재사용, 로직 변경 없음). 열릴 때마다 입력값/결과/선택 상태를 전부 초기화(`openApplyModal()`)해서 이전 조회 흔적이 안 남게 함. 진입점은 `#verify` 섹션의 새 "🔒 비공개 빗각 스터디방" 카드 버튼, 프로모 배너, nav의 "🔒 입장 신청" 알약, 모바일 하단 고정 바 — 전부 `.js-open-apply-modal` 클래스로 묶어서 한 핸들러가 전부 처리.
- `#verify` 섹션 자체는 거대한 인라인 플로우 대신 `.payback-card`/`.payback-cta`(20-15단계에 만들어두고 안 쓰이던 CSS 클래스를 재사용)로 "🔒 비공개 빗각 스터디방" 카드 하나 + 기존 "실시간 페이백 내역" 카드를 나란히 배치한 가벼운 2카드 구조로 축소.
- 둘 다 `.payback-modal-backdrop`/`.payback-modal`(기존 "내 누적 조회" 모달이 쓰던 CSS)을 그대로 재사용 — 새 CSS 클래스를 따로 안 만들어도 됨, `[hidden]` 캐스케이드 방지 오버라이드도 이미 거기 있어서 재발 방지.

**모바일 하단 바 문구 변경 + 축소**: 텍스트를 "📩 지금 입장 신청하기 →"에서 사용자가 제안한 "🔒 비공개 빗각 스터디방 입장 신청하기"로 교체(실제 커뮤니티 이름 "빗각" 명시). 클릭 동작도 `#verify`로 스크롤하던 것에서 `.js-open-apply-modal`로 바뀌어 신청 모달을 바로 염. **"버튼이 너무 커" 피드백**에 맞춰 패딩(15px 18px→9px 14px)·폰트(1rem 고정→`clamp(0.64rem, 3vw, 0.76rem)`)를 전반적으로 축소하고 펄스 애니메이션의 그림자 진폭도 줄임 — 글자 수가 늘었는데도 가로 오버플로우 없이 한 줄에 들어가도록 `clamp()`로 글자 크기를 유동적으로 잡음. 바 높이가 줄어든 만큼 `footer`의 보정용 하단 패딩(20-36단계에 추가)도 70px→54px로 같이 줄임.

**버그 없이 한 번에 통과**: Playwright로 데스크톱(1440px)/모바일(390px) 전부 검증 — nav 데스크톱/모바일에서 "UID 확인" 클릭 시 uid-modal만 열리고 apply-modal은 안 열리는 것, nav pill/promo-banner/mobile bar 전부 apply-modal을 여는 것, 모바일 햄버거 드롭다운에서 "UID 확인" 클릭 시 드롭다운이 닫히면서 동시에 모달이 뜨는 것(기존 드롭다운 닫기 리스너와 충돌 없음), `#verify` 섹션에 `.verify-card`가 더 이상 존재하지 않고 `.payback-grid` 안에 카드 2개만 남은 것, Esc/배경 클릭으로 두 모달 다 정상적으로 닫히는 것, 가로 오버플로우 0px(데스크톱/모바일 모두, 모달 열린 상태 포함)인 것까지 확인. API 응답을 mock 처리해서(`/api/check-uid` 성공 응답 + `/api/telegram-link` fallback + `/api/telegram-join` 성공) 모달 안에서 3단계 전체 플로우(UID 확인 성공 → 시드 O 선택 → 텔레그램 아이디 입력 → 신청 완료 메시지)가 기존과 동일하게 끝까지 동작하는 것도 스크린샷으로 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- UID 확인 모달이 이제 페이지 안 어디에도 인라인 진입점이 없고 메뉴에서만 열림 — 혹시 "메뉴까지 가기 번거롭다"는 피드백이 오면 `#exchanges`나 다른 섹션에 작은 보조 링크를 추가하는 걸 고려할 수 있음(지금은 요청받은 그대로 메뉴 전용으로 구현).
- 신청 모달 안의 플로우(UID→시드→텔레그램) 자체 로직은 이번에 전혀 안 건드림 — 20-12/20-16단계의 시드 예치 O/X 안내, 봇 딥링크/수동 입력 폴백 등은 그대로 유지됨.
- `.payback-cta` 클래스가 20-15단계에 미리 만들어뒀다가 안 쓰이던 CSS였는데 이번에 드디어 쓰임 — 이 프로젝트에 종종 있는 "나중에 재사용될 자리만 잡아둔 CSS"가 실제로 재사용된 사례.

## 20-39단계: 모바일 하단 바를 화면 폭 가득 채우던 것에서 작은 알약으로 재축소 (2026-10-22)

사용자가 "화면을 축소해야 보여, 비공개 스터디방 입장하기로 글 줄여주고, 버튼도 짧게 해주고 너무 길어, 그리고 걸리적 거리지 않게 해줘"라고 요청 — 20-38단계에서 패딩/폰트만 줄였던 모바일 하단 신청 바(`.mobile-apply-bar`)가 여전히 `left:18px; right:18px`로 화면 가로폭을 거의 꽉 채우고 있어서, 사용자 입장에서는 "짧게 했다"는 체감이 전혀 안 들고 오히려 화면을 압도하는 느낌이었던 것으로 보임 — "화면을 축소해야 보여"는 실제 가로 스크롤 버그라기보다(Playwright로도 0px 확인됨) 그 막대가 화면 아래를 가로질러 시야를 차지하는 정도가 커서 나온 표현으로 해석함.

**고친 방법 — "폭을 줄이기"가 아니라 "폭 자체를 글자 길이만큼만"으로 구조를 바꿈**: 기존엔 `left`/`right`를 고정해서 버튼이 뷰포트 너비에 비례해 늘어나는 **막대(bar)** 구조였는데, 이번엔 `left:50%; transform:translateX(-50%);`로 **화면 하단 중앙에 고정 폭 알약(pill)**을 띄우는 구조로 바꿈 — 텍스트 길이만큼만 차지하고 양옆은 완전히 비워둠(실측: 390px 화면에서 버튼 폭 150.6px, 기존엔 사실상 354px까지 차지했음). 텍스트도 "🔒 비공개 빗각 스터디방 입장 신청하기"에서 사용자가 요청한 그대로 **"🔒 비공개 스터디방 입장하기"**로 축약(빗각/신청 두 단어 제거). `white-space:nowrap`로 줄바꿈 없이 한 줄 고정, 펄스 애니메이션(`applyBarPulse`)도 "걸리적거림"의 일부로 보고 완전히 제거해서 더 차분한 인상으로 바꿈. 바 높이가 줄어든 만큼 `footer`의 하단 패딩 보정값도 54px→44px로 같이 줄임.

로컬 `wrangler dev`(포트 8803) + Playwright로 360/375/390/430px 네 가지 모바일 폭 전부에서 버튼이 화면 중앙에 고정 폭(150.6px)으로 뜨는 것, `.float-tg`(우하단 텔레그램 버튼)와 전혀 안 겹치는 것, 가로 오버플로우 0px인 것을 수치로 확인, 데스크톱(390px 기준) 스크린샷으로 버튼이 실제로 작고 화면 아래 중앙에 아담하게 떠 있는 것·푸터 텍스트가 안 가려지는 것 확인, 클릭 시 여전히 신청 모달이 정상적으로 열리는 것까지 확인. `node --check` + `wrangler deploy --dry-run` 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- 펄스 애니메이션을 완전히 제거해서 이제 이 버튼은 스크롤해도 가만히 떠 있기만 함 — 혹시 "그래도 눈에 덜 띄어서 아쉽다"는 피드백이 오면 아주 은은한 버전(예: 그림자만 살짝, 주기를 훨씬 길게)으로 다시 추가하는 걸 고려할 수 있음, 지금은 "걸리적거리지 않게"를 우선해서 완전히 뺌.
- 버튼이 작아진 만큼 탭 영역(터치 타겟)도 줄어들었음(가로 150px, 세로 ~32px 수준) — 모바일 터치 접근성 기준(보통 44px 권장)보다 세로 폭이 다소 작을 수 있어서, 혹시 "탭이 잘 안 된다"는 피드백이 오면 세로 패딩을 조금 더 주는 걸 고려할 것.

## 20-40단계: 두 번째 파트너 거래소 BYDFi 추가 — 자동 확인 API가 없어서 수동 확인 방식으로 (2026-10-25)

사용자가 "바이드파이 링크도 받아왔는데 UID 확인 시스템 얘도 만들 수 있어?"라고 요청 — 20단계부터 TODO로 남아있던 "다른 거래소 추가"가 실제로 들어온 것.

**작업 전 조사 — Gate.io식 자동 확인은 불가능함을 확인**: WebSearch로 BYDFi API를 조사한 결과, API 키 발급은 가능하지만(HMAC 서명, **선물 거래만 지원, 승인까지 약 영업일 7일 + KYC 필요** — Gate.io처럼 바로 발급되는 구조가 아님) 공개된 엔드포인트 목록(계좌/자산/선물거래/시세)에 레퍼럴·제휴 관계를 조회하는 엔드포인트가 전혀 없음. 레퍼럴/서브어필리에이트는 **웹 대시보드 전용**이고, 거기서도 초대받은 사람 UID가 프라이버시 때문에 가려져서 표시된다는 제3자 리뷰까지 확인함. 즉 Gate.io의 `rebate/user/sub_relation` 같은 "UID 입력하면 즉시 내 레퍼럴인지 자동 확인"하는 API 자체가 BYDFi엔 없다고 보고, AskUserQuestion으로 확인한 뒤 **수동 확인 방식**으로 진행하기로 함(사용자도 "수동 확인 방식으로" 추천안 선택).

**사용자가 준 정보**: 레퍼럴 링크 `https://promote.bydfi.com/b/teamsixx`, Gate.io 밑에 배치, 페이백율 50%. 추가 질문으로 확인: BYDFi 가입자도 비공개 빗각 스터디방 입장 허용(Gate.io와 동일), 정산 주기도 Gate.io와 동일하게 "매일, 1시간 내외"로 표기(실제 BYDFi 정산 데이터로 검증된 건 아니고 Gate.io와 같다고 가정한 것 — 베타 성격의 표기임을 유의).

**구현**:
- **`POST /api/bydfi-join`(신설)**: `{uid, telegram_id}`를 받아 느슨한 포맷 검증(`isValidExchangeUid()` — BYDFi UID 공식 포맷 문서를 못 찾아서 범용 영숫자 2~30자로만 검증, 실제 포맷과 다르면 추후 조정 필요)만 하고, **서버 재검증 없이**(검증할 API 자체가 없으므로) `bydfi_join_requests` 테이블에 저장 + `notifyAdminTelegram()`으로 "⚠️ BYDFi는 자동 확인 API가 없어요 — 어필리에이트 대시보드에서 직접 확인 후 개별 안내해주세요"라고 운영자에게 알림만 보냄. `telegram_join_requests`(Gate 전용)와 별개 테이블로 분리 — 두 거래소의 검증 방식 자체가 근본적으로 다르다는 걸(하나는 서버가 자동 재검증, 하나는 전혀 안 함) 테이블 구조로도 명확히 구분해두기 위함.
- **거래소 테이블에 BYDFi 행 추가**(Gate.io 밑, "준비중" 위) — 50% 페이백율, "매일·1시간 내외" 정산(Gate.io와 동일 표기), "가입하기"(실 링크) + "UID 제출"(BYDFi 전용 모달 직접 오픈) 버튼. 설명 문구에 "BYDFi는 자동 확인 API가 없어서, UID를 제출하시면 운영자가 직접 확인 후 텔레그램으로 안내해드려요"라고 **정직하게 명시** — Gate.io처럼 즉시 확인되는 것처럼 보이지 않게 함. 로고는 실제 BYDFi 로고를 못 구해서(제3자 사이트 하드링크 금지 원칙, Gate.io 20-5단계와 같은 이유) 자체 제작 추상 SVG 배지로 대체(블루→바이올렛 그라데이션, Gate 배지와 다른 톤/모티프로 구분).
- **`#bydfi-modal-backdrop`(신설)**: Gate 모달과 똑같은 3단계 UX(UID→시드예치 O/X→텔레그램)를 쓰되, **1단계가 "확인하기"가 아니라 "다음"** — 서버 왕복 없이 입력만 확인하고 바로 2단계로 넘어감(검증할 게 없으므로). 3단계 제출 시에만 `/api/bydfi-join` 호출, 성공 메시지도 "✅ 신청이 접수됐습니다"(Gate, 이미 확정된 느낌)가 아니라 "✅ 접수됐어요! BYDFi 가입 확인 후 텔레그램으로 안내드릴게요"(아직 확인 전이라는 뉘앙스를 분명히 구분)로 다르게 씀.
- **`#exchange-choice-modal-backdrop`(신설)**: 거래소가 2개가 되면서, 기존에 Gate 모달을 곧장 열던 전역 진입점(nav pill/프로모배너/`#verify`버튼/모바일바, 전부 `.js-open-apply-modal` 클래스)이 이제 "어느 거래소로 가입하셨나요?" 선택 모달을 먼저 거치고, 고른 쪽의 전용 모달로 이어짐. 거래소 카드 자체의 버튼(Gate "UID 확인"/BYDFi "UID 제출")은 이미 어느 거래소인지 알고 있으니 선택 단계를 건너뛰고 바로 해당 모달을 엶.
- **의도적인 `window` 노출**: 선택 모달이 Gate/BYDFi 각각의 모달 열기 함수를 호출해야 해서 `window.openApplyModal`/`window.openBydfiModal`로 명시적으로 공개함 — 20-22단계에서 겪었던 "모르고 다른 IIFE의 지역 함수를 잘못 참조"하는 사고와는 다른, 의도적인 공개 인터페이스임을 코드 주석에도 명시.
- **계산기 `EXCHANGES` 배열에 BYDFi 항목 추가**(20-28단계에서 애초에 "배열에 항목만 추가하면 확장되도록" 설계해둔 대로) — BYDFi 전용 수수료율 데이터가 없어서 Gate.io와 같은 추정치(0.05%)를 그대로 씀.
- **버그 발견 및 수정(이번 작업 중 발견한 20-38단계의 묵은 회귀)**: Gate 거래소 카드의 "UID 확인" 버튼이 여전히 `href="#verify"`였음 — 20-38단계에서 UID 확인을 인라인 섹션에서 메뉴 전용 모달로 옮기면서 `#verify` 섹션엔 더 이상 UID 입력 폼이 없는데, 이 버튼만 안 고쳐놓고 방치돼 있었음(눌러도 아무 의미 없는 스크롤만 됨). `js-open-uid-modal` 클래스로 교체해서 고침 — 이번에 다른 작업을 하다가 우연히 발견한 것이라, 비슷하게 놓친 곳이 더 없는지 grep으로 전체 확인함(추가 발견 없음).

**schema.sql/schema-console.sql에도 `bydfi_join_requests` 정의 추가**(운영 DB는 `ensureSchema()`가 처리, 이 파일들은 문서/수동 콘솔용).

로컬 `wrangler dev`(포트 8804) + Playwright로 데스크톱(1440px)/모바일(390px) 전부 확인: 거래소 행 순서(Gate.io→BYDFi→준비중)와 BYDFi 링크값, Gate "UID 확인"이 이제 uid-modal을 여는 것, BYDFi "UID 제출"이 선택모달 안 거치고 bydfi-modal을 바로 여는 것, 전역 진입점(nav pill)이 선택모달을 여는 것, 선택모달에서 "BYDFi" 고르면 선택모달 닫히고 bydfi-modal이 열리는 것, BYDFi 3단계 전체 플로우(UID "다음"→시드 O→텔레그램 제출, `/api/bydfi-join` mock 성공 응답)가 끝까지 정상 동작하는 것, 계산기에 BYDFi 선택지가 추가된 것, 가로 오버플로우 0px(데스크톱/모바일, 선택모달/BYDFi모달 열린 상태 포함)인 것까지 스크린샷과 함께 확인. `node --check` + `wrangler deploy --dry-run`(결과: assets 3개 파일 — index.html/gate-logo.png/bydfi-logo.svg) 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- **사용자 확인 필요**: BYDFi UID 제출이 실제로 운영자 텔레그램에 정상 도착하는지, 그리고 BYDFi 어필리에이트 대시보드에서 UID로 레퍼럴 여부를 실제로 식별할 수 있는지(검색 결과엔 "UID가 가려져 표시된다"는 제3자 리뷰도 있어서, 실제로 운영자가 대시보드에서 어떻게 대조 확인할 수 있는지는 확인 안 됨 — 혹시 UID 대조가 불가능하면 텔레그램 아이디나 가입 시점 등 다른 방법으로 대조해야 할 수 있음).
- `isValidExchangeUid()`의 영숫자 2~30자 검증은 BYDFi 공식 UID 포맷 문서를 못 찾아서 임의로 느슨하게 잡은 것 — 실제 포맷(숫자만인지, 길이가 얼마인지 등)을 알게 되면 Gate처럼 더 구체적인 정규식으로 좁힐 수 있음.
- ~~BYDFi 로고는 이번에도 자체 제작 SVG~~ → **20-41단계에서 실제 로고로 교체됨, 아래 참고.**
- 정산 주기 "매일, 1시간 내외"는 Gate.io와 동일하다고 가정하고 적어둔 것 — 실제 BYDFi 정산 데이터로 확인된 적은 없음, 다르다는 게 확인되면 거래소 카드 문구를 수정해야 함.
- `bydfi_join_requests`는 상태 컬럼(pending/confirmed 등) 없이 순수 로그 테이블임 — 관리자 대시보드가 없는 이 프로젝트 방침대로, 확인 후 처리 여부는 운영자가 텔레그램에서만 관리하고 이 테이블에 다시 기록하지 않음(D1 콘솔로 직접 조회하는 것은 가능).

## 20-41단계: BYDFi 자체 제작 SVG 배지 → 실제 공식 앱 아이콘으로 교체 (2026-10-25)

사용자가 "바이드파이도 앱 로고 넣어줘"라고 요청하고 iOS 홈스크린 스크린샷(노란/골드 라운드 사각형 아이콘, 검정 "BYDFi" 워드마크 + 흰색 삼각형 포인트, 파란 그라데이션 배경 벽지, 아이콘 아래 흰색 "BYDFi" 캡션 텍스트)을 보내줌 — Gate.io 20-9단계와 정확히 같은 상황(실 로고 네트워크 접근 불가 → 사용자 스크린샷을 소스로 직접 크롭).

**이번에도 네트워크로는 못 받아옴**: `web-fetch` 에이전트로 `bydfi.com` 공식 자산을 먼저 확인하려 시도했으나 DNS 단계에서부터 완전히 막힘(Gate.io 때의 egress 차단/403과는 다른 형태지만 결과는 동일 — 공식 소스 접근 불가). 곧바로 사용자에게 스크린샷을 요청하는 기존 패턴(20-9단계)으로 전환.

**가공 과정**: 업로드된 이미지(309×283px, 격리된 `bydfi_src/` 디렉터리에 복사 — 신뢰 안 된 외부 파일 처리 정책 준수)를 Pillow+numpy로 가공. 이번 세션엔 Python 툴체인이 두 군데 고장나 있어서 먼저 고침 — ① `pip`가 `/usr/bin/pip`(Python 3.13용)를 가리키고 `python3`는 `/usr/local/bin/python3`(3.11)라서 설치해도 못 찾는 문제 → `python3 -m pip install --break-system-packages`로 인터프리터를 맞춰서 해결. ② apt로 깔려있던 Pillow 10.2.0의 네이티브 확장이 깨져있어서(`cannot import name '_imaging'`) `--force-reinstall --no-cache-dir`로 13.0.0을 새로 받아 해결.
- RGB 채널 임계값으로 노란 아이콘 영역만 분리(`r>150, g>120, b<r-30, b<g-10`)해서 픽셀 좌표 바운딩 박스를 구함(x:57~246, y:10~199) — 파란 배경 벽지와 아이콘 아래 흰색 캡션 텍스트를 자동으로 걸러냄.
- 경계에서 안쪽으로 2px 여유를 두고, 정사각형으로 맞춰 크롭한 뒤 192×192px로 리사이즈 → `public/bydfi-logo.png`(24KB)로 저장. 모서리에 남는 배경색 비침은 Gate.io 때와 동일하게 기존 `.ex-logo`/선택모달 이미지의 `border-radius`+`overflow:hidden`이 그대로 깔끔하게 잘라줘서 추가 처리 불필요.

**적용**: `public/index.html`에서 `/bydfi-logo.svg`를 참조하던 3곳(거래소 테이블 행, 거래소 선택 모달의 BYDFi 버튼, 계산기 `EXCHANGES` 배열의 로고 경로)을 전부 `/bydfi-logo.png`로 교체(grep으로 전수 확인). 더 이상 쓰이지 않는 `public/bydfi-logo.svg`(자체 제작 플레이스홀더)는 파일째 삭제 — Gate.io 20-9단계 때처럼 남겨두지 않고 완전히 교체.

로컬 `wrangler dev`(포트 8806) + Playwright로 데스크톱(1440px)/모바일(390px) 확인: 거래소 테이블 행과 거래소 선택 모달 양쪽에 새 로고가 깨짐 없이 렌더링되는 것, 계산기 거래소 선택지의 이미지 경로가 둘 다 `.png`로 바뀐 것, 가로 오버플로우 0px(데스크톱/모바일)인 것 확인. `node --check` + `wrangler deploy --dry-run`(결과: assets 3개 파일 — index.html/gate-logo.png/bydfi-logo.png, 더 이상 svg 없음) 검증, 병합 전 `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- 소스가 사용자의 휴대폰 스크린샷(저해상도)이라, Gate.io 로고 때와 같은 이유로 지금 쓰는 작은 배지 크기(28~44px)에선 문제없지만 나중에 더 큰 용도(파비콘 등)로 쓰려면 고해상도 원본이 필요할 수 있음.
- BYDFi 관련 나머지 미해결 항목(UID 포맷 검증 느슨함, 운영자가 UID로 대시보드 대조 가능한지, 정산 주기 가정)은 20-40단계 "다음에 볼 것"에 그대로 남아있음 — 이번 단계는 로고 교체만 다룸.

## 20-42단계: 사이트 정체성을 "페이백 플랫폼"에서 "빗각 스터디방"으로 재정의 (2026-10-25)

사용자가 "우리 목적은 페이백도 있지만, 스터디방에 가까워. 목적 명확히 구분해주고 그에 맞게 사이트 리뉴얼 해줘"라고 요청 — 20단계(2026-10-07)부터 사이트 전체 메시지가 "거래소 수수료 페이백"을 1순위, 비공개 텔레그램 커뮤니티는 혜택 중 하나로만 다뤄왔는데, 실제 사업의 본질은 반대(스터디방이 메인, 페이백은 입장 과정에서 받는 특전)라는 걸 명확히 함.

**작업 전 AskUserQuestion으로 확인한 3가지**: ① 히어로 우선순위 — "스터디방 메인 + 페이백은 특전"으로 확정(3개 선택지 중 추천안 선택). ② 스터디방이 실제로 제공하는 내용 — 시황 브리핑/개인 포지션 공유/교육/강의 콘텐츠 4가지로 확인(그동안 사이트엔 "비공개 텔레그램 커뮤니티"라고만 돼있고 구체적 설명이 전혀 없었음). ③ 기존 "거래소 가입→UID확인→텔레그램신청" 플로우 설명 방식 — "스터디방 입장 조건"으로 재설명하는 쪽으로 확정.

**구현**:
- **메타 타이틀/설명**: "TEAM SIXX — 거래소 수수료 페이백" → **"TEAM SIXX — 비공개 트레이딩 스터디방 빗각"**으로 교체, description도 시황 브리핑/실전 포지션이 먼저 나오고 페이백은 뒤에 붙는 문장으로 재작성.
- **히어로**: 배지 "현재 가입 모집중" → "비공개 스터디방 멤버 모집중". h1을 "거래소 수수료, 다시 돌려받으세요"에서 **"함께 보는 시황, 함께 나누는 포지션"**으로 전면 교체(페이백 언급 자체가 사라짐). 서브 설명도 "빗각" 스터디방을 먼저 언급하고 페이백은 "~까지 특전으로 받을 수 있어요"로 뒤에 배치. CTA 버튼도 "시작하기 →"(거래소 테이블로 스크롤)에서 **"스터디방 입장 신청 →"**(신청 모달 직접 오픈)으로 교체 — 클릭 동작을 앵커 스크롤에서 `.js-open-apply-modal` 클래스 기반 모달 오픈으로 바꿈(20-40단계 때 만들어둔 전역 핸들러가 class만 보고 자동으로 바인딩하는 구조라 JS 수정 없이 바로 적용됨).
- **새 섹션 `#studyroom` 신설**(히어로 바로 다음, 프로모 배너 앞): "TEAM SIXX는 비공개 트레이딩 스터디방이에요" 제목 아래 "시황 브리핑 📡 / 개인 포지션 공유 📊 / 트레이딩 교육 🎓 / 강의 콘텐츠 🎬" 4개 카드 그리드(`.study-grid`/`.study-card`, 데스크톱 4열→태블릿 2열→모바일 1열). **이 섹션이 이번 리뉴얼의 핵심** — 기존엔 스터디방이 뭘 제공하는지 사이트 어디에도 구체적 설명이 없었는데, 이번에 사용자가 확인해준 4가지 콘텐츠를 처음으로 명시함. `.study-card`의 `transition` 선언에 호버 효과(`border-color`)뿐 아니라 `.reveal`의 opacity/transform 타이밍도 처음부터 포함시켜서 20-31단계에서 겪은 "같은 명시도 클래스가 transition을 재선언하면 리빌 애니메이션이 조용히 깨지는" 패턴을 새 컴포넌트에서부터 피함.
- **nav 메뉴**: 데스크톱/모바일 드롭다운 양쪽에 "스터디방"(→`#studyroom`) 링크를 맨 앞에 추가, "이용 방법"을 "입장 방법"으로 개명(스터디방 입장 절차라는 의미를 명확히). 헤더 우측 CTA 버튼도 "가입하기 →"(거래소 테이블 스크롤)에서 **"입장 신청 →"**(`.js-open-apply-modal`)로 교체해서 사이트 전체의 1차 전환 동작을 "거래소 가입"에서 "스터디방 입장 신청"으로 통일.
- **`#how` 섹션**: 제목을 "거래소에 낸 수수료, 돌려받을 수 있어요"에서 **"빗각 스터디방, 이렇게 입장해요"**로 교체, 소개 문구도 "거래소 가입은 입장 조건"이라는 틀로 재작성. 플로우 카드 3단계도 ①"전용 링크로 가입"(시드 예치 언급 추가) → ②"UID 확인" → ③"텔레그램 입장 신청"(기존 "텔레그램 입장 신청"은 그대로 유지하되 설명만 "운영자가 확인 후 안내"로 소폭 수정)로 유지하되, 하단 콜아웃 문구를 "페이백은 거래마다 계산돼..."에서 **"입장 조건을 갖추면 시황 브리핑·포지션 공유·교육 콘텐츠를 바로 이용할 수 있고, 거래 수수료 페이백도 함께 지급돼요"**로 바꿔서 콘텐츠 이용이 먼저, 페이백이 나중에 오도록 순서를 뒤집음.
- **`#calc` 섹션**: sec-label을 "CALCULATOR"에서 "MEMBER PERK"로, 제목을 "예상 페이백 계산기"에서 **"스터디방 멤버 특전, 예상 페이백 계산기"**로 교체 — 계산기 자체 로직/UI는 전혀 안 건드리고, 이게 "본 상품"이 아니라 "입장하면 따라오는 특전"이라는 위치만 명확히 함.
- **FAQ 재구성**: 기존 6개 질문이 전부 페이백/거래소 관련이었는데, **"스터디방에서는 뭘 하나요?"**(시황 브리핑/포지션 공유/교육/강의 콘텐츠를 다시 한번 명시)와 **"스터디방 입장 조건이 뭔가요?"** 2개를 새로 추가하고 맨 앞 2순위로 배치(순서: 스터디방 소개→입장조건→신청소요시간→거래소계정 관련→UID확인→다른거래소지원→페이백요율→페이백시기). 첫 번째 질문(`<details open>`)은 기본으로 펼쳐진 상태로 둬서, FAQ 섹션에 도달한 방문자가 클릭 한 번 없이도 "이게 뭐하는 사이트인지" 바로 보이게 함.
- **푸터 투자 유의사항**: "TEAM SIXX는 거래소 전용 링크 가입 안내와 수수료 페이백 정보를 제공할 뿐"을 **"TEAM SIXX는 비공개 트레이딩 스터디방 운영과 거래소 전용 링크 가입 안내·수수료 페이백 정보를 제공할 뿐"**로 보강 — 법적 방어 문구의 보호 범위(투자 자문 아님, 원금 손실 가능성)는 그대로 두고, 사업 실체(스터디방 운영)를 정확히 반영하도록 사실만 추가.
- **안 건드린 것**: `src/worker.js`(API/DB)는 이번 작업과 전혀 무관해서 손대지 않음 — 순수 프론트엔드 카피/구조/CSS 변경. `#verify`(UID 확인·신청 모달), `#events`(이벤트/공지), `#admin`(이벤트 관리) 섹션의 내부 로직·마크업도 그대로 유지, sec-head 설명 문구만 "거래소 가입 확인"이라는 표현으로 살짝 다듬음. 거래소 테이블(`.ex-table`, 히어로 우측)·BYDFi 모달·페이백 조회 모달 등 20-40/20-41단계 기능은 전부 그대로 재사용.

로컬 `wrangler dev`(포트 8808, 로컬 전용 `ADMIN_PASSWORD=testpass123`) + Playwright로 데스크톱(1440px)/모바일(390px) 전부 확인: 타이틀/히어로 h1/CTA 문구가 전부 바뀐 것, `#studyroom` 카드 4개가 정확한 제목으로 렌더링되는 것, nav에 "스터디방" 링크가 추가되고 클릭 시 그 섹션으로 스크롤되는 것, 헤더 CTA·히어로 CTA가 모두 `.js-open-apply-modal` 전역 핸들러를 타서 거래소가 2개(Gate.io/BYDFi)인 지금 구조대로 "어느 거래소로 가입하셨나요?" 선택 모달을 먼저 여는 것(20-40단계 로직 그대로 정상 작동), FAQ 첫 항목이 기본으로 펼쳐져 있고 순서가 스터디방 질문 우선인 것, 가로 오버플로우 0px(데스크톱/모바일)인 것까지 스크린샷으로 확인. `node --check` + `wrangler deploy --dry-run`(번들 크기 변화 없음 — 텍스트만 바뀜) 검증, `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- "스터디방"이라는 명칭은 레거시(1~19단계 코인 선물 스터디룸 시절)에서 구어체로 남아 계속 쓰이던 표현을 이번에 공식적으로 사이트 전면에 재도입한 것 — CLAUDE.md 20단계 "프로젝트 개요"에도 "스터디방"이라는 단어가 괄호 설명 없이 계속 등장했던 걸 이번에 사이트에도 명시적으로 반영한 셈. 혹시 "스터디방"이라는 단어보다 "빗각" 브랜드명을 더 전면에 내세우고 싶다면(예: 사이트 제목 자체를 "빗각"으로) 추가 요청 필요 — 이번엔 보수적으로 "TEAM SIXX(브랜드) + 빗각(커뮤니티 이름) + 스터디방(장르)"를 병기하는 선에서 정리함.
- 스터디방 콘텐츠 4가지(시황 브리핑/포지션 공유/교육/강의)는 사용자가 말로 확인해준 항목을 그대로 카드 설명으로 풀어쓴 것 — 실제 운영 중인 콘텐츠와 표현이 정확히 일치하는지, 혹시 더 추가하거나 다르게 설명하고 싶은 항목이 있는지 검토가 필요하면 알려주면 바로 반영 가능.
- `#calc`(계산기)/`#events`(이벤트)/`#admin`(관리자)/`#verify`(UID확인·신청) 섹션은 구조·기능을 전혀 안 건드리고 제목/설명 문구만 "멤버 특전" 톤으로 살짝 조정함 — 혹시 이 섹션들의 순서나 노출 비중까지 스터디방 중심으로 더 바꾸고 싶다면(예: 계산기를 페이지 더 아래로, 혹은 아예 "특전" 전용 서브섹션으로 묶기) 추가 피드백 필요.
- 이번 리뉴얼은 카피/정보구조 재배치 중심이라 CSS 구조적 변경은 `.study-grid`/`.study-card` 추가 하나뿐 — 디자인 톤(색상/폰트/카드 스타일)은 기존 20-27~20-33단계에서 확립된 디자인 시스템을 그대로 재사용함(새 컴포넌트를 추가할 때마다 반복되는 이 프로젝트의 관례).

## 20-43단계: "빗각" 오용 수정 — 커뮤니티 이름이 아니라 기술적 분석 기법 이름이었음 (2026-10-25)

사용자가 "빗각은 기술적 분석 이름이야, 조금 오류가 있는 것 같음"이라고 지적 — 20-12단계부터 20-42단계까지 사이트와 CLAUDE.md 전반에서 "빗각"을 비공개 텔레그램 커뮤니티의 고유 이름("비공개 빗각 스터디방")처럼 계속 써왔는데, 사실 **"빗각"은 스터디방에서 다루는 기술적 분석 기법의 이름이지 커뮤니티 자체의 이름이 아니었음** — 꽤 오래 이어진 사실 오류였음.

**처리 방향 확인(AskUserQuestion)**: "빗각 기법을 다루는 스터디방"처럼 기법으로 재소개할지, 아니면 "빗각" 단어 자체를 사이트에서 완전히 빼고 일반적인 표현("비공개 스터디방"/"TEAM SIXX 스터디방")으로만 쓸지 물어봄 — 사용자가 **완전 제거**를 선택함.

**구현**: `public/index.html`에서 "빗각"이 쓰이던 10곳 전부 수정 — 타이틀/메타 설명/히어로 서브 설명/`#studyroom` 소개 문구/프로모 배너/`#how` 제목/`#verify` 설명/UID·신청 모달 제목 3곳(Gate 전용/BYDFi 전용)까지. 전부 "비공개 빗각 스터디방" → "비공개 스터디방", "빗각 스터디방" → "TEAM SIXX 스터디방"처럼 **별도 이름을 새로 지어내지 않고** 일반적인 표현으로만 교체(사용자가 "완전 제거"를 선택했으므로, 커뮤니티에 임의의 새 이름을 붙이지 않음 — 정확한 이름이 필요해지면 다음에 알려주면 그때 반영). `src/worker.js`/`src/study-bot.js` 등 서버 코드는 grep으로 전체 확인해서 "빗각" 참조가 아예 없었음(운영자 알림 메시지 등도 전부 무관) — 수정 범위는 `public/index.html`뿐.

`node --check` + `wrangler deploy --dry-run`(번들 크기 변화 없음 — 텍스트만 바뀜) 검증, `git log origin/main`으로 다른 세션의 동시 커밋 없는지 확인(20-17단계 교훈) 후 배포.

### 다음에 볼 것
- 커뮤니티(비공개 텔레그램 그룹) 자체에 정식 이름이 있다면 다음에 알려주면 됨 — 지금은 "TEAM SIXX 스터디방"/"비공개 스터디방"처럼 브랜드명 또는 일반 명사로만 지칭하고 있음.
- "빗각"이라는 기법 자체를 스터디방 소개 콘텐츠(`#studyroom`의 "트레이딩 교육" 카드 등)에 구체적으로 언급하고 싶다면("빗각 기법도 가르쳐요" 식으로) 요청해주면 반영 가능 — 이번엔 "완전 제거"로 확정했으므로 추가하지 않음.
- 이번 오류가 20-12단계(2026-10-10)부터 20-42단계(2026-10-25)까지 약 2주, 여러 단계에 걸쳐 반복 사용됐던 걸 보면, 사용자가 쓰는 용어(특히 고유명사/업계 전문 용어)를 그대로 받아 반복 사용하기 전에 "이게 커뮤니티 이름인지, 기법/상품 이름인지" 같은 범주를 한 번 더 확인하는 습관이 비슷한 재발을 줄일 수 있음.

## 환경변수 목록 (Cloudflare 대시보드 Settings > Variables and Secrets)

```
GATE_API_KEY            Gate.io API 키 (UID 확인용)
GATE_API_SECRET         Gate.io API 시크릿
TELEGRAM_BOT_TOKEN      (선택) 텔레그램 가입 신청 알림용 봇 토큰 — 없으면 알림만 생략되고 신청 저장은 항상 됨
TELEGRAM_ADMIN_CHAT_ID  (선택) 알림 받을 chat_id — 위와 세트로 필요. 스터디방 봇에서는 "운영자 본인 개인 user_id"로도 쓰임(관리 명령/승인 버튼 권한)
TELEGRAM_WEBHOOK_SECRET (선택, 20-16) 스터디방 봇 웹훅 비밀값 — setWebhook의 secret_token과 같아야 함. 없으면 봇 기능 꺼지고 사이트는 @아이디 입력 방식
TELEGRAM_GROUP_CHAT_ID  (선택, 20-16) 스터디방 그룹 chat_id(-100...) — 그룹에서 운영자가 /groupid 보내면 봇이 알려줌
ADMIN_PASSWORD          (20-28단계부터 다시 사용) 이벤트 관리 탭(/#admin) 로그인 비밀번호 — 없으면 관리자 로그인 자체가 "설정 안 됨" 에러로 막힘
```

⚠️ `ADMIN_USERNAME`은 20단계 이후 계속 코드에서 안 쓰임 — 지워도 무해함. `ADMIN_PASSWORD`는 20단계~20-27단계까지는 안 쓰였지만 **20-28단계부터 이벤트 관리 탭 로그인에 다시 쓰임** — Cloudflare 대시보드에 예전 값이 남아있다면 그 값이 곧 로그인 비밀번호이고, 없거나 바꾸고 싶으면 새로 설정하면 됨.

## 대화 중 나온 운영 정책 메모

- 협력 거래소는 Gate.io부터 시작, 반드시 전용 레퍼럴 링크로 신규 가입해야 인정 (기존 계정/다른 경로 가입은 페이백 대상 아님)
- 현재 Gate.io 페이백율 50%(2026-10-08 20-4단계에서 20%→50% 인상) — Gate.io에서 해줄 수 있는 최대 요율, 매일 1시간 내외(변동 가능)로 정산
- 다른 메이저 거래소(OKX/바이비트 등)도 추가 예정이나 아직 확정 전이라 사이트에는 이름 없이 "준비중"으로만 노출
- 거래소 가입 확인된 사람 대상 전용 텔레그램방 운영 — 가입 신청(UID+텔레그램 아이디)이 오면 운영자가 텔레그램 봇 알림으로 받아서 개별 안내
- 관리자 전용 웹 대시보드는 더 이상 없음 — 텔레그램 알림이 운영 인터페이스의 전부
