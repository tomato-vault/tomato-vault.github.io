---
layout: page
title: "심화 | 병렬 워크트리 오케스트레이션과 저장소·규칙 거버넌스"
description: "cmux 기반 1:1:1:1 병렬 워크트리 격리와 spoke-guard·Teardown 6단계 프로토콜, 에이전트 기억상실증을 막는 저장소 SSOT 문서 계층, 그리고 64개 규칙 구조조정(Rule Pruning) 상세 레퍼런스"
permalink: /tag-ai-agent-architecture/deep-dive/worktree-and-repo-governance/
deep_dive_for: ai-agent-architecture
related_main_orders: [5, 6, 7]
published: true
---

- table of contents
{:toc}

본 문서는 **1인 개발자의 프로덕션 엔지니어링 운영체계** 시리즈의 [[5편]](/tag-ai-agent-architecture/5-cmux-parallel-worktree/), [[6편]](/tag-ai-agent-architecture/6-repo-governance/), [[7편]](/tag-ai-agent-architecture/7-rule-pruning/) 본문에서 분량 관계상 생략하거나 요약한 상세 쉘 스크립트, 브리핑 및 저장소 문서 템플릿, `spoke-guard` 하드 바운더리 훅, Teardown 6단계 회수 프로토콜, 그리고 64개 규칙 전수 구조조정(Rule Pruning) 분류표를 수록한 심화 레퍼런스다.

---

## cmux 1:1:1:1 병렬 워크트리 격리와 spoke-guard·Teardown 6단계 프로토콜 {#cmux-worktree-orchestration}

### cmux 3계층 매핑과 WorktreeCreate 초기화 스크립트

<mark class="kw-isolation">cmux</mark> 환경에서 `1 슬라이스 = 1 브랜치 = 1 워크트리 = 1 에이전트 세션`의 **1:1:1:1 격리 원칙**을 유지하기 위해, 각 레이어는 다음과 같이 매핑한다.

| 레이어 | 정체 | 단축키 | 매핑 대상 |
| :--- | :--- | :--- | :--- |
| **Workspace** | 사이드바 최상위 단위 (브랜치·PR·포트·알림 표시) | `Cmd+N` | 작업 트랙 하나 = 워크트리 하나 = 브랜치 하나 |
| **Tab (Surface)** | 워크스페이스 내부 탭 화면 | `Cmd+T` | 한 트랙 안의 보조 도구 (에이전트, DB 뷰어, 서버 로그) |
| **Split Pane** | 탭 안의 독립 분할 셸 화면 | `Cmd+D` | 좌측: Claude 에이전트 / 우측: 실시간 테스트·로그 관찰 |

새 워크트리를 생성할 때는 `.claude/hooks/worktree-from-dev.sh` 스크립트를 통해 세 가지 초기화 과제를 자동 처리한다. 첫째, 항상 최신 `origin/dev`를 베이스로 분기한다. 둘째, 모던 프론트엔드의 거대한 `node_modules`는 macOS `APFS`의 Copy-on-Write(`cp -c`) 클론으로 1초 만에 물리 용량 추가 없이 복제하되, Python 가상환경(`backend/.venv`)은 경로 오염을 막기 위해 심링크하지 않는다. 셋째, `git worktree`가 복사해 주지 않는 `.gitignore` 대상 시드 파일(`.env` 및 관리 문서 4종)을 메인 워크스페이스에서 새 워크트리 루트로 단 1회 복사한다.

```bash
#!/usr/bin/env bash
set -euo pipefail

SLICE_ID="${1:?Usage: worktree-from-dev.sh <slice-id>}"
MAIN_REPO="$(git rev-parse --show-toplevel)"
WT_DIR="${MAIN_REPO}/../worktrees/${SLICE_ID}"
BRANCH_NAME="feat/${SLICE_ID}"

git fetch origin dev
git worktree add -b "${BRANCH_NAME}" "${WT_DIR}" origin/dev

if [ -d "${MAIN_REPO}/frontend/node_modules" ]; then
  cp -Rc "${MAIN_REPO}/frontend/node_modules" "${WT_DIR}/frontend/node_modules"
fi

for seed_file in ".env" "WORKLOG.md" "docs/deferred-watchlist.md" "docs/tech-debt.md"; do
  if [ -f "${MAIN_REPO}/${seed_file}" ]; then
    mkdir -p "$(dirname "${WT_DIR}/${seed_file}")"
    cp "${MAIN_REPO}/${seed_file}" "${WT_DIR}/${seed_file}"
  fi
done
```

### 무인 스포크 발주 브리핑 5종과 선제 Do & Don't 템플릿

격리된 스포크는 자기 워크트리 밖을 볼 수 없으므로, 허브가 스포크를 가동하기 전에 아래 5가지 브리핑 명세를 확정해 주입한다. 특히 무인 스포크가 `AskUserQuestion`을 띄워 병렬 파이프라인을 멈춰 세우는 일을 방지하기 위해 선제적인 **Do & Don't 명세표**를 함께 제공한다.

