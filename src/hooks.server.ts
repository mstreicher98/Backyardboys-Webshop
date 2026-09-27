import { json, redirect, type Handle, type HandleServerError, type ServerInit } from '@sveltejs/kit';
import { localeFromPath } from '$lib/i18n.svelte';
import { clearSessionCookie, SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { scheduleMaintenance } from '$lib/server/backup';
import { CUSTOMER_COOKIE, validateCustomerSession } from '$lib/server/customer-auth';
import { ensureDatabase } from '$lib/server/db';
import { adminBase, hosts, shopBase } from '$lib/server/urls';

export const init: ServerInit = async () => {
	await ensureDatabase();
	scheduleMaintenance();
};

/** Admin-Seiten, die ohne Anmeldung erreichbar sein müssen */
const OPEN_ADMIN = ['/admin/login', '/admin/sw.js'];
/** Seiten, die während der Ersteinrichtung (Passwort, 2FA) erlaubt sind */
const SETUP_PATHS = ['/admin/einrichtung', '/admin/logout'];
/** Auf der Admin-Adresse erlaubt, obwohl nicht unter /admin */
const ADMIN_HOST_SHARED = ['/medien/', '/datei/', '/healthz'];

const isAdmin = (path: string) => path === '/admin' || path.startsWith('/admin/');
const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

export const handle: Handle = async ({ event, resolve }) => {
	await ensureDatabase();
	const path = event.url.pathname;
	const admin = isAdmin(path);

	/* ---------------- Getrennte Adressen shop. / admin. */
	const h = hosts();
	if (h && event.request.method === 'GET') {
		const host = event.url.host;
		if (host === h.admin && !admin && !ADMIN_HOST_SHARED.some((p) => path.startsWith(p))) {
			redirect(path === '/' ? 303 : 301, path === '/' ? '/admin' : `${shopBase()}${path}${event.url.search}`);
		}
		if (host === h.shop && admin) redirect(301, `${adminBase()}${path}${event.url.search}`);
	}

	/* ---------------- Team */
	event.locals.user = null;
	event.locals.sessionToken = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const user = await validateSession(token);
		if (user) {
			event.locals.user = user;
			event.locals.sessionToken = token;
		} else {
			clearSessionCookie(event.cookies);
		}
	}
	const theme = event.cookies.get('theme');
	event.locals.theme = theme === 'light' || theme === 'dark' ? theme : 'system';

	if (admin && !matches(path, OPEN_ADMIN)) {
		const user = event.locals.user;
		if (!user) {
			if (path.startsWith('/admin/api/')) return json({ message: 'Nicht angemeldet' }, { status: 401 });
			const next = path === '/admin' ? '' : `?weiter=${encodeURIComponent(path + event.url.search)}`;
			redirect(303, `/admin/login${next}`);
		}
		// Erst neues Passwort und Authenticator-App einrichten, dann alles andere
		if ((user.mustChangePassword || !user.totpEnabled) && !matches(path, SETUP_PATHS)) {
			if (path.startsWith('/admin/api/')) return json({ message: 'Einrichtung nicht abgeschlossen' }, { status: 403 });
			redirect(303, '/admin/einrichtung');
		}
	}

	/* ---------------- Kunde und Sprache */
	event.locals.locale = admin ? 'de' : localeFromPath(path);
	event.locals.customer = null;
	if (!admin) {
		const ct = event.cookies.get(CUSTOMER_COOKIE);
		if (ct) {
			event.locals.customer = await validateCustomerSession(ct);
			if (!event.locals.customer) event.cookies.delete(CUSTOMER_COOKIE, { path: '/' });
		}
	}

	const htmlTheme = admin ? (event.locals.theme === 'system' ? '' : event.locals.theme) : 'dark';
	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%byb.lang%', event.locals.locale === 'en' ? 'en' : 'de-AT')
				.replace('%byb.theme%', htmlTheme)
				.replace('%byb.themecolor%', admin ? '#f4f4f5' : '#000000'),
		preload: ({ type }) => type === 'js' || type === 'css' || type === 'font'
	});

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	if (admin || path.startsWith('/datei/')) {
		response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	}
	if (admin || event.locals.customer || matches(path, ['/konto', '/kasse', '/warenkorb', '/bestellung', '/zahlung'])) {
		response.headers.set('Cache-Control', 'no-store');
	}
	return response;
};

export const handleError: HandleServerError = ({ error, status, event }) => {
	if (status !== 404) console.error(error);
	const en = localeFromPath(event.url.pathname) === 'en';
	return {
		message:
			status === 404
				? en
					? 'This page does not exist.'
					: 'Diese Seite gibt es nicht.'
				: en
					? 'Something went wrong – please try again.'
					: 'Unerwarteter Fehler – bitte versuche es erneut.'
	};
};
