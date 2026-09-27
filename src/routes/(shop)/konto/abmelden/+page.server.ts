import { redirect } from '@sveltejs/kit';
import { localizePath } from '$lib/i18n.svelte';
import { endCustomerSession } from '$lib/server/customer-auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	redirect(303, localizePath('/konto', locals.locale));
};

export const actions: Actions = {
	default: async ({ cookies, locals }) => {
		await endCustomerSession(cookies);
		redirect(303, localizePath('/', locals.locale));
	}
};
