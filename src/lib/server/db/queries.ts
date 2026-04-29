import { eq, sql, desc, and } from 'drizzle-orm';
import { db } from './index';
import { items, clusters, itemClusters, tags, itemTags, fragments } from './schema';
import type { Item, NewItem, Cluster, NewCluster, Tag, Fragment, NewFragment } from './schema';

export function stripEmbeddings<T extends Record<string, any>>(item: T): T {
	const copy = { ...item };
	delete copy.textEmbedding;
	delete copy.imageEmbedding;
	delete copy.text_embedding;
	delete copy.image_embedding;
	delete copy.clipEmbedding;
	delete copy.clip_embedding;
	delete copy.contentEmbedding;
	delete copy.content_embedding;
	delete copy.search_text;
	delete copy.searchText;
	return copy;
}

// ── Items ──────────────────────────────────────────────

export async function createItem(data: NewItem): Promise<Item> {
	const [item] = await db.insert(items).values(data).returning();
	return item;
}

export async function getItems(options?: {
	limit?: number;
	offset?: number;
	type?: string;
	clusterId?: string;
}): Promise<Item[]> {
	const { limit = 50, offset = 0, type, clusterId } = options ?? {};

	if (clusterId) {
		return getItemsByCluster(clusterId);
	}

	const conditions = [];
	if (type) {
		conditions.push(eq(items.type, type as Item['type']));
	}

	const query = db
		.select()
		.from(items)
		.orderBy(desc(items.createdAt))
		.limit(limit)
		.offset(offset);

	if (conditions.length > 0) {
		return query.where(and(...conditions));
	}

	return query;
}

export async function getItemById(id: string): Promise<Item | undefined> {
	const [item] = await db.select().from(items).where(eq(items.id, id));
	return item;
}

export async function deleteItem(id: string): Promise<void> {
	await db.delete(items).where(eq(items.id, id));
}

export async function updateItemEmbedding(
	id: string,
	vector: number[],
	type: 'text' | 'image',
): Promise<void> {
	const column = type === 'text' ? { textEmbedding: vector } : { imageEmbedding: vector };
	await db
		.update(items)
		.set({ ...column, embeddingStatus: 'complete' as const, updatedAt: new Date() })
		.where(eq(items.id, id));
}

export async function updateClipEmbedding(
	id: string,
	vector: number[],
): Promise<void> {
	await db
		.update(items)
		.set({ clipEmbedding: vector, updatedAt: new Date() })
		.where(eq(items.id, id));
}

export async function updateContentEmbedding(
	id: string,
	vector: number[],
	caption: string,
): Promise<void> {
	await db
		.update(items)
		.set({ contentEmbedding: vector, aiCaption: caption, updatedAt: new Date() })
		.where(eq(items.id, id));
}

export async function updateSearchText(id: string): Promise<void> {
	await db.execute(sql`
		UPDATE items SET search_text = to_tsvector('english',
			coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(note, '') || ' ' || coalesce(ai_caption, '')
		) WHERE id = ${id}
	`);
}

export async function searchHybrid(
	queryEmbedding: number[],
	queryText: string,
	limit: number = 10,
): Promise<(Item & { similarity: number; semantic_score: number; keyword_score: number })[]> {
	const vectorStr = `[${queryEmbedding.join(',')}]`;
	const result = await db.execute(sql`
		SELECT *,
			(1 - (content_embedding <=> ${vectorStr}::vector)) as semantic_score,
			ts_rank(search_text::tsvector, plainto_tsquery('english', ${queryText})) as keyword_score,
			(1 - (content_embedding <=> ${vectorStr}::vector))
				+ (ts_rank(search_text::tsvector, plainto_tsquery('english', ${queryText})) * 2.0)
				as similarity
		FROM items
		WHERE content_embedding IS NOT NULL
			AND (1 - (content_embedding <=> ${vectorStr}::vector)) >= 0.30
		ORDER BY similarity DESC
		LIMIT ${limit}
	`);
	return (result.rows ?? result) as (Item & { similarity: number; semantic_score: number; keyword_score: number })[];
}

