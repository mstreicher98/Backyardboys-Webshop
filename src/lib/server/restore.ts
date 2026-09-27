import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { BackupSummary } from '$lib/types';
import { BACKUP_DIR, BACKUP_NAME_RE, createBackup } from './backup';
import { client, DATA_DIR, migrationsPath, PRIVATE_DIR, UPLOAD_DIR } from './db';
import { forgetSecrets } from './secrets';
import { forgetSettings } from './settings';
import { extractEntry, readTar, type TarEntry } from './tar';

/**
 * Sicherung wiederherstellen – einen Stand aus der Liste am Server oder eine
 * heruntergeladene .tar-Datei. Die Datei kommt in Stücken zu je 8 MB, damit die
 * Größenbeschränkung für Anfragen (30 MB) bleiben kann.
 *
 * Ablauf: hochladen → prüfen (Aufbau, Datenbank lesbar, Versionsstand) →
 * wiederherstellen. Vor dem Wiederherstellen wird der aktuelle Stand als
 * Sicherung abgelegt; danach sind alle abgemeldet.
 */

const STAGING_DIR = path.join(DATA_DIR, 'wiederherstellung');
export const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_ARCHIVE = 50 * 1024 ** 3;
const STALE_MS = 24 * 60 * 60_000;
const UPLOAD_ID_RE = /^[0-9a-f]{24}$/;
/** Dateien, wie media.ts sie anlegt – alles andere im Archiv wird ignoriert */
const MEDIA_FILE_RE = /^[0-9a-f]{20}-(\d{2,4}\.webp|[a-z0-9-]{1,60}\.pdf)$/;
/** Private Dateien (Kunden-Uploads, Entwürfe), wie files.ts sie anlegt */
const PRIVATE_FILE_RE = /^[A-Za-z0-9_-]{24}(-vorschau\.webp|\.[a-z0-9]{2,5})$/;
/** Ordner in der Sicherung → Ordner am Server und erlaubte Dateinamen */
const FOLDERS: Record<string, { dir: string; re: RegExp }> = {
	uploads: { dir: UPLOAD_DIR, re: MEDIA_FILE_RE },
	dateien: { dir: PRIVATE_DIR, re: PRIVATE_FILE_RE }
};
/** Anmeldungen werden nicht übernommen – nach dem Wiederherstellen sind alle abgemeldet */
const SKIP_TABLES = new Set(['sessions', 'login_challenges', 'customer_sessions', 'customer_tokens']);

export class RestoreError extends Error {}

interface UploadMeta {
	size: number;
	name: string;
	createdAt: number;
	summary?: BackupSummary;
}

const staged = (id: string, ext: 'tar' | 'db' | 'json') => path.join(STAGING_DIR, `${id}.${ext}`);
const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;

function readMeta(id: string): UploadMeta {
	if (!UPLOAD_ID_RE.test(id) || !fs.existsSync(staged(id, 'json'))) throw new RestoreError('Hochgeladene Datei nicht gefunden – bitte neu hochladen.');
	return JSON.parse(fs.readFileSync(staged(id, 'json'), 'utf8'));
}

/**
 * Löschen, auch wenn die Datei noch gesperrt ist: libsql gibt eine Datenbankdatei
 * nach `close()` erst frei, wenn die Garbage Collection die Abfragen aufgeräumt
 * hat – unter Windows lässt sie sich bis dahin nicht löschen. Was dann noch
 * übrig bleibt, räumt `cleanStale` nach einem Tag auf.
 */
const RETRY_MS = [5_000, 60_000, 600_000];
function remove(file: string, attempt = 0) {
	try {
		fs.rmSync(file, { force: true });
	} catch {
		if (attempt < RETRY_MS.length) setTimeout(() => remove(file, attempt + 1), RETRY_MS[attempt]).unref?.();
	}
}

/** Liegengebliebene Uploads nach einem Tag löschen */
function cleanStale() {
	if (!fs.existsSync(STAGING_DIR)) return;
	for (const f of fs.readdirSync(STAGING_DIR)) {
		const p = path.join(STAGING_DIR, f);
		try {
			if (Date.now() - fs.statSync(p).mtimeMs > STALE_MS) fs.rmSync(p, { force: true, recursive: true });
		} catch {
			/* gerade in Verwendung */
		}
	}
}

function freeBytes(dir: string): number | null {
	try {
		const s = fs.statfsSync(dir);
		return s.bavail * s.bsize;
	} catch {
		return null;
	}
}

/* ================================================================ Hochladen */

