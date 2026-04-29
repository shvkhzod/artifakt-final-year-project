import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createItem, stripEmbeddings } from '$lib/server/db/queries';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const saveSchema = z.object({
	arenaId: z.number(),
	title: z.string().nullish(),
	imageUrl: z.string().nullish(),
	content: z.string().nullish(),
	sourceUrl: z.string(),
	type: z.enum(['image', 'quote', 'article']),
});

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const parsed = saveSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, `Validation: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}

	const { arenaId, title, imageUrl, content, sourceUrl, type } = parsed.data;

	if ((type === 'image') && !imageUrl) {
		throw error(400, 'imageUrl required for image saves');
	}
	if (type === 'quote' && !content) {
		throw error(400, 'content required for text saves');
	}

	const matchUrl = type === 'image' ? imageUrl! : sourceUrl;
	const [existing] = await db
		.select({ id: items.id })
		.from(items)
		.where(eq(items.url, matchUrl));

	if (existing) {
		return json({ error: 'Already saved', existingId: existing.id }, { status: 409 });
	}

	let itemData: Parameters<typeof createItem>[0];

	if (type === 'image') {
		itemData = {
			url: imageUrl!,
			thumbnailUrl: imageUrl!,
			title: title || 'Are.na image',
			note: sourceUrl,
			type: 'image',
		};
	} else if (type === 'quote') {
		itemData = {
			url: sourceUrl,
			title: title || null,
			content: content!,
			type: 'quote',
		};
	} else {
		itemData = {
			url: sourceUrl,
			thumbnailUrl: imageUrl || null,
			title: title || sourceUrl,
			type: 'article',
		};
	}

	try {
		const item = await createItem(itemData);

		try {
			const { processItemPipeline } = await import('$lib/server/ai/pipeline');
			processItemPipeline(item.id, item).catch((e) =>
				console.error(`Pipeline failed for saved arena block ${item.id}:`, e),
			);
		} catch (e) {
			console.error('Failed to load pipeline:', e);
		}

		return json(stripEmbeddings(item), { status: 201 });
	} catch (e) {
		console.error('Failed to save arena block:', e);
		throw error(500, 'Failed to save item');
	}
};
