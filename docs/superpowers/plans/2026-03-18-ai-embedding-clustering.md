# AI Embedding & Clustering Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core AI backbone so items are automatically embedded, clustered, and placed on the Taste Map from real data instead of demo data.

**Architecture:** Provider-agnostic embedding service (Transformers.js by default) feeds vectors into pgvector. Single-item cluster assignment via KNN on every save; periodic full re-clustering via ml-hclust. LLM names new clusters via OpenRouter.

**Tech Stack:** Transformers.js (ONNX/WASM), pgvector, Drizzle ORM, ml-hclust, OpenRouter API

**Spec:** `docs/superpowers/specs/2026-03-18-ai-embedding-clustering-design.md`

---

## File Map

### New files
- `src/lib/server/ai/config.ts` — AI configuration constants
- `src/lib/server/ai/embeddings/provider.ts` — EmbeddingProvider interface + factory
- `src/lib/server/ai/embeddings/local.ts` — Transformers.js provider implementation
- `src/lib/server/ai/embeddings/api.ts` — API provider stub (interface only)
- `src/lib/server/ai/clustering/assign.ts` — Single-item KNN cluster assignment
- `src/lib/server/ai/clustering/recluster.ts` — Full agglomerative re-clustering
- `src/lib/server/ai/clustering/naming.ts` — LLM cluster naming via OpenRouter

### Modified files
- `src/lib/server/db/schema.ts` — Split embedding column, add embeddingStatus, add cluster source, add clusterRuns table
- `src/lib/server/db/queries.ts` — Update embedding/search functions for dual columns, add KNN query
- `src/lib/utils/types.ts` — Update Item and Cluster types
- `src/lib/server/ai/pipeline.ts` — Rewrite to use new provider + clustering modules
- `src/lib/server/ai/index.ts` — Update barrel exports
- `src/routes/api/search/+server.ts` — Update for dual-column search
- `src/lib/server/db/seed.ts` — Add source to clusters, remove embedding references
- `package.json` — Add ml-hclust dependency

### Deleted files
- `src/lib/server/ai/embeddings.ts` — Replaced by embeddings/ directory
- `src/lib/server/ai/clustering.ts` — Replaced by clustering/ directory

---

