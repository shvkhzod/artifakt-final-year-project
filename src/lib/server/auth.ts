import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto';
import { env } from '$env/dynamic/private';

const COOKIE_NAME = 'aina_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

let cachedSecret: string | null = null;

function getSecret(): string {
	if (cachedSecret) return cachedSecret;
	cachedSecret = env.AINA_SECRET || randomBytes(32).toString('hex');
	return cachedSecret;
}

// Fixed salt is acceptable for single-user self-hosted: there's only one password
// and the env is trusted. The scrypt+timingSafeEqual prevents timing attacks.
export function verifyPassword(submitted: string, expected: string): boolean {
	const salt = 'aina-fixed-salt';
	const submittedHash = scryptSync(submitted, salt, 64);
	const expectedHash = scryptSync(expected, salt, 64);
	return timingSafeEqual(submittedHash, expectedHash);
}

export function createSessionCookie(): string {
	const secret = getSecret();
	const payload = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url');
	const signature = createHmac('sha256', secret).update(payload).digest('base64url');
	return `${payload}.${signature}`;
}

export function verifySessionCookie(cookie: string): boolean {
	const secret = getSecret();
	const parts = cookie.split('.');
	if (parts.length !== 2) return false;

	const [payload, signature] = parts;
	const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');

	if (signature.length !== expectedSig.length) return false;
	if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return false;

	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
		const age = (Date.now() - data.ts) / 1000;
		return age < COOKIE_MAX_AGE;
	} catch {
		return false;
	}
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
