import { error } from '@sveltejs/kit';
import { BACKUP_NAME_RE, backupStream } from '$lib/server/backup';
import { requirePermission } from '$lib/server/guard';
import type { RequestHandler } from './$types';

/** Sicherung (Datenbank + Bilder) als tar-Archiv herunterladen – nur für Admins */
export const GET: RequestHandler = async ({ locals, params }) => {
	requirePermission(locals, 'settings.manage');
	if (!BACKUP_NAME_RE.test(params.name)) error(404, 'Unbekannte Sicherung');
	let stream: ReadableStream<Uint8Array>;
	try {
		stream = backupStream(params.name);
	} catch {
		error(404, 'Unbekannte Sicherung');
	}
	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-tar',
			'Content-Disposition': `attachment; filename="byb-webshop-sicherung-${params.name}.tar"`,
			'Cache-Control': 'no-store'
		}
	});
};
