import ogs from 'open-graph-scraper';

export interface UrlMetadata {
	title: string;
	description: string;
	image: string;
	favicon: string;
	siteName: string;
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
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
