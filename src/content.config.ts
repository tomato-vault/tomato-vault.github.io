import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 트랙 — 발행 계획 §0.5.2.
 * 이력서·지원서 링크는 도메인 루트가 아니라 /tech 로 직접 건다 (§0.5.3).
 */
export const TRACKS = ['tech', 'notes', 'essays', 'log'] as const;
export type Track = (typeof TRACKS)[number];

/** 로케일 — P1은 ko만 발행. en·ja 는 디렉토리와 라우팅만 미리 확보 (§10.5). */
export const LOCALES = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

/**
 * 파일 배치: src/content/posts/{locale}/{slug}.md
 * → id 가 'ko/my-post' 형태가 된다. locale 은 id 앞부분에서 파생한다.
 */
const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(), // 검색 결과에 뜨는 한 줄
			pubDate: z.coerce.date(), // 발행일 (§1)
			updatedDate: z.coerce.date().optional(),
			incidentDate: z.coerce.date().optional(), // 겪은 날 — 아카이브 정렬 기준

			track: z.enum(TRACKS),
			tags: z.array(z.string()).default([]),
			stack: z.array(z.string()).default([]), // AWS·FastAPI·PostgreSQL …
			verifiable: z.boolean().default(false), // 외부 문서로 사실 확인 가능한가

			// 연재물
			series: z.string().optional(),
			seriesOrder: z.number().int().positive().optional(),

			// 크로스포스팅 시 원문을 가리킨다 (velog·dev.to·Zenn)
			canonical: z.string().url().optional(),

			heroImage: z.optional(image()),
			draft: z.boolean().default(true), // 기본값 = 미발행. 명시적으로 false 해야 나간다
		}),
});

export const collections = { posts };