| 필수 전달 정보 | 누락 시 발생한 실제 사고 | 해결 규약 |
| :--- | :--- | :--- |
| **전 슬라이스 파일 소유권 지도** | 스포크 C와 D가 공통 타입 정의 파일(`types.ts`)을 각자 만들어 `CONFLICT (add/add)` 충돌 발생 | 브리핑에 수정 허용 경로와 타 스포크 점유 경로를 모두 명시하고 외부 파일 수정 금지 |
| **베이스라인 스냅샷 (Baseline)** | 기존 린트 경고 1건을 자기 탓으로 여겨 남의 코드를 건드리거나 완료 기준(DoD)을 거짓 보고함 | 스폰 직전 허브가 측정한 기존 실패·경고 목록과 기준 커밋 SHA를 명시 |
| **작업 고유 ID 선점** | 병렬 스포크들이 각자 다음 번호(`F4`)를 집어가 커밋 메시지와 관리 문서 번호가 충돌함 | 허브가 스폰 전에 `B=F4, C=F5, D=F6`처럼 고유 순번을 사전 할당 |
| **환경 준비 상태** | 패키지 설치 여부를 몰라 첫 테스트가 `ModuleNotFoundError`로 실패하며 원인 분석에 토큰 낭비 | DB 마이그레이션 리비전, 테스트 포트, 패키지 준비 상태를 명시 |
| **선제 Do & Don't 명세표** | 공유 라우터 파일(`__init__.py`) 주변 임포트를 '하는 김에 정리'해 머지 충돌 폭증 | 공유 파일은 등록 코드 한 줄만 추가하고 주변 포맷팅·리팩터링 절대 금지 |

```markdown
### Spoke Briefing: TASK-260913-ATTENDANCE-01 (F112)

> AskUserQuestion 절대 금지. 모든 결정은 본 브리핑에 확정되어 있다.
> 모호한 세부 사항은 합리적인 기본값으로 구현한 뒤 커밋 메시지에 근거를 한 줄 명시하라.

- 작업 고유 ID: F112 (TASK-260913-ATTENDANCE-01)
- 파일 소유권 목록 (File Ownership):
  - 허용: backend/app/services/attendance_service.py, backend/app/api/routers/attendance.py, frontend/src/features/attendance-checkin/
  - 공유 등록부(1줄 추가만 허용): backend/app/api/routers/__init__.py
  - 타 스포크 점유(접근 금지): frontend/src/features/schedule-calendar/ (F113 작업 중)
- 테스트 베이스라인 스냅샷:
  - 기준 커밋: origin/dev (a81c4f92)
  - 기존 경고: frontend lint warning 1건 (legacy chart 컴포넌트, 본 슬라이스와 무관)
  - 테스트 실행 범위: pytest -n 0 tests/unit/attendance tests/integration/attendance (전체 스위트 실행 금지)
- 환경 준비 상태:
  - DB 마이그레이션 head 정합 확인 완료, 테스트 DB 포트 5433 가동 중
- 선제 Do & Don't 명세표:
  - Do (반드시 구현할 것):
    - FE 마운트 시 기본 쿼리 파라미터와 BE 스키마 기본값 1:1 정합 (422 원천 차단)
    - TDD 사이클(/tdd-plan -> /go) 준수 및 완료 후 워크트리 루트에 SPOKE_DONE 생성
  - Don't (절대 하지 말 것):
    - 스코프 밖 외부 라이브러리 추가 금지
    - 공유 라우터 등록부의 기존 import 순서 변경 및 주변 리팩터링 금지
    - 작업 완료 후 에이전트 세션 자체 종료(exit) 금지 (허브 인수 대기)
```

### spoke-guard.sh 하드 바운더리 훅 구현과 차단 메커니즘

자연어 지침(`CLAUDE.md`)만으로는 에이전트가 *"사소한 수정이라 허브에서 바로 고치겠습니다"*라며 메인 브랜치를 오염시키는 일탈을 막을 수 없다. 이를 물리적으로 차단하기 위해 `Edit`, `Write`, `NotebookEdit` 도구가 호출되는 직전에 개입하는 `PreToolUse` 훅인 `spoke-guard.sh`를 구성했다.

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
TARGET_FILE="${CLAUDE_TARGET_FILE:-}"

if [[ "${CURRENT_BRANCH}" != "dev" && "${CURRENT_BRANCH}" != "main" ]]; then
  exit 0
fi

if [[ "${TOOL_NAME}" != "Edit" && "${TOOL_NAME}" != "Write" && "${TOOL_NAME}" != "NotebookEdit" ]]; then
  exit 0
fi

if [[ -f "${REPO_ROOT}/.claude/ALLOW_INLINE" ]]; then
  exit 0
fi

if [[ "${TARGET_FILE}" == *"backend/migrations/versions/"* ]]; then
  echo "[SPOKE-GUARD BLOCKED] 신호 A: 마이그레이션 파일은 허브에서 직접 수정할 수 없습니다. /spoke 워크트리로 격리하세요." >&2
  exit 2
fi

STATE_FILE="/tmp/claude_hub_edits_$(echo "${REPO_ROOT}" | shasum | cut -d' ' -f1).log"
touch "${STATE_FILE}"
echo "${TARGET_FILE}" >> "${STATE_FILE}"

HAS_BE=$(grep -c "^backend/app/" "${STATE_FILE}" || true)
HAS_FE=$(grep -c "^frontend/src/" "${STATE_FILE}" || true)
if [[ "${HAS_BE}" -gt 0 && "${HAS_FE}" -gt 0 ]]; then
  echo "[SPOKE-GUARD BLOCKED] 신호 B: 백엔드와 프론트엔드 크로스스택 동시 수정은 허브에서 금지됩니다. /spoke 스킬을 사용하세요." >&2
  exit 2
