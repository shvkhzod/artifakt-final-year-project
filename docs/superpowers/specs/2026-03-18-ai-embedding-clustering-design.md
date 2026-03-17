# AI Embedding & Clustering Pipeline — Design Spec

**Date**: 2026-03-18
**Status**: Draft
**Scope**: The core AI backbone — save → embed → cluster → place on map

## Problem

Aina's Library, Taste Map, and Timeline all run on demo data. The AI pipeline that makes Aina meaningful — automatically organizing saved content and revealing patterns — is stubbed. Without it, the app is a bookmarking tool with pretty visualizations.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding location | Server-side (Node.js) | Simpler, reliable, all item types handled uniformly |
| Embedding runtime | Transformers.js (ONNX/WASM) | Local-first, free, no data leaves the server |
| Provider model | Swappable interface | Ship with Transformers.js, upgrade to API provider later |
| Clustering approach | Hybrid auto-discover + user-refinable | AI proposes structure, user has final say |
| Update UX | Invisible until settled | Calm technology — the map just reflects current state |
| Cross-type similarity | Separate vector spaces | Text (384-dim) and images (512-dim) cluster independently |

## Architecture

### Embedding Pipeline

Provider-agnostic embedding service behind a clean interface:

```
EmbeddingProvider (interface)
  ├── LocalProvider (Transformers.js, ONNX/WASM, ships by default)
  └── APIProvider (OpenAI/Voyage/Cohere, future swap-in)
```

**Interface**:

```typescript
interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedImage(imageUrl: string): Promise<number[]>;
  dimensions: { text: number; image: number };
}
```

**Models**:
- Text (quotes, articles): `all-MiniLM-L6-v2` — 384-dim, fast, good semantic quality
- Images (photos, screenshots): `clip-vit-base-patch32` — 512-dim, understands visual concepts

**Model loading**: Lazy initialization. First embed takes 3-5s to load model into memory. Subsequent embeds: ~200-500ms text, ~1-2s image. Models stay warm for the server's lifetime.

**Save flow**:
1. User saves item → API returns immediately with the created item
2. Background: `processItemPipeline(item)` fires (non-blocking)
3. Pipeline calls `embed(item)` based on item type
4. Writes vector to `items.text_embedding` or `items.image_embedding`
5. Updates `items.embedding_status` to `'complete'` (or `'failed'` on error)
6. Triggers cluster assignment

### Clustering Engine

Two modes: fast single-item assignment and periodic full re-clustering.

**Single-item assignment** (runs on every new embedding):
1. Query pgvector for K=5 nearest neighbors by cosine similarity, joining `item_clusters` in the same query to get their cluster assignments. No loading all assignments into memory.
2. If majority of neighbors belong to one cluster AND cosine similarity is above threshold (0.65) → assign item to that cluster
3. Confidence score = proportion of neighbors in winning cluster × mean cosine similarity
4. If no clear cluster → item remains unassigned (appears as a lone star on the Taste Map)

**Full re-clustering** (triggered after ~20 new items, or manually):
1. Track the count via the `cluster_runs` table: compare `items_processed` of the latest run to the current total item count. If delta >= 20, trigger re-cluster.
2. Fetch all embeddings (text and image separately)
3. Run agglomerative clustering using `ml-hclust` (hierarchical clustering library) with cosine distance and a distance threshold
4. Compare proposed clusters to existing ones:
   - Matching cluster (>70% overlap) → keep existing, update membership
   - New grouping with no match → create as suggested cluster (source: `'ai'`)
   - Existing cluster with no match → keep if user-created (source: `'user'`), mark for review if AI-created
5. Trigger cluster naming for any new clusters

**Cluster naming** (via OpenRouter LLM):
- Sample 5-8 representative items from the cluster (closest to centroid)
- Prompt: *"These saved items form a natural group. Give this collection a short, evocative name (2-4 words). No generic labels like 'Miscellaneous' or 'Various Topics'."*
- Store AI name as default. User can rename anytime.
- Model: Use whatever is current for fast/cheap tasks at implementation time (e.g., `anthropic/claude-haiku-4-5-20251001`). Verify against OpenRouter availability.

**Cluster color assignment**: New AI-created clusters receive colors by rotating through the Okabe-Ito palette defined in `CLUSTER_COLORS` (`src/lib/utils/colors.ts`). If all 6 colors are in use, cycle back with a brightness offset to avoid exact duplication.

**User refinement**:
- Clusters have `source`: `'ai'` or `'user'`
- User-renamed or user-created clusters are pinned — never auto-merged or auto-deleted
- AI clusters can be merged, split, or dismissed by the user

**Confidence scores**:
- Each `item_clusters` row has a confidence (0-1)
- Items near cluster boundaries get lower confidence
- Taste Map uses confidence for positioning: low-confidence items sit between clusters

**Cross-type clustering**:
- Text and image embeddings live in separate vector spaces (different dimensions)
- Clustering runs within type independently
- Cross-type cluster membership happens organically: an architecture photo clusters with other architecture images; an architecture article clusters with other architecture text. If both groups get named similarly by the LLM, they can be merged by the user or by a future cross-modal linking step.

### Integration with Existing UI

