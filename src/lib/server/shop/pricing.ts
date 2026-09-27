import type { TaxCase } from '$lib/shop-types';

/**
 * Preisberechnung für Warenkorb, Kasse und Bestellung – ohne Datenbank,
 * damit sie sich vollständig testen lässt.
 *
 * Alle Preise werden inkl. österreichischer USt. gepflegt. Je nach Fall wird daraus:
 *   kleinunternehmer  keine USt., Bruttopreis = Endpreis
 *   normal            USt. herausgerechnet (bei OSS mit dem Satz des Ziellandes)
 *   reverse_charge    Firmenkunde mit gültiger UID in einem anderen EU-Land → Nettopreis
 *   export            Lieferung außerhalb der EU → Nettopreis
 * Gutscheine (Mehrzweckgutscheine) sind beim Kauf nie umsatzsteuerpflichtig.
 */

export interface PriceLine {
	key: string | number;
	unitPrice: number;
	quantity: number;
	/** false = Gutschein */
	taxable: boolean;
	discountable: boolean;
	categoryIds: number[];
	requiresShipping: boolean;
}

export interface DiscountRule {
	kind: 'prozent' | 'betrag' | 'versandfrei';
	value: number;
	categoryIds: number[];
	minOrder: number | null;
}

export interface TaxContext {
	mode: 'kleinunternehmer' | 'regel';
	homeRate: number;
	/** Land der Lieferung bzw. Rechnungsadresse (bei Abholung: AT) */
	country: string;
	countryEu: boolean;
	countryRate: number;
	oss: boolean;
	/** Firmenkunde mit geprüfter UID */
	validVatId: boolean;
}

export interface ShippingRule {
	method: 'versand' | 'abholung';
	price: number;
	freeFrom: number | null;
}

export interface PricedLine {
	key: string | number;
	unitPrice: number;
	lineTotal: number;
	discountShare: number;
}

export interface Totals {
	lines: PricedLine[];
	subtotal: number;
	discount: number;
	discountError: 'min_order' | 'no_match' | null;
	freeShippingByCode: boolean;
	shipping: number;
	shippingMethod: 'versand' | 'abholung' | 'keiner';
	taxCase: TaxCase;
	/** Angewendeter Steuersatz für Waren und Versand */
	taxRate: number;
	taxBreakdown: { rate: number; net: number; tax: number }[];
	taxTotal: number;
	total: number;
	giftCards: number[];
	giftCardTotal: number;
	amountDue: number;
	/** Preise wurden in Nettopreise umgerechnet (Reverse Charge, Export) */
	netPricing: boolean;
}

export const HOME_COUNTRY = 'AT';

/** Brutto → Netto mit ganzzahligen Basispunkten, kaufmännisch gerundet */
export const netOf = (gross: number, rate: number) => Math.round((gross * 10000) / (10000 + rate));

/** Betrag nach Gewicht aufteilen, Rundungsrest an die größten Nachkommastellen */
export function allocate(total: number, weights: number[]): number[] {
	const sum = weights.reduce((a, b) => a + b, 0);
	if (sum <= 0 || total === 0) return weights.map(() => 0);
	const raw = weights.map((w) => (total * w) / sum);
	const out = raw.map(Math.floor);
	let rest = total - out.reduce((a, b) => a + b, 0);
	const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
	for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k].i]++;
	return out;
}

export function taxCaseFor(ctx: TaxContext, physical: boolean): { taxCase: TaxCase; rate: number } {
	if (ctx.mode === 'kleinunternehmer') return { taxCase: 'kleinunternehmer', rate: 0 };
	const foreign = ctx.country !== HOME_COUNTRY;
	if (foreign && physical && !ctx.countryEu) return { taxCase: 'export', rate: 0 };
	if (foreign && ctx.countryEu && ctx.validVatId) return { taxCase: 'reverse_charge', rate: 0 };
	const rate = ctx.oss && foreign && ctx.countryEu && ctx.countryRate > 0 ? ctx.countryRate : ctx.homeRate;
	return { taxCase: 'normal', rate };
}

