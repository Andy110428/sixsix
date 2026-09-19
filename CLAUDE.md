# TEAM SIXX — 프로젝트 요약 (Claude Code용)

이 문서는 claude.ai에서 진행하던 작업을 Claude Code로 이어받기 위한 요약입니다.
세션 시작 시 이 내용을 참고해서 이어서 작업해주세요.

## 프로젝트 개요

코인 선물 트레이딩 비공개 스터디방 운영을 위한 웹사이트.
- 협력 거래소(Gate.io) 전용 링크로 가입 + 최소 시드 $700 이상 예치한 사람만 스터디방 입장 가능
- 입장 확인은 Gate.io API로 자동화(레퍼럴 관계 확인), 예치 금액은 스크린샷으로 수동 확인 (텔레그램에서 운영자가 개별 확인 후 비공개 채널 초대)
- 텔레그램 비공개 채널(실시간 브리핑)과 웹사이트(공지/강의/질문/수익인증)를 병행 운영
- ⚠️ **계정이 완전히 분리된 두 종류로 존재**(2026-09-19 4단계): 스터디룸 계정(Gate UID 인증 필요)과 일반/추천인 계정(이메일, Gate UID 무관). 자세한 내용은 아래 "인증 구조" 참고

## 배포 환경

- **호스팅**: Cloudflare Workers (Workers + Static Assets 통합 방식, "Pages" 아님)
- **배포 방식**: GitHub 저장소(`Andy110428/sixsix`)를 Cloudflare에 Git 연동 → `main` 브랜치가 업데이트되면 자동 재배포 (다른 브랜치는 배포 안 됨)
- **Deploy 명령어**: `npx wrangler deploy` (wrangler.jsonc 기반)
- **DB**: Cloudflare D1 (SQLite), 바인딩 이름 `DB`, database_name `sixsix-db`
- ⚠️ 드래그앤드롭 방식 "Upload assets"로는 `functions`/서버 코드가 인식 안 됨 — 반드시 Git 연동 + wrangler.jsonc 방식 유지할 것
- **운영 방침(중요)**: 작업은 `claude/github-file-upload-followup-lu95ef` 브랜치에서 커밋하되, 완료되면 매번 사용자한테 병합해도 되는지 묻지 말고 바로 `main`에 병합해서 push할 것 (사용자가 명시적으로 요청함 — "앞으로는 바로 병합해서 배포"). 병합 전에는 항상 `node --check src/worker.js`와 `npx wrangler deploy --dry-run`으로 검증하고 병합할 것

## 파일 구조

```
wrangler.jsonc          Workers 설정 (assets + D1 바인딩)
schema.sql / schema-console.sql   D1 스키마 (console.sql은 주석 없는 버전, 콘솔 붙여넣기용)
migration-*.sql          D1 마이그레이션 파일들 (이미 배포된 DB용, ensureSchema()가 자동으로도 처리함)
src/worker.js           서버 코드 전체 (라우팅 + API)
public/index.html       메인 랜딩페이지
public/requirements.html  입장 조건 상세
public/join.html        입장 절차 3단계 + UID 사전 확인 모달
public/portal.html      스터디룸 (UID 로그인/회원가입, 공지·브리핑·강의·질문·수익인증 게시판, 경제 캘린더 — Gate UID 인증 계정 전용)
public/referral.html    일반/추천인 계정 전용 페이지 (이메일 로그인/회원가입, 코드 발급+대시보드, Gate Read-Only API 연동, 랭킹 참여, 공개 랭킹/실시간 출금 피드 — 비회원도 열람 가능)
public/admin.html       관리자 전용 (게시판 글쓰기/수정/삭제, 스터디룸 회원 비밀번호 재설정, 일반 계정 거래량 설정, 추천인 발급자 현황, 출금 신청 심사, 통계)
```

## 디자인 톤

