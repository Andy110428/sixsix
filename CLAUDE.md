# TEAM SIXX — 프로젝트 요약 (Claude Code용)

이 문서는 claude.ai에서 진행하던 작업을 Claude Code로 이어받기 위한 요약입니다.
세션 시작 시 이 내용을 참고해서 이어서 작업해주세요.

## 프로젝트 개요

코인 선물 트레이딩 비공개 스터디방 운영을 위한 웹사이트.
- 협력 거래소(Gate.io) 전용 링크로 가입 + 최소 시드 $700 이상 예치한 사람만 스터디방 입장 가능
- 입장 확인은 Gate.io API로 자동화(레퍼럴 관계 확인), 예치 금액은 스크린샷으로 수동 확인
- 텔레그램 비공개 채널(실시간 브리핑)과 웹사이트(공지/강의/질문/수익인증)를 병행 운영

## 배포 환경

- **호스팅**: Cloudflare Workers (Workers + Static Assets 통합 방식, "Pages" 아님)
- **배포 방식**: GitHub 저장소(`Andy110428/sixsix`)를 Cloudflare에 Git 연동 → 커밋하면 자동 재배포
- **Deploy 명령어**: `npx wrangler deploy` (wrangler.jsonc 기반)
- **DB**: Cloudflare D1 (SQLite), 바인딩 이름 `DB`, database_name `sixsix-db`
- ⚠️ 드래그앤드롭 방식 "Upload assets"로는 `functions`/서버 코드가 인식 안 됨 — 반드시 Git 연동 + wrangler.jsonc 방식 유지할 것

## 파일 구조

```
wrangler.jsonc          Workers 설정 (assets + D1 바인딩)
schema.sql / schema-console.sql   D1 스키마 (console.sql은 주석 없는 버전, 콘솔 붙여넣기용)
migration-add-image.sql D1 마이그레이션 (posts.image_data 컬럼 추가)
src/worker.js           서버 코드 전체 (라우팅 + API)
public/index.html       메인 랜딩페이지
public/requirements.html  입장 조건 상세
public/join.html        입장 절차 3단계 + UID 사전 확인 모달
public/portal.html      스터디룸 (회원 로그인/회원가입, 공지·강의·질문·수익인증 게시판)
public/admin.html       관리자 전용 (IP 제한, 글쓰기/수정/삭제, 회원 비밀번호 재설정, 통계)
```

## 디자인 톤

