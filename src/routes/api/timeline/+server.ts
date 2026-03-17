import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClusters, getItems } from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';

/**
 * Returns temporal data grouped by week for each cluster,
 * suitable for stream graph / timeline visualization.
 */
export const GET: RequestHandler = async () => {
	try {
		const [clusters, items, assignments] = await Promise.all([
			getClusters(),
			getItems({ limit: 2000 }),
			db.select().from(itemClusters),
		]);

		// Build assignment lookup: itemId -> clusterId
		const assignmentMap = new Map<string, string>();
		for (const a of assignments) {
			assignmentMap.set(a.itemId, a.clusterId);
		}

		// Group items by week + cluster
		const weekMap = new Map<string, Map<string, number>>();

		for (const item of items) {
			const clusterId = assignmentMap.get(item.id);
			if (!clusterId) continue;

			// Get the Monday of the item's week
			const date = new Date(item.createdAt);
			const day = date.getDay();
			const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
			const monday = new Date(date);
			monday.setDate(diff);
			monday.setHours(0, 0, 0, 0);
			const weekKey = monday.toISOString().split('T')[0];

			if (!weekMap.has(weekKey)) {
				weekMap.set(weekKey, new Map());
			}
			const clusterCounts = weekMap.get(weekKey)!;
			clusterCounts.set(clusterId, (clusterCounts.get(clusterId) || 0) + 1);
		}

		// Sort weeks chronologically and build response
		const sortedWeeks = Array.from(weekMap.entries()).sort(
			([a], [b]) => a.localeCompare(b),
		);

		const weeks = sortedWeeks.map(([date, clusterCounts]) => {
			const entry: Record<string, number | string> = { date };
			for (const cluster of clusters) {
				entry[cluster.id] = clusterCounts.get(cluster.id) || 0;
			}
			return entry;
		});

		const clusterSummaries = clusters.map((c) => ({
			id: c.id,
			name: c.name,
			color: c.color,
		}));

		return json({ weeks, clusters: clusterSummaries });
	} catch (e) {
		console.error('Failed to fetch timeline data:', e);
		throw error(500, 'Failed to fetch timeline data');
	}
};
