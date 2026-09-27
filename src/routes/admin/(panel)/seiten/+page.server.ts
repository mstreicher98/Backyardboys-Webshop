import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pages } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'shop.manage');
	const rows = await db
		.select({ id: pages.id, slug: pages.slug, title: pages.title, group: pages.group, updatedAt: pages.updatedAt, hasEn: pages.contentHtmlEn })
		.from(pages)
		.orderBy(asc(pages.group), asc(pages.sortOrder))
		.all();
	return { rows: rows.map((r) => ({ ...r, hasEn: !!r.hasEn })) };
};
