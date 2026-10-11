# 텔레그램 → 내 PC 원격작업 가이드

텔레그램 봇에 메시지를 보내면, 내 PC에 켜둔 Claude가 크롬 검색·문서 작성 같은 일을 하고 결과를 텔레그램으로 답장해줘요.

> **새 봇을 하나 만들어서 씁니다.** 사이트 신청 알림이 오는 기존 봇은 그대로 두세요.

## 텔레그램으로 내 PC에 일 시키기 (Windows)

### 제일 헷갈리는 것: 입력하는 곳이 2군데예요

| | 🟦 **PowerShell** | 🟧 **Claude Code** |
|---|---|---|
| 여는 법 | 시작 버튼 → `PowerShell` 검색 → 실행 | PowerShell 창에 `claude` 입력 → 엔터 |
| 생김새 | 줄 맨 앞에 `PS C:\Users\...>` 가 보임 | Claude 로고가 뜨고 아래에 `>` 입력칸이 생김 |
| 입력하는 것 | 프로그램 설치, `claude ...` 실행 명령 | `/` 로 시작하는 명령 (예: `/plugin ...`) |
| 빠져나오기 | 창 닫기 | `/exit` 입력 → 다시 🟦 PowerShell로 돌아감 |

> 같은 검은 창이지만, `claude`를 입력하면 그 창이 🟧 Claude Code로 바뀌고, `/exit`를 입력하면 다시 🟦 PowerShell로 돌아와요.
> **규칙: `/` 로 시작하는 건 전부 🟧 Claude Code, 나머지는 전부 🟦 PowerShell.**

---

### 1단계 – 프로그램 설치 (처음 한 번만)

**① Claude Code 설치** — 🟦 PowerShell에 입력
```
irm https://claude.ai/install.ps1 | iex
```
- 끝나면 PowerShell 창을 **닫고 새로 엽니다.**
- 🟦 PowerShell에 `claude` 입력 → 엔터 → 화면 안내대로 로그인(지금 쓰는 Claude 계정)
- 로그인이 끝나면 `/exit` 입력해서 🟦 PowerShell로 돌아옵니다.
- "Git이 필요하다"는 말이 나오면 https://git-scm.com/download/win 에서 설치하고 다시 해보세요.

**② Bun 설치** — 🟦 PowerShell에 입력
```
powershell -c "irm bun.sh/install.ps1 | iex"
```
- 끝나면 PowerShell 창을 **닫고 새로 엽니다.**

**③ 크롬 확장 설치** — 크롬 브라우저에서
- 크롬 웹스토어에서 "Claude in Chrome" 검색 → 설치 → 같은 Claude 계정으로 로그인

### 2단계 – 새 봇 만들기 — 텔레그램 앱에서

1. **@BotFather** 검색 → 대화 시작
2. `/newbot` 보내기
3. 봇 이름 입력 (아무거나, 예: `내PC비서`)
4. 봇 아이디 입력 (영어, 끝이 `bot`, 예: `sixx_pc_bot`)
5. BotFather가 주는 **토큰**(`1234567:ABC...` 모양)을 메모장에 복사해두기

### 3단계 – 연결하기 (처음 한 번만)

**① 작업 폴더 만들기** — 윈도우 탐색기에서
- 바탕화면에 `claude-work` 폴더를 만들고 들어갑니다.
- 폴더 위쪽 **주소창**을 클릭 → `powershell` 입력 → 엔터 → 이 폴더에서 🟦 PowerShell이 열려요.

**② Claude Code 켜기** — 🟦 PowerShell에 입력
```
claude
```
→ 이제 화면이 🟧 Claude Code로 바뀝니다.

**③ 텔레그램 플러그인 설치** — 🟧 Claude Code에 입력
```
/plugin install telegram@claude-plugins-official
```
- 설치 범위를 물으면 **user** 선택
- "Marketplace not found"가 나오면 아래를 먼저 🟧 Claude Code에 입력하고, 위 줄을 다시 입력
  ```
  /plugin marketplace add anthropics/claude-plugins-official
  ```

**④ 새 봇 토큰 넣기** — 🟧 Claude Code에 입력 (뒤에 2단계 토큰 붙여넣기)
```
/telegram:configure 여기에토큰붙여넣기
```

**⑤ 크롬 연결 켜두기** — 🟧 Claude Code에 입력
```
/chrome
```
→ 나오는 메뉴에서 **Enabled by default** 선택

**⑥ 껐다가 텔레그램 모드로 다시 켜기**
- 🟧 Claude Code에 입력 → 🟦 PowerShell로 돌아감
  ```
  /exit
  ```
- 🟦 PowerShell에 입력 → 다시 🟧 Claude Code가 켜짐(이번엔 텔레그램 연결된 상태)
  ```
  claude --chrome --channels plugin:telegram@claude-plugins-official
  ```

**⑦ 내 텔레그램 계정 연결**
- 텔레그램 앱에서 **새 봇**에게 아무 말이나 보내면 → 봇이 **코드**를 답장해요.
- 🟧 Claude Code에 입력 (받은코드 자리에 코드)
  ```
  /telegram:access pair 받은코드
  ```
- 🟧 Claude Code에 입력 (나 말고 다른 사람 메시지는 무시하게 하는 설정 — 꼭!)
  ```
  /telegram:access policy allowlist
  ```

✅ 끝! 이제 텔레그램에서 새 봇에게 "크롬에서 오늘 비트코인 뉴스 찾아서 요약해줘"처럼 보내면 돼요.

### 다음부터 켜는 법 (더블클릭 한 번)

매번 위 ⑥번 명령을 치기 귀찮으면 실행 파일을 만들어두세요. — 메모장에서
1. 메모장에 아래 3줄을 붙여넣습니다. `내이름`은 내 윈도우 사용자 이름으로 바꾸세요.
   ```
   @echo off
   cd /d C:\Users\내이름\Desktop\claude-work
   claude --chrome --channels plugin:telegram@claude-plugins-official
   ```
2. 다른 이름으로 저장 → 파일 형식 **모든 파일** → 파일 이름 `claude-telegram.bat` → 바탕화면에 저장
3. 앞으로는 이 파일을 더블클릭하면 텔레그램 연결된 🟧 Claude Code가 바로 켜져요.

### 꼭 알아둘 것

- **PC가 켜져 있고 이 창이 열려 있을 때만** 동작해요. 윈도우 설정 → 시스템 → 전원에서 **절전 모드를 "안 함"**으로 바꿔두세요.
- Claude가 "이거 해도 될까요?"라고 물으면 대답할 때까지 멈춰요. 자주 멈추면 🟧 Claude Code 창에서 키보드 `Shift + Tab`을 눌러 **auto 모드**로 바꾸세요.
- 사이트 로그인이나 "로봇이 아닙니다" 확인이 나오면 Claude가 멈추고 직접 해달라고 해요.
