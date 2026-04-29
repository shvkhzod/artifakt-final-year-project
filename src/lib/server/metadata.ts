import ogs from 'open-graph-scraper';
import { isYouTubeUrl, extractYouTubeId, youtubeThumbnailUrl } from '$lib/utils/youtube';

export interface UrlMetadata {
	title: string;
	description: string;
	image: string;
	favicon: string;
	siteName: string;
}

export interface YouTubeMetadata extends UrlMetadata {
	videoId: string;
	channelName: string;
}

/**
 * Fetch metadata for a YouTube video.
 * Combines oEmbed (title, channel) + OG scraper (description) in parallel.
 */
async function fetchYouTubeMetadata(url: string, videoId: string): Promise<YouTubeMetadata> {
	const [oembedResult, ogResult] = await Promise.allSettled([
		fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
			signal: AbortSignal.timeout(5000),
		}).then((r) => (r.ok ? r.json() : Promise.reject())),
		ogs({ url, timeout: 5000 }).then((r) => r.result),
	]);

	const oembed = oembedResult.status === 'fulfilled' ? oembedResult.value : null;
	const og = ogResult.status === 'fulfilled' ? ogResult.value : null;

	return {
		title: oembed?.title || og?.ogTitle || '',
		description: og?.ogDescription || '',
		image: youtubeThumbnailUrl(videoId),
		favicon: 'https://www.youtube.com/favicon.ico',
		siteName: 'YouTube',
		videoId,
		channelName: oembed?.author_name || '',
	};
}

async function fetchGenericMetadata(url: string): Promise<UrlMetadata> {
	try {
		const { result } = await ogs({ url, timeout: 5000 });
		return {
			title: result.ogTitle || result.dcTitle || '',
			description: result.ogDescription || result.dcDescription || '',
			image: result.ogImage?.[0]?.url || '',
			favicon: result.favicon || '',
			siteName: result.ogSiteName || new URL(url).hostname,
		};
	} catch {
		return {
			title: '',
			description: '',
			image: '',
			favicon: '',
			siteName: new URL(url).hostname,
		};
	}
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata | YouTubeMetadata> {
	if (isYouTubeUrl(url)) {
		const videoId = extractYouTubeId(url);
		if (videoId) {
			return fetchYouTubeMetadata(url, videoId);
		}
	}
	return fetchGenericMetadata(url);
}
