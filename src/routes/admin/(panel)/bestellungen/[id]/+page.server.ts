import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { customers, files, mailLog, orders, payments } from '$lib/server/db/schema';
import { checked, requirePermission, str } from '$lib/server/guard';
import { cancelOrder, markPaymentPaid, orderDetails, paymentLabel } from '$lib/server/shop/orders';
import { CARRIERS, markMessagesRead, markReadyForPickup, markShipped, teamReply } from '$lib/server/shop/admin-orders';
import { createInvoice } from '$lib/server/shop/invoices';
import { queueMail } from '$lib/server/mail';
import { orderConfirmationMail } from '$lib/server/emails';
import type { Actions, PageServerLoad } from './$types';

async function getOrder(id: string) {
	const order = await db.select().from(orders).where(eq(orders.id, Number(id))).get();
	if (!order) error(404, 'Bestellung nicht gefunden');
	return order;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'shop.manage');
	const order = await getOrder(params.id);
	const [d, customer, mails] = await Promise.all([
		orderDetails(order.id),
		order.customerId ? db.select().from(customers).where(eq(customers.id, order.customerId)).get() : null,
		db.select().from(mailLog).where(eq(mailLog.orderId, order.id)).orderBy(desc(mailLog.id)).limit(20).all()
	]);
	await markMessagesRead(order.id);
	return {
		order,
		...d,
		customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}`.trim(), dealer: customer.dealerStatus === 'freigegeben' } : null,
		mails,
		paymentLabel: paymentLabel(order.paymentMethod),
		carriers: Object.entries(CARRIERS).map(([key, c]) => ({ key, label: c.label }))
	};
};

export const actions: Actions = {
	bezahlt: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		const paymentId = Number((await request.formData()).get('zahlung'));
		const p = await db
			.select()
			.from(payments)
			.where(and(eq(payments.id, paymentId), eq(payments.orderId, order.id)))
			.get();
		if (!p || p.status !== 'offen') return fail(400, { error: 'Diese Zahlung ist nicht mehr offen.' });
		await markPaymentPaid(p.id, null, me.id);
		await logAction(me.id, 'geändert', 'bestellung', order.id, `Zahlung erhalten #${order.number}`);
		return { message: 'Zahlung verbucht – Rechnung erstellt, Kunde informiert.' };
	},
	versendet: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		const f = await request.formData();
		await markShipped(order, str(f.get('versanddienst'), 20), str(f.get('sendungsnummer'), 80), str(f.get('link'), 400), checked(f.get('mail')));
		await logAction(me.id, 'geändert', 'bestellung', order.id, `Versendet #${order.number}`);
		return { message: 'Als versendet markiert.' };
	},
	abholbereit: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		await markReadyForPickup(order, checked((await request.formData()).get('mail')));
		await logAction(me.id, 'geändert', 'bestellung', order.id, `Abholbereit #${order.number}`);
		return { message: 'Als abholbereit markiert.' };
	},
	status: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		const s = str((await request.formData()).get('status'), 30);
		if (!['in_bearbeitung', 'abgeschlossen'].includes(s)) return fail(400, { error: 'Unbekannter Status.' });
		await db
			.update(orders)
			.set({ status: s as 'in_bearbeitung' | 'abgeschlossen' })
			.where(eq(orders.id, order.id));
		await logAction(me.id, 'geändert', 'bestellung', order.id, `Status ${s} #${order.number}`);
		return { message: 'Status geändert.' };
	},
	stornieren: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		const f = await request.formData();
		await cancelOrder(order.id, str(f.get('grund'), 500), checked(f.get('mail')));
		await logAction(me.id, 'geändert', 'bestellung', order.id, `Storniert #${order.number}`);
		return { message: order.paymentStatus === 'bezahlt' ? 'Storniert. Bitte den Betrag erstatten und danach „Erstattet“ markieren.' : 'Storniert.' };
	},
	erstattet: async ({ locals, params }) => {
		const me = requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		await db.update(orders).set({ paymentStatus: 'erstattet' }).where(eq(orders.id, order.id));
		await db
			.update(payments)
			.set({ status: 'erstattet' })
			.where(and(eq(payments.orderId, order.id), eq(payments.status, 'bezahlt')));
		await logAction(me.id, 'geändert', 'bestellung', order.id, `Erstattet #${order.number}`);
		return { message: 'Als erstattet markiert.' };
	},
	nachricht: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		const f = await request.formData();
		const body = str(f.get('text'), 4000);
		if (!body) return fail(400, { error: 'Bitte eine Nachricht eingeben.' });
		const ids = String(f.get('dateien') ?? '')
			.split(',')
			.map(Number)
			.filter((n) => n > 0);
		// Team-Uploads gehören ab jetzt zur Bestellung
		if (ids.length) await db.update(files).set({ orderId: order.id }).where(and(inArray(files.id, ids), eq(files.source, 'team')));
		await teamReply(order, me.id, body, ids, checked(f.get('mail')));
		return { message: 'Nachricht gesendet.' };
	},
	notiz: async ({ locals, params, request }) => {
		requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		await db
			.update(orders)
			.set({ internalNote: str((await request.formData()).get('notiz'), 4000) })
			.where(eq(orders.id, order.id));
		return { message: 'Notiz gespeichert.' };
	},
	rechnung: async ({ locals, params }) => {
		requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		if (order.paymentStatus !== 'bezahlt') return fail(400, { error: 'Rechnungen entstehen bei Zahlungseingang.' });
		const d = await orderDetails(order.id);
		await createInvoice(order, d.items.every((i) => i.isDeposit || i.kind === 'gutschein') ? 'anzahlung' : 'rechnung', d.payments.find((p) => p.status === 'bezahlt') ?? null);
		return { message: 'Rechnung erstellt.' };
	},
	bestaetigung: async ({ locals, params }) => {
		requirePermission(locals, 'shop.manage');
		const order = await getOrder(params.id);
		const d = await orderDetails(order.id);
		queueMail(order.email, orderConfirmationMail(order, d.items, d.payments[0] ?? null), { template: 'bestellung', orderId: order.id });
		return { message: 'Bestätigung erneut gesendet.' };
	}
};