## Task 1: Database Schema + Types

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/utils/types.ts`

- [ ] **Step 1: Update the vector custom type to a parameterized factory**

In `src/lib/server/db/schema.ts`, replace the hardcoded `vector` custom type (lines 15-29) with:

```typescript
function pgVector(dimensions: number) {
  return customType<{ data: number[]; driverParam: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: unknown): number[] {
      const str = String(value);
      return str.replace(/[\[\]]/g, '').split(',').map(Number);
    },
  });
}
```

- [ ] **Step 2: Update items table — split embedding, add embeddingStatus**

Replace the `embedding` column in the items table (line 40) with:

```typescript
textEmbedding: pgVector(384)('text_embedding'),
imageEmbedding: pgVector(512)('image_embedding'),
embeddingStatus: text('embedding_status', {
  enum: ['pending', 'complete', 'failed'],
}).default('pending').notNull(),
```

- [ ] **Step 3: Add source column to clusters table**

Add after `description` (line 51):

```typescript
source: text('source', { enum: ['ai', 'user'] }).default('ai').notNull(),
```

- [ ] **Step 4: Add clusterRuns table + types**

Add after the insights table:

```typescript
export const clusterRuns = pgTable('cluster_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  triggeredBy: text('triggered_by', { enum: ['auto', 'manual'] }).default('auto').notNull(),
  itemsProcessed: integer('items_processed').notNull(),
  clustersCreated: integer('clusters_created').default(0).notNull(),
  clustersModified: integer('clusters_modified').default(0).notNull(),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ClusterRun = InferSelectModel<typeof clusterRuns>;
export type NewClusterRun = InferInsertModel<typeof clusterRuns>;
```

- [ ] **Step 5: Update types.ts**

In `src/lib/utils/types.ts`:

1. Update the `Item` interface — replace `embedding: number[] | null` with:
```typescript
textEmbedding: number[] | null;
imageEmbedding: number[] | null;
embeddingStatus: 'pending' | 'complete' | 'failed';
```

2. Update the `Cluster` interface — add:
```typescript
source: 'ai' | 'user';
```

3. Remove `EmbeddingResult` and `ClusterAssignment` interfaces (replaced by provider interface and `AssignmentResult` in assign.ts). Check that nothing else imports them first.

- [ ] **Step 6: Push schema**

Run: `npm run db:push`

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/utils/types.ts
git commit -m "feat(db): split embedding into text/image columns, add embeddingStatus and clusterRuns"
```

---

## Task 2: Update Query Functions

**Files:**
- Modify: `src/lib/server/db/queries.ts`

- [ ] **Step 1: Update updateItemEmbedding to accept type parameter**

Replace the existing function (lines 53-58) with:

```typescript
export async function updateItemEmbedding(
  id: string,
  vector: number[],
  type: 'text' | 'image',
): Promise<void> {
  const column = type === 'text' ? { textEmbedding: vector } : { imageEmbedding: vector };
  await db
    .update(items)
    .set({ ...column, embeddingStatus: 'complete' as const, updatedAt: new Date() })
    .where(eq(items.id, id));
}
```

- [ ] **Step 2: Update searchSimilarItems to accept type parameter**

Replace the existing function (lines 60-73) with:

```typescript
export async function searchSimilarItems(
  embedding: number[],
  type: 'text' | 'image',
  limit: number = 10,
): Promise<(Item & { similarity: number })[]> {
  const columnName = type === 'text' ? 'text_embedding' : 'image_embedding';
  const vectorStr = `[${embedding.join(',')}]`;

  const result = await db.execute(sql`
    SELECT *, 1 - (${sql.raw(columnName)} <=> ${vectorStr}::vector) as similarity
    FROM items
    WHERE ${sql.raw(columnName)} IS NOT NULL
    ORDER BY ${sql.raw(columnName)} <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return result.rows as (Item & { similarity: number })[];
}
```

- [ ] **Step 3: Add findNearestNeighbors function**

**IMPORTANT:** Raw SQL returns snake_case column names. Use SQL aliases with underscores and map to camelCase in the return type cast. Or use snake_case keys in the return type to match the actual SQL output.

```typescript
export async function findNearestNeighbors(
  embedding: number[],
  type: 'text' | 'image',
  k: number = 5,
): Promise<Array<{ item_id: string; cluster_id: string | null; confidence: number; similarity: number }>> {
  const columnName = type === 'text' ? 'text_embedding' : 'image_embedding';
  const vectorStr = `[${embedding.join(',')}]`;

  const result = await db.execute(sql`
    SELECT
      i.id as item_id,
      ic.cluster_id,
      COALESCE(ic.confidence, 0) as confidence,
      1 - (i.${sql.raw(columnName)} <=> ${vectorStr}::vector) as similarity
    FROM items i
    LEFT JOIN item_clusters ic ON i.id = ic.item_id
    WHERE i.${sql.raw(columnName)} IS NOT NULL
    ORDER BY i.${sql.raw(columnName)} <=> ${vectorStr}::vector
    LIMIT ${k}
  `);

  return result.rows as Array<{
    item_id: string;
    cluster_id: string | null;
    confidence: number;
    similarity: number;
  }>;
}
```

- [ ] **Step 4: Add getItemsWithoutEmbedding + setEmbeddingStatus**

```typescript
export async function getItemsWithoutEmbedding(): Promise<Item[]> {
  return db
    .select()
    .from(items)
    .where(sql`${items.embeddingStatus} IN ('pending', 'failed')`)
    .orderBy(items.createdAt);
}

