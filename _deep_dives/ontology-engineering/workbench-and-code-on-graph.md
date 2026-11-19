---
layout: page
title: "심화 | Workbench와 Code-on-Graph"
description: "3대 도메인 Crosswalk와 ontology-workbench의 6단계 메타 프로토콜·Negative Gate, 6가지 설계 원칙, 그리고 Code-on-Graph(arXiv:2606.03705v1) 수리 원리와 5-State Result Envelope 상세 레퍼런스"
permalink: /tag-ontology-engineering/deep-dive/workbench-and-code-on-graph/
deep_dive_for: ontology-engineering
related_main_orders: [7, 8]
published: true
---

- table of contents
{:toc}

---

## 3대 도메인 Crosswalk와 6단계 메타 프로토콜·Negative Gate·설계 6원칙 {#negative-gate}

### 3대 도메인 Crosswalk 비교표 전문

서로 다른 도메인의 온톨로지를 한자리에 모아 비교할 때 가장 먼저 경계해야 할 함정은 '단어의 표면적 유사성'에 속아 넘어가는 일이다. `Vault Ontology`에도 `type`이라는 필드가 있고 `TRPG Ontology`에도 아이템이나 단서의 `type`이 존재하며, 세 도메인 모두 `Action`이나 `Rule`이라는 어휘를 사용한다. 그러나 같은 문자열을 쓴다고 해서 그 뒤에 숨은 의미론적 계약(Semantic Contract)까지 같다고 착각하면 아키텍처는 순식간에 오염된다. `ontology-workbench`의 정본 문서(`crosswalk.md`)는 세 도메인의 비교 기준과 절대 섞어서는 안 될 경계를 아래와 같이 규정한다.

| 비교 축 | Vault (`vault-ontology`) | Repository (`repo-ontology`) | TRPG (`trpg-ontology`) |
| :--- | :--- | :--- | :--- |
| **핵심 목적** | 문서의 의미·관계 정의와 생성 규율 | 실제 소스 코드에 연결한 도메인 문맥 | 캠페인 기억 보존과 라이브 상태 변이 |
| **운영 Regime** | `curation` + 좁은 생성 게이트 | `code_specification` | `curation` + `live_state` |
| **안정 ID 체계** | 문서 식별자 및 경로 정책 | `object` / `action` / `rule` ID | `actor` / `item` / `event` 도메인 ID |
| **진실의 정본 (SSOT)** | Markdown 본문 및 Frontmatter | `.ontology/` YAML + 실제 소스 코드 | YAML/JSON 상태 + 불변 이벤트 기록 |
| **변경(Mutation) 방식** | `vault new` 및 스키마 검증 게이트 | 명세를 읽고 개발자·에이전트가 코드 수정 | 등록된 핸들러 및 트랜잭션 실행 엔진 |
| **조회(Retrieval) 도구** | `vault q path/near` + 의미 검색(`vv`) | `otlg trace` / `brief` (0.01초 문맥 복원) | `scene` / `trace` / `context` / `canon` |
| **핵심 검증 대상** | 필수 필드·화이트리스트 태그·관계 방향 | 파일 경로·코드 심볼(AST)·선언 정합성 | 사전조건·상태 변이·이벤트·실행 테스트 |
| **절대 섞으면 안 될 것** | 문서 분류 `type`과 런타임 엔티티 `type` | 코드 심볼의 존재와 런타임 동작 보증 | GM의 서사적 판단과 실제 수치(HP 등) 변경 |

`TRPG`의 체력(`HP`) 차감 및 주사위 판정 모델, `Vault`의 읽기 전용 태그 화이트리스트와 `builds_on` 상한(최대 3개), 그리고 `Repository`의 프론트엔드·백엔드·모바일 심볼 바인딩 구조는 오직 해당 도메인 안에서만 유의미한 고유 계약이다. 만능 런타임 추출을 보류하고 각 도메인의 계약을 독립적으로 유지한 이유가 바로 여기에 있다.

### 새 도메인에 온톨로지를 세우는 6단계 메타 프로토콜과 Negative Gate

새로운 도메인을 만났을 때 온톨로지 설계와 검증을 안내하는 전용 스킬(`ontology-domain-design`)과 메타 검증기 저장소 **`ontology-workbench`**는 막연하게 YAML 파일부터 찍어내는 대신 아래의 **6단계 절차(`method.md`)**와 **`domain-blueprint.schema.json`** 계약을 순서대로 밟아 설계의 타당성을 입증하도록 강제한다.

