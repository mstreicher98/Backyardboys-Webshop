import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { AddressSnapshot, Locale, StockMove } from '$lib/shop-types';
import type { SessionCustomer } from '../customer-auth';
import { db, type Tx } from '../db';
import {
	cartItems,
	carts,
	dekorJobs,
	dekorProofs,
	discountCodes,
	discountRedemptions,
	files,
	giftCards,
	giftCardTransactions,
	invoices,
	messages,
	orderItems,
	orders,
	payments,
	variants,
	type Order,
	type OrderItem,
	type Payment
} from '../db/schema';
import { giftCardMail, orderCancelledMail, orderConfirmationMail, paymentReceivedMail, teamNewOrderMail, teamNoticeMail } from '../emails';
import { attachCartFiles, fileRef, type FileRef } from '../files';
import { queueMail } from '../mail';
import { notifyTeam } from '../notify';
import { getSettings } from '../settings';
import { nextNumber } from '../counters';
import { createInvoice, createStornoInvoices } from './invoices';
import { loadCart, type CartView } from './cart';
import { productLoader } from './catalog';

export class CheckoutError extends Error {
	constructor(
		message: string,
		public field: string | null = null
	) {
		super(message);
	}
}

export const PAYMENT_LABELS: Record<string, { de: string; en: string }> = {
	stripe: { de: 'Karte, EPS, Klarna & Co. (Stripe)', en: 'Card, EPS, Klarna & more (Stripe)' },
	paypal: { de: 'PayPal', en: 'PayPal' },
	ueberweisung: { de: 'Überweisung (Vorkasse)', en: 'Bank transfer (prepayment)' },
	bar: { de: 'Barzahlung bei Abholung', en: 'Cash on pickup' },
	gutschein: { de: 'Gutschein', en: 'Gift card' }
};

export const paymentLabel = (method: string, locale: Locale = 'de') => PAYMENT_LABELS[method]?.[locale] ?? method;

export const newToken = (bytes = 18) => randomBytes(bytes).toString('base64url');

