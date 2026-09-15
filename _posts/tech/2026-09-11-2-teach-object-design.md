---
layout: post
title: "객체지향을 배웠으니 AI 선생님부터 가르쳐보겠습니다"
description: "오브젝트 디자인 스타일 가이드에서 가져온 객체 분류와 값 객체 설계"
date: 2026-09-11
categories: [tech]
tags: ["ai-agent-architecture", "AI", "Agent", "OOP", "TDD", "Workflow"]
permalink: /tech/2-teach-object-design/
series: "AI 에이전트 협업 아키텍처 변천사"
series_key: "ai-agent-architecture"
series_order: 2
---

## TDD 워크플로우의 진화

1번 글에서 TDD에 OOP를 도입한 이야기를 살짝 했었다. 이번 글부터는 그것을 포함하여 어떤 내용들을 어떤 경위로 넣게 되었는지에 대해서 설명을 해볼까 한다.

먼저, 워크플로우를 진화시킨 경로는 크게 셋이다. 1번 글에서 다룬 책, 유튜브 영상, 그리고 실제 경험이다. 영상에 대해 이야기하자면, 나는 역시 기록의 악마답게 유의미하다고 판단되는 영상마저도 기록한다. 유튜브는 감사하게도 transcript를 전부 제공해주는데 그걸 활용하면 아주 쉽게 문서화할 수 있다. 처음에는 Youtube link를 직접 사용할 수 있다는 이유로 NotebookLM을 자주 활용했지만 문맥을 다소 많이 압축시켜버리는 경향이 있어서 이후부터는 그냥 바로 CLI Agent에게 요약해서 문서화하도록 요청한다.

> 📷 **[사진 플레이스홀더: Obsidian Vault Youtube Directory]**
<!--
![Obsidian Vault Youtube Directory](/assets/img/posts/ai-agent-architecture-2-youtube-directory.webp){:width="800" loading="lazy"}

옵시디언 볼트에 정리된 유튜브 영상 요약 디렉토리 구조.
{:.figcaption}
-->

실제 경험에서 나오는 사항들은 내 워크플로우의 정수라고 해도 좋을 정도로 유의미한 사항들이 많이 있다. 내 경험에서 나온 설정들에 대해서는 뒤에서 따로 다뤄보겠다. 

> 📷 **[사진 플레이스홀더: Obsidian Vault Learnings Directory]**
<!--
![Obsidian Vault Learnings Directory](/assets/img/posts/ai-agent-architecture-2-learnings-directory.webp){:width="800" loading="lazy"}

옵시디언 볼트에 누적된 실전 경험(Learnings) 디렉토리 구조.
{:.figcaption}
-->

번외로 하나 더 이야기하자면, 2026년 4월에 있었던 클로드 코드 CLI 소스코드 유출 사건을 기억할 것이다. 내 워크플로우 중 에이전트의 구성(탐색자·설계자·구현자·검토자)은 바로 그 코드를 참고하여 만든 것이다. 이에 대해서는 TDD 이후 글에서 더 자세히 이야기해보겠다.

그리고 이 워크플로우는 크게 두 단계로 나뉜다. tdd-plan과 tdd-go. plan 단계에서는 현재 코드베이스를 탐색하고, 주어진 요구사항에 대하여 어떤 방식으로 접근할지를 다양한 축을 기준으로 계획한다. go 단계에서는 RED-GREEN-REFACTOR 단계를 기준으로 하여 여러 관점에서 추가한 축들을 기준으로 검토해가며 사이클을 돌리며 계획된 내용을 완수해나간다. 이번 글과 다음 글에서는 tdd-plan에 대해서, 그 다음 글에서는 tdd-go에 대해서 이야기해보겠다. 특히 이번 글에서는 세 가지 경로 중 책에서 가져온 사항들에 대해 심층적으로 이야기해볼까 한다.

## Object Design Style Guide

