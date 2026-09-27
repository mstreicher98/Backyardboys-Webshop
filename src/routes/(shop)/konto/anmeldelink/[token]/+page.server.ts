import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { localizePath } from '$lib/i18n.svelte';
import { consumeCustomerToken, createCustomerSession, markEmailVerified, peekCustomerToken, safeTarget } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { customers, orders } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

/**
 * Anmelden per Link. Der Link wird erst mit dem Klick auf den Knopf
 * eingelöst – E-Mail-Programme, die Links vorab öffnen, verbrauchen ihn so nicht.
 * Gibt es noch kein Konto, aber Bestellungen mit dieser Adresse, wird es jetzt angelegt.
 */
export const load: PageServerLoad = async ({ params }) => {
	const t = await peekCustomerToken(params.token, 'login');
	return { valid: !!t, email: t?.email ?? null };
};

export const actions: Actions = {
	default: async ({ params, cookies, locals, url }) => {
		const t = await consumeCustomerToken(params.token, 'login');
		if (!t) redirect(303, `${localizePath('/konto/anmelden', locals.locale)}?hinweis=link_ungueltig`);
		let customer = await db.select().from(customers).where(eq(customers.email, t.email)).get();
		if (!customer) {
			const last = await db.select().from(orders).where(eq(orders.email, t.email)).get();
			customer = await db
				.insert(customers)
				.values({
					email: t.email,
					firstName: last?.billingAddress.firstName ?? '',
					lastName: last?.billingAddress.lastName ?? '',
					phone: last?.phone ?? '',
					company: last?.billingAddress.company ?? '',
					locale: locals.locale
				})
				.returning()
				.get();
		}
		if (!customer.active) redirect(303, localizePath('/konto/anmelden', locals.locale));
		await markEmailVerified(customer.id, t.email);
		await createCustomerSession(cookies, customer.id, true);
		redirect(303, localizePath(safeTarget(url.searchParams.get('weiter')), locals.locale));
	}
};
