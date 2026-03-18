import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { verifyPassword, createSessionCookie, COOKIE_NAME, COOKIE_MAX_AGE } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, url }) => {
	// CSRF: validate Origin header
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}

	const { username, password } = await request.json();

	const expectedUser = env.AINA_USER;
	const expectedPass = env.AINA_PASSWORD;

	if (!expectedUser || !expectedPass) {
		return json({ error: 'Auth not configured' }, { status: 500 });
	}

	if (username !== expectedUser || !verifyPassword(password, expectedPass)) {
		return json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const cookie = createSessionCookie();

	return json({ success: true }, {
		headers: {
			'Set-Cookie': `${COOKIE_NAME}=${cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}${url.protocol === 'https:' ? '; Secure' : ''}`,
		},
	});
};