fi

UNIQUE_COUNT=$(sort -u "${STATE_FILE}" | wc -l | tr -d ' ')
if [[ "${UNIQUE_COUNT}" -gt 6 ]]; then
  echo "[SPOKE-GUARD BLOCKED] 신호 C: 단일 세션 누적 수정 파일이 6개를 초과했습니다. /spoke 워크트리로 격리하세요." >&2
  exit 2
fi

exit 0
```

### Liveness vs Completion 분리 관측과 터미널 화면의 5대 함정

에이전트의 자기보고 텍스트를 신뢰하지 않기 위해, 백그라운드 감시 루프는 **진행 여부(Liveness)**와 **실제 완료(Completion)**를 분리하여 판정한다.

- **Liveness (화면 전체 해시 diff)**: 상태바의 디렉터리 잔상이나 스피너 문자를 `grep`하는 대신, `cmux read-screen` 출력 전체의 `SHA` 해시를 이전 폴링 주기와 비교한다. 4~6회 폴링(약 2~3분) 동안 해시값이 변하지 않으면 비정상 정지(`STALL`)로 판정한다.
- **Completion (3중 하드 신호 교차 검증)**:
  1. 워크트리 루트에 `SPOKE_DONE` 센티넬 파일이 존재하는가?
  2. 베이스 브랜치 대비 실제 Git 커밋이 1개 이상 누적되었는가? (`git rev-list --count origin/dev..HEAD >= 1`)
  3. 테스트 러너 프로세스의 종료 코드가 정확히 `0`인가?

| 센티넬 파일 | 커밋 누적 (`origin/dev..HEAD`) | 최종 판정 | 허브 조치 |
| :--- | :--- | :--- | :--- |
| 없음 | 0개 | `working` | 정상 작업 진행 중 (대기) |
| 없음 | N개 이상 | `committed:N` | 중간 커밋 후 후속 작업 진행 중 |
| `SPOKE_DONE` | 1개 이상 | `DONE` | 정상 완료 (허브 Teardown 6단계 착수) |
| `SPOKE_DONE` | 0개 | `FALSE_REPORT` | 거짓 완료 보고 적발 (재작업 지시) |
| `SPOKE_BLOCKED` | 무관 | `BLOCKED` | 외부 환경 결함·모순 발생 (인간 개입) |

또한 실전에서 터미널 화면을 다룰 때 겪었던 5가지 함정과 방어 규약은 다음과 같다.
1. **착수 확인 필수**: `cmux send`가 `OK`를 반환해도 장문 브리핑 렌더링 지연으로 마지막 `Enter` 입력이 유실될 수 있으므로, 첫 도구 호출 흔적이 화면에 찍히는 것을 반드시 확인한다.
2. **작업 경로(`cwd`) 대조**: 워크트리 생성 스크립트 실패 시 직전 디렉터리로 폴백(Fallback)하여 엉뚱한 저장소를 수정하는 사고를 막기 위해 하단 경로를 대조한다.
3. **주석 `grep` 금지**: 레거시 함수 제거 여부를 코드베이스 단순 `grep`으로 검사하면 안내 주석에 걸려 거짓 경보가 울리므로, 반드시 테스트와 린터 종료 코드로만 판정한다.
4. **고스트 텍스트 오독 방지**: 프롬프트 줄에 보이는 회색 자동완성 추천 문구를 사용자의 새 지시로 오인하지 않는다.
5. **macOS 기본 `Bash 3.2` 호환성**: 연관 배열(`declare -A`)은 구버전 기본 bash에서 조용히 크래시를 일으키므로 감시 스크립트는 단순 단일 변수 구조로 작성한다.

### 워크트리 Teardown 6단계 회수 프로토콜 상세

`git worktree remove --force` 실행 시 `.gitignore` 대상인 관리 문서(`WORKLOG.md`, `deferred-watchlist.md`, `tech-debt.md`)가 영구 증발하거나 단순 `cp`로 인해 타 스포크의 기록을 덮어쓰는 참사를 막기 위해, 워크트리 회수는 아래 6단계 명령 절차를 엄격히 따른다.

1. **1단계 (스포크 자체 커밋 및 대기)**: 스포크가 슬라이스 테스트 통과 후 직접 커밋하고 `SPOKE_DONE`을 생성하되, 세션을 종료(`exit`)하지 않고 대기한다.
2. **2단계 (허브의 사전 회수 및 append 병합)**: 워크트리 삭제 전 `cmux read-screen`으로 최종 보고를 회수하고, `.gitignore` 관리 문서의 추가분만 추출해 메인 문서에 `append`한다.
   ```bash
   diff -u WORKLOG.md "${WT_DIR}/WORKLOG.md" | grep '^+[^+]' | sed 's/^+//' >> WORKLOG.md
   diff -u docs/deferred-watchlist.md "${WT_DIR}/docs/deferred-watchlist.md" | grep '^+[^+]' | sed 's/^+//' >> docs/deferred-watchlist.md
   ```
3. **3단계 (머지 전 워크트리 검증 및 UI 스팟체크)**: 워크트리 내부에서 통합 게이트를 실행하고, UI 변경이 포함된 경우 개발 서버를 띄워 디자인 시스템 이질감(예: `window.confirm` 노출 등)을 육안 점검한다.
4. **4단계 (살아있는 스포크에 즉각 수정 지시)**: 결함 발견 시 컨텍스트를 유지하고 있는 스포크 세션에 `cmux send`로 피드백을 보내 즉시 `fixup` 커밋을 받아낸다.
5. **5단계 (머지 및 마이그레이션 선형 정렬)**: 본체 브랜치로 `--no-ff` 머지 후, 병렬 생성된 Alembic 마이그레이션 리비전들의 다중 헤드(Multiple heads)를 `align_migrations` 스크립트로 단일 선형 체인으로 재정렬한다.
6. **6단계 (최종 게이트 통과 후 Teardown)**: 통합 브랜치에서 전체 회귀 테스트 통과 및 `git push` 완료를 확인한 직후에야 물리적 워크트리와 `cmux` 워크스페이스를 닫는다.
   ```bash
   git worktree remove --force "${WT_DIR}"
   git branch -d "${BRANCH_NAME}"
   cmux workspace close "${SLICE_ID}"
   ```

- [5편 본문으로 돌아가기](/tag-ai-agent-architecture/5-cmux-parallel-worktree/)

---

## 에이전트 기억상실증을 해결하는 저장소 SSOT 문서 계층과 기능 수명주기 {#repo-ssot-hierarchy}

### 저장소 정본 문서(`docs/`) 전체 디렉토리 구조

세션 종료와 함께 모든 맥락을 잊어버리는 `Stateless` 에이전트가 단 10초 만에 프로젝트의 구조, 결정 근거, 기술 부채, 미착수 과제를 복원할 수 있도록 구성한 저장소 정본(`SSOT`) 디렉터리 계층은 다음과 같다.

```text
repo-root/
├── AGENTS.md                        # 에이전트 헌법 (착수 순서, 정본 경로, 금지·강제 규칙)
├── CLAUDE.md                        # AGENTS.md를 로드하는 얇은 런타임 어댑터
├── WORKLOG.md                       # 당월 활성 작업 이력 및 검증 증거 대장
├── .ontology/                       # 기계 가독형 도메인 온톨로지 정본 (repo-ontology)
│   ├── objects/                     # 도메인 엔티티 및 소스코드 Model/Schema 바인딩
│   ├── actions/                     # 상태 전이 트랜잭션, 사전 불변식(preconditions)
│   └── rules/                       # 멀티테넌시 격리 등 전역 비즈니스 규칙
└── docs/
    ├── deferred-watchlist.md        # 미착수·보류(Blocker)·스코프 밖(Out of Moat) 단일 정본
    ├── tech-debt.md                 # 기술 부채 4분면 분류 및 상환 트리거 대장
    ├── worklog/
    │   └── 2026-08.md               # 월별 아카이빙된 과거 작업 대장 (컨텍스트 비대화 방지)
    ├── adr/
    │   ├── 0001-record-architecture-decisions.md
    │   └── 0017-save-time-hitl-tagging.md  # Nygard 5부 형식의 아키텍처 결정 기록 (append-only)
    ├── architecture/                # arc42 + C4 Model 기반 정적 아키텍처 설계서
    │   ├── 01-introduction-and-goals.md
    │   ├── 03-context-and-scope.md  # C4 Level 1 System Context 포함
    │   ├── 05-building-block-view.md # C4 Level 2~3 Container/Component 포함
    │   ├── 07-deployment-view.md
    │   └── 09-architecture-decisions.md
    ├── design/                      # /design 스킬로 생성·관리하는 3대 상세 설계서
    │   ├── database-design.md       # ERD, 테이블 스키마, 인덱스 전략, 마이그레이션 정책
    │   └── program-design.md        # 모듈 경계, 인터페이스 계약, API 스펙 정의
    └── features/                    # 도메인별 기능 명세서 (이후 .ontology/로 흡수 통합)
        ├── index.md                 # 118개 전체 기능 구현 현황 및 복잡도 색인표
        ├── _template.md             # 기능 명세 표준 마크다운 템플릿
        ├── student/                 # 학습자 도메인 기능 명세 (27종)
        ├── admin/                   # 관리자 도메인 기능 명세 (18종)
        └── notifications/           # 알림·메시징 도메인 기능 명세
