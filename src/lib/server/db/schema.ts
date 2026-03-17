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

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverParam: string }>({
	dataType() {
		return 'vector(512)';
	},
	toDriver(value: number[]): string {
		return `[${value.join(',')}]`;
	},
	fromDriver(value: unknown): number[] {
		const str = String(value);
		return str
			.replace(/[\[\]]/g, '')
			.split(',')
			.map(Number);
	},
});

// Items table
export const items = pgTable('items', {
	id: uuid('id').primaryKey().defaultRandom(),
	url: text('url'),
	title: text('title'),
	content: text('content'),
	type: text('type', { enum: ['image', 'article', 'quote', 'screenshot'] }).notNull(),
	thumbnailUrl: text('thumbnail_url'),
	note: text('note'),
	embedding: vector('embedding'),
	colorPalette: jsonb('color_palette').$type<{ dominant: string; colors: string[] }>(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Clusters table
export const clusters = pgTable('clusters', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	color: text('color').notNull(),
	description: text('description'),
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
