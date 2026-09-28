import { eq } from 'drizzle-orm';
import { db } from './db';
import { settings } from './db/schema';

/** Alles, was im Admin unter „Einstellungen“ gepflegt wird (ohne Zugangsdaten, siehe secrets.ts) */
export interface ShopSettings {
	company: {
		/** Firmenwortlaut laut Firmenbuch */
		name: string;
		/** Markenname im Shop */
		brand: string;
		street: string;
		zip: string;
		city: string;
		country: string;
		email: string;
		phone: string;
		whatsapp: string;
		/** Firmenbuchnummer, z. B. FN 123456a */
		fn: string;
		/** Firmenbuchgericht */
		court: string;
		uid: string;
		/** Vertretungsbefugte Gesellschafter (Impressum) */
		representatives: string;
		/** Kammer / Gewerbe (Impressum) */
		chamber: string;
		trade: string;
		authority: string;
		iban: string;
		bic: string;
		bank: string;
		instagram: string;
		facebook: string;
		tiktok: string;
		youtube: string;
	};
	tax: {
		mode: 'kleinunternehmer' | 'regel';
		/** Normalsteuersatz Österreich in Basispunkten */
		standardRate: number;
		/** One-Stop-Shop: Steuersatz des EU-Ziellandes bei Privatkunden */
		oss: boolean;
	};
	orders: {
		/** Präfix der Rechnungsnummer, z. B. RE → RE-2026-0001 */
		invoicePrefix: string;
		/** Zahlungsziel bei Überweisung in Tagen */
		transferDays: number;
		/** Unbezahlte Stripe/PayPal-Bestellungen nach so vielen Stunden stornieren */
		autoCancelHours: number;
	};
	dekor: {
		/** Enthaltene Korrekturschleifen bei Full Custom */
		maxRevisions: number;
	};
	dealers: {
		/** Standard-Händlerrabatt in Prozent */
		defaultDiscount: number;
		/** Händler dürfen sich im Shop bewerben */
		applicationsOpen: boolean;
	};
	pickup: {
		enabled: boolean;
		address: string;
		note: string;
		noteEn: string;
	};
	payments: {
		stripe: { enabled: boolean };
		transfer: { enabled: boolean };
		paypal: { enabled: boolean; sandbox: boolean };
		/** Barzahlung bei Abholung (Registrierkassenpflicht beachten) */
		cash: { enabled: boolean };
	};
	mail: {
		host: string;
		port: number;
		/** true = SSL/TLS ab Verbindungsbeginn (Port 465), false = STARTTLS */
		secure: boolean;
		user: string;
		from: string;
		fromName: string;
		/** Empfänger für Team-Benachrichtigungen, falls kein Benutzer eine E-Mail hat */
		teamFallback: string;
	};
	home: {
		heroMediaId: number | null;
		heroTitle: string;
		heroTitleEn: string;
		heroText: string;
		heroTextEn: string;
		/** Hinweisleiste ganz oben, leer = aus */
		notice: string;
		noticeEn: string;
	};
	/** Start-Checkliste in der Übersicht */
	setup: {
		/** Von Hand abgehakte Punkte (Schlüssel aus der Übersicht) */
		done: string[];
		/** Checkliste ausgeblendet, sobald alles erledigt ist */
		hidden: boolean;
	};
}

export const DEFAULT_SETTINGS: ShopSettings = {
	company: {
		name: 'Backyardboys OG',
		brand: 'Backyardboys Design',
		street: '',
		zip: '',
		city: '',
		country: 'Österreich',
		email: 'office@backyardboys.at',
		phone: '+43 670 6516029',
		whatsapp: '+43 670 6516029',
		fn: '',
		court: '',
		uid: '',
		representatives: '',
		chamber: 'Wirtschaftskammer Österreich',
		trade: '',
		authority: '',
		iban: '',
		bic: '',
		bank: '',
		instagram: '',
		facebook: '',
		tiktok: '',
		youtube: ''
	},
	tax: { mode: 'kleinunternehmer', standardRate: 2000, oss: false },
	orders: { invoicePrefix: 'RE', transferDays: 7, autoCancelHours: 48 },
	dekor: { maxRevisions: 3 },
	dealers: { defaultDiscount: 15, applicationsOpen: true },
	pickup: { enabled: true, address: '', note: 'Abholung nach Terminvereinbarung.', noteEn: 'Pickup by appointment.' },
	payments: {
		stripe: { enabled: false },
		transfer: { enabled: true },
		paypal: { enabled: false, sandbox: true },
		cash: { enabled: false }
	},
	mail: { host: '', port: 587, secure: false, user: '', from: 'office@backyardboys.at', fromName: 'Backyardboys Design', teamFallback: 'office@backyardboys.at' },
	home: {
		heroMediaId: null,
		heroTitle: 'Dein Bike. Dein Style. Dein Statement.',
		heroTitleEn: 'Your bike. Your style. Your statement.',
		heroText: 'Motorrad-Dekore aus Österreich: komplett nach deinen Ideen, auf Basis unserer Vorlagen oder als Reprint – passend für dein Modell.',
		heroTextEn: 'Motorcycle graphics from Austria: fully custom, based on our templates or as a reprint – made to fit your model.',
		notice: '',
		noticeEn: ''
	},
	setup: { done: [], hidden: false }
};

const KEY = 'shop';
let cache: ShopSettings | null = null;

/** Gespeicherte Werte über die Standardwerte legen – auch Gruppen, die später dazugekommen sind */
function merge(stored: Partial<ShopSettings>): ShopSettings {
	const out = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
	for (const [group, values] of Object.entries(stored)) {
		if (values && typeof values === 'object' && group in out) out[group] = { ...out[group], ...(values as Record<string, unknown>) };
	}
	const s = out as unknown as ShopSettings;
	s.payments = { ...DEFAULT_SETTINGS.payments, ...s.payments };
	return s;
}

export async function getSettings(): Promise<ShopSettings> {
	if (cache) return cache;
	const row = await db.select().from(settings).where(eq(settings.key, KEY)).get();
	let stored: Partial<ShopSettings> = {};
	try {
		stored = row ? JSON.parse(row.value) : {};
	} catch {
		/* kaputter Eintrag → Standardwerte */
	}
	cache = merge(stored);
	return cache;
}

export async function saveSettings<K extends keyof ShopSettings>(group: K, patch: Partial<ShopSettings[K]>) {
	const current = await getSettings();
	const next = { ...current, [group]: { ...current[group], ...patch } };
	const value = JSON.stringify(next);
	await db.insert(settings).values({ key: KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
	cache = next;
}

/** Nach dem Wiederherstellen einer Sicherung neu aus der Datenbank lesen */
export function forgetSettings() {
	cache = null;
}

/** "+43 670 6516029" → "tel:+436706516029" */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const waHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

/** Firmenangaben vollständig genug für Rechnungen? */
export function companyGaps(s: ShopSettings): string[] {
	const c = s.company;
	const gaps: string[] = [];
	if (!c.street || !c.zip || !c.city) gaps.push('Firmenadresse');
	if (!c.fn) gaps.push('Firmenbuchnummer');
	if (s.tax.mode === 'regel' && !c.uid) gaps.push('UID-Nummer');
	if (!c.iban) gaps.push('Bankverbindung (IBAN)');
	return gaps;
}
