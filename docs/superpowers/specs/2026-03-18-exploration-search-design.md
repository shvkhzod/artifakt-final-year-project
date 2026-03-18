# Exploration Search — Design Spec

**Date**: 2026-03-18
**Status**: Draft
**Scope**: Transform search from retrieval into exploration — branching paths, contextual scoping, chainable wandering

## Problem

Search in Aina is a dead end. You type, get a flat list, click a result, and the search experience is over. There's no way to explore *from* a result, no awareness of where results live in your collection, and search ignores the context you're already in (which cluster, which time range). For a curation tool about self-reflection, search should be a way to wander through your own mind.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Exploration model | Branching paths from any item | Multiple dimensions of similarity reveal different connections |
| Exploration depth | Chainable (B-style drifting) | Each item becomes a new center; breadcrumbs for backtracking |
| Search context | Contextual scoping + universal awareness | Search adapts to where you are; results show where they live |
| Exploration navigation | In-place swap, not SvelteKit navigation | Keeps exploration trail in client state; URL updates via replaceState |
| Keyboard shortcut for explore | Shift+Enter (not Tab) | Tab is reserved for focus management / accessibility |
| New pages | None | Exploration lives in item detail + search overlay. Additive, not structural |
| New tables | None | Built entirely on existing embeddings, clusters, timestamps |

## Architecture

### Exploration Mode — "Wander"

Any item can become an exploration starting point. The UI reveals three **branching paths** — different dimensions of similarity:

1. **Semantically similar** — items whose embeddings are closest (vector search)
2. **Same cluster** — other items the AI grouped together (shared theme)
3. **Saved nearby in time** — items saved within ±7 days (what was on your mind then?)

Each path shows 3-5 items. Clicking any item **swaps it in-place** (no full page navigation) — paths recalculate. A breadcrumb trail shows the exploration path for backtracking.

**Navigation model**: Exploration does NOT use `goto()` or SvelteKit navigation. Instead:
- The item detail page maintains an `exploringItemId` client state
- When a user clicks an item in the exploration paths, `exploringItemId` updates, the page fetches new data from `/api/items/[id]` and `/api/items/[id]/related`, and re-renders in place
- The URL updates via `history.replaceState()` to reflect the current item (for sharing/bookmarking)
- The breadcrumb trail is client-side state (an array of `{ id, title, type }`)
- Browser back button is NOT wired to exploration history (keeps things simple)

### Context-Aware Search

The Cmd+K search overlay becomes context-aware:

**Library page**: Results grouped by cluster. "Visual Aesthetics (3)" → items. Shows the topology of your search.

**Taste Map**: If a cluster is focused, search is auto-scoped to it. A pill shows "Searching in: Visual Aesthetics" with an "x" to clear.

**Timeline**: If a time range is selected (3M/6M/1Y/ALL), search is scoped to that period.

**Item Detail page**: Cmd+K starts in "find related" mode showing branching paths. Type to override and search normally.

**Universal behaviors**:
- Every result shows a cluster color dot + relative date
- Enter navigates to result
- Shift+Enter enters exploration mode on that result (starts wandering without leaving the overlay)

## Store Changes

### `appStore.svelte.ts` additions

```typescript
// Search context — set by each page, read by SearchOverlay
let _searchContext: SearchContext = $state({ page: 'library' });

interface SearchContext {
  page: 'library' | 'tastemap' | 'timeline' | 'item';
  clusterId?: string;      // set by Taste Map when a cluster is focused
  clusterName?: string;    // for display in the context pill
  clusterColor?: string;
  after?: string;          // ISO date, set by Timeline based on range
  before?: string;
  itemId?: string;         // set by Item Detail page
}

// Getters and setters
export function getSearchContext() { return _searchContext; }
export function setSearchContext(ctx: SearchContext) { _searchContext = ctx; }
```

The `performSearch` function is updated to pass context params to the API:

```typescript
export async function performSearch(query: string) {
  // ...existing debounce logic...
  const ctx = _searchContext;
  const params = new URLSearchParams({ q: query });
  if (ctx.clusterId) params.set('clusterId', ctx.clusterId);
  if (ctx.after) params.set('after', ctx.after);
  if (ctx.before) params.set('before', ctx.before);
  if (ctx.page === 'library') params.set('groupByCluster', 'true');
  const res = await fetch(`/api/search?${params}`);
  // ...
}
```

