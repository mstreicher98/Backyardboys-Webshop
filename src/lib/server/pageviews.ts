import { sql } from 'drizzle-orm';
import { todayVienna } from '$lib/format';
import { db } from './db';
import { pageViews } from './db/schema';

/**
 * Zählt Seitenaufrufe je Tag und Pfad. Gespeichert werden nur diese Summen –
 * keine IP-Adresse, kein Cookie, kein Browser. Gesammelt wird im Speicher und
 * einmal pro Minute in die Datenbank geschrieben.
 */

const BOT_RE = /bot|crawl|spider|slurp|bing|yandex|baidu|duckduck|facebookexternalhit|whatsapp|telegram|preview|monitor|uptime|curl|wget|python|java\/|go-http|headless|lighthouse|scan/i;

const pending = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;

export function isBot(userAgent: string | null): boolean {
	return !userAgent || BOT_RE.test(userAgent);
}

export function recordView(path: string) {
	const clean = (path.length > 1 ? path.replace(/\/+$/, '') : path).slice(0, 200);
	const key = `${todayVienna()}|${clean}`;
	pending.set(key, (pending.get(key) ?? 0) + 1);
	if (!timer) {
		timer = setInterval(() => void flushViews(), 60_000);
		timer.unref?.();
	}
}

export async function flushViews() {
	if (!pending.size) return;
	const batch = [...pending.entries()];
	pending.clear();
	try {
		for (const [key, n] of batch) {
			const [day, path] = key.split('|');
			await db
				.insert(pageViews)
				.values({ day, path, views: n })
				.onConflictDoUpdate({ target: [pageViews.day, pageViews.path], set: { views: sql`${pageViews.views} + ${n}` } });
		}
	} catch (err) {
		console.error('[aufrufe]', err);
	}
}
