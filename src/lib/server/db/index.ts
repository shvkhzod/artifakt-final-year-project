import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const connectionString =
	env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/Aina';
const client = postgres(connectionString, {
	connect_timeout: 2,
	idle_timeout: 20,
	max_lifetime: 60 * 30,
});
export const db = drizzle(client, { schema });

// Track whether the DB is reachable so we can skip queries after a failure
let _dbAvailable: boolean | null = null;

export async function isDbAvailable(): Promise<boolean> {
	if (_dbAvailable !== null) return _dbAvailable;
	try {
		await client`SELECT 1`;
		_dbAvailable = true;
	} catch {
		_dbAvailable = false;
		// Re-check after 60s in case the DB comes back
		setTimeout(() => { _dbAvailable = null; }, 60_000);
	}
	return _dbAvailable;
}