- 블랙 + 오렌지 테마 (모던, 깔끔, 네온 느낌 최소화 방향으로 정리)
- CSS 변수명은 `--cyan`(실제 값은 오렌지 `#ff7a29`), `--violet`(실제 값은 번트오렌지 `#c2540f`)로 되어 있음 — 이름은 예전 시안/보라 테마의 흔적이라 헷갈릴 수 있음, 실제 색상은 오렌지 계열
- 폰트: Space Grotesk(제목) + Inter(본문) + IBM Plex Mono(숫자/UID 등)
- 페이지 이동은 실제 별도 파일(index.html, join.html 등)로 구성 — 초반에 해시(#) 기반 SPA로 시도했다가 미리보기 환경 제약으로 실패해서 다시 별도 파일 구조로 되돌림

## 인증 구조 (중요)

**회원(member) 인증**
- 회원가입: UID + 비밀번호 입력 → 서버가 Gate.io API로 "전용 링크 직속 가입자(type=3)"인지 확인 → 통과해야 계정 생성
- UID는 `users.uid`에 `UNIQUE` 제약 — 계정당 UID 1개만 허용
- 비밀번호는 PBKDF2-SHA256(100,000회 반복)으로 해시 저장
- 로그인 성공 시 세션 토큰을 `sessions` 테이블에 저장하고 httpOnly 쿠키(`session`)로 발급, 7일 유지
- 로그인 실패 5회 시 15분 잠금 (`login_attempts` 테이블)

**관리자(admin) 인증** — 회원 인증과 완전히 분리
- `admin.html`에서만 로그인, 아이디/비번은 환경변수(`ADMIN_USERNAME`, `ADMIN_PASSWORD`)로 관리 (DB에 관리자 계정 테이블 없음, 1인 운영 가정)
- 로그인 시도 자체를 `ADMIN_ALLOWED_IPS` 환경변수의 IP 목록으로 먼저 검증 — 목록에 없는 IP는 아이디/비번 확인도 안 하고 403
- 세션은 `admin_sessions` 테이블 + `admin_session` 쿠키, 12시간 유지

## Gate.io API 연동

- API 키/시크릿은 절대 코드에 하드코딩하지 않음 — 환경변수(`GATE_API_KEY`, `GATE_API_SECRET`)로만 사용
- 엔드포인트: `GET /rebate/user/sub_relation` (APIv4), 서명 방식은 HMAC-SHA512
- 이 API 키에는 Gate.io 대시보드에서 "Rebate" 권한을 별도로 켜야 함 (처음에 이걸 몰라서 403 에러 겪음)
- 응답의 `type` 필드로 관계 판별: `3` = 직속 레퍼럴(가입 인정), `4` = 간접, `1/2` = 에이전트, `5` = 무관, 그 외 = 미등록
- ⚠️ Gate.io API로는 "가입 여부"만 확인 가능, 예치 금액(잔액)은 API로 조회 불가 (타인 계좌 정보라 비공개) — 그래서 예치 확인은 여전히 스크린샷 수동 검토 방식 유지

## 게시판 구조 (posts / comments 테이블)

- 카테고리 4종: `notice`(공지), `lecture`(강의), `question`(질문), `profit`(수익인증)
- `notice`/`lecture`/`profit`은 관리자만 작성 가능 (`admin.html`에서), `question`은 로그인한 회원 누구나 작성 가능 (`portal.html`에서)
- 댓글(`comments`)은 회원/관리자 모두 작성 가능, 어느 게시글에나 달 수 있음
- `profit`(수익인증)에는 이미지 첨부 가능 — 별도 스토리지(R2) 없이 base64로 인코딩해서 `posts.image_data`에 텍스트로 직접 저장 (간단하지만 대용량 이미지엔 안 맞음, 업로드시 약 1.5MB 제한 걸어둠)
- 관리자는 게시글 수정/삭제 가능, 댓글 삭제 가능

## 아직 안 만든 것 / 다음에 할 일

1. **비밀번호 찾기(회원 셀프서비스)**: 지금은 관리자가 admin.html에서 UID로 강제 재설정하는 수동 방식만 있음. 이메일 인증 기반 자동 재설정은 보류 상태 (이메일 발송 인프라 추가 필요, 예: Resend 같은 서비스 연동)
2. **이미지 저장 방식 개선**: base64를 D1에 직접 넣는 방식은 임시방편. 이미지가 많아지면 Cloudflare R2(오브젝트 스토리지)로 옮기는 게 맞음
3. **질문(Q&A)에 대한 관리자 답변 알림**: 지금은 관리자가 admin.html에서 직접 질문 목록을 열어봐야 답변 여부를 알 수 있음. 알림 기능은 없음
4. **회원 탈퇴 기능**: 아직 없음
5. **UID 재확인 주기적 검증**: 가입 시점에만 Gate.io 레퍼럴 확인함. 이후 시드를 빼거나 관계가 끊겨도 재검증 안 함

## 환경변수 목록 (Cloudflare 대시보드 Settings > Variables and Secrets)

```
GATE_API_KEY          Gate.io API 키
GATE_API_SECRET        Gate.io API 시크릿
ADMIN_USERNAME         관리자 로그인 아이디
ADMIN_PASSWORD         관리자 로그인 비밀번호
ADMIN_ALLOWED_IPS       관리자 접속 허용 IP (콤마 구분, 비워두면 제한 없음)
```

## 대화 중 나온 운영 정책 메모

- 원래 무료 운영이었으나 진지하지 않은 사람이 많아져서 유료(Gate.io 시드 $700 이상)로 전환
- 협력 거래소는 Gate.io 하나만 사용, 반드시 전용 레퍼럴 링크로 신규 가입해야 인정
- 비공개 텔레그램 채널 초대는 운영자가 수동으로 진행 (자동화 안 함 — 예치 스크린샷 확인 후 개별 초대)
- 실시간 코인 브리핑은 텔레그램에서, 공지/강의/질문/수익인증은 웹사이트에서 진행하는 것으로 역할 분리
