import { desc, eq } from 'drizzle-orm';
import { db } from './db';
import { auditLog, users } from './db/schema';

export type AuditEntity = 'bestellung' | 'auftrag' | 'produkt' | 'kategorie' | 'kunde' | 'gutschein' | 'rabatt' | 'seite' | 'bild' | 'benutzer' | 'einstellungen' | 'upgrade' | 'bike' | 'anfrage' | 'startseite';
export type AuditAction = 'erstellt' | 'geändert' | 'gelöscht' | 'veröffentlicht' | 'zurückgezogen';

/** Kurzer Eintrag, wer was geändert hat – für „Letzte Änderungen“ im Dashboard */
export async function logAction(userId: number | null, action: AuditAction, entity: AuditEntity, entityId: number | null, label: string) {
	try {
		await db.insert(auditLog).values({ userId, action, entity, entityId, label: label.slice(0, 200) });
	} catch (err) {
		console.error('[protokoll]', err);
	}
}

export async function recentActions(limit = 12) {
	return db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			entity: auditLog.entity,
			entityId: auditLog.entityId,
			label: auditLog.label,
			createdAt: auditLog.createdAt,
			userName: users.name
		})
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.userId))
		.orderBy(desc(auditLog.id))
		.limit(limit)
		.all();
}