export async function searchSimilarItems(
	embedding: number[],
	type: 'text' | 'image',
	limit: number = 10,
): Promise<(Item & { similarity: number })[]> {
	const columnName = type === 'text' ? 'text_embedding' : 'image_embedding';
	const vectorStr = `[${embedding.join(',')}]`;

	const result = await db.execute(sql`
		SELECT *, 1 - (${sql.raw(columnName)} <=> ${vectorStr}::vector) as similarity
		FROM items
		WHERE ${sql.raw(columnName)} IS NOT NULL
		ORDER BY ${sql.raw(columnName)} <=> ${vectorStr}::vector
		LIMIT ${limit}
	`);

	return (result.rows ?? result) as (Item & { similarity: number })[];
}

export async function findNearestNeighbors(
	embedding: number[],
	type: 'text' | 'image',
	k: number = 5,
): Promise<Array<{ item_id: string; cluster_id: string | null; confidence: number; similarity: number }>> {
	const columnName = type === 'text' ? 'text_embedding' : 'image_embedding';
	const vectorStr = `[${embedding.join(',')}]`;

	const result = await db.execute(sql`
		SELECT
			i.id as item_id,
			ic.cluster_id,
			COALESCE(ic.confidence, 0) as confidence,
			1 - (i.${sql.raw(columnName)} <=> ${vectorStr}::vector) as similarity
		FROM items i
		LEFT JOIN item_clusters ic ON i.id = ic.item_id
		WHERE i.${sql.raw(columnName)} IS NOT NULL
		ORDER BY i.${sql.raw(columnName)} <=> ${vectorStr}::vector
		LIMIT ${k}
	`);

	return (result.rows ?? result) as Array<{
		item_id: string;
		cluster_id: string | null;
		confidence: number;
		similarity: number;
	}>;
}

export async function findNearestNeighborsByClip(
	embedding: number[],
	k: number = 5,
): Promise<Array<{ item_id: string; cluster_id: string | null; confidence: number; similarity: number }>> {
	const vectorStr = `[${embedding.join(',')}]`;
	const result = await db.execute(sql`
		SELECT
			i.id as item_id,
			ic.cluster_id,
			COALESCE(ic.confidence, 0) as confidence,
			1 - (i.clip_embedding <=> ${vectorStr}::vector) as similarity
		FROM items i
		LEFT JOIN item_clusters ic ON i.id = ic.item_id
		WHERE i.clip_embedding IS NOT NULL
		ORDER BY i.clip_embedding <=> ${vectorStr}::vector
		LIMIT ${k}
	`);
	return (result.rows ?? result) as Array<{
		item_id: string;
		cluster_id: string | null;
		confidence: number;
		similarity: number;
	}>;
}

export async function findNearestNeighborsByContent(
	embedding: number[],
	k: number = 5,
): Promise<Array<{ item_id: string; cluster_id: string | null; confidence: number; similarity: number }>> {
	const vectorStr = `[${embedding.join(',')}]`;
	const result = await db.execute(sql`
		SELECT
			i.id as item_id,
			ic.cluster_id,
			COALESCE(ic.confidence, 0) as confidence,
			1 - (i.content_embedding <=> ${vectorStr}::vector) as similarity
		FROM items i
		LEFT JOIN item_clusters ic ON i.id = ic.item_id
		WHERE i.content_embedding IS NOT NULL
		ORDER BY i.content_embedding <=> ${vectorStr}::vector
		LIMIT ${k}
	`);
	return (result.rows ?? result) as Array<{
		item_id: string;
		cluster_id: string | null;
		confidence: number;
		similarity: number;
	}>;
}

export async function searchSimilarByClip(
	embedding: number[],
	limit: number = 10,
): Promise<(Item & { similarity: number })[]> {
	const vectorStr = `[${embedding.join(',')}]`;
	const result = await db.execute(sql`
		SELECT *, 1 - (clip_embedding <=> ${vectorStr}::vector) as similarity
		FROM items
		WHERE clip_embedding IS NOT NULL
		ORDER BY clip_embedding <=> ${vectorStr}::vector
		LIMIT ${limit}
	`);
	return (result.rows ?? result) as (Item & { similarity: number })[];
}

