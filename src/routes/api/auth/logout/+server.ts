import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { COOKIE_NAME } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, url }) => {
	// CSRF: validate Origin header
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}

	return json({ success: true }, {
		headers: {
			'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
		},
	});
};
