import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { extractEntry, readTar, type TarEntry } from './tar';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tar-test-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Kopfblock nach ustar mit korrekter Prüfsumme */
function header(name: string, size: number, type = '0', prefix = '', linkName = ''): Buffer {
	const h = Buffer.alloc(512);
	h.write(name, 0, 100);
	h.write('0000644\0', 100);
	h.write('0000000\0', 108);
	h.write('0000000\0', 116);
	h.write(size.toString(8).padStart(11, '0') + '\0', 124);
	h.write('00000000000\0', 136);
	h.write(type, 156);
	h.write(linkName, 157, 100);
	h.write('ustar\0', 257);
	h.write('00', 263);
	h.write(prefix, 345, 155);
	h.fill(32, 148, 156);
	let sum = 0;
	for (const b of h) sum += b;
	h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
	return h;
}

const padded = (data: Buffer) => Buffer.concat([data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
const entry = (name: string, data: string, type = '0', prefix = '') => [header(name, Buffer.byteLength(data), type, prefix), padded(Buffer.from(data))];

function archive(...parts: Buffer[][]): string {
	const file = path.join(dir, `${Math.random().toString(36).slice(2)}.tar`);
	fs.writeFileSync(file, Buffer.concat([...parts.flat(), Buffer.alloc(1024)]));
	return file;
}

async function list(file: string): Promise<TarEntry[]> {
	const out: TarEntry[] = [];
	for await (const e of readTar(file)) out.push(e);
	return out;
}

describe('readTar', () => {
	it('liest Namen, Größe und Typ', async () => {
		const file = archive(entry('2026-09-24-033255/', '', '5'), entry('2026-09-24-033255/shop.db', 'SQLite'), entry('./2026-09-24-033255/uploads/a.webp', 'x'.repeat(700)));
		const entries = await list(file);
		expect(entries.map((e) => [e.name, e.type, e.size])).toEqual([
			['2026-09-24-033255/', '5', 0],
			['2026-09-24-033255/shop.db', '0', 6],
			['2026-09-24-033255/uploads/a.webp', '0', 700]
		]);
		const dest = path.join(dir, 'db.out');
		await extractEntry(file, entries[1], dest);
		expect(fs.readFileSync(dest, 'utf8')).toBe('SQLite');
	});

	it('setzt ustar-Präfix, GNU-Langnamen und pax-Pfade zusammen', async () => {
		const long = `stand/uploads/${'b'.repeat(120)}.webp`;
		// pax-Zeile "<Länge> path=<Pfad>\n" – die Länge wertet der Leser nicht aus
		const pax = `${long.length + 10} path=${long}\n`;
		const file = archive(
			entry('shop.db', 'db', '0', 'stand'),
			entry('././@LongLink', long + '\0', 'L'),
			entry('gekuerzt', 'eins'),
			entry('PaxHeader/x', pax, 'x'),
			entry('auch-gekuerzt', 'zwei')
		);
		const names = (await list(file)).map((e) => e.name);
		expect(names).toEqual(['stand/shop.db', long, long]);
	});

	it('lehnt Dateien ab, die kein tar-Archiv sind', async () => {
		const file = path.join(dir, 'kein.tar');
		fs.writeFileSync(file, Buffer.alloc(2048, 7));
		await expect(list(file)).rejects.toThrow(/tar/);
	});
});