export function startUpload(size: number, name: string): string {
	if (!Number.isSafeInteger(size) || size < 1024 || size > MAX_ARCHIVE) throw new RestoreError('Diese Datei ist keine Sicherung.');
	fs.mkdirSync(STAGING_DIR, { recursive: true });
	cleanStale();
	const free = freeBytes(STAGING_DIR);
	if (free !== null && free < size * 1.1 + 200 * 1024 ** 2) {
		throw new RestoreError(`Zu wenig Speicherplatz am Server: ${gb(free)} frei, die Sicherung braucht ${gb(size)}.`);
	}
	const id = crypto.randomBytes(12).toString('hex');
	fs.writeFileSync(staged(id, 'tar'), '');
	const meta: UploadMeta = { size, name: name.slice(0, 200), createdAt: Date.now() };
	fs.writeFileSync(staged(id, 'json'), JSON.stringify(meta));
	return id;
}

/** Hängt ein Stück an und meldet, wie viel angekommen ist. Doppelt geschickte Stücke werden ignoriert. */
export async function appendChunk(id: string, offset: number, data: Uint8Array): Promise<number> {
	const meta = readMeta(id);
	const file = staged(id, 'tar');
	const have = fs.statSync(file).size;
	if (offset !== have) return have;
	if (data.byteLength === 0 || data.byteLength > CHUNK_SIZE || have + data.byteLength > meta.size) throw new RestoreError('Ungültiges Teilstück.');
	await fs.promises.appendFile(file, data);
	return have + data.byteLength;
}

export function discardUpload(id: string) {
	if (!UPLOAD_ID_RE.test(id)) return;
	for (const ext of ['tar', 'db', 'json'] as const) remove(staged(id, ext));
}

/* ================================================================ Prüfen */

interface Layout {
	db: TarEntry;
	stamp: string | null;
	files: number;
}

/** Erwartet genau einen Ordner mit shop.db und uploads/ – so wie „Herunterladen“ ihn packt */
async function scanArchive(file: string): Promise<Layout> {
	let top: string | null = null;
	let db: TarEntry | null = null;
	let files = 0;
	try {
		for await (const e of readTar(file)) {
			const parts = e.name.split('/').filter(Boolean);
			if (!parts.length) continue;
			top ??= parts[0];
			if (parts[0] !== top) throw new RestoreError('Das Archiv enthält mehr als eine Sicherung.');
			if (parts.length === 2 && parts[1] === 'shop.db' && e.type === '0') db = e;
			else if (parts.length === 3 && FOLDERS[parts[1]]?.re.test(parts[2]) && (e.type === '0' || e.type === '1')) files++;
		}
	} catch (err) {
		if (err instanceof RestoreError) throw err;
		throw new RestoreError('Das ist keine Sicherung dieser Webseite. Erwartet wird die .tar-Datei aus „Herunterladen“.');
	}
	if (!db) throw new RestoreError('In der Datei fehlt die Datenbank (shop.db).');
	return { db, stamp: top && BACKUP_NAME_RE.test(top) ? top : null, files };
}

function knownMigrations(): number {
	return JSON.parse(fs.readFileSync(path.join(migrationsPath(), 'meta', '_journal.json'), 'utf8')).entries.length;
}

