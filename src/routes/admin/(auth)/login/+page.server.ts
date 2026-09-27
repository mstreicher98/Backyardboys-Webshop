import { fail, redirect } from '@sveltejs/kit';
import { eq, or } from 'drizzle-orm';
import {
	burnPasswordTime,
	clearFailures,
	createChallenge,
	createSession,
	isRateLimited,
	registerFailure,
	setSessionCookie,
	verifyPassword
} from '$lib/server/auth';
import { BACKUP_NAME_RE } from '$lib/server/backup';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { checked, safeNext, str } from '$lib/server/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user?.totpEnabled && !locals.user.mustChangePassword) redirect(303, safeNext(url.searchParams.get('weiter')));
	// nach dem Wiederherstellen einer Sicherung: Name der Sicherung vom Stand davor
	const restored = url.searchParams.get('wiederhergestellt');
	return { weiter: url.searchParams.get('weiter') ?? '', restored: restored && BACKUP_NAME_RE.test(restored) ? restored : null };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const identifier = str(form.get('benutzer'), 120).toLowerCase();
		const password = String(form.get('passwort') ?? '').slice(0, 300);
		const persistent = checked(form.get('merken'));
		const next = safeNext(url.searchParams.get('weiter'));

		const ipKey = `login:${getClientAddress()}`;
		const userKey = `user:${identifier}`;
		if (isRateLimited(ipKey, 10) || isRateLimited(userKey)) {
			return fail(429, { identifier, error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });
		}
		if (!identifier || !password) return fail(400, { identifier, error: 'Bitte Benutzername und Passwort eingeben.' });

		const user = await db
			.select()
			.from(users)
			.where(or(eq(users.username, identifier), eq(users.email, identifier)))
			.get();
		const ok = user && user.active ? await verifyPassword(user.passwordHash, password) : (await burnPasswordTime(password), false);
		if (!user || !ok) {
			registerFailure(ipKey);
			registerFailure(userKey);
			return fail(400, { identifier, error: 'Benutzername oder Passwort stimmt nicht.' });
		}
		clearFailures(userKey);

		if (user.totpEnabled) {
			await createChallenge(cookies, user.id, persistent);
			redirect(303, `/admin/login/code?weiter=${encodeURIComponent(next)}`);
		}

		// Noch keine Authenticator-App: kurze Sitzung nur für die Einrichtung
		const s = await createSession(user.id, false, request.headers.get('user-agent'));
		setSessionCookie(cookies, s.token, s.expiresAt, false);
		redirect(303, '/admin/einrichtung');
	}
};
