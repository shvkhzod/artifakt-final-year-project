# Exploration Search — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform search from flat retrieval into exploration with branching paths, contextual scoping, and chainable wandering through your collection.

**Architecture:** New `/api/items/[id]/related` endpoint returns 3 lanes (semantic, cluster, temporal). SearchOverlay gains context awareness via store. Item detail page supports in-place exploration without full page navigation.

**Tech Stack:** SvelteKit, Drizzle ORM, pgvector, existing embedding pipeline

**Spec:** `docs/superpowers/specs/2026-03-18-exploration-search-design.md`

---

## File Map

### New files
- `src/routes/api/items/[id]/related/+server.ts` — Branching paths endpoint
- `src/lib/components/shared/ExplorationPaths.svelte` — 3-lane exploration UI
- `src/lib/components/shared/ExplorationBreadcrumbs.svelte` — Exploration trail

### Modified files
- `src/lib/server/db/queries.ts` — Add `getTemporalNeighbors`, update `getItemsByCluster` with limit
- `src/lib/stores/appStore.svelte.ts` — Add `SearchContext` state, update `performSearch`
- `src/routes/api/search/+server.ts` — Add scoping params + groupByCluster
- `src/routes/api/items/+server.ts` — Strip embeddings from GET response
- `src/routes/api/items/[id]/+server.ts` — Strip embeddings from GET response
- `src/lib/components/shared/SearchOverlay.svelte` — Context pills, grouped results, cluster dots, relative dates
- `src/routes/item/[id]/+page.svelte` — Exploration state, in-place item swapping, breadcrumbs
- `src/routes/+page.svelte` — Set search context on mount
- `src/routes/tastemap/+page.svelte` — Set search context on mount
- `src/routes/timeline/+page.svelte` — Set search context on mount

---

## Task 1: Query Functions + Embedding Stripping

**Files:**
- Modify: `src/lib/server/db/queries.ts`

- [ ] **Step 1: Add `getTemporalNeighbors`**

Add after the existing `setEmbeddingStatus` function:

```typescript
export async function getTemporalNeighbors(
  itemId: string,
  createdAt: Date,
  limit: number = 5,
): Promise<Item[]> {
  return db
    .select()
    .from(items)
    .where(sql`
      id != ${itemId}
      AND created_at BETWEEN ${createdAt.toISOString()}::timestamptz - INTERVAL '7 days'
                          AND ${createdAt.toISOString()}::timestamptz + INTERVAL '7 days'
    `)
    .orderBy(items.createdAt)
    .limit(limit);
}
```

- [ ] **Step 2: Update `getItemsByCluster` with optional limit**

The current function returns all items. Add a `limit` parameter:

```typescript
export async function getItemsByCluster(
  clusterId: string,
  limit?: number,
): Promise<Item[]> {
  const query = db
    .select({ item: items })
    .from(items)
    .innerJoin(itemClusters, eq(items.id, itemClusters.itemId))
    .where(eq(itemClusters.clusterId, clusterId))
    .orderBy(sql`${items.createdAt} DESC`);

  const results = limit ? await query.limit(limit) : await query;
  return results.map((r) => r.item);
}
```

- [ ] **Step 3: Add `stripEmbeddings` utility**

Add at the top of queries.ts (after imports). Must handle both camelCase (Drizzle ORM results) and snake_case (raw SQL results):

```typescript
export function stripEmbeddings<T extends Record<string, any>>(item: T): T {
  const copy = { ...item };
  // Drizzle ORM returns camelCase
  delete copy.textEmbedding;
  delete copy.imageEmbedding;
  // Raw SQL (db.execute) returns snake_case
  delete copy.text_embedding;
  delete copy.image_embedding;
  return copy;
}
```

- [ ] **Step 4: Commit**

---

## Task 2: Related Items API Endpoint

**Files:**
- Create: `src/routes/api/items/[id]/related/+server.ts`
- Modify: `src/routes/api/items/[id]/+server.ts` — strip embeddings