1. **목적·역량 질문(Competency Questions)·적용 필요성 판정**: 가장 먼저 "누가 어떤 판단이나 행동을 더 잘하려는가"를 단 한 문장으로 정의하고, 실제 현업 요청에서 구체적인 역량 질문(CQ)과 예상 답의 형태를 뽑아낸다. 온톨로지가 일반 DB나 단순 색인보다 왜 유리한지(반복 관계, 정체성 유지, 제약, 근거 추적, 변경 경계 중 어디서 실익이 나는지)를 이 단계에서 증명해야 한다.
2. **도메인 경계와 표준 어휘 대조**: 포함 범위(`in_scope`)와 제외 범위(`out_of_scope`), 그리고 동음이의어의 네임스페이스를 먼저 가른다. 기존 W3C 표준(`OWL`, `SKOS`, `PROV-O`, `SHACL`, `dcterms`)이나 로컬 모델을 먼저 대조하되, 의미가 좁거나 다르면 억지로 같다고(`exact`) 우기지 않고 `narrower`나 `related`, 혹은 `none`으로 정직하게 매핑 이유를 남긴다.
3. **객체·관계·능력 설계**: 핵심 질문에 답하는 데 꼭 필요한 객체부터 안정 ID, 정의, 정체성 규칙(`identity_rule`), 정본(`source_of_truth`), 수명주기를 부여한다. 파일 경로나 화면 표시명은 언제든 바뀔 수 있으므로 ID로 쓰지 않으며, 관계(`Links`)에는 방향과 카디널리티(`1:1`, `1:N`, `N:1`, `N:N`), 역관계(`inverse`)의 상호 정합성을 엄격히 기재한다.
4. **권위(Authority)와 근거(Provenance) 분리**: 현재 값의 정본과 변경할 수 없는 불변 출처, 그리고 언제든 재생성 가능한 뷰(Projection)를 구분한다. 관찰된 사실(`observed`), 계산된 값(`derived`), 분석가의 추론(`inferred`), 가설(`hypothesis`)이라는 **인식 상태(Epistemic Status)**와 초안(`draft`), 검토 완료(`reviewed`)라는 **검토 상태(Review Status)**를 절대 하나의 필드에 섞지 않는다.
5. **계산·행동·결정 계약**: 단순 조회, 순수 계산(`Function`), 상태 변경(`Action`), 외부 배치 파이프라인, 시뮬레이션을 명확히 나눈다. 실제 상태를 바꾸는 동작에만 `Action`을 부여하며, 아직 핸들러 구현이 없다면 정직하게 `runtime=specification`, `handler=null`로 남겨둔다.
6. **조회·검증·변경(Migration) 설계**: 초기부터 실제 역량 질문에 대한 컨텍스트 패키지의 토큰 예산과 포함 항목(근거, 미확인 사항 `unknowns`, 생략 개수 `omitted`)을 정한다. 검증 역시 좋은 예시(`positive`)만 통과시키는 것이 아니라 깨진 참조, 잘못된 승격, 타 도메인 혼합, 동시성 충돌 같은 **실패 사례(`negative fixture`)**를 반드시 짝지어 등록하게 만든다.

특히 과잉 설계를 막는 제1규칙(`M-01`)인 **네거티브 게이트(`Negative Gate`, `use_simpler_model`)**는 답변이 단순 문서 제목 검색이나 단일 클러스터 RDB 조회로 끝나는 경우, 억지로 그래프 스키마를 만들지 않고 조기 종료(`stage: "declined"`)하는 결정을 검증기가 정상 통과(`exit 0`)로 승인하도록 보장한다.

```json
{
  "schema_version": "0.1.0",
  "domain": "single-cluster-gpu-reservation",
  "stage": "declined",
  "negative_gate": {
    "decision": "use_simpler_model",
    "simpler_alternative": "PostgreSQL RDB table with TSTZRANGE exclusion constraint and quota ledger",
    "rationale": "단일 클러스터 내 시간 중첩 계산과 사용자 쿼터 관리는 RDB 트랜잭션과 기본 API만으로 해결되며, 다중 홉 의미 전파나 이종 시스템 간 공유 행동 계약이 불필요함"
  }
}
```

