import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hashPassword, passwordProblem, verifyPassword } from '$lib/server/auth';
import { endAllCustomerSessions, createCustomerSession, requireCustomer } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { teamNoticeMail } from '$lib/server/emails';
import { str } from '$lib/server/guard';
import { notifyTeam } from '$lib/server/notify';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const c = (await db.select().from(customers).where(eq(customers.id, requireCustomer(locals).id)).get())!;
	return {
		profile: { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, company: c.company, vatId: c.vatId, locale: c.locale, hasPassword: !!c.passwordHash }
	};
};

export const actions: Actions = {
	daten: async ({ request, locals }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const form = await request.formData();
		const data = {
			firstName: str(form.get('vorname'), 80),
			lastName: str(form.get('nachname'), 80),
			phone: str(form.get('telefon'), 40),
			company: str(form.get('firma'), 120),
			vatId: str(form.get('uid'), 20).toUpperCase().replace(/\s/g, ''),
			locale: form.get('sprache') === 'en' ? ('en' as const) : ('de' as const)
		};
		if (!data.firstName || !data.lastName) return fail(400, { error: L('Bitte Vor- und Nachname angeben.', 'Please enter first and last name.') });
		const before = (await db.select().from(customers).where(eq(customers.id, requireCustomer(locals).id)).get())!;
		// Neue UID → muss neu geprüft werden
		await db
			.update(customers)
			.set({ ...data, ...(data.vatId !== before.vatId ? { vatIdValid: null, vatIdCheckedAt: null } : {}) })
			.where(eq(customers.id, before.id));
		return { ok: L('Gespeichert.', 'Saved.') };
	},
	passwort: async ({ request, locals, cookies }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const form = await request.formData();
		const c = (await db.select().from(customers).where(eq(customers.id, requireCustomer(locals).id)).get())!;
		if (c.passwordHash && !(await verifyPassword(c.passwordHash, String(form.get('alt') ?? '')))) return fail(400, { pwError: L('Das bisherige Passwort stimmt nicht.', 'The current password is incorrect.') });
		const pw = String(form.get('neu') ?? '');
		const problem = passwordProblem(pw, String(form.get('neu2') ?? ''));
		if (problem) return fail(400, { pwError: locals.locale === 'en' ? 'At least 10 characters, and both entries must match.' : problem });
		await db.update(customers).set({ passwordHash: await hashPassword(pw) }).where(eq(customers.id, c.id));
		await endAllCustomerSessions(c.id);
		await createCustomerSession(cookies, c.id, false);
		return { pwOk: L('Passwort geändert. Andere Geräte wurden abgemeldet.', 'Password changed. Other devices have been logged out.') };
	},
	loeschen: async ({ locals }) => {
		const c = requireCustomer(locals);
		// Löschung prüft das Team (Aufbewahrungspflicht für Rechnungen)
		void notifyTeam(
			teamNoticeMail(`Kunde möchte Konto löschen: ${c.email}`, `${c.firstName} ${c.lastName} (${c.email}) möchte das Kundenkonto löschen. Rechnungsdaten bleiben 7 Jahre aufbewahrt.`, `/admin/kunden/${c.id}`),
			{ title: 'Kontolöschung angefragt', body: c.email, url: `/admin/kunden/${c.id}` }
		);
		return { deleteRequested: true };
	}
};
