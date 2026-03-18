import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClusters, getItems } from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';
import { runRecluster } from '$lib/server/ai';

export const GET: RequestHandler = async () => {
	try {
		const [clusters, items, assignments] = await Promise.all([
			getClusters(),
			getItems({ limit: 500 }),
			db.select().from(itemClusters),
		]);

		// Build a lookup of item -> cluster assignments
		const assignmentMap = new Map<string, { clusterId: string; confidence: number }>();
		for (const a of assignments) {
			assignmentMap.set(a.itemId, { clusterId: a.clusterId, confidence: a.confidence });
		}

		// Attach cluster info to items
		const itemsWithClusters = items.map((item) => {
			const assignment = assignmentMap.get(item.id);
			return {
				...item,
				clusterId: assignment?.clusterId ?? null,
				confidence: assignment?.confidence ?? null,
			};
		});

		return json({ clusters, items: itemsWithClusters });
	} catch (e) {
		console.error('Failed to fetch clusters data:', e);
		throw error(500, 'Failed to fetch clusters data');
	}
};

export const POST: RequestHandler = async () => {
	try {
		await runRecluster('manual');
		return json({ success: true });
	} catch (e) {
		console.error('Recluster failed:', e);
		throw error(500, 'Recluster failed');
	}
};
