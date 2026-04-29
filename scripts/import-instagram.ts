/**
 * Instagram Bulk Import for Aina
 *
 * Reads a manifest.json + image directory and imports each item into the
 * database, running the full AI pipeline (CLIP embedding, captioning,
 * content embedding, cluster assignment) sequentially.
 *
 * Usage:
 *   npx tsx scripts/import-instagram.ts ./path/to/aina_import
 *
 * Re-run safely — skips items already imported AND re-processes items
 * that were created but failed embedding (e.g. due to rate limits).
 *
 * Env vars (loaded from .env):
 *   DATABASE_URL, JINA_API_KEY, OPENROUTER_API_KEY
 */

import 'dotenv/config';
import { readFile, copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, extname } from 'path';
import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, isNotNull } from 'drizzle-orm';
import { agnes } from 'ml-hclust';
import sharp from 'sharp';
import * as schema from '../src/lib/server/db/schema.js';

const { items, clusters, itemClusters, clusterRuns } = schema;

// ── Config ────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/Aina';
const JINA_API_KEY = process.env.JINA_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku';
const UPLOAD_DIR = resolve('static/uploads');

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';
const CLIP_MODEL = 'jina-clip-v2';
const TEXT_MODEL = 'jina-embeddings-v3';
const CAPTION_MODEL = 'google/gemma-3-27b-it';

// Rate limit: ~5 items/min with Jina free tier (100k tokens/min).
// Each image CLIP ≈ 15-20k tokens. Pause between items to stay under.
const DELAY_BETWEEN_ITEMS_MS = 15_000; // 15s between items

const CLUSTER_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#0072B2', '#D55E00', '#CC79A7'];
const CLUSTERING = {
  assignmentK: 5,
  assignmentThreshold: 0.55,
  reclusterSimilarityThreshold: 0.65,
  minClusterSize: 2,
  minItemsForClustering: 10,
  maxClustersRatio: 3,
  namingSampleSize: 8,
};

// ── DB ────────────────────────────────────────────────────
const client = postgres(DATABASE_URL, { connect_timeout: 5, idle_timeout: 20, max_lifetime: 60 * 30 });
const db = drizzle(client, { schema });

// ── Manifest types ────────────────────────────────────────
interface ManifestEntry {
  id: string;
  file: string;
  source_url: string;
  username: string;
  saved_at: string;
  type: string;
}

// ── Helpers ───────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Image helpers ─────────────────────────────────────────
async function copyImageToUploads(srcPath: string): Promise<string> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
  const ext = extname(srcPath) || '.jpg';
  const filename = `${randomUUID()}${ext}`;
  const destPath = join(UPLOAD_DIR, filename);
  await copyFile(srcPath, destPath);
  return `/uploads/${filename}`;
}

