import { findNearestNeighborsByClip, addItemToCluster } from '$lib/server/db/queries';
import { AI_CONFIG } from '../config';

interface AssignmentResult {
  clusterId: string;
  confidence: number;
}

export async function assignItemToCluster(
  itemId: string,
  embedding: number[],
): Promise<AssignmentResult | null> {
  const { assignmentK, assignmentThreshold } = AI_CONFIG.clustering;

  const neighbors = await findNearestNeighborsByClip(embedding, assignmentK);

  const assigned = neighbors.filter((n) => n.cluster_id !== null && n.item_id !== itemId);
  if (assigned.length === 0) return null;

  const votes = new Map<string, { count: number; totalSimilarity: number }>();
  for (const n of assigned) {
    const cid = n.cluster_id!;
    const entry = votes.get(cid) ?? { count: 0, totalSimilarity: 0 };
    entry.count++;
    entry.totalSimilarity += n.similarity;
    votes.set(cid, entry);
  }

  let bestCluster: string | null = null;
  let bestCount = 0;
  let bestAvgSim = 0;

  for (const [clusterId, { count, totalSimilarity }] of votes) {
    const avgSim = totalSimilarity / count;
    if (count > bestCount || (count === bestCount && avgSim > bestAvgSim)) {
      bestCluster = clusterId;
      bestCount = count;
      bestAvgSim = avgSim;
    }
  }

  if (!bestCluster || bestAvgSim < assignmentThreshold) return null;

  const confidence = Math.min(1, Math.max(0.1, (bestCount / assigned.length) * bestAvgSim));
  await addItemToCluster(itemId, bestCluster, confidence);

  return { clusterId: bestCluster, confidence };
}
