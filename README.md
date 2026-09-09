# blog

개인 사이트. 기술 섹션이 강한 개인 사이트이지 기술 전용 블로그가 아니다 (발행 계획 §0.5).

정본 계획: Obsidian Vault `300 Runtime/320 Career/320.7. Blog/기술 블로그 — Astro 발행 계획.md`

## 구조

```
src/content/posts/{locale}/{slug}.md   ko 만 발행 중. en·ja 는 구조만 확보 (§10.5)
src/content.config.ts                  zod 스키마 (§4) · TRACKS · LOCALES
src/lib/posts.ts                       조회 헬퍼 (draft 필터 · 로케일 파생 · 시리즈)
src/pages/[track]/                     트랙 인덱스 · 글 · RSS
scripts/scan-secrets.sh                익명화 게이트 (§5.3)
```

트랙 4종: `tech` `notes` `essays` `log`
**이력서·지원서 링크는 도메인 루트가 아니라 `/tech` 로 직접 건다** (§0.5.3).

## 쓰기

```bash
cp src/content/posts/_TEMPLATE.md.txt src/content/posts/ko/my-post.md
npm run dev          # draft: true 도 dev 에서는 보인다
```

발행: frontmatter 의 `draft` 를 `false` 로. 그 전에는 프로덕션 빌드에 나가지 않는다.

## 발행 게이트 (§5.1) — 협상 불가

1. **소재 게이트** — 회사 정보를 걷어내도 글이 성립하는가? 안 되면 발행하지 않는다
2. **치환** — 도메인 용어 → 일반 용어 (§5.2 치환 사전)
3. **자동 스캔** — `npm run scan`. pre-commit 훅이 자동 실행한다
4. **육안** — 발행 전 전체 통독

클론 직후 한 번:

```bash
npm install
git config core.hooksPath .githooks
```

## 배포

Cloudflare Pages. **도메인 없이도 `*.pages.dev` 로 바로 배포된다.**
커스텀 도메인은 나중에 연결만 하면 되고, 그때 두 곳을 실제 URL 로 바꾼다:
`astro.config.mjs` 의 `site`, `src/consts.ts` 의 `SITE_URL`.

- Build command: `npm run build`
- Output directory: `dist`
