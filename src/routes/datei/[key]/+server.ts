import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { filePaths } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * Private Dateien über ihren zufälligen Schlüssel. ?vorschau=1 liefert die
 * WebP-Vorschau (nur bei Bildern), sonst das Original zum Herunterladen.
 * SVG wird immer als Download ausgeliefert (könnte Skripte enthalten).
 */
export const GET: RequestHandler = async ({ params, url }) => {
	if (!/^[A-Za-z0-9_-]{24}$/.test(params.key)) error(404, 'Nicht gefunden');
	const f = await db.select().from(files).where(eq(files.key, params.key)).get();
	if (!f) error(404, 'Nicht gefunden');
	const p = filePaths(f);
	const preview = url.searchParams.has('vorschau') && f.hasPreview;
	const path = preview ? p.preview : p.original;
	let size: number;
	try {
		size = fs.statSync(path).size;
	} catch {
		error(404, 'Nicht gefunden');
	}
	const inline = preview || /^image\/(jpeg|png|gif|webp|avif)$/.test(f.mime) || f.mime === 'application/pdf';
	const name = encodeURIComponent(f.originalName);
	const headers: Record<string, string> = {
		'Content-Type': preview ? 'image/webp' : f.mime,
		'Content-Length': String(size),
		'Cache-Control': 'private, max-age=86400',
		'X-Robots-Tag': 'noindex',
		// Eingebettete PDF-Anzeige braucht Plugins – alles andere läuft in einer Sandbox
		...(f.mime === 'application/pdf' && !preview ? {} : { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
		'Content-Disposition': `${inline && url.searchParams.get('download') !== '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`
	};
	return new Response(Readable.toWeb(fs.createReadStream(path)) as ReadableStream<Uint8Array>, { headers });
};
