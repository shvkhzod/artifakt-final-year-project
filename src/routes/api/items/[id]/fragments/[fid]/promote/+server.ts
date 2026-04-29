import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItemById, getFragmentById, createItem } from '$lib/server/db/queries';
import { processItemPipeline } from '$lib/server/ai/pipeline';

export const POST: RequestHandler = async ({ params }) => {
	const [item, fragment] = await Promise.all([
		getItemById(params.id),
		getFragmentById(params.fid),
	]);

	if (!item) throw error(404, 'Item not found');
	if (!fragment) throw error(404, 'Fragment not found');
	if (fragment.itemId !== params.id) throw error(404, 'Fragment not found');

	const newItem = await createItem({
		title: fragment.label,
		content: fragment.content,
		type: 'article',
		note: `Dissected from: ${item.title || 'Untitled'}`,
	});

	// Trigger AI pipeline (non-blocking)
	processItemPipeline(newItem.id, newItem).catch((e) =>
		console.error(`Pipeline failed for promoted fragment ${newItem.id}:`, e),
	);

	return json(newItem, { status: 201 });
};
