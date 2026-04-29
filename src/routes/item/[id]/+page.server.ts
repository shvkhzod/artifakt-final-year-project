import type { PageServerLoad } from './$types';
import { getItemById, getItemTags, getFragmentsByItemId } from '$lib/server/db/queries';
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

	const [tags, clusterAssignments, fragments] = await Promise.all([
		getItemTags(params.id),
		db
			.select({ cluster: clusters, confidence: itemClusters.confidence })
			.from(itemClusters)
			.innerJoin(clusters, eq(itemClusters.clusterId, clusters.id))
			.where(eq(itemClusters.itemId, params.id)),
		getFragmentsByItemId(params.id),
	]);

	const cluster = clusterAssignments.length > 0 ? clusterAssignments[0] : null;

	return {
		item,
		tags,
		cluster: cluster ? { ...cluster.cluster, confidence: cluster.confidence } : null,
		fragments,
		dissectedAt: item.dissectedAt?.toISOString() ?? null,
	};
};