| Surface | Change | Details |
|---------|--------|---------|
| Library | Minimal | Items appear instantly on save. Cluster filter pills update as clusters are created. Unassigned items have no cluster indicator. |
| Taste Map | Positions become real | Node positions derived from embedding similarity, not random. Cluster centroids computed from member embeddings. |
| Item Detail | Similar items become real | Powered by vector nearest-neighbor search. Confidence % already displayed. |
| Timeline | No change | Stream graph already reads cluster assignments by date. Works automatically with real data. |
| Insights | Stays demo | AI-generated insights are a separate future feature built on top of this clustering foundation. |

## Database Changes

### Drizzle schema updates

The existing `vector` custom type in `schema.ts` is hardcoded to `vector(512)`. Replace it with a parameterized factory:

```typescript
// Parameterized vector type for pgvector
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

**Items table changes**:
- Remove: `embedding vector(512)` column
- Add: `textEmbedding` using `pgVector(384)`
- Add: `imageEmbedding` using `pgVector(512)`
- Add: `embeddingStatus` — `text('embedding_status', { enum: ['pending', 'complete', 'failed'] }).default('pending')`

**Clusters table changes**:
- Add: `source` — `text('source', { enum: ['ai', 'user'] }).default('ai')`

**New table — `clusterRuns`**:

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
```

**Migration note**: Any existing data with padded 512-dim text embeddings (from the current `padVector` in `embeddings.ts`) must be discarded — re-embed all text items after migration. The `padVector` function is removed.

### Query function updates

Update `src/lib/server/db/queries.ts`:

- `updateItemEmbedding(id, vector)` → `updateItemEmbedding(id, vector, type: 'text' | 'image')` — writes to the correct column based on type
- `searchSimilarItems(embedding, limit)` → `searchSimilarItems(embedding, type: 'text' | 'image', limit)` — queries the correct vector column
- Add: `getItemsWithoutEmbedding()` — returns items where `embeddingStatus IN ('pending', 'failed')`, for batch processing and retry on startup
- Add: `findNearestNeighbors(embedding, type: 'text' | 'image', k: number)` — returns K nearest items with their cluster assignments in a single joined query (used by single-item cluster assignment)

## File Structure

Replaces the existing flat files (`embeddings.ts`, `clustering.ts`, `pipeline.ts`, `index.ts`) in `src/lib/server/ai/`. Old files are deleted, not left alongside.

```
src/lib/server/ai/
├── embeddings/
│   ├── provider.ts        # EmbeddingProvider interface + factory function
│   ├── local.ts           # Transformers.js implementation (lazy model loading)
│   └── api.ts             # API provider stub (OpenAI/Voyage/Cohere — interface only)
├── clustering/
│   ├── assign.ts          # Single-item nearest-neighbor assignment
│   ├── recluster.ts       # Full agglomerative re-clustering (uses ml-hclust)
│   └── naming.ts          # LLM cluster naming via OpenRouter
├── pipeline.ts            # Orchestrator: embed → assign → (maybe recluster)
└── config.ts              # Provider selection, thresholds, model paths
```

**New dependency**: `ml-hclust` — hierarchical agglomerative clustering library for JavaScript. Lightweight, no native dependencies.

## Configuration

```typescript
// src/lib/server/ai/config.ts
export const AI_CONFIG = {
  embedding: {
    provider: 'local' as 'local' | 'api',
    textModel: 'Xenova/all-MiniLM-L6-v2',
    imageModel: 'Xenova/clip-vit-base-patch32',
  },
  clustering: {
    assignmentK: 5,                    // nearest neighbors for assignment
    assignmentThreshold: 0.65,         // min cosine similarity to assign
    reclusterInterval: 20,             // new items before auto-recluster
    minClusterSize: 3,                 // minimum items to form a cluster
    namingSampleSize: 8,               // items sent to LLM for naming
  },
  openrouter: {
    model: 'anthropic/claude-haiku-4-5-20251001',  // verify at implementation time
  },
};
```

## Error Handling

- **Model load failure**: Log error, set `items.embedding_status = 'failed'`. Items with `'failed'` status can be retried via `getItemsWithoutEmbedding()` (which also returns `'pending'` items).
- **Clustering failure**: Log error, item remains unassigned. Does not block the save flow.
- **LLM naming failure**: Cluster gets a fallback name: `"Cluster #N"` where N is the cluster count. User can rename.
- **All failures are non-blocking**: The save API always returns success. AI processing is best-effort background work.

## Performance Expectations

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| First text embed | 3-5s | Model loading |
| Subsequent text embed | 200-500ms | Warm model |
| First image embed | 5-8s | CLIP model larger |
| Subsequent image embed | 1-2s | Warm model |
| Cluster assignment (KNN) | 10-50ms | pgvector index, single joined query |
| Full re-cluster (100 items) | 2-5s | ml-hclust agglomerative |
| Cluster naming (LLM) | 1-3s | OpenRouter API call |

## Out of Scope

- AI-generated insights (future feature, builds on this foundation)
- Client-side embeddings (future optimization, provider interface supports it)
- Cross-modal search (finding articles related to an image — needs shared embedding space)
- Real-time cluster visualization updates (map refreshes on page load, not live)
- Browser extension (separate feature, but will use the same `/api/items` → pipeline flow)
