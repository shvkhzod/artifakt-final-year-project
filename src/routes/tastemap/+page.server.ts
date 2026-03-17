import type { PageServerLoad } from './$types';
import { getItems, getClusters } from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	try {
		const [items, clusters, assignments] = await Promise.all([
			getItems({ limit: 200 }),
			getClusters(),
			db.select().from(itemClusters),
		]);
		return { items, clusters, assignments };
	} catch (e) {
		console.error('Database not available, using demo data:', e);
		return { items: [], clusters: [], assignments: [] };
	}
};
