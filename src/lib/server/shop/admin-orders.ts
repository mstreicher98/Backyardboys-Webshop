import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { dekorJobs, messages, orders, type Order } from '../db/schema';
import { orderShippedMail, readyForPickupMail, teamMessageToCustomerMail } from '../emails';
import { queueMail } from '../mail';

/** Aktionen des Teams an einer Bestellung */

export const CARRIERS: Record<string, { label: string; url: string }> = {
	post: { label: 'Österreichische Post', url: 'https://www.post.at/s/sendungsdetails?snr={nr}' },
	dpd: { label: 'DPD', url: 'https://tracking.dpd.de/status/de_DE/parcel/{nr}' },
	gls: { label: 'GLS', url: 'https://gls-group.com/AT/de/paketverfolgung?match={nr}' },
	dhl: { label: 'DHL', url: 'https://www.dhl.com/at-de/home/tracking.html?tracking-id={nr}' },
	ups: { label: 'UPS', url: 'https://www.ups.com/track?tracknum={nr}' },
	andere: { label: 'Anderer Versanddienst', url: '' }
};

export async function markShipped(order: Order, carrierKey: string, trackingNumber: string, customUrl: string, notify: boolean) {
	const carrier = CARRIERS[carrierKey] ?? CARRIERS.andere;
	const url = customUrl || (carrier.url && trackingNumber ? carrier.url.replace('{nr}', encodeURIComponent(trackingNumber)) : '');
	await db
		.update(orders)
		.set({ status: 'versendet', shippedAt: new Date(), trackingCarrier: carrierKey === 'andere' ? '' : carrier.label, trackingNumber, trackingUrl: url })
		.where(eq(orders.id, order.id));
	// Dekor-Aufträge dieser Bestellung sind damit auch unterwegs
	await db
		.update(dekorJobs)
		.set({ status: 'versendet' })
		.where(and(eq(dekorJobs.orderId, order.id), eq(dekorJobs.status, 'in_produktion')));
	if (notify) {
		const fresh = (await db.select().from(orders).where(eq(orders.id, order.id)).get())!;
		queueMail(fresh.email, orderShippedMail(fresh), { template: 'versand', orderId: order.id });
	}
}

export async function markReadyForPickup(order: Order, notify: boolean) {
	await db.update(orders).set({ status: 'abholbereit' }).where(eq(orders.id, order.id));
	if (notify) queueMail(order.email, readyForPickupMail(order), { template: 'abholung', orderId: order.id });
}

export async function teamReply(order: Order, userId: number, body: string, fileIds: number[], notify: boolean) {
	await db.insert(messages).values({ orderId: order.id, author: 'team', userId, body, fileIds });
	if (notify) queueMail(order.email, teamMessageToCustomerMail(order, body), { template: 'nachricht', orderId: order.id });
}

export async function markMessagesRead(orderId: number) {
	await db
		.update(messages)
		.set({ readByTeamAt: new Date() })
		.where(and(eq(messages.orderId, orderId), eq(messages.author, 'kunde'), isNull(messages.readByTeamAt)));
}
