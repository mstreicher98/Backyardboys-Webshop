import { redirect } from '@sveltejs/kit';
import { localizePath } from '$lib/i18n.svelte';
import { consumeCustomerToken, createCustomerSession, markEmailVerified, peekCustomerToken } from '$lib/server/customer-auth';
import type { Actions, PageServerLoad } from './$types';

/** Link aus der Bestätigungsmail – eingelöst erst mit dem Knopf (siehe anmeldelink) */
export const load: PageServerLoad = async ({ params }) => {
	const t = await peekCustomerToken(params.token, 'verify');
	return { valid: !!t, email: t?.email ?? null };
};

export const actions: Actions = {
	default: async ({ params, cookies, locals }) => {
		const t = await consumeCustomerToken(params.token, 'verify');
		if (!t?.customerId) redirect(303, `${localizePath('/konto/anmelden', locals.locale)}?hinweis=link_ungueltig`);
		await markEmailVerified(t.customerId, t.email);
		await createCustomerSession(cookies, t.customerId, false);
		redirect(303, `${localizePath('/konto', locals.locale)}?willkommen=1`);
	}
};