```

### 아키텍처·DB·프로그램 설계서 및 관리 문서 4종 표준 템플릿

저장소 내부의 각 문서는 서술 범위가 겹치지 않도록 엄격한 템플릿 규격을 따른다.

#### 설계 문서 3종 (`Architecture`, `Database`, `Program`) 핵심 구성

| 설계서 종류 | 호출 명령 | 정본 경로 | 필수 수록 섹션 및 역할 |
| :--- | :--- | :--- | :--- |
| **Architecture** | `/design architecture` | `docs/architecture/` | `arc42` 핵심 섹션(요구사항·품질 목표, 시스템 컨텍스트 경계, 빌딩 블록 뷰, 배포 뷰) + `C4 Model` 다이어그램 |
| **Database** | `/design database` | `docs/design/database-design.md` | 개념/논리/물리 ERD, 테이블·컬럼 제약조건, 복합 인덱스 설계 근거, 무중단 마이그레이션 및 파티셔닝 전략 |
| **Program** | `/design program` | `docs/design/program-design.md` | Clean Architecture 계층별 모듈 구조(`Entity -> UseCase -> Service -> Router`), 입출력 DTO 스키마, 에러 코드 계약 |

#### 의사결정 기록 (`docs/adr/NNNN-title.md`) 템플릿

```markdown
## ADR-0016: 문항 이미지 에셋 서빙 및 서명된 URL 캐시 전략

