import { requireCustomer } from '$lib/server/customer-auth';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { orders } from '$lib/server/db/schema';
import { cartIdFrom } from '$lib/server/shop/cart';
import { customerOrderAction, customerOrderView } from '$lib/server/shop/order-view';
import type { Actions, PageServerLoad } from './$types';

async function ownOrder(customerId: number, number: string) {
	const n = Number(number);
	if (!Number.isInteger(n)) return null;
	return db
		.select()
		.from(orders)
		.where(and(eq(orders.number, n), eq(orders.customerId, customerId)))
		.get();
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const order = await ownOrder(requireCustomer(locals).id, params.nummer);
	if (!order) error(404, locals.locale === 'en' ? 'Order not found.' : 'Bestellung nicht gefunden.');
	return customerOrderView(order, locals.locale);
};

export const actions: Actions = {
	default: async ({ params, request, locals, cookies }) => {
		if (!locals.customer) error(401);
		const order = await ownOrder(locals.customer.id, params.nummer);
		if (!order) error(404);
		return customerOrderAction(order, await request.formData(), locals.locale, await cartIdFrom(cookies, false));
	}
};
