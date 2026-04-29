/**
 * YouTube URL detection and video ID extraction.
 * Works on both server and client.
 */

const YOUTUBE_REGEX =
	/(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

export function isYouTubeUrl(url: string): boolean {
	return YOUTUBE_REGEX.test(url);
}

export function extractYouTubeId(url: string): string | null {
	const match = url.match(YOUTUBE_REGEX);
	return match ? match[1] : null;
}

export function youtubeEmbedUrl(videoId: string): string {
	return `https://www.youtube.com/embed/${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
