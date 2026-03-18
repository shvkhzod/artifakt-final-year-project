import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { verifySessionCookie, COOKIE_NAME } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (isPublic(pathname)) {
		return resolve(event);
	}

	const cookie = event.cookies.get(COOKIE_NAME);
	const isAuthenticated = cookie ? verifySessionCookie(cookie) : false;

	if (!isAuthenticated) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		throw redirect(302, '/login');
	}

	return resolve(event);
};