export async function setEmbeddingStatus(
  id: string,
  status: 'pending' | 'complete' | 'failed',
): Promise<void> {
  await db
    .update(items)
    .set({ embeddingStatus: status, updatedAt: new Date() })
    .where(eq(items.id, id));
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/queries.ts
git commit -m "feat(db): update queries for dual embedding columns and KNN search"
```

---

## Task 3: New AI Modules + Rewrite Pipeline + Update Exports

This task creates all new files, rewrites the pipeline, updates barrel exports, and deletes old files **in a single commit** to avoid broken intermediate states.

**Files:**
- Create: `src/lib/server/ai/config.ts`
- Create: `src/lib/server/ai/embeddings/provider.ts`
- Create: `src/lib/server/ai/embeddings/local.ts`
- Create: `src/lib/server/ai/embeddings/api.ts`
- Create: `src/lib/server/ai/clustering/assign.ts`
- Create: `src/lib/server/ai/clustering/naming.ts`
- Create: `src/lib/server/ai/clustering/recluster.ts`
- Rewrite: `src/lib/server/ai/pipeline.ts`
- Rewrite: `src/lib/server/ai/index.ts`
- Delete: `src/lib/server/ai/embeddings.ts`
- Delete: `src/lib/server/ai/clustering.ts`
- Modify: `package.json` (add ml-hclust)

- [ ] **Step 1: Install ml-hclust**

```bash
npm install ml-hclust
```

- [ ] **Step 2: Create config.ts**

```typescript
// src/lib/server/ai/config.ts
export const AI_CONFIG = {
  embedding: {
    provider: (process.env.EMBEDDING_PROVIDER || 'local') as 'local' | 'api',
    textModel: 'Xenova/all-MiniLM-L6-v2',
    imageModel: 'Xenova/clip-vit-base-patch32',
  },
  clustering: {
    assignmentK: 5,
    assignmentThreshold: 0.65,
    reclusterInterval: 20,
    minClusterSize: 3,
    namingSampleSize: 8,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4-5-20251001',
  },
};
```

- [ ] **Step 3: Create embeddings/provider.ts**

```typescript
// src/lib/server/ai/embeddings/provider.ts
import { AI_CONFIG } from '../config';

export interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedImage(imageUrl: string): Promise<number[]>;
  dimensions: { text: number; image: number };
}

let _provider: EmbeddingProvider | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (_provider) return _provider;

  if (AI_CONFIG.embedding.provider === 'api') {
    const { ApiEmbeddingProvider } = await import('./api');
    _provider = new ApiEmbeddingProvider();
  } else {
    const { LocalEmbeddingProvider } = await import('./local');
    _provider = new LocalEmbeddingProvider();
  }

  return _provider;
}

export type EmbeddingType = 'text' | 'image';

export function getEmbeddingType(itemType: string): EmbeddingType {
  return (itemType === 'image' || itemType === 'screenshot') ? 'image' : 'text';
}
```

- [ ] **Step 4: Create embeddings/local.ts**

```typescript
// src/lib/server/ai/embeddings/local.ts
import { pipeline } from '@xenova/transformers';
import { AI_CONFIG } from '../config';
import type { EmbeddingProvider } from './provider';

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = { text: 384, image: 512 };

  private textPipeline: any = null;
  private imagePipeline: any = null;

  private async getTextPipeline() {
    if (!this.textPipeline) {
      this.textPipeline = await pipeline(
        'feature-extraction',
        AI_CONFIG.embedding.textModel,
      );
    }
    return this.textPipeline;
  }

  private async getImagePipeline() {
    if (!this.imagePipeline) {
      this.imagePipeline = await pipeline(
        'image-feature-extraction',
        AI_CONFIG.embedding.imageModel,
      );
    }
    return this.imagePipeline;
  }

  private normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map((v) => v / magnitude);
  }

  async embedText(text: string): Promise<number[]> {
    const extractor = await this.getTextPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const raw = Array.from(output.data as Float32Array);
    return this.normalize(raw);
  }

  async embedImage(imageUrl: string): Promise<number[]> {
    const extractor = await this.getImagePipeline();
    const output = await extractor(imageUrl);
    const raw = Array.from(output.data as Float32Array);
    return this.normalize(raw);
  }
}
```

- [ ] **Step 5: Create embeddings/api.ts (stub)**

```typescript
// src/lib/server/ai/embeddings/api.ts
import type { EmbeddingProvider } from './provider';

