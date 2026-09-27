import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customers, dekorJobs, inquiries, messages, orders } from '$lib/server/db/schema';
import { takeFlash } from '$lib/server/flash';
import { requireUser } from '$lib/server/guard';
import type { LayoutServerLoad } from './$types';

const count = (q: { n: number } | undefined) => Number(q?.n ?? 0);

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const me = requireUser(locals);
	const n = sql<number>`count(*)`;
	const [openOrders, jobs, inq, unread, dealers] = await Promise.all([
		db.select({ n }).from(orders).where(inArray(orders.status, ['in_bearbeitung', 'abholbereit'])).get(),
		db.select({ n }).from(dekorJobs).where(inArray(dekorJobs.status, ['neu', 'aenderung_gewuenscht', 'freigegeben'])).get(),
		db.select({ n }).from(inquiries).where(eq(inquiries.status, 'neu')).get(),
		db
			.select({ n })
			.from(messages)
			.where(and(eq(messages.author, 'kunde'), isNull(messages.readByTeamAt)))
			.get(),
		db.select({ n }).from(customers).where(eq(customers.dealerStatus, 'angefragt')).get()
	]);
	return {
		me: { id: me.id, name: me.name, username: me.username, role: me.role, owner: me.owner },
		theme: locals.theme,
		flash: takeFlash(cookies),
		badges: {
			orders: count(openOrders) + count(unread),
			jobs: count(jobs),
			inquiries: count(inq),
			customers: count(dealers)
		}
	};
};
