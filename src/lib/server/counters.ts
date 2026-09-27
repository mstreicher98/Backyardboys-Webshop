import { sql } from 'drizzle-orm';
import type { DB, Tx } from './db';
import { counters } from './db/schema';

/**
 * Nächste fortlaufende Nummer – lückenlos und nur einmal vergeben, auch wenn
 * zwei Bestellungen gleichzeitig eingehen (atomares UPSERT … RETURNING).
 */
export async function nextNumber(tx: DB | Tx, key: string, start: number): Promise<number> {
	const row = await tx
		.insert(counters)
		.values({ key, value: start })
		.onConflictDoUpdate({ target: counters.key, set: { value: sql`${counters.value} + 1` } })
		.returning({ value: counters.value })
		.get();
	return row.value;
}

/** Rechnungsnummer RE-2026-0001: Zähler je Jahr */
export async function nextInvoiceNumber(tx: DB | Tx, prefix: string, date = new Date()): Promise<string> {
	const year = date.toLocaleString('de-AT', { year: 'numeric', timeZone: 'Europe/Vienna' });
	const n = await nextNumber(tx, `rechnung-${year}`, 1);
	return `${prefix ? `${prefix}-` : ''}${year}-${String(n).padStart(4, '0')}`;
}
