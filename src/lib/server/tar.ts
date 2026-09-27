import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

/**
 * Liest unkomprimierte tar-Archive (ustar, GNU, pax), wie sie `tar -cf` beim
 * Herunterladen einer Sicherung erzeugt. Es wird nur gelesen und aufgelistet –
 * was davon wohin geschrieben wird, entscheidet der Aufrufer.
 */

export interface TarEntry {
	/** Pfad im Archiv ohne führendes "./" */
	name: string;
	/** '0' Datei, '1' harter Link, '2' Symlink, '5' Ordner … */
	type: string;
	size: number;
	/** Position der Daten in der Archivdatei */
	offset: number;
	/** Ziel bei Links */
	linkName: string;
}

const BLOCK = 512;

function text(buf: Buffer, start: number, len: number): string {
	const raw = buf.subarray(start, start + len);
	const end = raw.indexOf(0);
	return raw.subarray(0, end === -1 ? len : end).toString('utf8');
}

function numeric(buf: Buffer, start: number, len: number): number {
	// GNU-Erweiterung für große Werte: höchstes Bit gesetzt → Binärzahl
	if (buf[start] & 0x80) {
		let n = buf[start] & 0x3f;
		for (let i = start + 1; i < start + len; i++) n = n * 256 + buf[i];
		return n;
	}
	const s = text(buf, start, len).trim();
	return s ? parseInt(s, 8) : 0;
}

/** Prüfsumme des Kopfblocks – erkennt Dateien, die gar kein tar-Archiv sind */
export function validHeader(h: Buffer): boolean {
	let sum = 0;
	for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
	return sum === numeric(h, 148, 8);
}

/** pax-Kopf: Zeilen "<Länge> schlüssel=wert\n" */
function paxPath(data: string): string | null {
	for (const line of data.split('\n')) {
		const m = line.match(/^\d+ path=(.*)$/);
		if (m) return m[1];
	}
	return null;
}

export async function* readTar(file: string): AsyncGenerator<TarEntry> {
	const fh = await fs.promises.open(file, 'r');
	const header = Buffer.alloc(BLOCK);
	let pos = 0;
	let longName: string | null = null;
	try {
		for (;;) {
			const { bytesRead } = await fh.read(header, 0, BLOCK, pos);
			// Ende: Datei zu Ende oder Nullblock
			if (bytesRead < BLOCK || header.every((b) => b === 0)) return;
			if (!validHeader(header)) throw new Error('Kein gültiges tar-Archiv');
			const size = numeric(header, 124, 12);
			const type = String.fromCharCode(header[156] || 0x30);
			const data = pos + BLOCK;
			pos = data + Math.ceil(size / BLOCK) * BLOCK;

			// GNU-Langname und pax-Kopf gelten für den folgenden Eintrag
			if (type === 'L' || type === 'x') {
				if (size > 64 * 1024) throw new Error('Ungültiger Eintrag im Archiv');
				const buf = Buffer.alloc(size);
				await fh.read(buf, 0, size, data);
				const value = buf.toString('utf8');
				longName = type === 'L' ? value.replace(/\0+$/, '') : (paxPath(value) ?? longName);
				continue;
			}
			if (type === 'g') continue;

			const ustar = text(header, 257, 6).startsWith('ustar');
			const prefix = ustar ? text(header, 345, 155) : '';
			const base = text(header, 0, 100);
			const name = (longName ?? (prefix ? `${prefix}/${base}` : base)).replace(/^(\.\/)+/, '');
			longName = null;
			yield { name, type, size, offset: data, linkName: text(header, 157, 100) };
		}
	} finally {
		await fh.close();
	}
}

/** Daten eines Eintrags in eine Datei schreiben */
export async function extractEntry(file: string, entry: TarEntry, dest: string): Promise<void> {
	if (entry.size === 0) {
		fs.writeFileSync(dest, '');
		return;
	}
	await pipeline(fs.createReadStream(file, { start: entry.offset, end: entry.offset + entry.size - 1 }), fs.createWriteStream(dest));
}