export async function getItemsWithoutEmbedding(): Promise<Item[]> {
	return db
		.select()
		.from(items)
		.where(sql`${items.embeddingStatus} IN ('pending', 'failed')`)
		.orderBy(items.createdAt);
}

export async function setEmbeddingStatus(
	id: string,
	status: 'pending' | 'complete' | 'failed',
): Promise<void> {
	await db
		.update(items)
		.set({ embeddingStatus: status, updatedAt: new Date() })
		.where(eq(items.id, id));
}

// ── Clusters ───────────────────────────────────────────

export async function createCluster(data: NewCluster): Promise<Cluster> {
	const [cluster] = await db.insert(clusters).values(data).returning();
	return cluster;
}

export async function getClusters(): Promise<Cluster[]> {
	return db.select().from(clusters).orderBy(desc(clusters.createdAt));
}

export async function addItemToCluster(
	itemId: string,
	clusterId: string,
	confidence: number = 1.0,
): Promise<void> {
	await db.insert(itemClusters).values({ itemId, clusterId, confidence }).onConflictDoUpdate({
		target: [itemClusters.itemId, itemClusters.clusterId],
		set: { confidence },
	});

	// Update cluster item count
	await db
		.update(clusters)
		.set({
			itemCount: sql`(SELECT COUNT(*) FROM item_clusters WHERE cluster_id = ${clusterId})`,
		})
		.where(eq(clusters.id, clusterId));
}

export async function getItemsByCluster(
	clusterId: string,
	limit?: number,
): Promise<Item[]> {
	const query = db
		.select({ item: items })
		.from(items)
		.innerJoin(itemClusters, eq(items.id, itemClusters.itemId))
		.where(eq(itemClusters.clusterId, clusterId))
		.orderBy(sql`${items.createdAt} DESC`);

	const results = limit ? await query.limit(limit) : await query;
	return results.map((r) => r.item);
}

// ── Tags ───────────────────────────────────────────────

export async function createTag(
	name: string,
	source: 'ai' | 'user' = 'ai',
): Promise<Tag> {
	const [tag] = await db
		.insert(tags)
		.values({ name, source })
		.onConflictDoNothing()
		.returning();

	if (!tag) {
		const [existing] = await db.select().from(tags).where(eq(tags.name, name));
		return existing;
	}
	return tag;
}

export async function addTagToItem(itemId: string, tagId: string): Promise<void> {
	await db.insert(itemTags).values({ itemId, tagId }).onConflictDoNothing();
}

export async function getItemTags(itemId: string): Promise<Tag[]> {
	const result = await db
		.select({ tag: tags })
		.from(tags)
		.innerJoin(itemTags, eq(tags.id, itemTags.tagId))
		.where(eq(itemTags.itemId, itemId));

	return result.map((r) => r.tag);
}

// ── Fragments ─────────────────────────────────────────

export async function createFragments(
	itemId: string,
	data: Array<Omit<NewFragment, 'itemId'>>,
): Promise<Fragment[]> {
	if (data.length === 0) return [];
	const rows = data.map((d) => ({ ...d, itemId }));
	return db.insert(fragments).values(rows).returning();
}

export async function getFragmentsByItemId(itemId: string): Promise<Fragment[]> {
	return db
		.select()
		.from(fragments)
		.where(eq(fragments.itemId, itemId))
		.orderBy(fragments.category, fragments.sortOrder);
}

export async function getFragmentById(id: string): Promise<Fragment | undefined> {
	const [fragment] = await db.select().from(fragments).where(eq(fragments.id, id));
	return fragment;
}

export async function deleteFragment(id: string): Promise<void> {
	await db.delete(fragments).where(eq(fragments.id, id));
}

export async function deleteFragmentsByItemId(itemId: string): Promise<void> {
	await db.delete(fragments).where(eq(fragments.itemId, itemId));
}

export async function setDissectedAt(itemId: string): Promise<void> {
	await db
		.update(items)
		.set({ dissectedAt: new Date(), updatedAt: new Date() })
		.where(eq(items.id, itemId));
}
