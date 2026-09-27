import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { orders, payments, type Payment } from '$lib/server/db/schema';
import { methodsForPaymentLink, PROVIDERS, PaymentError } from '$lib/server/payments';
import { getSettings } from '$lib/server/settings';
import { markPaymentPaid, PAYMENT_LABELS } from '$lib/server/shop/orders';
import type { Actions, PageServerLoad } from './$types';

async function paymentByToken(token: string): Promise<Payment | null> {
	if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
	return (await db.select().from(payments).where(eq(payments.token, token)).get()) ?? null;
}

/**
 * Zahlungsseite: Rücksprung von Stripe/PayPal, erneuter Versuch und
 * Restzahlung für Full-Custom-Dekore (Link aus der E-Mail).
 */
export const load: PageServerLoad = async ({ params, url, locals }) => {
	const locale = locals.locale;
	let payment = await paymentByToken(params.token);
	if (!payment) error(404, locale === 'en' ? 'Payment not found.' : 'Zahlung nicht gefunden.');
	const order = (await db.select().from(orders).where(eq(orders.id, payment.orderId)).get())!;

	let state: 'bezahlt' | 'offen' | 'fehlgeschlagen' | 'abgebrochen' | 'pruefung' = payment.status === 'bezahlt' ? 'bezahlt' : 'offen';
	if (payment.status === 'offen' && url.searchParams.has('rueckkehr')) {
		const provider = PROVIDERS[payment.method];
		if (provider?.confirm) {
			try {
				const r = await provider.confirm(payment, url.searchParams);
				if (r === 'bezahlt') {
					await markPaymentPaid(payment.id, payment.providerRef);
					state = 'bezahlt';
				} else state = r === 'fehlgeschlagen' ? 'fehlgeschlagen' : 'pruefung';
			} catch (err) {
				console.error('[zahlung]', err);
				state = 'pruefung';
			}
		}
		payment = (await paymentByToken(params.token))!;
	}
	if (url.searchParams.has('abgebrochen') && payment.status !== 'bezahlt') state = 'abgebrochen';
	if (payment.status === 'abgebrochen' || order.status === 'storniert') state = 'abgebrochen';

	const s = await getSettings();
	const methods = await methodsForPaymentLink();
	return {
		state,
		cancelled: order.status === 'storniert' || payment.status === 'abgebrochen' || payment.status === 'erstattet',
		payment: { amount: payment.amount, purpose: payment.purpose, method: payment.method, status: payment.status },
		order: { number: order.number, token: order.token },
		methods: methods.map((m) => ({ id: m, label: PAYMENT_LABELS[m][locale] })),
		bank: payment.method === 'ueberweisung' ? { name: s.company.name, iban: s.company.iban, bic: s.company.bic, days: s.orders.transferDays } : null
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const locale = locals.locale;
		const L = (de: string, en: string) => (locale === 'en' ? en : de);
		const payment = await paymentByToken(params.token);
		if (!payment) error(404);
		const order = (await db.select().from(orders).where(eq(orders.id, payment.orderId)).get())!;
		if (payment.status !== 'offen' || order.status === 'storniert') return fail(400, { error: L('Diese Zahlung ist nicht mehr offen.', 'This payment is no longer open.') });
		const method = String((await request.formData()).get('zahlung') ?? '');
		if (!(await methodsForPaymentLink()).includes(method)) return fail(400, { error: L('Bitte eine Zahlungsart wählen.', 'Please choose a payment method.') });

		await db.update(payments).set({ method }).where(eq(payments.id, payment.id));
		if (payment.purpose === 'bestellung') await db.update(orders).set({ paymentMethod: method }).where(eq(orders.id, order.id));
		const provider = PROVIDERS[method];
		if (provider?.start) {
			try {
				const { redirect: url } = await provider.start({ ...payment, method }, order, locale);
				return { redirect: url };
			} catch (err) {
				console.error('[zahlung]', err);
				return fail(502, {
					error:
						err instanceof PaymentError
							? L('Diese Zahlungsart ist gerade nicht verfügbar. Bitte wähle eine andere.', 'This payment method is currently unavailable. Please choose another.')
							: L('Die Zahlung konnte nicht gestartet werden. Bitte erneut versuchen.', 'The payment could not be started. Please try again.')
				});
			}
		}
		return { ok: true };
	}
};
