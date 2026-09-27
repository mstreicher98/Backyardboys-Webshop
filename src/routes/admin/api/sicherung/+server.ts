import { error, json } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { CHUNK_SIZE, inspectBackup, RestoreError, startUpload } from '$lib/server/restore';
import type { RequestHandler } from './$types';

/** Stand aus der Liste am Server auswerten, bevor er wiederhergestellt wird: ?stand=<Name> */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, 'settings.manage');
	try {
		return json(await inspectBackup(url.searchParams.get('stand') ?? ''));
	} catch (err) {
		if (err instanceof RestoreError) error(400, err.message);
		throw err;
	}
};

/** Hochladen einer heruntergeladenen Sicherung beginnen: { groesse, name } → { id, stueck } */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	requirePermission(locals, 'settings.manage');
	if (request.headers.get('origin') !== url.origin) error(403, 'Anfrage von fremder Seite abgelehnt.');
	const body = await request.json().catch(() => null);
	try {
		const id = startUpload(Number(body?.groesse), String(body?.name ?? ''));
		return json({ id, stueck: CHUNK_SIZE });
	} catch (err) {
		if (err instanceof RestoreError) error(400, err.message);
		throw err;
	}
};
