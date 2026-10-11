# 텔레그램 설정 가이드 (2026-10-11)

봇을 두 개로 나눠서 씁니다.

| 봇 | 용도 | 어디서 돌아가나 |
|---|---|---|
| **기존 봇** (사이트 알림 보내던 봇) | 스터디방 관리: 입장 신청 연결, 승인 버튼, 비활성 멤버 자동 내보내기 | 사이트 서버(Cloudflare) |
| **새 봇** (지금 새로 만듦) | 내 PC 원격작업: 텔레그램으로 보낸 메시지를 내 PC의 Claude가 처리 | 내 PC(Windows) |

> 한 봇의 메시지는 한 곳에서만 받을 수 있어서 반드시 나눠야 합니다. 기존 봇에 웹훅(B-3단계)을 걸면 그 봇으로는 PC 원격작업을 할 수 없습니다.

---

## A. 내 PC 원격작업 (Windows)

텔레그램 → 내 PC에서 켜져 있는 Claude Code → 작업 → 결과를 텔레그램으로 답장하는 구조입니다. **PC가 켜져 있고 Claude Code 창이 열려 있어야만** 동작합니다.

### A-1. 프로그램 설치 (PowerShell에서 한 줄씩)

1. **Claude Code**
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```
   설치 후 PowerShell을 새로 열고 `claude`를 실행해서 claude.ai 계정으로 로그인합니다. Git이 필요하다는 안내가 나오면 [Git for Windows](https://git-scm.com/download/win)를 설치하세요.
2. **Bun** (텔레그램 연동 플러그인이 Bun으로 돌아갑니다)
   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```
   설치 후 PowerShell을 새로 열고 `bun --version`이 나오는지 확인합니다.
3. **Claude in Chrome 확장 프로그램**: [크롬 웹스토어](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)에서 설치하고, Claude Code와 **같은 계정**으로 로그인합니다.

### A-2. 새 봇 만들기

