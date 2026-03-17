import { eq, sql, desc, and } from 'drizzle-orm';
import { db } from './index';
import { items, clusters, itemClusters, tags, itemTags } from './schema';
import type { Item, NewItem, Cluster, NewCluster, Tag } from './schema';

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

export async function updateItemEmbedding(id: string, embedding: number[]): Promise<void> {
	await db
		.update(items)
		.set({ embedding, updatedAt: new Date() })
		.where(eq(items.id, id));
}

export async function searchSimilarItems(
	embedding: number[],
	limit: number = 10,
): Promise<(Item & { similarity: number })[]> {
	const vectorStr = `[${embedding.join(',')}]`;
	const results = await db.execute(sql`
		SELECT *, 1 - (embedding <=> ${vectorStr}::vector) as similarity
		FROM items
		WHERE embedding IS NOT NULL
		ORDER BY embedding <=> ${vectorStr}::vector
		LIMIT ${limit}
	`);
	return results as unknown as (Item & { similarity: number })[];
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

export async function getItemsByCluster(clusterId: string): Promise<Item[]> {
	const result = await db
		.select({ item: items })
		.from(items)
		.innerJoin(itemClusters, eq(items.id, itemClusters.itemId))
		.where(eq(itemClusters.clusterId, clusterId))
		.orderBy(desc(items.createdAt));

	return result.map((r) => r.item);
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
