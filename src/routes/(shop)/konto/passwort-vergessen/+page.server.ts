import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { isRateLimited, registerFailure } from '$lib/server/auth';
import { createCustomerToken, isEmail, normalizeEmail } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { accountLinkMail } from '$lib/server/emails';
import { queueMail } from '$lib/server/mail';
import { shopUrl } from '$lib/server/urls';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const email = normalizeEmail(String((await request.formData()).get('email') ?? ''));
		if (!isEmail(email)) return fail(400, { error: L('Bitte eine gültige E-Mail-Adresse eingeben.', 'Please enter a valid email address.') });
		const key = `reset:${getClientAddress()}`;
		if (isRateLimited(key, 5, 60 * 60_000)) return fail(429, { error: L('Zu viele Anfragen. Bitte später erneut versuchen.', 'Too many requests. Please try again later.') });
		registerFailure(key, 60 * 60_000);
		const c = await db.select().from(customers).where(eq(customers.email, email)).get();
		if (c?.active) {
			const token = await createCustomerToken(email, 'reset', c.id);
			queueMail(email, accountLinkMail('reset', shopUrl(`/konto/neues-passwort/${token}`, c.locale), locals.locale), { template: 'konto' });
		}
		return { sent: email };
	}
};