내 TDD 워크플로우에서 프로그래밍 철학적으로 가장 중요한 것은 OOP라고 해도 무방하다. **『오브젝트 디자인 스타일 가이드』** (Object Design **Style** Guide, Matthias Noback)는 내게 OOP를 자세히 소개시켜준 책이다. 이 책도 여러 번 읽었고 필사도 진행했다. 개발자들이 좋아하는 몇 가지 단어가 있다고 생각하는데 나는 그 중에서도 '우아하다'라는 단어가 좋다. OOP 개발 방법론은 나에게 참 '우아해' 보였다. 이 우아함을 더 깊게 이해하기 위해서 사이드 프로젝트를 진행하기도 했다(링크). 이 글에서는 그 우아함 중 무엇을 내 워크플로우에 도입했는지 이야기해보겠다.

첫 단계는 객체를 분류하는 작업이다. 요구사항에 대하여 다음 표의 객체 중 어떤 내용에 대한 것인지를 판별한다. 이렇게 판별된 객체가 신규와 수정에 대한 규칙, 그리고 테스트와의 연계 등을 전부 결정한다.

| 분류 | 정체 | 무엇으로 구분하나 | 변하나 | 스스로 검증하나 |
|---|---|---|---|---|
| **서비스** | 일을 하는 것 (저장소·디스패처) | — | ❌ 생성 후 불변 | — |
| **개체** | 정체성이 있고 변하는 것 (사용자·주문) | **정체성(ID)** — 이름이 바뀌어도 같은 사람 | ⭕ | ⭕ |
| **값 객체** | 값 그 자체 (이메일·금액) | **값** — 값이 다르면 다른 것 | ❌ 불변 | ⭕ |
| **DTO** | 데이터 운반만 | 구분하지 않음 | ⭕ | ❌ |

만 원짜리 지폐 두 장은 일련번호가 달라도 똑같이 만 원이다. 값 객체다. 반면 같은 이름의 학생 둘은 다른 사람이다. 개체다.

두 번째로는 값 객체 후보를 탐색한다. 값 객체란 불변이며 값 동등성을 가지고 있고, 생성 시점에 스스로 검증되는 자기유효성의 특성을 가지고 있다. 다음은 몇 가지 예이다.

```text
country_code + phone + is_verified      → Phone
present + late + early_leave + absent   → AttendanceCount
score + max_score + percentage          → Score
```

계획 단계에서는 이 후보를 항상 함께 다니는 원시값 묶음에서 찾는다. 코드베이스를 grep해서 같은 필드 두세 개가 여러 파일에 반복 등장하면 값 객체 후보로 본다. 값 객체가 필요한 이유는 원시값이 의미를 담지 못하기 때문이다.

```python
def send_verification(country_code: str, phone: str, is_verified: bool): ...
```

위 예시 함수를 보면 세 개의 값이 함께 다녀야만 의미가 있는데, 타입은 그걸 반영할 수가 없다. 그래서 다음과 같은 일이 생길 수 있다.

- `country_code`와 `phone`은 둘 다 `str`이라 순서를 바꿔 넣어도 통과됨
- 검증 로직이 부르는 쪽마다 복사됨
- 셋 중 하나만 빠뜨린 채 넘어가도 아무도 막지 않음

이게 원시값 집착(Primitive Obsession)이고, 값 객체가 이를 해결한다. 값 객체는 특히 중요한데, 시스템 상에서 값 객체로 묶느냐 마느냐는 '의도'가 들어가는 작업이며 애플리케이션 상에서 해당 객체의 행동을 결정짓기 때문이다. 다음은 그 "행동을 결정짓는다"는 것의 예시다.

```python
class Score:
    def __init__(self, score: int, max_score: int):
        if max_score <= 0:
            raise ValueError("만점은 0보다 커야 한다")
        if not 0 <= score <= max_score:
            raise ValueError("점수가 범위를 벗어났다")
        self._score, self._max = score, max_score

    def percentage(self) -> Decimal: ...     # 백분율 계산
    def is_pass(self, cut: int) -> bool: ... # 합격 판정
    def grade(self) -> str: ...              # 등급 산출
```

