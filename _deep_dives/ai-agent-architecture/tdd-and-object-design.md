---
layout: page
title: "심화 | 객체 설계 46규칙과 테스트 하든·QA 게이트"
description: "Object Design Style Guide 기반 6대 섹션 46개 객체 설계 규칙과 Before/After 코드 예제, /tdd-plan 및 /go 워크플로우 명세, 그리고 /test-harden Critic Agent의 테스트 감사 규칙과 Playwright QA 게이트 상세 레퍼런스"
permalink: /tag-ai-agent-architecture/deep-dive/tdd-and-object-design/
deep_dive_for: ai-agent-architecture
related_main_orders: [3, 4]
published: true
---

- table of contents
{:toc}

이 문서는 **[[3편] 객체지향을 배웠으니 선생님을 가르쳐보겠습니다](/tag-ai-agent-architecture/3-teach-object-design/)**와 **[[4편] 역시 내 테스트 스위트는 잘못됐다](/tag-ai-agent-architecture/4-all-passed-empty-screen/)**에서 다룬 단일 세션 TDD 품질 엔진의 심화 레퍼런스다. 본편의 서사 호흡을 위해 덜어낸 『Object Design Style Guide』 기반 6대 섹션 46개 규칙 전체 카탈로그, `/tdd-plan`·`/go` 단계별 리팩토링 코드 전문, 그리고 `/test-harden`의 8대 카탈로그 38개 테스트 감사 매트릭스와 `Playwright` QA 게이트 계약을 수록했다.

---

## Object Design 6대 섹션 46개 규칙과 TDD Plan·Go 리팩토링 코드 전문 {#object-design-rules}

### 객체 설계 원칙별 Before/After 코드 전문 (3편 이관)

#### 원시값 집착(Primitive Obsession) 해소와 값 객체 추출

항상 단짝처럼 함께 묶여 다니는 원시값 클러스터를 찾아 불변 값 객체(`Value Object`)로 승격시키는 과정이다.

```text
country_code + phone + is_verified      -> Phone
present + late + early_leave + absent   -> AttendanceCount
score + max_score + percentage          -> Score
```

```python
# [Before] 원시 타입 나열: str 순서가 바뀌어도 통과되고, 검증 로직이 호출부마다 중복 복사된다
def send_verification(country_code: str, phone: str, is_verified: bool) -> None:
    if not country_code.startswith("+"):
        raise ValueError("국가 코드 형식 오류")
    if len(phone) < 9:
        raise ValueError("전화번호 길이 오류")
    ...

# [After] 자기 검증(Self-validation)과 도메인 행동을 응집한 값 객체
@dataclass(frozen=True)
class Phone:
    country_code: str
    number: str
    is_verified: bool = False

    def __post_init__(self) -> None:
        if not self.country_code.startswith("+"):
            raise ValueError("국가 코드는 +로 시작해야 한다")
        if not self.number.isdigit() or len(self.number) < 9:
            raise ValueError("유효하지 않은 전화번호 형식이다")

    def mark_verified(self) -> "Phone":
        # mut-copy-on-modify: 불변 객체는 상태를 바꾸는 대신 복사본을 반환한다
        return Phone(self.country_code, self.number, is_verified=True)
```

```python
class Score:
    def __init__(self, score: int, max_score: int) -> None:
        if max_score <= 0:
            raise ValueError("만점은 0보다 커야 한다")
        if not 0 <= score <= max_score:
            raise ValueError("점수가 범위를 벗어났다")
        self._score, self._max = score, max_score

    def percentage(self) -> Decimal:
        return (Decimal(self._score) / Decimal(self._max)) * Decimal(100)

    def is_pass(self, cut: int) -> bool:
        return self._score >= cut

    def grade(self) -> str:
        pct = self.percentage()
        if pct >= Decimal(90):
            return "A"
        if pct >= Decimal(80):
            return "B"
        return "C"
```

#### CQS(명령·질의 분리)와 테스트 대역 선택

```text
Query(값을 돌려받음)       -> Stub / Fake.  반환값 -> 결과로 검증
Command(부수효과를 일으킴) -> Mock / Spy.   호출 여부·인자로 검증
System Boundary(외부 API)  -> 인메모리 구현. 격리
```

```python
class Counter:
    def increment(self) -> None:            # Command: 상태를 변경하고 반환값이 없다
        self._count += 1

    def current_count(self) -> int:         # Query: 값을 반환하고 내부 상태를 건드리지 않는다
        return self._count

    def increment_and_return(self) -> int:  # [위반] Command와 Query가 뒤섞여 부수효과 예측 불가
        self._count += 1
        return self._count
```

```python
# [위반] Query 의존성에 Mock을 사용한 동어반복(Mock Tautology) 및 과잉 명세
def test_converts_amount_bad():
    mock_rates = Mock()
    mock_rates.exchange_rate_for.return_value = Decimal("0.8")  # 내가 설정하고
    result = CurrencyConverter(mock_rates).convert(Decimal("100"), "USD", "EUR")
    assert result == Decimal("80.0")                            # 내가 꺼내 확인
    mock_rates.exchange_rate_for.assert_called_once()           # 캐시 도입 시 깨지는 화이트박스 단언

# [준수] Query 의존성에는 직접 작성한 Stub/Fake를 주입하고 결과값만 단언한다
class FakeExchangeRates:
    def __init__(self, rates: dict[tuple[str, str], Decimal]) -> None:
        self._rates = rates

    def exchange_rate_for(self, origin: str, target: str) -> Decimal:
        return self._rates[(origin, target)]

def test_converts_amount_good():
    rates = FakeExchangeRates({("USD", "EUR"): Decimal("0.8")})
    result = CurrencyConverter(rates).convert(Decimal("100"), "USD", "EUR")
    assert result == Decimal("80.0")
```

