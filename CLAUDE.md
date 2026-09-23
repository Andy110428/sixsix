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
