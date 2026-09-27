import { isBot, recordView } from '$lib/server/pageviews';
import type { RequestHandler } from './$types';

/**
 * Der Browser meldet hier jeden echten Seitenwechsel (navigator.sendBeacon).
 * Gespeichert wird nur „Pfad + Tag + 1“ – keine IP, kein Cookie.
 * Vorab geladene Daten (beim Antippen eines Links) zählen so nicht mit.
 */

const perIp = new Map<string, { n: number; start: number }>();
const HOUR = 3_600_000;

function tooMany(ip: string): boolean {
	const now = Date.now();
	const e = perIp.get(ip);
	if (!e || now - e.start > HOUR) {
		perIp.set(ip, { n: 1, start: now });
		if (perIp.size > 10_000) perIp.clear();
		return false;
	}
	return ++e.n > 600;
}

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const path = (await request.text()).trim();
	const valid = /^\/[\w\-./]*$/.test(path) && path.length <= 200 && !path.startsWith('/admin');
	if (valid && !locals.user && !isBot(request.headers.get('user-agent')) && !tooMany(getClientAddress())) {
		recordView(path);
	}
	return new Response(null, { status: 204 });
};
