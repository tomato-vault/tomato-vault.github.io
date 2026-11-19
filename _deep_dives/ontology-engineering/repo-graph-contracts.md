---
layout: page
title: "심화 | Repo Ontology의 명세와 3-Graph"
description: "Repo Ontology(.ontology/) 6대 프리미티브 스키마와 otlg CLI 명세, v0.2.0 정적 검증 보강(죽은 경로 19개·AST 심볼 검증), 그리고 v0.3.0 3-Graph(도메인·임포트·TDD 계약) 컴파일러 상세 레퍼런스"
permalink: /tag-ontology-engineering/deep-dive/repo-graph-contracts/
deep_dive_for: ontology-engineering
related_main_orders: [3, 4]
published: true
---

- table of contents
{:toc}

본 문서는 온톨로지 엔지니어링 시리즈 **[[3편]](/tag-ontology-engineering/3-nouns-to-verbs-paradigm-shift/)**과 **[[4편]](/tag-ontology-engineering/4-three-graphs-and-tdd-contract-v030/)** 본문에서 다룬 코드 레포지토리 온톨로지(`.ontology/` 및 `otlg` CLI)의 상세 YAML 스키마 명세, `v0.2.0` 코드 정합성 점검 내역과 AST 파서 코드, 그리고 `v0.3.0` 3-Graph 컴파일러와 `pytest` 증거 봉인 레퍼런스를 수록한 심화 기술 문서다.

---

## .ontology/ 6대 프리미티브 스키마와 otlg trace·translate·intake 계약 {#primitive-contracts}

### SDLC 도메인 명세 포지셔닝과 역할 경계 점검

팔란티어의 운영 온톨로지 개념을 코드 레포지토리에 이식하면서, 실제 구현 범위와 엔터프라이즈 런타임 엔진 간의 역할 경계를 다음 기준으로 정리했다.

| 분석 축 | 초기 설계 가설 | 실측 기반 재정의 | 확정된 엔지니어링 기준 |
| :--- | :--- | :--- | :--- |
| **온톨로지 명칭의 정당성** | 지식 및 코드 도메인 온톨로지 | 도메인 명세와 관계 모델 근거 충분 | **유지**: 두 시스템 모두 온톨로지 개념을 정당하게 구현함 |
| **`Vault Ontology` 성격** | 지식 거버넌스 2.5단계 (Data + Logic) | 개인 지식 온톨로지 (`vault new` 생성 게이트 포함) | **일치**: 지식 산출물 대상의 스키마 및 생성 거버넌스 |
| **`Repo Ontology` 성격** | AIP 실행형 3단계 도달 | 코드에 연결된 도메인 온톨로지 명세 (런타임 실행 엔진 아님) | **경계 보정**: 런타임 트랜잭션 엔진과 SDLC 접지 명세의 엄격한 분리 |

팔란티어의 `Action Layer`가 현업 실무자나 AI 호출 시 ERP·DB 트랜잭션을 직접 일으키는 런타임 엔진인 것과 달리, `repo-ontology`(`otlg`)는 소프트웨어 개발 라이프사이클(SDLC)에서 코딩 에이전트가 코드를 수정하기 전에 준수해야 할 비즈니스 동사와 불변식, 그리고 실제 소스 코드의 물리적 위치를 1:1로 묶어주는 **'코드에 연결된 도메인 온톨로지 명세(Code-bound Domain Ontology Specification)'** 역할을 수행한다.

### 4대 핵심 프리미티브 + 2대 로컬 확장 레이어 정의

팔란티어 `Foundry`와 `AIP`의 4대 핵심 프리미티브(`Objects`, `Links`, `Actions`, `Functions`)에 시스템 전역 제약(`Rules`)과 클라이언트 화면·메뉴 매핑(`Views` / `sitemap.yml`)을 결합한 6대 층위의 정의는 다음과 같다.

