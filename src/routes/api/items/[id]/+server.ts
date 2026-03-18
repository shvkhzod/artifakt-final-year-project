import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItemById, deleteItem, stripEmbeddings } from '$lib/server/db/queries';
import { processItemPipeline } from '$lib/server/ai/pipeline';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const item = await getItemById(params.id);
		if (!item) {
			throw error(404, 'Item not found');
		}
		return json(stripEmbeddings(item));
	} catch (e) {
		if ((e as { status?: number }).status === 404) throw e;
		console.error('Failed to fetch item:', e);
		throw error(500, 'Failed to fetch item');
	}
};

export const PATCH: RequestHandler = async ({ params }) => {
	try {
		const item = await getItemById(params.id);
		if (!item) throw error(404, 'Item not found');
		processItemPipeline(item.id, item).catch((e) =>
			console.error(`Reprocess failed for ${item.id}:`, e),
		);
		return json({ success: true, id: item.id });
	} catch (e) {
		if ((e as { status?: number }).status === 404) throw e;
		console.error('Failed to reprocess item:', e);
		throw error(500, 'Failed to reprocess item');
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const item = await getItemById(params.id);
		if (!item) {
			throw error(404, 'Item not found');
		}
		await deleteItem(params.id);
		return new Response(null, { status: 204 });
	} catch (e) {
		if ((e as { status?: number }).status === 404) throw e;
		console.error('Failed to delete item:', e);
		throw error(500, 'Failed to delete item');
	}
};
