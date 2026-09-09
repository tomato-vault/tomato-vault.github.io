import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LOCALE, type Locale, type Track } from '../content.config';

export type Post = CollectionEntry<'posts'>;

/** id = '{locale}/{slug}' */
export const localeOf = (entry: Post): Locale => entry.id.split('/')[0] as Locale;
export const slugOf = (entry: Post): string => entry.id.split('/').slice(1).join('/');

/** 그 글의 공개 경로. ko 는 접두사 없음 (prefixDefaultLocale: false). */
export function urlOf(entry: Post): string {
	const locale = localeOf(entry);
	const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
	return `${prefix}/${entry.data.track}/${slugOf(entry)}/`;
}

/**
 * draft: true 인 글은 프로덕션 빌드에서 제외된다.
 * dev 서버에서는 보이므로 초안 확인은 `npm run dev` 로 한다.
 */
export async function getPosts(
	opts: { locale?: Locale; track?: Track } = {},
): Promise<Post[]> {
	const { locale = DEFAULT_LOCALE, track } = opts;
	const all = await getCollection('posts', ({ data }) =>
		import.meta.env.PROD ? data.draft === false : true,
	);
	return all
		.filter((e) => localeOf(e) === locale)
		.filter((e) => (track ? e.data.track === track : true))
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 같은 series 의 글을 seriesOrder 순으로. 연재 내비게이션용. */
export async function getSeries(name: string, locale: Locale = DEFAULT_LOCALE): Promise<Post[]> {
	const all = await getPosts({ locale });
	return all
		.filter((e) => e.data.series === name)
		.sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
}
