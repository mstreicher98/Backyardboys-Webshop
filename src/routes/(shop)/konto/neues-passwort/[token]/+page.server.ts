import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { localizePath } from '$lib/i18n.svelte';
import { hashPassword, passwordProblem } from '$lib/server/auth';
import { consumeCustomerToken, createCustomerSession, endAllCustomerSessions, markEmailVerified, peekCustomerToken } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	return { valid: !!(await peekCustomerToken(params.token, 'reset')) };
};

export const actions: Actions = {
	default: async ({ params, request, cookies, locals }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const form = await request.formData();
		const password = String(form.get('passwort') ?? '');
		const problem = passwordProblem(password, String(form.get('passwort2') ?? ''));
		if (problem) return fail(400, { error: locals.locale === 'en' ? 'At least 10 characters, and both entries must match.' : problem });
		const t = await consumeCustomerToken(params.token, 'reset');
		if (!t?.customerId) return fail(400, { error: L('Der Link ist abgelaufen. Bitte fordere einen neuen an.', 'The link has expired. Please request a new one.') });
		await db.update(customers).set({ passwordHash: await hashPassword(password) }).where(eq(customers.id, t.customerId));
		await endAllCustomerSessions(t.customerId);
		await markEmailVerified(t.customerId, t.email);
		await createCustomerSession(cookies, t.customerId, false);
		redirect(303, localizePath('/konto', locals.locale));
	}
};