| 프리미티브 | 엔터프라이즈 운영에서의 의미 | 코드 레포지토리(`.ontology/`) 이식 정의 |
| :--- | :--- | :--- |
| **`Objects` (명사)** | 현실 세계의 비즈니스 실체 | 도메인 엔티티(`User`, `Class`, `Attendance`)와 DB 모델 매핑. 단순 기술적 컬럼 나열이 아니라 비즈니스 의미 속성과 상태 값의 범위를 노출 |
| **`Links` (관계)** | 실체 간의 의미론적 연결 | 객체 간의 연관 관계(`1:1`, `1:N`, `N:M`) 및 외래키, ORM 관계 정의 |
| **`Actions` (동사)** | 시스템 상태를 바꾸는 원자적 트랜잭션 | 시스템 상태를 변경하는 유일한 관문(`Enroll`, `Pay`, `Cancel`, `Grade`). 입출력 파라미터, 사전 불변식(`preconditions`), 상태 전이 효과를 명세 |
| **`Functions` (순수 계산)** | 상태 변경 없는 연산 및 AI 추론 | DB 상태를 직접 바꾸지 않는 순수 비즈니스 계산(출석률 산출, 성적 백분위 계산) 및 도메인 객체를 입력받는 결정론적 AI 분석 파이프라인 |
| **`Rules` (전역 불변식, 확장)** | 전사 보안 및 컴플라이언스 정책 | 도메인 전반에 걸쳐 강제되는 보안, 멀티테넌트 데이터 격리, 동시성 행 잠금 등 시스템 전역 불변 규칙 |
| **`Views` (화면 매핑, 확장)** | 현업 워크스페이스 및 메뉴 구조 | 기획서 화면 코드(`S-COM-001`), 좌측 네비게이션 메뉴 트리(`sitemap.yml`), 프론트엔드 라우트·컴포넌트와 온톨로지 객체·액션 간의 매핑 |

### 실전 Action YAML 명세 스펙 (`grade-submission.yml`)

에듀테크 B2B SaaS의 과제 채점 유즈케이스를 모델링한 `.ontology/actions/grade-submission.yml` 전문은 다음과 같다.

```yaml
action: GradeSubmission
domain: education
description: 강사가 학생의 과제 제출물을 검토하고 점수와 피드백을 부여한다.

actor:
  type: Instructor
  permission: "role:instructor"

target:
  object: AssignmentSubmission
  lookup: "id"

parameters:
  score: { type: integer, range: [0, 100], required: true }
  feedback: { type: text, max_length: 2000, required: false }

preconditions:
  - rule: "제출 완료 또는 재제출 상태의 과제만 채점할 수 있다"
    expression: "target.status in ['SUBMITTED', 'RESUBMITTED']"
  - rule: "해당 코스의 담당 강사 본인이어야 한다"
    expression: "actor.id == target.course.instructor_id"
  - rule: "동시 채점 방지를 위한 행 잠금 필수"
    expression: "requires_row_lock(target.id)"

effects:
  mutate:
    target.status: "GRADED"
    target.score: "params.score"
    target.feedback: "params.feedback"
  events:
    - name: "ASSIGNMENT_GRADED_EVENT"
      channel: "push_notification"

code_binding:
  backend:
    service: "backend/app/services/assignment_service.py:AssignmentService.grade"
    api: "POST /api/v1/courses/{course_id}/submissions/{submission_id}/grade"
  frontend:
    feature: "frontend/src/features/grading"
  mobile:
    viewmodel: "mobile/lib/features/assignment/viewmodels/grading_viewmodel.dart"

governance:
  feature_id: "F52"
  adr: "docs/adr/0008-course-grading-policy.md"
```

- **`actor` / `target` / `parameters`**: `Instructor` 권한 주체가 `AssignmentSubmission` 객체의 상태를 변경하는 `GradeSubmission` 동사임을 선언하고 입력 파라미터의 타입·허용 범위(`0`~`100`)를 명시한다.
- **`preconditions` / `effects`**: 실행 전 반드시 검증해야 할 세 가지 사전 불변식(제출 상태 확인, 담당 강사 본인 확인, 동시 채점 방지용 행 잠금)과 실행 후 상태 변경(`GRADED`) 및 이벤트 발행을 명시한다.
- **`code_binding` / `governance`**: `FastAPI` 백엔드 서비스 심볼(`AssignmentService.grade`)과 라우트, `React` 피처 슬라이스, `Flutter` 모바일 뷰모델 경로 및 아키텍처 결정 기록(`ADR`)을 1:1로 묶어준다.

### `otlg trace` / `translate` / `intake` 및 `lint --strict` 3계층 검증

1. **`otlg trace <Query>`**: 백지상태의 에이전트에게 수정 대상 `Target` 객체, 소속 도메인, 필수 `Preconditions`, 전역 불변식 룰(`ORGANIZATION_DATA_ISOLATION`, `LEDGER_OVER_REFUND_INVARIANT`, `PAYMENT_DATE_ATTRIBUTION_SEPARATION`, `BILLING_STATUS_DERIVATION_SINGLETON`)과 각 규칙이 강제되는 실제 심볼 경로(`enforcement`), 그리고 풀스택 소스 파일 경로(`SOURCE PATHS`)를 0.01초 만에 인출한다.
2. **`otlg translate <화면명/메뉴경로>`**: `.ontology/views/`와 `sitemap.yml`에 정의된 메뉴 경로 및 기획서 화면 코드(`S-COM-001` 등)를 기반으로 프론트엔드 `FSD` 슬라이스와 백엔드 온톨로지 객체·액션을 역추적한다.
3. **`otlg intake <요구사항.xlsx>`**: 고객사 요구사항 시트의 컬럼(`대분류`, `중분류`, `페이지코드`, `기능설명`)을 파싱해 각 행과 연관된 `View` 및 `Action` 후보를 매칭하여 사전 검토 리포트를 생성한다.

