import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { pages } from '$lib/server/db/schema';
import { setFlash } from '$lib/server/flash';
import { requirePermission, str } from '$lib/server/guard';
import { cleanHtml } from '$lib/server/sanitize';
import { slugify } from '$lib/slug';
import type { Actions, PageServerLoad } from './$types';

const PROTECTED = ['agb', 'widerruf', 'datenschutz', 'impressum', 'versand', 'zahlung'];

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'shop.manage');
	if (params.id === 'neu') return { page: { id: null, slug: '', title: '', titleEn: '', contentHtml: '', contentHtmlEn: '', group: 'hilfe' as const, sortOrder: 10 }, protected: false };
	const page = await db.select().from(pages).where(eq(pages.id, Number(params.id))).get();
	if (!page) error(404, 'Seite nicht gefunden');
	return { page, protected: PROTECTED.includes(page.slug) };
};

export const actions: Actions = {
	speichern: async ({ locals, params, request, cookies }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const title = str(f.get('titel'), 120);
		if (!title) return fail(400, { error: 'Bitte einen Titel eingeben.' });
		const isNew = params.id === 'neu';
		const current = isNew ? null : await db.select().from(pages).where(eq(pages.id, Number(params.id))).get();
		// Adressen der Pflichtseiten bleiben fix, Links im Shop zeigen darauf
		const slug = current && PROTECTED.includes(current.slug) ? current.slug : slugify(str(f.get('slug'), 80) || title, 80);
		const clash = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).get();
		if (clash && clash.id !== current?.id) return fail(400, { error: `Die Adresse /info/${slug} ist schon vergeben.` });
		const values = {
			slug,
			title,
			titleEn: str(f.get('titel_en'), 120),
			contentHtml: cleanHtml(String(f.get('inhalt') ?? '')),
			contentHtmlEn: cleanHtml(String(f.get('inhalt_en') ?? '')),
			group: (['bestellung', 'hilfe', 'rechtliches', 'keine'].includes(String(f.get('bereich'))) ? f.get('bereich') : 'hilfe') as 'hilfe',
			sortOrder: Number(f.get('sortierung')) || 0
		};
		const id = current
			? (await db.update(pages).set(values).where(eq(pages.id, current.id)).returning({ id: pages.id }).get()).id
			: (await db.insert(pages).values(values).returning({ id: pages.id }).get()).id;
		await logAction(me.id, current ? 'geändert' : 'erstellt', 'seite', id, title);
		if (isNew) {
			setFlash(cookies, 'Seite angelegt.');
			redirect(303, `/admin/seiten/${id}`);
		}
		return { message: 'Seite gespeichert.' };
	},
	loeschen: async ({ locals, params, cookies }) => {
		const me = requirePermission(locals, 'shop.manage');
		const page = await db.select().from(pages).where(eq(pages.id, Number(params.id))).get();
		if (!page) error(404);
		if (PROTECTED.includes(page.slug)) return fail(400, { error: 'Diese Seite ist gesetzlich nötig oder wird im Shop verlinkt und kann nicht gelöscht werden.' });
		await db.delete(pages).where(eq(pages.id, page.id));
		await logAction(me.id, 'gelöscht', 'seite', page.id, page.title);
		setFlash(cookies, 'Seite gelöscht.');
		redirect(303, '/admin/seiten');
	}
};
