import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { localizePath } from '$lib/i18n.svelte';
import { bikeCatalog, bikeFromCookie } from '$lib/server/shop/catalog';
import type { Actions, PageServerLoad } from './$types';

const COOKIE = 'byb_bike';

export const load: PageServerLoad = async ({ cookies }) => {
	const bike = await bikeFromCookie(cookies.get(COOKIE));
	return { catalog: await bikeCatalog(), current: bike ? { modelId: bike.modelId, year: bike.year } : null };
};

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const modelId = Number(form.get('modell'));
		const year = String(form.get('jahr') ?? '');
		if (Number.isInteger(modelId) && modelId > 0) {
			cookies.set(COOKIE, `${modelId}:${/^\d{4}$/.test(year) ? year : ''}`, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: 365 * 86400 });
		}
		redirect(303, localizePath('/produkte', locals.locale));
	},
	vergessen: async ({ cookies, locals }) => {
		cookies.delete(COOKIE, { path: '/' });
		redirect(303, localizePath('/bike-finder', locals.locale));
	}
};