/** Gutscheincode ohne verwechselbare Zeichen: BYB-7KQ4-M2XP */
export function giftCardCode(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const b = randomBytes(8);
	const chars = [...b].map((x) => alphabet[x % alphabet.length]).join('');
	return `BYB-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/* ================================================================ Bestellen */

export interface CheckoutInput {
	cartId: string;
	customer: SessionCustomer | null;
	locale: Locale;
	email: string;
	phone: string;
	billing: AddressSnapshot;
	shipping: AddressSnapshot | null;
	shippingMethod: 'versand' | 'abholung';
	paymentMethod: string;
	vatId: string;
	validVatId: boolean;
	customerNote: string;
}

export async function placeOrder(input: CheckoutInput): Promise<{ order: Order; payment: Payment | null }> {
	const settings = await getSettings();
	const L = (de: string, en: string) => (input.locale === 'en' ? en : de);
	const shipTo = input.shipping ?? input.billing;
	const cart: CartView = await loadCart(input.cartId, {
		customer: input.customer,
		locale: input.locale,
		settings,
		country: shipTo.country,
		shippingMethod: input.shippingMethod,
		validVatId: input.validVatId,
		email: input.email
	});
	if (!cart.lines.length) throw new CheckoutError(L('Der Warenkorb ist leer.', 'Your cart is empty.'));
	if (!cart.canCheckout) throw new CheckoutError(L('Bitte prüfe deinen Warenkorb – ein Artikel ist so nicht bestellbar.', 'Please check your cart – an item cannot be ordered as is.'));
	const t = cart.totals;
	// Anzahlungen werden nicht jetzt versendet, das fertige Dekor aber später – Lieferart und Adresse deshalb trotzdem merken
	const physical = cart.needsDelivery;
	if (physical && input.shippingMethod === 'versand' && cart.country !== shipTo.country.toUpperCase())
		throw new CheckoutError(L('In dieses Land liefern wir leider nicht.', "Sorry, we don't ship to this country."), 'country');
	if (input.shippingMethod === 'abholung' && !settings.pickup.enabled) throw new CheckoutError(L('Abholung ist derzeit nicht möglich.', 'Pickup is currently not available.'));

	const method = t.amountDue === 0 ? 'gutschein' : input.paymentMethod;
	const allowed = allowedPaymentMethods(settings, input.shippingMethod === 'abholung' && physical);
	if (method !== 'gutschein' && !allowed.includes(method)) throw new CheckoutError(L('Bitte eine Zahlungsart wählen.', 'Please choose a payment method.'), 'payment');

	const load = productLoader();
	const now = new Date();

	const result = await db.transaction(async (tx) => {
		const number = await nextNumber(tx, 'bestellung', 10001);
		const order = await tx
			.insert(orders)
			.values({
				number,
				token: newToken(),
				customerId: input.customer?.emailVerifiedAt ? input.customer.id : null,
				email: input.email,
				phone: input.phone,
				locale: input.locale,
				status: t.amountDue === 0 ? 'in_bearbeitung' : 'zahlung_offen',
				paymentStatus: t.amountDue === 0 ? 'bezahlt' : 'offen',
				paymentMethod: method,
				billingAddress: input.billing,
				shippingAddress: physical && input.shippingMethod === 'versand' ? shipTo : null,
				shippingMethod: physical ? input.shippingMethod : 'keiner',
				shippingCountry: physical && input.shippingMethod === 'versand' ? shipTo.country.toUpperCase() : null,
				subtotal: t.subtotal,
				discountTotal: t.discount,
				shippingTotal: t.shipping,
				taxTotal: t.taxTotal,
				total: t.total,
				giftCardTotal: t.giftCardTotal,
				amountDue: t.amountDue,
				taxMode: settings.tax.mode,
				taxCase: t.taxCase,
				taxRate: t.taxRate,
				vatId: input.vatId,
				isDealer: cart.dealer,
				discountCode: t.discount > 0 || t.freeShippingByCode ? cart.discountCode : null,
				customerNote: input.customerNote,
				paidAt: t.amountDue === 0 ? now : null
			})
			.returning()
			.get();

		const fileIds: number[] = [];
		for (const [i, line] of cart.lines.entries()) {
			const fp = await load(line.productId);
			if (!fp) throw new CheckoutError(L('Ein Artikel ist nicht mehr erhältlich.', 'An item is no longer available.'));
			const item = await tx.select().from(cartItems).where(eq(cartItems.id, line.id)).get();
			const moves = await deductStock(tx, fp, line.variantId, item?.config.bundle, line.quantity, L);
			const inserted = await tx
				.insert(orderItems)
				.values({
					orderId: order.id,
					productId: line.productId,
					variantId: line.variantId,
					kind: line.kind,
					dekorType: line.dekorType,
					title: line.title,
					variantTitle: line.variantTitle,
					sku: fp.variants.find((v) => v.id === line.variantId)?.sku ?? '',
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					lineTotal: line.lineTotal,
					discountShare: t.lines[i].discountShare,
					isDeposit: line.isDeposit,
					config: line.snapshot,
					stockMoves: moves
				})
				.returning()
				.get();
			fileIds.push(...line.fileIds);
			if (line.kind === 'dekor' && line.dekorType) {
				await tx.insert(dekorJobs).values({
					orderId: order.id,
					orderItemId: inserted.id,
					type: line.dekorType,
					title: line.title + (line.variantTitle ? ` (${line.variantTitle})` : ''),
					bike: line.snapshot.bike ?? null,
					depositAmount: line.isDeposit ? line.lineTotal : 0
				});
			}
		}
		await attachCartFiles(tx, input.cartId, order.id, fileIds);

		/* Rabattcode */
		if (order.discountCode) {
			const code = await tx
				.select()
				.from(discountCodes)
				.where(sql`upper(${discountCodes.code}) = ${order.discountCode.toUpperCase()}`)
				.get();
			if (code) {
				if (code.maxUses != null && code.usedCount >= code.maxUses) throw new CheckoutError(L('Der Rabattcode ist inzwischen aufgebraucht.', 'The discount code has just been used up.'));
				await tx
					.update(discountCodes)
					.set({ usedCount: sql`${discountCodes.usedCount} + 1` })
					.where(eq(discountCodes.id, code.id));
				await tx.insert(discountRedemptions).values({ codeId: code.id, orderId: order.id, email: input.email });
			}
		}

		/* Gutscheine einlösen */
		for (const [i, g] of cart.giftCards.entries()) {
			const use = t.giftCards[i] ?? 0;
			if (use <= 0) continue;
			const updated = await tx
				.update(giftCards)
				.set({ balance: sql`${giftCards.balance} - ${use}` })
				.where(and(eq(giftCards.code, g.code), sql`${giftCards.balance} >= ${use}`, eq(giftCards.active, true)))
				.returning({ id: giftCards.id })
				.get();
			if (!updated) throw new CheckoutError(L('Ein Gutschein hat nicht mehr genug Guthaben.', 'A gift card no longer has enough balance.'));
			await tx.insert(giftCardTransactions).values({ giftCardId: updated.id, orderId: order.id, amount: -use, note: `Bestellung ${number}` });
		}

		/* Zahlung */
		const payment =
			t.amountDue > 0
				? await tx
						.insert(payments)
						.values({ orderId: order.id, purpose: 'bestellung', method, amount: t.amountDue, token: newToken() })
						.returning()
						.get()
				: null;

		await tx.delete(cartItems).where(eq(cartItems.cartId, input.cartId));
		await tx.update(carts).set({ discountCode: null, giftCardCodes: [] }).where(eq(carts.id, input.cartId));
		return { order, payment };
	});

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, result.order.id)).orderBy(asc(orderItems.id)).all();
	if (!result.payment) {
		// Komplett mit Gutschein bezahlt
		await afterOrderPaid(result.order.id, null);
	} else if (method === 'ueberweisung' || method === 'bar') {
		queueMail(result.order.email, orderConfirmationMail(result.order, items, result.payment), { template: 'bestellung', orderId: result.order.id });
		void notifyTeam(teamNewOrderMail(result.order, items), newOrderPush(result.order), result.order.id);
	}
	return result;
}

function newOrderPush(order: Order) {
	const b = order.billingAddress;
	return {
		title: `Neue Bestellung ${order.number}`,
		body: `${b.firstName} ${b.lastName} · ${(order.total / 100).toFixed(2).replace('.', ',')} € · ${order.paymentStatus === 'bezahlt' ? 'bezahlt' : 'Zahlung offen'}`,
		url: `/admin/bestellungen/${order.id}`,
		tag: `bestellung-${order.id}`
	};
}

export function allowedPaymentMethods(s: Awaited<ReturnType<typeof getSettings>>, pickup: boolean): string[] {
	const out: string[] = [];
	if (s.payments.stripe.enabled) out.push('stripe');
	if (s.payments.paypal.enabled) out.push('paypal');
	if (s.payments.transfer.enabled) out.push('ueberweisung');
	if (s.payments.cash.enabled && pickup) out.push('bar');
	return out;
}

/** Lager abbuchen (nur bei Produkten mit Bestandsführung); prüft den aktuellen Stand in der Transaktion */
async function deductStock(
	tx: Tx,
	fp: NonNullable<Awaited<ReturnType<ReturnType<typeof productLoader>>>>,
	variantId: number,
	bundleSel: Record<string, number> | undefined,
	qty: number,
	L: (de: string, en: string) => string
): Promise<StockMove[]> {
	const moves: StockMove[] = [];
	const take = async (p: typeof fp.product, vid: number, n: number) => {
		if (p.stockMode !== 'bestand') return;
		const v = await tx.select().from(variants).where(eq(variants.id, vid)).get();
		if (!v) throw new CheckoutError(L('Ein Artikel ist nicht mehr erhältlich.', 'An item is no longer available.'));
		if (!p.backorder && v.stock < n) throw new CheckoutError(L(`${p.title}: nur noch ${Math.max(0, v.stock)} Stück verfügbar.`, `${p.titleEn || p.title}: only ${Math.max(0, v.stock)} left.`));
		await tx
			.update(variants)
			.set({ stock: sql`${variants.stock} - ${n}` })
			.where(eq(variants.id, vid));
		moves.push({ variantId: vid, quantity: n });
	};
	if (fp.product.kind === 'bundle') {
		for (const item of fp.bundle) {
			const vid = item.variants.length === 1 ? item.variants[0].id : bundleSel?.[String(item.id)];
			if (vid) await take(item.product, vid, item.quantity * qty);
		}
	} else {
		await take(fp.product, variantId, qty);
	}
	return moves;
}

/* ================================================================ Zahlung eingegangen */

/**
 * Zahlung als bezahlt verbuchen – egal ob Stripe-Webhook, PayPal-Rücksprung
 * oder Admin („Überweisung eingegangen“). Mehrfachaufrufe sind harmlos.
 */
export async function markPaymentPaid(paymentId: number, providerRef: string | null = null, byUserId: number | null = null): Promise<boolean> {
	const now = new Date();
	const updated = await db
		.update(payments)
		.set({ status: 'bezahlt', paidAt: now, ...(providerRef ? { providerRef } : {}) })
		.where(and(eq(payments.id, paymentId), sql`${payments.status} <> 'bezahlt'`))
		.returning()
		.get();
	if (!updated) return false;
	if (updated.purpose === 'bestellung') {
		const order = await db.select().from(orders).where(eq(orders.id, updated.orderId)).get();
		if (!order) return true;
		if (order.status === 'storniert') {
			// Zahlung kam nach der Stornierung an → Team muss erstatten
			void notifyTeam(teamNoticeMail(`Zahlung für stornierte Bestellung ${order.number}`, `Für die bereits stornierte Bestellung ${order.number} ist eine Zahlung über ${(updated.amount / 100).toFixed(2).replace('.', ',')} € eingegangen. Bitte erstatten.`, `/admin/bestellungen/${order.id}`), { title: `Zahlung nach Storno: ${order.number}`, body: 'Bitte erstatten.', url: `/admin/bestellungen/${order.id}` }, order.id);
			return true;
		}
		await db
			.update(orders)
			.set({ paymentStatus: 'bezahlt', paidAt: now, status: order.status === 'zahlung_offen' ? 'in_bearbeitung' : order.status })
			.where(eq(orders.id, order.id));
		await afterOrderPaid(order.id, updated, byUserId);
	} else {
		const { afterRemainingPaid } = await import('./dekor');
		await afterRemainingPaid(updated);
	}
	return true;
}

async function afterOrderPaid(orderId: number, payment: Payment | null, _byUserId: number | null = null) {
	const order = (await db.select().from(orders).where(eq(orders.id, orderId)).get())!;
	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id)).all();
	const onlyDeposit = items.every((i) => i.isDeposit || i.kind === 'gutschein') && items.some((i) => i.isDeposit);
	try {
		await createInvoice(order, onlyDeposit ? 'anzahlung' : 'rechnung', payment);
	} catch (err) {
		console.error('[rechnung]', err);
	}
	await issueGiftCards(order, items);

	const online = payment && (payment.method === 'stripe' || payment.method === 'paypal');
	if (!payment || online) {
		// Bei Online-Zahlung ist das die erste Mail zur Bestellung
		queueMail(order.email, orderConfirmationMail(order, items, payment), { template: 'bestellung', orderId: order.id });
		void notifyTeam(teamNewOrderMail(order, items), newOrderPush(order), order.id);
	} else {
		queueMail(order.email, paymentReceivedMail(order, payment.amount, 'bestellung'), { template: 'zahlung', orderId: order.id });
		void notifyTeam(
			teamNoticeMail(`Zahlung eingegangen: Bestellung ${order.number}`, `${(payment.amount / 100).toFixed(2).replace('.', ',')} € per ${paymentLabel(payment.method)}.`, `/admin/bestellungen/${order.id}`),
			{ title: `Zahlung eingegangen: ${order.number}`, body: `${(payment.amount / 100).toFixed(2).replace('.', ',')} €`, url: `/admin/bestellungen/${order.id}` },
			order.id
		);
	}
}

/** Gekaufte Gutscheine anlegen und verschicken (an Empfänger oder Käufer) */
async function issueGiftCards(order: Order, items: OrderItem[]) {
	for (const item of items.filter((i) => i.kind === 'gutschein')) {
		const existing = await db.select({ id: giftCards.id }).from(giftCards).where(eq(giftCards.orderItemId, item.id)).all();
		for (let n = existing.length; n < item.quantity; n++) {
			let card = null;
			for (let attempt = 0; attempt < 5 && !card; attempt++) {
				try {
					card = await db
						.insert(giftCards)
						.values({
							code: giftCardCode(),
							initialValue: item.unitPrice,
							balance: item.unitPrice,
							orderId: order.id,
							orderItemId: item.id,
							recipientName: item.config.gift?.name ?? '',
							recipientEmail: item.config.gift?.email ?? '',
							message: item.config.gift?.message ?? '',
							sentAt: new Date()
						})
						.returning()
						.get();
				} catch {
					/* Code schon vergeben → neuer Versuch */
				}
			}
			if (!card) continue;
			await db.insert(giftCardTransactions).values({ giftCardId: card.id, orderId: order.id, amount: card.initialValue, note: `Kauf, Bestellung ${order.number}` });
			const to = card.recipientEmail || order.email;
			const buyer = card.recipientEmail ? `${order.billingAddress.firstName} ${order.billingAddress.lastName}`.trim() : '';
			queueMail(to, giftCardMail(card, order.locale, buyer), { template: 'gutschein', orderId: order.id });
		}
	}
}

/* ================================================================ Stornieren */

export async function cancelOrder(orderId: number, reason: string, notifyCustomer: boolean) {
	const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
	if (!order || order.status === 'storniert') return;
	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
	await db.transaction(async (tx) => {
		for (const item of items) {
			for (const m of item.stockMoves) {
				await tx
					.update(variants)
					.set({ stock: sql`${variants.stock} + ${m.quantity}` })
					.where(eq(variants.id, m.variantId));
			}
			if (item.stockMoves.length) await tx.update(orderItems).set({ stockMoves: [] }).where(eq(orderItems.id, item.id));
		}
		// Eingelöste Gutscheine zurückbuchen
		const redeemed = await tx
			.select()
			.from(giftCardTransactions)
			.where(and(eq(giftCardTransactions.orderId, orderId), lt(giftCardTransactions.amount, 0)))
			.all();
		for (const r of redeemed) {
			await tx
				.update(giftCards)
				.set({ balance: sql`${giftCards.balance} + ${-r.amount}` })
				.where(eq(giftCards.id, r.giftCardId));
			await tx.insert(giftCardTransactions).values({ giftCardId: r.giftCardId, orderId, amount: -r.amount, note: `Storno Bestellung ${order.number}` });
		}
		// In dieser Bestellung gekaufte Gutscheine sperren
		await tx.update(giftCards).set({ active: false }).where(eq(giftCards.orderId, orderId));
		await tx
			.update(payments)
			.set({ status: 'abgebrochen' })
			.where(and(eq(payments.orderId, orderId), eq(payments.status, 'offen')));
		await tx.update(dekorJobs).set({ status: 'storniert' }).where(eq(dekorJobs.orderId, orderId));
		await tx.update(orders).set({ status: 'storniert', cancelledAt: new Date() }).where(eq(orders.id, orderId));
	});
	await createStornoInvoices(orderId);
	if (notifyCustomer) {
		const fresh = (await db.select().from(orders).where(eq(orders.id, orderId)).get())!;
		queueMail(fresh.email, orderCancelledMail(fresh, reason), { template: 'storno', orderId });
	}
}

/** Nicht abgeschlossene Online-Zahlungen nach der eingestellten Zeit stornieren */
export async function autoCancelUnpaid() {
	const s = await getSettings();
	const cutoff = new Date(Date.now() - Math.max(1, s.orders.autoCancelHours) * 3_600_000);
	const stale = await db
		.select({ id: orders.id })
		.from(orders)
		.where(and(eq(orders.status, 'zahlung_offen'), inArray(orders.paymentMethod, ['stripe', 'paypal']), lt(orders.createdAt, cutoff)))
		.all();
	for (const o of stale) {
		await cancelOrder(o.id, '', false);
		console.info(`[bestellung] ${o.id} automatisch storniert (Zahlung nicht abgeschlossen)`);
	}
}

/* ================================================================ Ansicht (Kunde und Admin) */

export async function orderDetails(orderId: number) {
	const [items, pays, invs, jobs, msgs, fileRows] = await Promise.all([
		db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id)).all(),
		db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(asc(payments.id)).all(),
		db.select().from(invoices).where(eq(invoices.orderId, orderId)).orderBy(asc(invoices.id)).all(),
		db.select().from(dekorJobs).where(eq(dekorJobs.orderId, orderId)).orderBy(asc(dekorJobs.id)).all(),
		db.select().from(messages).where(eq(messages.orderId, orderId)).orderBy(asc(messages.id)).all(),
		db.select().from(files).where(eq(files.orderId, orderId)).all()
	]);
	const proofs = jobs.length
		? await db
				.select()
				.from(dekorProofs)
				.where(
					inArray(
						dekorProofs.jobId,
						jobs.map((j) => j.id)
					)
				)
				.orderBy(desc(dekorProofs.version))
				.all()
		: [];
	const fileMap: Record<number, FileRef> = Object.fromEntries(fileRows.map((f) => [f.id, fileRef(f)]));
	return { items, payments: pays, invoices: invs, jobs: jobs.map((j) => ({ ...j, proofs: proofs.filter((p) => p.jobId === j.id) })), messages: msgs, files: fileMap };
}