- 다크 + 뮤트 골드 테마 (2026-09 리뉴얼 — 예전 네온 오렌지/시안 테마에서 변경. 더 어둡고 채도 낮은 톤으로 "투박하다"는 피드백 반영)
- CSS 변수명은 예전 이름 그대로 유지(`--cyan`, `--violet`) — 실제 값만 교체됨. `--cyan`은 뮤트 골드 `#d4a24e`, `--violet`은 딥 브론즈 `#8a6633`. 변수명과 실제 색상이 안 맞는 건 여러 리브랜딩을 거친 흔적이라 헷갈릴 수 있음
- 배경: `--bg:#09090b`, `--bg-soft:#101014`, `--panel:#151519` (거의 완전한 블랙에 가깝게 더 어둡게 조정)
- 폰트: Sora(제목, Space Grotesk에서 교체) + Inter(본문, 그대로) + JetBrains Mono(숫자/UID 등, IBM Plex Mono에서 교체)
- 카드류(req-card, contact-card 등)는 반투명 + backdrop-blur로 글래스모피즘 처리, 버튼 네온 그림자는 대폭 축소
- index.html은 스크롤 시 섹션이 `.reveal` 클래스 + IntersectionObserver로 페이드인되고, 히어로는 로드 시 순차적으로 fadeInUp 애니메이션 적용됨
- 페이지 이동은 실제 별도 파일(index.html, join.html 등)로 구성 — 초반에 해시(#) 기반 SPA로 시도했다가 미리보기 환경 제약으로 실패해서 다시 별도 파일 구조로 되돌림

## 인증 구조 (중요 — 계정이 3종류, 그중 2개는 완전히 분리됨)

**⚠️ 스터디룸 계정과 일반(추천인) 계정은 하나로 합치지 않고 완전히 분리한다** (2026-09-19 4단계 확정 — 3단계에서 시도했던 "계정 하나 + 승인 플래그" 방식은 되돌림). 같은 사람이 스터디룸에 들어가려면 스터디룸 계정을 "하나 더" 만들어야 한다.

**1) 스터디룸 계정 (`users` 테이블, UID+비밀번호, `session` 쿠키)**
- 회원가입: UID + 비밀번호 입력 → 서버가 Gate.io API로 "전용 링크 직속 가입자(type=3)"인지 확인 → 통과해야 계정 생성
- 가입 확인이 곧 입장 조건 — 별도 관리자 승인 절차 없음 (예치 확인은 지금처럼 텔레그램에서 운영자가 개별 처리)
- UID는 `users.uid`에 `UNIQUE` 제약 — 계정당 UID 1개만 허용
- 비밀번호는 PBKDF2-SHA256(100,000회 반복)으로 해시 저장, 세션은 `sessions` 테이블 + `session` 쿠키(httpOnly, 7일)
- 로그인 실패 횟수 제한/잠금 없음
- 게시판(공지/브리핑/강의/질문/수익인증) 전용 — 추천인 코드/랭킹과는 완전히 무관

**2) 일반(추천인) 계정 (`general_members` 테이블, 이메일+비밀번호, `general_session` 쿠키)**
- 회원가입: 이메일 + 비밀번호만으로 가입, Gate UID나 스터디룸 가입 여부와 전혀 무관 — 아무나 가입 가능
- 추천인 코드 발급/사용, 랭킹 참여(선택), Gate.io Read-Only API 연동 전용 — 스터디룸 게시판과는 전혀 연결 안 됨
- `general_members.gate_uid`는 API 연동 시에만 채워지고 `UNIQUE` 제약 (한 UID로 여러 일반 계정에 중복 연동 불가)

**3) 관리자(admin) 인증** — 위 두 회원 인증과 완전히 분리
- `admin.html`에서 로그인, 아이디/비번은 환경변수(`ADMIN_USERNAME`, `ADMIN_PASSWORD`)로 관리 (DB에 관리자 계정 테이블 없음, 1인 운영 가정)
- `portal.html`(스터디룸) 로그인 칸에서도 관리자 계정으로 로그인 가능 — 먼저 스터디룸 로그인(`/api/login`)을 시도하고 실패하면 같은 입력값으로 `/api/admin/login`을 한 번 더 시도해서, 성공하면 `admin.html`로 리다이렉트함
- IP 제한은 도입했다가 제거함 — 운영자 IP가 계속 바뀌어서 적용이 번거로워 아이디/비번 확인만으로 전환
- 세션은 `admin_sessions` 테이블 + `admin_session` 쿠키, 12시간 유지
- 스터디룸 회원 비밀번호 재설정(관리자 대행): admin.html에서 UID로 먼저 "조회"(`/api/admin/find-user`) → 계정 존재 확인되면 "비밀번호 초기화" 버튼 1번 클릭 → 서버가 임시 비밀번호를 자동 생성해서 화면에 보여줌(`/api/admin/reset-password`, newPassword 생략 시 자동 생성) → 운영자가 그 값을 회원에게 텔레그램으로 전달

