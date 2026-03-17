import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) throw error(400, 'Missing url parameter');

	try {
		const { fetchUrlMetadata } = await import('$lib/server/metadata');
		const metadata = await fetchUrlMetadata(targetUrl);
		return json(metadata);
	} catch {
		throw error(500, 'Failed to fetch metadata');
	}
};
