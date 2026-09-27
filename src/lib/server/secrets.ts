import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db, DATA_DIR } from './db';
import { settings } from './db/schema';

/**
 * Zugangsdaten für Stripe, PayPal, SMTP und Web-Push. Sie liegen verschlüsselt
 * (AES-256-GCM) in der Datenbank. Der Schlüssel kommt aus APP_SECRET oder aus
 * data/.schluessel – diese Datei ist NICHT Teil der Sicherungen. Eine
 * heruntergeladene Sicherung enthält die Zugangsdaten also nur unlesbar;
 * nach einem Umzug auf einen neuen Server werden sie neu eingetragen.
 */

export interface Secrets {
	stripeSecretKey: string;
	stripeWebhookSecret: string;
	paypalClientId: string;
	paypalSecret: string;
	smtpPassword: string;
	vapidPublicKey: string;
	vapidPrivateKey: string;
}

const EMPTY: Secrets = {
	stripeSecretKey: '',
	stripeWebhookSecret: '',
	paypalClientId: '',
	paypalSecret: '',
	smtpPassword: '',
	vapidPublicKey: '',
	vapidPrivateKey: ''
};

const KEY_FILE = path.join(DATA_DIR, '.schluessel');
const ROW = 'secrets';

let key: Buffer | null = null;
function secretKey(): Buffer {
	if (key) return key;
	let material = env.APP_SECRET?.trim();
	if (!material) {
		if (!fs.existsSync(KEY_FILE)) fs.writeFileSync(KEY_FILE, randomBytes(32).toString('base64'), { mode: 0o600 });
		material = fs.readFileSync(KEY_FILE, 'utf8').trim();
	}
	key = createHash('sha256').update(material).digest();
	return key;
}

export function encrypt(plain: string): string {
	const iv = randomBytes(12);
	const c = createCipheriv('aes-256-gcm', secretKey(), iv);
	const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
	return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

export function decrypt(stored: string): string | null {
	const [v, iv, tag, data] = stored.split(':');
	if (v !== 'v1' || !iv || !tag || !data) return null;
	try {
		const d = createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'));
		d.setAuthTag(Buffer.from(tag, 'base64'));
		return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
	} catch {
		// anderer Schlüssel (z. B. Sicherung von einem anderen Server)
		return null;
	}
}

let cache: Secrets | null = null;

export async function getSecrets(): Promise<Secrets> {
	if (cache) return cache;
	const row = await db.select().from(settings).where(eq(settings.key, ROW)).get();
	let stored: Partial<Secrets> = {};
	if (row) {
		const plain = decrypt(row.value);
		if (plain) {
			try {
				stored = JSON.parse(plain);
			} catch {
				/* leer lassen */
			}
		} else {
			console.warn('[zugangsdaten] Gespeicherte Zugangsdaten lassen sich nicht entschlüsseln (anderer Schlüssel?) – bitte neu eintragen.');
		}
	}
	cache = { ...EMPTY, ...stored };
	return cache;
}

export async function saveSecrets(patch: Partial<Secrets>) {
	const next = { ...(await getSecrets()), ...patch };
	const value = encrypt(JSON.stringify(next));
	await db.insert(settings).values({ key: ROW, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
	cache = next;
}

export function forgetSecrets() {
	cache = null;
}

/** "sk_live_51Hx…abcd" → "sk_live_…abcd" – zum Anzeigen, ob etwas hinterlegt ist */
export function mask(value: string): string {
	if (!value) return '';
	const prefix = value.match(/^[a-z]+_(live|test)_/)?.[0] ?? '';
	return `${prefix}…${value.slice(-4)}`;
}
