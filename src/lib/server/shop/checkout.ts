import { getSettings } from '../settings';
import type { SessionCustomer } from '../customer-auth';
import { checkVatId, normalizeVatId, vatCountry } from '../vies';
import { HOME_COUNTRY } from './pricing';

/**
 * Reverse Charge nur, wenn: Regelbesteuerung, Rechnungsland ein anderes
 * EU-Land als Österreich, UID passt zum Land und ist laut VIES gültig.
 */
export async function vatIdStatus(vatIdRaw: string, billingCountry: string): Promise<{ vatId: string; valid: boolean; checked: boolean }> {
	const s = await getSettings();
	const vatId = normalizeVatId(vatIdRaw);
	if (!vatId || s.tax.mode !== 'regel' || billingCountry === HOME_COUNTRY) return { vatId, valid: false, checked: false };
	if (vatCountry(vatId) !== billingCountry) return { vatId, valid: false, checked: true };
	const result = await checkVatId(vatId);
	return { vatId, valid: result === true, checked: result !== null };
}

export function customerDefaults(c: SessionCustomer | null) {
	return c
		? { email: c.email, phone: c.phone, firstName: c.firstName, lastName: c.lastName, company: c.company, vatId: c.vatId }
		: { email: '', phone: '', firstName: '', lastName: '', company: '', vatId: '' };
}