## Gate.io API 연동

- API 키/시크릿은 절대 코드에 하드코딩하지 않음 — 환경변수(`GATE_API_KEY`, `GATE_API_SECRET`)로만 사용
- 엔드포인트: `GET /rebate/user/sub_relation` (APIv4), 서명 방식은 HMAC-SHA512
- 이 API 키에는 Gate.io 대시보드에서 "Rebate" 권한을 별도로 켜야 함 (처음에 이걸 몰라서 403 에러 겪음)
- 응답의 `type` 필드로 관계 판별: `3` = 직속 레퍼럴(가입 인정), `4` = 간접, `1/2` = 에이전트, `5` = 무관, 그 외 = 미등록
- ⚠️ Gate.io API로는 "가입 여부"만 확인 가능, 예치 금액(잔액)은 API로 조회 불가 (타인 계좌 정보라 비공개) — 그래서 예치 확인은 여전히 스크린샷 수동 검토 방식 유지

## 게시판 구조 (posts / comments 테이블)

- 카테고리 5종: `notice`(공지), `briefing`(코인 브리핑), `lecture`(강의), `question`(질문), `profit`(수익인증)
- `notice`/`lecture`/`briefing`은 관리자만 작성 가능 (`admin.html`에서), `question`/`profit`은 로그인한 회원과 관리자 모두 작성 가능 (`portal.html`/`admin.html` 양쪽에서)
- 댓글(`comments`)은 회원/관리자 모두 작성 가능, 어느 게시글에나 달 수 있음
- 이미지 첨부 가능 — 별도 스토리지(R2) 없이 base64로 인코딩해서 `posts.image_data`에 텍스트로 직접 저장 (간단하지만 대용량 이미지엔 안 맞음, 업로드시 약 1.5MB 제한 걸어둠)
- 게시글 목록(`GET /api/posts`)에는 `posts.thumb_data`도 같이 내려감 — 업로드 시 브라우저에서 canvas로 가로 320px, JPEG 0.6 품질로 축소해서 별도 저장한 작은 미리보기 이미지. 목록 카드에서 썸네일로 바로 보여주기 위한 용도 (`makeThumbnail()` 헬퍼, portal.html/admin.html 양쪽에 있음). 원본은 상세 모달에서 `image_data`로 보여줌. PDF는 썸네일 생성 안 하고(`image/`로 시작 안 하면 null), 상세 모달에서 "PDF 열기" 링크로 표시
- 관리자는 게시글 수정/삭제 가능, 댓글 삭제 가능
- 게시글/댓글 조회 API는 `users` 테이블과 LEFT JOIN해서 `author_nickname`을 같이 내려줌 — 프론트에서 닉네임 있으면 닉네임, 없으면 "UID xxxx"로 표시 (`authorLabel()` 헬퍼, portal.html/admin.html 양쪽에 있음). 닉네임은 `/api/account/nickname`에서 중복 체크함 (앱 레벨 검증, DB 유니크 제약은 아님)
- `portal.html`에 "경제 캘린더" 탭 있음 — investing.com의 공식 무료 iframe 위젯(`sslecal2.investing.com`) 임베드. 게시판 API 연동 아니고 그냥 외부 위젯 삽입이라 서버 코드 없음

## 아직 안 만든 것 / 다음에 할 일

