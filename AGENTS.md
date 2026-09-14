## Development

블로그 개발 서버 실행:

```bash
# rbenv 환경에서 실행
bundle exec jekyll serve --livereload
# 또는 npm script 사용
npm run dev
```

## Production Build & Deploy

- 빌드: `bundle exec jekyll build`
- 익명화 검사: `./scripts/scan-secrets.sh` (또는 `npm run scan`)
- 배포: GitHub Actions(`.github/workflows/deploy.yml`)를 통해 `main` 브랜치 푸시 시 자동 배포됩니다.

## Content Management

- 글 작성: `_posts/tech/YYYY-MM-DD-title.md`
- 이미지 저장: `assets/img/posts/`
- 마크다운 이미지 참조: `![설명](/assets/img/posts/파일명.png)`