```bash
# ontology-workbench 청사진 스키마 및 준비 완료(--ready) 게이트 검증 CLI
$ uv run scripts/validate_blueprint.py examples/declined-gpu-reservation.blueprint.json
$ uv run scripts/validate_blueprint.py examples/incident-retrospective.blueprint.json --ready
```

### 4대 프로젝트 설계 기준 점검 결과 요약 및 6대 엔지니어링 원칙 상세

| 프로젝트 | 초기 상태 및 숨겨진 결함 | 반례 점검을 통한 설계 보강 | 최종 검증 상태 |
| :--- | :--- | :--- | :--- |
| **Vault Ontology** | 466개 테스트 통과 상태였으나, 볼트 외부 경로 쓰기, 자기 파일 삭제, 한글 Git 경로 파싱 누락 등 운영 경계 허점 존재 | 읽기 전용 SQLite authorizer 적용, 임시 DB 교체 원자화, `git -z` 원경로 보존, 동명이인 섹션 링크 폴더 명시 강제 | **523 passed** (`vault/vo` v0.1.1 전역 반영) |
| **Repo Ontology** | 18개 테스트 및 `lint --strict` 통과 상태였으나, `sitemap` 린트 누락(19개 구경로 방치), 주석 문자열 매칭 착시, `trace` 탐색 폭발 존재 | Python AST 스코프별 실제 심볼 선언 검사, `trace` 1-hop 시드 고정 및 상한 제어, 교육 관리 SaaS 오결합(`AcademyGrades`) 교정 | **97 passed** (`otlg` v0.3.0, 3-Graph 확장 포함) |
| **TRPG Ontology** | 서사 기억과 런타임 수치 변이가 혼재될 위험, 실패한 액션이나 동시 수정 시 상태 오염 가능성 | 등록 핸들러만 실행 허용, `expected_revision` 및 `idempotency_key` 강제, 불변 연대기(`chronicle`) 저널 트랜잭션 격리 | **322 passed** (런타임 Action 엔진 검증 완료) |
| **Meta Workbench** | 초기 `v0.1.0`에서 빈 `operations=[]`나 가짜 `runtime=verified`, 실패 케이스를 제외한 체리피킹 보고(`M-20`)가 그대로 통과됨 | `use_simpler_model` 네거티브 게이트 도입, 타깃의 모든 acceptance 사례(positive+negative) 통과 강제(`E_REPORT`) | **52 passed** |

세 도메인과 메타 워크벤치를 운영하며 확립한 6대 원칙의 세부 내역은 다음과 같다.

- **원칙 1. 필드·문서·기능 이름이 있다고 커버했다고 믿지 마라**: `Meta Workbench` 초기 버전에는 `CQ.required_terms=[]`로 빈 역량 질문이 통과하거나 빈 `operations=[]`가 허용되는 허점이 있었고, `Repo Ontology`에도 파이썬 주석 문자열만 보고 실제 메서드가 선언되었다고 오판하던 구멍이 있었다. 라벨의 존재와 실제 근거 구조의 존재를 엄격히 구분해야 한다.
- **원칙 2. 검사 통과(`0 errors`)를 내용의 진실성으로 둔갑시키지 마라**: `Repo Ontology` 초기 버전에서 `sitemap` 바인딩 누락으로 19개 구경로가 방치되었던 사례, 그리고 `Meta Workbench`에서 실패한 케이스(`reported_fail`)만 `verification_refs`에서 제외해 `reported_verified`를 우회 통과하던 체리피킹(`M-20`) 반례를 통해, 모든 연결 인수 사례(`positive` + `negative`)의 전수 통과(`E_REPORT`)를 강제했다.
- **원칙 3. 못 본 값을 추론이나 기본값으로 메우지 마라 (`unknown`과 `partial`의 보존)**: `TRPG`에서 아직 조사하지 않은 시설(`facilities`)이나 자연어 서식지 문장뿐인 생물 115종, `Repo`에서 인덱싱 범위 밖인 심볼을 억지 추론이나 기본값으로 메우지 않고, 미확인(`unknown`)과 부분 확인(`incomplete`) 상태로 일관되게 보존했다.
- **원칙 4. 강한 차단을 무조건 늘리는 것은 실력이 아니다 (과잉 규율 배제의 원칙)**:
  - `Vault Ontology`: 요약문(`summary`) 속 예시 링크까지 에러로 막자는 제안과 `900 Archive` 노트 수천 개를 현역 그래프에 편입시키자는 제안을 제외하고, 실제 관계 필드·본문 링크만 검사하되 아카이브는 경로 상태만 구분하도록 절충했다.
  - `Repo Ontology`: `otlg trace` 결과 외 파일의 읽기·수정을 하드 락으로 막자는 제안을 제외하여 미등록 유틸리티 탐색의 유연성을 지켰다.
  - `TRPG Ontology`: 해시 봉인 도입 전에 기록된 과거 전투 사건 2건을 현재 해시로 소급 위조하자는 제안을 제외하고, 미봉인 역사적 사실로 정직하게 분리 보존했다.
  - `Meta Workbench`: 미배포 초안 단계의 자동 마이그레이션 변환기 강제(`M-07`), 읽기 전용 모델의 트랜잭션 필드에 `'N/A'` 문자열 복붙 강제(`M-10`), 청사진 문서 내 파일 해시 핀 고정(`M-08`)을 제외하고 `null` 허용과 Git 이력 보존으로 갈음했다.