- Status: accepted (2026-08-02)
- Context:
  모바일 및 웹 클라이언트에서 대량의 문항 이미지를 렌더링할 때 보안(무단 크롤링 방지)과
  캐시 효율성(동일 시험지 재조회 시 지연 최소화)이 동시에 요구된다.
- Decision:
  우리는 S3 원본 버킷을 비공개로 유지하되, CloudFront Signed Cookie를 세션 단위로 발급하여
  클라이언트 브라우저 캐시 적중률을 유지하면서 테넌트별 접근 통제를 수행한다.
- Consequences:
  - 긍정적 결과: 개별 이미지마다 Presigned URL을 생성하는 백엔드 연산 오버헤드가 제거되고 브라우저 캐시가 작동한다.
  - 감수할 비용: 쿠키 만료 주기와 학습 세션 갱신 주기를 동기화하는 미들웨어 로직이 추가된다.
```

#### 보류 대장 (`docs/deferred-watchlist.md`) 및 기술 부채 (`docs/tech-debt.md`) 엔트리 규격

```markdown
### docs/deferred-watchlist.md (차단 분류 및 복원 신뢰도 포함)

| 항목 ID | 분류 | 구체적 내용 | 보류/차단 사유 (Blocker) | 복원 신뢰도 | 출처 문서 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| F52 | 착수 가능 (Unblocked) | 강사 모바일 진도 로스터 진입점 배선 | 선행 API(F49) 머지 완료로 차단 해제 | High | WORKLOG 08-04 |
| F85 | 차단 보류 (Blocked) | 알림톡 발송 실패 시 SMS 폴백 웹훅 | 외부 메시징 벤더 계약 및 발신번호 심사 대기 | High | ADR-0011 |
| O1 | 범위 밖 (Out of Moat) | 기하·증명 서술형 문항 완전 자동 생성 | 결정론적 정답 검증 오라클 부재 (제품 해자 밖) | Confirmed | scope-lock |

#### 종결된 항목 (절대 행을 삭제하지 않고 취소선으로 보존하여 Dangling Pointer 방지)
- ~~F91: 학습자 자가채점 모바일 UI 구현 (2026-08-05 커밋 3c91a20에서 완료 및 검증 종결)~~
```

```markdown
### docs/tech-debt.md (Martin Fowler 4분면 및 상환 트리거 필수 명시)

| 부채 ID | 4분면 분류 | 내용 및 선택 이유 | 발생하는 이자 (Cost) | 상환 트리거 (When to Pay) |
| :--- | :--- | :--- | :--- | :--- |
| TD-1 | 의도적·신중 | 단일 백엔드에서 HS256 대칭키 JWT 사용 (RS256 키 회전 인프라는 과설계) | 외부 마이크로서비스가 독자적으로 토큰 서명을 검증할 수 없음 | 백엔드 서비스가 2개 이상으로 분리되거나 외부 검증 요구 발생 시 |
| TD-4 | 의도적·신중 (출시 시 무모) | 상담 챗봇 내부 베타 경로의 국외이전 동의 모달 생략 | 실사용자 오픈 시 개인정보보호법 컴플라이언스 리스크 | 외부 공개 위젯 정식 출시 직전 필수 상환 |
| TD-8 | 의도적·신중 | 생성 엔진 단원 해상도와 교재 소단원 유형 해상도 불일치 시 422 반환 | 일부 세부 유형에서 자동 문항 생성이 거부됨 | 엔진 프롬프트 분류기 v2 세분화 완료 시 |
```

### 기능 명세 템플릿과 `/discover-features` · `/implement-feature` · `/modify-feature` 동기화 루프

수기 기능 명세(`docs/features/{도메인}/{기능명}.md`)는 에이전트가 전체 코드베이스를 `grep`하지 않고도 즉각 수정 대상 파일을 식별할 수 있도록 백엔드 5계층과 프론트엔드 FSD 계층 경로를 1:1로 매핑한다.

```markdown
## 학습 일정 플래너 목표 설정 (study-planner)

- 버전: v1.2 (최종 수정: 2026-08-06, 안정 식별자: F64, F102)
- 개요: 학습자의 주간 목표 분량을 설정하고 일일 달성률 및 타이머 누적 시간을 계산한다.

### 관련 소스 파일 1:1 매핑
- Backend:
  - Model: backend/app/models/study_plan.py
  - CRUD: backend/app/crud/crud_study_plan.py
  - Schema: backend/app/schemas/study_plan.py
  - Service: backend/app/services/study_planner_service.py
  - API Router: backend/app/api/v1/endpoints/study_planner.py
- Frontend (FSD):
  - Page: frontend/src/pages/student-planner/ui/StudentPlannerPage.tsx
  - Widget: frontend/src/widgets/weekly-goal-board/
  - Feature: frontend/src/features/update-study-goal/
  - Entity: frontend/src/entities/study-plan/

