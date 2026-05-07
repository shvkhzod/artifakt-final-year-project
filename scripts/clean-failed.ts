/**
 * Removes items with embedding_status='failed' or NULL content_embedding.
 * Run with: npx tsx scripts/clean-failed.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { items, itemClusters, itemTags, fragments } from '../src/lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/Aina';
const client = postgres(connectionString);
const db = drizzle(client);

async function clean() {
  // Only delete items the pipeline EXPLICITLY marked as failed.
  // Seeded items have status='pending' (default), so they're preserved.
  const failed = await db
    .select({ id: items.id, title: items.title, status: items.embeddingStatus })
    .from(items)
    .where(eq(items.embeddingStatus, 'failed'));

  if (failed.length === 0) {
    console.log('No failed items to clean.');
    process.exit(0);
  }

  console.log(`Found ${failed.length} items in 'failed' state:`);
  for (const f of failed.slice(0, 10)) {
    console.log(`  - ${f.id.slice(0, 8)} | status=${f.status} | "${f.title?.slice(0, 60) ?? '(no title)'}"`);
  }
  if (failed.length > 10) console.log(`  …and ${failed.length - 10} more`);

  console.log('\nDeleting…');

  const ids = failed.map((f) => f.id);

  // Cascade-delete dependent rows first (foreign keys)
  await db.delete(fragments).where(sql`item_id = ANY(${ids})`);
  await db.delete(itemClusters).where(sql`item_id = ANY(${ids})`);
  await db.delete(itemTags).where(sql`item_id = ANY(${ids})`);
  const result = await db.delete(items).where(sql`id = ANY(${ids})`);

  console.log(`Deleted ${failed.length} items + their fragments/cluster-assignments/tags.`);

  // Report on what's left
  const survivors = await db
    .select({ id: items.id, title: items.title, status: items.embeddingStatus })
    .from(items);

  console.log(`\nRemaining items in DB: ${survivors.length}`);
  const byStatus = survivors.reduce<Record<string, number>>((a, s) => {
    a[s.status] = (a[s.status] || 0) + 1;
    return a;
  }, {});
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  // How many are usable for clustering (have content_embedding = status='complete')
  const usable = byStatus['complete'] || 0;
  console.log(`\nItems usable for clustering / Taste Map: ${usable}`);
  if (usable < 10) {
    console.log(`⚠  You're below minItemsForClustering (10). The next drop will not auto-cluster.`);
    console.log(`   Need at least ${10 - usable} more successful drops, ONE AT A TIME (~10s apart).`);
  } else {
    console.log(`✓ Above the clustering threshold. New drops will trigger clustering.`);
  }

  await client.end();
  process.exit(0);
}

clean().catch((e) => {
  console.error('Clean failed:', e);
  process.exit(1);
});
