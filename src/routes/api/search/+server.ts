import type { RequestHandler } from './$types';
import { getEmbeddingProvider } from '$lib/server/ai';
import { searchHybrid, stripEmbeddings } from '$lib/server/db/queries';
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

    // Hybrid search: semantic (jina-embeddings-v3) + keyword (tsvector)
    const embedding = await provider.embedText(query);
    let results = await searchHybrid(embedding, query, limit * 2);
    results = results.map(stripEmbeddings) as typeof results;

    // Filter: require genuine relevance.
    // If there's a keyword hit, keep it (the query text literally appears in the item).
    // If no keyword hit, require high semantic similarity (0.55+) to avoid noise.
    results = results.filter((r) =>
      r.keyword_score > 0 || r.semantic_score >= 0.55
    );

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

    // Trim to limit
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
