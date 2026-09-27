import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { deleteMedia, mediaUsage } from '$lib/server/media';
import type { RequestHandler } from './$types';

async function find(id: string) {
	const m = await db
		.select()
		.from(media)
		.where(eq(media.id, Number(id) || 0))
		.get();
	if (!m) error(404, 'Bild nicht gefunden.');
	return m;
}

/** Bildbeschreibung (Alternativtext) ändern */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	requirePermission(locals, 'shop.manage');
	const m = await find(params.id);
	const body = await request.json().catch(() => ({}));
	const alt = String(body.alt ?? '')
		.trim()
		.slice(0, 300);
	await db.update(media).set({ alt }).where(eq(media.id, m.id));
	return json({ ok: true, alt });
};

export const GET: RequestHandler = async ({ locals, params }) => {
	requirePermission(locals, 'shop.manage');
	const m = await find(params.id);
	return json({ usage: await mediaUsage(m) });
};

/** Nur löschbar, wenn das Bild nirgends mehr verwendet wird */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const me = requirePermission(locals, 'shop.manage');
	const m = await find(params.id);
	const usage = await mediaUsage(m);
	if (usage.length) return json({ ok: false, usage }, { status: 409 });
	await deleteMedia(m);
	await logAction(me.id, 'gelöscht', 'bild', m.id, m.originalName || m.file);
	return json({ ok: true });
};
