import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import type { Locale } from '$lib/shop-types';
import { db } from '../db';
import { payments, type Order, type Payment } from '../db/schema';
import { getSecrets } from '../secrets';
import { shopUrl } from '../urls';
import { PaymentError, type StartResult } from './index';

/**
 * Stripe Checkout: der Kunde zahlt auf der Bezahlseite von Stripe. Welche
 * Zahlungsarten dort erscheinen (Karte, Apple/Google Pay, EPS, Klarna, SEPA …),
 * wird im Stripe-Dashboard unter „Zahlungsmethoden“ eingestellt – hier ist
 * nichts festgelegt. Bestätigt wird über den Webhook /api/zahlung/stripe und
 * zusätzlich beim Rücksprung.
 */

let client: { key: string; stripe: Stripe } | null = null;

export async function stripeClient(): Promise<Stripe> {
	const { stripeSecretKey } = await getSecrets();
	if (!stripeSecretKey) throw new PaymentError('Stripe ist nicht eingerichtet.');
	if (!client || client.key !== stripeSecretKey) client = { key: stripeSecretKey, stripe: new Stripe(stripeSecretKey, { maxNetworkRetries: 2, timeout: 20_000 }) };
	return client.stripe;
}

export async function stripeStart(payment: Payment, order: Order, locale: Locale): Promise<StartResult> {
	const stripe = await stripeClient();
	const title = payment.purpose === 'restzahlung' ? (locale === 'en' ? `Remaining payment, order ${order.number}` : `Restzahlung Bestellung ${order.number}`) : locale === 'en' ? `Order ${order.number}` : `Bestellung ${order.number}`;
	const back = shopUrl(`/zahlung/${payment.token}`, locale);
	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: payment.amount, product_data: { name: title } } }],
		customer_email: order.email,
		client_reference_id: String(payment.id),
		metadata: { paymentId: String(payment.id), orderNumber: String(order.number) },
		payment_intent_data: { description: title, metadata: { paymentId: String(payment.id), orderNumber: String(order.number) } },
		locale: locale === 'en' ? 'en' : 'de',
		success_url: `${back}?rueckkehr=1&session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${back}?abgebrochen=1`,
		expires_at: Math.floor(Date.now() / 1000) + 23 * 3600
	});
	if (!session.url) throw new PaymentError('Stripe hat keine Bezahlseite geliefert.');
	await db.update(payments).set({ providerRef: session.id, method: 'stripe' }).where(eq(payments.id, payment.id));
	return { redirect: session.url, providerRef: session.id };
}

export async function stripeConfirm(payment: Payment, query: URLSearchParams): Promise<'bezahlt' | 'offen' | 'fehlgeschlagen'> {
	const id = query.get('session_id') ?? payment.providerRef;
	if (!id || !id.startsWith('cs_')) return 'offen';
	const stripe = await stripeClient();
	const session = await stripe.checkout.sessions.retrieve(id);
	if (session.client_reference_id !== String(payment.id)) return 'offen';
	if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'bezahlt';
	if (session.status === 'expired') return 'fehlgeschlagen';
	// z. B. SEPA-Lastschrift: Bestätigung kommt später per Webhook
	return 'offen';
}
