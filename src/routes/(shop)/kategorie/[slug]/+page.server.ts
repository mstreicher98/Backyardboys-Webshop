import { error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import type { MediaRef } from '$lib/media';
import { db } from '$lib/server/db';
import { categories, media } from '$lib/server/db/schema';
import { categoryWithDescendants } from '$lib/server/shop/catalog';
import { productListing } from '$lib/server/shop/listing';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, cookies, locals }) => {
	const locale = locals.locale;
	const found = await categoryWithDescendants(params.slug);
	if (!found) error(404, locale === 'en' ? 'This category does not exist.' : 'Diese Kategorie gibt es nicht.');
	const { category, ids } = found;
	const [children, parent, image] = await Promise.all([
		db
			.select({ slug: categories.slug, name: categories.name, nameEn: categories.nameEn })
			.from(categories)
			.where(and(eq(categories.parentId, category.id), eq(categories.active, true)))
			.orderBy(asc(categories.sortOrder))
			.all(),
		category.parentId ? db.select({ slug: categories.slug, name: categories.name, nameEn: categories.nameEn }).from(categories).where(eq(categories.id, category.parentId)).get() : null,
		category.mediaId
			? db.select({ id: media.id, file: media.file, widths: media.widths, width: media.width, height: media.height, alt: media.alt }).from(media).where(eq(media.id, category.mediaId)).get()
			: null
	]);
	return {
		category: {
			slug: category.slug,
			name: pick(locale, category.name, category.nameEn),
			tagline: pick(locale, category.tagline, category.taglineEn),
			descriptionHtml: pick(locale, category.descriptionHtml, category.descriptionHtmlEn),
			image: (image ?? null) as MediaRef | null
		},
		parent: parent ? { slug: parent.slug, name: pick(locale, parent.name, parent.nameEn) } : null,
		children: children.map((c) => ({ slug: c.slug, name: pick(locale, c.name, c.nameEn) })),
		listing: await productListing({ url, cookies, locale, customer: locals.customer, categoryIds: ids })
	};
};
