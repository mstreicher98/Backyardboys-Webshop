/**
 * Typen, die Server und Oberfläche teilen. Beträge immer in Cent,
 * Steuersätze in Basispunkten (2000 = 20 %).
 */

export type Locale = 'de' | 'en';

/** Auswahlmöglichkeit eines Produkts, z. B. Größe mit S, M, L */
export interface ProductOption {
	name: string;
	nameEn: string;
	values: { de: string; en: string }[];
}

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'datei' | 'bike';

/** Personalisierungs-Feld, im Admin je Produkt angelegt */
export interface PersonalizationField {
	key: string;
	type: FieldType;
	label: string;
	labelEn: string;
	help: string;
	helpEn: string;
	placeholder: string;
	placeholderEn: string;
	required: boolean;
	/** Nur bei select: eine Auswahl je Zeile */
	choices: { de: string; en: string }[];
	maxLength: number;
	/** Aufpreis in Cent, wenn das Feld ausgefüllt wird (0 = kein Aufpreis) */
	surcharge: number;
	/** Nur bei datei: bis zu so viele Dateien */
	maxFiles: number;
}

export interface BikeRef {
	brand: string;
	model: string;
	year: string;
	modelId?: number | null;
}

/** Was der Kunde beim Hinzufügen in den Warenkorb gewählt hat */
export interface LineConfig {
	/** Upgrade-Gruppe → gewählte Option */
	upgrades?: Record<string, number>;
	/** Personalisierung: Feld → Text */
	fields?: Record<string, string>;
	/** Datei-Felder: Feld → Datei-IDs */
	files?: Record<string, number[]>;
	/** Bike-Feld */
	bike?: BikeRef;
	/** Bundle: Bestandteil → gewählte Variante */
	bundle?: Record<string, number>;
	/** Gutschein: Empfänger */
	gift?: { name: string; email: string; message: string };
}

/** Gespeicherte, lesbare Fassung in der Bestellung (Bezeichnungen können sich später ändern) */
export interface LineConfigSnapshot {
	upgrades?: { group: string; option: string; surcharge: number }[];
	fields?: { key: string; label: string; value: string; surcharge: number }[];
	files?: { key: string; label: string; fileIds: number[] }[];
	bike?: BikeRef;
	bundle?: { title: string; variantTitle: string; quantity: number }[];
	gift?: { name: string; email: string; message: string };
}

export interface StockMove {
	variantId: number;
	quantity: number;
}

export interface AddressSnapshot {
	firstName: string;
	lastName: string;
	company: string;
	street: string;
	zip: string;
	city: string;
	country: string;
	phone: string;
}

export type TaxCase = 'normal' | 'reverse_charge' | 'export' | 'kleinunternehmer';

export interface InvoiceLine {
	title: string;
	detail: string;
	quantity: number;
	unitPrice: number;
	total: number;
	taxRate: number;
}

export interface InvoiceData {
	company: {
		name: string;
		street: string;
		zip: string;
		city: string;
		country: string;
		email: string;
		phone: string;
		uid: string;
		fn: string;
		court: string;
		iban: string;
		bic: string;
		bank: string;
		web: string;
	};
	customer: AddressSnapshot & { email: string; vatId: string };
	orderNumber: number;
	orderDate: string;
	paymentMethod: string;
	paid: boolean;
	lines: InvoiceLine[];
	/** Abzüge wie Rabatt oder bereits verrechnete Anzahlung */
	deductions: { label: string; amount: number }[];
	net: number;
	tax: number;
	total: number;
	taxBreakdown: { rate: number; net: number; tax: number }[];
	taxCase: TaxCase;
	notes: string[];
	title: string;
	refNumber?: string;
	locale: Locale;
}

export const ORDER_STATUS = ['zahlung_offen', 'in_bearbeitung', 'abholbereit', 'versendet', 'abgeschlossen', 'storniert'] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const DEKOR_STATUS = [
	'neu',
	'in_gestaltung',
	'entwurf_gesendet',
	'aenderung_gewuenscht',
	'freigegeben',
	'restzahlung_offen',
	'in_produktion',
	'versendet',
	'abgeschlossen',
	'storniert'
] as const;
export type DekorStatus = (typeof DEKOR_STATUS)[number];

export type DekorType = 'full_custom' | 'semi_custom' | 'reprint';

export const DEKOR_TYPE_LABELS: Record<DekorType, { de: string; en: string }> = {
	full_custom: { de: 'Full Custom Design', en: 'Full custom design' },
	semi_custom: { de: 'Semi Custom Design', en: 'Semi custom design' },
	reprint: { de: 'Reprint', en: 'Reprint' }
};

/** Hochgeladene Datei, wie die Oberfläche sie kennt */
export interface UploadedFile {
	id: number;
	key: string;
	name: string;
	mime: string;
	size: number;
	preview: boolean;
}