코드 드리프트를 방지하는 `otlg lint --strict`의 3계층 정적 검증 메커니즘은 다음과 같다.

| 검증 계층 | 검사 대상 | 정적 검증 메커니즘 (`otlg lint --strict`) | 불일치 시 조치 |
| :--- | :--- | :--- | :--- |
| **스키마 및 오타 원천 차단** | 모든 `.ontology/**/*.yml` 파일 | `Pydantic v2`의 `extra="forbid"` 모델 검증으로 정의되지 않은 필드나 오타를 조용히 무시하지 않고 즉시 적발 | 파싱 단계에서 즉시 에러 반환 |
| **온톨로지 참조 무결성 검증** | `Links`, `Actions`, `Rules`, `ADR` | 링크의 `source/target`, 액션의 `target/actor`, 룰의 `scope`가 가리키는 `Object`가 실재하는지, 연결된 `ADR` 문서가 존재하는지 교차 검증 | 고아 참조 및 깨진 거버넌스 링크 차단 |
| **코드 바인딩 및 심볼 실존 검증** | 풀스택 `code_binding` 및 `Rule enforcement` | 백엔드·프론트엔드·모바일 바인딩 파일과 전역 불변식 강제 경로(`enforcement`)가 실제 디스크에 존재하는지, 지정된 클래스·메서드 심볼(`:ClassName.method`)이 소스 파일 내에 존재하는지 검사 | `--strict` 모드에서 에러 보고 |

[3편 본문으로 돌아가기](/tag-ontology-engineering/3-nouns-to-verbs-paradigm-shift/)

---

## v0.2.0 정적 검증 보강과 AST 심볼·참조·Bounded Trace 검증 {#ast-audit}

### `ViewSpec` 검증 루프 보강과 19개 죽은 경로 적발 (`lint.py`)

초기 `v0.1.0`의 `lint.py`는 `Object`, `Action`, `Function`의 `code_binding`과 `Rule`의 `enforcement`만 순회하고 `ViewSpec`(`sitemap.yml` 및 `views/`)은 검사 대상에서 누락하고 있었다. 이로 인해 리팩토링과 FSD 구조 개편 과정에서 삭제·이동된 8개 화면 명세의 19개 코드 경로가 유령 경로로 방치되어 있었다.

`v0.2.0`에서는 모든 `ViewSpec`의 내부 온톨로지 참조와 `frontend`, `backend`, `mobile` 바인딩 경로를 전수 검사하되, 로컬 파일이 아닌 UI 라우트(`frontend.route`)와 HTTP 프로토콜 선언(`backend.endpoints`)은 파일 실존 검사에서 분리했다.

```python
# src/repo_ontology/lint.py: 누락되어 있던 ViewSpec 참조 및 코드 경로 전수 검사 추가
for view in registry.views.values():
    if not view.binding:
        continue
    binding = view.binding
    if binding.ontology:
        for key, known in (("objects", registry.objects), ("actions", registry.actions),
                           ("functions", registry.functions), ("rules", rule_ids)):
            for reference in getattr(binding.ontology, key) or []:
                if reference not in known:
                    issues.append(LintIssue("ERROR", f"View '{view.view}'", f"Unknown {key} reference: {reference}"))
    if check_code:
        for layer in ("frontend", "backend", "mobile"):
            data = getattr(binding, layer)
            if data:
                data = data.model_dump(exclude_none=True) if hasattr(data, "model_dump") else dict(data)
                # URL routes are UI navigation declarations, not local files.
                data.pop("route", None)
                if layer == "backend":
                    data.pop("endpoints", None)  # protocol declarations; no executable route verification
                if layer == "mobile":
                    for key in list(data):
                        if key in {"screen", "controller"} and isinstance(data[key], str) and "/" not in data[key] and "." not in data[key]:
                            issues.append(LintIssue("WARNING", f"View '{view.view}'.mobile.{key}", f"Unbound mobile symbol declaration: {data.pop(key)}"))
                _check_path_values(registry.root_path, data, f"View '{view.view}'.{layer}", issues, strict_code)
```

### 비실행(No-Import) 순수 `Python` `AST` 스코프 추적기 (`bindings.py`)

