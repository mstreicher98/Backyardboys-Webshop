import { json } from '@sveltejs/kit';
import { FileError, fileRef, MAX_FILE_BYTES, storeFile } from '$lib/server/files';
import { requirePermission } from '$lib/server/guard';
import type { RequestHandler } from './$types';

/** Upload des Teams (Entwürfe, Anhänge an Nachrichten) – privat wie Kunden-Uploads */
export const POST: RequestHandler = async ({ request, locals }) => {
	const me = requirePermission(locals, 'shop.manage');
	const form = await request.formData().catch(() => null);
	const file = form?.get('datei');
	if (!(file instanceof File) || file.size === 0) return json({ message: 'Keine Datei erhalten.' }, { status: 400 });
	if (file.size > MAX_FILE_BYTES) return json({ message: 'Die Datei ist größer als 25 MB.' }, { status: 413 });
	try {
		const row = await storeFile(Buffer.from(await file.arrayBuffer()), file.name, { source: 'team', userId: me.id });
		return json(fileRef(row));
	} catch (err) {
		if (err instanceof FileError) return json({ message: err.message === 'type' ? 'Dieses Dateiformat wird nicht unterstützt.' : 'Die Datei konnte nicht gespeichert werden.' }, { status: 400 });
		console.error('[upload]', err);
		return json({ message: 'Die Datei konnte nicht gespeichert werden.' }, { status: 500 });
	}
};
