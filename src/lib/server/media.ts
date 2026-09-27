import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import heicDecode from 'heic-decode';
import sharp from 'sharp';
import { eq, like, or, sql } from 'drizzle-orm';
import { db, UPLOAD_DIR } from './db';
import { categories, media, pages, productImages, products, settings, showcase, upgradeOptions, type Media } from './db/schema';

/** Breiten, in denen jedes Bild abgelegt wird (nur bis zur Originalgröße) */
export const VARIANT_WIDTHS = [400, 800, 1600, 2400];
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class ImageError extends Error {}

const variantPath = (file: string, w: number) => path.join(UPLOAD_DIR, `${file}-${w}.webp`);

/**
 * Speichert ein hochgeladenes Bild als WebP in mehreren Größen.
 * sharp dreht nach EXIF-Ausrichtung und lässt alle Metadaten weg – auch GPS.
 */
/** iPhone-Fotos (HEIC) kann sharp nicht lesen – mit libheif (WebAssembly) in ein JPEG umwandeln */
async function heicToJpeg(buf: Buffer): Promise<Buffer> {
	const { width, height, data } = await heicDecode({ buffer: buf });
	return sharp(Buffer.from(data.buffer), { raw: { width, height, channels: 4 } })
		.jpeg({ quality: 92 })
		.toBuffer();
}
const isHeif = (buf: Buffer) => /^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(buf.subarray(4, 12).toString('latin1'));

export async function storeImage(original: Buffer, originalName: string, uploadedById: number | null): Promise<Media> {
	if (original.length > MAX_UPLOAD_BYTES) throw new ImageError('Das Bild ist größer als 25 MB.');
	let input = original;
	if (isHeif(original)) {
		try {
			input = await heicToJpeg(original);
		} catch {
			throw new ImageError('Das HEIC-Foto ließ sich nicht umwandeln. Bitte als JPG speichern und erneut hochladen.');
		}
	}
	let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
	try {
		meta = await sharp(input).metadata();
	} catch {
		throw new ImageError('Die Datei ist kein lesbares Bild (erlaubt: JPG, PNG, WebP, GIF, AVIF).');
	}
	if (!meta.width || !meta.height) throw new ImageError('Die Bildgröße ließ sich nicht bestimmen.');
	// Bei Ausrichtung 5–8 sind Breite und Höhe nach dem Drehen vertauscht
	const rotated = (meta.orientation ?? 1) >= 5;
	const srcWidth = rotated ? meta.height : meta.width;

	const widths = VARIANT_WIDTHS.filter((w) => w <= srcWidth);
	if (!widths.length || widths[widths.length - 1] < srcWidth) {
		widths.push(Math.min(srcWidth, VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]));
	}
	const unique = [...new Set(widths)].sort((a, b) => a - b);

	const file = randomBytes(10).toString('hex');
	let width = 0;
	let height = 0;
	let sizeBytes = 0;
	try {
		for (const w of unique) {
			const info = await sharp(input, { animated: false })
				.rotate()
				.resize({ width: w, withoutEnlargement: true })
				.webp({ quality: 80, effort: 4 })
				.toFile(variantPath(file, w));
			width = info.width;
			height = info.height;
			sizeBytes = info.size;
		}
	} catch (err) {
		for (const w of unique) fs.rmSync(variantPath(file, w), { force: true });
		console.error('[medien]', err);
		throw new ImageError('Das Bild konnte nicht verarbeitet werden.');
	}

	return db
		.insert(media)
		.values({
			file,
			originalName: originalName.slice(0, 200),
			widths: unique.join(','),
			width,
			height,
			sizeBytes,
			uploadedById
		})
		.returning()
		.get();
}

/* ------------------------------------------------------------ Dokumente (PDF) */

const DOC_MAX_BYTES = 25 * 1024 * 1024;

