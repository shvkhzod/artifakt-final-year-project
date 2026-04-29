import { db } from '$lib/server/db';
import { arenaCache } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { AI_CONFIG } from '$lib/server/ai/config';
import type { ArenaBlock, ArenaChannelInfo, ArenaChannelResult } from '$lib/utils/arena.types';

const BASE_URL = 'https://api.are.na/v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Rate Limiter ─────────────────────────────────────
const apiCalls: number[] = [];
const MAX_CALLS_PER_MIN = 20; // headroom below Are.na's 30/min

function canCallApi(): boolean {
	const now = Date.now();
	while (apiCalls.length > 0 && apiCalls[0] < now - 60_000) {
		apiCalls.shift();
	}
	return apiCalls.length < MAX_CALLS_PER_MIN;
}

function recordApiCall(): void {
	apiCalls.push(Date.now());
}

// ── Cache ────────────────────────────────────────────
function normalizeCacheKey(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function getCached<T>(key: string): Promise<T | null> {
	const [entry] = await db
		.select()
		.from(arenaCache)
		.where(eq(arenaCache.cacheKey, key));

	if (!entry) return null;

	const age = Date.now() - new Date(entry.createdAt).getTime();
	if (age > CACHE_TTL_MS) return null;

	return entry.data as T;
}

async function setCache(key: string, data: unknown): Promise<void> {
	await db
		.insert(arenaCache)
		.values({ cacheKey: key, data, createdAt: new Date() })
		.onConflictDoUpdate({
			target: arenaCache.cacheKey,
			set: { data, createdAt: new Date() },
		});
}

// ── Are.na API Calls ─────────────────────────────────
function getHeaders(): Record<string, string> {
	return {
		'Authorization': `Bearer ${AI_CONFIG.arena.accessToken}`,
		'Content-Type': 'application/json',
	};
}

export function isArenaConfigured(): boolean {
	return AI_CONFIG.arena.accessToken.length > 0;
}

export async function searchArena(
	query: string,
	limit: number = 12,
): Promise<ArenaBlock[]> {
	const cacheKey = `search:${normalizeCacheKey(query)}`;
	const cached = await getCached<ArenaBlock[]>(cacheKey);
	if (cached) return cached;

	if (!canCallApi()) {
		console.warn('Are.na rate limit reached, returning empty results');
		return [];
	}

	recordApiCall();
	const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&per=${limit}`;
	const res = await fetch(url, { headers: getHeaders() });

	if (res.status === 401 || res.status === 403) {
		console.error('Are.na auth failed:', res.status);
		throw new Error('Are.na connection failed');
	}

	if (!res.ok) {
		console.error('Are.na search failed:', res.status);
		return [];
	}

	const data = await res.json();
	const blocks = normalizeBlocks(data.blocks || []);
	await setCache(cacheKey, blocks);
	return blocks;
}

export async function getChannelContents(
	slug: string,
	limit: number = 24,
): Promise<ArenaChannelResult | null> {
	const cacheKey = `channel:${slug}`;
	const cached = await getCached<ArenaChannelResult>(cacheKey);
	if (cached) return cached;

	if (!canCallApi()) {
		console.warn('Are.na rate limit reached');
		return null;
	}

	recordApiCall();
	const url = `${BASE_URL}/channels/${encodeURIComponent(slug)}/contents?per=${limit}`;
	const res = await fetch(url, { headers: getHeaders() });

	if (!res.ok) {
		console.error(`Are.na channel fetch failed for ${slug}:`, res.status);
		return null;
	}

	const data = await res.json();
	const result: ArenaChannelResult = {
		channel: {
			title: data.title || slug,
			user: data.user?.username || data.user?.slug || 'unknown',
			description: data.description || null,
			length: data.length || 0,
			slug: data.slug || slug,
		},
		blocks: normalizeBlocks(data.contents || []),
	};

	await setCache(cacheKey, result);
	return result;
}

// ── Block Normalization ──────────────────────────────
function normalizeBlocks(rawBlocks: any[]): ArenaBlock[] {
	const results: ArenaBlock[] = [];

	for (const block of rawBlocks) {
		const blockType = (block.class || '').toLowerCase();

		// Skip unsupported types
		if (['attachment', 'channel'].includes(blockType)) continue;

		const imageUrl = block.image?.display?.url || null;
		const contentHtml = block.content_html || null;

		// Skip blocks with no useful content
		if (!imageUrl && !contentHtml) continue;

		const channels: ArenaChannelInfo[] = (block.connections || [])
			.filter((c: any) => c.title && c.slug)
			.slice(0, 3)
			.map((c: any) => ({
				title: c.title,
				slug: c.slug,
				user: c.user?.username || c.user?.slug || 'unknown',
			}));

		results.push({
			arenaId: block.id,
			title: block.title || block.generated_title || '',
			imageUrl,
			contentHtml,
			sourceUrl: `https://www.are.na/block/${block.id}`,
			blockType: blockType as ArenaBlock['blockType'],
			channels,
			alreadySaved: false,
			source: 'arena',
		});
	}

	return results;
}
