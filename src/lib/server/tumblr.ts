import { db } from '$lib/server/db';
import { arenaCache } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { AI_CONFIG } from '$lib/server/ai/config';
import type { ArenaBlock } from '$lib/utils/arena.types';

const BASE_URL = 'https://api.tumblr.com/v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Reuse the same cache table as Are.na (it's a generic key-value cache)

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

export function isTumblrConfigured(): boolean {
  return AI_CONFIG.tumblr.apiKey.length > 0;
}

export async function searchTumblr(
  query: string,
  limit: number = 12,
): Promise<ArenaBlock[]> {
  const cacheKey = `tumblr-search:${normalizeCacheKey(query)}`;
  const cached = await getCached<ArenaBlock[]>(cacheKey);
  if (cached) return cached;

  const apiKey = AI_CONFIG.tumblr.apiKey;

  // Tumblr uses tag-based search — multi-word queries like "brutalist concrete church"
  // won't match. Search each word as a separate tag, plus the full phrase.
  const words = query.trim().split(/\s+/);
  const tags = [query]; // Try the full phrase first
  if (words.length > 1) {
    // Add individual words (skip very short/common ones)
    for (const w of words) {
      if (w.length >= 4 && !tags.includes(w)) tags.push(w);
    }
  }

  const seen = new Map<number, boolean>();
  let allPosts: any[] = [];

  for (const tag of tags.slice(0, 3)) { // Max 3 tag searches per query
    const url = `${BASE_URL}/tagged?tag=${encodeURIComponent(tag)}&limit=${Math.ceil(limit / tags.length)}&npf=true&api_key=${apiKey}`;
    const res = await fetch(url);

    if (res.status === 401 || res.status === 403) {
      console.error('Tumblr auth failed:', res.status);
      throw new Error('Tumblr connection failed');
    }

    if (!res.ok) continue;

    const data = await res.json();
    for (const post of (data.response || [])) {
      if (!seen.has(post.id)) {
        seen.set(post.id, true);
        allPosts.push(post);
      }
    }

    if (allPosts.length >= limit) break;
  }

  const blocks = normalizePosts(allPosts.slice(0, limit));
  await setCache(cacheKey, blocks);
  return blocks;
}

function normalizePosts(posts: any[]): ArenaBlock[] {
  const results: ArenaBlock[] = [];

  for (const post of posts) {
    const postType = post.type;

    // Extract image URL — handle both legacy and NPF formats
    let imageUrl: string | null = null;
    if (post.photos?.[0]?.original_size?.url) {
      // Legacy format
      imageUrl = post.photos[0].original_size.url;
    } else if (Array.isArray(post.content)) {
      // NPF format — find first image block
      const imgBlock = post.content.find((b: any) => b.type === 'image');
      imageUrl = imgBlock?.media?.[0]?.url || null;
    }
    if (!imageUrl && post.thumbnail_url) {
      imageUrl = post.thumbnail_url;
    }

    // Extract text content
    let contentHtml: string | null = null;
    if (Array.isArray(post.content)) {
      // NPF format — concat text blocks
      const textParts = post.content
        .filter((b: any) => b.type === 'text' && b.text)
        .map((b: any) => b.text);
      if (textParts.length > 0) contentHtml = textParts.join(' ');
    } else if (post.body) {
      contentHtml = post.body;
    }
    if (!contentHtml && post.summary) {
      contentHtml = post.summary;
    }

    // Skip posts with no useful content
    if (!imageUrl && !contentHtml) continue;

    // Map Tumblr post type to our block type
    let blockType: ArenaBlock['blockType'] = 'image';
    if (postType === 'text' || postType === 'quote' || postType === 'chat') {
      blockType = 'text';
    } else if (postType === 'link') {
      blockType = 'link';
    }

    const blogName = post.blog_name || post.blog?.name || 'unknown';

    results.push({
      arenaId: post.id,
      title: post.summary?.slice(0, 100) || post.slug?.replace(/-/g, ' ') || '',
      imageUrl,
      contentHtml,
      sourceUrl: post.post_url || `https://${blogName}.tumblr.com/post/${post.id}`,
      blockType,
      channels: [{
        title: blogName,
        slug: blogName,
        user: blogName,
      }],
      alreadySaved: false,
      source: 'tumblr',
    });
  }

  return results;
}