문자열 부분 일치(`any(s in content)`) 검사가 주석(`# Ghost`)이나 타 클래스의 동명 메서드, 혹은 `OrganizationService.generate_organization_code` 같은 유령 심볼을 통과시키던 문제를 해결하기 위해, 애플리케이션 모듈을 전혀 `import`하지 않고 표준 `ast` 모듈만으로 선언 스코프와 로컬 별칭을 추적하는 검증기를 구현했다.

```python
# src/repo_ontology/bindings.py: 모듈 import 없이 AST 스코프와 로컬 별칭을 추적하는 검증기
def _namespace(body):
    result = {}
    for node in body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            result[node.name] = node
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                result[alias.asname or alias.name.split('.')[0]] = node
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for target in targets:
                if isinstance(target, ast.Name):
                    result[target.id] = node.value
        elif isinstance(node, (ast.If, ast.Try)):
            # Conditional definitions are only candidates, never proof of execution.
            result.update(_namespace(node.body))
            result.update(_namespace(node.orelse))
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    result.update(_namespace(handler.body))
                result.update(_namespace(node.finalbody))
    return result


def python_symbol(tree, symbol):
    """Return found/missing/unknown for local declarations and simple local aliases."""
    scope = _namespace(tree.body)
    module_scope = scope
    parts = symbol.split('.')
    if not all(p.isidentifier() for p in parts):
        return 'missing'
    for index, part in enumerate(parts):
        if part not in scope:
            return 'unknown' if '__getattr__' in scope else 'missing'
        node = scope[part]
        if index == len(parts) - 1:
            return 'unknown' if isinstance(node, (ast.Import, ast.ImportFrom)) else 'found'
        for _ in range(12):
            if isinstance(node, ast.Name):
                node = module_scope.get(node.id)
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                node = module_scope.get(node.func.id)
            else:
                break
        if node is None or isinstance(node, (ast.Import, ast.ImportFrom)):
            return 'unknown'
        if isinstance(node, ast.ClassDef):
            scope = _namespace(node.body)
            if parts[index + 1] not in scope and node.bases:
                return 'unknown'  # inherited/dynamic members require a language resolver
        else:
            return 'unknown'
    return 'missing'
```

이를 검증하는 단위 테스트(`tests/test_repository_review.py`)는 대상 파일 최상단에 `raise RuntimeError("never import")`를 배치해 비실행 원칙을 강제하고, 주석이나 타 클래스 심볼 바인딩을 `ERROR`로 잡아낸다.

```python
# tests/test_repository_review.py: 주석/타 클래스 심볼 차단 및 비실행(No-Import) 검증
@pytest.mark.parametrize('symbol', ['Ghost', 'Real.absent', 'Other.present'])
def test_strict_python_symbol_cannot_be_comment_or_wrong_class(tmp_path, symbol):
    (tmp_path / 'model.py').write_text('# Ghost\nclass Real:\n    def present(self): pass\nclass Other: pass\n', encoding='utf-8')
    issues = []
    _verify_code_path(tmp_path, f'model.py:{symbol}', 'binding', issues, True)
    assert any(i.severity == 'ERROR' for i in issues)


def test_python_binding_alias_and_no_execution(tmp_path):
    (tmp_path / 'model.py').write_text('raise RuntimeError("never import")\nclass Real:\n    def present(self): pass\nservice = Real()\n', encoding='utf-8')
    issues = []
    _verify_code_path(tmp_path, 'model.py:service.present', 'binding', issues, True)
    assert issues == []
```

또한 외부 `import` 심볼, 상속(`node.bases`) 위임 멤버, 그리고 `v0.2.0` 시점에 전용 AST 파서가 없던 `JS`/`Dart` 심볼은 `found`로 위장하지 않고 `unknown`(`WARNING`)으로 분리하여 프로덕트 기준 **`0 Errors, 22 Warnings`**로 정직하게 보고하도록 설계했다.

### 도메인 의미 오염(Semantic Drift) 교정 요약

| 발견된 도메인 드리프트 | 기존 `.ontology/` 선언 | 실제 소스 코드 대조 결과 | `v0.2.0` 교정 조치 |
| :--- | :--- | :--- | :--- |
| **`ExamScoreManagementView` 객체 오매핑** | `StudentGrades` (학교 내신·모의고사 객체) 연결 | `AcademyGrades.js`와 `examination_academy.py`는 학원 자체 시험 및 학급(`Class`)을 다룸 | 잘못된 `StudentGrades` 연결을 제거하고 실제 사용이 확인된 `Class`로 교정 후 학원 시험 객체 미등록 사실 명시 |
| **`User.relationships` 타깃 불일치** | 미등록 ID인 `Student`, `Staff`, `Parent` 기입 | 등록 객체는 `StudentProfile`이며, `Staff`·`Parent`는 DB 모델만 있고 온톨로지 미등록 | `StudentProfile`로 정정하고 `Staff`·`Parent`는 억지 매핑 대신 온톨로지 미등록 상태로 명시 |
| **기관 코드 생성 규칙 심볼 오류** | `OrganizationService.generate_organization_code` | 서비스에는 해당 메서드가 없으며 `preview_organization_code`가 `OrganizationCRUD.generate_organization_code` 호출 | 실제 선언된 서비스·CRUD 심볼 경로로 정정 (동시성/유일성 보증과 선언 존재는 분리) |

