import webpush from 'web-push';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { pushSubscriptions, users } from './db/schema';
import { getSecrets, saveSecrets } from './secrets';
import { getSettings } from './settings';

/**
 * Push-Nachrichten an die Handys des Teams (Web Push). Funktioniert auf
 * Android in Chrome/Firefox und auf dem iPhone, wenn der Admin-Bereich über
 * „Zum Home-Bildschirm“ als App installiert ist (ab iOS 16.4).
 */

export interface PushPayload {
	title: string;
	body: string;
	/** Adresse im Admin, die beim Antippen öffnet */
	url: string;
	tag?: string;
}

let configured = false;

export async function vapidPublicKey(): Promise<string> {
	let s = await getSecrets();
	if (!s.vapidPublicKey || !s.vapidPrivateKey) {
		const keys = webpush.generateVAPIDKeys();
		await saveSecrets({ vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey });
		s = await getSecrets();
		configured = false;
	}
	return s.vapidPublicKey;
}

async function ensureConfigured() {
	if (configured) return;
	await vapidPublicKey();
	const s = await getSecrets();
	const settings = await getSettings();
	webpush.setVapidDetails(`mailto:${settings.company.email || 'office@backyardboys.at'}`, s.vapidPublicKey, s.vapidPrivateKey);
	configured = true;
}

export function forgetVapid() {
	configured = false;
}

/** An alle aktiven Team-Mitglieder mit eingeschalteten Push-Nachrichten */
export async function pushToTeam(payload: PushPayload) {
	try {
		const recipients = await db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.active, true), eq(users.notifyPush, true)))
			.all();
		if (!recipients.length) return;
		const subs = await db
			.select()
			.from(pushSubscriptions)
			.where(
				inArray(
					pushSubscriptions.userId,
					recipients.map((r) => r.id)
				)
			)
			.all();
		await send(subs, payload);
	} catch (err) {
		console.error('[push]', err);
	}
}

/** Nur an die Geräte eines Benutzers (z. B. Test) */
export async function pushToUser(userId: number, payload: PushPayload) {
	const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
	await send(subs, payload);
}

async function send(subs: (typeof pushSubscriptions.$inferSelect)[], payload: PushPayload) {
	if (!subs.length) return;
	try {
		await ensureConfigured();
		const body = JSON.stringify(payload);
		await Promise.all(
			subs.map(async (s) => {
				try {
					await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: 'high' });
				} catch (err) {
					const status = (err as { statusCode?: number }).statusCode;
					// Abo gibt es nicht mehr (App gelöscht, Berechtigung entzogen)
					if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
					else console.error('[push]', status, (err as Error).message);
				}
			})
		);
	} catch (err) {
		console.error('[push]', err);
	}
}
