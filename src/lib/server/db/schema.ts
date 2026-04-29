import {
	pgTable,
	uuid,
	text,
	real,
	integer,
	jsonb,
	timestamp,
	primaryKey,
	customType,
} from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Custom vector type factory for pgvector
function pgVector(dimensions: number) {
	return customType<{ data: number[]; driverParam: string }>({
		dataType() {
			return `vector(${dimensions})`;
		},
		toDriver(value: number[]): string {
			return `[${value.join(',')}]`;
		},
		fromDriver(value: unknown): number[] {
			const str = String(value);
			return str.replace(/[\[\]]/g, '').split(',').map(Number);
		},
	});
}

// Items table
export const items = pgTable('items', {
	id: uuid('id').primaryKey().defaultRandom(),
	url: text('url'),
	title: text('title'),
	content: text('content'),
	type: text('type', { enum: ['image', 'article', 'quote', 'screenshot', 'video'] }).notNull(),
	thumbnailUrl: text('thumbnail_url'),
	note: text('note'),
	textEmbedding: pgVector(1024)('text_embedding'),
	imageEmbedding: pgVector(1024)('image_embedding'),
	clipEmbedding: pgVector(1024)('clip_embedding'),
	contentEmbedding: pgVector(1024)('content_embedding'),
	aiCaption: text('ai_caption'),
	embeddingStatus: text('embedding_status', {
		enum: ['pending', 'complete', 'failed'],
	}).default('pending').notNull(),
	searchText: text('search_text'),
	colorPalette: jsonb('color_palette').$type<{ dominant: string; colors: string[] }>(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	dissectedAt: timestamp('dissected_at', { withTimezone: true }),
});

// Clusters table
export const clusters = pgTable('clusters', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	color: text('color').notNull(),
	description: text('description'),
	source: text('source', { enum: ['ai', 'user'] }).default('ai').notNull(),
	itemCount: integer('item_count').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Item-Cluster junction table
export const itemClusters = pgTable(
	'item_clusters',
	{
		itemId: uuid('item_id')
			.references(() => items.id, { onDelete: 'cascade' })
			.notNull(),
		clusterId: uuid('cluster_id')
			.references(() => clusters.id, { onDelete: 'cascade' })
			.notNull(),
		confidence: real('confidence').default(1.0).notNull(),
	},
	(table) => [primaryKey({ columns: [table.itemId, table.clusterId] })],
);

// Tags table
export const tags = pgTable('tags', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	source: text('source', { enum: ['ai', 'user'] }).default('ai').notNull(),
});

// Item-Tag junction table
export const itemTags = pgTable(
	'item_tags',
	{
		itemId: uuid('item_id')
			.references(() => items.id, { onDelete: 'cascade' })
			.notNull(),
		tagId: uuid('tag_id')
			.references(() => tags.id, { onDelete: 'cascade' })
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.itemId, table.tagId] })],
);

// Insights table
export const insights = pgTable('insights', {
	id: uuid('id').primaryKey().defaultRandom(),
	type: text('type', {
		enum: ['new_interest', 'taste_shift', 'palette_change', 'milestone'],
	}).notNull(),
	title: text('title').notNull(),
	content: text('content').notNull(),
	clusterId: uuid('cluster_id').references(() => clusters.id),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Cluster runs table
export const clusterRuns = pgTable('cluster_runs', {
	id: uuid('id').primaryKey().defaultRandom(),
	triggeredBy: text('triggered_by', { enum: ['auto', 'manual'] }).default('auto').notNull(),
	itemsProcessed: integer('items_processed').notNull(),
	clustersCreated: integer('clusters_created').default(0).notNull(),
	clustersModified: integer('clusters_modified').default(0).notNull(),
	durationMs: integer('duration_ms'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ClusterRun = InferSelectModel<typeof clusterRuns>;
export type NewClusterRun = InferInsertModel<typeof clusterRuns>;

// Arena cache table
export const arenaCache = pgTable('arena_cache', {
	cacheKey: text('cache_key').primaryKey(),
	data: jsonb('data').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ArenaCacheEntry = InferSelectModel<typeof arenaCache>;

// Fragments table (Dissect feature)
export const fragments = pgTable('fragments', {
	id: uuid('id').primaryKey().defaultRandom(),
	itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
	category: text('category').notNull(),
	label: text('label').notNull(),
	content: text('content').notNull(),
	metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Fragment = InferSelectModel<typeof fragments>;
export type NewFragment = InferInsertModel<typeof fragments>;

// Inferred types
export type Item = InferSelectModel<typeof items>;
export type NewItem = InferInsertModel<typeof items>;
export type Cluster = InferSelectModel<typeof clusters>;
export type NewCluster = InferInsertModel<typeof clusters>;
export type Tag = InferSelectModel<typeof tags>;
export type NewTag = InferInsertModel<typeof tags>;
export type ItemCluster = InferSelectModel<typeof itemClusters>;
export type Insight = InferSelectModel<typeof insights>;
export type NewInsight = InferInsertModel<typeof insights>;