#### 생성자 실패 전용 테스트와 개체(Entity) 도메인 이벤트 검증

```python
# [위반] 정상 생성(happy path) 확인을 위해 불필요한 getter 노출을 강제하는 테스트
def test_coordinates_can_be_constructed():
    coords = Coordinates(latitude=60.0, longitude=100.0)
    assert coords.latitude == 60.0     # 비즈니스 로직에 쓰이지 않는 getter를 뚫어야 한다
    assert coords.longitude == 100.0

# [준수] 생성자 전용 테스트는 match= 패턴과 함께 오직 실패 케이스만 검증한다
def test_latitude_must_be_within_range():
    with pytest.raises(ValueError, match="Latitude"):
        Coordinates(latitude=90.1, longitude=0.0)
```

```python
# [위반] 개체(Entity)의 상태 변경을 내부 속성 getter로 직접 꺼내 비교
def test_player_moves_left_bad():
    player = Player(Position(10, 20))
    player.move_left(4)
    assert player.current_position == Position(6, 20)  # 내부 자료구조에 강결합된다

# [준수] 개체가 기록한 도메인 이벤트의 포함 여부(in)와 후속 행위 결과로 검증
def test_player_moves_left_good():
    player = Player(Position(10, 20))
    player.move_left(4)
    assert PlayerMoved(Position(6, 20)) in player.release_events()
```

### /tdd-plan Forces Analysis 템플릿과 /go Pattern Signal Detection 매트릭스

`/tdd-plan`의 Stage 1에서는 3개의 읽기 전용 탐색 에이전트(코드 탐색, 테스트 영향, VO 후보)가 수집한 사실을 바탕으로 **Forces Analysis 및 CVA(공통성·가변성 분석)** 표를 작성한다.

```markdown
### Forces Analysis & CVA (Stage 1)

**변동 식별 (Variability)**: 이 기능에서 무엇이 변하고, 왜 변하는가?
| 변동 요소 | 변경 주기 및 이유 | 독립성 | 코드베이스 탐색 근거 |
|:---|:---|:---:|:---|
| 할인 계산 정책 | 분기별 프로모션 정책 추가 | 독립적 변동 | `discount_service.py` 내 `if/elif` 4분기 확인 |

**공통 구조 식별 (Commonality)**: 위 변동들이 공유하는 안정된 뼈대는 무엇인가?
| 공통 구조 (시그니처/흐름) | 공유하는 변동 대상 | 추상화 경계(Seam) 후보 |
|:---|:---|:---|
| `calculate(subtotal, member) -> Money` | 정액·정률·시즌 할인 정책 전체 | `DiscountPolicy` 프로토콜 + Factory |
```

구현 루프인 `/go`의 Step 6-2(`Pattern Signal Detection`)에서는 코드가 작성된 후 아래 12가지 구조적 신호를 재평가하여, 실제 힘(Force)이 임계점을 넘었을 때만 패턴으로 리팩토링한다.

| 감지 신호 (Signal) | 코드 내 진단 기준 | 아키텍처 반응 및 처방 |
|:---|:---|:---|
| **Identity Coupling 성장** | 한 메서드/클래스에 `if/elif`가 3개 이상이며 각 분기가 독립 진화 | `Strategy` 인터페이스 추출 + `Factory`로 결정 이주 |
| **조합 폭발 ($2^n$)** | 서브클래스가 옵션 조합으로 급증하거나 불리언 플래그 인자가 3개 이상 | 변동을 상속이 아닌 데이터 리스트/파이프라인(`Decorator`)으로 이동 |
| **무효한 조합 가능성** | 여러 전략이 자유 조합되나 도메인상 함께 쓰이면 안 되는 세트가 존재 | `Abstract Factory`로 유효한 제품군(Family) 제약 |
| **거대한 테스트 (Large Test)** | 단일 테스트에 단언문 5개 이상 또는 과도한 협력자 셋업 필요 | 응집도 부족 신호로 판단해 책임 분리 후 재테스트 |
| **Factory의 행위 호출** | Factory 내부에서 객체를 생성한 뒤 비즈니스 `.method()`까지 실행 | 생성과 사용 분리 황금률 위반이므로 `create-only`로 분리 |
| **Construction Leak** | Factory 바깥 클라이언트 코드에서 구체 클래스 `ClassName()` 직접 호출 | 생성 책임을 `Factory`로 모아 Identity Coupling 격리 |
| **단계들의 동반 변경** | 알고리즘 뼈대는 고정인데 내부 단계 구현만 세트로 교체됨 | `Template Method` 적용(과잉 분리된 Strategy는 다운그레이드) |
| **런타임 결정 불확실성** | 요청 조건에 따라 처리 경로가 동적으로 바뀌고 조기 중단/우회 필요 | `Chain of Responsibility(CoR)` 도입 검토 |
| **행위의 정체성 상실** | 함수 호출에 실행 취소(`undo`), 큐잉, 감사 로그, 재실행 요구 부착 | 행위를 불변 객체(`frozen dataclass`)로 캡슐화하는 `Command` 패턴 |
| **Mode Smearing** | 동일한 `if status == ...` 상태 분기가 여러 핸들러에 복제·번짐 | 상태 전이 규칙을 상태 객체 내부로 옮기는 `State` 패턴 |
| **Polling과 시간 결합** | 소비자가 타이머/루프로 상태 변화를 찔러보거나 발행자가 구체 소비자 참조 | 발행-구독 역전을 통한 `Observer` / 도메인 이벤트 분리 |
| **조정 결합 비대화** | 객체가 자기 본연의 책임보다 협력 객체들의 호출 순서를 중재하느라 비대해짐 | 조정 책임을 전용 경계로 추출하는 `Mediator` 패턴 |

