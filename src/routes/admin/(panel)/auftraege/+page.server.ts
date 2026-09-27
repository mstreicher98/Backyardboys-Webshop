import { and, desc, eq, gte, inArray, or } from 'drizzle-orm';
import type { DekorStatus } from '$lib/shop-types';
import { db } from '$lib/server/db';
import { dekorJobs, orders, users } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { BOARD_COLUMNS } from '$lib/server/shop/dekor';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const showDone = url.searchParams.has('alle');
	const statuses = BOARD_COLUMNS.flatMap((c) => c.statuses);
	// Versendete nur 30 Tage, außer „alle“
	const recent = new Date(Date.now() - 30 * 86_400_000);
	const rows = await db
		.select({
			id: dekorJobs.id,
			title: dekorJobs.title,
			type: dekorJobs.type,
			status: dekorJobs.status,
			bike: dekorJobs.bike,
			dueDate: dekorJobs.dueDate,
			revisions: dekorJobs.revisions,
			updatedAt: dekorJobs.updatedAt,
			orderId: orders.id,
			orderNumber: orders.number,
			billing: orders.billingAddress,
			paymentStatus: orders.paymentStatus,
			assignee: users.name
		})
		.from(dekorJobs)
		.innerJoin(orders, eq(orders.id, dekorJobs.orderId))
		.leftJoin(users, eq(users.id, dekorJobs.assigneeId))
		.where(
			showDone
				? inArray(dekorJobs.status, [...statuses, 'abgeschlossen'])
				: and(inArray(dekorJobs.status, statuses), or(eq(orders.status, 'in_bearbeitung'), eq(orders.status, 'zahlung_offen'), eq(orders.status, 'abholbereit'), gte(dekorJobs.updatedAt, recent)))
		)
		.orderBy(desc(dekorJobs.updatedAt))
		.all();
	return {
		columns: BOARD_COLUMNS.map((c) => ({
			key: c.key,
			label: c.label,
			jobs: rows.filter((r) => c.statuses.includes(r.status as DekorStatus))
		})),
		showDone
	};
};
