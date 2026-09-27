import { json } from '@sveltejs/kit';
import { isRateLimited, registerFailure } from '$lib/server/auth';
import { FileError, fileRef, MAX_FILE_BYTES, storeFile } from '$lib/server/files';
import { cartIdFrom } from '$lib/server/shop/cart';
import type { RequestHandler } from './$types';

/**
 * Upload aus dem Konfigurator (Fotos vom Bike, Logos). Die Datei hängt am
 * Warenkorb und wird beim Bestellen der Bestellung zugeordnet.
 */
export const POST: RequestHandler = async ({ request, cookies, locals, getClientAddress }) => {
	const en = locals.locale === 'en' || request.headers.get('accept-language')?.startsWith('en');
	const L = (de: string, en2: string) => (en ? en2 : de);
	const key = `upload:${getClientAddress()}`;
	// Höchstens 80 Dateien pro Stunde und Adresse
	if (isRateLimited(key, 80, 60 * 60_000)) return json({ message: L('Zu viele Uploads – bitte später erneut versuchen.', 'Too many uploads – please try again later.') }, { status: 429 });
	registerFailure(key, 60 * 60_000);

	const form = await request.formData().catch(() => null);
	const file = form?.get('datei');
	if (!(file instanceof File) || file.size === 0) return json({ message: L('Keine Datei erhalten.', 'No file received.') }, { status: 400 });
	if (file.size > MAX_FILE_BYTES) return json({ message: L('Die Datei ist größer als 25 MB.', 'The file is larger than 25 MB.') }, { status: 413 });
	const cartId = await cartIdFrom(cookies, true, locals.customer?.id ?? null);
	try {
		const row = await storeFile(Buffer.from(await file.arrayBuffer()), file.name, { source: 'kunde', cartId });
		return json(fileRef(row));
	} catch (err) {
		if (err instanceof FileError) {
			return json(
				{
					message:
						err.message === 'type'
							? L('Dieses Dateiformat können wir nicht verwenden. Erlaubt: JPG, PNG, HEIC, WebP, PDF, AI, EPS, SVG, ZIP.', 'We cannot use this file type. Allowed: JPG, PNG, HEIC, WebP, PDF, AI, EPS, SVG, ZIP.')
							: L('Die Datei konnte nicht gespeichert werden.', 'The file could not be saved.')
				},
				{ status: 400 }
			);
		}
		console.error('[upload]', err);
		return json({ message: L('Die Datei konnte nicht gespeichert werden.', 'The file could not be saved.') }, { status: 500 });
	}
};
