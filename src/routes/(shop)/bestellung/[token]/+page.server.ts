import { error } from '@sveltejs/kit';
import { cartIdFrom } from '$lib/server/shop/cart';
import { customerOrderAction, customerOrderView, orderByToken } from '$lib/server/shop/order-view';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const order = await orderByToken(params.token);
	if (!order) error(404, locals.locale === 'en' ? 'Order not found.' : 'Bestellung nicht gefunden.');
	return { ...(await customerOrderView(order, locals.locale)), paymentError: url.searchParams.get('zahlungsfehler') };
};

export const actions: Actions = {
	default: async ({ params, request, locals, cookies }) => {
		const order = await orderByToken(params.token);
		if (!order) error(404);
		return customerOrderAction(order, await request.formData(), locals.locale, await cartIdFrom(cookies, false));
	}
};
