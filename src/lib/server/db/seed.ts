import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { items, clusters, tags, itemClusters, itemTags } from './schema';
import { CLUSTER_COLORS } from '../../utils/colors';

const connectionString =
	process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/Aina';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
	console.log('Seeding database...');

	// Enable pgvector
	await client`CREATE EXTENSION IF NOT EXISTS vector`;

	// Clear existing data
	await db.delete(itemTags);
	await db.delete(itemClusters);
	await db.delete(items);
	await db.delete(clusters);
	await db.delete(tags);

	// Create clusters
	const [visualAesthetics] = await db
		.insert(clusters)
		.values({ name: 'Visual Aesthetics', color: CLUSTER_COLORS.amber, description: 'Photography, art, and visual beauty', source: 'user' })
		.returning();

	const [designPhilosophy] = await db
		.insert(clusters)
		.values({ name: 'Design Philosophy', color: CLUSTER_COLORS.cyan, description: 'Principles of good design and craft', source: 'user' })
		.returning();

	const [technology] = await db
		.insert(clusters)
		.values({ name: 'Technology', color: CLUSTER_COLORS.emerald, description: 'Software, AI, and digital tools', source: 'user' })
		.returning();

	const [literature] = await db
		.insert(clusters)
		.values({ name: 'Literature', color: CLUSTER_COLORS.mauve, description: 'Writing, philosophy, and ideas', source: 'user' })
		.returning();

	// Create tags
	const tagNames = ['minimalism', 'typography', 'architecture', 'philosophy', 'AI', 'photography', 'color-theory', 'brutalism'];
	const createdTags: Record<string, typeof tags.$inferSelect> = {};
	for (const name of tagNames) {
		const [tag] = await db.insert(tags).values({ name, source: 'ai' }).returning();
		createdTags[name] = tag;
	}

	// Sample items — Images
	const sampleImages = [
		{ title: 'Morning Light on Concrete', url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600', type: 'image' as const, content: 'Brutalist architecture bathed in golden morning light. The interplay of shadow and form.' },
		{ title: 'Foggy Mountain Ridge', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600', type: 'image' as const, content: 'Misty peaks layered in shades of blue and grey. Depth through atmospheric perspective.' },
		{ title: 'Tokyo Alleyway at Night', url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600', type: 'image' as const, content: 'Neon reflections on wet pavement. The quiet beauty of urban solitude.' },
		{ title: 'Minimalist Interior Space', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600', type: 'image' as const, content: 'Clean lines, natural materials, and intentional emptiness. Less as more.' },
		{ title: 'Abstract Color Field', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600', type: 'image' as const, content: 'Vivid color gradients bleeding into each other. Pure chromatic experience.' },
		{ title: 'Weathered Typography', url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600', type: 'image' as const, content: 'Hand-painted lettering fading on an old brick wall. Time as a design element.' },
	];

	// Sample items — Articles
	const sampleArticles = [
		{ title: 'The Shape of Design', url: 'https://shapeofdesignbook.com', type: 'article' as const, content: 'Frank Chimero explores how design is not just problem-solving but a way of contributing to the world. Design as a practice of empathy and imagination.' },
		{ title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', type: 'article' as const, content: 'The landmark paper introducing the Transformer architecture. Self-attention mechanisms that revolutionized natural language processing and beyond.' },
		{ title: 'A Handmade Web', url: 'https://luckysoap.com/statements/handmadeweb.html', type: 'article' as const, content: 'J.R. Carpenter argues for the handmade web — websites crafted with care, intention, and human touch over algorithmic optimization.' },
		{ title: 'The Garden and the Stream', url: 'https://hapgood.us/2015/10/17/the-garden-and-the-stream-a-technopastoral/', type: 'article' as const, content: 'Mike Caulfield contrasts two models of the web: the garden (wiki, interconnected, timeless) vs the stream (feed, chronological, ephemeral).' },
		{ title: 'How Buildings Learn', url: 'https://en.wikipedia.org/wiki/How_Buildings_Learn', type: 'article' as const, content: 'Stewart Brand on how buildings adapt over time. The concept of shearing layers — site, structure, skin, services, space plan, stuff — as a model for all systems.' },
		{ title: 'Local-First Software', url: 'https://www.inkandswitch.com/local-first/', type: 'article' as const, content: 'Ink & Switch explores a new paradigm for software that keeps data on the user\'s device while enabling collaboration. Ownership, privacy, and longevity.' },
	];

	// Sample items — Quotes
	const sampleQuotes = [
		{ title: 'On Simplicity', type: 'quote' as const, content: 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.', note: 'Antoine de Saint-Exupery' },
		{ title: 'On Craft', type: 'quote' as const, content: 'The details are not the details. They make the design.', note: 'Charles Eames' },
		{ title: 'On Seeing', type: 'quote' as const, content: 'The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.', note: 'Marcel Proust' },
		{ title: 'On Technology', type: 'quote' as const, content: 'Any sufficiently advanced technology is indistinguishable from magic.', note: 'Arthur C. Clarke' },
		{ title: 'On Knowledge', type: 'quote' as const, content: 'The only true wisdom is in knowing you know nothing.', note: 'Socrates' },
	];

	// Sample items — Screenshots
	const sampleScreenshots = [
		{ title: 'Linear App — Issue Board', url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600', type: 'screenshot' as const, content: 'Clean issue tracker UI with keyboard-first navigation. Beautiful dark mode implementation.' },
		{ title: 'VS Code — Monokai Theme', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600', type: 'screenshot' as const, content: 'Code editor showing a well-structured TypeScript file. Syntax highlighting as functional beauty.' },
		{ title: 'Figma — Auto Layout Demo', url: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600', type: 'screenshot' as const, content: 'Design tool showcasing responsive component architecture. Constraints as creative framework.' },
	];

	// Insert all items
	const allItems = [...sampleImages, ...sampleArticles, ...sampleQuotes, ...sampleScreenshots];
	const insertedItems = await db.insert(items).values(allItems).returning();

	// Assign items to clusters and tags
	const clusterAssignments: Array<{ itemIndex: number; cluster: typeof visualAesthetics; tagNames: string[] }> = [
		// Images → Visual Aesthetics
		{ itemIndex: 0, cluster: visualAesthetics, tagNames: ['architecture', 'brutalism'] },
		{ itemIndex: 1, cluster: visualAesthetics, tagNames: ['photography'] },
		{ itemIndex: 2, cluster: visualAesthetics, tagNames: ['photography'] },
		{ itemIndex: 3, cluster: visualAesthetics, tagNames: ['minimalism'] },
		{ itemIndex: 4, cluster: visualAesthetics, tagNames: ['color-theory'] },
		{ itemIndex: 5, cluster: visualAesthetics, tagNames: ['typography'] },
		// Articles
		{ itemIndex: 6, cluster: designPhilosophy, tagNames: ['philosophy'] },
		{ itemIndex: 7, cluster: technology, tagNames: ['AI'] },
		{ itemIndex: 8, cluster: designPhilosophy, tagNames: ['philosophy'] },
		{ itemIndex: 9, cluster: technology, tagNames: ['philosophy'] },
		{ itemIndex: 10, cluster: designPhilosophy, tagNames: ['architecture'] },
		{ itemIndex: 11, cluster: technology, tagNames: ['AI'] },
		// Quotes
		{ itemIndex: 12, cluster: designPhilosophy, tagNames: ['minimalism', 'philosophy'] },
		{ itemIndex: 13, cluster: designPhilosophy, tagNames: ['philosophy'] },
		{ itemIndex: 14, cluster: literature, tagNames: ['philosophy'] },
		{ itemIndex: 15, cluster: technology, tagNames: ['philosophy'] },
		{ itemIndex: 16, cluster: literature, tagNames: ['philosophy'] },
		// Screenshots
		{ itemIndex: 17, cluster: technology, tagNames: ['minimalism'] },
		{ itemIndex: 18, cluster: technology, tagNames: ['typography'] },
		{ itemIndex: 19, cluster: technology, tagNames: ['minimalism'] },
	];

	for (const assignment of clusterAssignments) {
		const item = insertedItems[assignment.itemIndex];
		await db.insert(itemClusters).values({
			itemId: item.id,
			clusterId: assignment.cluster.id,
			confidence: 0.8 + Math.random() * 0.2,
		});

		for (const tagName of assignment.tagNames) {
			const tag = createdTags[tagName];
			if (tag) {
				await db.insert(itemTags).values({ itemId: item.id, tagId: tag.id });
			}
		}
	}

	// Update cluster counts using raw SQL
	for (const cluster of [visualAesthetics, designPhilosophy, technology, literature]) {
		const count = clusterAssignments.filter((a) => a.cluster.id === cluster.id).length;
		await client`UPDATE clusters SET item_count = ${count} WHERE id = ${cluster.id}`;
	}

	console.log(`Seeded ${insertedItems.length} items, 4 clusters, ${tagNames.length} tags`);
	await client.end();
	process.exit(0);
}

seed().catch((e) => {
	console.error('Seed failed:', e);
	process.exit(1);
});
