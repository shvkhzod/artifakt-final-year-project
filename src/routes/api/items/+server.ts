import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createItem, getItems, stripEmbeddings } from '$lib/server/db/queries';
import type { NewItem } from '$lib/server/db/schema';
import { z } from 'zod';
import { isYouTubeUrl } from '$lib/utils/youtube';

export const GET: RequestHandler = async ({ url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const type = url.searchParams.get('type') || undefined;
	const clusterId = url.searchParams.get('clusterId') || undefined;

	try {
		const items = await getItems({ limit, offset, type, clusterId });
		return json(items.map(stripEmbeddings));
	} catch (e) {
		console.error('Failed to fetch items:', e);
		throw error(500, 'Failed to fetch items');
	}
};

const itemSchema = z.object({
	url: z.string().url().nullish(),
	title: z.string().nullish(),
	content: z.string().nullish(),
	type: z.enum(['image', 'article', 'quote', 'screenshot', 'video']),
	thumbnailUrl: z.string().nullish(),
	note: z.string().nullish(),
	colorPalette: z.any().optional(),
});

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') || '';
	let itemData: NewItem;

	if (contentType.includes('multipart/form-data')) {
		// Image upload flow
		const formData = await request.formData();
		const imageFile = (formData.get('image') || formData.get('file')) as File | null;
		const type = ((formData.get('type') as string) || 'image') as NewItem['type'];
		const title = formData.get('title') as string | null;

		if (!imageFile) throw error(400, 'No image provided');

		const { uploadImage } = await import('$lib/server/storage');
		const imageUrl = await uploadImage(imageFile);

		itemData = {
			type,
			thumbnailUrl: imageUrl,
			url: imageUrl,
			title: title || imageFile.name || 'Uploaded image',
		};
	} else {
		// JSON flow (URLs, text, quotes)
		let body;
		try {
			body = await request.json();
		} catch {
			throw error(400, 'Invalid JSON body');
		}

		const parsed = itemSchema.safeParse(body);
		if (!parsed.success) {
			throw error(400, `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
		}

		const { url, title, content, thumbnailUrl, note, colorPalette } = parsed.data;
		let { type } = parsed.data;

		// Auto-detect YouTube URLs
		if (url && isYouTubeUrl(url) && type === 'article') {
			type = 'video';
		}

		// If URL provided and no title/content, fetch metadata
		if (url && !title) {
			try {
				const { fetchUrlMetadata } = await import('$lib/server/metadata');
				const metadata = await fetchUrlMetadata(url);
				itemData = {
					url,
					title: metadata.title || url,
					content: content || metadata.description || '',
					thumbnailUrl: thumbnailUrl || metadata.image || '',
					type: type || 'article',
					note,
					colorPalette,
				};
			} catch {
				itemData = { url, title: title || url, content, type, thumbnailUrl, note, colorPalette };
			}
		} else {
			itemData = { url, title, content, type, thumbnailUrl, note, colorPalette };
		}
	}

	try {
		const item = await createItem(itemData);

		// Trigger AI pipeline async
		try {
			const { processItemPipeline } = await import('$lib/server/ai/pipeline');
			processItemPipeline(item.id, item).catch((e) =>
				console.error(`Pipeline failed for item ${item.id}:`, e),
			);
		} catch (e) {
			console.error('Failed to load pipeline module:', e);
		}

		return json(item, { status: 201 });
	} catch (e) {
		console.error('Failed to create item:', e);
		throw error(500, 'Failed to create item');
	}
};
