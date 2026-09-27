import { fail } from '@sveltejs/kit';
import { asc, eq, sql } from 'drizzle-orm';
import type { MediaRef } from '$lib/media';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { categories, media, productCategories } from '$lib/server/db/schema';
import { checked, intOrNull, requirePermission, str } from '$lib/server/guard';
import { cleanHtml } from '$lib/server/sanitize';
import { slugify } from '$lib/slug';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'shop.manage');
	const rows = await db
		.select({
			c: categories,
			m: { id: media.id, file: media.file, widths: media.widths, width: media.width, height: media.height, alt: media.alt },
			products: sql<number>`(SELECT count(*) FROM ${productCategories} WHERE ${productCategories.categoryId} = ${categories.id})`
		})
		.from(categories)
		.leftJoin(media, eq(media.id, categories.mediaId))
		.orderBy(asc(categories.sortOrder), asc(categories.name))
		.all();
	return { rows: rows.map((r) => ({ ...r.c, image: (r.m?.id ? r.m : null) as MediaRef | null, products: Number(r.products) })) };
};

export const actions: Actions = {
	speichern: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const name = str(f.get('name'), 80);
		if (!name) return fail(400, { error: 'Bitte einen Namen eingeben.' });
		let slug = slugify(str(f.get('slug'), 80) || name, 80);
		const clash = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).get();
		if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
		const parentId = intOrNull(f.get('eltern'));
		if (parentId && parentId === id) return fail(400, { error: 'Eine Kategorie kann nicht ihre eigene Oberkategorie sein.' });
		const values = {
			slug,
			name,
			nameEn: str(f.get('name_en'), 80),
			tagline: str(f.get('zusatz'), 80),
			taglineEn: str(f.get('zusatz_en'), 80),
			descriptionHtml: cleanHtml(String(f.get('beschreibung') ?? '')),
			descriptionHtmlEn: cleanHtml(String(f.get('beschreibung_en') ?? '')),
			parentId,
			mediaId: intOrNull(f.get('bild')),
			sortOrder: Number(f.get('sortierung')) || 0,
			active: checked(f.get('aktiv')),
			showInMenu: checked(f.get('menue'))
		};
		if (id) await db.update(categories).set(values).where(eq(categories.id, id));
		else await db.insert(categories).values(values);
		await logAction(me.id, id ? 'geändert' : 'erstellt', 'kategorie', id, name);
		return { message: 'Kategorie gespeichert.' };
	},
	loeschen: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const id = Number((await request.formData()).get('id'));
		const kids = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).get();
		if (kids) return fail(400, { error: 'Die Kategorie hat Unterkategorien – diese zuerst verschieben oder löschen.' });
		await db.delete(categories).where(eq(categories.id, id));
		await logAction(me.id, 'gelöscht', 'kategorie', id, `Kategorie ${id}`);
		return { message: 'Kategorie gelöscht. Produkte bleiben erhalten.' };
	}
};