- **원칙 5. 그럴듯한 설명이나 추측을 검증의 대체재로 삼지 마라**: 구두 설명이나 추론 대신 `/tmp` 격리 환경에서의 반례 재현 스크립트, 원본 바이트(SHA256 및 JSON/Git 경로) 대조, 운영 정책 결정, 회귀 테스트 재실행 결과만을 최종 판단 근거로 삼았다.
- **원칙 6. 테스트 통과 숫자를 도메인 완성률처럼 포장하지 마라**: `Vault` 523 passed와 기존 볼트 문서 린트 위반 919건, `Repo` 정적 통과와 JS/Dart 미지원 경고 22건, `TRPG` 도구 테스트 통과와 캠페인 설정의 미확인 영역을 철저히 분리해 보고했다.

- [7편 본문으로 돌아가기](/tag-ontology-engineering/7-meta-ontology-workbench-and-redteam/)

---

## Code-on-Graph (arXiv:2606.03705v1) 3단계 반복 추론과 CVT·TUR 수리 분석 {#code-on-graph}

### 실무 도메인별 조합 폭발과 고정 CLI / Text-in-Context의 한계 대조표

| 실무 도메인 | 데이터 규모 및 다중 모달리티 복잡도 | 대표적 복합 질의 및 창발 검증 요구사항 | 고정 CLI 및 Text-in-Context 방식의 한계 |
| :--- | :--- | :--- | :--- |
| **TRPG 세계관 및 캠페인**<br>(`trpg-ontology`) | 418개 세계관 문서 + 1,478개 글뤼엔 연금술 아카이브 (`~7.5MB`) + 라이브 파티 상태 | *"현재 소지 재료와 현지 채집·거래만으로 다음 보스의 핵심 기믹을 파훼하고 30라운드 내에 생존할 수 있는가?"* | 7.5MB 원문을 프롬프트에 넣으면 컨텍스트가 폭발하며, 정적 스키마 검사만으로는 보스 드랍 순환 잠금이나 승률을 알 수 없음 |
| **지식 볼트 및 코드 레포지토리**<br>(`vault` / `repo`) | 4,400+ 마크다운 노트, 39만 줄 풀스택 코드베이스 3-Graph | *"볼트 전체를 중복 스캔하지 않고 스키마·태그 위반을 사전 진단하거나, 3-Graph의 스키마 클래스 스텁만 노출해 문맥을 조립할 수 있는가?"* | CLI 호출 실패마다 쉘 명령을 재조립하며 턴을 낭비하거나, 거대 그래프 원문을 프롬프트에 직접 부어 토큰 예산 초과 |

### Stage 1 / 2a / 2b / 3 파이프라인 상세와 CVT Reification 코드 스텁

