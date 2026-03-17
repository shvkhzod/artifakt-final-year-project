import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchSimilarItems } from '$lib/server/db/queries';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query || query.trim().length === 0) {
		throw error(400, 'Missing search query parameter "q"');
	}

	const limit = parseInt(url.searchParams.get('limit') || '20');

	try {
		// Generate an embedding for the search query
		const { generateTextEmbedding } = await import('$lib/server/ai/embeddings');
		const embeddingResult = await generateTextEmbedding(query.trim());

		// Find similar items using vector search
		const results = await searchSimilarItems(embeddingResult.vector, limit);

		return json({
			query: query.trim(),
			results: results.map((item) => ({
				...item,
				similarity: item.similarity,
			})),
		});
	} catch (e) {
		console.error('Search failed:', e);
		throw error(500, 'Search failed');
	}
};