Each page sets its context on mount:
- Library: `setSearchContext({ page: 'library' })`
- Taste Map: `setSearchContext({ page: 'tastemap', clusterId, clusterName, clusterColor })` (updates when cluster focus changes)
- Timeline: `setSearchContext({ page: 'timeline', after, before })` (updates when range changes)
- Item Detail: `setSearchContext({ page: 'item', itemId })`

## API Changes

### New endpoint: `GET /api/items/[id]/related`

Returns branching paths for a single item:

```typescript
interface RelatedResponse {
  semantic: Array<Item & { similarity: number }>;
  cluster: Array<Item>;
  temporal: Array<Item>;
}
```

Implementation:
- **Determine embedding type**: Use item's `type` field — if `'image'` or `'screenshot'`, use `imageEmbedding` with type `'image'`; otherwise use `textEmbedding` with type `'text'`. If the relevant embedding is null, return empty semantic array.
- **Semantic**: `searchSimilarItems(embedding, embeddingType, 6)` then filter out self, take first 5
- **Cluster**: query `item_clusters` for the item's cluster ID. If found, query items in that cluster with `LIMIT 6`, exclude self, take first 5. Use raw SQL or add a `limit` parameter to `getItemsByCluster`.
- **Temporal**: raw SQL query — items where `created_at BETWEEN item.created_at - INTERVAL '7 days' AND item.created_at + INTERVAL '7 days'`, exclude self, `ORDER BY created_at`, `LIMIT 5`

**Error handling**:
- If item not found: return 404
- If item has no embedding: semantic lane returns `[]`, other lanes still work
- If any lane query fails: that lane returns `[]`, other lanes unaffected (each lane is independent try/catch)

**Caching**: No caching for now. Each exploration click triggers 3 fast queries. If performance becomes an issue, add a simple in-memory LRU cache keyed by item ID with a 60s TTL.

### Updated endpoint: `GET /api/search`

New optional query parameters:
- `clusterId` — scope results to a specific cluster
- `after` — ISO date string, only return items created after this date
- `before` — ISO date string, only return items created before this date
- `groupByCluster` — if `"true"`, return results grouped by cluster

```typescript
// groupByCluster=false (default, current behavior)
{ query: string; results: Array<Item & { similarity: number }> }

// groupByCluster=true
{
  query: string;
  groups: Array<{
    cluster: { id: string; name: string; color: string } | null;
    items: Array<Item & { similarity: number }>
  }>
}
```

Scoping implementation:
- `clusterId`: after vector search returns results, filter to items that have an `item_clusters` row matching the cluster ID
- `after`/`before`: add date range conditions to the search SQL query
- `groupByCluster`: post-process results — look up each result's cluster assignment, group into arrays keyed by cluster. Items with no cluster go in a `null` cluster group.

### Query function additions

Add to `src/lib/server/db/queries.ts`:

