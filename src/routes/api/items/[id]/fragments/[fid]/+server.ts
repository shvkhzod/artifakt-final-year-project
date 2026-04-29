import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFragmentById, deleteFragment } from '$lib/server/db/queries';

export const DELETE: RequestHandler = async ({ params }) => {
	const fragment = await getFragmentById(params.fid);
	if (!fragment) throw error(404, 'Fragment not found');
	if (fragment.itemId !== params.id) throw error(404, 'Fragment not found');

	await deleteFragment(params.fid);
	return new Response(null, { status: 204 });
};
