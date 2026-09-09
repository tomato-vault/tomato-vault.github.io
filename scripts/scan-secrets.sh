#!/usr/bin/env bash
# 익명화 게이트 — 발행 계획 §5.3. 하나라도 걸리면 커밋/발행 중단.
# 이 스크립트는 협상 대상이 아니다. 한 번 새어 나가면 되돌릴 수 없다.
set -u

TARGET="${1:-src/content/posts}"

PATTERNS=(
  # ── 조직·제품 식별자
  'BNV' 'bnvs' 'bnvsrnd' 'ipsispace' 'e-project' 'duoacademy' 'duocodi' 'buridge'
  '종로엠'
  # ── 도메인 용어 (§5.2 치환 사전 참조)
  '원비' '성취평가' '학습 플래너' '강의평가' '학생부'
  # ── 인프라 식별자
  'arn:aws' 'AKIA' 'db\.t4g' 'E3MW57Z3RAUMHI'
  '\b[0-9]{12}\b'            # AWS 계정 ID
  '[a-z0-9.-]+\.co\.kr'      # 사내 도메인
  '@[a-z0-9.-]+\.co\.kr'     # 사내 이메일
  # ── 실제 엔드포인트
  '/api/v1/my/' 'tuition' 'billings' 'staff/performance'
  # ── 일반 크리덴셜
  'BEGIN [A-Z ]*PRIVATE KEY' 'xox[baprs]-' 'sk-[A-Za-z0-9]{20,}' 'ghp_[A-Za-z0-9]{20,}'
)

fail=0
[ -d "$TARGET" ] || { echo "대상 없음: $TARGET (스캔 생략)"; exit 0; }

for p in "${PATTERNS[@]}"; do
  if grep -rniE "$p" "$TARGET" 2>/dev/null; then
    echo "🚫 금칙어 감지: $p"
    fail=1
  fi
done

if [ $fail -eq 1 ]; then
  echo
  echo "발행 중단 — 발행 계획 §5.2 치환 사전으로 바꾼 뒤 재시도한다."
  echo "정말 오탐이면 scripts/scan-secrets.sh 의 PATTERNS 를 고친다. --no-verify 로 우회하지 않는다."
  exit 1
fi

echo "✅ 스캔 통과 ($TARGET)"
