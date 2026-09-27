import { crc32 } from 'node:zlib';

/**
 * Minimaler ZIP-Schreiber (Methode „stored“, ohne Kompression) – für den
 * Rechnungs-Export reicht das, PDFs sind ohnehin schon komprimiert.
 */
export function zip(files: { name: string; data: Buffer; date?: Date }[]): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const f of files) {
		const name = Buffer.from(f.name, 'utf8');
		const crc = crc32(f.data) >>> 0;
		const d = f.date ?? new Date();
		const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
		const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4); // Version
		local.writeUInt16LE(0x0800, 6); // UTF-8-Dateinamen
		local.writeUInt16LE(0, 8); // stored
		local.writeUInt16LE(time, 10);
		local.writeUInt16LE(date, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(f.data.length, 18);
		local.writeUInt32LE(f.data.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28);
		locals.push(local, name, f.data);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(0, 10);
		central.writeUInt16LE(time, 12);
		central.writeUInt16LE(date, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(f.data.length, 20);
		central.writeUInt32LE(f.data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, name);
		offset += local.length + name.length + f.data.length;
	}
	const centralSize = centrals.reduce((a, b) => a + b.length, 0);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(centralSize, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, ...centrals, end]);
}
