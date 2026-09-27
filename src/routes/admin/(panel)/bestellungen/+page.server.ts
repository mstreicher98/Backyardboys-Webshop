import { and, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dekorJobs, messages, orderItems, orders } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import type { PageServerLoad } from './$types';

const PAGE = 40;
const FILTERS: Record<string, SQL | undefined> = {
	alle: undefined,
	offen: inArray(orders.status, ['in_bearbeitung', 'abholbereit']),
	zahlung: eq(orders.status, 'zahlung_offen'),
	versendet: inArray(orders.status, ['versendet', 'abgeschlossen']),
	storniert: eq(orders.status, 'storniert')
};

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const filter = url.searchParams.get('filter') ?? 'alle';
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const page = Math.max(1, Number(url.searchParams.get('seite')) || 1);
	const conds: SQL[] = [];
	if (FILTERS[filter]) conds.push(FILTERS[filter]!);
	if (q) {
		const like_ = `%${q.replace(/[%_]/g, ' ')}%`;
		const num = Number(q.replace(/^#/, ''));
		conds.push(
			or(
				like(orders.email, like_),
				sql`json_extract(${orders.billingAddress}, '$.lastName') LIKE ${like_}`,
				sql`json_extract(${orders.billingAddress}, '$.firstName') LIKE ${like_}`,
				sql`json_extract(${orders.billingAddress}, '$.company') LIKE ${like_}`,
				...(Number.isInteger(num) && num > 0 ? [eq(orders.number, num)] : [])
			)!
		);
	}
	const where = conds.length ? and(...conds) : undefined;
	const [rows, total] = await Promise.all([
		db
			.select({
				id: orders.id,
				number: orders.number,
				createdAt: orders.createdAt,
				status: orders.status,
				paymentStatus: orders.paymentStatus,
				paymentMethod: orders.paymentMethod,
				total: orders.total,
				billing: orders.billingAddress,
				email: orders.email,
				shippingMethod: orders.shippingMethod,
				items: sql<number>`(SELECT coalesce(sum(${orderItems.quantity}), 0) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id})`,
				dekor: sql<number>`(SELECT count(*) FROM ${dekorJobs} WHERE ${dekorJobs.orderId} = ${orders.id})`,
				unread: sql<number>`(SELECT count(*) FROM ${messages} WHERE ${messages.orderId} = ${orders.id} AND ${messages.author} = 'kunde' AND ${messages.readByTeamAt} IS NULL)`
			})
			.from(orders)
			.where(where)
			.orderBy(desc(orders.id))
			.limit(PAGE)
			.offset((page - 1) * PAGE)
			.all(),
		db.select({ n: sql<number>`count(*)` }).from(orders).where(where).get()
	]);
	return { rows, filter, q, page, pages: Math.max(1, Math.ceil(Number(total?.n ?? 0) / PAGE)) };
};
