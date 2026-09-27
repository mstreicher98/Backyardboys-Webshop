/**
 * UID-Prüfung über das VIES-System der EU-Kommission. Nur ein gültiges
 * Ergebnis führt zu Reverse Charge; ist VIES nicht erreichbar, wird mit
 * österreichischer USt. abgerechnet (sicherer Fall).
 */

const cache = new Map<string, { valid: boolean; at: number }>();

export function normalizeVatId(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Länderpräfix der UID passt zum Land (Griechenland: EL) */
export function vatCountry(vatId: string): string | null {
	const m = vatId.match(/^([A-Z]{2})/);
	if (!m) return null;
	return m[1] === 'EL' ? 'GR' : m[1];
}

export async function checkVatId(vatIdRaw: string): Promise<boolean | null> {
	const vatId = normalizeVatId(vatIdRaw);
	if (!/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(vatId)) return false;
	const hit = cache.get(vatId);
	if (hit && Date.now() - hit.at < 6 * 3_600_000) return hit.valid;
	try {
		const res = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${vatId.slice(0, 2)}/vat/${vatId.slice(2)}`, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(8000)
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { isValid?: boolean; userError?: string };
		if (typeof data.isValid !== 'boolean') return null;
		cache.set(vatId, { valid: data.isValid, at: Date.now() });
		return data.isValid;
	} catch {
		return null;
	}
}
