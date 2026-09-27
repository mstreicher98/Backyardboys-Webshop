import { desc, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { inquiries } from '$lib/server/db/schema';
import { requirePermission, str } from '$lib/server/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const all = url.searchParams.has('alle');
	const rows = await db
		.select()
		.from(inquiries)
		.where(all ? undefined : ne(inquiries.status, 'erledigt'))
		.orderBy(desc(inquiries.id))
		.limit(200)
		.all();
	return { rows, all };
};

export const actions: Actions = {
	status: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const status = String(f.get('status'));
		if (!['neu', 'in_bearbeitung', 'erledigt'].includes(status)) return;
		await db
			.update(inquiries)
			.set({ status: status as 'neu', internalNote: str(f.get('notiz'), 2000) })
			.where(eq(inquiries.id, Number(f.get('id'))));
		return { message: 'Gespeichert.' };
	}
};
