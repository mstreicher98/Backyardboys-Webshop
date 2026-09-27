import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

/**
 * Kurze Erfolgsmeldung über eine Weiterleitung hinweg („Beitrag gespeichert“).
 * Das Admin-Layout liest sie einmal aus und zeigt sie als Toast.
 */
const COOKIE = 'byb_flash';

export function setFlash(cookies: Cookies, message: string, kind: 'ok' | 'error' = 'ok') {
	cookies.set(COOKIE, JSON.stringify({ message, kind, id: Date.now() }), {
		path: '/admin',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60
	});
}

export function takeFlash(cookies: Cookies): { message: string; kind: 'ok' | 'error'; id: number } | null {
	const raw = cookies.get(COOKIE);
	if (!raw) return null;
	cookies.delete(COOKIE, { path: '/admin' });
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