async function summarize(dbFile: string): Promise<Omit<BackupSummary, 'stamp' | 'files'>> {
	let c: Client | null = null;
	try {
		c = createClient({ url: `file:${dbFile}` });
		const check = await c.execute('PRAGMA quick_check');
		if (String(Object.values(check.rows[0] ?? {})[0]) !== 'ok') throw new RestoreError('Die Datenbank in der Sicherung ist beschädigt.');
		const tables = new Set((await c.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map((r) => String(r.name)));
		for (const t of ['orders', 'products', 'media', 'users']) {
			if (!tables.has(t)) throw new RestoreError('Die Datenbank in der Datei gehört nicht zu diesem Shop.');
		}
		const db = c;
		const count = async (t: string) => (tables.has(t) ? Number((await db.execute(`SELECT count(*) AS n FROM "${t}"`)).rows[0].n) : 0);
		const applied = await count('__drizzle_migrations');
		const known = knownMigrations();
		if (applied > known) throw new RestoreError('Die Sicherung stammt von einer neueren Version der Webseite. Bitte zuerst die Webseite aktualisieren.');
		const last = await c.execute('SELECT max(created_at) AS d FROM orders');
		const users = await c.execute('SELECT username FROM users ORDER BY username');
		const lastMs = last.rows[0]?.d != null ? Number(last.rows[0].d) : null;
		return {
			products: await count('products'),
			orders: await count('orders'),
			customers: await count('customers'),
			invoices: await count('invoices'),
			media: await count('media'),
			users: users.rows.map((r) => String(r.username)),
			lastOrder: lastMs ? new Date(lastMs).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' }) : null,
			older: applied < known
		};
	} catch (err) {
		if (err instanceof RestoreError) throw err;
		throw new RestoreError('Die Datenbank in der Sicherung lässt sich nicht lesen.');
	} finally {
		c?.close();
	}
}

/** Nach vollständigem Upload: Aufbau prüfen, Datenbank auspacken und auswerten */
export async function inspectUpload(id: string): Promise<BackupSummary> {
	const meta = readMeta(id);
	const file = staged(id, 'tar');
	if (fs.statSync(file).size !== meta.size) throw new RestoreError('Die Datei ist noch nicht vollständig hochgeladen.');
	const layout = await scanArchive(file);
	await extractEntry(file, layout.db, staged(id, 'db'));
	const summary: BackupSummary = { ...(await summarize(staged(id, 'db'))), stamp: layout.stamp, files: layout.files };
	fs.writeFileSync(staged(id, 'json'), JSON.stringify({ ...meta, summary }));
	return summary;
}

function backupDir(name: string): string {
	const dir = path.join(BACKUP_DIR, name);
	if (!BACKUP_NAME_RE.test(name) || !fs.existsSync(path.join(dir, 'shop.db'))) throw new RestoreError('Diese Sicherung gibt es nicht.');
	return dir;
}

const countFiles = (dir: string) =>
	Object.entries(FOLDERS).reduce((n, [folder, { re }]) => {
		const d = path.join(dir, folder);
		return n + (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => re.test(f)).length : 0);
	}, 0);

/** Stand aus der Liste am Server auswerten – an einer Kopie, die Sicherung selbst bleibt unberührt */
export async function inspectBackup(name: string): Promise<BackupSummary> {
	const dir = backupDir(name);
	fs.mkdirSync(STAGING_DIR, { recursive: true });
	const tmp = path.join(STAGING_DIR, `pruefen-${crypto.randomBytes(6).toString('hex')}.db`);
	fs.copyFileSync(path.join(dir, 'shop.db'), tmp);
	try {
		return { ...(await summarize(tmp)), stamp: name, files: countFiles(dir) };
	} finally {
		remove(tmp);
	}
}

/* ================================================================ Wiederherstellen */

const sameSize = (file: string, size: number) => {
	try {
		return fs.statSync(file).size === size;
	} catch {
		return false;
	}
};

/** Dateien aus dem Archiv – vorhandene gleich große Dateien bleiben (Dateinamen sind zufällig und eindeutig) */
async function filesFromArchive(file: string, keep: Set<string>) {
	const links: { entry: TarEntry; folder: string }[] = [];
	for await (const e of readTar(file)) {
		const parts = e.name.split('/').filter(Boolean);
		const target = parts.length === 3 ? FOLDERS[parts[1]] : undefined;
		if (!target || !target.re.test(parts[2])) continue;
		if (e.type === '1') {
			links.push({ entry: e, folder: parts[1] });
			continue;
		}
		if (e.type !== '0') continue;
		keep.add(`${parts[1]}/${parts[2]}`);
		const dest = path.join(target.dir, parts[2]);
		if (sameSize(dest, e.size)) continue;
		await extractEntry(file, e, `${dest}.part`);
		fs.renameSync(`${dest}.part`, dest);
	}
	// harte Links im Archiv zeigen auf eine schon ausgepackte Datei
	for (const { entry, folder } of links) {
		const { dir, re } = FOLDERS[folder];
		const name = path.basename(entry.name);
		const target = path.basename(entry.linkName);
		if (!re.test(target) || !keep.has(`${folder}/${target}`)) continue;
		keep.add(`${folder}/${name}`);
		const dest = path.join(dir, name);
		if (!fs.existsSync(dest)) fs.copyFileSync(path.join(dir, target), dest);
	}
}

function filesFromFolder(backup: string, keep: Set<string>) {
	for (const [folder, { dir: destDir, re }] of Object.entries(FOLDERS)) {
		const dir = path.join(backup, folder);
		if (!fs.existsSync(dir)) continue;
		for (const name of fs.readdirSync(dir)) {
			if (!re.test(name)) continue;
			keep.add(`${folder}/${name}`);
			const src = path.join(dir, name);
			const dest = path.join(destDir, name);
			if (sameSize(dest, fs.statSync(src).size)) continue;
			try {
				fs.linkSync(src, dest);
			} catch {
				fs.copyFileSync(src, dest);
			}
		}
	}
}

