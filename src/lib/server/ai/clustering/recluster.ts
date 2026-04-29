import { agnes } from 'ml-hclust';
import { db } from '$lib/server/db';
import { items, clusters, itemClusters, clusterRuns } from '$lib/server/db/schema';
import { addItemToCluster, createCluster } from '$lib/server/db/queries';
import { sql, isNotNull } from 'drizzle-orm';
import { AI_CONFIG } from '../config';
import { CLUSTER_COLORS } from '$lib/utils/colors';
import { generateClusterName } from './naming';

const COLORS = Object.values(CLUSTER_COLORS);

function getNextColor(existingCount: number): string {
  return COLORS[existingCount % COLORS.length];
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 1;
  return 1 - (dot / denom);
}

export async function shouldRecluster(): Promise<boolean> {
  // Use content_embedding for clustering (semantic meaning, not visual similarity)
  const [{ count: embeddedCount }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(items)
    .where(isNotNull(items.contentEmbedding));

  const totalEmbedded = Number(embeddedCount);

  // Don't cluster until we have enough items for meaningful grouping
  if (totalEmbedded < AI_CONFIG.clustering.minItemsForClustering) {
    return false;
  }

  // Cold start: no clusters exist yet — always recluster
  const [{ count: clusterCount }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(clusters);

  if (Number(clusterCount) === 0) {
    return true;
  }

  // Check how many items are unassigned — if many items lack clusters, recluster
  const [{ count: assignedCount }] = await db
    .select({ count: sql<number>`COUNT(DISTINCT item_id)` })
    .from(itemClusters);

  const unassigned = totalEmbedded - Number(assignedCount);
  if (unassigned >= AI_CONFIG.clustering.reclusterInterval) {
    return true;
  }

  // Also check against the last run for the interval-based trigger
  const [latestRun] = await db
    .select()
    .from(clusterRuns)
    .orderBy(sql`created_at DESC`)
    .limit(1);

  const lastProcessed = latestRun?.itemsProcessed ?? 0;
  return (totalEmbedded - lastProcessed) >= AI_CONFIG.clustering.reclusterInterval;
}

export async function runRecluster(triggeredBy: 'auto' | 'manual' = 'auto'): Promise<void> {
  const startTime = performance.now();

  // Use content_embedding (semantic meaning from captions/text) instead of clip_embedding (visual features)
  const allItems = await db.select().from(items).where(isNotNull(items.contentEmbedding));
  const existingClusters = await db.select().from(clusters);
  const existingAssignments = await db.select().from(itemClusters);

  // Clear all AI-generated assignments before reclustering.
  // User-pinned cluster assignments are preserved inside clusterItemSet.
  const userClusterIds = existingClusters
    .filter((c) => c.source === 'user')
    .map((c) => c.id);

  if (userClusterIds.length > 0) {
    await db.delete(itemClusters).where(
      sql`cluster_id NOT IN (${sql.join(userClusterIds.map((id) => sql`${id}::uuid`), sql`, `)})`
    );
  } else {
    await db.delete(itemClusters);
  }

  // Remove empty AI clusters
  for (const c of existingClusters) {
    if (c.source === 'ai') {
      await db.delete(clusters).where(sql`id = ${c.id}`);
    }
  }

  let clustersCreated = 0;
  let clustersModified = 0;

  // Enforce minimum item count for clustering
  if (allItems.length >= AI_CONFIG.clustering.minItemsForClustering) {
    const r = await clusterItemSet(
      allItems.map((i) => ({ id: i.id, embedding: i.contentEmbedding! })),
      existingClusters.filter((c) => c.source === 'user'),
      existingAssignments.filter((a) => userClusterIds.includes(a.clusterId)),
    );
    clustersCreated += r.created;
    clustersModified += r.modified;
  } else {
    console.log(
      `Skipping clustering: only ${allItems.length} items, need ${AI_CONFIG.clustering.minItemsForClustering}`,
    );
  }

  const durationMs = Math.round(performance.now() - startTime);

  await db.insert(clusterRuns).values({
    triggeredBy,
    itemsProcessed: allItems.length,
    clustersCreated,
    clustersModified,
    durationMs,
  });

  console.log(
    `Re-cluster: ${allItems.length} items, ` +
    `${clustersCreated} new, ${clustersModified} updated, ${durationMs}ms`,
  );
}

async function clusterItemSet(
  itemSet: Array<{ id: string; embedding: number[] }>,
  existingClusters: Array<{ id: string; name: string; source: string }>,
  existingAssignments: Array<{ itemId: string; clusterId: string }>,
): Promise<{ created: number; modified: number }> {
  if (itemSet.length < AI_CONFIG.clustering.minItemsForClustering) {
    return { created: 0, modified: 0 };
  }

  const embeddings = itemSet.map((i) => i.embedding);
  const distMatrix: number[][] = [];
  for (let i = 0; i < embeddings.length; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < embeddings.length; j++) {
      distMatrix[i][j] = cosineDistance(embeddings[i], embeddings[j]);
    }
  }

  const tree = agnes(distMatrix, { method: 'average', isDistanceMatrix: true });

  // Over-segment initially so dissimilar items land in separate groups.
  // The similarity gate below will filter out weak groups.
  // Final cluster count is capped by maxClustersRatio.
  const maxClusters = Math.floor(itemSet.length / AI_CONFIG.clustering.maxClustersRatio);
  const initialGroups = Math.max(maxClusters, Math.ceil(itemSet.length / 2));
  const cutResult = tree.group(Math.min(initialGroups, itemSet.length));

  const labels = new Array<number>(itemSet.length).fill(0);
  function assignLabels(node: any, label: number) {
    if (node.isLeaf) {
      labels[node.index] = label;
    } else if (node.children) {
      for (const child of node.children) {
        assignLabels(child, label);
      }
    }
  }
  const topGroups = cutResult.children || [cutResult];
  for (let i = 0; i < topGroups.length; i++) {
    assignLabels(topGroups[i], i);
  }

  const proposedGroups = new Map<number, string[]>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!proposedGroups.has(label)) proposedGroups.set(label, []);
    proposedGroups.get(label)!.push(itemSet[i].id);
  }

  const itemToCluster = new Map(existingAssignments.map((a) => [a.itemId, a.clusterId]));
  const userClusterIds = new Set(
    existingClusters.filter((c) => c.source === 'user').map((c) => c.id),
  );

  let created = 0;
  let modified = 0;

  for (const [, memberIds] of proposedGroups) {
    // Stop if we've hit the max cluster cap
    if (created >= maxClusters) break;
    // Minimum 2 items per cluster — no single-item clusters
    if (memberIds.length < AI_CONFIG.clustering.minClusterSize) continue;

    // Protect items in user-pinned clusters
    const reassignableIds = memberIds.filter((id) => {
      const existingCluster = itemToCluster.get(id);
      return !existingCluster || !userClusterIds.has(existingCluster);
    });
    if (reassignableIds.length < AI_CONFIG.clustering.minClusterSize) continue;

    const overlapCounts = new Map<string, number>();
    for (const itemId of reassignableIds) {
      const existing = itemToCluster.get(itemId);
      if (existing) {
        overlapCounts.set(existing, (overlapCounts.get(existing) || 0) + 1);
      }
    }

    let matchedClusterId: string | null = null;
    for (const [clusterId, count] of overlapCounts) {
      if (count / reassignableIds.length > 0.7) {
        matchedClusterId = clusterId;
        break;
      }
    }

    if (matchedClusterId) {
      for (const itemId of reassignableIds) {
        if (itemToCluster.get(itemId) !== matchedClusterId) {
          await addItemToCluster(itemId, matchedClusterId, 0.8);
        }
      }
      modified++;
    } else {
      // Compute centroid for similarity gating and naming
      const groupEmbeddings = reassignableIds.map((id) => {
        const idx = itemSet.findIndex((i) => i.id === id);
        return itemSet[idx].embedding;
      });
      const centroid = groupEmbeddings[0].map((_, dim) =>
        groupEmbeddings.reduce((sum, e) => sum + e[dim], 0) / groupEmbeddings.length,
      );

      const withDist = reassignableIds.map((id) => {
        const idx = itemSet.findIndex((i) => i.id === id);
        return { id, dist: cosineDistance(itemSet[idx].embedding, centroid) };
      });
      withDist.sort((a, b) => a.dist - b.dist);
      const sampleIds = withDist.slice(0, AI_CONFIG.clustering.namingSampleSize).map((d) => d.id);

      // Similarity gate: only include items with similarity >= reclusterSimilarityThreshold
      // (cosine distance <= 1 - threshold)
      const maxDist = 1 - AI_CONFIG.clustering.reclusterSimilarityThreshold;
      const closeEnough = withDist.filter((d) => d.dist <= maxDist);

      // Need at least minClusterSize items that are actually similar
      if (closeEnough.length < AI_CONFIG.clustering.minClusterSize) continue;

      const sampleItems = await db
        .select()
        .from(items)
        .where(sql`id = ANY(ARRAY[${sql.join(sampleIds.map((id) => sql`${id}::uuid`), sql`, `)}])`);

      const name = await generateClusterName(sampleItems);
      const color = getNextColor(existingClusters.length + created);

      const newCluster = await createCluster({
        name,
        color,
        source: 'ai',
        description: null,
        itemCount: closeEnough.length,
      });

      for (const { id: itemId, dist } of closeEnough) {
        const confidence = Math.min(1, Math.max(0.1, 1 - dist));
        await addItemToCluster(itemId, newCluster.id, confidence);
      }

      created++;
    }
  }

  return { created, modified };
}
