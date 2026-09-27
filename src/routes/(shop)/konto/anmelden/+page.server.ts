import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { localizePath } from '$lib/i18n.svelte';
import { burnPasswordTime, clearFailures, isRateLimited, registerFailure, verifyPassword } from '$lib/server/auth';
import { createCustomerSession, createCustomerToken, isEmail, normalizeEmail, safeTarget } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { accountLinkMail } from '$lib/server/emails';
import { checked } from '$lib/server/guard';
import { queueMail } from '$lib/server/mail';
import { shopUrl } from '$lib/server/urls';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.customer) redirect(303, localizePath(safeTarget(url.searchParams.get('weiter')), locals.locale));
	return { weiter: safeTarget(url.searchParams.get('weiter')), hinweis: url.searchParams.get('hinweis') };
};

export const actions: Actions = {
	passwort: async ({ request, cookies, locals, url, getClientAddress }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const form = await request.formData();
		const email = normalizeEmail(String(form.get('email') ?? ''));
		const password = String(form.get('passwort') ?? '').slice(0, 300);
		const ipKey = `kunde-login:${getClientAddress()}`;
		const userKey = `kunde:${email}`;
		if (isRateLimited(ipKey, 15) || isRateLimited(userKey, 8)) return fail(429, { email, error: L('Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.', 'Too many attempts. Please try again in 15 minutes.') });

		const c = await db.select().from(customers).where(eq(customers.email, email)).get();
		const ok = c?.passwordHash && c.active ? await verifyPassword(c.passwordHash, password) : (await burnPasswordTime(password), false);
		if (!c || !ok) {
			registerFailure(ipKey);
			registerFailure(userKey);
			return fail(400, { email, error: L('E-Mail oder Passwort stimmt nicht. Du kannst dir auch einen Anmelde-Link schicken lassen.', 'Email or password is incorrect. You can also request a login link.') });
		}
		if (!c.emailVerifiedAt) {
			const token = await createCustomerToken(email, 'verify', c.id);
			queueMail(email, accountLinkMail('verify', shopUrl(`/konto/bestaetigen/${token}`, c.locale), locals.locale), { template: 'konto' });
			return fail(400, { email, error: L('Bitte bestätige zuerst deine E-Mail-Adresse – wir haben dir den Link gerade nochmal geschickt.', "Please confirm your email address first – we've just sent you the link again.") });
		}
		clearFailures(userKey);
		await createCustomerSession(cookies, c.id, checked(form.get('merken')));
		redirect(303, localizePath(safeTarget(url.searchParams.get('weiter')), locals.locale));
	},

	link: async ({ request, locals, url, getClientAddress }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const email = normalizeEmail(String((await request.formData()).get('email') ?? ''));
		if (!isEmail(email)) return fail(400, { email, linkError: L('Bitte eine gültige E-Mail-Adresse eingeben.', 'Please enter a valid email address.') });
		const key = `kunde-link:${getClientAddress()}`;
		if (isRateLimited(key, 6, 60 * 60_000)) return fail(429, { email, linkError: L('Zu viele Anfragen. Bitte später erneut versuchen.', 'Too many requests. Please try again later.') });
		registerFailure(key, 60 * 60_000);
		const c = await db.select().from(customers).where(eq(customers.email, email)).get();
		if (!c || c.active) {
			const token = await createCustomerToken(email, 'login', c?.id ?? null);
			const weiter = safeTarget(url.searchParams.get('weiter'));
			queueMail(email, accountLinkMail('login', `${shopUrl(`/konto/anmeldelink/${token}`, locals.locale)}${weiter !== '/konto' ? `?weiter=${encodeURIComponent(weiter)}` : ''}`, locals.locale), { template: 'konto' });
		}
		// Gleiche Antwort, egal ob es ein Konto gibt
		return { linkSent: email };
	}
};
