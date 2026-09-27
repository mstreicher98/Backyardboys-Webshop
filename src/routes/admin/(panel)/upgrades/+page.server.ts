import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { MediaRef } from '$lib/media';
import { parseEuro } from '$lib/admin-labels';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { media, upgradeGroups, upgradeOptions } from '$lib/server/db/schema';
import { checked, intOrNull, requirePermission, str } from '$lib/server/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'shop.manage');
	const [groups, opts] = await Promise.all([
		db.select().from(upgradeGroups).orderBy(asc(upgradeGroups.sortOrder)).all(),
		db
			.select({ o: upgradeOptions, m: { id: media.id, file: media.file, widths: media.widths, width: media.width, height: media.height, alt: media.alt } })
			.from(upgradeOptions)
			.leftJoin(media, eq(media.id, upgradeOptions.mediaId))
			.orderBy(asc(upgradeOptions.sortOrder), asc(upgradeOptions.id))
			.all()
	]);
	return {
		groups: groups.map((g) => ({
			...g,
			options: opts.filter((x) => x.o.groupId === g.id).map((x) => ({ ...x.o, image: (x.m?.id ? x.m : null) as MediaRef | null }))
		}))
	};
};

export const actions: Actions = {
	gruppe: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const name = str(f.get('name'), 60);
		if (!name) return fail(400, { error: 'Bitte einen Namen eingeben.' });
		const values = { name, nameEn: str(f.get('name_en'), 60), sortOrder: Number(f.get('sortierung')) || 0 };
		if (id) await db.update(upgradeGroups).set(values).where(eq(upgradeGroups.id, id));
		else await db.insert(upgradeGroups).values(values);
		await logAction(me.id, id ? 'geändert' : 'erstellt', 'upgrade', id, name);
		return { message: 'Gespeichert.' };
	},
	option: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const groupId = Number(f.get('gruppe'));
		const name = str(f.get('name'), 60);
		if (!name || !groupId) return fail(400, { error: 'Bitte einen Namen eingeben.' });
		const isDefault = checked(f.get('standard'));
		const values = {
			groupId,
			name,
			nameEn: str(f.get('name_en'), 60),
			surcharge: Math.max(0, parseEuro(f.get('aufpreis')) ?? 0),
			mediaId: intOrNull(f.get('bild')),
			isDefault,
			active: checked(f.get('aktiv')),
			sortOrder: Number(f.get('sortierung')) || 0
		};
		if (isDefault) await db.update(upgradeOptions).set({ isDefault: false }).where(eq(upgradeOptions.groupId, groupId));
		if (id) await db.update(upgradeOptions).set(values).where(eq(upgradeOptions.id, id));
		else await db.insert(upgradeOptions).values(values);
		await logAction(me.id, id ? 'geändert' : 'erstellt', 'upgrade', id, name);
		return { message: 'Gespeichert.' };
	},
	option_loeschen: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		await db.delete(upgradeOptions).where(eq(upgradeOptions.id, Number((await request.formData()).get('id'))));
		return { message: 'Option gelöscht.' };
	},
	gruppe_loeschen: async ({ locals, request }) => {
		requirePermission(locals, 'shop.manage');
		await db.delete(upgradeGroups).where(eq(upgradeGroups.id, Number((await request.formData()).get('id'))));
		return { message: 'Gruppe gelöscht.' };
	}
};
