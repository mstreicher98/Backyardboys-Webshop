const UMLAUTE: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** "Semi Custom – Japan Edition" → "semi-custom-japan-edition" */
export function slugify(input: string, max = 80): string {
	return input
		.toLowerCase()
		.replace(/[äöüß]/g, (c) => UMLAUTE[c])
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, max)
		.replace(/-+$/, '');
}
