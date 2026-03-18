import type { PageServerLoad } from './$types';
import { getItems, getClusters } from '$lib/server/db/queries';
import { db, isDbAvailable } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	if (!(await isDbAvailable())) return { nodes: [], clusters: [] };

	try {
		const [items, clusters, assignments] = await Promise.all([
			getItems({ limit: 200 }),
			getClusters(),
			db.select().from(itemClusters),
		]);

		// Build cluster lookup
		const clusterMap = new Map(clusters.map((c) => [c.id, c]));

		// Build assignment lookup: itemId -> clusterId
		const assignmentMap = new Map<string, string>();
		for (const a of assignments) {
			assignmentMap.set(a.itemId, a.clusterId);
		}

		// Transform items into nodes for ConstellationMap
		const nodes = items.map((item) => {
			const clusterId = assignmentMap.get(item.id);
			const cluster = clusterId ? clusterMap.get(clusterId) ?? null : null;
			return { id: item.id, item, cluster };
		});

		return { nodes, clusters };
	} catch (e) {
		console.error('Database not available:', e);
		return { nodes: [], clusters: [] };
	}
};
