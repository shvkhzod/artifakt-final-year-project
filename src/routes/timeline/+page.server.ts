import type { PageServerLoad } from './$types';
import { getItems, getClusters } from '$lib/server/db/queries';
import { db, isDbAvailable } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	if (!(await isDbAvailable())) {
		return { weeks: [], streams: [], clusters: [], items: [], heatmapData: [], totalItems: 0 };
	}

	try {
	const [items, clusters, assignments] = await Promise.all([
		getItems({ limit: 2000 }),
		getClusters(),
		db.select().from(itemClusters),
	]);

	// Build assignment lookup: itemId -> clusterId
	const assignmentMap = new Map<string, string>();
	for (const a of assignments) {
		assignmentMap.set(a.itemId, a.clusterId);
	}

	// Group items by week + cluster for stream graph
	const weekMap = new Map<string, Map<string, number>>();

	for (const item of items) {
		const clusterId = assignmentMap.get(item.id);
		if (!clusterId) continue;

		const date = new Date(item.createdAt);
		const day = date.getDay();
		const diff = date.getDate() - day + (day === 0 ? -6 : 1);
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

	// Sort weeks and build the data array
	const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));

	const weeks = sortedWeeks.map(([date, clusterCounts]) => {
		const entry: Record<string, number | string> = { date };
		for (const cluster of clusters) {
			entry[cluster.id] = clusterCounts.get(cluster.id) || 0;
		}
		return entry;
	});

	const streamDefs = clusters.map((c) => ({
		id: c.id,
		name: c.name,
		color: c.color,
	}));

	// Activity heatmap: count saves per day
	const dayMap = new Map<string, number>();
	for (const item of items) {
		const dateKey = new Date(item.createdAt).toISOString().split('T')[0];
		dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
	}

	const heatmapData = Array.from(dayMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, count]) => ({ date, count }));

	return {
		weeks,
		streams: streamDefs,
		clusters,
		items,
		heatmapData,
		totalItems: items.length,
	};
	} catch (e) {
		console.error('Database not available, using demo data:', e);
		return { weeks: [], streams: [], clusters: [], items: [], heatmapData: [], totalItems: 0 };
	}
};
