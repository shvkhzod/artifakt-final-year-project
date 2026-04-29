import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getItemById,
	getFragmentsByItemId,
	deleteFragmentsByItemId,
	createFragments,
	setDissectedAt,
} from '$lib/server/db/queries';
import { dissectItem } from '$lib/server/ai/dissect';

export const POST: RequestHandler = async ({ params, url }) => {
	const force = url.searchParams.get('force') === 'true';

	const item = await getItemById(params.id);
	if (!item) throw error(404, 'Item not found');

	// Check minimum content
	const contentLength = (item.content?.length ?? 0) + (item.title?.length ?? 0);
	const hasImage =
		(item.type === 'image' || item.type === 'screenshot') && (item.url || item.thumbnailUrl);
	if (contentLength < 20 && !hasImage) {
		throw error(422, 'Item has insufficient content to dissect');
	}

	// If already dissected and not forcing, return existing fragments
	if (item.dissectedAt && !force) {
		const existing = await getFragmentsByItemId(params.id);
		return json({ fragments: existing, dissectedAt: item.dissectedAt });
	}

	// If forcing, delete existing fragments first
	if (force) {
		await deleteFragmentsByItemId(params.id);
	}

	try {
		const rawFragments = await dissectItem(item);

		const fragments = await createFragments(
			params.id,
			rawFragments.map((f) => ({
				category: f.category,
				label: f.label,
				content: f.content,
				metadata: f.metadata,
				sortOrder: f.sort_order,
			})),
		);

		await setDissectedAt(params.id);

		return json({
			fragments,
			dissectedAt: new Date().toISOString(),
		});
	} catch (e) {
		console.error('Dissect failed:', e);
		throw error(500, `Dissect failed: ${(e as Error).message}`);
	}
};
