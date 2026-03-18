import type { PageServerLoad } from './$types';
import { getItems, getClusters } from '$lib/server/db/queries';
import { db, isDbAvailable } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	if (!(await isDbAvailable())) return { items: [], clusters: [] };

	try {
		const [items, clusters, assignments] = await Promise.all([
			getItems({ limit: 100 }),
			getClusters(),
			db.select().from(itemClusters),
		]);

		const assignmentMap = new Map<string, { clusterId: string; confidence: number }>();
		for (const a of assignments) {
			assignmentMap.set(a.itemId, { clusterId: a.clusterId, confidence: a.confidence });
		}

		const clusterMap = new Map(clusters.map((c) => [c.id, c]));
		const itemsWithClusters = items.map((item) => {
			const assignment = assignmentMap.get(item.id);
			const cluster = assignment ? clusterMap.get(assignment.clusterId) ?? null : null;
			return {
				...item,
				cluster: cluster ? { id: cluster.id, name: cluster.name, color: cluster.color } : null,
			};
		});

		return { items: itemsWithClusters, clusters };
	} catch (e) {
		console.error('Database not available, using demo data:', e);
		return { items: [], clusters: [] };
	}
};
