import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { localizePath } from '$lib/i18n.svelte';
import { hashPassword, isRateLimited, passwordProblem, registerFailure } from '$lib/server/auth';
import { createCustomerToken, isEmail, normalizeEmail } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { accountLinkMail } from '$lib/server/emails';
import { checked, str } from '$lib/server/guard';
import { queueMail } from '$lib/server/mail';
import { shopUrl } from '$lib/server/urls';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.customer) redirect(303, localizePath('/konto', locals.locale));
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const locale = locals.locale;
		const L = (de: string, en: string) => (locale === 'en' ? en : de);
		const form = await request.formData();
		const values = {
			email: normalizeEmail(str(form.get('email'), 200)),
			firstName: str(form.get('vorname'), 80),
			lastName: str(form.get('nachname'), 80)
		};
		const password = String(form.get('passwort') ?? '');
		const key = `registrieren:${getClientAddress()}`;
		if (isRateLimited(key, 8, 60 * 60_000)) return fail(429, { values, error: L('Zu viele Anfragen. Bitte später erneut versuchen.', 'Too many requests. Please try again later.') });
		if (!isEmail(values.email) || !values.firstName || !values.lastName) return fail(400, { values, error: L('Bitte Name und eine gültige E-Mail-Adresse eingeben.', 'Please enter your name and a valid email address.') });
		const problem = passwordProblem(password);
		if (problem) return fail(400, { values, error: locale === 'en' ? 'The password needs at least 10 characters.' : problem });
		if (!checked(form.get('datenschutz'))) return fail(400, { values, error: L('Bitte bestätige die Datenschutzerklärung.', 'Please accept the privacy policy.') });
		registerFailure(key, 60 * 60_000);

		const existing = await db.select().from(customers).where(eq(customers.email, values.email)).get();
		if (existing?.emailVerifiedAt && existing.passwordHash) {
			// Nicht verraten, dass es das Konto schon gibt – stattdessen Hinweis per Mail
			const token = await createCustomerToken(values.email, 'login', existing.id);
			queueMail(values.email, accountLinkMail('login', shopUrl(`/konto/anmeldelink/${token}`, locale), locale), { template: 'konto' });
			return { sent: values.email };
		}
		const passwordHash = await hashPassword(password);
		const id = existing
			? (await db.update(customers).set({ ...values, passwordHash, locale }).where(eq(customers.id, existing.id)).returning({ id: customers.id }).get()).id
			: (await db.insert(customers).values({ ...values, passwordHash, locale }).returning({ id: customers.id }).get()).id;
		const token = await createCustomerToken(values.email, 'verify', id);
		queueMail(values.email, accountLinkMail('verify', shopUrl(`/konto/bestaetigen/${token}`, locale), locale), { template: 'konto' });
		return { sent: values.email };
	}
};
