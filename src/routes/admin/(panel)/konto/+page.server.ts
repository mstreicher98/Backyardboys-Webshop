import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hashPassword, invalidateUserSessions, passwordProblem, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { requireUser, str, strOrNull } from '$lib/server/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const me = requireUser(locals);
	const devices = await db.select({ userAgent: sessions.userAgent, createdAt: sessions.createdAt }).from(sessions).where(eq(sessions.userId, me.id)).all();
	const row = await db.select({ notifyEmail: users.notifyEmail, notifyPush: users.notifyPush }).from(users).where(eq(users.id, me.id)).get();
	return { email: me.email ?? '', devices: devices.length, notifyEmail: row?.notifyEmail ?? true, notifyPush: row?.notifyPush ?? true };
};

async function checkPassword(userId: number, password: string) {
	const row = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).get();
	return !!row && (await verifyPassword(row.hash, password));
}

export const actions: Actions = {
	meldungen: async ({ locals, request }) => {
		const me = requireUser(locals);
		const f = await request.formData();
		await db
			.update(users)
			.set({ notifyEmail: f.get('email') === 'on', notifyPush: f.get('push') === 'on' })
			.where(eq(users.id, me.id));
		return { message: 'Gespeichert' };
	},
	profil: async ({ locals, request }) => {
		const me = requireUser(locals);
		const f = await request.formData();
		const name = str(f.get('name'), 80);
		const email = strOrNull(f.get('email'), 120)?.toLowerCase() ?? null;
		if (!name) return fail(400, { error: 'Bitte deinen Namen eingeben.' });
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, { error: 'Die E-Mail-Adresse sieht nicht gültig aus.' });
		await db.update(users).set({ name, email }).where(eq(users.id, me.id));
		return { message: 'Gespeichert' };
	},

	passwort: async ({ locals, request }) => {
		const me = requireUser(locals);
		const f = await request.formData();
		if (!(await checkPassword(me.id, String(f.get('aktuell') ?? '')))) return fail(400, { error: 'Das aktuelle Passwort stimmt nicht.' });
		const next = String(f.get('neu') ?? '');
		const problem = passwordProblem(next, String(f.get('neu2') ?? ''));
		if (problem) return fail(400, { error: problem });
		await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, me.id));
		await invalidateUserSessions(me.id, locals.sessionToken ?? undefined);
		return { message: 'Passwort geändert. Andere Geräte wurden abgemeldet.' };
	},

	app: async ({ locals, request }) => {
		const me = requireUser(locals);
		if (!(await checkPassword(me.id, String((await request.formData()).get('aktuell') ?? '')))) {
			return fail(400, { error: 'Das Passwort stimmt nicht.' });
		}
		await db.update(users).set({ totpEnabled: false, totpSecret: null, totpLastStep: null }).where(eq(users.id, me.id));
		await invalidateUserSessions(me.id, locals.sessionToken ?? undefined);
		redirect(303, '/admin/einrichtung');
	},

	abmelden: async ({ locals }) => {
		const me = requireUser(locals);
		await invalidateUserSessions(me.id, locals.sessionToken ?? undefined);
		return { message: 'Alle anderen Geräte wurden abgemeldet.' };
	}
};