텔레그램에서 [@BotFather](https://t.me/BotFather)에게 `/newbot`을 보내고, 이름과 `bot`으로 끝나는 아이디를 정합니다. BotFather가 주는 **토큰**을 복사해두세요.

### A-3. Claude Code에 텔레그램 연결

작업용 폴더를 하나 만들고(예: `C:\Users\내이름\claude-work`) 그 폴더에서 `claude`를 실행한 뒤, Claude Code 안에서 다음을 입력합니다.

```
/plugin install telegram@claude-plugins-official
```
- `Marketplace "claude-plugins-official" not found`가 나오면 `/plugin marketplace add anthropics/claude-plugins-official`을 먼저 입력하고 다시 설치합니다.
- 설치 범위는 **user scope**를 고르세요.

```
/telegram:configure <A-2에서 받은 토큰>
```

크롬을 기본으로 켜두려면:
```
/chrome
```
→ **Enabled by default** 선택.

### A-4. 실행 + 내 계정 연결(최초 1회)

Claude Code를 종료(`/exit`)하고 아래처럼 다시 실행합니다.

```powershell
claude --chrome --channels plugin:telegram@claude-plugins-official
```

1. 텔레그램에서 새 봇에게 아무 메시지나 보냅니다. 봇이 **페어링 코드**를 답장합니다.
2. Claude Code 창에 입력합니다.
   ```
   /telegram:access pair <코드>
   /telegram:access policy allowlist
   ```
   두 번째 줄은 **내 계정 말고 다른 사람이 보낸 메시지는 전부 무시**하게 만드는 설정이라 꼭 해야 합니다.

### A-5. 매번 편하게 켜기

바탕화면에 `claude-telegram.bat` 파일을 만들고 아래 내용을 넣으면 더블클릭으로 켤 수 있습니다.

```bat
@echo off
cd /d C:\Users\내이름\claude-work
claude --chrome --channels plugin:telegram@claude-plugins-official
```

### A-6. 알아둘 것

- **권한 확인 창**: 자리에 없을 때 Claude가 "이거 해도 될까요?"를 물으면, 답할 때까지 작업이 멈춥니다. 자주 멈추면 Claude Code 창에서 `Shift+Tab`으로 **auto 모드**로 바꿔두세요. 위험한 동작은 auto 모드에서도 계속 막힙니다. `--dangerously-skip-permissions`는 모든 확인을 끄는 옵션이라 추천하지 않습니다.
- **절전 모드**: PC가 절전에 들어가면 메시지를 못 받습니다. 윈도우 설정 → 전원에서 절전을 "안 함"으로 바꾸세요.
- **할 수 있는 일**: 크롬 검색·사이트 조작(로그인된 상태 그대로), 파일·문서 만들기, 프로그램 실행 명령. 마우스로 화면을 클릭해야만 하는 일부 데스크톱 앱 조작은 제한적일 수 있습니다.
- **로그인/캡차**가 나오면 Claude가 멈추고 직접 처리해달라고 합니다.
- 이 기능(Channels)은 아직 **리서치 프리뷰**라서 명령어가 바뀔 수 있습니다. 공식 문서: https://code.claude.com/docs/en/channels

보내는 메시지 예시:
- "크롬에서 비트코인 오늘 뉴스 찾아서 3줄 요약해줘"
- "바탕화면에 오늘 할 일 메모 파일 만들어줘"

---

## B. 스터디방 관리 봇 (기존 봇)

### B-1. 하는 일

1. 사이트에서 UID 확인 → 시드 예치 O → **"텔레그램으로 신청하기"** 버튼을 누르면 봇 대화창이 열리고, 신청자가 **시작**만 누르면 됩니다. 이때 봇이 **텔레그램 숫자 ID(user_id)**와 UID를 자동으로 연결합니다. 숫자 ID는 @아이디를 바꿔도 그대로이고, @아이디가 없는 사람도 신청할 수 있습니다.
2. 운영자에게 **[✅ 승인] [❌ 거절] 버튼**이 달린 알림이 옵니다. 시드 예치는 직접 확인하고 누르세요. 승인하면 봇이 **1명만, 24시간 동안 쓸 수 있는 초대 링크**를 신청자에게 보냅니다. 그 링크를 다른 사람이 쓰면 바로 내보내고 알려드립니다.
3. 15분마다 멤버를 조금씩 돌아가며 검사합니다.
   - UID가 전용 링크 레퍼럴이 아니게 되면 → 내보내기
   - 입장 후 30일이 지났는데 **최근 30일 커미션 기록(=거래)이 0**이면 → 내보내기
   - 23일 동안 거래가 없으면 → "7일 안에 거래 없으면 내보내져요" 경고 DM
   - 내보내기는 영구 차단이 아닙니다. 거래를 다시 시작하고 재신청하면 다시 들어올 수 있습니다.
   - 그룹 관리자는 절대 내보내지 않습니다. Gate.io 조회가 실패하면 그 사람은 건너뜁니다(오류 때문에 내보내지 않음).
4. **자동 내보내기는 처음엔 꺼져 있습니다.** 꺼져 있을 때는 "내보내기 대상" 알림만 옵니다. 며칠 지켜보고 맞으면 `/autokick on`으로 켜세요.

### B-2. 봇을 스터디방 관리자로 넣기

스터디방 → 관리자 추가 → 기존 봇을 넣고, 아래 두 권한을 켭니다.
- **사용자 차단(Ban users)**: 내보내기용
- **링크로 초대(Invite users via link)**: 초대 링크 생성용

### B-3. 웹훅 연결 (Cloudflare + 브라우저)

1. 비밀값을 하나 정합니다. 영문과 숫자만 써서 20자 이상으로 만드세요(예: `sixxHook7f3k29dkq81mz`).
2. Cloudflare 대시보드 → Workers → sixsix → Settings → Variables and Secrets에 추가합니다.
   - `TELEGRAM_WEBHOOK_SECRET` = 방금 정한 비밀값
3. **바로 이어서** 브라우저 주소창에 아래 주소를 넣고 엔터를 누릅니다. `<토큰>`, `<사이트주소>`, `<비밀값>`을 실제 값으로 바꾸세요.
   ```
   https://api.telegram.org/bot<토큰>/setWebhook?url=https://<사이트주소>/api/telegram-webhook&secret_token=<비밀값>&allowed_updates=%5B%22message%22,%22callback_query%22,%22chat_member%22%5D
   ```
   `{"ok":true, ... "Webhook was set"}`가 나오면 성공입니다.
   > 2번(비밀값 저장)을 하는 순간 사이트 신청 버튼이 봇 방식으로 바뀝니다. 3번을 미루면 신청자가 봇에서 시작을 눌러도 아무 반응이 없으니, 2번과 3번은 연달아 하세요.
4. 확인: 봇에게 개인 메시지로 `/start`를 보내면 **관리 명령어 목록**이 와야 합니다. 안내 문구만 오면 `TELEGRAM_ADMIN_CHAT_ID`가 본인 개인 ID가 아닌 겁니다.

### B-4. 스터디방 ID 등록

1. 스터디방 안에서 `/groupid`를 보냅니다(운영자 본인만 가능). 봇이 `-100...`으로 시작하는 숫자를 알려줍니다.
2. Cloudflare에 `TELEGRAM_GROUP_CHAT_ID` = 그 숫자를 추가합니다.

### B-5. 관리 명령어 (봇에게 개인 메시지로)

| 명령 | 설명 |
|---|---|
| `/status` | 현황(승인·대기·내보낸 수, 내보내기 대상 목록) |
| `/autokick on` / `off` | 자동 내보내기 켜기/끄기 |
| `/unlinked` | 사이트 신청 없이 그룹에 있는 사람 목록 |
| `/kick_unlinked confirm` | 그 사람들 내보내기(한 번에 최대 10명) |

### B-6. 기존 멤버 처리

봇은 **예전부터 있던 멤버를 알 수 없습니다.** 텔레그램 봇은 그룹 멤버 전체 목록을 조회할 수 없습니다. 그래서:
1. 공지로 "사이트에서 UID 확인 → 텔레그램으로 신청하기를 한 번 눌러주세요"라고 안내합니다. 이미 방에 있는 사람이 신청하면 승인 버튼만 누르면 되고, 초대 링크는 무시하면 됩니다.
2. 그룹에서 메시지를 쓰거나 새로 들어온 미등록자는 `/unlinked`에 쌓입니다.
3. 충분히 기다린 뒤 `/kick_unlinked confirm`으로 정리합니다.

### B-7. 주의

- "거래 여부"는 Gate.io 커미션 내역 API로 판단합니다. 이 API는 아직 실제 데이터로 완전히 검증되지 않은 베타 기능입니다. 그래서 자동 내보내기를 켜기 전에 꺼진 상태에서 "대상" 알림이 실제 상황과 맞는지 꼭 확인하세요.
- Cloudflare 무료 플랜 제한 때문에 15분마다 5명씩 검사합니다(하루 약 480명). 멤버가 그보다 많아지면 말씀해주세요.
