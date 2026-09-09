// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// TODO: 배포 후 실제 URL 로 교체 (src/consts.ts 의 SITE_URL 과 동일하게)
	site: 'https://example.pages.dev',

	// P1 은 한국어만 발행한다. en·ja 는 구조만 미리 잡아 둔다 (발행 계획 §10.5).
	// prefixDefaultLocale: false → ko 는 /tech/... , 나머지는 /en/tech/... /ja/tech/...
	i18n: {
		defaultLocale: 'ko',
		locales: ['ko', 'en', 'ja'],
		routing: { prefixDefaultLocale: false },
	},

	integrations: [mdx(), sitemap({ i18n: { defaultLocale: 'ko', locales: { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' } } })],

	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{ src: ['./src/assets/fonts/atkinson-regular.woff'], weight: 400, style: 'normal', display: 'swap' },
					{ src: ['./src/assets/fonts/atkinson-bold.woff'], weight: 700, style: 'normal', display: 'swap' },
				],
			},
		},
	],
});
