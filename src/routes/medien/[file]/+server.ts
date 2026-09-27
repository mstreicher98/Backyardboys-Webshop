import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { UPLOAD_DIR } from '$lib/server/db';
import type { RequestHandler } from './$types';

const IMAGE_RE = /^[0-9a-f]{20}-\d{2,4}\.webp$/;
const DOC_RE = /^[0-9a-f]{20}-[a-z0-9-]{1,60}\.pdf$/;

/** Hochgeladene Bilder und Dokumente. Dateinamen ändern sich nie → darf lange gecacht werden. */
export const GET: RequestHandler = async ({ params, request }) => {
	const isDoc = DOC_RE.test(params.file);
	if (!isDoc && !IMAGE_RE.test(params.file)) error(404, 'Nicht gefunden');
	const file = path.join(UPLOAD_DIR, params.file);
	let stat: fs.Stats;
	try {
		stat = fs.statSync(file);
	} catch {
		error(404, 'Nicht gefunden');
	}
	const etag = `"${stat.size.toString(36)}-${stat.mtimeMs.toString(36)}"`;
	const headers: Record<string, string> = {
		'Content-Type': isDoc ? 'application/pdf' : 'image/webp',
		'Cache-Control': 'public, max-age=31536000, immutable',
		ETag: etag
	};
	// PDF im Browser öffnen, beim Speichern ohne die Zufallskennung im Namen
	if (isDoc) headers['Content-Disposition'] = `inline; filename="${params.file.slice(21)}"`;
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
	const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream<Uint8Array>;
	return new Response(stream, { headers: { ...headers, 'Content-Length': String(stat.size) } });
};
