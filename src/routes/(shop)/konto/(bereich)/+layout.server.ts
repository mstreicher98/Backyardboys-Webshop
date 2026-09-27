import { redirect } from '@sveltejs/kit';
import { delocalizePath, localizePath } from '$lib/i18n.svelte';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.customer) {
		const weiter = delocalizePath(url.pathname);
		redirect(303, `${localizePath('/konto/anmelden', locals.locale)}${weiter !== '/konto' ? `?weiter=${encodeURIComponent(weiter)}` : ''}`);
	}
	const c = locals.customer;
	return { me: { firstName: c.firstName, lastName: c.lastName, email: c.email, dealerStatus: c.dealerStatus } };
};