### Object Design Practices 6대 섹션 46개 규칙 전체 카탈로그

`/object-design-practices` 스킬과 `/go`의 Step 6-1(`ODP Critic Agent`)이 참조하는 6개 카테고리 46개 규칙 전체 명세다.

#### Section 1. Service Construction (`svc-*`, CRITICAL, 8개 규칙)

| 규칙 ID | 규칙 요약 | 핵심 판정 기준 및 위반 신호 |
|:---|:---|:---|
| `svc-constructor-inject` | 의존성은 생성자로 주입한다 | 메서드 내부에서 다른 서비스를 직접 인스턴스화하거나 전역 싱글톤 호출 금지 |
| `svc-inject-actual-dep` | 서비스 로케이터가 아닌 실제 의존성을 주입한다 | `Container`나 `Context` 전체를 넘기지 않고 필요한 인터페이스만 정확히 명시 |
| `svc-all-args-required` | 서비스 생성자의 모든 인자는 필수여야 한다 | `repo: UserRepo | None = None` 같은 선택적 기본값 금지(필요시 `NullObject` 주입) |
| `svc-constructor-only` | 오직 생성자 주입만 사용한다 | `set_logger()` 같은 세터 주입(Setter Injection)이나 속성 직접 교체 금지 |
| `svc-explicit-deps` | 모든 외부 의존성을 명시적으로 드러낸다 | 현재 시각(`Clock`), 난수 생성기, 환경 설정값도 암시적 전역 호출 대신 주입 |
| `svc-method-arg-for-task` | 작업별 컨텍스트 데이터는 메서드 인자로 전달한다 | 요청마다 달라지는 `user_id`나 `request_data`를 서비스 생성자 필드에 저장 금지 |
| `svc-immutable-after-creation` | 서비스는 생성된 이후 완전한 불변이어야 한다 | 서비스 실행 도중 `self._state = ...` 형태로 내부 속성을 변경하는 행위 금지 |
| `svc-constructor-assign-only` | 서비스 생성자는 속성 할당만 수행한다 | `__init__` 내부에서 DB 연결 수립, 파일 열기, 네트워크 호출 등 부수효과 수행 금지 |

#### Section 2. Object Construction (`obj-*`, CRITICAL, 8개 규칙)

| 규칙 ID | 규칙 요약 | 핵심 판정 기준 및 위반 신호 |
|:---|:---|:---|
| `obj-require-minimum-data` | 일관된 행위에 필요한 최소 데이터를 생성 시 요구한다 | 빈 객체 생성 후 세터로 값을 채우는 2단계 초기화(Two-step initialization) 금지 |
| `obj-require-meaningful-data` | 도메인 불변식을 만족하는 유의미한 데이터만 허용한다 | 생성자를 통과한 객체는 이후 어디서든 유효한 상태임이 100% 보장되어야 함 |
| `obj-extract-value-object` | 중복 검증을 제거하기 위해 값 객체를 추출한다 | 이메일, 전화번호, 금액 등 도메인 제약이 따르는 원시값을 별도 VO 클래스로 분리 |
| `obj-extract-composite` | 함께 다니는 복합 원시값 클러스터를 새 객체로 묶는다 | `amount` + `currency`를 `Money`로, `start_date` + `end_date`를 `DateRange`로 통합 |
| `obj-use-assertions` | 생성자 사전 조건 검증에 명확한 단언/예외를 사용한다 | 잘못된 입력이 들어오면 조용히 보정하지 않고 즉시 도메인 예외를 발생시킴 |
| `obj-no-di-in-values` | 값 객체와 엔티티에는 서비스 의존성을 주입하지 않는다 | 도메인 객체 생성자에 `Repository`나 외부 API 클라이언트를 넘기는 설계 금지 |
| `obj-named-constructors` | 도메인 의도를 드러내는 명명된 생성자를 사용한다 | 기본 `__init__` 대신 `@classmethod def place(...)`, `from_ cents(...)` 등으로 의도 표현 |
| `obj-dto-exception` | DTO는 도메인 객체 생성 규칙의 예외로 다룬다 | 입력 경계의 DTO는 생성자 즉시 예외 대신 필드 수집형 검증(`validate()`) 허용 |

#### Section 3. Mutability & State (`mut-*`, HIGH, 7개 규칙)

| 규칙 ID | 규칙 요약 | 핵심 판정 기준 및 위반 신호 |
|:---|:---|:---|
| `mut-immutable-first` | 기본적으로 불변(Immutable) 객체를 우선 선택한다 | 식별자와 생명주기가 꼭 필요한 `Entity`를 제외한 모든 모델은 `@dataclass(frozen=True)` |
| `mut-copy-on-modify` | 불변 객체의 변경 연산은 수정된 새 복사본을 반환한다 | `money.add(other)`는 원본 `money`를 바꾸지 않고 합산된 새 `Money` 인스턴스를 반환 |
| `mut-naming-convention` | 가변 객체는 명령형, 불변 객체는 서술형/선언형 이름을 쓴다 | 가변 개체는 `move_left()`, 불변 값 객체는 `to_the_left()` 또는 `with_discount()`로 구분 |
| `mut-equality-comparison` | 불변 객체는 식별자가 아닌 값 동등성(`==`)으로 비교한다 | 두 값 객체의 내부 속성값이 같으면 동등한 객체로 판정(`is` 참조 비교 금지) |
| `mut-valid-after-mutation` | 가변 객체는 상태 변경 직후에도 항상 유효해야 한다 | 상태 변경 메서드 내부에서도 생성자와 동일한 도메인 불변식 검증을 통과해야 함 |
| `mut-valid-state-transition` | 비즈니스 규칙으로 상태 전이를 엄격히 방어한다 | `DELIVERED` 상태의 주문을 `cancel()`하려 할 때 상태 전이 예외로 즉시 차단 |
| `mut-record-domain-events` | 상태 변경의 기록으로 도메인 이벤트를 남긴다 | 개체의 상태가 전이될 때 내부 리스트에 `OrderCancelled` 등의 도메인 이벤트를 적재 |