### 시드 스냅샷 고정 1-hop `trace`와 동점 후보를 보류하는 `intake`

공통 `actor: User`와 실시간 도메인 확장으로 인한 문맥 폭발·비결정성을 제거하기 위해, `trace.py`는 초기 시드 스냅샷을 고정하고 선언된 1-hop 이웃만 확장하도록 개편했다.

```python
# src/repo_ontology/trace.py: 시드 스냅샷 고정 및 1-hop 명시적 관계 확장
selected = {kind: set(keys) for kind, keys in seeds.items()}
# Snapshot direct seeds: newly selected context never becomes a second-hop seed.
for key, action in registry.actions.items():
    if action.target and (key in seeds["actions"] or action.target.object in seeds["objects"]):
        selected["actions"].add(key)
        if action.target.object in registry.objects:
            selected["objects"].add(action.target.object)
    if key in seeds["actions"]:
        for condition in action.preconditions:
            if condition.rule_id in collections["rules"]:
                selected["rules"].add(condition.rule_id)
for rule in registry.rules:
    if rule.id in seeds["rules"]:
        selected["objects"].update(set(rule.scope) & registry.objects.keys())
    elif set(rule.scope) & seeds["objects"]:
        selected["rules"].add(rule.id)
for link in registry.links:
    link_objects = {link.source, link.target} | ({link.through} if link.through else set())
    if link.name in seeds["links"] or link_objects & seeds["objects"]:
        selected["links"].add(link.name)
        selected["objects"].update(link_objects & registry.objects.keys())
```

요구사항 시트를 화면에 매칭하는 `intake.py` 역시 범용 메뉴 불용어(`GENERIC_MENU_TOKENS`)를 제외한 뒤 최고점이 `50.0` 이상이면서 유일한 단독 1위일 때만 매칭하고, 동점 후보가 발생하면 `Ambiguous tie`로 인간 검토를 요청한다.

```python
# src/repo_ontology/intake.py: 고유 최고점(>= 50.0) 검증 및 동점 후보의 인간 검토 보류
if best_by_view:
    candidates = sorted(best_by_view.values(), key=lambda x: x[1], reverse=True)
    top_view, top_score, top_reason = candidates[0]
    if top_score >= 50.0:
        tied = [v.view for v, s, _ in candidates if s == top_score]
        if len(tied) > 1:
            item.matched_view = None
            item.match_score = top_score
            item.match_reason = (
                f"Ambiguous tie ({', '.join(sorted(tied))} at {top_score:.1f}; "
                "heuristic candidate tie requires human review)"
            )
            unmatched.append(item)
            continue
        item.matched_view = top_view
        item.match_score = top_score
        item.match_reason = top_reason
        matched.append(item)
        continue
```

### 설계 기준 27개 항목 점검·보완 내역 및 `61 passed` 회귀 테스트

`v0.2.0` 개편 과정에서 27개 검증 항목의 반례를 점검하고, 실제 결함 보완과 과잉 규율 배제를 가른 판단 근거는 다음과 같다.

