#!/usr/bin/env bash
# 익명화 게이트 — 하나라도 걸리면 커밋/발행 중단.
#
# 패턴 목록은 저장소에 넣지 않는다. 목록 자체가 「무엇을 가리려 했는지」의
# 인벤토리라서, 공개 저장소에 올리면 가리려던 것을 도리어 알려주게 된다.
#   목록 파일: scripts/.scan-patterns  (gitignored · 한 줄에 하나)
#   덮어쓰기:  SCAN_PATTERNS=/path/to/file
#
# 목록이 없으면 통과가 아니라 중단이다 — 빈 게이트로 조용히 발행되는 것이 최악이다.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
PATTERN_FILE="${SCAN_PATTERNS:-$HERE/.scan-patterns}"
TARGET="${1:-src/content/posts}"

if [ ! -f "$PATTERN_FILE" ]; then
  echo "🚫 패턴 파일이 없다: $PATTERN_FILE"
  echo "   게이트가 비어 있으면 통과가 아니라 중단이다. 목록을 복원한 뒤 다시 시도한다."
  exit 1
fi

[ -d "$TARGET" ] || { echo "대상 없음: $TARGET (스캔 생략)"; exit 0; }

fail=0
while IFS= read -r p; do
  case "$p" in ''|'#'*) continue ;; esac
  if grep -rniE "$p" "$TARGET" 2>/dev/null; then
    echo "🚫 금칙어 감지: $p"
    fail=1
  fi
done < "$PATTERN_FILE"

if [ $fail -eq 1 ]; then
  echo
  echo "발행 중단 — 치환 사전으로 바꾼 뒤 재시도한다."
  echo "정말 오탐이면 $PATTERN_FILE 을 고친다. --no-verify 로 우회하지 않는다."
  exit 1
fi

echo "✅ 스캔 통과 ($TARGET)"
