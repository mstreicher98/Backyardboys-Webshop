import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, lt, sql } from 'drizzle-orm';
import { dev } from '$app/environment';
import { db } from './db';
import { loginChallenges, sessions, users, type User } from './db/schema';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT);
	return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
	const [algo, N, r, p, saltB64, hashB64] = stored.split('$');
	if (algo !== 'scrypt') return false;
	const expected = Buffer.from(hashB64, 'base64');
	const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
		N: Number(N),
		r: Number(r),
		p: Number(p),
		maxmem: SCRYPT.maxmem
	});
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Vergleichs-Hash, damit auch unbekannte Benutzer gleich lange brauchen */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordTime(password: string) {
	dummyHash ??= hashPassword('kein-benutzer');
	await verifyPassword(await dummyHash, password);
}

/** Lesbares Einmal-Passwort ohne verwechselbare Zeichen */
export function generatePassword(length = 14): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
	const bytes = randomBytes(length);
	let out = '';
	for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
	return out;
}

export function passwordProblem(password: string, confirm?: string): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) return `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
	if (password.length > 200) return 'Das Passwort ist zu lang.';
	if (confirm !== undefined && password !== confirm) return 'Die beiden Passwörter stimmen nicht überein.';
	return null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

/* ---------------------------------------------------------------- Sitzungen */

export const SESSION_COOKIE = 'byb_team';
export const CHALLENGE_COOKIE = 'byb_team_2fa';
const DAY = 86_400_000;
const PERSISTENT_TTL = 30 * DAY;
const SHORT_TTL = 12 * 60 * 60 * 1000;
const CHALLENGE_TTL = 5 * 60_000;

export type SessionUser = Pick<User, 'id' | 'username' | 'name' | 'email' | 'role' | 'owner' | 'mustChangePassword' | 'totpEnabled'>;

export async function createSession(userId: number, persistent: boolean, userAgent: string | null) {
	const token = newToken();
	const expiresAt = new Date(Date.now() + (persistent ? PERSISTENT_TTL : SHORT_TTL));
	await db.insert(sessions).values({
		id: sha256(token),
		userId,
		expiresAt,
		persistent,
		userAgent: userAgent?.slice(0, 250) ?? null
	});
	await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
	return { token, expiresAt, persistent };
}

const cookieBase = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: !dev };

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date, persistent: boolean) {
	cookies.set(SESSION_COOKIE, token, { ...cookieBase, ...(persistent ? { expires: expiresAt } : {}) });
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Prüft das Cookie und verlängert die Sitzung bei Aktivität */
export async function validateSession(token: string): Promise<SessionUser | null> {
	const id = sha256(token);
	const row = await db
		.select({
			expiresAt: sessions.expiresAt,
			persistent: sessions.persistent,
			id: users.id,
			username: users.username,
			name: users.name,
			email: users.email,
			role: users.role,
			owner: users.owner,
			active: users.active,
			mustChangePassword: users.mustChangePassword,
			totpEnabled: users.totpEnabled
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;
	const now = Date.now();
	if (row.expiresAt.getTime() < now || !row.active) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	const ttl = row.persistent ? PERSISTENT_TTL : SHORT_TTL;
	// Nur verlängern, wenn schon ein Teil der Laufzeit verbraucht ist – spart Schreibzugriffe
	if (row.expiresAt.getTime() - now < ttl - (row.persistent ? DAY : 15 * 60_000)) {
		await db
			.update(sessions)
			.set({ expiresAt: new Date(now + ttl) })
			.where(eq(sessions.id, id));
	}
	const { expiresAt: _e, persistent: _p, active: _a, ...user } = row;
	return user;
}

export async function invalidateSession(token: string) {
	await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function invalidateUserSessions(userId: number, exceptToken?: string) {
	if (exceptToken) {
		await db.delete(sessions).where(and(eq(sessions.userId, userId), sql`${sessions.id} <> ${sha256(exceptToken)}`));
	} else {
		await db.delete(sessions).where(eq(sessions.userId, userId));
	}
}

export async function purgeExpired() {
	const now = new Date();
	await db.delete(sessions).where(lt(sessions.expiresAt, now));
	await db.delete(loginChallenges).where(lt(loginChallenges.expiresAt, now));
}

/* ------------------------------------------------- Zweiter Faktor (Login) */

export async function createChallenge(cookies: Cookies, userId: number, persistent: boolean) {
	const token = newToken();
	await db.delete(loginChallenges).where(eq(loginChallenges.userId, userId));
	await db.insert(loginChallenges).values({
		id: sha256(token),
		userId,
		persistent,
		expiresAt: new Date(Date.now() + CHALLENGE_TTL)
	});
	cookies.set(CHALLENGE_COOKIE, token, { ...cookieBase, maxAge: CHALLENGE_TTL / 1000 });
}

export async function readChallenge(cookies: Cookies) {
	const token = cookies.get(CHALLENGE_COOKIE);
	if (!token) return null;
	const row = await db
		.select()
		.from(loginChallenges)
		.where(eq(loginChallenges.id, sha256(token)))
		.get();
	if (!row || row.expiresAt.getTime() < Date.now() || row.attempts >= 5) return null;
	return row;
}

export async function failChallenge(id: string) {
	await db
		.update(loginChallenges)
		.set({ attempts: sql`${loginChallenges.attempts} + 1` })
		.where(eq(loginChallenges.id, id));
}

export async function clearChallenge(cookies: Cookies, id?: string) {
	if (id) await db.delete(loginChallenges).where(eq(loginChallenges.id, id));
	cookies.delete(CHALLENGE_COOKIE, { path: '/' });
}

/* ---------------------------------------------------------- Rate-Limiting */

const attempts = new Map<string, { count: number; first: number }>();
export const LOCK_WINDOW_MS = 15 * 60_000;

/** true = gesperrt. Zählt Fehlversuche je Schlüssel in einem Zeitfenster. */
export function isRateLimited(key: string, max = 6, windowMs = LOCK_WINDOW_MS): boolean {
	const a = attempts.get(key);
	if (!a) return false;
	if (Date.now() - a.first > windowMs) {
		attempts.delete(key);
		return false;
	}
	return a.count >= max;
}

export function registerFailure(key: string, windowMs = LOCK_WINDOW_MS) {
	const now = Date.now();
	const a = attempts.get(key);
	if (!a || now - a.first > windowMs) attempts.set(key, { count: 1, first: now });
	else a.count++;
	if (attempts.size > 5000) {
		for (const [k, v] of attempts) if (now - v.first > windowMs) attempts.delete(k);
	}
}

export function clearFailures(key: string) {
	attempts.delete(key);
}
