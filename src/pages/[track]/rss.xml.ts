import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_TITLE, TRACK_META } from '../../consts';
import { TRACKS } from '../../content.config';
import { getPosts, slugOf } from '../../lib/posts';

/** 트랙별 독립 RSS — 기술만 구독하는 사람과 전부 보는 사람을 분리한다 (§0.5.3). */
export async function getStaticPaths() {
	return TRACKS.map((track) => ({ params: { track } }));
}

export async function GET(context: APIContext) {
	const track = context.params.track as keyof typeof TRACK_META;
	const posts = await getPosts({ track });
	return rss({
		title: `${SITE_TITLE} · ${TRACK_META[track].label}`,
		description: TRACK_META[track].blurb,
		site: context.site!,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/${track}/${slugOf(post)}/`,
		})),
	});
}
