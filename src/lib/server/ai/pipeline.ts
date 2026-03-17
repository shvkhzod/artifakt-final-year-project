/**
 * Full AI pipeline: called after an item is saved.
 * 1. Generate embedding for the item
 * 2. Find nearest existing cluster or suggest one
 * 3. Assign item to cluster
 *
 * Each step is wrapped in its own try/catch so a failure in clustering
 * does not prevent the embedding from being stored.
 */
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
	const { generateEmbeddingForItem } = await import('./embeddings');
	const {
		updateItemEmbedding,
		getClusters,
		addItemToCluster,
		searchSimilarItems,
	} = await import('$lib/server/db/queries');
	const { suggestClusters } = await import('./clustering');

	// Step 1: Generate and store embedding
	let embeddingVector: number[];
	try {
		const embeddingResult = await generateEmbeddingForItem(item);
		await updateItemEmbedding(itemId, embeddingResult.vector);
		embeddingVector = embeddingResult.vector;
		console.log(
			`[pipeline] Embedding stored for item ${itemId} (${embeddingResult.model}, ${embeddingResult.dimensions}d)`,
		);
	} catch (e) {
		console.error(`[pipeline] Embedding generation failed for item ${itemId}:`, e);
		return; // Cannot proceed without an embedding
	}

	// Step 2: Try to assign to an existing cluster
	try {
		const clusters = await getClusters();
		if (clusters.length === 0) {
			console.log(`[pipeline] No clusters exist yet — skipping cluster assignment for item ${itemId}`);
			return;
		}

		// Find similar items that already have cluster assignments
		const similarItems = await searchSimilarItems(embeddingVector, 20);

		if (similarItems.length === 0) {
			console.log(`[pipeline] No similar items found — skipping cluster assignment for item ${itemId}`);
			return;
		}

		// Build the items-with-clusters list for suggestClusters.
		// We need to query which clusters each similar item belongs to.
		const { db } = await import('$lib/server/db');
		const { itemClusters } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');

		// Get cluster assignments for similar items
		const similarItemIds = similarItems.map((si) => si.id);
		const assignments = await db.select().from(itemClusters);

		const assignmentMap = new Map<string, string>();
		for (const a of assignments) {
			assignmentMap.set(a.itemId, a.clusterId);
		}

		const itemsWithClusters = similarItems
			.filter((si) => si.id !== itemId)
			.map((si) => ({
				embedding: si.embedding,
				clusterId: assignmentMap.get(si.id),
			}));

		const suggestedClusterIds = suggestClusters(embeddingVector, itemsWithClusters);

		if (suggestedClusterIds.length > 0) {
			// Calculate average similarity to items in the suggested cluster
			const targetClusterId = suggestedClusterIds[0];
			const clusterItems = similarItems.filter(
				(si) => assignmentMap.get(si.id) === targetClusterId && si.id !== itemId,
			);

			let confidence = 0.5; // default confidence
			if (clusterItems.length > 0) {
				const avgSimilarity =
					clusterItems.reduce((sum, ci) => sum + (ci.similarity ?? 0), 0) /
					clusterItems.length;
				confidence = Math.max(0.1, Math.min(1.0, avgSimilarity));
			}

			await addItemToCluster(itemId, targetClusterId, confidence);
			console.log(
				`[pipeline] Item ${itemId} assigned to cluster ${targetClusterId} (confidence: ${confidence.toFixed(3)})`,
			);
		} else {
			console.log(`[pipeline] No suitable cluster found for item ${itemId}`);
		}
	} catch (e) {
		console.error(`[pipeline] Cluster assignment failed for item ${itemId}:`, e);
		// Embedding was already stored — this is a non-fatal error
	}

	console.log(`[pipeline] Pipeline complete for item ${itemId}`);
}