| 검토 항목 (`ID`) | 핵심 쟁점 및 검토 내용 | 반영 결과 | 엔지니어링 판단 근거 |
| :--- | :--- | :--- | :--- |
| **중복 YAML 키 및 중복 ID (`R-05`)** | 같은 YAML 파일 내 중복 키나 파일 간 동일 ID가 조용히 덮어써짐 | **반영** | `UniqueKeyLoader`와 `_insert` 중복 검사로 즉시 로딩 에러 처리 |
| **사전조건 `dict` 우회 (`R-06`)** | `PreconditionSpec` 실패 시 임의 `Dict`로 폴백되어 오타(`ruel:`) 통과 | **반영** | `OntologyModel(extra="forbid")` 및 `rule`/`rule_id`/`expression` 필수 검증 강제 |
| **Action 최상위 경로 및 `Link.through` (`RT-1`, `RT-2`)** | `request_schema`, `stats_service` 및 다대다 조인 객체(`through`) 누락 | **반영** | `lint`와 `trace` 양쪽 모두에서 최상위 경로와 조인 객체를 동일하게 추적 |
| **로컬 `precondition.id` 외래키 강제 (`R-16`)** | 모든 `precondition.id`와 자연어 규칙을 전역 `rules/` ID로 강제 검사하는 방안 | **제외** | 액션 고유의 인라인 조건 설명(`id`, `rule`)과 전역 불변식 참조(`rule_id`)는 역할이 다름. `rule_id`만 외래 참조로 검사 |
| **엔드포인트·라우트·`TD-4` 파일화 (`R-17`)** | `POST /api/...`, UI `route`, 기술 부채 ID(`TD-4`)까지 로컬 파일로 검사하는 방안 | **제외** | HTTP/RPC 프로토콜 선언과 화면 경로, 이슈 식별자(`[A-Z]+-\d+`)는 파일이 아님. 파일 실존 검사와 프로토콜 선언을 분리 |
| **외부 심볼릭 링크 전면 차단 (`R-14`)** | 저장소 루트 밖을 가리키는 모든 symlink를 경로 탈출 에러로 막는 방안 | **조건부 반영** | `../`와 절대 경로는 `ERROR`로 차단하되, 멀티 레포를 묶는 TRPG 허브의 명시적 symlink는 허용하고 소유권 미검증 `WARNING`(`external`) 부여 |
| **메타 저장소와의 강제 통합 (`R-01`)** | 설계 방법론 저장소(`ontology-workbench`)와 `repo-ontology`를 하나로 합치는 방안 | **제외** | 도메인 온톨로지 설계 프레임워크와 개별 저장소의 코드 바인딩 CLI(`code_specification`)는 책임 경계가 다르므로 분리 유지 |

이 결정들은 깨진 파이썬 문법 파일 검출, `otlg new` 경로 탈출(`../Escape`) 및 YAML 예약어(`false`, `null`, `yes`) 이스케이프, 줄바꿈 인젝션 차단, `intake` 디렉토리 쓰기 실패 종료 코드(`1`) 검증을 포함한 **61개(`61 passed`)** 회귀 테스트로 고정되었다.

[3편 본문으로 돌아가기](/tag-ontology-engineering/3-nouns-to-verbs-paradigm-shift/)

---

## v0.3.0 외부 오픈소스·논문 5대 원리 대조와 3-Graph·TDD 증거 봉인 {#three-graph-evidence}

### 4대 오픈소스·5대 논문 원리 흡수 및 의도적 제외(`Non-goals`) 대조표

`repo-ontology` `v0.3.0`을 설계하며 글로벌 오픈소스(`auto-ontology`, `ontology-atlas`, `agentforge-graph`, `EvoOntology`)와 소프트웨어 공학 논문(`MOOSEDev 2026`, `OntoUML 2025` 등)에서 흡수한 기능과, 로컬 CLI 헌법으로서의 정체성을 지키기 위해 의도적으로 제외한 범위(`Non-goals`)는 다음과 같다.

| 출처 | 확인한 핵심 원리 | `v0.3.0` 도입 및 구현 기능 | 의도적으로 제외한 범위 |
|---|---|---|---|
| **Ontology Atlas** (`wlsdks/ontology-atlas`) | 개념과 코드 경로의 연결, 선언 관계와 실행 영향 구분, 검토 가능한 변경 | 직접 바인딩 역조회, 정적 역방향 `import`, `Git` 전후 영향 비교, 근거 경로, 어노테이션 기반 경로 수정안 | 데스크톱 UI, Markdown 저장 형식으로 전환, `ACP`/`MCP` 서버, 런타임 전체 영향 보증 |
| **MOOSEDev 2026** (`arXiv:2608.13662`) | 생명주기, 대체 관계, 부정 제약, 지정 집합의 누락 없는 조회 | `lifecycle.status`/`supersedes`, `prohibition`/`forbidden`, `Top-K`를 사용하지 않는 전수 `brief` | `MOOSE` 엔진 의존, 신경기호 추론기, 대화 기억 저장소, 논문 벤치마크 성능 수치의 전용 |
| **EvoOntology** (`ruc-datalab/EvoOntology`) | 작업 근거에 따라 부족한 의미를 진단하고 후보를 검토·평가 | 명시한 파일 집합의 역방향 `coverage`, 미등록 파일 보고, 변경 후보(`preview`)와 적용(`--apply`) 분리 | 데이터 에이전트 실행 궤적 수집, 자율 스키마 진화, 자동 명세 생성·발행, 평가 엔진 |
| **NVIDIA auto-ontology** (`NVIDIA/auto-ontology`) | 에이전트가 소비하는 구조화 인터페이스, 출처와 검증 상태의 반환 | 전 명령 공통 `JSON` envelope, 표준 진단 코드 체계, `scope`/`completeness`/`assurance` 명시 | `TBox`/`RBox` 저장 계층, `PostgreSQL`/벡터 DB, `NL-to-SQL`, `NIM`, `RBAC` 웹 서비스 |
| **OntoUML 2025** (`FOIS 2025`) | 개념 명세와 코드 구조의 의미 연결 | `Object.state_machine`, 상태·전이·대상 `Action`의 정적 검증, 전이 계약 참조 | `UFO`/`OntoUML` 메타모델 전체, `EMF`/`ATL`, `Java` 코드 생성기, `YAML` 실행 엔진 |
| **자체 TDD 계약 설계** (`repo-ontology` 독자 설계) | 안정적인 요구사항 ID와 실제 테스트 실행 증거의 연결 | `contract`/`case` ID, `pytest` marker, 계약 해시와 소스 스냅샷 봉인, 수집·실행·의미 보증 분리 | `TDD` 수행 순서 인증, `assert` 단언문 의미 증명, 자동 테스트 품질 판정, 운영 환경 검증 |