export class ApiEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = { text: 1536, image: 1024 };

  async embedText(_text: string): Promise<number[]> {
    throw new Error('API embedding provider not implemented. Set EMBEDDING_PROVIDER=local');
  }

  async embedImage(_imageUrl: string): Promise<number[]> {
    throw new Error('API embedding provider not implemented. Set EMBEDDING_PROVIDER=local');
  }
}
```

- [ ] **Step 6: Create clustering/assign.ts**

Note: Uses `n.cluster_id` and `n.item_id` (snake_case) to match raw SQL output from `findNearestNeighbors`.

```typescript
// src/lib/server/ai/clustering/assign.ts
import { findNearestNeighbors, addItemToCluster } from '$lib/server/db/queries';
import { AI_CONFIG } from '../config';
import type { EmbeddingType } from '../embeddings/provider';

interface AssignmentResult {
  clusterId: string;
  confidence: number;
}

export async function assignItemToCluster(
  itemId: string,
  embedding: number[],
  type: EmbeddingType,
): Promise<AssignmentResult | null> {
  const { assignmentK, assignmentThreshold } = AI_CONFIG.clustering;

  const neighbors = await findNearestNeighbors(embedding, type, assignmentK);

  // Filter to neighbors that have cluster assignments (exclude self)
  const assigned = neighbors.filter((n) => n.cluster_id !== null && n.item_id !== itemId);
  if (assigned.length === 0) return null;

  // Count votes per cluster
  const votes = new Map<string, { count: number; totalSimilarity: number }>();
  for (const n of assigned) {
    const cid = n.cluster_id!;
    const entry = votes.get(cid) ?? { count: 0, totalSimilarity: 0 };
    entry.count++;
    entry.totalSimilarity += n.similarity;
    votes.set(cid, entry);
  }

  // Find the winning cluster
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
```

- [ ] **Step 7: Create clustering/naming.ts**

```typescript
// src/lib/server/ai/clustering/naming.ts
import { AI_CONFIG } from '../config';

export async function generateClusterName(
  items: Array<{ title: string | null; content: string | null; type: string }>,
): Promise<string> {
  const { apiKey, model } = AI_CONFIG.openrouter;

  if (!apiKey) {
    return `Cluster #${Date.now().toString(36).slice(-4)}`;
  }

  const descriptions = items
    .slice(0, AI_CONFIG.clustering.namingSampleSize)
    .map((item, i) => {
      const parts = [item.type];
      if (item.title) parts.push(`"${item.title}"`);
      if (item.content) parts.push(item.content.slice(0, 100));
      return `${i + 1}. ${parts.join(' — ')}`;
    })
    .join('\n');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: `These saved items form a natural group:\n\n${descriptions}\n\nGive this collection a short, evocative name (2-4 words). No generic labels like "Miscellaneous" or "Various Topics". Return only the name, nothing else.`,
        }],
        max_tokens: 20,
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
    const data = await response.json();
    const name = data.choices?.[0]?.message?.content?.trim();
    return name || `Cluster #${Date.now().toString(36).slice(-4)}`;
  } catch (e) {
    console.error('Cluster naming failed:', e);
    return `Cluster #${Date.now().toString(36).slice(-4)}`;
  }
}
```

- [ ] **Step 8: Create clustering/recluster.ts**

Fixed issues: correct `ml-hclust` API usage, user cluster protection, explicit `source: 'ai'` on new clusters, centroid-based naming samples.

```typescript
// src/lib/server/ai/clustering/recluster.ts
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