1. **비밀번호 찾기(회원 셀프서비스)**: 지금은 관리자가 admin.html에서 UID로 강제 재설정하는 수동 방식만 있음. 이메일 인증 기반 자동 재설정은 보류 상태 (이메일 발송 인프라 추가 필요, 예: Resend 같은 서비스 연동)
2. **이미지 저장 방식 개선**: base64를 D1에 직접 넣는 방식은 임시방편. 이미지가 많아지면 Cloudflare R2(오브젝트 스토리지)로 옮기는 게 맞음
3. **질문(Q&A)에 대한 관리자 답변 알림**: 지금은 관리자가 admin.html에서 직접 질문 목록을 열어봐야 답변 여부를 알 수 있음. 알림 기능은 없음
4. **회원 탈퇴 기능**: 아직 없음
5. **UID 재확인 주기적 검증**: 가입 시점에만 Gate.io 레퍼럴 확인함. 이후 시드를 빼거나 관계가 끊겨도 코드상 자동 재검증은 안 함 — `requirements.html`에는 "장기간 활동/거래 내역이 없으면 입장이 제한될 수 있다"는 정책 문구를 안내용으로 넣어뒀지만, 실제 제한 처리는 운영자가 수동으로 판단해서 진행해야 함 (자동화된 감지/제재 로직 없음)

## Gate.io API 조사 결과 (2026-09-19, 다음 단계 작업 전 확인해둔 것)

- **가입자 입금 여부/거래량을 UID별로 자동 조회하는 건 공식적으로 확인 안 됨.** `GET /wallet/deposits`는 "내 계좌"용이라 타인(추천인 링크로 가입한 회원)의 입금 내역엔 못 씀. `GET /api/v4/rebate/partner/data/aggregated`라는 실존하는 엔드포인트가 있고 파트너 단위 거래량/리베이트/고객수를 주는 것 같은데, Gate.io가 응답 스키마를 공개 문서화 안 해놔서 **회원별로 쪼개서 나오는지 전체 합산만 나오는지 코드로 확인 전까지는 모름**. 실제 API 키로 테스트할 방법이 없어서(계정 접근 권한 없음) 확정 불가 — 나중에 실제 응답 JSON을 받아서 필드를 보고 붙이는 걸로 이어갈 것.
- 이 조사 결과 때문에 **입금 여부로 가입 자동 차단은 구현 안 함** (기존처럼 스크린샷 수동 검토 유지), **UID별 거래량 랭킹/추천인 자격($100k 거래량) 판별도 API 자동화 대신 관리자가 직접 입력하는 방식으로 시작**하기로 함 (Gate.io 파트너 대시보드에서 확인한 숫자를 admin.html에서 수동 입력 — "API 동기화" 버튼도 시도는 하되 베타로 표시).

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

### 다음에 볼 것
- Gate.io Read-Only 개인 키로 "누적 거래량"을 정확히 뽑아내는 엔드포인트/계산 방식 확정 — 실제 키로 테스트 후 `/api/general/gate-account-raw` 응답 스키마 보고 붙이기
- 그게 되면 거래량 자동 동기화(주기적 배치 또는 로그인 시 갱신)로 업그레이드하고, 지금의 관리자 수동 입력은 폴백으로 남기기
- 스터디룸 계정과 일반 계정이 같은 사람이어도 서버가 서로 연결할 방법이 없음(의도된 설계) — 나중에 "내 스터디룸 UID와 연결" 같은 선택적 연동이 필요해지면 별도 요청으로 진행

## 환경변수 목록 (Cloudflare 대시보드 Settings > Variables and Secrets)

```
GATE_API_KEY            Gate.io API 키
GATE_API_SECRET         Gate.io API 시크릿
ADMIN_USERNAME          관리자 로그인 아이디
ADMIN_PASSWORD          관리자 로그인 비밀번호
TELEGRAM_BOT_TOKEN      (선택) 출금 신청 알림용 텔레그램 봇 토큰 — 없으면 알림만 생략됨
TELEGRAM_ADMIN_CHAT_ID  (선택) 알림 받을 chat_id — 위와 세트로 필요
```

## 대화 중 나온 운영 정책 메모

- 원래 무료 운영이었으나 진지하지 않은 사람이 많아져서 유료(Gate.io 시드 $700 이상)로 전환
- 협력 거래소는 Gate.io 하나만 사용, 반드시 전용 레퍼럴 링크로 신규 가입해야 인정
- 비공개 텔레그램 채널 초대는 운영자가 수동으로 진행 (자동화 안 함 — 예치 스크린샷 확인 후 개별 초대)
- 실시간 코인 브리핑은 텔레그램에서, 공지/강의/질문/수익인증은 웹사이트에서 진행하는 것으로 역할 분리