### `SourceIndex` 분석 범위, `architecture.yml` 단일 소유권, `state_machine` 명세

정적 분석과 커버리지의 분모가 되는 소스 집합은 `analysis` 블록에 선언하며, `SourceIndex`는 런타임 `import` 없이 `Python` `AST`/`tokenize`와 `JS`/`TS` `tree-sitter` 파서로 정적 코드 그래프를 구축한다.

```yaml
version: "1.1.0"
analysis:
  include: ["backend/app/services/fee/**/*.py"]
  tests: ["backend/tests/unit/services/fee/test_*.py"]
  module_roots: [backend]
  aliases: {"@shared": frontend/src/shared}
  require_resolved: true
```

아키텍처 경계는 도메인 `Link`와 분리된 `architecture.yml`에서 규율한다. 분석 대상 파일의 단일 소유권(`unit`), 레이어 단방향 정책(`layers`), 교차 슬라이스 참조 금지(`forbid_cross_slice: true`), 그리고 `KST` 기준 만료일(`expires`)이 있는 한시적 예외를 정의한다.

```yaml
version: "1"
units:
  - id: fee-service
    domain: fee-billing
    layer: service
    include: ["backend/app/services/fee/**/*.py"]
  - id: fee-model
    domain: fee-billing
    layer: model
    include: ["backend/app/models/fee/**/*.py"]
dependency_policy:
  default: deny
  allow: [{from: fee-service, to: fee-model}]
  deny: []
exceptions:
  - id: temp-legacy-bridge
    from: fee-model
    to: fee-service
    reason: "레거시 정산 헬퍼 분리 전 임시 참조 허용"
    expires: "2026-12-31"
    rule_id: "rule:MIGRATION_TEMP_BRIDGE"
layers: [service, model]
forbid_cross_slice: true
```

도메인 객체의 상태 전이는 `Object.state_machine` 블록으로 선언하며, `status` 속성의 `enum` 값 일치 여부, 도달 불가능 상태, 종료(`terminal`) 상태 이탈 여부, 전이 유발 `action` 정합성을 정적으로 검증한다.

```yaml
state_machine:
  property: status
  initial: OPEN
  terminal: [CLOSED]
  transitions:
    - {id: CLOSE, from: [OPEN], to: CLOSED, action: CloseMonthlySnapshot}
```

### 표준 진단 코드 체계 (`JSON` Envelope Diagnostics)

모든 `CLI` 명령(`--json`)은 `output_schema`, `command`, `status`, `scope`, `completeness`, `assurance`, `data`, `diagnostics`를 포함한 단일 `JSON` 문서를 반환하며, 표준 진단 코드는 다음과 같다.

| 진단 코드 | 분류 및 의미 |
|---|---|
| `LOAD001` | 명세 로드, CLI 입력 인자, 또는 `Git`/실행 스냅샷 처리 실패 |
| `OWN001` / `OWN002` | `architecture.yml` 기준 중복 소유 코드 / 어느 단위에도 속하지 않은 미소유 코드 |
| `ARCH001` / `ARCH002` / `ARCH003` | 단위 간 의존성 정책 위반 / 레이어 역전 및 교차 슬라이스 침범 / 만료된 아키텍처 예외 |
| `BIND001` / `BIND002` | 소스 내 중복 `# otlg:bind` 어노테이션 / 선언된 바인딩 경로와 어노테이션 위치 불일치 |
| `CON001` / `CON002` / `CON003` / `CON004` | 잘못된 계약 ID 형식 / 존재하지 않는 참조 / 필수 테스트 매핑 누락 / 실행 증거 미충족 및 `stale` |
| `LIFE001` / `LIFE002` | 생명주기(`supersedes` 순환·분기 등) 선언 오류 / 대체된 옛 규칙(`superseded`) 제외 안내 |
| `STATE001` | `Object.state_machine` 상태·전이·도달 가능성·대상 `Action` 정합성 오류 |
| `ANALYSIS001` | 정적 파싱, 심볼 탐색, 또는 `import` 경로 해석 미완료(`unknown`) |
| `SCOPE001` | 규칙의 적용 범위(`applicability`) 불명확 또는 필수 속성 누락 |
| `LEGACY001` | 기존 `v0.2.0` 호환 경로 및 참조 린트 진단 |

