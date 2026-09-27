/** Was die Oberfläche von einem Bild braucht – ohne Serverdetails */
export interface MediaRef {
	id: number;
	file: string;
	widths: string;
	width: number;
	height: number;
	alt: string;
}

export function widthsOf(m: Pick<MediaRef, 'widths'>): number[] {
	return m.widths
		.split(',')
		.map(Number)
		.filter((n) => n > 0);
}

/** Kleinste vorhandene Breite, die mindestens `want` Pixel hat */
export function mediaSrc(m: Pick<MediaRef, 'file' | 'widths'>, want = 800): string {
	const ws = widthsOf(m);
	const w = ws.find((x) => x >= want) ?? ws[ws.length - 1];
	return `/medien/${m.file}-${w}.webp`;
}

export function mediaSrcset(m: Pick<MediaRef, 'file' | 'widths'>): string {
	return widthsOf(m)
		.map((w) => `/medien/${m.file}-${w}.webp ${w}w`)
		.join(', ');
}
