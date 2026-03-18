export type ItemType = 'image' | 'article' | 'quote' | 'screenshot';

export interface Item {
	id: string;
	url: string | null;
	title: string | null;
	content: string | null;
	type: ItemType;
	thumbnailUrl: string | null;
	note: string | null;
	textEmbedding: number[] | null;
	imageEmbedding: number[] | null;
	embeddingStatus: 'pending' | 'complete' | 'failed';
	colorPalette: ColorPalette | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewItem {
	url?: string;
	title?: string;
	content?: string;
	type: ItemType;
	thumbnailUrl?: string;
	note?: string;
	colorPalette?: ColorPalette;
}

export interface ColorPalette {
	dominant: string;
	colors: string[];
}

export interface Cluster {
	id: string;
	name: string;
	color: string;
	description: string | null;
	source: 'ai' | 'user';
	itemCount: number;
	createdAt: Date;
}

export interface NewCluster {
	name: string;
	color: string;
	description?: string;
}

export type TagSource = 'ai' | 'user';

export interface Tag {
	id: string;
	name: string;
	source: TagSource;
}

export type InsightType = 'new_interest' | 'taste_shift' | 'palette_change' | 'milestone';

export interface Insight {
	id: string;
	type: InsightType;
	title: string;
	content: string;
	clusterId: string | null;
	createdAt: Date;
}

export interface SimilarItem extends Item {
	similarity: number;
}

export interface ApiResponse<T> {
	data: T;
	error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	total: number;
	limit: number;
	offset: number;
}

export interface TasteMapNode {
	id: string;
	x: number;
	y: number;
	item: Item;
	cluster: Cluster | null;
}

export interface TimelineEntry {
	date: Date;
	items: Item[];
	insight: Insight | null;
}
