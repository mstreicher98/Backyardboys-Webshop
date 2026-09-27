import { and, asc, eq } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import type { MediaRef } from '$lib/media';
import { db } from '$lib/server/db';
import { media, showcase, testimonials } from '$lib/server/db/schema';
import { getSettings } from '$lib/server/settings';
import { dealerDiscountOf } from '$lib/server/shop/cart';
import { bikeCatalog, categoryTree, findProductIds, productCards } from '$lib/server/shop/catalog';
import type { PageServerLoad } from './$types';

const MEDIA_COLS = { id: media.id, file: media.file, widths: media.widths, width: media.width, height: media.height, alt: media.alt };

export const load: PageServerLoad = async ({ locals }) => {
	const locale = locals.locale;
	const s = await getSettings();
	const ctx = { dealerDiscount: dealerDiscountOf(locals.customer, s), locale };
	const [featuredIds, newIds, categories, bikes, gallery, reviews, hero] = await Promise.all([
		findProductIds({ featured: true, limit: 8 }),
		findProductIds({ sort: 'neu', limit: 8 }),
		categoryTree(locale, true),
		bikeCatalog(),
		db
			.select({ id: showcase.id, title: showcase.title, bike: showcase.bike, image: MEDIA_COLS })
			.from(showcase)
			.innerJoin(media, eq(media.id, showcase.mediaId))
			.where(eq(showcase.active, true))
			.orderBy(asc(showcase.sortOrder), asc(showcase.id))
			.limit(12)
			.all(),
		db.select().from(testimonials).where(eq(testimonials.active, true)).orderBy(asc(testimonials.sortOrder)).limit(6).all(),
		s.home.heroMediaId ? db.select(MEDIA_COLS).from(media).where(and(eq(media.id, s.home.heroMediaId), eq(media.kind, 'bild'))).get() : null
	]);
	// Neu: ohne die schon hervorgehobenen
	const newest = newIds.filter((id) => !featuredIds.includes(id)).slice(0, 4);
	return {
		hero: {
			title: pick(locale, s.home.heroTitle, s.home.heroTitleEn),
			text: pick(locale, s.home.heroText, s.home.heroTextEn),
			image: (hero ?? null) as MediaRef | null
		},
		featured: await productCards(featuredIds.length ? featuredIds : newIds.slice(0, 8), ctx),
		newest: featuredIds.length ? await productCards(newest, ctx) : [],
		categories: categories.filter((c) => c.image),
		bikes,
		gallery: gallery.map((g) => ({ id: g.id, title: g.title, bike: g.bike, image: g.image as MediaRef })),
		reviews: reviews.map((r) => ({ id: r.id, name: r.name, bike: r.bike, rating: r.rating, text: pick(locale, r.text, r.textEn) }))
	};
};
