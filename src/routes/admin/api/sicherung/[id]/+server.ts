import { error, json } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { appendChunk, CHUNK_SIZE, discardUpload, inspectUpload, RestoreError } from '$lib/server/restore';
import type { RequestHandler } from './$types';

function sameOrigin(request: Request, url: URL) {
	if (request.headers.get('origin') !== url.origin) error(403, 'Anfrage von fremder Seite abgelehnt.');
}

function rethrow(err: unknown): never {
	if (err instanceof RestoreError) error(400, err.message);
	throw err;
}

/** Nächstes Stück der Datei: PUT ?offset=<Byte> mit den Rohdaten → { received } */
export const PUT: RequestHandler = async ({ locals, params, request, url }) => {
	requirePermission(locals, 'settings.manage');
	sameOrigin(request, url);
	const offset = Number(url.searchParams.get('offset'));
	if (!Number.isSafeInteger(offset) || offset < 0) error(400, 'Ungültige Position.');
	const length = Number(request.headers.get('content-length'));
	if (length > CHUNK_SIZE) error(413, 'Teilstück zu groß.');
	try {
		const received = await appendChunk(params.id, offset, new Uint8Array(await request.arrayBuffer()));
		return json({ received });
	} catch (err) {
		rethrow(err);
	}
};

/** Upload fertig: Datei prüfen → Überblick über den Inhalt */
export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	requirePermission(locals, 'settings.manage');
	sameOrigin(request, url);
	try {
		return json(await inspectUpload(params.id));
	} catch (err) {
		rethrow(err);
	}
};

/** Abbrechen: hochgeladene Datei verwerfen */
export const DELETE: RequestHandler = async ({ locals, params, request, url }) => {
	requirePermission(locals, 'settings.manage');
	sameOrigin(request, url);
	discardUpload(params.id);
	return new Response(null, { status: 204 });
};
