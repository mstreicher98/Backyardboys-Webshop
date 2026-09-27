import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guard';
import { pushToUser, vapidPublicKey } from '$lib/server/push';
import type { RequestHandler } from './$types';

/** Öffentlicher Schlüssel für das Abo im Browser */
export const GET: RequestHandler = async ({ locals }) => {
	requireUser(locals);
	return json({ key: await vapidPublicKey() });
};

/** Dieses Gerät anmelden: { endpoint, keys: { p256dh, auth } } */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const me = requireUser(locals);
	if (request.headers.get('origin') !== url.origin) error(403);
	const body = (await request.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string }; test?: boolean } | null;
	if (body?.test) {
		await pushToUser(me.id, { title: 'Test-Benachrichtigung', body: `Push funktioniert auf diesem Gerät, ${me.name}.`, url: '/admin' });
		return json({ ok: true });
	}
	if (!body?.endpoint || !/^https:\/\//.test(body.endpoint) || !body.keys?.p256dh || !body.keys?.auth) error(400, 'Ungültiges Abo');
	await db
		.insert(pushSubscriptions)
		.values({ userId: me.id, endpoint: body.endpoint.slice(0, 1000), p256dh: body.keys.p256dh.slice(0, 200), auth: body.keys.auth.slice(0, 100), userAgent: request.headers.get('user-agent')?.slice(0, 250) ?? null })
		.onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: me.id, p256dh: body.keys.p256dh, auth: body.keys.auth } });
	return json({ ok: true });
};

/** Dieses Gerät abmelden */
export const DELETE: RequestHandler = async ({ locals, request }) => {
	const me = requireUser(locals);
	const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
	if (body?.endpoint) await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, body.endpoint), eq(pushSubscriptions.userId, me.id)));
	return json({ ok: true });
};
