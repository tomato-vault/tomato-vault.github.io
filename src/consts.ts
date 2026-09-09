export const SITE_TITLE = 'tomato-data';
export const SITE_DESCRIPTION = '백엔드·인프라, 그리고 읽고 본 것들.';

/**
 * 배포 후 실제 URL 로 바꾼다.
 *  1) Cloudflare Pages 연결 → https://{project}.pages.dev
 *  2) 커스텀 도메인 구입 후 → https://{도메인}
 * astro.config.mjs 의 site 도 같이 바꾼다 (sitemap·RSS 절대경로가 여기서 나온다).
 */
export const SITE_URL = 'https://example.pages.dev';

/** 트랙별 표시 이름과 한 줄 설명 (§0.5.2) */
export const TRACK_META = {
	tech: { label: '기술', blurb: '실무에서 만난 문제를 회사 맥락을 걷어내고 기술 함정만 남겨 정리합니다.' },
	notes: { label: '감상', blurb: '읽고 보고 플레이한 것들.' },
	essays: { label: '사유', blurb: '짧게 쓸 수 없는 종류의 글.' },
	log: { label: '회고', blurb: '돌아볼 거리가 쌓였을 때.' },
} as const;