#### Section 4. Method Design & CQS (`method-*`, CRITICAL, 10개 규칙)

| 규칙 ID | 규칙 요약 | 핵심 판정 기준 및 위반 신호 |
|:---|:---|:---|
| `method-template` | 메서드 5단계 구현 템플릿을 준수한다 | (1) 사전 조건 검증 -> (2) 실패 경로 -> (3) 해피 경로 -> (4) 사후 처리 -> (5) 반환/이벤트 |
| `method-exception-naming` | 예외 이름은 원인에 따라 `Invalid...` 또는 `CouldNot...`으로 짓는다 | 호출자 인자 결함은 `InvalidEmail`, 외부/런타임 실패는 `CouldNotSaveOrder`로 구분 |
| `method-named-exception-ctor` | 커스텀 예외에 명명된 생성자 메서드를 제공한다 | 호출부에서 문자열 포맷팅을 하지 않고 `CouldNotFindUser.with_id(user_id)` 호출 |
| `method-cqs-separation` | 명령(Command)과 질의(Query)를 엄격히 분리한다 | 상태를 바꾸면 `None`을 반환하고, 값을 반환하면 내부 상태를 절대 변경하지 않음 |
| `method-single-return-type` | 질의 메서드는 단일 타입만 반환한다 | 성공 시 객체, 실패 시 `False`나 에러 코드를 섞어 반환하는 혼합 반환 타입 금지 |
| `method-information-hiding` | 내부 상태를 단순 `getter`로 무분별하게 노출하지 않는다 | 데이터를 꺼내 밖에서 계산하지 말고 객체에게 행위를 요청(Tell, Don't Ask) |
| `method-domain-abstraction` | 시스템 경계에는 저수준 클라이언트가 아닌 도메인 추상화를 둔다 | `SmtpClient` 대신 `PasswordResetMailer`처럼 도메인 언어로 정의된 인터페이스 사용 |
| `method-command-scope` | 명령의 직접 범위를 제한하고 부차적 파생 작업은 이벤트로 분리한다 | 핵심 상태 저장 후 이메일 발송·통계 갱신 등은 도메인 이벤트 수신자로 위임 |
| `method-query-chain-purity` | 질의 메서드의 호출 사슬 전체에 명령이 섞이지 않게 한다 | `Query`가 내부적으로 호출하는 하위 메서드들 역시 부수효과가 전혀 없어야 함 |
| `method-command-allows-query` | 명령 메서드는 정보 수집을 위해 질의를 호출할 수 있다 | `Command` 실행 전 현재 상태를 확인하기 위해 `Query`를 부르는 단방향 의존은 허용 |

#### Section 5. Responsibility & Architecture (`arch-*`, HIGH, 7개 규칙)

| 규칙 ID | 규칙 요약 | 핵심 판정 기준 및 위반 신호 |
|:---|:---|:---|
| `arch-separate-read-write` | 쓰기 모델(Write Model)과 읽기 모델(Read Model)을 분리한다 | 복잡한 상태 변경 불변식을 지키는 엔티티를 단순 목록 조회 화면에 그대로 재사용하지 않음 |
| `arch-usecase-read-model` | 구체적인 조회 유스케이스에 맞춘 전용 읽기 모델을 설계한다 | 화면이나 API 응답 셰이프에 꼭 필요한 필드만 담은 불변 Read DTO 구성 |
| `arch-direct-from-source` | 읽기 모델은 데이터 소스(DB)에서 직접 쿼리해 생성한다 | ORM 엔티티 수백 개를 메모리에 올린 뒤 루프를 돌며 DTO로 변환하는 비효율 금지 |
| `arch-event-driven-read` | 필요한 경우 도메인 이벤트로 비정규화된 읽기 모델을 구축한다 | 조회 성능이 중요한 대시보드 등은 이벤트 수신자를 통해 읽기 전용 뷰/테이블 갱신 |
| `arch-compose-not-inherit` | 행위 변경과 재사용에는 상속보다 합성(Composition)을 쓴다 | 부모 클래스의 메서드를 오버라이드해 동작을 비트는 상속 계층 대신 협력 객체 주입 |
| `arch-decorate-to-extend` | 기존 코드를 수정하지 않고 데코레이터로 부가 행위를 확장한다 | 로깅, 캐싱, 재시도 로직은 원본 서비스와 동일 인터페이스를 구현한 데코레이터로 감쌈 |
| `arch-final-private-default` | 클래스는 확장 닫힘(`final`), 속성은 비공개(`_private`)를 기본값으로 삼는다 | 의도하지 않은 서브클래싱과 외부의 내부 속성 직접 조작을 구조적으로 차단 |

#### Section 6. Testing Strategy (`test-*`, HIGH, 6개 규칙)

| 규칙 ID | 규칙 요약 | 핵심 판정 기준 및 위반 신호 |
|:---|:---|:---|
| `test-constructor-failure-only` | 생성자는 오직 실패 케이스만 테스트한다 | 정상 생성(happy path) 단독 테스트 금지, 잘못된 입력에 대한 예외 발생만 단언 |
| `test-events-for-mutation` | 가변 객체의 상태 변화는 도메인 이벤트로 검증한다 | `getter` 노출 대신 `release_events()`에 기록된 이벤트와 후속 행위로 검증 |
| `test-stub-for-query` | 질의 의존성에는 스텁(Stub)이나 가짜(Fake)를 사용한다 | 질의 메서드의 호출 여부나 호출 횟수를 `Mock`으로 검증하는 과잉 명세 금지 |
| `test-mock-for-command` | 명령 의존성에는 목(Mock)이나 스파이(Spy)를 사용한다 | 부수효과를 일으키는 명령이 정확한 인자와 횟수로 호출되었는지 단언 |
| `test-exception-message` | 예외 테스트 시 타입뿐 아니라 메시지 패턴까지 검증한다 | `pytest.raises(ValueError, match="...")`로 의도한 검증 분기에서 터졌는지 고정 |
| `test-object-not-class` | 클래스 내부 구현이 아니라 객체의 외부 행위(Black-box)를 테스트한다 | 내부 비공개 메서드 호출이나 모든 협력자의 Mock 대체를 피하고 관찰 가능한 결과만 검증 |

#### 실무 프레임워크 예외 및 유예 기준 (Known Waivers & Gotchas)

규칙은 맹목적 교리가 아니라 **"왜 어기는지 기술적으로 설명할 수 있게 만드는 높은 기준선"**이다. 실무 스택(`FastAPI`, `SQLAlchemy`)과 결합할 때 사전 승인된 구조적 예외(`Known Waiver`)는 다음과 같다.
- **FastAPI `Depends()` 주입**: 라우터 계층에서 프레임워크의 `Depends()`를 사용하는 것은 `svc-constructor-inject` 위반으로 보지 않는다.
- **CRUD `create()`의 생성 ID 반환**: 영속성 계층에서 레코드 생성 직후 PK나 엔티티를 반환하는 프레임워크 관례는 `method-cqs-separation` 예외로 기록한다.
- **SQLAlchemy ORM 모델의 가변성**: ORM 매핑 모델은 프레임워크 특성상 가변(Mutable)이므로 `mut-immutable-first` 위반에서 제외하되, 핵심 계산 로직은 불변 값 객체나 순수 함수로 추출한다.

- [3편 본문으로 돌아가기](/tag-ai-agent-architecture/3-teach-object-design/)

---

## /test-harden Critic Agent 테스트 감사 매트릭스와 Playwright QA 계약 {#test-harden-and-qa}

### 사전 드리프트 방지: 경계 정합성 표 3종 상세 명세 (4편 이관)

코드 작성 전 `/tdd-plan`의 Stage 3에서 의무적으로 작성하고 `/go`의 Step 6-3에서 실제 구현 코드와 재대조하는 3종 표의 실전 규격이다.

#### 계약 표 (Contract Table: Default · 필수값 · Role 정합)

| 엔드포인트 (`Role`) | FE 호출 · 파라미터 | BE 필수 제약 | FE 기본값 | 판정 |
|:---|:---|:---|:---|:---:|
| `GET /my/billing/list`<br>(`student`, `parent`) | `useBillingList`<br>(`billing_month`) | 필수 (`Query(...)`) | `''` (빈 문자열) | 부적합 (`422`) |
| `POST /my/discounts`<br>(`admin`, `teacher`) | `createDiscount`<br>(`name`, `type`, `value`) | 모두 필수 (`Body(...)`) | 폼 검증 시 전송 | 적합 |
| `POST /admin/users/promote`<br>(`admin`) | `promoteUser`<br>(`user_id`, `role`) | 모두 필수 (`Body(...)`) | 폼 검증 시 전송 | 적합 |

- **차단 규칙**: 정합 판정에 `부적합`이 단 한 줄이라도 있거나 `접근 Role` 칸이 비어 있으면 Phase 1(코드 구현) 진입을 금지한다.

#### 셰이프 표 (Shape Table: 응답 필드 추적 및 FK Resolution)

| 추적 필드 | DB 컬럼 | List 응답 DTO | Detail 응답 DTO | FE List 변환기 | FE Detail 매퍼 |
|:---|:---:|:---:|:---:|:---:|:---:|
| `students.payment_date` | 존재 | 누락 | 존재 | 누락 | 존재 |
| `agent_runs.user_id` (FK) | 존재 | 존재 | 존재 | 존재 | 존재 |
| `-> username` (FK 표시명) | 해당 없음 | 누락 | 누락 | 누락 | 누락 |
| `homework.max_score` | 미존재 | - | - | - | - |

- **차단 규칙**: 외래키(FK) 필드는 반드시 화면에 표시할 이름(`-> username` 등 Resolved 행)을 동반해야 하며, DB 컬럼 칸이 `미존재`인 경우 Phase 1의 첫 번째 작업으로 스키마 마이그레이션 TODO를 강제 추가한다.

#### 트리거 표 (Trigger Table: 단일 행위 및 Multi-step 사슬 추적)

| 행위 사양 | 단계 구분 | 책임 코드 | 호출 트리거 | 자연 진입점 도달 여부 |
|:---|:---|:---|:---|:---|
| 매월 1일 청구서 자동 생성 | 단일 | `ensure_current_monthly_billing` | 상세(detail) 진입 시 1건만 | 미도달 (목록 첫 진입 시 빈 화면) |
| 할인 정책 변경 시 재계산 | 단일 | `_recalculate` | 할인 적용 API 내부 | 도달 |
| 신규 구성원 초대 플로우 | (1) 일괄 생성 | `MemberService.bulk_create` | 관리자 POST 요청 | 도달 |
| `->` | (2) 인증 서버 초대 | `AuthService.invite` | (1) 완료 후 자동 호출 | 도달 |
| `->` | (3) 초대 수락 화면 | `InviteAcceptPage` | 이메일 링크 클릭 | 미도달 (수락 페이지 누락) |
| `->` | (4) 최초 로그인 연동 | `AuthService.first_login` | 수락 완료 후 자동 전환 | 도달 |

### /test-harden 8대 카탈로그 38개 테스트 감사 규칙 전체 매트릭스

`/go`를 통한 Feature 구현이 완료된 직후, 대화 맥락이 완전히 격리된 `Test Critic Agent`가 테스트 코드(`tests/`)를 전수 감사할 때 사용하는 8개 카탈로그 38개 규칙 매트릭스다.

#### 카탈로그 1. `test-meta-principles` (4개 규칙)

| 규칙 ID | 심각도 | 핵심 감사 기준 | 위반 신호 및 교정 방향 |
|:---|:---:|:---|:---|
| `meta-valid-test` | CRITICAL | Behavioral + Structure-insensitive 동시 충족 | 프로덕션 로직을 주석 처리해도 통과하거나, 내부 변수명만 바꿔도 깨지는 테스트 |
| `meta-blackbox-not-class` | HIGH | 클래스 내부가 아닌 객체의 외부 관찰 가능 행위 검증 | 모든 협력자를 `Mock`으로 덮고 `assert_called_once()`만 나열한 화이트박스 테스트를 인메모리 저장소 + 결과 단언으로 전환 |
| `meta-aaa-pattern` | LOW | 준비(Arrange) -> 실행(Act) -> 단언(Assert) 3단 구성 | 한 테스트 함수 안에서 `Act -> Assert -> Act -> Assert`를 여러 번 반복하는 구조 분리 |
| `meta-top-down` | LOW | 기능 진입점(API/UI) 통합 시나리오 존재 여부 | 단위 테스트만 존재하고 실제 엔드포인트나 화면 배선을 확인하는 통합 테스트가 0건인 경우 |

#### 카탈로그 2. `test-dependencies-doubles` (7개 규칙)

| 규칙 ID | 심각도 | 핵심 감사 기준 | 위반 신호 및 교정 방향 |
|:---|:---:|:---|:---|
| `dep-stub-for-query` | CRITICAL | 질의(Query) 의존성에는 스텁/가짜만 사용 | 조회 메서드에 `assert_called_once()`나 `call_count`를 단언하면 즉시 제거 |
| `dep-mock-for-command` | CRITICAL | 명령(Command) 의존성에는 목/스파이로 부수효과 검증 | 외부 상태를 바꾸는 명령 의존성에 단순 스텁만 물려두고 호출 여부·인자를 검증하지 않는 누락 교정 |
| `dep-mock-tautology` | CRITICAL | Mock 동어반복 원천 금지 | `mock.return_value = X` 설정 직후 단순 위임 함수를 거쳐 `assert result == X`를 단언하는 가짜 테스트 삭제 또는 실제 DB 통합 이관 |
| `dep-system-boundary-only` | HIGH | 테스트 대역은 오직 시스템 경계(외부 IO)에서만 사용 | 내부 도메인 객체(`Entity`, `Value Object`)나 순수 계산 서비스를 `Mock`으로 대체하는 행위 금지 |
| `dep-domain-abstraction` | MEDIUM | 저수준 인프라가 아닌 도메인 인터페이스를 대역화 | 테스트가 `requests`, `urllib`, `sqlalchemy.Session` 내부 메서드를 직접 `@patch`하는 결합 제거 |
| `dep-single-return-type` | MEDIUM | 질의 반환 타입 단일화 검증 | 테스트 코드 내부에 `if result is not None:` 같은 조건 분기가 들어가면 질의 계약 재설계 |
| `dep-null-object` | LOW | 검증하지 않는 의존성에는 빈 `Mock()` 대신 `NullObject` 주입 | 아무런 단언도 하지 않으면서 습관적으로 `Mock()`을 생성자에 꽂아 넣는 패턴 정비 |

#### 카탈로그 3. `test-constructors` (6개 규칙)

| 규칙 ID | 심각도 | 핵심 감사 기준 | 위반 신호 및 교정 방향 |
|:---|:---:|:---|:---|
| `ctor-failure-only` | HIGH | 생성자 단독 테스트는 오직 실패 케이스만 작성 | 객체 생성 직후 속성 `getter`를 호출해 입력값과 같은지 비교하는 정상 생성 테스트 삭제 |
| `ctor-exception-message` | MEDIUM | 예외 검증 시 `match=` 키워드 필수 명시 | `with pytest.raises(ValueError):`처럼 예외 타입만 적어 다른 인자 검증 오류에 거짓 통과하는 허점 차단 |
| `ctor-boundary-values` | MEDIUM | 도메인 불변식의 경계값(최소·최대·빈값) 테스트 | 범위 제약(`0 <= score <= max_score`)이 있는 객체에 경계값(`-1`, `0`, `max`, `max + 1`) 테스트 보강 |
| `ctor-domain-rule-only` | LOW | 정적 타입 체커가 잡는 타입 오류는 테스트 생략 | `int` 인자에 `str`을 넣는 무의미한 테스트 대신 도메인 규칙 위반에 집중 |
| `ctor-named-constructor` | LOW | 명명된 생성자(`Order.place`) 우선 사용 | 도메인 팩토리 메서드가 존재함에도 테스트가 기본 생성자와 세터로 픽스처를 조립하는 관행 교정 |
| `ctor-vo-extracted` | LOW | 값 객체로 추출된 검증은 해당 VO 테스트 한 곳에서만 수행 | `Email` VO에서 이미 검증한 이메일 정규식을 `User`, `Order` 테스트마다 중복 작성하는 낭비 제거 |

#### 카탈로그 4. `test-method-template` (5개 규칙)

| 규칙 ID | 심각도 | 핵심 감사 기준 | 위반 신호 및 교정 방향 |
|:---|:---:|:---|:---|
| `method-postcondition-rare` | HIGH | 불필요한 사후 조건(Postcondition) 과잉 단언 금지 | 방금 저장한 객체를 꺼내 모든 필드를 일일이 재비교하는 피로 유발 단언 제거 |
| `method-precondition-vs-runtime` | MEDIUM | 사전 조건 실패(`Invalid...`)와 실행 중 실패(`CouldNot...`) 구분 | 클라이언트 인자 결함과 외부 인프라 실패를 동일한 범용 예외로 뭉뚱그려 검증하는 구조 분리 |
| `method-test-order` | LOW | 사전 조건 -> 실패 경로 -> 해피 경로 순서로 테스트 배치 | 한 테스트 안에서 정상 흐름과 예외 흐름을 섞어 검증하는 Eager Test 분리 |
| `method-early-return-cases` | LOW | 조기 반환(Early Return) 경로별 독립 테스트 케이스화 | 여러 분기 반환 경로를 직렬 나열하지 않고 독립 케이스나 `@pytest.mark.parametrize`로 분리 |
| `method-exception-named-ctor` | LOW | 예외 메시지 포맷 결합 방지 | 커스텀 예외의 명명된 생성자를 활용해 메시지 문구 미세 수정 시 테스트가 깨지지 않게 보호 |

#### 카탈로그 5. `test-mutable-entities` (6개 규칙)

| 규칙 ID | 심각도 | 핵심 감사 기준 | 위반 신호 및 교정 방향 |
|:---|:---:|:---|:---|
| `mut-event-and-state` | CRITICAL | 이벤트 기록과 실제 내부 상태 전이의 교차 증명 | `release_events()`만 확인하고 끝내면 상태 갱신을 누락한 버그가 통과하므로, 후속 행위(`cancel()` 후 `add_item()` 거부 등) 테스트를 반드시 쌍으로 작성 |
| `mut-events-not-getter` | HIGH | 가변 개체의 상태 변화는 `getter` 대신 도메인 이벤트로 확인 | 상태 변경 메서드 호출 직후 비공개 필드나 테스트 전용 `getter`를 찌르는 단언문 제거 |
| `mut-assertcontains-not-eq` | MEDIUM | 이벤트 목록은 전체 동등 비교(`==`) 대신 포함 여부(`in`)로 검증 | 부가 이벤트가 추가될 때 기존 테스트가 깨지지 않도록 `assert Event(...) in entity.release_events()` 사용 |
| `mut-mutator-validity` | MEDIUM | 상태 변경 메서드의 입력 불변식 검증 | 생성자뿐만 아니라 상태를 변경하는 메서드에 잘못된 값을 넣었을 때의 거부 테스트 확보 |
| `mut-state-transition-idempotent` | MEDIUM | 잘못된 상태 전이 차단 및 중복 호출 멱등성 검증 | 이미 완료된 주문을 취소할 때의 예외 발생, 또는 취소 두 번 호출 시 이벤트가 1회만 기록되는지 검증 |
| `mut-no-fluent-interface` | LOW | 가변 객체의 메서드 체이닝(`return self`) 지양 | 명령 메서드는 CQS에 따라 `None`을 반환하고 개별 호출로 검증 |

#### 카탈로그 6. `test-immutable-values` (4개 규칙)

| 규칙 ID | 심각도 | 핵심 감사 기준 | 위반 신호 및 교정 방향 |
|:---|:---:|:---|:---|
| `val-original-preserved` | HIGH | 불변 객체 연산 후 원본 객체 불변 유지 단언 필수 | `total = original.add(other)` 실행 후 `total`만 확인하고 `assert original == Quantity(1000)`을 빠뜨린 테스트 보강 |
| `val-equality-not-identity` | MEDIUM | 참조(`is`)가 아닌 값 동등성(`==`) 비교 | 값 객체 검증에서 메모리 주소 비교 사용 금지 |
| `val-domain-method-name` | LOW | 기술적 변경자(`with_x`)보다 도메인 메서드(`to_the_left`) 사용 | 테스트 코드 자체가 도메인 사양서로 읽히도록 도메인 어휘 메서드 호출 |
| `val-fluent-interface-ok` | LOW | 불변 값 객체의 메서드 연쇄 호출 허용 | 매번 새 복사본을 반환하는 값 객체의 체이닝 테스트는 자연스러운 패턴으로 인정 |

#### 카탈로그 7 & 8. `test-dto` (1개 규칙) 및 `test-architecture` (5개 규칙)

| 규칙 ID | 심각도 | 핵심 감사 기준 | 위반 신호 및 교정 방향 |
|:---|:---:|:---|:---|
| `dto-validate-collect` | MEDIUM | DTO는 생성자 예외 대신 오류 일괄 수집(`validate()`) 검증 | 여러 필드가 잘못된 DTO에서 첫 번째 오류만 던지지 않고 모든 필드 오류 목록을 한 번에 반환하는지 테스트 |
| `arch-object-type-matrix` | HIGH | 객체 종류별 테스트 수준(단위 vs 통합) 및 대역 매트릭스 준수 | 컨트롤러를 억지 단위 테스트로 쪼개거나, 애플리케이션 서비스를 무거운 통합 테스트로만 다루는 층위 역전 교정 |
| `arch-no-protected-bypass` | HIGH | 부모 메서드 `patch` 및 `_private` 속성 직접 조작 금지 | `@patch.object(ParentClass, "method")`나 `service._internal = "hack"` 같은 캡슐화 우회 즉시 제거 |
| `arch-read-write-separation` | MEDIUM | 쓰기 모델 테스트와 읽기 모델 갱신 테스트의 분리 | 명령 처리 테스트에서는 이벤트 발행까지만 확인하고, 읽기 뷰 갱신은 수신자 테스트에서 별도 검증 |
| `arch-receiver-isolation` | MEDIUM | 도메인 이벤트 수신자(Event Receiver)의 단독 단위 테스트 확보 | 발송과 수신을 거대한 통합 테스트 하나로만 묶지 않고 수신자 단독 테스트 작성 |
| `arch-decorator-standalone` | LOW | 데코레이터 클래스(캐싱·로깅 등)의 독립 단위 테스트 | 원본 구현체와 분리하여 데코레이터 자체의 부가 동작을 독립 검증 |

```python
# [핵심 안티패턴 1: mut-event-and-state 위반과 교정]
# 이벤트만 기록하고 실제 self._status = CANCELLED를 빼먹어도 첫 번째 테스트는 통과한다.
def test_cancel_records_event(order: Order) -> None:
    order.cancel()
    assert OrderCancelled(order.id) in order.release_events()

# 따라서 실제 상태가 바뀌었음을 후속 행위의 차단으로 증명하는 짝꿍 테스트가 필수다.
def test_cancelled_order_rejects_adding_items(order: Order) -> None:
    order.cancel()
    with pytest.raises(InvalidStateTransition, match="cancelled"):
        order.add_item(ProductItem("book", quantity=1))

# [핵심 안티패턴 2: val-original-preserved 위반과 교정]
def test_quantity_addition_preserves_immutability() -> None:
    original = Quantity(1000, precision=2)
    added = original.add(Quantity(500, precision=2))
    assert added == Quantity(1500, precision=2)
    assert original == Quantity(1000, precision=2)  # 원본이 오염되지 않았음을 반드시 단언한다
```

### 레이어별 Mock 허용·금지 경계표와 프루닝(Pruning) 게이트

테스트 스위트가 무분별한 통합 테스트로 느려지거나 반대로 의미 없는 Mock 단위로 전락하는 '테스트 다이아몬드/아이스크림 콘' 현상을 막기 위해, `/tdd-plan` Stage 2(§5-0)와 `/go` Step 6-4에서 적용하는 레이어별 배치 및 프루닝 기준이다.

| 레이어 및 검증 대상 | 테스트 층위 | Mock / 대역 허용 경계 | 프루닝(Pruning) 및 이전 규칙 |
|:---|:---:|:---|:---|
| **Domain (`Entity`, `Value Object`, 순수 함수)** | 순수 단위 (주력) | **대역 절대 금지** (100% 실제 객체) | 산식·분기·상태 전이 규칙 변형 `N`개는 전부 이곳에서 초고속 검증 |
| **Application Service (유스케이스 조율)** | 단위 | 시스템 경계 인터페이스를 `Fake`/`Stub`(Query) 및 `Spy`(Command)로 대체 | 비즈니스 계산이 섞여 있으면 `IO-Pure-IO`에 따라 순수 함수로 추출 후 단위 이전 |
| **CRUD / Repository / SQL 쿼리** | 실제 DB 통합 | **Mock 절대 금지** (`Mock` 사용 시 동어반복 판정으로 삭제) | `PostgreSQL` RLS 격리, `UNIQUE`/`CHECK` 제약, 실제 쿼리 동작만 실제 DB 컨테이너로 검증 |
| **API Router / Controller** | 통합 (계약당 1건) | 실제 서비스·실제 DB 연결 원칙(외부 서드파티 결제·메일 API만 인메모리 격리) | 도메인 규칙 변형을 API 통합 테스트로 중복 나열 금지(배선·인증·응답 셰이프만 1건 검증) |
| **Frontend UI (`React` 컴포넌트·훅)** | 사용자 관점 통합 (주력) | **네트워크 경계(`MSW`)만 허용**. 내부 스토어·셀렉터·프레임워크 훅 목킹 금지 | 스냅샷 남용, 단순 렌더 확인, 내부 `state` 직접 접근 테스트는 전수 삭제 |

### Playwright 브라우저 E2E QA 게이트 검증 프로토콜

단위 테스트, 실제 DB 통합 테스트, `/test-harden` 감사까지 모두 통과한 후 최종 머지 게이트(및 `hub-orchestrate` Phase 5)에서 수행하는 **실제 브라우저 기반 E2E 검증 계약**이다. 에이전트의 텍스트 보고(`"구현 완료했습니다"`)는 증거로 인정하지 않으며, 아래 4단계 물리적 영수증이 모두 확보되어야만 작업이 종결된다.

1. **실제 런타임 기동 및 시드 데이터 주입**:
   - 로컬 테스트 DB(`alembic upgrade head` 반영 완료)와 백엔드(`FastAPI`), 프론트엔드 개발 서버를 실제로 띄운다.
2. **자연 진입점 기반 사용자 여정 조작 (`Playwright`)**:
   - 테스트용 우회 URL이나 내부 함수 직접 호출을 금지한다. 실제 사용자가 진입하는 로그인 -> 대시보드/목록 메뉴 클릭 -> 필터 선택 -> 생성/수정 모달 제출 -> 상세 확인의 전체 동선을 헤드리스 브라우저가 직접 수행한다.
3. **네트워크·콘솔 무결성 및 경계 표 교차 검증**:
   - 브라우저 조작 전 과정에서 네트워크 탭의 `400`/`422`/`500` 응답이 `0건`이고 콘솔 런타임 에러(`Uncaught TypeError`, `undefined` 렌더링)가 `0건`임을 확인한다.
   - 계획 단계의 **경계 정합성 표 3종(계약·셰이프·트리거)**에 적힌 모든 필드가 실제 DOM 요소에 올바른 표시명(FK Resolved)으로 렌더링되었는지 대조한다.
4. **시각적 스크린샷 증거 봉인**:
   - 핵심 상태 전이 전후의 화면을 캡처하여 검증 아티팩트로 남기고, 테스트 러너 종료 코드(`exit code 0`)와 함께 최종 완료 리포트에 첨부한다.

- [4편 본문으로 돌아가기](/tag-ai-agent-architecture/4-all-passed-empty-screen/)
