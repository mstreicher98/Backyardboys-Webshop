import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { client, DATA_DIR, PRIVATE_DIR, UPLOAD_DIR } from './db';
import { purgeCustomerAuth } from './customer-auth';
import { purgeOrphanFiles } from './files';
import { purgeOldCarts } from './shop/cart';
import { autoCancelUnpaid } from './shop/orders';
import { purgeExpired } from './auth';
import { flushViews } from './pageviews';

/**
 * Tägliche Sicherung unter data/backups/<Zeitstempel>/ mit
 *   shop.db  – konsistente Kopie der Datenbank (VACUUM INTO)
 *   uploads/      – alle Bilder, dateien/ – Kunden-Uploads und Entwürfe, als harte Links: unveränderte Dateien
 *                   belegen dadurch keinen zusätzlichen Platz
 * Die letzten 14 Sicherungen bleiben erhalten.
 */
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP = 14;
export const BACKUP_NAME_RE = /^\d{4}-\d{2}-\d{2}-\d{6}$/;

export interface BackupInfo {
	name: string;
	createdAt: Date;
	dbSize: number;
	images: number;
}

export function listBackups(): BackupInfo[] {
	if (!fs.existsSync(BACKUP_DIR)) return [];
	return fs
		.readdirSync(BACKUP_DIR)
		.filter((n) => BACKUP_NAME_RE.test(n))
		.map((name) => {
			const dir = path.join(BACKUP_DIR, name);
			const dbFile = path.join(dir, 'shop.db');
			const uploads = path.join(dir, 'uploads');
			return {
				name,
				createdAt: fs.statSync(dir).mtime,
				dbSize: fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0,
				images: fs.existsSync(uploads) ? fs.readdirSync(uploads).length : 0
			};
		})
		.sort((a, b) => b.name.localeCompare(a.name));
}

function stamp(d = new Date()) {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** `prune: false` behält alle älteren Stände – z. B. für die Sicherung vor einer Wiederherstellung */
export async function createBackup({ prune = true } = {}): Promise<string> {
	let name = stamp();
	while (fs.existsSync(path.join(BACKUP_DIR, name))) {
		await new Promise((r) => setTimeout(r, 1000));
		name = stamp();
	}
	const dir = path.join(BACKUP_DIR, name);
	fs.mkdirSync(dir, { recursive: true });
	await client.execute({ sql: 'VACUUM INTO ?', args: [path.join(dir, 'shop.db')] });
	for (const [folder, source] of [
		['uploads', UPLOAD_DIR],
		['dateien', PRIVATE_DIR]
	] as const) {
		const target = path.join(dir, folder);
		fs.mkdirSync(target, { recursive: true });
		for (const f of fs.readdirSync(source)) {
			const src = path.join(source, f);
			const dest = path.join(target, f);
			try {
				fs.linkSync(src, dest);
			} catch {
				// z. B. anderes Laufwerk – dann eben kopieren
				fs.copyFileSync(src, dest);
			}
		}
	}
	if (prune) {
		for (const old of listBackups().slice(KEEP)) {
			fs.rmSync(path.join(BACKUP_DIR, old.name), { recursive: true, force: true });
		}
	}
	return name;
}

/** Sicherung als unkomprimiertes tar-Archiv streamen (Bilder sind schon komprimiert) */
export function backupStream(name: string): ReadableStream<Uint8Array> {
	if (!BACKUP_NAME_RE.test(name) || !fs.existsSync(path.join(BACKUP_DIR, name))) throw new Error('Unbekannte Sicherung');
	const tar = spawn('tar', ['-cf', '-', '-C', BACKUP_DIR, name], { stdio: ['ignore', 'pipe', 'inherit'] });
	return Readable.toWeb(tar.stdout) as ReadableStream<Uint8Array>;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Stündlich prüfen: einmal pro Nacht (ab 2 Uhr) sichern, Abgelaufenes aufräumen */
export function scheduleMaintenance() {
	if (timer) return;
	const tick = async () => {
		try {
			const now = new Date();
			const today = stamp(now).slice(0, 10);
			const latest = listBackups()[0];
			if (now.getHours() >= 2 && (!latest || !latest.name.startsWith(today))) {
				const name = await createBackup();
				console.info(`[sicherung] ${name} erstellt`);
			}
			await purgeExpired();
			await purgeCustomerAuth();
			await purgeOldCarts();
			await purgeOrphanFiles();
			await autoCancelUnpaid();
		} catch (err) {
			console.error('[sicherung]', err);
		}
	};
	timer = setInterval(tick, 60 * 60_000);
	timer.unref?.();
	setTimeout(tick, 30_000).unref?.();

	const flushAndExit = () => {
		void flushViews().finally(() => process.exit(0));
	};
	process.once('SIGTERM', flushAndExit);
	process.once('SIGINT', flushAndExit);
}
