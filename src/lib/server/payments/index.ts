import type { Locale } from '$lib/shop-types';
import type { Order, Payment } from '../db/schema';
import { getSettings } from '../settings';
import { paypalCapture, paypalStart } from './paypal';
import { stripeConfirm, stripeStart } from './stripe';

/**
 * Zahlungsarten als austauschbare Bausteine. Jede Online-Zahlungsart liefert
 *   start()   → Adresse, auf die der Kunde weitergeleitet wird
 *   confirm() → nach der Rückkehr prüfen, ob bezahlt wurde
 * Überweisung und Barzahlung brauchen nichts davon – das Team bestätigt den
 * Eingang im Admin. Eine neue Zahlungsart = neue Datei + Eintrag hier.
 */

export interface StartResult {
	redirect: string;
	providerRef: string;
}

export interface Provider {
	id: string;
	online: boolean;
	start?: (payment: Payment, order: Order, locale: Locale) => Promise<StartResult>;
	/** true = bezahlt; query enthält die Rücksprung-Parameter des Anbieters */
	confirm?: (payment: Payment, query: URLSearchParams) => Promise<'bezahlt' | 'offen' | 'fehlgeschlagen'>;
}

export const PROVIDERS: Record<string, Provider> = {
	stripe: { id: 'stripe', online: true, start: stripeStart, confirm: stripeConfirm },
	paypal: { id: 'paypal', online: true, start: paypalStart, confirm: paypalCapture },
	ueberweisung: { id: 'ueberweisung', online: false },
	bar: { id: 'bar', online: false }
};

/** Zahlungsarten für eine Restzahlung (Abholung spielt dabei keine Rolle) */
export async function methodsForPaymentLink(): Promise<string[]> {
	const s = await getSettings();
	const out: string[] = [];
	if (s.payments.stripe.enabled) out.push('stripe');
	if (s.payments.paypal.enabled) out.push('paypal');
	if (s.payments.transfer.enabled) out.push('ueberweisung');
	return out;
}

export class PaymentError extends Error {}