export function computeTotals(input: {
	lines: PriceLine[];
	shipping: ShippingRule;
	discount: DiscountRule | null;
	tax: TaxContext;
	giftCardBalances?: number[];
}): Totals {
	const { lines, tax } = input;
	const physical = lines.some((l) => l.requiresShipping);
	const { taxCase, rate } = taxCaseFor(tax, physical);
	const netPricing = taxCase === 'reverse_charge' || taxCase === 'export';
	const conv = (gross: number) => (netPricing ? netOf(gross, tax.homeRate) : gross);

	const priced: PricedLine[] = lines.map((l) => {
		const unitPrice = l.taxable ? conv(l.unitPrice) : l.unitPrice;
		return { key: l.key, unitPrice, lineTotal: unitPrice * l.quantity, discountShare: 0 };
	});
	const subtotal = priced.reduce((a, l) => a + l.lineTotal, 0);

	/* ---------------- Rabatt */
	let discount = 0;
	let discountError: Totals['discountError'] = null;
	let freeShippingByCode = false;
	const rule = input.discount;
	if (rule) {
		const eligible = lines.map(
			(l) => l.discountable && (rule.categoryIds.length === 0 || l.categoryIds.some((c) => rule.categoryIds.includes(c)))
		);
		const eligibleSum = priced.reduce((a, l, i) => a + (eligible[i] ? l.lineTotal : 0), 0);
		if (eligibleSum === 0) discountError = 'no_match';
		else if (rule.minOrder != null && eligibleSum < conv(rule.minOrder)) discountError = 'min_order';
		else if (rule.kind === 'versandfrei') freeShippingByCode = true;
		else {
			discount = rule.kind === 'prozent' ? Math.round((eligibleSum * Math.min(100, Math.max(0, rule.value))) / 100) : Math.min(conv(rule.value), eligibleSum);
			const shares = allocate(
				discount,
				priced.map((l, i) => (eligible[i] ? l.lineTotal : 0))
			);
			priced.forEach((l, i) => (l.discountShare = shares[i]));
		}
	}

	/* ---------------- Versand */
	let shipping = 0;
	let shippingMethod: Totals['shippingMethod'] = 'keiner';
	if (physical) {
		shippingMethod = input.shipping.method;
		if (shippingMethod === 'versand' && !freeShippingByCode) {
			const goods = priced.reduce((a, l, i) => a + (lines[i].requiresShipping ? l.lineTotal - l.discountShare : 0), 0);
			const free = input.shipping.freeFrom != null && goods >= conv(input.shipping.freeFrom);
			shipping = free ? 0 : conv(input.shipping.price);
		}
	}

	/* ---------------- Steuer */
	let taxable = shipping;
	let untaxed = 0;
	priced.forEach((l, i) => {
		const amount = l.lineTotal - l.discountShare;
		if (lines[i].taxable) taxable += amount;
		else untaxed += amount;
	});
	const taxBreakdown: Totals['taxBreakdown'] = [];
	let taxTotal = 0;
	if (taxCase === 'normal' && taxable > 0) {
		const net = netOf(taxable, rate);
		taxTotal = taxable - net;
		taxBreakdown.push({ rate, net, tax: taxTotal });
	} else if (taxable > 0) {
		taxBreakdown.push({ rate: 0, net: taxable, tax: 0 });
	}
	if (untaxed > 0) taxBreakdown.push({ rate: 0, net: untaxed, tax: 0 });

	const total = subtotal - discount + shipping;

	/* ---------------- Gutscheine als Zahlungsmittel */
	let open = total;
	const giftCards = (input.giftCardBalances ?? []).map((balance) => {
		const use = Math.max(0, Math.min(balance, open));
		open -= use;
		return use;
	});
	const giftCardTotal = total - open;

	return {
		lines: priced,
		subtotal,
		discount,
		discountError,
		freeShippingByCode,
		shipping,
		shippingMethod,
		taxCase,
		taxRate: rate,
		taxBreakdown,
		taxTotal,
		total,
		giftCards,
		giftCardTotal,
		amountDue: open,
		netPricing
	};
}

/** Stückpreis für Händler: eigener Händlerpreis oder Prozent-Rabatt (auch auf Aufpreise) */
export function dealerUnitPrice(base: { price: number; dealerPrice: number | null }, surcharges: number, discountPercent: number): number {
	const factor = 1 - Math.min(100, Math.max(0, discountPercent)) / 100;
	const main = base.dealerPrice ?? Math.round(base.price * factor);
	return main + Math.round(surcharges * factor);
}
