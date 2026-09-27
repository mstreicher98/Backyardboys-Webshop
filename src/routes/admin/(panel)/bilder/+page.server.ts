import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { uploadsSize } from '$lib/server/media';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 60;

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const kind = url.searchParams.get('art') === 'dokument' ? 'dokument' : 'bild';
	const page = Math.max(1, Number(url.searchParams.get('seite')) || 1);
	const where = eq(media.kind, kind);
	const counts = await db.select({ kind: media.kind, n: sql<number>`count(*)` }).from(media).groupBy(media.kind).all();
	const total = Number(counts.find((c) => c.kind === kind)?.n ?? 0);
	const items = await db
		.select({
			id: media.id,
			kind: media.kind,
			file: media.file,
			widths: media.widths,
			width: media.width,
			height: media.height,
			alt: media.alt,
			originalName: media.originalName,
			sizeBytes: media.sizeBytes,
			createdAt: media.createdAt
		})
		.from(media)
		.where(where)
		.orderBy(desc(media.id))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE)
		.all();
	return {
		kind,
		items,
		total,
		counts: { bild: Number(counts.find((c) => c.kind === 'bild')?.n ?? 0), dokument: Number(counts.find((c) => c.kind === 'dokument')?.n ?? 0) },
		page,
		pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		bytes: uploadsSize()
	};
};
