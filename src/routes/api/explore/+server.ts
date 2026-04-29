import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItemById } from '$lib/server/db/queries';
import { AI_CONFIG } from '$lib/server/ai/config';
import { searchArena, isArenaConfigured } from '$lib/server/arena';
import { searchTumblr, isTumblrConfigured } from '$lib/server/tumblr';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { ArenaBlock, ExploreResponse } from '$lib/utils/arena.types';

// Global explore rate limiter: 5 per minute
const exploreCalls: number[] = [];
const MAX_EXPLORES_PER_MIN = 5;

function canExplore(): boolean {
	const now = Date.now();
	while (exploreCalls.length > 0 && exploreCalls[0] < now - 60_000) {
		exploreCalls.shift();
	}
	return exploreCalls.length < MAX_EXPLORES_PER_MIN;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!isArenaConfigured() && !isTumblrConfigured()) {
		throw error(501, 'No explore sources configured');
	}

	if (!canExplore()) {
		return json({ error: 'Too many requests', retryAfter: 60 }, { status: 429 });
	}

	const { itemId } = await request.json();
	if (!itemId) throw error(400, 'itemId is required');

	const item = await getItemById(itemId);
	if (!item) throw error(404, 'Item not found');

	if (item.embeddingStatus === 'pending') {
		return json({ error: 'Item still processing', retryAfter: 5 }, { status: 425 });
	}

	const description = item.aiCaption || [item.title, item.content].filter(Boolean).join('. ');
	if (!description || description.length < 5) {
		throw error(422, 'Not enough context to explore');
	}

	exploreCalls.push(Date.now());

	let queries: string[];
	try {
		queries = await generateSearchQueries(description);
	} catch (e) {
		console.error('Query generation failed, falling back to title:', e);
		queries = item.title ? [item.title] : [description.slice(0, 50)];
	}

	// Search both sources in parallel for each query
	const allBlocks = new Map<string, ArenaBlock>();
	for (const query of queries) {
		const searches: Promise<ArenaBlock[]>[] = [];

		if (isArenaConfigured()) {
			searches.push(searchArena(query).catch((e) => {
				console.error(`Are.na search failed for "${query}":`, e);
				return [] as ArenaBlock[];
			}));
		}
		if (isTumblrConfigured()) {
			searches.push(searchTumblr(query).catch((e) => {
				console.error(`Tumblr search failed for "${query}":`, e);
				return [] as ArenaBlock[];
			}));
		}

		const resultSets = await Promise.all(searches);
		for (const blocks of resultSets) {
			for (const block of blocks) {
				const key = `${block.source}:${block.arenaId}`;
				if (!allBlocks.has(key)) {
					allBlocks.set(key, block);
				}
			}
		}
	}

	const results = Array.from(allBlocks.values());

	if (results.length > 0) {
		const urls = results
			.map((r) => (r.blockType === 'image' || r.blockType === 'media') ? r.imageUrl : r.sourceUrl)
			.filter(Boolean) as string[];

		if (urls.length > 0) {
			const existing = await db
				.select({ url: items.url })
				.from(items)
				.where(sql`url = ANY(ARRAY[${sql.join(urls.map((u) => sql`${u}`), sql`, `)}])`);

			const savedUrls = new Set(existing.map((e) => e.url));
			for (const block of results) {
				const matchUrl = (block.blockType === 'image' || block.blockType === 'media') ? block.imageUrl : block.sourceUrl;
				if (matchUrl && savedUrls.has(matchUrl)) {
					block.alreadySaved = true;
				}
			}
		}
	}

	const response: ExploreResponse = { queries, results };
	return json(response);
};

async function generateSearchQueries(description: string): Promise<string[]> {
	const { apiKey, model } = AI_CONFIG.openrouter;
	if (!apiKey) throw new Error('OpenRouter not configured');

	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			messages: [{
				role: 'user',
				content: `Given this item's description: ${description.slice(0, 500)}\n\nGenerate 4 specific, niche search queries (2-4 words each) that would find similar content on creative platforms. Be specific and taste-informed. Think like a creative director searching for references.\nReturn only the queries, one per line, nothing else.`,
			}],
			max_tokens: 100,
			temperature: 0.7,
		}),
	});

	if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
	const data = await res.json();
	const text = data.choices?.[0]?.message?.content?.trim() || '';

	return text
		.split('\n')
		.map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').trim())
		.filter((line: string) => line.length >= 3 && line.length <= 60);
}
