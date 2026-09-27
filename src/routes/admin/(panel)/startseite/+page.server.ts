import { fail } from '@sveltejs/kit';
import { asc, eq, ne } from 'drizzle-orm';
import type { MediaRef } from '$lib/media';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { media, products, showcase, testimonials } from '$lib/server/db/schema';
import { checked, intOrNull, requirePermission, str } from '$lib/server/guard';
import { getSettings, saveSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const MEDIA_COLS = { id: media.id, file: media.file, widths: media.widths, width: media.width, height: media.height, alt: media.alt };

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'shop.manage');
	const s = await getSettings();
	const [hero, gallery, reviews, prods] = await Promise.all([
		s.home.heroMediaId ? db.select(MEDIA_COLS).from(media).where(eq(media.id, s.home.heroMediaId)).get() : null,
		db.select({ s: showcase, m: MEDIA_COLS }).from(showcase).innerJoin(media, eq(media.id, showcase.mediaId)).orderBy(asc(showcase.sortOrder), asc(showcase.id)).all(),
		db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), asc(testimonials.id)).all(),
		db.select({ id: products.id, title: products.title }).from(products).where(ne(products.status, 'archiviert')).orderBy(asc(products.title)).all()
	]);
	return {
		home: s.home,
		hero: (hero ?? null) as MediaRef | null,
		gallery: gallery.map((g) => ({ ...g.s, image: g.m as MediaRef })),
		reviews,
		products: prods
	};
};

export const actions: Actions = {
	hero: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		await saveSettings('home', {
			heroMediaId: intOrNull(f.get('bild')),
			heroTitle: str(f.get('titel'), 120),
			heroTitleEn: str(f.get('titel_en'), 120),
			heroText: str(f.get('text'), 400),
			heroTextEn: str(f.get('text_en'), 400),
			notice: str(f.get('hinweis'), 200),
			noticeEn: str(f.get('hinweis_en'), 200)
		});
		await logAction(me.id, 'geändert', 'startseite', null, 'Startseite');
		return { message: 'Startseite gespeichert.' };
	},
	bike: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const mediaId = intOrNull(f.get('bild'));
		if (!mediaId) return fail(400, { error: 'Bitte ein Bild wählen.' });
		const values = {
			mediaId,
			title: str(f.get('titel'), 80),
			bike: str(f.get('bike'), 80),
			productId: intOrNull(f.get('produkt')),
			sortOrder: Number(f.get('sortierung')) || 0,
			active: checked(f.get('aktiv'))
		};
		if (id) await db.update(showcase).set(values).where(eq(showcase.id, id));
		else await db.insert(showcase).values(values);
		return { message: 'Kundenbike gespeichert.' };
	},
	bike_loeschen: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		await db.delete(showcase).where(eq(showcase.id, Number((await request.formData()).get('id'))));
		return { message: 'Entfernt.' };
	},
	bewertung: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const name = str(f.get('name'), 80);
		const text = str(f.get('text'), 1000);
		if (!name || !text) return fail(400, { error: 'Bitte Name und Text eingeben.' });
		const values = {
			name,
			text,
			textEn: str(f.get('text_en'), 1000),
			bike: str(f.get('bike'), 80),
			rating: Math.min(5, Math.max(1, Number(f.get('sterne')) || 5)),
			sortOrder: Number(f.get('sortierung')) || 0,
			active: checked(f.get('aktiv'))
		};
		if (id) await db.update(testimonials).set(values).where(eq(testimonials.id, id));
		else await db.insert(testimonials).values(values);
		return { message: 'Bewertung gespeichert.' };
	},
	bewertung_loeschen: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		await db.delete(testimonials).where(eq(testimonials.id, Number((await request.formData()).get('id'))));
		return { message: 'Entfernt.' };
	}
};
