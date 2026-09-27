import { client } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** Für den Docker-Healthcheck: App läuft und Datenbank antwortet */
export const GET: RequestHandler = async () => {
	await client.execute('SELECT 1');
	return new Response('ok', { headers: { 'Cache-Control': 'no-store' } });
};
