import type { RequestHandler } from './$types';
import {
	getItemById,
	searchSimilarItems,
	getItemsByCluster,
	getTemporalNeighbors,
	stripEmbeddings,
} from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const item = await getItemById(params.id);
	if (!item) {
		return new Response(JSON.stringify({ error: 'Item not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const isImage = item.type === 'image' || item.type === 'screenshot';
	const embeddingType = isImage ? ('image' as const) : ('text' as const);
	const embedding = isImage ? item.imageEmbedding : item.textEmbedding;

	// Semantic lane
	let semantic: any[] = [];
	try {
		if (embedding) {
			const results = await searchSimilarItems(embedding, embeddingType, 6);
			semantic = results
				.filter((r) => r.id !== params.id)
				.slice(0, 5)
				.map(stripEmbeddings);
		}
	} catch (e) {
		console.error('Related: semantic search failed:', e);
	}

	// Cluster lane
	let cluster: any[] = [];
	try {
		const [assignment] = await db
			.select()
			.from(itemClusters)
			.where(eq(itemClusters.itemId, params.id))
			.limit(1);

		if (assignment) {
			const clusterItems = await getItemsByCluster(assignment.clusterId, 6);
			cluster = clusterItems
				.filter((i) => i.id !== params.id)
				.slice(0, 5)
				.map(stripEmbeddings);
		}
	} catch (e) {
		console.error('Related: cluster search failed:', e);
	}

	// Temporal lane
	let temporal: any[] = [];
	try {
		const neighbors = await getTemporalNeighbors(params.id, item.createdAt, 5);
		temporal = neighbors.map(stripEmbeddings);
	} catch (e) {
		console.error('Related: temporal search failed:', e);
	}

	return new Response(JSON.stringify({ semantic, cluster, temporal }), {
		headers: { 'Content-Type': 'application/json' },
	});
};
