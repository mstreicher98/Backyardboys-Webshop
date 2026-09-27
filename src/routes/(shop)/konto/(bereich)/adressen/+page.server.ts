import { requireCustomer } from '$lib/server/customer-auth';
import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import { db } from '$lib/server/db';
import { addresses, shippingCountries } from '$lib/server/db/schema';
import { str } from '$lib/server/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [list, countries] = await Promise.all([
		db.select().from(addresses).where(eq(addresses.customerId, requireCustomer(locals).id)).orderBy(desc(addresses.isDefault), asc(addresses.id)).all(),
		db.select().from(shippingCountries).orderBy(asc(shippingCountries.sortOrder)).all()
	]);
	return { addresses: list, countries: countries.map((c) => ({ code: c.code, name: pick(locals.locale, c.name, c.nameEn) })) };
};

function read(form: FormData) {
	return {
		firstName: str(form.get('vorname'), 80),
		lastName: str(form.get('nachname'), 80),
		company: str(form.get('firma'), 120),
		street: str(form.get('strasse'), 150),
		zip: str(form.get('plz'), 12),
		city: str(form.get('ort'), 80),
		country: str(form.get('land'), 2).toUpperCase(),
		phone: str(form.get('telefon'), 40)
	};
}

export const actions: Actions = {
	speichern: async ({ request, locals }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const cid = requireCustomer(locals).id;
		const form = await request.formData();
		const a = read(form);
		if (!a.firstName || !a.lastName || !a.street || !a.zip || !a.city || !/^[A-Z]{2}$/.test(a.country)) return fail(400, { error: L('Bitte alle Pflichtfelder ausfüllen.', 'Please fill in all required fields.') });
		const id = Number(form.get('id')) || null;
		const count = (await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.customerId, cid)).all()).length;
		if (id) await db.update(addresses).set(a).where(and(eq(addresses.id, id), eq(addresses.customerId, cid)));
		else {
			if (count >= 20) return fail(400, { error: L('Höchstens 20 Adressen.', 'At most 20 addresses.') });
			await db.insert(addresses).values({ ...a, customerId: cid, isDefault: count === 0 });
		}
		return { ok: L('Adresse gespeichert.', 'Address saved.') };
	},
	standard: async ({ request, locals }) => {
		const cid = requireCustomer(locals).id;
		const id = Number((await request.formData()).get('id'));
		await db.update(addresses).set({ isDefault: false }).where(eq(addresses.customerId, cid));
		await db.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, id), eq(addresses.customerId, cid)));
	},
	loeschen: async ({ request, locals }) => {
		const cid = requireCustomer(locals).id;
		const id = Number((await request.formData()).get('id'));
		await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.customerId, cid)));
	}
};