// Cosine distance between two vectors (1 - cosine similarity)
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
  const [latestRun] = await db
    .select()
    .from(clusterRuns)
    .orderBy(sql`created_at DESC`)
    .limit(1);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(items)
    .where(isNotNull(items.textEmbedding));

  const [{ imgCount }] = await db
    .select({ imgCount: sql<number>`COUNT(*)` })
    .from(items)
    .where(isNotNull(items.imageEmbedding));

  const totalEmbedded = Number(count) + Number(imgCount);
  const lastProcessed = latestRun?.itemsProcessed ?? 0;

  return (totalEmbedded - lastProcessed) >= AI_CONFIG.clustering.reclusterInterval;
}

export async function runRecluster(triggeredBy: 'auto' | 'manual' = 'auto'): Promise<void> {
  const startTime = performance.now();

  const textItems = await db.select().from(items).where(isNotNull(items.textEmbedding));
  const imageItems = await db.select().from(items).where(isNotNull(items.imageEmbedding));
  const existingClusters = await db.select().from(clusters);
  const existingAssignments = await db.select().from(itemClusters);

  let clustersCreated = 0;
  let clustersModified = 0;

  if (textItems.length >= AI_CONFIG.clustering.minClusterSize) {
    const r = await clusterItemSet(
      textItems.map((i) => ({ id: i.id, embedding: i.textEmbedding! })),
      existingClusters,
      existingAssignments,
    );
    clustersCreated += r.created;
    clustersModified += r.modified;
  }

  if (imageItems.length >= AI_CONFIG.clustering.minClusterSize) {
    const r = await clusterItemSet(
      imageItems.map((i) => ({ id: i.id, embedding: i.imageEmbedding! })),
      existingClusters,
      existingAssignments,
    );
    clustersCreated += r.created;
    clustersModified += r.modified;
  }

  const durationMs = Math.round(performance.now() - startTime);

  await db.insert(clusterRuns).values({
    triggeredBy,
    itemsProcessed: textItems.length + imageItems.length,
    clustersCreated,
    clustersModified,
    durationMs,
  });

  console.log(
    `Re-cluster: ${textItems.length + imageItems.length} items, ` +
    `${clustersCreated} new, ${clustersModified} updated, ${durationMs}ms`,
  );
}

