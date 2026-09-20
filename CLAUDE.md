# TEAM SIXX — 프로젝트 요약 (Claude Code용)

이 문서는 claude.ai에서 진행하던 작업을 Claude Code로 이어받기 위한 요약입니다.
세션 시작 시 이 내용을 참고해서 이어서 작업해주세요.

## 프로젝트 개요

코인 선물 트레이딩 비공개 스터디방 운영을 위한 웹사이트.
- 협력 거래소(Gate.io) 전용 링크로 가입 + 최소 시드 $700 이상 예치한 사람만 스터디방 입장 가능
- 입장 확인은 Gate.io API로 자동화(레퍼럴 관계 확인), 예치 금액은 스크린샷으로 수동 확인 (텔레그램에서 운영자가 개별 확인 후 비공개 채널 초대)
- 텔레그램 비공개 채널(실시간 브리핑)과 웹사이트(공지/강의/질문/수익인증)를 병행 운영
- ⚠️ **계정은 단일 시스템**(2026-09-19 5단계에서 4단계의 계정 분리를 되돌리고 통합). 이메일+비밀번호로 누구나 동일하게 가입하고, 스터디룸 접근(UID 등록)·추천인 파트너 자격(관리자 승인)은 가입 이후 계정 안에서 별도로 얻는 권한. 자세한 내용은 아래 "인증 구조" 참고

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
public/portal.html      스터디룸 (이메일 로그인/회원가입 공통, "내 정보"에서 UID 등록해야 게시판 열람 가능, 공지·브리핑·강의·질문·수익인증 게시판, 직접 입력한 경제 캘린더, 청산맵 링크, 거래량 랭킹 사이드 위젯)
public/referral.html    추천인 파트너 프로그램 페이지 (portal.html과 동일한 계정으로 로그인, 파트너 신청→관리자 승인 후 코드 발급/대시보드, 공개 실시간 출금 피드)
public/admin.html       관리자 전용 (게시판 글쓰기/수정/삭제, 회원 검색/비밀번호 재설정/거래량 설정, 추천인 파트너 신청 승인, 발급자 현황, 출금 심사, 경제 캘린더 관리, 통계)
```

## 디자인 톤

- 다크 + 뮤트 골드 테마 (2026-09 리뉴얼 — 예전 네온 오렌지/시안 테마에서 변경. 더 어둡고 채도 낮은 톤으로 "투박하다"는 피드백 반영)
- CSS 변수명은 예전 이름 그대로 유지(`--cyan`, `--violet`) — 실제 값만 교체됨. `--cyan`은 뮤트 골드 `#d4a24e`, `--violet`은 딥 브론즈 `#8a6633`. 변수명과 실제 색상이 안 맞는 건 여러 리브랜딩을 거친 흔적이라 헷갈릴 수 있음
- 배경: `--bg:#09090b`, `--bg-soft:#101014`, `--panel:#151519` (거의 완전한 블랙에 가깝게 더 어둡게 조정)
- 폰트: Sora(제목, Space Grotesk에서 교체) + Inter(본문, 그대로) + JetBrains Mono(숫자/UID 등, IBM Plex Mono에서 교체)
- 카드류(req-card, contact-card 등)는 반투명 + backdrop-blur로 글래스모피즘 처리, 버튼 네온 그림자는 대폭 축소
- index.html은 스크롤 시 섹션이 `.reveal` 클래스 + IntersectionObserver로 페이드인되고, 히어로는 로드 시 순차적으로 fadeInUp 애니메이션 적용됨
- 페이지 이동은 실제 별도 파일(index.html, join.html 등)로 구성 — 초반에 해시(#) 기반 SPA로 시도했다가 미리보기 환경 제약으로 실패해서 다시 별도 파일 구조로 되돌림

## 인증 구조 (중요 — 계정은 단일 시스템, 권한만 계정 안에서 별도로 획득)

**⚠️ 계정은 하나(`members` 테이블, 이메일+비밀번호)로 통합됨** (2026-09-19 5단계 확정 — 4단계에서 만든 "스터디룸 계정 / 일반 계정 완전 분리" 설계는 사용자가 반려하고 되돌림: "회원가입을 다 똑같이 하는데, 스터디룸이나 일반 회원이나"). 회원가입은 누구나 동일하게 이메일+비밀번호로 하고, 그 계정 안에서 두 가지 권한을 별도로 얻는다:

1. **스터디룸 접근** — "내 정보"에서 Gate UID를 언제든 입력하면, 서버가 그 자리에서 Gate.io API로 "전용 링크 직속 가입자(type=3)"인지 확인 → 통과하면 즉시 스터디룸 접근 가능. 별도 관리자 승인 절차 없음(예치 확인은 지금처럼 텔레그램에서 운영자가 개별 처리). UID는 `members.uid`에 `UNIQUE` 제약 — 계정당 1개, 그리고 한 UID는 한 계정에만 등록 가능.
2. **추천인 파트너 자격** — referral.html에서 "파트너 신청하기"(지갑주소·텔레그램·활동계획·기타사항 제출) → 관리자가 admin.html에서 승인해야 `members.referral_partner_status`가 `approved`로 바뀌고 코드 발급/대시보드 이용 가능. 아래 "5단계" 섹션 참고.

**계정 (`members` 테이블, `session` 쿠키)**
- 회원가입: 이메일 + 비밀번호(8자 이상)만으로 생성, Gate UID나 다른 조건 전혀 없음
- 비밀번호는 PBKDF2-SHA256(100,000회 반복)으로 해시 저장, 세션은 `sessions` 테이블 + `session` 쿠키(httpOnly, 7일)
- 로그인 실패 횟수 제한/잠금 없음
- portal.html과 referral.html은 완전히 같은 계정/세션을 공유 — 한쪽에서 로그인하면 다른 쪽도 로그인 상태

**관리자(admin) 인증** — 회원 인증과 완전히 분리
- `admin.html`에서 로그인, 아이디/비번은 환경변수(`ADMIN_USERNAME`, `ADMIN_PASSWORD`)로 관리 (DB에 관리자 계정 테이블 없음, 1인 운영 가정)
- `portal.html`(스터디룸) 로그인 칸에서도 관리자 계정으로 로그인 가능 — 먼저 회원 로그인(`/api/login`)을 시도하고 실패하면 같은 입력값으로 `/api/admin/login`을 한 번 더 시도해서, 성공하면 `admin.html`로 리다이렉트함
- IP 제한은 도입했다가 제거함 — 운영자 IP가 계속 바뀌어서 적용이 번거로워 아이디/비번 확인만으로 전환
- 세션은 `admin_sessions` 테이블 + `admin_session` 쿠키, 12시간 유지
- 회원 비밀번호 재설정(관리자 대행): admin.html "회원 관리"에서 이메일 또는 UID로 먼저 "조회"(`/api/admin/find-member`) → 계정 존재 확인되면 "비밀번호 초기화" 버튼 1번 클릭 → 서버가 임시 비밀번호를 자동 생성해서 화면에 보여줌(`/api/admin/reset-password`, 이메일 기준, newPassword 생략 시 자동 생성) → 운영자가 그 값을 회원에게 텔레그램으로 전달

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
- 게시글/댓글 조회 API는 `members` 테이블과 `members.uid = posts.author_id`로 LEFT JOIN해서 `author_nickname`을 같이 내려줌 — 프론트에서 닉네임 있으면 닉네임, 없으면 "UID xxxx"로 표시 (`authorLabel()` 헬퍼, portal.html/admin.html 양쪽에 있음). 닉네임은 `/api/account/nickname`에서 중복 체크함 (앱 레벨 검증, DB 유니크 제약은 아님)
- ⚠️ `portal.html`의 "경제 캘린더" 탭은 5단계에서 investing.com iframe 위젯을 뺐음 — 지금은 `economic_events` 테이블에 관리자가 직접 입력한 일정을 `GET /api/economic-events`로 가져와서 별 개수(중요도)와 함께 목록으로 보여줌. 아래 5단계 섹션 참고

## 아직 안 만든 것 / 다음에 할 일

1. **비밀번호 찾기(회원 셀프서비스)**: 지금은 관리자가 admin.html에서 UID로 강제 재설정하는 수동 방식만 있음. 이메일 인증 기반 자동 재설정은 보류 상태 (이메일 발송 인프라 추가 필요, 예: Resend 같은 서비스 연동)
2. **이미지 저장 방식 개선**: base64를 D1에 직접 넣는 방식은 임시방편. 이미지가 많아지면 Cloudflare R2(오브젝트 스토리지)로 옮기는 게 맞음
3. ~~**질문(Q&A)에 대한 관리자 답변 알림**~~ — **2026-09-19에 구현 완료.** 질문 게시판 카드마다 `has_admin_reply`(댓글에 `author_type='admin'`이 있는지, `handleListPosts`의 상관 서브쿼리) 기준으로 "✅ 답변완료"/"⏳ 답변대기" 배지 표시. 로그인한 회원 전용으로 `GET /api/account/my-questions`(내가 쓴 질문 중 답변 달린 개수)를 "질문" 탭에서 확인해서, 마지막으로 본 개수(브라우저 `localStorage`의 `qa_seen_count`, 서버 저장 아님)보다 늘었으면 탭에 빨간 배지로 표시. 질문 탭 클릭 시 `markQaSeen()`이 현재 개수로 갱신하고 배지 숨김. 텔레그램 알림까지는 아니고 사이트 내 알림.
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
