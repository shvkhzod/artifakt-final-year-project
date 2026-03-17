import type { ClusterAssignment } from '$lib/utils/types';

export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) return 0;

	let dotProduct = 0;
	let magnitudeA = 0;
	let magnitudeB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		magnitudeA += a[i] * a[i];
		magnitudeB += b[i] * b[i];
	}

	const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
	if (magnitude === 0) return 0;
	return dotProduct / magnitude;
}

export function findNearestCluster(
	embedding: number[],
	clusters: Array<{ id: string; centroid?: number[] }>,
): ClusterAssignment | null {
	let bestMatch: ClusterAssignment | null = null;
	const threshold = 0.3;

	for (const cluster of clusters) {
		if (!cluster.centroid) continue;
		const similarity = cosineSimilarity(embedding, cluster.centroid);
		if (similarity > threshold && (!bestMatch || similarity > bestMatch.confidence)) {
			bestMatch = { clusterId: cluster.id, confidence: similarity };
		}
	}

	return bestMatch;
}

export function suggestClusters(
	itemEmbedding: number[],
	existingItems: Array<{ embedding: number[] | null; clusterId?: string }>,
): string[] {
	const similarityThreshold = 0.5;
	const clusterCounts = new Map<string, number>();

	for (const item of existingItems) {
		if (!item.embedding || !item.clusterId) continue;
		const similarity = cosineSimilarity(itemEmbedding, item.embedding);
		if (similarity >= similarityThreshold) {
			clusterCounts.set(item.clusterId, (clusterCounts.get(item.clusterId) || 0) + 1);
		}
	}

	return Array.from(clusterCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([clusterId]) => clusterId);
}