**[Code-on-Graph: Iterative Programmatic Reasoning via Large Language Models on Knowledge Graphs](https://arxiv.org/abs/2606.03705v1)**(Weiwei Ding 외, 2026)의 3단계 반복 루프와 스키마 매핑 구조는 다음과 같다.

1. **Stage 1 (Iterative Subtask Decomposition)**: 복합 질의를 이전 스텝의 실행 결과를 참조하는 `parent_step` 기반의 의존성 DAG 서브태스크 $T_t$로 동적 분해한다. 매 단계 종료 시 확보된 증거만으로 질문의 모든 제약을 검증할 수 있는지(Exploration Sufficiency)와 후보 답안의 타입·맥락이 타당한지(Answer Plausibility)를 평가한다.
2. **Stage 2a (Bounded Subgraph Retrieval)**: 거대 그래프 인스턴스 전체를 프롬프트에 넣는 대신, 타겟 엔티티 주변의 경계 있는 서브그래프 슬라이스만 추출해 메모리 공간에 적재하고 CVT 노드에 대해서는 1홉 확장을 수행한다.
3. **Stage 2b (Schema-to-Class Mapping & CVT Reification)**: LLM 프롬프트에는 실제 데이터 값을 뺀 `Python` 클래스 및 `TypedDict` 스키마 스텁만 노출한다. 여러 속성이 한데 묶여야만 의미가 성립하는 다항 초간선(Hyperedge)인 **CVT(Compound Value Types)**를 구조화된 객체로 재구체화(Reification)하여 서로 다른 엔티티의 속성이 교차 오염되는 현상을 방지한다.
4. **Stage 3 (Sandboxed Execution & Self-Correction)**: 스키마를 보고 합성된 연산·검증 로직을 메모리 내 객체 그래프 위에서 격리 실행한다. 런타임 예외(`KeyError`, `TypeError`, `AttributeError`)뿐 아니라 빈 결과(`Empty Output`)나 충분성 미달까지 실행 피드백으로 돌려주어 최대 3회(`max_attempts = 3`)의 제한된 반복 안에서 조건식을 스스로 교정하게 만든다.

```python
# Stage 2b: 수만 개의 인스턴스 데이터 대신 프롬프트에 노출되는 Schema-to-Class 스텁 예시
class Evidence(TypedDict):
    evidence_id: str
    modality: Literal["text_span", "image_bbox", "ocr_span"]
    cue_type: Literal["minor_age_cue", "sexual_trigger", "jailbreak_pattern"]
    confidence: float
    detector_status: Literal["observed", "unknown"]

class AssessmentRelation(TypedDict):
    # CVT (Compound Value Type): 동일 인물·장면·시점 맥락으로 근거들을 묶어 교차 오염 방지
    relation_id: str
    subject_id: str
    scene_id: str
    time_basis: str
    bound_evidences: list[Evidence]
```

### Proposition 1: Token Utilization Rate (TUR) 수리 증명과 해석 경계

프롬프트에 사실 트리플을 직접 나열하는 `Text-in-Context` 방식은 인스턴스 개수(`|I_t|`)가 늘어날수록 필요한 프롬프트 토큰도 비례해서 늘어나므로 토큰당 활용 가능한 사실의 비율이 `O(1)` 상수에 갇힌다. 반면 `Schema-to-Class` 매핑을 쓰면 프롬프트에는 고정된 크기의 스키마 정의서(`|S_t|`)만 들어가고 실제 연산은 메모리에 적재된 전체 인스턴스(`|I_t|`) 위에서 돌아가므로, 인스턴스 규모가 커질수록 토큰 활용 효율이 `O(|I_t| / |S_t|)`로 선형 확장된다.

$$
\text{TUR}_{\text{Text-in-Context}} = \mathcal{O}(1) \quad \text{vs.} \quad \text{TUR}_{\text{Schema-to-Class}} = \mathcal{O}\left(\frac{|I_t|}{|S_t|}\right)
$$

논문이 `GrailQA`, `CWQ`, `WebQSP` 벤치마크에서 보고한 **`40.7x ~ 47.6x`의 `TUR` 수치**는 '프롬프트 토큰 1개당 접근 및 연산 가능한 그래프 사실(Fact)의 이론적·벤치마크 비율'을 뜻하는 것이지, 실제 런타임 실행 시간(Latency)이 47배 빨라진다거나 CLI 도구가 실측한 속도 배수가 아니다. 코드 합성과 자가 교정 루프가 추가되면서 질의당 소요 시간은 소폭 증가할 수 있으나, 기존 방식이 컨텍스트 한계로 잘라버리던 수만 개의 사실 집합을 누락 없이 전수 연산 범위 안으로 끌어올렸다는 데 핵심 공학적 가치가 있다.

- [8편 본문으로 돌아가기](/tag-ontology-engineering/8-code-on-graph-and-epilogue/)

---

## 5-State Result Envelope와 Wave 1 3대 도메인 업그레이드 {#result-envelope}

### 5-State Result Envelope JSON 규격과 상태 정의

현실 운영 도메인에서는 "경계 위반이 0건임"처럼 빈 결과 자체가 정답인 경우(`empty_valid`)와 판독 실패(`unknown`), 출력 예산 절단(`incomplete`)을 엄격히 구분해야 한다. 모든 CLI와 추론 출력 봉투는 아래 규격을 따른다.

```json
{
  "schema_hash": "sha256:9f4c2a...",
  "dataset_revision": "rev-2026-11-08",
  "visibility_scope": "pc_public",
  "status": "answered | empty_valid | unknown | incomplete | failed",
  "coverage": { "scanned": 59, "returned": 20 },
  "omitted_count": 39,
  "evidence_refs": ["catalog:healing-salve", "place:muelden"],
  "unknowns": []
}
```

- **`answered`**: 질의 조건에 부합하는 결과와 근거(`evidence_refs`)를 정상 도출함
- **`empty_valid`**: 스키마와 데이터를 정상 탐색했으나 조건에 해당하는 대상이 실제로 0건임(예: 위반 근거 없음)
- **`unknown`**: 문서 미기록, 권한 마스킹, 혹은 비전/텍스트 검출기 미확인으로 인해 판단을 보류해야 함
- **`incomplete`**: 출력 예산 제한(`limit`), 텍스트 절단, 또는 어댑터·바인딩 미비로 전체 집합 중 일부만 확인됨
- **`failed`**: 스키마 계약 위반, 참조 무결성 깨짐, 또는 허용된 실행 예산을 초과한 명시적 실패

### Wave 1 3대 도메인 업그레이드 상세 비교표

| 도메인 및 버전 | 핵심 CoG 이식 메커니즘 | 무변이 사전검사 및 실행 경계 | 검증 결과 (`pytest` / Checks) |
| :--- | :--- | :--- | :--- |
| **`vault-ontology v0.2.0`**<br>& **`vault-vector v0.1.0`** | `vault schema --json`, `vault tags --json`, `vault new --dry-run --json`, `vault ask --json`, `vault q sql --json --limit` | 단일 `scan_vault` 스냅샷 공유 무변이 사전검사 + 실제 쓰기 시 원자적 `no-clobber` 재검증, SQLite instruction 예산 제한 | `531 passed` (`vault-ontology`)<br>`57 passed` (`vault-vector`) |
| **`repo-ontology v0.3.1`** | `otlg schema --class-stubs --json` 읽기 전용 3-Graph 투영 (`schema_hash`, `dataset_revision`, `coverage`, `unknowns`) | Pydantic 기반 `class-stub` 요약만 노출, 기존 `lint`/`impact`/`brief`/`contracts` 결정론적 게이트 불변 유지 | `100 passed`<br>(에듀테크 B2B SaaS 실증) |
| **`trpg-ontology v0.13.0`**<br>(`F14` 1차 업그레이드) | `trpg draft check DRAFT_ID --json`, `trpg draft promote --expected-revision HASH`, `trpg context --include-codex --perspective pc` | 미확인 스탯·HP·외형 자동 창작 금지, 리비전 해시 잠금 트랜잭션 승격, PC 시점 비공개 원문 해시 노출 차단 | `328 passed`<br>(strict lint `0 violations`) |

```bash
# Wave 1: 3대 온톨로지 공통 CoG 사전검사 및 읽기 전용 스키마 투영 검증 CLI
$ vault schema --json && vault tags --json
$ vault new --type concept --title Example --dir notes --summary short --body body --mkdir --dry-run --json
$ vault q sql "SELECT path, type FROM nodes WHERE type = 'learning'" --json --limit 100
$ otlg schema --project /path/to/edutech-saas --class-stubs --json
$ trpg draft check DRAFT_ID --json
$ trpg context --include-codex --perspective pc --json
```

- [8편 본문으로 돌아가기](/tag-ontology-engineering/8-code-on-graph-and-epilogue/)
