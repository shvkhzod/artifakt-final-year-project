import type { PageServerLoad } from './$types';
import { getItemById, getItemTags, searchSimilarItems } from '$lib/server/db/queries';
import { error } from '@sveltejs/kit';
import { db, isDbAvailable } from '$lib/server/db';
import { itemClusters, clusters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
export const load: PageServerLoad = async ({ params }) => {
	if (!(await isDbAvailable())) {
		throw error(503, 'Database not available');
	}

	let item;
	try {
		item = await getItemById(params.id);
	} catch (e) {
		console.error('Database not available:', e);
		throw error(503, 'Database not available');
	}
	if (!item) throw error(404, 'Item not found');

	const [tags, clusterAssignments] = await Promise.all([
		getItemTags(params.id),
		db
			.select({ cluster: clusters, confidence: itemClusters.confidence })
			.from(itemClusters)
			.innerJoin(clusters, eq(itemClusters.clusterId, clusters.id))
			.where(eq(itemClusters.itemId, params.id)),
	]);

	// Find similar items via vector search if the item has an embedding
	let similarItems: Array<{
		id: string;
		title: string | null;
		type: string;
		url: string | null;
		thumbnailUrl: string | null;
		similarity: number;
	}> = [];

	if (item.embedding) {
		try {
			const results = await searchSimilarItems(item.embedding, 7);
			similarItems = results
				.filter((r) => r.id !== params.id)
				.slice(0, 6)
				.map((r) => ({
					id: r.id,
					title: r.title,
					type: r.type,
					url: r.url,
					thumbnailUrl: r.thumbnailUrl,
					similarity: r.similarity,
				}));
		} catch (e) {
			console.error('Similar items search failed:', e);
		}
	}

	const cluster = clusterAssignments.length > 0 ? clusterAssignments[0] : null;

	return {
		item,
		tags,
		cluster: cluster ? { ...cluster.cluster, confidence: cluster.confidence } : null,
		similarItems,
	};
};
