import { json } from '@sveltejs/kit';
import { localeFromPath } from '$lib/i18n.svelte';
import { getSettings } from '$lib/server/settings';
import { cartIdFrom, loadCart } from '$lib/server/shop/cart';
import { vatIdStatus } from '$lib/server/shop/checkout';
import type { RequestHandler } from './$types';

/** Summen für die Kasse neu berechnen (Land, Versand/Abholung, UID) */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const body = (await request.json().catch(() => ({}))) as { country?: string; billingCountry?: string; method?: string; vatId?: string; locale?: string; email?: string };
	const locale = body.locale === 'en' ? 'en' : localeFromPath('/');
	const cartId = await cartIdFrom(cookies, false);
	const s = await getSettings();
	const billingCountry = String(body.billingCountry ?? body.country ?? 'AT').toUpperCase();
	const vat = body.vatId ? await vatIdStatus(String(body.vatId), billingCountry) : { vatId: '', valid: false, checked: false };
	const cart = await loadCart(cartId, {
		customer: locals.customer,
		locale,
		settings: s,
		country: String(body.country ?? 'AT').toUpperCase(),
		shippingMethod: body.method === 'abholung' ? 'abholung' : 'versand',
		validVatId: vat.valid,
		email: body.email ?? null
	});
	return json({ totals: cart.totals, country: cart.country, vat, discountMessage: cart.discountMessage });
};