/** Ältere Sicherungen auf den aktuellen Aufbau der Datenbank bringen */
async function upgrade(file: string) {
	const c = createClient({ url: `file:${file}` });
	try {
		await migrate(drizzle(c), { migrationsFolder: migrationsPath() });
	} finally {
		c.close();
	}
}

async function columns(c: Client): Promise<Map<string, string[]>> {
	const out = new Map<string, string[]>();
	const tables = await c.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'");
	for (const r of tables.rows) {
		const name = String(r.name);
		const info = await c.execute(`PRAGMA table_info("${name.replace(/"/g, '""')}")`);
		out.set(
			name,
			info.rows.map((x) => String(x.name))
		);
	}
	return out;
}

/**
 * Inhalt aller Tabellen in einem Zug austauschen. Läuft als ein Skript auf
 * einer einzigen Verbindung (ATTACH und Pragmas gelten nur für diese) und in
 * einer Transaktion – schlägt etwas fehl, bleibt der bisherige Inhalt.
 */
async function replaceContent(file: string) {
	const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
	const src = createClient({ url: `file:${file}` });
	let from: Map<string, string[]>;
	try {
		from = await columns(src);
	} finally {
		src.close();
	}
	const alias = `quelle_${crypto.randomBytes(4).toString('hex')}`;
	const sql = ['PRAGMA foreign_keys = OFF', `ATTACH DATABASE '${file.replace(/'/g, "''")}' AS ${alias}`, 'BEGIN IMMEDIATE'];
	for (const [table, cols] of await columns(client)) {
		sql.push(`DELETE FROM main.${q(table)}`);
		const srcCols = from.get(table);
		if (!srcCols || SKIP_TABLES.has(table)) continue;
		const shared = cols.filter((c) => srcCols.includes(c)).map(q).join(', ');
		if (shared) sql.push(`INSERT INTO main.${q(table)} (${shared}) SELECT ${shared} FROM ${alias}.${q(table)}`);
	}
	sql.push('COMMIT', `DETACH DATABASE ${alias}`, 'PRAGMA foreign_keys = ON');
	try {
		await client.executeMultiple(sql.join(';\n') + ';');
	} catch (err) {
		// Verbindung aufräumen (die Transaktion hat der Pool schon zurückgerollt)
		await client.executeMultiple(`DETACH DATABASE ${alias}; PRAGMA foreign_keys = ON;`).catch(() => {});
		throw err;
	}
}

let running = false;

export type RestoreSource = { upload: string } | { backup: string };

export async function restoreBackup(source: RestoreSource): Promise<{ safety: string; summary: BackupSummary }> {
	if (running) throw new RestoreError('Es läuft bereits eine Wiederherstellung.');
	running = true;
	fs.mkdirSync(STAGING_DIR, { recursive: true });
	const work = path.join(STAGING_DIR, `db-${crypto.randomBytes(6).toString('hex')}.db`);
	try {
		let summary: BackupSummary;
		let restoreFiles: (keep: Set<string>) => Promise<void> | void;
		if ('upload' in source) {
			const meta = readMeta(source.upload);
			if (!meta.summary || !fs.existsSync(staged(source.upload, 'db'))) throw new RestoreError('Die Datei wurde noch nicht geprüft.');
			summary = meta.summary;
			fs.copyFileSync(staged(source.upload, 'db'), work);
			const tar = staged(source.upload, 'tar');
			restoreFiles = (keep) => filesFromArchive(tar, keep);
		} else {
			const dir = backupDir(source.backup);
			fs.copyFileSync(path.join(dir, 'shop.db'), work);
			summary = { ...(await summarize(work)), stamp: source.backup, files: countFiles(dir) };
			restoreFiles = (keep) => filesFromFolder(dir, keep);
		}

		await upgrade(work);
		// Der aktuelle Stand bleibt als Sicherung erhalten – ältere Stände werden dabei nicht aufgeräumt
		const safety = await createBackup({ prune: false });
		const keep = new Set<string>();
		await restoreFiles(keep);
		await replaceContent(work);
		// Dateien, die es im wiederhergestellten Stand nicht gibt (sie liegen in der Sicherung von eben)
		for (const [folder, { dir, re }] of Object.entries(FOLDERS)) {
			for (const f of fs.readdirSync(dir)) {
				if ((re.test(f) && !keep.has(`${folder}/${f}`)) || f.endsWith('.part')) fs.rmSync(path.join(dir, f), { force: true });
			}
		}
		forgetSettings();
		forgetSecrets();
		if ('upload' in source) discardUpload(source.upload);
		return { safety, summary };
	} finally {
		running = false;
		remove(work);
	}
}
