import { fail, redirect } from '@sveltejs/kit';
import { asc, desc, eq } from 'drizzle-orm';
import { localizePath, pick } from '$lib/i18n.svelte';
import type { AddressSnapshot } from '$lib/shop-types';
import { checked, str } from '$lib/server/guard';
import { createCustomerToken, isEmail, normalizeEmail } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { addresses, customers, shippingCountries } from '$lib/server/db/schema';
import { accountLinkMail } from '$lib/server/emails';
import { queueMail } from '$lib/server/mail';
import { PROVIDERS, PaymentError } from '$lib/server/payments';
import { getSettings } from '$lib/server/settings';
import { activeCountries, cartIdFrom, loadCart } from '$lib/server/shop/cart';
import { customerDefaults, vatIdStatus } from '$lib/server/shop/checkout';
import { allowedPaymentMethods, CheckoutError, PAYMENT_LABELS, placeOrder } from '$lib/server/shop/orders';
import { shopUrl } from '$lib/server/urls';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const locale = locals.locale;
	const s = await getSettings();
	const cartId = await cartIdFrom(cookies, false);
	const saved = locals.customer
		? await db.select().from(addresses).where(eq(addresses.customerId, locals.customer.id)).orderBy(desc(addresses.isDefault), asc(addresses.id)).all()
		: [];
	const def = saved[0];
	const cart = await loadCart(cartId, { customer: locals.customer, locale, settings: s, country: def?.country, validVatId: locals.customer?.vatIdValid === true && def?.country !== 'AT' });
	if (!cart.lines.length) redirect(303, localizePath('/warenkorb', locale));
	const [ship, all] = await Promise.all([activeCountries(), db.select().from(shippingCountries).orderBy(asc(shippingCountries.sortOrder)).all()]);
	return {
		view: cart,
		shipCountries: ship.map((c) => ({ code: c.code, name: pick(locale, c.name, c.nameEn) })),
		billCountries: all.map((c) => ({ code: c.code, name: pick(locale, c.name, c.nameEn) })),
		payments: {
			versand: allowedPaymentMethods(s, false).map((m) => ({ id: m, label: PAYMENT_LABELS[m][locale] })),
			abholung: allowedPaymentMethods(s, true).map((m) => ({ id: m, label: PAYMENT_LABELS[m][locale] }))
		},
		pickup: s.pickup.enabled ? { address: s.pickup.address, note: pick(locale, s.pickup.note, s.pickup.noteEn) } : null,
		transferDays: s.orders.transferDays,
		taxMode: s.tax.mode,
		defaults: customerDefaults(locals.customer),
		addresses: saved.map((a) => ({ id: a.id, firstName: a.firstName, lastName: a.lastName, company: a.company, street: a.street, zip: a.zip, city: a.city, country: a.country, phone: a.phone })),
		loggedIn: !!locals.customer
	};
};

function address(form: FormData, prefix: string): AddressSnapshot {
	return {
		firstName: str(form.get(`${prefix}_vorname`), 80),
		lastName: str(form.get(`${prefix}_nachname`), 80),
		company: str(form.get(`${prefix}_firma`), 120),
		street: str(form.get(`${prefix}_strasse`), 150),
		zip: str(form.get(`${prefix}_plz`), 12),
		city: str(form.get(`${prefix}_ort`), 80),
		country: str(form.get(`${prefix}_land`), 2).toUpperCase(),
		phone: ''
	};
}

function missing(a: AddressSnapshot, prefix: string): string[] {
	const out: string[] = [];
	if (!a.firstName) out.push(`${prefix}_vorname`);
	if (!a.lastName) out.push(`${prefix}_nachname`);
	if (!a.street) out.push(`${prefix}_strasse`);
	if (!a.zip) out.push(`${prefix}_plz`);
	if (!a.city) out.push(`${prefix}_ort`);
	if (!/^[A-Z]{2}$/.test(a.country)) out.push(`${prefix}_land`);
	return out;
}

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const locale = locals.locale;
		const L = (de: string, en: string) => (locale === 'en' ? en : de);
		const cartId = await cartIdFrom(cookies, false);
		if (!cartId) redirect(303, localizePath('/warenkorb', locale));
		const form = await request.formData();

		const email = locals.customer ? locals.customer.email : normalizeEmail(str(form.get('email'), 200));
		const phone = str(form.get('telefon'), 40);
		const billing = address(form, 'rg');
		billing.phone = phone;
		const method = form.get('lieferung') === 'abholung' ? 'abholung' : 'versand';
		const separate = checked(form.get('andere_lieferadresse'));
		const shipping = method === 'versand' && separate ? { ...address(form, 'lf'), phone } : null;
		const asCompany = checked(form.get('firma_bestellung'));
		const vatInput = asCompany ? str(form.get('uid'), 20) : '';
		const payment = str(form.get('zahlung'), 20);
		const note = str(form.get('anmerkung'), 1000);

		const invalid = [...missing(billing, 'rg'), ...(shipping ? missing(shipping, 'lf') : [])];
		if (!isEmail(email)) invalid.push('email');
		if (!checked(form.get('agb'))) invalid.push('agb');
		const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
		if (invalid.length) {
			return fail(400, {
				values,
				invalid,
				error: invalid.includes('agb') && invalid.length === 1 ? L('Bitte bestätige die AGB.', 'Please accept the terms and conditions.') : L('Bitte fülle die markierten Felder aus.', 'Please fill in the marked fields.')
			});
		}

		const vat = vatInput ? await vatIdStatus(vatInput, billing.country) : { vatId: '', valid: false, checked: false };
		let result;
		try {
			result = await placeOrder({
				cartId,
				customer: locals.customer,
				locale,
				email,
				phone,
				billing,
				shipping,
				shippingMethod: method,
				paymentMethod: payment,
				vatId: vat.vatId,
				validVatId: vat.valid,
				customerNote: note
			});
		} catch (err) {
			if (err instanceof CheckoutError) return fail(400, { values, invalid: err.field ? [err.field] : [], error: err.message });
			throw err;
		}
		const { order, payment: pay } = result;

		// Adresse fürs nächste Mal merken
		if (locals.customer && checked(form.get('adresse_speichern'))) {
			const has = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.customerId, locals.customer.id)).get();
			await db.insert(addresses).values({ customerId: locals.customer.id, ...billing, isDefault: !has });
		}
		// Kundenkonto gleich mit anlegen: Bestätigungslink per Mail
		if (!locals.customer && checked(form.get('konto_anlegen'))) {
			const exists = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).get();
			const customer =
				exists ??
				(await db
					.insert(customers)
					.values({ email, firstName: billing.firstName, lastName: billing.lastName, phone, company: billing.company, vatId: vat.vatId, locale })
					.returning({ id: customers.id })
					.get());
			const token = await createCustomerToken(email, 'verify', customer.id);
			queueMail(email, accountLinkMail('verify', shopUrl(`/konto/bestaetigen/${token}`, locale), locale), { template: 'konto' });
		}

		const target = localizePath(`/bestellung/${order.token}`, locale);
		const provider = pay ? PROVIDERS[pay.method] : null;
		if (pay && provider?.start) {
			try {
				const { redirect: url } = await provider.start(pay, order, locale);
				return { redirect: url };
			} catch (err) {
				console.error('[zahlung]', err);
				return { redirect: `${target}?zahlungsfehler=${err instanceof PaymentError ? 'einrichtung' : '1'}` };
			}
		}
		return { redirect: target };
	}
};
