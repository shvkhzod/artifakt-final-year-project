import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChannelContents, isArenaConfigured } from '$lib/server/arena';

export const GET: RequestHandler = async ({ params }) => {
  if (!isArenaConfigured()) {
    throw error(501, 'Are.na integration not configured');
  }

  const { slug } = params;
  if (!slug) throw error(400, 'Channel slug is required');

  try {
    const result = await getChannelContents(slug);
    if (!result) {
      throw error(502, 'Failed to fetch channel from Are.na');
    }
    return json(result);
  } catch (e) {
    if ((e as any)?.status) throw e;
    console.error(`Channel fetch failed for ${slug}:`, e);
    throw error(502, 'Are.na connection failed');
  }
};
