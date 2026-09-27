import { error, json } from '@sveltejs/kit';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { ImageError, MAX_UPLOAD_BYTES, storeDocument, storeImage } from '$lib/server/media';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 48;

/** Mediathek: neueste zuerst, optional nach Dateiname oder Beschreibung gefiltert. ?art=dokument für PDFs */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const page = Math.max(1, Number(url.searchParams.get('seite')) || 1);
	const kind = url.searchParams.get('art') === 'dokument' ? 'dokument' : 'bild';
	const q = (url.searchParams.get('suche') ?? '').trim().slice(0, 80);
	const where = and(eq(media.kind, kind), q ? or(like(media.originalName, `%${q}%`), like(media.alt, `%${q}%`)) : undefined);
	const total = Number((await db.select({ n: sql<number>`count(*)` }).from(media).where(where).get())?.n ?? 0);
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
	return json({ items, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const me = requirePermission(locals, 'shop.manage');
	const form = await request.formData();
	const file = form.get('datei');
	if (!(file instanceof File) || file.size === 0) error(400, 'Keine Datei empfangen.');
	if (file.size > MAX_UPLOAD_BYTES) error(413, 'Die Datei ist größer als 25 MB.');
	const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const m = isPdf ? await storeDocument(buffer, file.name, me.id) : await storeImage(buffer, file.name, me.id);
		return json({ id: m.id, kind: m.kind, file: m.file, widths: m.widths, width: m.width, height: m.height, alt: m.alt, originalName: m.originalName, sizeBytes: m.sizeBytes });
	} catch (err) {
		if (err instanceof ImageError) error(400, err.message);
		throw err;
	}
};