### 시스템 데이터 흐름
[StudentPlannerPage] -> POST /api/v1/study-plans/goals -> [StudyPlannerService]
  -> 도메인 불변식 검증(주간 목표 시간 > 0) -> [CRUDStudyPlan] -> DB Commit

### 버전 및 결정 근거 이력
- v1.2 (2026-08-06, F102): 자정 경계에서 학습 타이머 종료 시 초 단위 carry-over 누락 버그 수정
- v1.1 (2026-07-29, F64): 주간 반복 목표 템플릿 복사 엔드포인트 추가
```

이 명세서가 코드 변경과 괴리(`Drift`)되지 않도록 세 가지 스킬이 기능 수명주기 전체를 규율한다.

| 스킬 명령 | 실행 시점 | 핵심 동작 및 동기화 규약 |
| :--- | :--- | :--- |
| **`/discover-features`** | 신규 온보딩 / 문서 감사 시 | `backend/src/domain/*`와 `frontend/src/domains/*`(또는 `features/*`)를 전수 스캔하여 `docs/features/**/*.md` 존재 여부와 대조하고, `완료`·`미작성`·`부분` 상태표와 문서화 우선순위 목록을 산출한다. |
| **`/implement-feature`** | 신규 기능 개발 시 | ① 요구사항·도메인 결정 -> ② Clean Architecture 순서(`Domain -> Infrastructure -> Application -> Presentation -> Frontend`) 구현 -> ③ 단위·통합·E2E 테스트 통과 -> ④ 완료 시 자동으로 `docs/features/{도메인}/{기능}.md` 생성 및 `index.md` 갱신을 강제한다. |
| **`/modify-feature`** | 기존 기능 변경 시 | ① 기존 명세 스냅샷 확인 -> ② 코드 수정 및 회귀 테스트 통과 -> ③ 변경 규모(`Major`: v1.0->v2.0 / `Minor`: v1.0->v1.1 / `Patch`: v1.0->v1.0.1) 분류 -> ④ 문서 버전·현재 명세·마이그레이션 가이드·영향받는 타 기능 목록을 동시 갱신한다. |

- [6편 본문으로 돌아가기](/tag-ai-agent-architecture/6-repo-governance/)

---

## 64개 규칙 구조조정(Rule Pruning)과 CLAUDE.md·Skill·Hook 3계층 분리 {#rule-pruning-and-skills}

### 컨텍스트 예산 실측과 3계층 라우팅 아키텍처

『개발 규율집(Project Discipline Bible)』 v1.0의 64개 조항을 상시 시스템 프롬프트에 통째로 주입했을 때와, 이를 **헌법(`AGENTS.md`/`CLAUDE.md`) · 온디맨드 절차(`SKILL`) · 결정론적 강제(`Hook`/`Linter`)**의 3계층으로 분리·프루닝한 이후의 컨텍스트 예산 및 준수율 변화는 다음과 같다.

| 측정 항목 | 개편 전 (64개 조항 단일 상시 주입) | 개편 후 (3계층 분리 및 Rule Pruning) | 비고 |
| :--- | :--- | :--- | :--- |
| **세션 시작 시 상시 프롬프트 분량** | 64개 조항 전문 (약 18,500 토큰, 컨텍스트의 35~40% 잠식) | 핵심 헌법 6개 조항 (약 1,200 토큰, 컨텍스트의 3% 미만) | 가용 추론 컨텍스트 95%+ 확보 |
| **상황별 절차 로드 방식** | DB 작업이 없어도 DB·배포·리뷰 규칙을 매 턴 상시 로드 | `/tdd-plan`, `/go`, `/design`, `/sweep` 호출 시에만 JIT 로드 | 불필요한 주의력 분산(Lost in the Middle) 제거 |
| **물리적 경계 위반율 (허브 직접 수정 등)** | 자연어 `MUST NOT` 강조에도 약 15~20% 빈도로 자기합리화 우회 발생 | `spoke-guard.sh` (`exit 2`) 및 `otlg lint --strict` 도입 후 **0%** | 기계가 막는 규칙은 프롬프트에서 완전 삭제 |
| **테스트 설계 세부 규칙(30+개) 검증** | 구현 프롬프트에 혼재되어 `RED-GREEN` 속도 저하 유발 | 구현 완료 후 `/test-harden` Critic 서브에이전트로 격리 배출 | 메인 세션 컨텍스트 오염 0줄 |

### 64개 규칙 클러스터별 전수 감사 및 통폐합(Rule Pruning) 분류표

2026년 6월 수립했던 6개 클러스터, 총 64개 조항의 규율집을 전수 감사하여 ① **상시 헌법 잔류(`AGENTS.md`)**, ② **하네스 훅/린터 승격 후 프롬프트 삭제(`Hook/CLI`)**, ③ **온디맨드 스킬 흡수(`SKILL`)**, ④ **상위 원칙 포섭 및 Forces 소멸 숙청(`Pruned`)**의 네 갈래로 구조조정한 상세 내역은 아래와 같다.

| 클러스터 (원본 조항 번호) | 원본 규칙 요약 (64개 조항) | 프루닝 및 이관 판정 | 최종 라우팅 위치 및 통폐합 방식 |
| :--- | :--- | :--- | :--- |
| **Cluster 1: 작업 공간 및 브랜치 격리**<br/>(규율 01 ~ 11) | 01. 1슬라이스 1브랜치 1워크트리 원칙<br/>02. 허브 세션 직접 코드 편집 금지<br/>03. 마이그레이션 인라인 수정 금지<br/>04. 크로스스택(BE+FE) 동시 수정 금지<br/>05. 6개 초과 파일 수정 시 워크트리 분리<br/>06. `origin/dev` 기준 분기 강제<br/>07. `node_modules` APFS COW 클론<br/>08. `.venv` 심링크 금지<br/>09. `.gitignore` 관리 문서 시드 복사<br/>10. 무인 스포크 `AskUserQuestion` 금지<br/>11. 공유 라우터 파일 주변 포맷팅 금지 | **Hook 승격 (02~09)**<br/>**SKILL 흡수 (01, 10, 11)** | - 규율 02~05는 `spoke-guard.sh` (`PreToolUse` 훅)가 결정론적으로 차단하므로 상시 프롬프트에서 **완전 삭제**.<br/>- 규율 06~09는 `worktree-from-dev.sh` 초기화 스크립트로 자동화하여 프롬프트에서 **삭제**.<br/>- 규율 01, 10, 11은 `/hub-orchestrate` 및 스포크 브리핑 템플릿으로 흡수. |
| **Cluster 2: TDD 및 객체지향 설계**<br/>(규율 12 ~ 24) | 12. `RED-GREEN-REFACTOR` 순서 엄수<br/>13. 테스트 없는 프로덕션 코드 작성 금지<br/>14. 3계층 테스트(Unit/Integration/E2E) 분리<br/>15. 경계 정합성 표 3종 사전 작성<br/>16. 원시 타입 래핑(Value Object)<br/>17. `CQS` 조회·변경 분리<br/>18. 생성자 내 I/O 금지<br/>19~24. 세부 네이밍·Mock 남용 금지·단언문 규칙 등 6개 조항 | **헌법 잔류 (12)**<br/>**SKILL 흡수 (13~15)**<br/>**상위 포섭·외부 격리 (16~24)** | - 규율 12(선 테스트·선 계약)만 `AGENTS.md` 핵심 원칙 1줄로 잔류.<br/>- 규율 13~15는 `/tdd-plan` 및 `/go` 스킬 내부 테이블로 흡수.<br/>- 규율 16~24는 『Object Design Style Guide』 상위 원칙으로 포섭하여 `/object-design-practices`와 `/test-harden` Critic 서브에이전트로 **격리 배출**. |
| **Cluster 3: API·DB·프론트엔드 경계 정합성**<br/>(규율 25 ~ 36) | 25. FE 초기 마운트 파라미터와 BE 스키마 1:1 대조 (422 방지)<br/>26. FK 필드는 표시명(`resolved`) 동반 반환<br/>27. Enum 문자열 하드코딩 금지<br/>28. Pydantic 응답 스키마 분리<br/>29. N+1 쿼리 방지 및 인덱스 명시<br/>30. 멀티테넌시 `tenant_id` 조건 강제<br/>31. 행 잠금(`SELECT FOR UPDATE`) 순서 고정<br/>32~36. FSD 슬라이스 import 규칙 및 레거시 폴더 확장 금지 | **온톨로지 정본 이관 (26, 30, 31)**<br/>**SKILL 흡수 (25, 28, 29, 32~36)**<br/>**Forces 소멸 삭제 (27)** | - 규율 26, 30, 31은 `.ontology/`의 `Rules`와 `Actions.preconditions` 계약으로 정형화하고 `otlg lint --strict` 및 행동 테스트로 검증.<br/>- 규율 25, 28, 29는 `/fastapi-api-patterns` 및 `/backend-db-practices` 스킬로 이관.<br/>- 규율 32~36은 `/fsd-slice` 스킬 및 ESLint 경계 규칙으로 이관 후 프롬프트에서 **삭제**.<br/>- 규율 27은 OpenAPI 타입 자동 생성기 도입으로 발생 조건(Forces)이 소멸하여 **영구 숙청**. |
| **Cluster 4: 저장소 거버넌스 및 문서 동기화**<br/>(규율 37 ~ 48) | 37. 5대 정본(규범·계약·구조·결정·기록) 경로 준수<br/>38. 인라인 `// TODO` 주석 금지 (`watchlist` 일원화)<br/>39. 관리 문서 완료 행 임의 삭제 금지 (취소선 보존)<br/>40. 작업 고유 식별자(`F<n>`, `TD-<n>`) 커밋 명시<br/>41. `ADR` `append-only` 원칙<br/>42. 기술 부채 4분면 및 상환 트리거 명시<br/>43~46. `docs/features/` 수기 명세 작성 및 목차 갱신 4개 조항<br/>47. `WORKLOG.md` 월별 아카이빙<br/>48. `arc42`·`C4` 다이어그램 현행화 | **헌법 잔류 (37~41)**<br/>**온톨로지 통폐합 숙청 (43~46)**<br/>**SKILL 흡수 (42, 47, 48)** | - 규율 37~41은 `AGENTS.md`의 정본 위치 및 기록 원칙(약 15줄)으로 압축 잔류.<br/>- **규율 43~46(`docs/features/` 수기 기능 명세 4개 조항)은 `.ontology/`(`repo-ontology`)의 `Objects`·`Actions`·`code_binding`이 완전 대체함에 따라 전면 폐지(Pruning)**.<br/>- 규율 42, 47, 48은 작업 종료 시점의 4단계 환류 체크리스트로 통합. |
| **Cluster 5: 완료 판정 및 Teardown 인수**<br/>(규율 49 ~ 56) | 49. 터미널 텍스트 자기보고 신뢰 금지<br/>50. 화면 해시 diff 기반 Liveness 판정<br/>51. `SPOKE_DONE` + 커밋 누적 + 종료 코드 0 3중 검증<br/>52. CLI `WARNING` 종료 코드 0 착시 경계 (`0 violations` 확인)<br/>53. 워크트리 삭제 전 `.gitignore` 문서 `append` 회수<br/>54. 스포크 세션 조기 종료 금지 (UI 스팟체크 대기)<br/>55. Alembic 다중 헤드 `align_migrations` 선형화<br/>56. 통합 브랜치 게이트 통과 후 `worktree remove` | **헌법 잔류 (51, 52)**<br/>**SKILL 및 스크립트 흡수 (49, 50, 53~56)** | - 규율 51, 52(검증 증거 및 `0 violations` 완료 조건)만 `AGENTS.md` 완료 게이트에 명시.<br/>- 규율 49, 50, 53~56은 `/hub-orchestrate` 스킬의 Phase 5~6 및 Teardown 쉘 스크립트로 코드화하여 상시 프롬프트에서 **삭제**. |
| **Cluster 6: 코드베이스 감량 및 리팩터링 안전망**<br/>(규율 57 ~ 64) | 57. 400줄 초과 비대 파일 분할<br/>58. 상위 중복 통합 테스트 프루닝(Kent Beck Tidy First)<br/>59. 미사용 `import`·의존성·환경변수 정리<br/>60. 죽은 코드(Dead Code) 및 주석 처리된 구형 코드 즉시 삭제<br/>61. 의미 없는 Pass-through 래퍼 계층 인라인화<br/>62. 레이어 바이패스(Controller->DB 직결) 금지<br/>63. 대규모 파일 분해 시 메서드 시그니처 계약서 동결<br/>64. 월간 Git Churn 비율 점검 | **SKILL 흡수 (57~64 전항)** | - 평시 기능 구현 프롬프트에서는 **64개 조항 중 Cluster 6 전체를 완전 제거**하여 구현 속도와 추론 집중력 보호.<br/>- 정기 건강검진 시 호출하는 `/sweep` 스킬(12개 진단 축)과 대규모 리팩터링 전용 `/safe-decompose` 스킬 내부 체크리스트로 100% 이관. |