값 객체를 만들기 전에는 `percentage`, `is_pass`, `grade` 함수들이 서비스·라우터·프론트에 흩어져 있었을 것이다. 값 객체를 만드는 순간 이들을 묶을 곳이 생기는 셈이다. 만약 값 객체가 필요하여 새롭게 생성해야 한다고 판단이 되면 찾은 값 객체의 테스트를 **첫 단계 맨 앞에 배치**한다. 값 객체 테스트가 존재하면 이후 단계에서 그걸 쓸 수밖에 없기 때문이다(설계 압력).

위 예시에서 보이다시피 값 객체는 생성 시점에 스스로 검증하는 특성을 가지고 있는데 이는 네 번째 단계와 이어진다.

세 번째 단계는 객체간의 의존성을 셋으로 분류하여 어떤 종류의 테스트로 풀어낼지 계획한다.

```text
Query(값을 돌려받음)       → Stub / Fake.  반환값 → 결과로 검증
Command(부수효과를 일으킴) → Mock / Spy.   호출 여부·인자로 검증
System Boundary(외부 API)  → 인메모리 구현. 격리
```

이 항목은 Command Query Separation(CQS)의 개념에서 출발한다. CQS는 쉽게 이야기하면 이런 원칙이다. Command는 상태를 바꾸고 아무것도 반환하지 않는다. Query는 값만 반환하고 아무것도 바꾸지 않는다. 그리고 이 둘을 한 메서드에 섞지 않는다. 이유는 이 둘이 섞이는 순간 호출하는 쪽이 부작용을 예측할 수 없게 된다는 데에 있다. 아래는 간단한 예시이다.

```python
class Counter:
    def increment(self) -> None:      # Command — 변경하고 반환이 없음
        self._count += 1

    def current_count(self) -> int:   # Query — 반환하고 변경이 없음
        return self._count

    def increment_and_return(self) -> int:   # 섞여 있는 나쁜 예시
        self._count += 1
        return self._count
```

CQS를 적용하면 다음과 같은 사고를 미연에 방지할 수 있다.

- 로그 찍으려고 한 번 더 호출했더니 카운터가 두 번 올라감
- 디버거로 변수를 들여다봤더니 값이 변함
- "안전할 것 같아서" 순서를 바꿨더니 깨짐

Query는 몇 번 호출하든 상관없어야 하고, Command는 정확히 필요한 만큼만 호출돼야 한다. 이 둘이 섞이면 이 성질들이 무너진다. 이 개념만 해도 메서드, call chain, 객체 등의 레이어가 나뉘지만 여기서는 위에서 설명한 대로 메서드에 대해서만 다루도록 하겠다.

이 CQS 개념을 도입하게 되면 자연스럽게 테스트 대역이 나뉘게 된다. 이를테면 Query에 Mock을 쓰면 Mock 동어반복(tautology)이 된다.

```python
def test_converts_amount():
    mock_rates = Mock()
    mock_rates.exchange_rate_for.return_value = Decimal("0.8")   # Mock을 내가 설정하고
    ...
    assert result == Decimal("0.8")                              # 내가 꺼내서 확인
```

Mock은 호출 횟수·순서를 검증하는 도구인데, Query는 애초에 몇 번 부르든 상관없어야 하는 것이기 때문에 Query에는 Stub/Fake를 사용하여 반환값을 검증하고, Command는 Mock/Spy를 사용하여 호출 여부와 인자로 검증하도록 설계한다. 이러한 특성을 고려하여 RED 시점이 아니라 계획 시점에 설계를 해두는 식으로 작업하게 된다.

네 번째 단계는 생성자를 어떻게 테스트할지 정하는 것이다. 두 번째 단계에서 값 객체는 생성 시점에 스스로 검증한다고 했는데, 그러면 그 검증을 어떻게 확인할 것인가에 대한 이야기다.

처음에는 당연히 "잘 만들어지는지"부터 테스트하고 싶어진다. 그런데 내 계획서는 **실패 케이스만** 적도록 되어 있다. 이유는 두 가지다.

```python
def test_coordinates_can_be_constructed():
    coords = Coordinates(latitude=60.0, longitude=100.0)
    assert coords.latitude == 60.0     # 이걸 확인하려고
    assert coords.longitude == 100.0   # getter를 새로 뚫어야 한다
```

