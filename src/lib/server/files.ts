import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import heicDecode from 'heic-decode';
import sharp from 'sharp';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { db, PRIVATE_DIR } from './db';
import { files, type FileRow } from './db/schema';

/**
 * Nicht öffentliche Dateien: Fotos vom Bike, Logos und Vorlagen der Kunden,
 * Entwürfe des Teams. Das Original bleibt unverändert (für den Druck wichtig),
 * Bilder bekommen zusätzlich eine kleine WebP-Vorschau.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class FileError extends Error {}

interface Kind {
	mime: string;
	ext: string;
	image: boolean;
}

/** Erkennung am Dateiinhalt, nicht an der Endung */
function detect(buf: Buffer, name: string): Kind | null {
	const head = buf.subarray(0, 16);
	const ascii = head.toString('latin1');
	if (head[0] === 0xff && head[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg', image: true };
	if (ascii.startsWith('\x89PNG')) return { mime: 'image/png', ext: 'png', image: true };
	if (ascii.startsWith('GIF8')) return { mime: 'image/gif', ext: 'gif', image: true };
	if (ascii.startsWith('RIFF') && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp', image: true };
	if (/^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(buf.subarray(4, 12).toString('latin1'))) return { mime: 'image/heic', ext: 'heic', image: true };
	if (/^ftyp(avif|avis)/.test(buf.subarray(4, 12).toString('latin1'))) return { mime: 'image/avif', ext: 'avif', image: true };
	if (ascii.startsWith('%PDF-')) {
		// Adobe Illustrator speichert als PDF mit .ai-Endung
		return /\.ai$/i.test(name) ? { mime: 'application/postscript', ext: 'ai', image: false } : { mime: 'application/pdf', ext: 'pdf', image: false };
	}
	if (ascii.startsWith('%!PS')) return { mime: 'application/postscript', ext: /\.ai$/i.test(name) ? 'ai' : 'eps', image: false };
	if (head[0] === 0xc5 && head[1] === 0xd0 && head[2] === 0xd3 && head[3] === 0xc6) return { mime: 'application/postscript', ext: 'eps', image: false };
	if (ascii.startsWith('PK\x03\x04')) return { mime: 'application/zip', ext: 'zip', image: false };
	const text = buf.subarray(0, 2048).toString('utf8').trimStart();
	if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) return { mime: 'image/svg+xml', ext: 'svg', image: false };
	return null;
}

export const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.avif,.pdf,.ai,.eps,.svg,.zip';

const originalPath = (f: Pick<FileRow, 'key'> & { ext: string }) => path.join(PRIVATE_DIR, `${f.key}.${f.ext}`);
const previewPath = (key: string) => path.join(PRIVATE_DIR, `${key}-vorschau.webp`);
const extOf = (f: Pick<FileRow, 'originalName' | 'mime'>) => {
	const m = f.originalName.match(/\.([a-z0-9]{2,5})$/i);
	return (m?.[1] ?? 'bin').toLowerCase();
};

export function filePaths(f: FileRow) {
	return { original: path.join(PRIVATE_DIR, storedName(f)), preview: previewPath(f.key) };
}

/** Auf der Platte: <key>.<endung aus der Erkennung> */
function storedName(f: Pick<FileRow, 'key' | 'mime' | 'originalName'>) {
	const byMime: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/webp': 'webp',
		'image/heic': 'heic',
		'image/avif': 'avif',
		'application/pdf': 'pdf',
		'application/zip': 'zip',
		'image/svg+xml': 'svg'
	};
	const ext = byMime[f.mime] ?? (/\.ai$/i.test(f.originalName) ? 'ai' : f.mime === 'application/postscript' ? 'eps' : extOf(f));
	return `${f.key}.${ext}`;
}

async function makePreview(buf: Buffer, kind: Kind, key: string): Promise<{ width: number; height: number } | null> {
	try {
		let input = buf;
		if (kind.mime === 'image/heic') {
			const { width, height, data } = await heicDecode({ buffer: buf });
			input = await sharp(Buffer.from(data.buffer), { raw: { width, height, channels: 4 } })
				.jpeg({ quality: 90 })
				.toBuffer();
		}
		const info = await sharp(input, { animated: false })
			.rotate()
			.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 78 })
			.toFile(previewPath(key));
		return { width: info.width, height: info.height };
	} catch {
		return null;
	}
}

export async function storeFile(
	buf: Buffer,
	originalName: string,
	owner: { source: 'kunde' | 'team'; cartId?: string | null; orderId?: number | null; userId?: number | null }
): Promise<FileRow> {
	if (buf.length === 0) throw new FileError('empty');
	if (buf.length > MAX_FILE_BYTES) throw new FileError('too_large');
	const kind = detect(buf, originalName);
	if (!kind) throw new FileError('type');
	const key = randomBytes(18).toString('base64url');
	const cleanName = originalName.replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(-120) || `datei.${kind.ext}`;
	const row = { key, mime: kind.mime, originalName: cleanName };
	fs.writeFileSync(path.join(PRIVATE_DIR, storedName(row)), buf);
	const preview = kind.image ? await makePreview(buf, kind, key) : null;
	return db
		.insert(files)
		.values({
			key,
			originalName: cleanName,
			mime: kind.mime,
			sizeBytes: buf.length,
			hasPreview: !!preview,
			width: preview?.width ?? null,
			height: preview?.height ?? null,
			source: owner.source,
			cartId: owner.cartId ?? null,
			orderId: owner.orderId ?? null,
			userId: owner.userId ?? null
		})
		.returning()
		.get();
}

export async function filesByIds(ids: number[]): Promise<FileRow[]> {
	if (!ids.length) return [];
	return db.select().from(files).where(inArray(files.id, ids)).all();
}

/** Beim Bestellen: Uploads aus dem Warenkorb gehören ab jetzt zur Bestellung */
export async function attachCartFiles(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], cartId: string, orderId: number, ids: number[]) {
	if (!ids.length) return;
	await tx
		.update(files)
		.set({ orderId, cartId: null })
		.where(and(eq(files.cartId, cartId), inArray(files.id, ids)));
}

export async function deleteFile(f: FileRow) {
	await db.delete(files).where(eq(files.id, f.id));
	const p = filePaths(f);
	fs.rmSync(p.original, { force: true });
	fs.rmSync(p.preview, { force: true });
}

/** Hochgeladen, aber nie bestellt: nach 30 Tagen weg */
export async function purgeOrphanFiles() {
	const cutoff = new Date(Date.now() - 30 * 86_400_000);
	const stale = await db
		.select()
		.from(files)
		.where(and(isNull(files.orderId), eq(files.source, 'kunde'), lt(files.createdAt, cutoff)))
		.all();
	for (const f of stale) await deleteFile(f);
}

/** Was die Oberfläche braucht */
export interface FileRef {
	id: number;
	key: string;
	name: string;
	mime: string;
	size: number;
	preview: boolean;
}

export const fileRef = (f: FileRow): FileRef => ({ id: f.id, key: f.key, name: f.originalName, mime: f.mime, size: f.sizeBytes, preview: f.hasPreview });
