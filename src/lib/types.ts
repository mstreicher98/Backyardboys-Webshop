/** Überblick über eine Sicherung vor dem Wiederherstellen */
export interface BackupSummary {
	/** Zeitstempel aus dem Ordnernamen, z. B. "2026-09-24-033255" */
	stamp: string | null;
	products: number;
	orders: number;
	customers: number;
	invoices: number;
	/** Bilder in der Mediathek */
	media: number;
	/** Dateien in der Sicherung (Bilder in mehreren Größen, Kunden-Uploads) */
	files: number;
	users: string[];
	/** Datum der neuesten Bestellung */
	lastOrder: string | null;
	/** Stammt die Sicherung von einer älteren Version? Dann wird sie beim Wiederherstellen angepasst. */
	older: boolean;
}
