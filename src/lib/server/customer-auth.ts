import { createHash, randomBytes } from 'node:crypto';
import { redirect, type Cookies } from '@sveltejs/kit';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { dev } from '$app/environment';
import { delocalizePath, localizePath } from '$lib/i18n.svelte';
import { db } from './db';
import { customers, customerSessions, customerTokens, orders, type Customer } from './db/schema';

/**
 * Anmeldung der Kunden – getrennt vom Team-Login (eigenes Cookie, eigene Tabellen).
 * Möglich mit Passwort oder mit einem Einmal-Link per E-Mail.
 */

export const CUSTOMER_COOKIE = 'byb_kunde';
const DAY = 86_400_000;
const PERSISTENT_TTL = 60 * DAY;
const SHORT_TTL = DAY;
const TOKEN_TTL = { login: 30 * 60_000, verify: 3 * DAY, reset: 60 * 60_000 } as const;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

export type SessionCustomer = Pick<
	Customer,
	'id' | 'email' | 'firstName' | 'lastName' | 'company' | 'vatId' | 'vatIdValid' | 'dealerStatus' | 'dealerDiscount' | 'locale' | 'phone' | 'emailVerifiedAt'
>;

const cookieBase = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: !dev };

export async function createCustomerSession(cookies: Cookies, customerId: number, persistent: boolean) {
	const token = newToken();
	const expiresAt = new Date(Date.now() + (persistent ? PERSISTENT_TTL : SHORT_TTL));
	await db.insert(customerSessions).values({ id: sha256(token), customerId, expiresAt, persistent });
	await db.update(customers).set({ lastLoginAt: new Date() }).where(eq(customers.id, customerId));
	cookies.set(CUSTOMER_COOKIE, token, { ...cookieBase, ...(persistent ? { expires: expiresAt } : {}) });
}

export async function validateCustomerSession(token: string): Promise<SessionCustomer | null> {
	const id = sha256(token);
	const row = await db
		.select({ session: customerSessions, customer: customers })
		.from(customerSessions)
		.innerJoin(customers, eq(customers.id, customerSessions.customerId))
		.where(eq(customerSessions.id, id))
		.get();
	if (!row) return null;
	const now = Date.now();
	if (row.session.expiresAt.getTime() < now || !row.customer.active) {
		await db.delete(customerSessions).where(eq(customerSessions.id, id));
		return null;
	}
	const ttl = row.session.persistent ? PERSISTENT_TTL : SHORT_TTL;
	if (row.session.expiresAt.getTime() - now < ttl - (row.session.persistent ? DAY : 30 * 60_000)) {
		await db
			.update(customerSessions)
			.set({ expiresAt: new Date(now + ttl) })
			.where(eq(customerSessions.id, id));
	}
	const c = row.customer;
	return {
		id: c.id,
		email: c.email,
		firstName: c.firstName,
		lastName: c.lastName,
		company: c.company,
		vatId: c.vatId,
		vatIdValid: c.vatIdValid,
		dealerStatus: c.dealerStatus,
		dealerDiscount: c.dealerDiscount,
		locale: c.locale,
		phone: c.phone,
		emailVerifiedAt: c.emailVerifiedAt
	};
}

export async function endCustomerSession(cookies: Cookies) {
	const token = cookies.get(CUSTOMER_COOKIE);
	if (token) await db.delete(customerSessions).where(eq(customerSessions.id, sha256(token)));
	cookies.delete(CUSTOMER_COOKIE, { path: '/' });
}

export async function endAllCustomerSessions(customerId: number) {
	await db.delete(customerSessions).where(eq(customerSessions.customerId, customerId));
}

/* ------------------------------------------------------------ Einmal-Links */

export async function createCustomerToken(email: string, purpose: keyof typeof TOKEN_TTL, customerId: number | null): Promise<string> {
	const token = newToken();
	// Ältere offene Links desselben Zwecks werden ungültig
	await db
		.update(customerTokens)
		.set({ usedAt: new Date() })
		.where(and(eq(customerTokens.email, email), eq(customerTokens.purpose, purpose), isNull(customerTokens.usedAt)));
	await db.insert(customerTokens).values({
		id: sha256(token),
		email,
		customerId,
		purpose,
		expiresAt: new Date(Date.now() + TOKEN_TTL[purpose])
	});
	return token;
}

/** Link einlösen: gibt E-Mail und Kunde zurück, danach ist der Link verbraucht */
export async function consumeCustomerToken(token: string, purpose: keyof typeof TOKEN_TTL) {
	const row = await db
		.select()
		.from(customerTokens)
		.where(and(eq(customerTokens.id, sha256(token)), eq(customerTokens.purpose, purpose)))
		.get();
	if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
	await db.update(customerTokens).set({ usedAt: new Date() }).where(eq(customerTokens.id, row.id));
	return row;
}

/** Nur prüfen, nicht verbrauchen (Formular „Neues Passwort“ anzeigen) */
export async function peekCustomerToken(token: string, purpose: keyof typeof TOKEN_TTL) {
	const row = await db
		.select()
		.from(customerTokens)
		.where(and(eq(customerTokens.id, sha256(token)), eq(customerTokens.purpose, purpose)))
		.get();
	return row && !row.usedAt && row.expiresAt.getTime() > Date.now() ? row : null;
}

/**
 * E-Mail bestätigt (Link geklickt oder per Mail-Link angemeldet): frühere
 * Bestellungen ohne Konto mit derselben Adresse werden dem Konto zugeordnet.
 */
export async function markEmailVerified(customerId: number, email: string) {
	await db
		.update(customers)
		.set({ emailVerifiedAt: sql`coalesce(${customers.emailVerifiedAt}, ${Date.now()})` })
		.where(eq(customers.id, customerId));
	await db
		.update(orders)
		.set({ customerId })
		.where(and(isNull(orders.customerId), sql`lower(${orders.email}) = ${email.toLowerCase()}`));
}

export async function purgeCustomerAuth() {
	const now = new Date();
	await db.delete(customerSessions).where(lt(customerSessions.expiresAt, now));
	await db.delete(customerTokens).where(lt(customerTokens.expiresAt, new Date(now.getTime() - 7 * DAY)));
}

export const normalizeEmail = (s: string) => s.trim().toLowerCase().slice(0, 200);
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200;

/** Nur interne Ziele nach dem Login (interner, deutscher Pfad) */
export const safeTarget = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/admin') ? v : '/konto');

/**
 * Angemeldeten Kunden verlangen – in jeder Konto-Seite selbst aufrufen:
 * SvelteKit lädt Layout und Seite parallel, die Prüfung im Layout allein reicht nicht.
 */
export function requireCustomer(locals: App.Locals, url?: URL): SessionCustomer {
	if (!locals.customer) {
		const weiter = url ? delocalizePath(url.pathname) : '/konto';
		redirect(303, `${localizePath('/konto/anmelden', locals.locale)}${weiter !== '/konto' ? `?weiter=${encodeURIComponent(weiter)}` : ''}`);
	}
	return locals.customer;
}
