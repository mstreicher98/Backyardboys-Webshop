import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { categories, media, productCategories, productImages, products, variants } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const status = url.searchParams.get('status') ?? '';
	const kat = Number(url.searchParams.get('kategorie')) || null;
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const conds: SQL[] = [];
	if (['entwurf', 'aktiv', 'archiviert'].includes(status)) conds.push(eq(products.status, status as 'aktiv'));
	else conds.push(sql`${products.status} <> 'archiviert'`);
	if (kat) conds.push(inArray(products.id, db.select({ id: productCategories.productId }).from(productCategories).where(eq(productCategories.categoryId, kat))));
	if (q) conds.push(or(like(products.title, `%${q}%`), like(products.slug, `%${q}%`), inArray(products.id, db.select({ id: variants.productId }).from(variants).where(like(variants.sku, `%${q}%`))))!);
	const rows = await db
		.select({
			id: products.id,
			title: products.title,
			slug: products.slug,
			kind: products.kind,
			dekorType: products.dekorType,
			status: products.status,
			stockMode: products.stockMode,
			featured: products.featured,
			minPrice: sql<number>`(SELECT min(${variants.price}) FROM ${variants} WHERE ${variants.productId} = ${products.id} AND ${variants.active} = 1)`,
			variantCount: sql<number>`(SELECT count(*) FROM ${variants} WHERE ${variants.productId} = ${products.id})`,
			stock: sql<number>`(SELECT sum(${variants.stock}) FROM ${variants} WHERE ${variants.productId} = ${products.id} AND ${variants.active} = 1)`,
			image: sql<string | null>`(SELECT ${media.file} || '|' || ${media.widths} FROM ${productImages} JOIN ${media} ON ${media.id} = ${productImages.mediaId} WHERE ${productImages.productId} = ${products.id} ORDER BY ${productImages.sortOrder} LIMIT 1)`
		})
		.from(products)
		.where(and(...conds))
		.orderBy(asc(products.sortOrder), desc(products.updatedAt))
		.all();
	const cats = await db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder)).all();
	return { rows, status, kat, q, categories: cats };
};
