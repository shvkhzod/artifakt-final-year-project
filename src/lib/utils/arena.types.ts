export interface ArenaBlock {
	arenaId: number;
	title: string;
	imageUrl: string | null;
	contentHtml: string | null;
	sourceUrl: string;
	blockType: 'image' | 'text' | 'link' | 'media';
	channels: ArenaChannelInfo[];
	alreadySaved: boolean;
	source: 'arena' | 'tumblr';
}

export interface ArenaChannelInfo {
	title: string;
	slug: string;
	user: string;
}

export interface ArenaChannelResult {
	channel: {
		title: string;
		user: string;
		description: string | null;
		length: number;
		slug: string;
	};
	blocks: ArenaBlock[];
}

export interface ExploreResponse {
	queries: string[];
	results: ArenaBlock[];
}
