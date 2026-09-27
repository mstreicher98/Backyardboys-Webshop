import { and, desc, gte, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoices, orderItems, orders, payments } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'finance.view');
	const year = Number(url.searchParams.get('jahr')) || new Date().getFullYear();
	const from = new Date(`${year}-01-01T00:00:00`);
	const to = new Date(`${year + 1}-01-01T00:00:00`);
	const month = sql<string>`strftime('%m', ${invoices.issuedAt} / 1000, 'unixepoch', 'localtime')`;
	const [byMonth, pays, top, years] = await Promise.all([
		db
			.select({ month, net: sql<number>`sum(${invoices.net})`, tax: sql<number>`sum(${invoices.tax})`, total: sql<number>`sum(${invoices.total})`, count: sql<number>`count(*)` })
			.from(invoices)
			.where(and(gte(invoices.issuedAt, from), lt(invoices.issuedAt, to)))
			.groupBy(month)
			.orderBy(month)
			.all(),
		db
			.select({ method: payments.method, total: sql<number>`sum(${payments.amount})`, count: sql<number>`count(*)` })
			.from(payments)
			.where(and(sql`${payments.status} = 'bezahlt'`, gte(payments.paidAt, from), lt(payments.paidAt, to)))
			.groupBy(payments.method)
			.all(),
		db
			.select({ title: orderItems.title, qty: sql<number>`sum(${orderItems.quantity})`, total: sql<number>`sum(${orderItems.lineTotal} - ${orderItems.discountShare})` })
			.from(orderItems)
			.innerJoin(orders, sql`${orders.id} = ${orderItems.orderId}`)
			.where(and(sql`${orders.paymentStatus} = 'bezahlt'`, gte(orders.createdAt, from), lt(orders.createdAt, to)))
			.groupBy(orderItems.title)
			.orderBy(desc(sql`sum(${orderItems.lineTotal})`))
			.limit(15)
			.all(),
		db.select({ y: sql<string>`DISTINCT strftime('%Y', ${invoices.issuedAt} / 1000, 'unixepoch', 'localtime')` }).from(invoices).all()
	]);
	const months = Array.from({ length: 12 }, (_, i) => {
		const m = String(i + 1).padStart(2, '0');
		const r = byMonth.find((x) => x.month === m);
		return { month: i + 1, net: Number(r?.net ?? 0), tax: Number(r?.tax ?? 0), total: Number(r?.total ?? 0), count: Number(r?.count ?? 0) };
	});
	const yearList = [...new Set([...years.map((y) => Number(y.y)), new Date().getFullYear()])].sort((a, b) => b - a);
	return { year, months, pays: pays.map((p) => ({ ...p, total: Number(p.total), count: Number(p.count) })), top: top.map((t) => ({ ...t, qty: Number(t.qty), total: Number(t.total) })), years: yearList };
};
