import { eq } from 'drizzle-orm';
import type { Locale } from '$lib/shop-types';
import { db } from '../db';
import { payments, type Order, type Payment } from '../db/schema';
import { getSecrets } from '../secrets';
import { getSettings } from '../settings';
import { shopUrl } from '../urls';
import { PaymentError, type StartResult } from './index';

/**
 * PayPal über die REST-API (Orders v2): Bestellung anlegen → Kunde bestätigt
 * bei PayPal → beim Rücksprung wird der Betrag eingezogen („capture“).
 * Zugangsdaten: developer.paypal.com → Apps & Credentials (Client-ID + Secret).
 */

async function base() {
	const s = await getSettings();
	return s.payments.paypal.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
}

let token: { key: string; value: string; until: number } | null = null;

async function accessToken(): Promise<string> {
	const { paypalClientId, paypalSecret } = await getSecrets();
	if (!paypalClientId || !paypalSecret) throw new PaymentError('PayPal ist nicht eingerichtet.');
	const key = `${await base()}|${paypalClientId}`;
	if (token && token.key === key && token.until > Date.now() + 60_000) return token.value;
	const res = await fetch(`${await base()}/v1/oauth2/token`, {
		method: 'POST',
		headers: { Authorization: `Basic ${Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
		body: 'grant_type=client_credentials',
		signal: AbortSignal.timeout(20_000)
	});
	if (!res.ok) throw new PaymentError(`PayPal-Anmeldung fehlgeschlagen (${res.status}).`);
	const data = (await res.json()) as { access_token: string; expires_in: number };
	token = { key, value: data.access_token, until: Date.now() + data.expires_in * 1000 };
	return token.value;
}

async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string }): Promise<{ status: number; data: T }> {
	const res = await fetch(`${await base()}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${await accessToken()}`,
			'Content-Type': 'application/json',
			...(init.idempotencyKey ? { 'PayPal-Request-Id': init.idempotencyKey } : {})
		},
		signal: AbortSignal.timeout(25_000)
	});
	const data = (await res.json().catch(() => ({}))) as T;
	return { status: res.status, data };
}

const amount = (cents: number) => (cents / 100).toFixed(2);

export async function paypalStart(payment: Payment, order: Order, locale: Locale): Promise<StartResult> {
	const s = await getSettings();
	const back = shopUrl(`/zahlung/${payment.token}`, locale);
	const description = payment.purpose === 'restzahlung' ? `Restzahlung Bestellung ${order.number}` : `Bestellung ${order.number}`;
	const { status, data } = await api<{ id?: string; links?: { rel: string; href: string }[]; message?: string }>('/v2/checkout/orders', {
		method: 'POST',
		idempotencyKey: `byb-${payment.id}-${payment.token.slice(0, 8)}`,
		body: JSON.stringify({
			intent: 'CAPTURE',
			purchase_units: [{ reference_id: String(payment.id), invoice_id: `${order.number}-${payment.id}`, description, amount: { currency_code: 'EUR', value: amount(payment.amount) } }],
			payment_source: {
				paypal: {
					experience_context: {
						brand_name: s.company.brand.slice(0, 127),
						locale: locale === 'en' ? 'en-GB' : 'de-AT',
						user_action: 'PAY_NOW',
						shipping_preference: 'NO_SHIPPING',
						return_url: `${back}?rueckkehr=1`,
						cancel_url: `${back}?abgebrochen=1`
					}
				}
			}
		})
	});
	const link = data.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
	if (status >= 300 || !data.id || !link) throw new PaymentError(`PayPal: ${data.message ?? `Fehler ${status}`}`);
	await db.update(payments).set({ providerRef: data.id, method: 'paypal' }).where(eq(payments.id, payment.id));
	return { redirect: link, providerRef: data.id };
}

export async function paypalCapture(payment: Payment, query: URLSearchParams): Promise<'bezahlt' | 'offen' | 'fehlgeschlagen'> {
	const id = query.get('token') ?? payment.providerRef;
	if (!id || id !== payment.providerRef) return 'offen';
	const { status, data } = await api<{ status?: string; details?: { issue: string }[]; purchase_units?: { payments?: { captures?: { status: string; amount: { value: string } }[] } }[] }>(
		`/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
		{ method: 'POST', idempotencyKey: `byb-capture-${payment.id}` }
	);
	const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
	if ((status === 201 || status === 200) && data.status === 'COMPLETED' && capture?.status === 'COMPLETED' && capture.amount.value === amount(payment.amount)) return 'bezahlt';
	// Schon eingezogen (Seite neu geladen)
	if (status === 422 && data.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) {
		const check = await api<{ status?: string }>(`/v2/checkout/orders/${encodeURIComponent(id)}`, { method: 'GET' });
		return check.data.status === 'COMPLETED' ? 'bezahlt' : 'offen';
	}
	if (capture?.status === 'PENDING') return 'offen';
	return 'fehlgeschlagen';
}
