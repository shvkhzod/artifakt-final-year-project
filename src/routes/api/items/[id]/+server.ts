import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItemById, deleteItem } from '$lib/server/db/queries';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const item = await getItemById(params.id);
		if (!item) {
			throw error(404, 'Item not found');
		}
		return json(item);
	} catch (e) {
		if ((e as { status?: number }).status === 404) throw e;
		console.error('Failed to fetch item:', e);
		throw error(500, 'Failed to fetch item');
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
