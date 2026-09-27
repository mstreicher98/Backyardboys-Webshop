import { fail } from '@sveltejs/kit';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { ROLES, type Role } from '$lib/permissions';
import { logAction } from '$lib/server/audit';
import { generatePassword, hashPassword, invalidateUserSessions } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { intOrNull, requirePermission, str, strOrNull } from '$lib/server/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'users.manage');
	const rows = await db
		.select({
			id: users.id,
			username: users.username,
			name: users.name,
			email: users.email,
			role: users.role,
			owner: users.owner,
			active: users.active,
			totpEnabled: users.totpEnabled,
			mustChangePassword: users.mustChangePassword,
			lastLoginAt: users.lastLoginAt
		})
		.from(users)
		.orderBy(asc(users.name))
		.all();
	return { users: rows };
};

async function target(form: FormData, me: { id: number }) {
	const id = intOrNull(form.get('id'));
	const u = id ? await db.select().from(users).where(eq(users.id, id)).get() : null;
	return { u, self: u?.id === me.id };
}

const activeAdmins = async (exceptId: number) =>
	Number(
		(
			await db
				.select({ n: sql<number>`count(*)` })
				.from(users)
				.where(and(eq(users.role, 'admin'), eq(users.active, true), ne(users.id, exceptId)))
				.get()
		)?.n ?? 0
	);

export const actions: Actions = {
	anlegen: async ({ locals, request }) => {
		const me = requirePermission(locals, 'users.manage');
		const f = await request.formData();
		const name = str(f.get('name'), 80);
		const username = str(f.get('benutzername'), 40).toLowerCase();
		const email = strOrNull(f.get('email'), 120)?.toLowerCase() ?? null;
		const role = (ROLES as readonly string[]).includes(String(f.get('rolle'))) ? (f.get('rolle') as Role) : 'mitarbeiter';
		if (!name) return fail(400, { error: 'Bitte den Namen eingeben.' });
		if (!/^[a-z0-9._-]{3,40}$/.test(username)) return fail(400, { error: 'Benutzername: 3–40 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt, Strich.' });
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, { error: 'Die E-Mail-Adresse sieht nicht gültig aus.' });
		if (await db.select({ id: users.id }).from(users).where(eq(users.username, username)).get()) {
			return fail(400, { error: `Den Benutzernamen „${username}“ gibt es schon.` });
		}
		const password = generatePassword(14);
		const row = await db
			.insert(users)
			.values({ name, username, email, role, passwordHash: await hashPassword(password), mustChangePassword: true })
			.returning({ id: users.id })
			.get();
		await logAction(me.id, 'erstellt', 'benutzer', row.id, name);
		return { message: `${name} angelegt`, password, forUser: username, forName: name };
	},

	rolle: async ({ locals, request }) => {
		const me = requirePermission(locals, 'users.manage');
		const f = await request.formData();
		const { u, self } = await target(f, me);
		const role = String(f.get('rolle')) as Role;
		if (!u || !(ROLES as readonly string[]).includes(role)) return fail(400, { error: 'Ungültige Angaben.' });
		if (u.owner && role !== 'admin') return fail(400, { error: 'Der erste Admin bleibt immer Admin.' });
		if (self && role !== 'admin') return fail(400, { error: 'Du kannst dir die Admin-Rechte nicht selbst entziehen.' });
		await db.update(users).set({ role }).where(eq(users.id, u.id));
		await logAction(me.id, 'geändert', 'benutzer', u.id, `${u.name}: Rolle ${role}`);
		return { message: `Rolle von ${u.name} geändert` };
	},

	passwort: async ({ locals, request }) => {
		const me = requirePermission(locals, 'users.manage');
		const { u } = await target(await request.formData(), me);
		if (!u) return fail(404, { error: 'Nicht gefunden.' });
		const password = generatePassword(14);
		await db.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: true }).where(eq(users.id, u.id));
		await invalidateUserSessions(u.id, u.id === me.id ? (locals.sessionToken ?? undefined) : undefined);
		await logAction(me.id, 'geändert', 'benutzer', u.id, `${u.name}: Passwort zurückgesetzt`);
		return { message: `Neues Passwort für ${u.name} erzeugt`, password, forUser: u.username, forName: u.name };
	},

	zweiFaktor: async ({ locals, request }) => {
		const me = requirePermission(locals, 'users.manage');
		const { u } = await target(await request.formData(), me);
		if (!u) return fail(404, { error: 'Nicht gefunden.' });
		await db.update(users).set({ totpEnabled: false, totpSecret: null, totpLastStep: null }).where(eq(users.id, u.id));
		await invalidateUserSessions(u.id);
		await logAction(me.id, 'geändert', 'benutzer', u.id, `${u.name}: Zwei-Faktor zurückgesetzt`);
		return { message: `${u.name} richtet die Authenticator-App beim nächsten Login neu ein` };
	},

	aktiv: async ({ locals, request }) => {
		const me = requirePermission(locals, 'users.manage');
		const { u, self } = await target(await request.formData(), me);
		if (!u) return fail(404, { error: 'Nicht gefunden.' });
		if (self || u.owner) return fail(400, { error: 'Dieser Zugang kann nicht gesperrt werden.' });
		if (u.active && u.role === 'admin' && (await activeAdmins(u.id)) === 0) return fail(400, { error: 'Es muss mindestens ein aktiver Admin bleiben.' });
		await db.update(users).set({ active: !u.active }).where(eq(users.id, u.id));
		if (u.active) await invalidateUserSessions(u.id);
		await logAction(me.id, 'geändert', 'benutzer', u.id, `${u.name}: ${u.active ? 'gesperrt' : 'entsperrt'}`);
		return { message: u.active ? `${u.name} gesperrt` : `${u.name} wieder freigeschaltet` };
	},

	loeschen: async ({ locals, request }) => {
		const me = requirePermission(locals, 'users.manage');
		const { u, self } = await target(await request.formData(), me);
		if (!u) return fail(404, { error: 'Nicht gefunden.' });
		if (self || u.owner) return fail(400, { error: 'Dieser Zugang kann nicht gelöscht werden.' });
		await invalidateUserSessions(u.id);
		await db.delete(users).where(eq(users.id, u.id));
		await logAction(me.id, 'gelöscht', 'benutzer', u.id, u.name);
		return { message: `${u.name} gelöscht` };
	}
};
