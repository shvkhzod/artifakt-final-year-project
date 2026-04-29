import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItemById, getFragmentsByItemId } from '$lib/server/db/queries';

export const GET: RequestHandler = async ({ params }) => {
	const item = await getItemById(params.id);
	if (!item) throw error(404, 'Item not found');

	const fragments = await getFragmentsByItemId(params.id);
	return json({ fragments });
};