- [ ] **Step 1: Create the related endpoint**

```typescript
// src/routes/api/items/[id]/related/+server.ts
import type { RequestHandler } from './$types';
import {
  getItemById,
  searchSimilarItems,
  getItemsByCluster,
  getTemporalNeighbors,
  stripEmbeddings,
} from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { itemClusters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
  const item = await getItemById(params.id);
  if (!item) {
    return new Response(JSON.stringify({ error: 'Item not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isImage = item.type === 'image' || item.type === 'screenshot';
  const embeddingType = isImage ? 'image' as const : 'text' as const;
  const embedding = isImage ? item.imageEmbedding : item.textEmbedding;

  // Semantic lane
  let semantic: any[] = [];
  try {
    if (embedding) {
      const results = await searchSimilarItems(embedding, embeddingType, 6);
      semantic = results
        .filter((r) => r.id !== params.id)
        .slice(0, 5)
        .map(stripEmbeddings);
    }
  } catch (e) {
    console.error('Related: semantic search failed:', e);
  }

  // Cluster lane
  let cluster: any[] = [];
  try {
    const [assignment] = await db
      .select()
      .from(itemClusters)
      .where(eq(itemClusters.itemId, params.id))
      .limit(1);

    if (assignment) {
      const clusterItems = await getItemsByCluster(assignment.clusterId, 6);
      cluster = clusterItems
        .filter((i) => i.id !== params.id)
        .slice(0, 5)
        .map(stripEmbeddings);
    }
  } catch (e) {
    console.error('Related: cluster search failed:', e);
  }

  // Temporal lane
  let temporal: any[] = [];
  try {
    const neighbors = await getTemporalNeighbors(params.id, item.createdAt, 5);
    temporal = neighbors.map(stripEmbeddings);
  } catch (e) {
    console.error('Related: temporal search failed:', e);
  }

  return new Response(JSON.stringify({ semantic, cluster, temporal }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Strip embeddings from existing item GET endpoint**

In `src/routes/api/items/[id]/+server.ts`, update the GET handler to strip embeddings before returning. Import `stripEmbeddings` from queries and apply it to the item response.

- [ ] **Step 3: Strip embeddings from items list GET endpoint**

In `src/routes/api/items/+server.ts`, import `stripEmbeddings` from `$lib/server/db/queries` and apply it to the items array in the GET handler. Find where it returns `json(items)` and change to `json(items.map(stripEmbeddings))`.

- [ ] **Step 4: Commit**

---

## Task 3: Search Context Store

**Files:**
- Modify: `src/lib/stores/appStore.svelte.ts`

- [ ] **Step 1: Add SearchContext type and state**

Add after the view transition state section:

```typescript
// ── Search Context ──
// Set by each page, read by SearchOverlay for contextual scoping

export interface SearchContext {
  page: 'library' | 'tastemap' | 'timeline' | 'item';
  clusterId?: string;
  clusterName?: string;
  clusterColor?: string;
  after?: string;
  before?: string;
  itemId?: string;
}

let _searchContext: SearchContext = $state({ page: 'library' });

export function getSearchContext() {
  return _searchContext;
}