async function clusterItemSet(
  itemSet: Array<{ id: string; embedding: number[] }>,
  existingClusters: Array<{ id: string; name: string; source: string }>,
  existingAssignments: Array<{ itemId: string; clusterId: string }>,
): Promise<{ created: number; modified: number }> {
  if (itemSet.length < AI_CONFIG.clustering.minClusterSize) {
    return { created: 0, modified: 0 };
  }

  // Build pairwise distance matrix for ml-hclust
  const embeddings = itemSet.map((i) => i.embedding);
  const distMatrix: number[][] = [];
  for (let i = 0; i < embeddings.length; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < embeddings.length; j++) {
      distMatrix[i][j] = cosineDistance(embeddings[i], embeddings[j]);
    }
  }

  // agnes expects a data matrix; with isDistanceMatrix option it uses pre-computed distances
  const tree = agnes(distMatrix, { method: 'average', isDistanceMatrix: true });

  // Cut into a reasonable number of groups
  const numGroups = Math.max(2, Math.round(itemSet.length / 5));
  const cutResult = tree.group(numGroups);

  // Extract flat cluster labels from the cut dendrogram
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
  // cutResult.children are the top-level clusters after cutting
  const topGroups = cutResult.children || [cutResult];
  for (let i = 0; i < topGroups.length; i++) {
    assignLabels(topGroups[i], i);
  }

  // Group items by label
  const proposedGroups = new Map<number, string[]>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!proposedGroups.has(label)) proposedGroups.set(label, []);
    proposedGroups.get(label)!.push(itemSet[i].id);
  }

  // Build lookups
  const itemToCluster = new Map(existingAssignments.map((a) => [a.itemId, a.clusterId]));
  const userClusterIds = new Set(
    existingClusters.filter((c) => c.source === 'user').map((c) => c.id),
  );

  let created = 0;
  let modified = 0;

  for (const [groupLabel, memberIds] of proposedGroups) {
    if (memberIds.length < AI_CONFIG.clustering.minClusterSize) continue;

    // Skip items that belong to user-pinned clusters
    const reassignableIds = memberIds.filter((id) => {
      const existingCluster = itemToCluster.get(id);
      return !existingCluster || !userClusterIds.has(existingCluster);
    });
    if (reassignableIds.length < AI_CONFIG.clustering.minClusterSize) continue;

    // Check overlap with existing clusters
    const overlapCounts = new Map<string, number>();
    for (const itemId of reassignableIds) {
      const existing = itemToCluster.get(itemId);
      if (existing) {
        overlapCounts.set(existing, (overlapCounts.get(existing) || 0) + 1);
      }
    }

    // Find best matching existing cluster (>70% overlap)
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
      // Compute centroid for this group
      const groupEmbeddings = reassignableIds.map((id) => {
        const idx = itemSet.findIndex((i) => i.id === id);
        return itemSet[idx].embedding;
      });
      const centroid = groupEmbeddings[0].map((_, dim) =>
        groupEmbeddings.reduce((sum, e) => sum + e[dim], 0) / groupEmbeddings.length,
      );

      // Sample items closest to centroid for naming
      const withDist = reassignableIds.map((id) => {
        const idx = itemSet.findIndex((i) => i.id === id);
        return { id, dist: cosineDistance(itemSet[idx].embedding, centroid) };
      });
      withDist.sort((a, b) => a.dist - b.dist);
      const sampleIds = withDist.slice(0, AI_CONFIG.clustering.namingSampleSize).map((d) => d.id);

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
        itemCount: reassignableIds.length,
      });

      for (const itemId of reassignableIds) {
        await addItemToCluster(itemId, newCluster.id, 0.75);
      }

      created++;
    }
  }

  return { created, modified };
}
```

- [ ] **Step 9: Rewrite pipeline.ts**

Replace entire file:

```typescript
// src/lib/server/ai/pipeline.ts
import { getEmbeddingProvider, getEmbeddingType } from './embeddings/provider';
import { assignItemToCluster } from './clustering/assign';
import { shouldRecluster, runRecluster } from './clustering/recluster';
import { updateItemEmbedding, setEmbeddingStatus } from '$lib/server/db/queries';

