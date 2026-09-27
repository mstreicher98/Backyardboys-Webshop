import type { RequestHandler } from './$types';

/**
 * Service Worker nur für den Admin-Bereich (Scope /admin/): zeigt die
 * Push-Nachrichten an und öffnet beim Antippen die passende Seite.
 */
const SCRIPT = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
	let data = { title: 'Backyardboys Design', body: '', url: '/admin' };
	try { data = { ...data, ...event.data.json() }; } catch (e) { if (event.data) data.body = event.data.text(); }
	event.waitUntil(self.registration.showNotification(data.title, {
		body: data.body,
		icon: '/icons/icon-192.png',
		badge: '/icons/icon-192.png',
		tag: data.tag,
		renotify: !!data.tag,
		data: { url: data.url }
	}));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL((event.notification.data && event.notification.data.url) || '/admin', self.location.origin).href;
	event.waitUntil((async () => {
		const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
		for (const c of all) {
			if (c.url.startsWith(self.location.origin + '/admin') && 'focus' in c) {
				await c.focus();
				if ('navigate' in c) return c.navigate(url);
				return;
			}
		}
		return self.clients.openWindow(url);
	})());
});
`;

export const GET: RequestHandler = () =>
	new Response(SCRIPT, {
		headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/admin/' }
	});