먼저 이 테스트는 아무 정보도 주지 않는다. 예외가 발생하지 않는 한 절대 실패하지 않기 때문에 회귀 신호가 0이다. 그리고 더 나쁜 것은, 저 `assert`를 쓰려고 아무도 안 쓰는 `getter`를 만들어야 한다는 점이다. 캡슐화를 지키자고 값 객체를 만들었는데 테스트가 그걸 도로 깨는 셈이다.

그럼 정상 생성은 누가 검증하는가. 행위 테스트가 이미 하고 있다. `Coordinates(0, 0).distance_to(Coordinates(3, 4))`가 5를 반환했다면 생성자도 제대로 작동했다고 볼 수 있다. 행위를 테스트하려면 객체가 먼저 제대로 만들어져야 하니까 말이다. 그래서 생성자는 거부해야 할 것을 거부하는지만 확인하면 된다.

```python
def test_latitude_must_be_within_range():
    with pytest.raises(ValueError, match="Latitude"):
        Coordinates(latitude=90.1, longitude=0.0)
```

`match=`가 붙어있는 이유는 이게 없으면 엉뚱한 이유로 발생한 `ValueError`도 통과해버리기 때문이다. 실제 실행 사이클에서는 "생성자 테스트면 `pytest.raises`만 썼는가", "예외 테스트면 `match=`를 넣었는가" 두 줄의 체크리스트로 강제된다.

이 항목이 재밌는 건 거꾸로 생각해봤을 때이다. 생성자 테스트에 실패 케이스만 있다는 것은, 결국 **잘못된 상태로 생성될 수 있는 경로를 전부 막았는가**를 묻는 것이 된다. '객체는 유효한 상태로만 생성되어야 한다'는 원칙이 테스트 목록의 형태로 나타난 셈이다.

다섯 번째 단계는 상태 변경을 어떻게 검증할지 정하는 것이다. 만들 때 검증은 이미 했다. 그러면 만들어진 다음에 바뀔 때는 어떻게 할 수 있을까? 값 객체는 불변이라 애초에 안 바뀌지만 개체는 바뀐다.

여기서도 직관과 다르게 `getter`로 확인하지 않는다.

```python
def test_player_moves_left():
    player = Player(Position(10, 20))
    player.move_left(4)
    assert player.current_position == Position(6, 20)   # 내부 구조에 묶인다
```

네 번째 단계와 같은 문제다. 테스트를 위해 내부를 꺼내 보여줘야 하고, 그러면 나중에 위치를 저장하는 방식을 바꾸는 순간 동작은 그대로인데 테스트가 깨진다. 그렇다고 `move_left`가 새 위치를 반환하게 만들면 이번엔 세 번째 단계에서 이야기한 CQS를 어기게 된다. 게다가 반환값을 받았다고 해서 내부가 실제로 바뀌었다는 증명이 되지도 않는다.

그래서 개체가 **기록한 도메인 이벤트**를 보게끔 한다.

```python
def test_player_moves_left():
    player = Player(Position(10, 20))
    player.move_left(4)
    assert PlayerMoved(Position(6, 20)) in player.release_events()
```

이벤트 목록 전체를 비교하지 않고 포함 여부만 확인하는 것이 포인트다. 그래야 나중에 이벤트가 하나 더 추가돼도 기존 테스트가 안 깨진다. 이벤트를 만들 만한 일이 아니면 `cart.is_empty()` 같은 Query 메서드로 확인해도 된다. 어느 쪽이든 공통점은 **객체가 스스로 공개하기로 한 것만 보고 판단한다**는 것이다.

내 tdd-plan 계획 단계에서는 위의 항목들을 표로 미리 정해둔다. 어떤 개체의 어떤 변경자를 무엇으로 검증할지까지 적어두면, 실제 사이클을 돌 때 이 고민을 다시 하지 않아도 된다.

여기까지가 오브젝트 디자인 스타일 가이드에서 참고한 다섯 가지다. 다소 심층적인 기술 이야기가 이어졌는데 다음 글에서는 비교적 가벼운 이야기들을 해볼까 한다.
