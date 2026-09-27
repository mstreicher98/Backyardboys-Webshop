import { requireCustomer } from '$lib/server/customer-auth';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dekorProofs, dekorJobs, messages, orders } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const c = requireCustomer(locals);
	const rows = await db
		.select({
			id: orders.id,
			number: orders.number,
			createdAt: orders.createdAt,
			status: orders.status,
			paymentStatus: orders.paymentStatus,
			total: orders.total,
			unread: sql<number>`(SELECT count(*) FROM ${messages} WHERE ${messages.orderId} = ${orders.id} AND ${messages.author} = 'team' AND ${messages.readByCustomerAt} IS NULL)`
		})
		.from(orders)
		.where(eq(orders.customerId, c.id))
		.orderBy(desc(orders.createdAt))
		.all();
	const waiting = rows.length
		? await db
				.select({ orderId: dekorJobs.orderId })
				.from(dekorProofs)
				.innerJoin(dekorJobs, eq(dekorJobs.id, dekorProofs.jobId))
				.where(
					and(
						eq(dekorProofs.status, 'offen'),
						inArray(
							dekorJobs.orderId,
							rows.map((r) => r.id)
						)
					)
				)
				.all()
		: [];
	return {
		welcome: url.searchParams.has('willkommen'),
		orders: rows.map((r) => ({ ...r, proofWaiting: waiting.some((w) => w.orderId === r.id) }))
	};
};
