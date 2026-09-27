import { formatMoney, pick } from '$lib/i18n.svelte';
import type { Locale } from '$lib/shop-types';
import { esc } from './emails';
import { activeCountries } from './shop/cart';
import { PAYMENT_LABELS } from './shop/orders';
import { getSettings } from './settings';

/**
 * Platzhalter in Info- und Rechtsseiten durch aktuelle Angaben ersetzen.
 * Fehlende Firmenangaben erscheinen als gut sichtbares [fehlt: …], damit sie
 * vor dem Livegang auffallen.
 */
export async function renderPlaceholders(html: string, locale: Locale): Promise<string> {
	if (!html.includes('{{')) return html;
	const s = await getSettings();
	const c = s.company;
	const L = (de: string, en: string) => (locale === 'en' ? en : de);
	const missing = (label: string) => `<mark>[${L('fehlt', 'missing')}: ${esc(label)}]</mark>`;
	const val = (v: string, label: string) => (v.trim() ? esc(v) : missing(label));

	const simple: Record<string, string> = {
		firma: val(c.name, 'Firmenname'),
		marke: esc(c.brand),
		strasse: val(c.street, 'Straße'),
		plz: val(c.zip, 'PLZ'),
		ort: val(c.city, 'Ort'),
		land: esc(c.country),
		email: val(c.email, 'E-Mail'),
		telefon: val(c.phone, 'Telefon'),
		uid: s.tax.mode === 'kleinunternehmer' && !c.uid ? L('keine (Kleinunternehmer)', 'none (small business)') : val(c.uid, 'UID-Nummer'),
		fn: val(c.fn, 'Firmenbuchnummer'),
		gericht: val(c.court, 'Firmenbuchgericht'),
		vertretung: val(c.representatives, 'Gesellschafter'),
		kammer: val(c.chamber, 'Kammer'),
		gewerbe: val(c.trade, 'Gewerbe'),
		behoerde: val(c.authority, 'Gewerbebehörde'),
		iban: val(c.iban, 'IBAN'),
		korrekturen: String(s.dekor.maxRevisions),
		ueberweisungstage: String(s.orders.transferDays),
		steuerhinweis:
			s.tax.mode === 'kleinunternehmer'
				? L('Gemäß § 6 Abs. 1 Z 27 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.', 'No VAT is charged under the Austrian small business regulation.')
				: L('Die Preise enthalten die gesetzliche Umsatzsteuer.', 'Prices include VAT.'),
		abholung: s.pickup.enabled
			? esc([s.pickup.address, pick(locale, s.pickup.note, s.pickup.noteEn)].filter(Boolean).join(' – ')) || L('Abholung nach Vereinbarung.', 'Pickup by appointment.')
			: L('Eine Abholung ist derzeit nicht möglich.', 'Pickup is currently not available.')
	};

	let out = html.replace(/\{\{(\w+)\}\}/g, (m, key: string) => (key in simple ? simple[key] : m));

	if (out.includes('{{versandtabelle}}')) {
		const countries = await activeCountries();
		const rows = countries
			.map(
				(k) =>
					`<tr><td>${esc(pick(locale, k.name, k.nameEn))}</td><td>${formatMoney(k.price, locale)}</td><td>${k.freeFrom != null ? L(`ab ${formatMoney(k.freeFrom, locale)} kostenlos`, `free from ${formatMoney(k.freeFrom, locale)}`) : '–'}</td></tr>`
			)
			.join('');
		out = out.replace(
			'{{versandtabelle}}',
			`<table><thead><tr><th>${L('Land', 'Country')}</th><th>${L('Versand', 'Shipping')}</th><th>${L('Versandkostenfrei', 'Free shipping')}</th></tr></thead><tbody>${rows}</tbody></table>`
		);
	}
	if (out.includes('{{zahlungsarten}}')) {
		const p = s.payments;
		const list = [p.stripe.enabled && 'stripe', p.paypal.enabled && 'paypal', p.transfer.enabled && 'ueberweisung', p.cash.enabled && 'bar'].filter(Boolean) as string[];
		out = out.replace('{{zahlungsarten}}', `<ul>${list.map((m) => `<li>${esc(PAYMENT_LABELS[m][locale])}</li>`).join('')}</ul>`);
	}
	return out;
}
