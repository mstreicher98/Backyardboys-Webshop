import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { orders, payments } from '$lib/server/db/schema';
import { stripeClient } from '$lib/server/payments/stripe';
import { getSecrets } from '$lib/server/secrets';
import { cancelOrder, markPaymentPaid } from '$lib/server/shop/orders';
import type { RequestHandler } from './$types';

/**
 * Stripe-Webhook. Im Stripe-Dashboard unter Entwickler → Webhooks anlegen:
 *   URL:       https://shop.backyardboys.at/api/zahlung/stripe
 *   Ereignisse: checkout.session.completed, checkout.session.async_payment_succeeded,
 *              checkout.session.async_payment_failed, checkout.session.expired
 * Das Signing Secret (whsec_…) im Admin unter Einstellungen → Zahlung eintragen.
 */
export const POST: RequestHandler = async ({ request }) => {
	const { stripeWebhookSecret } = await getSecrets();
	if (!stripeWebhookSecret) error(503, 'Webhook nicht eingerichtet');
	const signature = request.headers.get('stripe-signature');
	if (!signature) error(400, 'Signatur fehlt');
	const body = await request.text();
	let event: Stripe.Event;
	try {
		const stripe = await stripeClient();
		event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
	} catch {
		error(400, 'Signatur ungültig');
	}

	if (event.type.startsWith('checkout.session.')) {
		const session = event.data.object as Stripe.Checkout.Session;
		const paymentId = Number(session.client_reference_id ?? session.metadata?.paymentId);
		const payment = paymentId ? await db.select().from(payments).where(eq(payments.id, paymentId)).get() : null;
		if (payment && (payment.providerRef === session.id || !payment.providerRef)) {
			switch (event.type) {
				case 'checkout.session.completed':
				case 'checkout.session.async_payment_succeeded':
					if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') await markPaymentPaid(payment.id, session.id);
					break;
				case 'checkout.session.async_payment_failed':
					await db.update(payments).set({ status: 'fehlgeschlagen' }).where(eq(payments.id, payment.id));
					break;
				case 'checkout.session.expired': {
					// Bezahlseite abgelaufen → Bestellung stornieren (Lager wird freigegeben)
					if (payment.status === 'offen' && payment.purpose === 'bestellung') {
						const order = await db.select().from(orders).where(eq(orders.id, payment.orderId)).get();
						if (order?.status === 'zahlung_offen' && order.paymentMethod === 'stripe') await cancelOrder(order.id, '', false);
					}
					break;
				}
			}
		}
	}
	return json({ received: true });
};
