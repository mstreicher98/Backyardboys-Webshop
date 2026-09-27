import { eq } from 'drizzle-orm';
import { localizePath } from '$lib/i18n.svelte';
import { db } from '$lib/server/db';
import { categories, pages, products } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const [prods, cats, infos] = await Promise.all([
		db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(eq(products.status, 'aktiv')).all(),
		db.select({ slug: categories.slug }).from(categories).where(eq(categories.active, true)).all(),
		db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).all()
	]);
	const paths: { path: string; lastmod?: Date }[] = [
		{ path: '/' },
		{ path: '/produkte' },
		{ path: '/bike-finder' },
		{ path: '/kontakt' },
		...cats.map((c) => ({ path: `/kategorie/${c.slug}` })),
		...prods.map((p) => ({ path: `/produkt/${p.slug}`, lastmod: p.updatedAt })),
		...infos.map((p) => ({ path: `/info/${p.slug}`, lastmod: p.updatedAt }))
	];
	const entry = (p: { path: string; lastmod?: Date }) => {
		const de = `${url.origin}${p.path}`;
		const en = `${url.origin}${localizePath(p.path, 'en')}`;
		const alt = `<xhtml:link rel="alternate" hreflang="de" href="${de}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/>`;
		const mod = p.lastmod ? `<lastmod>${p.lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
		return `<url><loc>${de}</loc>${mod}${alt}</url><url><loc>${en}</loc>${mod}${alt}</url>`;
	};
	const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${paths.map(entry).join('')}</urlset>`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'max-age=3600' } });
};
