import { fail } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { bikeBrands, bikeModels, productBikes } from '$lib/server/db/schema';
import { checked, intOrNull, requirePermission, str } from '$lib/server/guard';
import { slugify } from '$lib/slug';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const brands = await db
		.select({ id: bikeBrands.id, name: bikeBrands.name, active: bikeBrands.active, sortOrder: bikeBrands.sortOrder, models: sql<number>`(SELECT count(*) FROM ${bikeModels} WHERE ${bikeModels.brandId} = ${bikeBrands.id})` })
		.from(bikeBrands)
		.orderBy(asc(bikeBrands.sortOrder), asc(bikeBrands.name))
		.all();
	const brandId = Number(url.searchParams.get('marke')) || brands[0]?.id || null;
	const models = brandId
		? await db
				.select({
					m: bikeModels,
					products: sql<number>`(SELECT count(*) FROM ${productBikes} WHERE ${productBikes.modelId} = ${bikeModels.id})`
				})
				.from(bikeModels)
				.where(eq(bikeModels.brandId, brandId))
				.orderBy(asc(bikeModels.name), asc(bikeModels.yearFrom))
				.all()
		: [];
	return { brands, brandId, models: models.map((r) => ({ ...r.m, products: Number(r.products) })) };
};

export const actions: Actions = {
	marke: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const name = str(f.get('name'), 60);
		if (!name) return fail(400, { error: 'Bitte einen Namen eingeben.' });
		const dup = await db.select({ id: bikeBrands.id }).from(bikeBrands).where(eq(bikeBrands.name, name)).get();
		if (dup && dup.id !== id) return fail(400, { error: 'Diese Marke gibt es schon.' });
		const values = { name, slug: slugify(name, 60), active: id ? checked(f.get('aktiv')) : true, sortOrder: Number(f.get('sortierung')) || 0 };
		if (id) await db.update(bikeBrands).set(values).where(eq(bikeBrands.id, id));
		else await db.insert(bikeBrands).values(values);
		await logAction(me.id, id ? 'geändert' : 'erstellt', 'bike', id, name);
		return { message: 'Marke gespeichert.' };
	},
	marke_loeschen: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		await db.delete(bikeBrands).where(eq(bikeBrands.id, Number((await request.formData()).get('id'))));
		return { message: 'Marke gelöscht.' };
	},
	modell: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const brandId = Number(f.get('marke'));
		const name = str(f.get('name'), 80);
		const yearFrom = intOrNull(f.get('von'));
		const yearTo = intOrNull(f.get('bis'));
		if (!name || !brandId || !yearFrom) return fail(400, { error: 'Bitte Modell und Baujahr ab angeben.' });
		if (yearTo && yearTo < yearFrom) return fail(400, { error: '„Bis“ liegt vor „von“.' });
		const values = { brandId, name, category: str(f.get('bauart'), 30), yearFrom, yearTo, active: id ? checked(f.get('aktiv')) : true };
		if (id) await db.update(bikeModels).set(values).where(eq(bikeModels.id, id));
		else await db.insert(bikeModels).values(values);
		await logAction(me.id, id ? 'geändert' : 'erstellt', 'bike', id, name);
		return { message: 'Modell gespeichert.' };
	},
	modell_loeschen: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		await db.delete(bikeModels).where(eq(bikeModels.id, Number((await request.formData()).get('id'))));
		return { message: 'Modell gelöscht.' };
	},
	/** Mehrere Modelle auf einmal: „Name; Bauart; von; bis“ je Zeile */
	import: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const brandId = Number(f.get('marke'));
		if (!brandId) return fail(400, { error: 'Bitte eine Marke wählen.' });
		const lines = String(f.get('liste') ?? '')
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter(Boolean)
			.slice(0, 500);
		let added = 0;
		const errors: string[] = [];
		for (const line of lines) {
			const [name, category = '', from = '', to = ''] = line.split(/[;\t]/).map((x) => x.trim());
			const yearFrom = Number(from);
			const yearTo = to ? Number(to) : null;
			if (!name || !Number.isInteger(yearFrom) || yearFrom < 1950 || (yearTo != null && !Number.isInteger(yearTo))) {
				errors.push(line);
				continue;
			}
			const exists = await db
				.select({ id: bikeModels.id })
				.from(bikeModels)
				.where(and(eq(bikeModels.brandId, brandId), eq(bikeModels.name, name.slice(0, 80)), eq(bikeModels.yearFrom, yearFrom)))
				.get();
			if (exists) continue;
			await db.insert(bikeModels).values({ brandId, name: name.slice(0, 80), category: category.slice(0, 30), yearFrom, yearTo });
			added++;
		}
		await logAction(me.id, 'erstellt', 'bike', brandId, `${added} Modelle importiert`);
		return { message: `${added} Modelle angelegt.${errors.length ? ` ${errors.length} Zeilen nicht verstanden.` : ''}`, importErrors: errors.slice(0, 10) };
	}
};