```typescript
// Get items saved near a date (±7 days), excluding a specific item
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
      AND created_at BETWEEN ${createdAt}::timestamptz - INTERVAL '7 days'
                          AND ${createdAt}::timestamptz + INTERVAL '7 days'
    `)
    .orderBy(items.createdAt)
    .limit(limit);
}
```

Update `getItemsByCluster` to accept an optional `limit` parameter:

```typescript
export async function getItemsByCluster(
  clusterId: string,
  limit?: number,
): Promise<Item[]> {
  let query = db
    .select({ item: items })
    .from(items)
    .innerJoin(itemClusters, eq(items.id, itemClusters.itemId))
    .where(eq(itemClusters.clusterId, clusterId))
    .orderBy(sql`${items.createdAt} DESC`);

  if (limit) query = query.limit(limit);
  return (await query).map(r => r.item);
}
```

## UI Components

### Modified

**`SearchOverlay.svelte`**:
- Reads `appStore.getSearchContext()` to determine current scope
- Context pill: renders when search is scoped (shows cluster name with color dot, or date range). "x" button calls `setSearchContext` to clear the scope.
- Results section: when `groupByCluster` response is received, render results under cluster headers (color dot + name + count). Ungrouped items go under "Other."
- Each result row: add cluster color dot (left side) and relative date (right side, e.g., "2mo ago")
- Shift+Enter on highlighted result: fetches `/api/items/[id]/related` and renders ExplorationPaths inline below the search results
- Keyboard: Shift+Enter for explore (Tab remains for focus management per accessibility standards)

**`item/[id]/+page.svelte`**:
- Add client-side exploration state:
  ```typescript
  let exploringItemId: string | null = $state(null);
  let explorationTrail: Array<{ id: string; title: string | null; type: string }> = $state([]);
  let exploringItemData: PageData | null = $state(null);
  ```
- When `exploringItemId` is set, fetch item data from `/api/items/[id]` and display that instead of the server-loaded `data`
- URL updates via `history.replaceState(null, '', \`/item/\${exploringItemId}\`)`
- Replace the flat "Similar Items" section with `ExplorationPaths` component
- Add `ExplorationBreadcrumbs` above item content when `explorationTrail.length > 0`
- Keep server-loaded `data.similarItems` as the initial semantic lane (avoid a redundant client fetch on first load)

### New

**`src/lib/components/shared/ExplorationPaths.svelte`**:
- Props: `itemId: string`, `initialSemantic?: Array<Item & { similarity: number }>` (optional, for SSR data on first load)
- Fetches `GET /api/items/[id]/related` on mount and when `itemId` changes (skips semantic fetch if `initialSemantic` is provided on first render)
- Renders 3 labeled lanes:
  - "Similar" — semantic neighbors
  - "Same cluster" — cluster siblings
  - "Around the same time" — temporal neighbors
- Each lane: horizontal scroll of compact item cards (image thumbnail or text preview, cluster dot, title)
- Clicking a card fires `oncenter` event with `{ id, title, type }` of the clicked item
- Loading state: shimmer placeholders per lane (3 rectangles per lane)
- Empty lane: hidden entirely (don't show a lane header with 0 results)
- Error state: lane hidden (silent failure per lane, logged to console)

**`src/lib/components/shared/ExplorationBreadcrumbs.svelte`**:
- Props: `trail: Array<{ id: string; title: string | null; type: string }>`, `onnavigate: (id: string, index: number) => void`
- Horizontal list of visited items during exploration
- Each crumb: small pill with item type icon + truncated title (max 20 chars)
- Clicking a crumb calls `onnavigate(id, index)` — parent truncates trail to that index and re-centers
- Max visible: 8 crumbs, then "..." for earlier items
- Subtle left-fade when overflowing

## File Structure

```
New:
  src/routes/api/items/[id]/related/+server.ts
  src/lib/components/shared/ExplorationPaths.svelte
  src/lib/components/shared/ExplorationBreadcrumbs.svelte

Modified:
  src/lib/stores/appStore.svelte.ts          — add SearchContext state
  src/lib/server/db/queries.ts               — add getTemporalNeighbors, update getItemsByCluster
  src/lib/components/shared/SearchOverlay.svelte — context pills, grouped results, Shift+Enter explore
  src/routes/item/[id]/+page.svelte          — exploration state, in-place item swapping
  src/routes/api/search/+server.ts           — scoping params, groupByCluster
  src/routes/+page.svelte                    — set search context on mount
  src/routes/tastemap/+page.svelte           — set search context on mount/cluster change
  src/routes/timeline/+page.svelte           — set search context on mount/range change
```

## API Response Hygiene

All API responses that return items must strip embedding vectors before sending to the client. `textEmbedding` and `imageEmbedding` are large float arrays (384 and 512 dimensions) that serve no client-side purpose.

**Implementation**: Define a helper that strips embeddings:

```typescript
function stripEmbeddings<T extends Record<string, unknown>>(item: T): Omit<T, 'textEmbedding' | 'imageEmbedding'> {
  const { textEmbedding, imageEmbedding, ...rest } = item as any;
  return rest;
}
```

Apply to:
- `GET /api/items/[id]` — existing endpoint, strip before returning
- `GET /api/items/[id]/related` — all items in all three lanes
- `GET /api/search` — all result items
- `GET /api/items` — list endpoint

## Out of Scope

- Visual/image-based search (drop an image to find similar) — future feature
- Saving exploration paths as collections — future feature
- Exploration from within the Taste Map (clicking a constellation node to explore) — future feature
- Persistent search history — future feature
- Browser back button wired to exploration history — intentionally simple for now