### 개편 후 루트 `AGENTS.md` 최소 헌법 구조

64개 조항을 위 표와 같이 가지치기하고 난 뒤, 실제 저장소 루트의 `AGENTS.md`에는 에이전트가 매 세션 불과 1,200 토큰 내외로 읽고 즉시 움직일 수 있는 **최소 헌법(5대 정본 경로 + 착수 3단계 + 종료 4단계 환류)**만 남게 되었다.

```markdown
## 저장소 5대 정본 (SSOT)
- 규범: AGENTS.md (CLAUDE.md는 이 문서를 가리키는 어댑터)
- 도메인 계약: .ontology/ (Objects, Links, Actions, Functions, Rules 및 code_binding)
- 현재 구조: docs/architecture/ (arc42 + C4 다이어그램, 기술 부채는 §11 통합)
- 결정 근거: docs/adr/NNNN-title.md (append-only)
- 실행 기록: WORKLOG.md (당월 활성), docs/worklog/YYYY-MM.md (아카이브), docs/deferred-watchlist.md (보류)

## 착수 절차 (Before Coding)
- `otlg info` 및 `otlg trace <query> --json`으로 대상 도메인 계약과 바인딩된 소스 경로를 먼저 조회한다.
- 마이그레이션, 크로스스택 수정, 6개 초과 파일 수정은 허브 인라인 편집이 차단(`spoke-guard.sh`)되므로 `/spoke` 또는 `/hub-orchestrate`로 격리한다.
- 기능 구현 및 버그 수정은 `/tdd-plan` -> `/go`의 선 테스트·선 계약 사이클을 따른다.

## 완료 및 환류 절차 (4-Step Closure)
- 1단계 (계약 동기화): 코드 변경에 맞춰 `.ontology/`의 객체·액션·코드 바인딩을 갱신한다.
- 2단계 (결정론적 검증): `otlg lint --strict` (ERROR·WARNING 0건) 및 변경 경로 테스트 종료 코드 0을 실측한다.
- 3단계 (구조·결정 반영): 아키텍처 변경 시 `arc42`·`ADR`을 갱신하고, 미해결 사항은 인라인 TODO 대신 `docs/deferred-watchlist.md`에 등재한다.
- 4단계 (작업 인계): `WORKLOG.md`에 안정 식별자(`F<n>`)와 검증 증거를 기록하고 `SPOKE_DONE`을 발행한다.
```

- [7편 본문으로 돌아가기](/tag-ai-agent-architecture/7-rule-pruning/)