/** "Festankündigung 2026 (web).pdf" → "festankuendigung-2026-web" */
function docSlug(name: string): string {
	const base = name
		.replace(/\.pdf$/i, '')
		.toLowerCase()
		.replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
	return base || 'dokument';
}

/** Speichert ein PDF unverändert; der Dateiname behält einen lesbaren Teil für den Download */
export async function storeDocument(input: Buffer, originalName: string, uploadedById: number | null): Promise<Media> {
	if (input.length > DOC_MAX_BYTES) throw new ImageError('Das Dokument ist größer als 25 MB.');
	if (input.subarray(0, 5).toString('latin1') !== '%PDF-') throw new ImageError('Als Dokument sind nur PDF-Dateien erlaubt.');
	const file = `${randomBytes(10).toString('hex')}-${docSlug(originalName)}.pdf`;
	fs.writeFileSync(path.join(UPLOAD_DIR, file), input);
	return db
		.insert(media)
		.values({
			kind: 'dokument',
			file,
			originalName: originalName.slice(0, 200),
			widths: '',
			width: 0,
			height: 0,
			sizeBytes: input.length,
			uploadedById
		})
		.returning()
		.get();
}

/** Wo wird ein Bild oder Dokument verwendet? Leere Liste = kann gelöscht werden */
export async function mediaUsage(m: Pick<Media, 'id' | 'file'>): Promise<string[]> {
	const inline = `%/medien/${m.file}%`;
	const out: string[] = [];
	const productRows = await db
		.select({ title: products.title })
		.from(products)
		.where(
			or(
				like(products.descriptionHtml, inline),
				like(products.descriptionHtmlEn, inline),
				sql`${products.id} IN (SELECT ${productImages.productId} FROM ${productImages} WHERE ${productImages.mediaId} = ${m.id})`
			)
		)
		.all();
	out.push(...productRows.map((r) => `Produkt „${r.title}“`));
	const catRows = await db.select({ name: categories.name }).from(categories).where(eq(categories.mediaId, m.id)).all();
	out.push(...catRows.map((r) => `Kategorie „${r.name}“`));
	const upRows = await db.select({ name: upgradeOptions.name }).from(upgradeOptions).where(eq(upgradeOptions.mediaId, m.id)).all();
	out.push(...upRows.map((r) => `Upgrade „${r.name}“`));
	const showRows = await db.select({ title: showcase.title }).from(showcase).where(eq(showcase.mediaId, m.id)).all();
	out.push(...showRows.map((r) => `Kundenbike „${r.title || 'ohne Titel'}“`));
	const pageRows = await db
		.select({ title: pages.title })
		.from(pages)
		.where(or(like(pages.contentHtml, inline), like(pages.contentHtmlEn, inline)))
		.all();
	out.push(...pageRows.map((r) => `Seite „${r.title}“`));
	const home = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'shop')).get();
	if (home && new RegExp(`"heroMediaId":${m.id}[,}]`).test(home.value)) out.push('Startseite (Titelbild)');
	return out;
}

export async function deleteMedia(m: Pick<Media, 'id' | 'file' | 'widths' | 'kind'>) {
	await db.delete(media).where(eq(media.id, m.id));
	if (m.kind === 'dokument') {
		fs.rmSync(path.join(UPLOAD_DIR, m.file), { force: true });
		return;
	}
	for (const w of m.widths.split(',').map(Number)) fs.rmSync(variantPath(m.file, w), { force: true });
}

export function uploadsSize(): number {
	let total = 0;
	for (const f of fs.readdirSync(UPLOAD_DIR)) {
		try {
			total += fs.statSync(path.join(UPLOAD_DIR, f)).size;
		} catch {
			/* gerade gelöscht */
		}
	}
	return total;
}

/** Nur was die Oberfläche braucht */
export const MEDIA_COLUMNS = {
	id: media.id,
	file: media.file,
	widths: media.widths,
	width: media.width,
	height: media.height,
	alt: media.alt
};