### `contracts.yml` 매핑과 `pytest_plugin` 스냅샷 봉인 및 4종 반례 실증

`contracts.yml`은 고유 ID가 부여된 사전조건, 규칙, 상태 전이에 대해 필수 테스트 케이스(`cases`)를 선언한다.

```yaml
version: "1"
requirements:
  - contract: action:ProcessFeePayment/precondition:PAID_AMOUNT_POSITIVE
    cases:
      - {id: reject_zero, intent: reject}
  - contract: rule:LEDGER_OVER_REFUND_INVARIANT
    cases:
      - {id: reject_over_refund, intent: reject}
  - contract: object:FeeMonthlySnapshot/transition:CLOSE
    cases:
      - {id: open_to_closed, intent: transition}
```

테스트 함수는 `@pytest.mark.otlg_contract` 데코레이터로 계약과 케이스를 다대다(N:M) 매핑한다.

```python
@pytest.mark.otlg_contract(
    ref="rule:LEDGER_OVER_REFUND_INVARIANT",
    case="reject_over_refund",
)
def test_refund_rejects_overpayment():
    ...
```

`repo_ontology.pytest_plugin`을 활성화해 테스트를 실행하면 계약 해시와 시작·종료 시점의 전체 파일 스냅샷 해시가 `/tmp/otlg-evidence.json`에 봉인된다. 부분 실행(`-k`, `-m`, `deselect`)이나 `skip`/`xfail`은 통과 증거로 인정하지 않으며, 테스트 후 소스나 명세가 1바이트라도 바뀌면 `stale`(`CON004`)로 거부한다.

에듀테크 B2B SaaS 정산(`fee-billing`) 도메인 적용 및 4종 인메모리 반례(Negative Control) 실험 결과는 다음과 같다.

| 검증 항목 및 실험 구분 | 대상 및 조건 | 실증 결과 |
|---|---|---|
| **`repo-ontology` 자체 테스트** | `tests/test_v030.py` 및 엣지 케이스 포함 전체 스위트 | **97 passed** (기존 61 + 신규 36) |
| **실무 SaaS 정산 단위 테스트** | 결제·환불·월별 스냅샷 마감 서비스/CRUD 테스트 3개 파일 | **31 passed** (필수 계약 케이스 **9/9** 실행 통과) |
| **정적 커버리지 및 소유권 진단** | 분석 대상 원본 파일 7개 (`otlg coverage`) | 단일 소유권 **7/7**, 정확한 파일 바인딩 **6/7 (85.71%)** (`money.py` 미등록 정직 보고) |
| **반례 실험 1: 의존성 정책 제거** | 메모리 상에서 `architecture.yml`의 `allow` 정책 제거 | **`ARCH001` 27건** 즉시 검출 |
| **반례 실험 2: 테스트 매핑 제거** | 메모리 상에서 필수 계약의 `pytest` 마커 매핑 제거 | **`CON003` 9건** 전수 검출 |
| **반례 실험 3: 잘못된 상태 전이** | 상태 머신의 도착 상태를 존재하지 않는 `enum` 값으로 변조 | **`STATE001`** 정합성 오류 즉시 검출 |
| **반례 실험 4: 과거 스냅샷 주입** | 실행 증거 `JSON`의 스냅샷 해시를 과거 값으로 변조 | 필수 케이스 **9개 모두 `stale`(`CON004`)** 판정 및 거부 |

각 계약 케이스 리포트는 `mapping`(정적 마커 존재), `collection`(`pytest` 수집 성공), `execution`(실제 통과 및 스냅샷 해시 일치), `semantics`(`not_assessed`, 단언문의 비즈니스 의미는 인간·리뷰어 감사 영역으로 분리) 4단계로 투명하게 보고된다.

[4편 본문으로 돌아가기](/tag-ontology-engineering/4-three-graphs-and-tdd-contract-v030/)