async function imageToBase64(filePath: string): Promise<string | null> {
  try {
    let buffer: Buffer = await readFile(filePath) as Buffer;
    const first = buffer[0];
    if (first === 0x3C) return null; // SVG
    const mime = first === 0xFF ? 'image/jpeg' : first === 0x89 ? 'image/png' : 'image/jpeg';

    if (buffer.length > 500_000) {
      buffer = await sharp(buffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer() as Buffer;
    }
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

// ── Retry wrapper for API calls ───────────────────────────
async function withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message || String(e);
      const is429 = msg.includes('429');
      if (is429 && attempt < maxRetries) {
        // Exponential backoff: 30s, 60s, 120s, 240s, 480s
        const waitSec = 30 * Math.pow(2, attempt);
        process.stdout.write(`  ⏳ ${label} rate limited, waiting ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...\r`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`${label}: max retries exceeded`);
}

// ── Jina API calls ────────────────────────────────────────
async function callJina(model: string, input: Record<string, string>[]): Promise<number[]> {
  const res = await fetch(JINA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JINA_API_KEY}` },
    body: JSON.stringify({ model, input, normalized: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jina ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

async function embedClipImage(base64: string): Promise<number[]> {
  return withRetry(() => callJina(CLIP_MODEL, [{ image: base64 }]), 'CLIP embed');
}

async function embedText(text: string): Promise<number[]> {
  return withRetry(() => callJina(TEXT_MODEL, [{ text }]), 'text embed');
}

// ── OpenRouter captioning ─────────────────────────────────
async function generateCaption(base64: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CAPTION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64 } },
            {
              type: 'text',
              text: `List every concrete object, item, animal, person, food, plant, color, text, symbol, and recognizable thing visible in this image. Be literal and specific — name what you SEE, not what it means. If there are multiple distinct scenes or panels in the image, describe each one separately. Start with a literal inventory of objects, then add mood and style after.\n\nFormat:\nOBJECTS: [list every visible thing]\nTEXT: [any visible text or words in the image]\nSTYLE: [artistic style, mood, colors]\nCONTEXT: [what the image is about overall]`,
            },
          ],
        }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

function cleanCaption(caption: string): string {
  return caption
    .split('\n')
    .filter(line => !line.match(/^(okay|here['']?s)\b.*\b(breakdown|format|requested|description)/i))
    .map(line => line.replace(/\*+/g, '').trim())
    .filter(line => !line.match(/^(OBJECTS|TEXT|STYLE|CONTEXT|SETTING|MOOD|COMPOSITION|DETAILS?)\s*:?\s*$/i))
    .map(line => line.replace(/^(OBJECTS|TEXT|STYLE|CONTEXT|SETTING|MOOD|COMPOSITION|DETAILS?)\s*:\s*/i, '').trim())
    .map(line => line.replace(/^[-•]\s+/, '').trim())
    .filter(line => line.length > 0)
    .join('. ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

// ── DB operations ─────────────────────────────────────────

/** Find existing item by Instagram source URL (stored in content field) */
async function findExistingItem(sourceUrl: string): Promise<schema.Item | null> {
  const [row] = await db.select().from(items).where(sql`content = ${sourceUrl}`).limit(1);
  return row ?? null;
}

async function createItem(data: {
  url: string;
  title: string;
  content: string;
  type: 'image';
  thumbnailUrl: string;
  createdAt: Date;
}): Promise<schema.Item> {
  const [item] = await db.insert(items).values(data).returning();
  return item;
}

async function updateClipEmbedding(id: string, vector: number[]): Promise<void> {
  await db.update(items).set({ clipEmbedding: vector, updatedAt: new Date() }).where(sql`id = ${id}`);
}

async function updateContentEmbedding(id: string, vector: number[], caption: string): Promise<void> {
  await db.update(items).set({ contentEmbedding: vector, aiCaption: caption, updatedAt: new Date() }).where(sql`id = ${id}`);
}

async function updateSearchText(id: string): Promise<void> {
  await db.execute(sql`
    UPDATE items SET search_text = to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(note, '') || ' ' || coalesce(ai_caption, '')
    ) WHERE id = ${id}
  `);
}

async function setEmbeddingStatus(id: string, status: 'pending' | 'complete' | 'failed'): Promise<void> {
  await db.update(items).set({ embeddingStatus: status, updatedAt: new Date() }).where(sql`id = ${id}`);
}

async function addItemToCluster(itemId: string, clusterId: string, confidence: number): Promise<void> {
  await db.insert(itemClusters).values({ itemId, clusterId, confidence }).onConflictDoUpdate({
    target: [itemClusters.itemId, itemClusters.clusterId],
    set: { confidence },
  });
  await db.update(clusters).set({
    itemCount: sql`(SELECT COUNT(*) FROM item_clusters WHERE cluster_id = ${clusterId})`,
  }).where(sql`id = ${clusterId}`);
}

async function createCluster(data: { name: string; color: string; source: 'ai'; description: string | null; itemCount: number }): Promise<schema.Cluster> {
  const [cluster] = await db.insert(clusters).values(data).returning();
  return cluster;
}

// ── Cluster assignment (KNN voting) ───────────────────────
async function assignItemToCluster(itemId: string, embedding: number[]): Promise<{ clusterId: string; confidence: number } | null> {
  const vectorStr = `[${embedding.join(',')}]`;
  const result = await db.execute(sql`
    SELECT i.id as item_id, ic.cluster_id, COALESCE(ic.confidence, 0) as confidence,
           1 - (i.content_embedding <=> ${vectorStr}::vector) as similarity
    FROM items i LEFT JOIN item_clusters ic ON i.id = ic.item_id
    WHERE i.content_embedding IS NOT NULL
    ORDER BY i.content_embedding <=> ${vectorStr}::vector
    LIMIT ${CLUSTERING.assignmentK}
  `);

  const rows = ((result as any).rows ?? result) as Array<{ item_id: string; cluster_id: string | null; similarity: number }>;
  const assigned = rows.filter((n: any) => n.cluster_id !== null && n.item_id !== itemId);
  if (assigned.length === 0) return null;

  const votes = new Map<string, { count: number; totalSimilarity: number }>();
  for (const n of assigned) {
    const cid = n.cluster_id!;
    const entry = votes.get(cid) ?? { count: 0, totalSimilarity: 0 };
    entry.count++;
    entry.totalSimilarity += n.similarity;
    votes.set(cid, entry);
  }

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

  if (!bestCluster || bestAvgSim < CLUSTERING.assignmentThreshold) return null;

  const confidence = Math.min(1, Math.max(0.1, (bestCount / assigned.length) * bestAvgSim));
  await addItemToCluster(itemId, bestCluster, confidence);
  return { clusterId: bestCluster, confidence };
}

// ── Full recluster (hierarchical clustering via agnes) ────
function cosineDistance(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 1 : 1 - (dot / denom);
}

async function generateClusterName(sampleItems: schema.Item[]): Promise<string> {
  if (!OPENROUTER_API_KEY) return `Cluster #${Date.now().toString(36).slice(-4)}`;

  const contentParts: any[] = [];
  for (const item of sampleItems.slice(0, 4)) {
    const imageUrl = item.url || item.thumbnailUrl;
    if (imageUrl && (item.type === 'image' || item.type === 'screenshot')) {
      let buffer: Buffer;
      try {
        if (imageUrl.startsWith('/uploads/')) {
          buffer = await readFile(resolve('static', imageUrl.slice(1)));
        } else {
          continue;
        }
        if (buffer.length > 500_000) {
          buffer = await sharp(buffer).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
        }
        const mime = buffer[0] === 0xFF ? 'image/jpeg' : buffer[0] === 0x89 ? 'image/png' : 'image/jpeg';
        contentParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${buffer.toString('base64')}` } });
      } catch { /* skip */ }
    }
    const textParts: string[] = [];
    if (item.title && !item.title.match(/\.[a-z]{3,4}$/i)) textParts.push(item.title);
    if (item.content) textParts.push(item.content.slice(0, 80));
    if (textParts.length > 0) contentParts.push({ type: 'text', text: textParts.join(' — ') });
  }

  const hasImages = contentParts.some(p => p.type === 'image_url');
  contentParts.push({
    type: 'text',
    text: 'These saved items form a natural group. Give this collection a short, literal, descriptive name (2-3 words) that says what these items are about. Be specific and plain — like "Film Photography", "UI Design", "Architecture". No poetry, no metaphors. Return only the name.',
  });

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: hasImages ? 'google/gemma-3-27b-it' : OPENROUTER_MODEL,
        messages: [{ role: 'user', content: contentParts }],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || `Cluster #${Date.now().toString(36).slice(-4)}`;
  } catch {
    return `Cluster #${Date.now().toString(36).slice(-4)}`;
  }
}

async function runRecluster(): Promise<void> {
  const startTime = performance.now();
  console.log('\n--- Running full recluster ---');

  const allItems = await db.select().from(items).where(isNotNull(items.contentEmbedding));
  if (allItems.length < CLUSTERING.minItemsForClustering) {
    console.log(`Only ${allItems.length} items with embeddings, need ${CLUSTERING.minItemsForClustering}. Skipping.`);
    return;
  }

  const existingClusters = await db.select().from(clusters);
  const userClusterIds = existingClusters.filter(c => c.source === 'user').map(c => c.id);

  // Clear AI assignments
  if (userClusterIds.length > 0) {
    await db.delete(itemClusters).where(
      sql`cluster_id NOT IN (${sql.join(userClusterIds.map(id => sql`${id}::uuid`), sql`, `)})`
    );
  } else {
    await db.delete(itemClusters);
  }

  // Remove AI clusters
  for (const c of existingClusters) {
    if (c.source === 'ai') await db.delete(clusters).where(sql`id = ${c.id}`);
  }

  // Build distance matrix
  const embeddingList = allItems.map(i => i.contentEmbedding!);
  const distMatrix: number[][] = [];
  for (let i = 0; i < embeddingList.length; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < embeddingList.length; j++) {
      distMatrix[i][j] = cosineDistance(embeddingList[i], embeddingList[j]);
    }
  }

  console.log(`Distance matrix: ${allItems.length}x${allItems.length}`);
  const tree = agnes(distMatrix, { method: 'average', isDistanceMatrix: true });

  const maxClusters = Math.floor(allItems.length / CLUSTERING.maxClustersRatio);
  const initialGroups = Math.max(maxClusters, Math.ceil(allItems.length / 2));
  const cutResult = tree.group(Math.min(initialGroups, allItems.length));

  const labels = new Array<number>(allItems.length).fill(0);
  function assignLabels(node: any, label: number) {
    if (node.isLeaf) { labels[node.index] = label; }
    else if (node.children) { for (const child of node.children) assignLabels(child, label); }
  }
  const topGroups = cutResult.children || [cutResult];
  for (let i = 0; i < topGroups.length; i++) assignLabels(topGroups[i], i);

  const proposedGroups = new Map<number, string[]>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!proposedGroups.has(label)) proposedGroups.set(label, []);
    proposedGroups.get(label)!.push(allItems[i].id);
  }

  let clustersCreated = 0;
  for (const [, memberIds] of proposedGroups) {
    if (clustersCreated >= maxClusters) break;
    if (memberIds.length < CLUSTERING.minClusterSize) continue;

    const groupEmbeddings = memberIds.map(id => {
      const idx = allItems.findIndex(i => i.id === id);
      return allItems[idx].contentEmbedding!;
    });
    const centroid = groupEmbeddings[0].map((_, dim) =>
      groupEmbeddings.reduce((sum, e) => sum + e[dim], 0) / groupEmbeddings.length
    );

    const withDist = memberIds.map(id => {
      const idx = allItems.findIndex(i => i.id === id);
      return { id, dist: cosineDistance(allItems[idx].contentEmbedding!, centroid) };
    });
    withDist.sort((a, b) => a.dist - b.dist);

    const maxDist = 1 - CLUSTERING.reclusterSimilarityThreshold;
    const closeEnough = withDist.filter(d => d.dist <= maxDist);
    if (closeEnough.length < CLUSTERING.minClusterSize) continue;

    const sampleIds = withDist.slice(0, CLUSTERING.namingSampleSize).map(d => d.id);
    const sampleItems = await db.select().from(items)
      .where(sql`id = ANY(ARRAY[${sql.join(sampleIds.map(id => sql`${id}::uuid`), sql`, `)}])`);

    const name = await generateClusterName(sampleItems);
    const color = CLUSTER_COLORS[clustersCreated % CLUSTER_COLORS.length];

    const newCluster = await createCluster({
      name,
      color,
      source: 'ai',
      description: null,
      itemCount: closeEnough.length,
    });

    for (const { id: itemId, dist } of closeEnough) {
      const confidence = Math.min(1, Math.max(0.1, 1 - dist));
      await addItemToCluster(itemId, newCluster.id, confidence);
    }

    console.log(`  Cluster "${name}" — ${closeEnough.length} items`);
    clustersCreated++;
  }

  const durationMs = Math.round(performance.now() - startTime);
  await db.insert(clusterRuns).values({
    triggeredBy: 'manual',
    itemsProcessed: allItems.length,
    clustersCreated,
    clustersModified: 0,
    durationMs,
  });

  console.log(`Recluster done: ${allItems.length} items → ${clustersCreated} clusters (${durationMs}ms)\n`);
}

// ── Pipeline (per item) ───────────────────────────────────
async function processItem(
  itemId: string,
  imagePath: string,
  title: string,
): Promise<void> {
  const base64 = await imageToBase64(imagePath);
  if (!base64) {
    console.warn(`  Could not read image, skipping pipeline`);
    await setEmbeddingStatus(itemId, 'failed');
    return;
  }

  // 1. CLIP visual embedding
  const clipEmbedding = await embedClipImage(base64);
  await updateClipEmbedding(itemId, clipEmbedding);

  // 2. AI caption → content embedding
  const caption = await generateCaption(base64);
  let contentEmbedding: number[] | null = null;
  if (caption) {
    const cleaned = cleanCaption(caption);
    contentEmbedding = await embedText(cleaned);
    await updateContentEmbedding(itemId, contentEmbedding, caption);
  } else {
    // Fallback: embed title as content
    contentEmbedding = await embedText(title);
    await updateContentEmbedding(itemId, contentEmbedding, title);
  }

  // 3. Search text + status
  await updateSearchText(itemId);
  await setEmbeddingStatus(itemId, 'complete');

  // 4. Cluster assignment (best-effort, recluster happens at the end anyway)
  if (contentEmbedding) {
    const result = await assignItemToCluster(itemId, contentEmbedding);
    if (result) {
      console.log(`  → cluster ${result.clusterId.slice(0, 8)}… (${(result.confidence * 100).toFixed(0)}%)`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: npx tsx scripts/import-instagram.ts ./path/to/aina_import');
    process.exit(1);
  }

  const importDir = resolve(dir);
  const manifestPath = join(importDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    console.error(`manifest.json not found in ${importDir}`);
    process.exit(1);
  }

  if (!JINA_API_KEY) {
    console.error('JINA_API_KEY not set in .env');
    process.exit(1);
  }

  const manifest: ManifestEntry[] = JSON.parse(await readFile(manifestPath, 'utf-8'));
  console.log(`Found ${manifest.length} items in manifest`);
  console.log(`Rate limit delay: ${DELAY_BETWEEN_ITEMS_MS / 1000}s between items\n`);

  let created = 0;
  let reprocessed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const progress = `[${i + 1}/${manifest.length}]`;

    // Check if item already exists (by source_url stored in content field)
    const existing = await findExistingItem(entry.source_url);

    if (existing && existing.embeddingStatus === 'complete') {
      skipped++;
      if (skipped % 50 === 0) console.log(`${progress} ... skipped ${skipped} already-complete items`);
      continue;
    }

    const imagePath = join(importDir, entry.file);
    if (!existsSync(imagePath)) {
      failed++;
      console.log(`${progress} MISS @${entry.username} — ${entry.file} not found`);
      continue;
    }

    try {
      let itemId: string;
      let itemUrl: string;

      if (existing) {
        // Item exists but needs re-processing (failed/pending embedding)
        itemId = existing.id;
        itemUrl = existing.url || '';
        console.log(`${progress} @${entry.username} — re-processing embeddings...`);
      } else {
        // New item — copy image and create DB record
        const uploadUrl = await copyImageToUploads(imagePath);
        const item = await createItem({
          url: uploadUrl,
          title: `@${entry.username}`,
          content: entry.source_url,
          type: 'image',
          thumbnailUrl: uploadUrl,
          createdAt: new Date(entry.saved_at),
        });
        itemId = item.id;
        itemUrl = uploadUrl;
        console.log(`${progress} @${entry.username} — created, processing...`);
      }

      // Run AI pipeline (with retry on rate limits)
      await processItem(itemId, imagePath, `@${entry.username}`);

      if (existing) { reprocessed++; } else { created++; }

      // Pause between items to respect rate limits
      if (i < manifest.length - 1) {
        await sleep(DELAY_BETWEEN_ITEMS_MS);
      }
    } catch (e) {
      failed++;
      console.error(`${progress} FAIL @${entry.username}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\n=== Import complete ===`);
  console.log(`  Created:      ${created}`);
  console.log(`  Re-processed: ${reprocessed}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Failed:       ${failed}`);

  // Final recluster
  if (created + reprocessed > 0) {
    await runRecluster();
  }

  await client.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