export async function processItemPipeline(
  itemId: string,
  item: {
    type: string;
    title?: string | null;
    content?: string | null;
    url?: string | null;
    thumbnailUrl?: string | null;
  },
): Promise<void> {
  const embeddingType = getEmbeddingType(item.type);

  // Step 1: Generate embedding
  let embedding: number[];
  try {
    const provider = await getEmbeddingProvider();

    if (embeddingType === 'image') {
      const imageUrl = item.url || item.thumbnailUrl;
      if (!imageUrl) {
        console.warn(`Item ${itemId}: no image URL, skipping embedding`);
        await setEmbeddingStatus(itemId, 'failed');
        return;
      }
      embedding = await provider.embedImage(imageUrl);
    } else {
      const parts: string[] = [];
      if (item.title) parts.push(item.title);
      if (item.content) parts.push(item.content);
      const text = parts.join('. ') || 'untitled item';
      embedding = await provider.embedText(text);
    }

    await updateItemEmbedding(itemId, embedding, embeddingType);
    console.log(`Embedded item ${itemId} (${embeddingType}, ${embedding.length}d)`);
  } catch (e) {
    console.error(`Embedding failed for item ${itemId}:`, e);
    await setEmbeddingStatus(itemId, 'failed');
    return;
  }

  // Step 2: Assign to nearest cluster
  try {
    const result = await assignItemToCluster(itemId, embedding, embeddingType);
    if (result) {
      console.log(`Assigned item ${itemId} → ${result.clusterId} (${(result.confidence * 100).toFixed(0)}%)`);
    }
  } catch (e) {
    console.error(`Cluster assignment failed for item ${itemId}:`, e);
  }

  // Step 3: Check if full re-clustering is needed
  try {
    if (await shouldRecluster()) {
      console.log('Triggering automatic re-clustering...');
      await runRecluster('auto');
    }
  } catch (e) {
    console.error('Auto re-cluster failed:', e);
  }
}
```

- [ ] **Step 10: Rewrite index.ts barrel exports**

Replace entire file:

```typescript
// src/lib/server/ai/index.ts
export { getEmbeddingProvider, getEmbeddingType } from './embeddings/provider';
export type { EmbeddingProvider, EmbeddingType } from './embeddings/provider';
export { assignItemToCluster } from './clustering/assign';
export { shouldRecluster, runRecluster } from './clustering/recluster';
export { generateClusterName } from './clustering/naming';
export { processItemPipeline } from './pipeline';
export { AI_CONFIG } from './config';
```

- [ ] **Step 11: Delete old flat files**

```bash
rm src/lib/server/ai/embeddings.ts src/lib/server/ai/clustering.ts
```

- [ ] **Step 12: Commit all together**

```bash
git add src/lib/server/ai/ package.json package-lock.json
git commit -m "feat(ai): implement embedding provider, clustering engine, and rewrite pipeline"
```

---

## Task 4: Update Search API

**Files:**
- Modify: `src/routes/api/search/+server.ts`

- [ ] **Step 1: Update search endpoint for dual columns**

```typescript
import type { RequestHandler } from './$types';
import { getEmbeddingProvider } from '$lib/server/ai';
import { searchSimilarItems } from '$lib/server/db/queries';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const provider = await getEmbeddingProvider();
    const embedding = await provider.embedText(query);
    const results = await searchSimilarItems(embedding, 'text', limit);

    return new Response(JSON.stringify({ query, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Search failed:', e);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/search/+server.ts
git commit -m "feat(api): update search endpoint for dual embedding columns"
```

---

## Task 5: Update Seed Script

**Files:**
- Modify: `src/lib/server/db/seed.ts`

- [ ] **Step 1: Add `source: 'user'` to cluster insertions**

In the seed script, find the cluster insert block (around lines 26-44) and add `source: 'user'` to each cluster object. These are human-defined demo clusters, not AI-discovered.

- [ ] **Step 2: Remove any references to old `embedding` column**

If the seed sets `embedding` on items, remove it. Items will start with `embeddingStatus: 'pending'` by default and get embedded when the pipeline runs.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/db/seed.ts
git commit -m "feat(db): update seed script for new schema (source, embeddingStatus)"
```

---

## Task 6: Cleanup + Verify Build

- [ ] **Step 1: Search for dangling imports**

Search the entire codebase for:
- `from '$lib/server/ai/embeddings'` (old flat file)
- `from '$lib/server/ai/clustering'` (old flat file)
- `generateTextEmbedding` / `generateImageEmbedding` / `generateAndStoreEmbedding`
- `cosineSimilarity` / `findNearestCluster` / `suggestClusters`
- `EmbeddingResult` / `ClusterAssignment` (removed from types.ts)

Fix any found references to use the new module paths or the barrel export from `$lib/server/ai`.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no errors related to the AI pipeline.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix dangling imports after AI pipeline restructure"
```

---

## Task 7: Gitignore + Final

- [ ] **Step 1: Ensure `.superpowers/` is in .gitignore**

Add if missing.

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```