export function setSearchContext(ctx: SearchContext) {
  _searchContext = ctx;
}
```

- [ ] **Step 2: Update `performSearch` to pass context**

Replace the existing `performSearch` function. Keep the debounce logic but update the fetch to include context params:

```typescript
export async function performSearch(query: string) {
  _searchQuery = query;

  if (!query.trim()) {
    _searchResults = [];
    _isSearching = false;
    return;
  }

  if (searchDebounce) clearTimeout(searchDebounce);

  searchDebounce = setTimeout(async () => {
    _isSearching = true;
    try {
      const ctx = _searchContext;
      const params = new URLSearchParams({ q: query });
      if (ctx.clusterId) params.set('clusterId', ctx.clusterId);
      if (ctx.after) params.set('after', ctx.after);
      if (ctx.before) params.set('before', ctx.before);
      if (ctx.page === 'library') params.set('groupByCluster', 'true');

      const res = await fetch(`/api/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        _searchResults = data.results ?? data.groups ?? data;
      }
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      _isSearching = false;
    }
  }, 300);
}
```

- [ ] **Step 3: Commit**

---

## Task 4: Update Search API with Scoping + Grouping

**Files:**
- Modify: `src/routes/api/search/+server.ts`

- [ ] **Step 1: Add scoping and groupByCluster**

Replace the entire file:

```typescript
import type { RequestHandler } from './$types';
import { getEmbeddingProvider } from '$lib/server/ai';
import { searchSimilarItems, stripEmbeddings } from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { itemClusters, clusters } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const clusterId = url.searchParams.get('clusterId');
  const after = url.searchParams.get('after');
  const before = url.searchParams.get('before');
  const groupByCluster = url.searchParams.get('groupByCluster') === 'true';

  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const provider = await getEmbeddingProvider();
    const embedding = await provider.embedText(query);
    let results = await searchSimilarItems(embedding, 'text', limit * 2);

    // Strip embeddings from results
    results = results.map(stripEmbeddings) as typeof results;

    // Apply date scoping
    if (after) {
      const afterDate = new Date(after);
      results = results.filter((r) => new Date(r.createdAt) >= afterDate);
    }
    if (before) {
      const beforeDate = new Date(before);
      results = results.filter((r) => new Date(r.createdAt) <= beforeDate);
    }

    // Apply cluster scoping
    if (clusterId) {
      const assignments = await db
        .select()
        .from(itemClusters)
        .where(eq(itemClusters.clusterId, clusterId));
      const itemIds = new Set(assignments.map((a) => a.itemId));
      results = results.filter((r) => itemIds.has(r.id));
    }

    // Trim to limit after filtering
    results = results.slice(0, limit);

    // Group by cluster if requested
    if (groupByCluster) {
      const allAssignments = await db.select().from(itemClusters);
      const allClusters = await db.select().from(clusters);
      const itemToCluster = new Map(allAssignments.map((a) => [a.itemId, a.clusterId]));
      const clusterMap = new Map(allClusters.map((c) => [c.id, { id: c.id, name: c.name, color: c.color }]));

      const groupMap = new Map<string | 'none', typeof results>();
      for (const item of results) {
        const cId = itemToCluster.get(item.id) ?? 'none';
        if (!groupMap.has(cId)) groupMap.set(cId, []);
        groupMap.get(cId)!.push(item);
      }

      const groups = Array.from(groupMap.entries()).map(([cId, items]) => ({
        cluster: cId === 'none' ? null : clusterMap.get(cId) ?? null,
        items,
      }));

      return new Response(JSON.stringify({ query, groups }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

---

## Task 5: Set Search Context on Each Page

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/tastemap/+page.svelte`
- Modify: `src/routes/timeline/+page.svelte`

- [ ] **Step 1: Library page — set context on mount**

In `src/routes/+page.svelte`, add in the `<script>` section:

```typescript
import { onMount } from 'svelte';
// ... existing imports ...

onMount(() => {
  appStore.setSearchContext({ page: 'library' });
});
```

- [ ] **Step 2: Taste Map page — set context on mount**

In `src/routes/tastemap/+page.svelte`, add:

```typescript
import { onMount } from 'svelte';
import * as appStore from '$lib/stores/appStore.svelte';

onMount(() => {
  appStore.setSearchContext({ page: 'tastemap' });
});
```

When a cluster is selected (in `handleSelectNode`), also update the context:

```typescript
function handleSelectNode(item: Item, cluster: Cluster | null) {
  selectedItem = item;
  selectedCluster = cluster;
  if (cluster) {
    appStore.setSearchContext({
      page: 'tastemap',
      clusterId: cluster.id,
      clusterName: cluster.name,
      clusterColor: cluster.color,
    });
  }
}

function handleCloseDetail() {
  selectedItem = null;
  selectedCluster = null;
  appStore.setSearchContext({ page: 'tastemap' });
}
```

- [ ] **Step 3: Timeline page — set context based on range**

In `src/routes/timeline/+page.svelte`, add:

```typescript
import { onMount } from 'svelte';
import * as appStore from '$lib/stores/appStore.svelte';

onMount(() => {
  updateSearchContext();
});

function updateSearchContext() {
  const now = new Date();
  const rangeMonths: Record<TimeRange, number | null> = {
    '3M': 3, '6M': 6, '1Y': 12, 'ALL': null,
  };
  const months = rangeMonths[activeRange];
  if (months) {
    const after = new Date(now);
    after.setMonth(after.getMonth() - months);
    appStore.setSearchContext({
      page: 'timeline',
      after: after.toISOString(),
      before: now.toISOString(),
    });
  } else {
    appStore.setSearchContext({ page: 'timeline' });
  }
}
```

Update the range tab click handler to call `updateSearchContext()` after changing the range:

```typescript
onclick={() => { activeRange = range; updateSearchContext(); }}
```

- [ ] **Step 4: Commit**

---

## Task 6: ExplorationPaths Component

**Files:**
- Create: `src/lib/components/shared/ExplorationPaths.svelte`

- [ ] **Step 1: Create the component**

This renders 3 horizontal lanes of related items. Each lane fetches from `/api/items/[id]/related`. Clicking an item fires `oncenter`. Empty lanes are hidden. Loading shows shimmer placeholders.

The component should:
- Accept props: `itemId: string`, `initialSemantic?: any[]`
- Fetch `/api/items/${itemId}/related` on mount and when `itemId` changes
- If `initialSemantic` is provided on first render, use it for the semantic lane and skip that part of the fetch
- Render each non-empty lane as: label → horizontal scrollable row of compact cards
- Compact card: if image/screenshot type, show thumbnail; otherwise show title text. Show cluster color dot. All clickable.
- Fire `oncenter` event with `{ id, title, type }` when a card is clicked
- Use shimmer animation for loading (3 rectangles per lane)
- Style: scoped CSS, dark theme, consistent with Aina design tokens

- [ ] **Step 2: Commit**

---

## Task 7: ExplorationBreadcrumbs Component

**Files:**
- Create: `src/lib/components/shared/ExplorationBreadcrumbs.svelte`

- [ ] **Step 1: Create the component**

Props: `trail: Array<{ id: string; title: string | null; type: string }>`, `onnavigate: (id: string, index: number) => void`

- Horizontal row of small pills
- Each pill: type icon (small SVG) + truncated title (max 20 chars) + separator arrow
- Clicking a pill calls `onnavigate(id, index)`
- If more than 8 crumbs, show "..." for earlier items
- Subtle left-fade gradient when overflowing
- Style: compact, subdued, sits above the item content

- [ ] **Step 2: Commit**

---

## Task 8: Item Detail Page — Exploration Integration

**Files:**
- Modify: `src/routes/item/[id]/+page.svelte`

- [ ] **Step 1: Add exploration state and handlers**

Add to the script section:

```typescript
import ExplorationPaths from '$lib/components/shared/ExplorationPaths.svelte';
import ExplorationBreadcrumbs from '$lib/components/shared/ExplorationBreadcrumbs.svelte';

let exploringItemId: string | null = $state(null);
let explorationTrail: Array<{ id: string; title: string | null; type: string }> = $state([]);
let exploringItemData: any = $state(null);

// The "active" item is either the exploring one or the server-loaded one
let activeItem = $derived(exploringItemData?.item ?? data.item);
let activeCluster = $derived(exploringItemData?.cluster ?? data.cluster);
let activeTags = $derived(exploringItemData?.tags ?? data.tags);

function handleExplore(detail: { id: string; title: string | null; type: string }) {
  // Push current item onto trail
  const current = exploringItemData?.item ?? data.item;
  explorationTrail = [...explorationTrail, { id: current.id, title: current.title, type: current.type }];

  // Set new exploring item
  exploringItemId = detail.id;
  history.replaceState(null, '', `/item/${detail.id}`);

  // Fetch new item data
  fetchItemData(detail.id);
}

function handleBreadcrumbNavigate(id: string, index: number) {
  explorationTrail = explorationTrail.slice(0, index);
  exploringItemId = id;
  history.replaceState(null, '', `/item/${id}`);
  fetchItemData(id);
}

async function fetchItemData(id: string) {
  try {
    const res = await fetch(`/api/items/${id}`);
    if (res.ok) {
      const item = await res.json();
      // Fetch cluster + tags from the page server load equivalent
      // For now, just set the item. Full data can come from the related endpoint.
      exploringItemData = { item, cluster: null, tags: [], similarItems: [] };
    }
  } catch (e) {
    console.error('Failed to fetch item:', e);
  }
}
```

- [ ] **Step 2: Update the template**

Replace the `{#if data.similarItems.length > 0}` similar items section with:

```svelte
{#if explorationTrail.length > 0}
  <ExplorationBreadcrumbs
    trail={explorationTrail}
    onnavigate={handleBreadcrumbNavigate}
  />
{/if}

<ExplorationPaths
  itemId={exploringItemId ?? data.item.id}
  initialSemantic={!exploringItemId ? data.similarItems : undefined}
  oncenter={handleExplore}
/>
```

Update the template to use `activeItem`, `activeCluster`, `activeTags` instead of `data.item`, `data.cluster`, `data.tags` throughout.

- [ ] **Step 3: Set search context on mount**

Add `onMount` to the imports (it's not currently imported) and set context:

```typescript
import { onMount } from 'svelte';
import * as appStore from '$lib/stores/appStore.svelte';

onMount(() => {
  appStore.setSearchContext({ page: 'item', itemId: data.item.id });
});
```

- [ ] **Step 4: Commit**

---

## Task 9: SearchOverlay — Context Pills + Grouped Results

**Files:**
- Modify: `src/lib/components/shared/SearchOverlay.svelte`

- [ ] **Step 1: Add context awareness**

Read `appStore.getSearchContext()` and render a context pill when scoped:
- If `clusterId` is set: show a pill with the cluster color dot + name + "x" to clear
- If `after`/`before` is set: show a pill like "Last 6 months" + "x" to clear
- Clearing the scope calls `appStore.setSearchContext({ page: currentPage })` without the scoping fields

- [ ] **Step 2: Add cluster grouping to results**

When the search response contains `groups` instead of `results`, render results grouped under cluster headers. Each header: cluster color dot + name + count in parentheses. Items within each group render as normal result rows.

- [ ] **Step 3: Add cluster dot and relative date to each result**

Each result row gets:
- Left: a small cluster color dot (look up the item's cluster from the grouped data or from a separate query)
- Right: relative date like "2mo ago", "1w ago", "today"

A utility function for relative dates:
```typescript
function relativeDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
```

- [ ] **Step 4: Add Shift+Enter for exploration**

In the keydown handler, detect Shift+Enter on a highlighted result. When triggered, fetch `/api/items/${selectedId}/related` and render an inline ExplorationPaths component below the search results.

- [ ] **Step 5: Add "find related" mode when opened from item detail**

When `getSearchContext().page === 'item'` and the overlay opens with an empty query, automatically show ExplorationPaths for `getSearchContext().itemId` instead of the empty "Type to search" state. When the user starts typing, switch to normal search mode. This means:

- Add a derived state: `let showRelatedMode = $derived(appStore.getSearchContext().page === 'item' && !appStore.getSearchQuery().trim())`
- When `showRelatedMode` is true, render ExplorationPaths with the item ID from the search context
- When the user types anything, the query becomes non-empty and `showRelatedMode` becomes false, revealing normal search results

- [ ] **Step 6: Commit**

---

## Task 10: Cleanup + Verify Build

- [ ] **Step 1: Verify build**

```bash
npm run build
```

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Commit fixes**
