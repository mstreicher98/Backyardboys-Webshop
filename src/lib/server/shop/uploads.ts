import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import { files } from '../db/schema';

/**
 * Dateien aus einer Nachricht an die Bestellung hängen – nur eigene Uploads
 * (gleicher Warenkorb), die noch keiner Bestellung gehören.
 */
export async function attachUploads(ids: number[], orderId: number, cartId: string | null) {
	if (!ids.length || !cartId) return [];
	const rows = await db
		.update(files)
		.set({ orderId, cartId: null })
		.where(and(inArray(files.id, ids), isNull(files.orderId), eq(files.cartId, cartId)))
		.returning({ id: files.id });
	return rows.map((r) => r.id);
}
