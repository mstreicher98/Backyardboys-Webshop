import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import { db } from '$lib/server/db';
import { pages } from '$lib/server/db/schema';
import { renderPlaceholders } from '$lib/server/textpage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const p = await db.select().from(pages).where(eq(pages.slug, params.slug)).get();
	if (!p) error(404, locals.locale === 'en' ? 'This page does not exist.' : 'Diese Seite gibt es nicht.');
	const html = pick(locals.locale, p.contentHtml, p.contentHtmlEn);
	return {
		title: pick(locals.locale, p.title, p.titleEn),
		html: await renderPlaceholders(html, locals.locale),
		updatedAt: p.updatedAt,
		legal: p.group === 'rechtliches'
	};
};
