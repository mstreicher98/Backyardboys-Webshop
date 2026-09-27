#!/usr/bin/env node
/**
 * Notfall-Zugang, falls sich niemand mehr anmelden kann (z. B. Handy mit der
 * Authenticator-App verloren und kein anderer Admin da).
 *
 *   node scripts/zugang.mjs liste
 *   node scripts/zugang.mjs zuruecksetzen <benutzername>
 *
 * Im Docker-Container:
 *   In Portainer: Container „app“ → Console → node scripts/zugang.mjs zuruecksetzen admin
 *
 * „zuruecksetzen“ erzeugt ein neues vorläufiges Passwort, schaltet die
 * Zwei-Faktor-Anmeldung zurück, entsperrt den Zugang und meldet alle Geräte ab.
 * Beim nächsten Login werden Passwort und Authenticator-App neu eingerichtet.
 */
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

const scrypt = promisify(scryptCb);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
	const salt = randomBytes(16);
	const hash = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT);
	return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function generatePassword(length = 16) {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
	const bytes = randomBytes(length);
	return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

const dbFile = path.join(path.resolve(process.env.DATA_DIR || 'data'), 'shop.db');
const db = createClient({ url: `file:${dbFile}` });
const [cmd, username] = process.argv.slice(2);

if (cmd === 'liste') {
	const { rows } = await db.execute('SELECT username, name, role, active, totp_enabled FROM users ORDER BY name');
	for (const r of rows) {
		console.log(`${String(r.username).padEnd(20)} ${String(r.name).padEnd(28)} ${r.role}${r.active ? '' : ' (gesperrt)'}${r.totp_enabled ? '' : ' (2FA offen)'}`);
	}
} else if (cmd === 'zuruecksetzen' && username) {
	const { rows } = await db.execute({ sql: 'SELECT id, name FROM users WHERE username = ?', args: [username.toLowerCase()] });
	if (!rows.length) {
		console.error(`Benutzer „${username}“ nicht gefunden. Mit „liste“ alle anzeigen.`);
		process.exit(1);
	}
	const password = generatePassword();
	const id = rows[0].id;
	await db.batch(
		[
			{
				sql: 'UPDATE users SET password_hash = ?, must_change_password = 1, totp_enabled = 0, totp_secret = NULL, totp_last_step = NULL, active = 1 WHERE id = ?',
				args: [await hashPassword(password), id]
			},
			{ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [id] },
			{ sql: 'DELETE FROM login_challenges WHERE user_id = ?', args: [id] }
		],
		'write'
	);
	console.log(`\nZugang von ${rows[0].name} zurückgesetzt.\n  Benutzername: ${username.toLowerCase()}\n  Passwort:     ${password}\n\nBeim nächsten Login werden ein eigenes Passwort und die Authenticator-App eingerichtet.\n`);
} else {
	console.log('Verwendung:\n  node scripts/zugang.mjs liste\n  node scripts/zugang.mjs zuruecksetzen <benutzername>');
	process.exit(cmd ? 1 : 0);
}
