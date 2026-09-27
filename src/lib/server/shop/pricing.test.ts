import { describe, expect, it } from 'vitest';
import { allocate, computeTotals, dealerUnitPrice, netOf, type PriceLine, type TaxContext } from './pricing';

const line = (over: Partial<PriceLine> = {}): PriceLine => ({
	key: 1,
	unitPrice: 12000,
	quantity: 1,
	taxable: true,
	discountable: true,
	categoryIds: [1],
	requiresShipping: true,
	...over
});

const at: TaxContext = { mode: 'regel', homeRate: 2000, country: 'AT', countryEu: true, countryRate: 2000, oss: false, validVatId: false };
const ship = { method: 'versand' as const, price: 690, freeFrom: null };

describe('allocate', () => {
	it('verteilt ohne Rundungsverlust', () => {
		const parts = allocate(1000, [1, 1, 1]);
		expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
		expect(parts).toEqual([334, 333, 333]);
	});
	it('ignoriert Gewicht 0', () => {
		expect(allocate(500, [0, 200, 300])).toEqual([0, 200, 300]);
	});
});

describe('computeTotals', () => {
	it('Kleinunternehmer: keine USt., Brutto bleibt', () => {
		const t = computeTotals({ lines: [line()], shipping: ship, discount: null, tax: { ...at, mode: 'kleinunternehmer' } });
		expect(t.taxCase).toBe('kleinunternehmer');
		expect(t.taxTotal).toBe(0);
		expect(t.total).toBe(12690);
	});

	it('Regelbesteuerung Österreich: 20 % aus Waren und Versand herausgerechnet', () => {
		const t = computeTotals({ lines: [line()], shipping: ship, discount: null, tax: at });
		expect(t.total).toBe(12690);
		expect(t.taxTotal).toBe(12690 - netOf(12690, 2000));
		expect(t.taxBreakdown).toEqual([{ rate: 2000, net: 10575, tax: 2115 }]);
	});

	it('OSS: Steuersatz des Ziellandes, Bruttopreis gleich', () => {
		const t = computeTotals({
			lines: [line()],
			shipping: ship,
			discount: null,
			tax: { ...at, country: 'DE', countryRate: 1900, oss: true }
		});
		expect(t.taxRate).toBe(1900);
		expect(t.total).toBe(12690);
	});

	it('Reverse Charge: Nettopreise, keine USt.', () => {
		const t = computeTotals({
			lines: [line()],
			shipping: ship,
			discount: null,
			tax: { ...at, country: 'DE', countryRate: 1900, validVatId: true }
		});
		expect(t.taxCase).toBe('reverse_charge');
		expect(t.netPricing).toBe(true);
		expect(t.subtotal).toBe(10000);
		expect(t.shipping).toBe(575);
		expect(t.taxTotal).toBe(0);
		expect(t.total).toBe(10575);
	});

	it('Export außerhalb der EU: Nettopreise', () => {
		const t = computeTotals({ lines: [line()], shipping: ship, discount: null, tax: { ...at, country: 'CH', countryEu: false } });
		expect(t.taxCase).toBe('export');
		expect(t.subtotal).toBe(10000);
	});

	it('Gutschein-Kauf ist nicht steuerbar und nicht rabattierbar', () => {
		const t = computeTotals({
			lines: [line(), line({ key: 2, unitPrice: 5000, taxable: false, discountable: false, requiresShipping: false })],
			shipping: ship,
			discount: { kind: 'prozent', value: 10, categoryIds: [], minOrder: null },
			tax: at
		});
		expect(t.discount).toBe(1200);
		expect(t.lines[1].discountShare).toBe(0);
		expect(t.taxBreakdown.find((b) => b.rate === 0)?.net).toBe(5000);
	});

	it('Rabatt nur auf passende Kategorien, Mindestbestellwert', () => {
		const lines = [line({ key: 'a', categoryIds: [1] }), line({ key: 'b', categoryIds: [2], unitPrice: 3000 })];
		const onlyCat2 = computeTotals({ lines, shipping: ship, discount: { kind: 'betrag', value: 1000, categoryIds: [2], minOrder: null }, tax: at });
		expect(onlyCat2.lines.map((l) => l.discountShare)).toEqual([0, 1000]);
		const tooSmall = computeTotals({ lines, shipping: ship, discount: { kind: 'betrag', value: 1000, categoryIds: [2], minOrder: 5000 }, tax: at });
		expect(tooSmall.discountError).toBe('min_order');
		expect(tooSmall.discount).toBe(0);
	});

	it('Betragsrabatt höchstens so hoch wie der Warenwert', () => {
		const t = computeTotals({ lines: [line({ unitPrice: 500 })], shipping: ship, discount: { kind: 'betrag', value: 2000, categoryIds: [], minOrder: null }, tax: at });
		expect(t.discount).toBe(500);
		expect(t.total).toBe(690);
	});

	it('Versandkostenfrei ab Warenwert nach Rabatt, Abholung kostenlos, digitale Waren ohne Versand', () => {
		const free = computeTotals({ lines: [line()], shipping: { ...ship, freeFrom: 10000 }, discount: null, tax: at });
		expect(free.shipping).toBe(0);
		const pickup = computeTotals({ lines: [line()], shipping: { ...ship, method: 'abholung' }, discount: null, tax: at });
		expect(pickup.shipping).toBe(0);
		const digital = computeTotals({ lines: [line({ requiresShipping: false, taxable: false })], shipping: ship, discount: null, tax: at });
		expect(digital.shippingMethod).toBe('keiner');
		expect(digital.shipping).toBe(0);
	});

	it('Code „versandfrei“', () => {
		const t = computeTotals({ lines: [line()], shipping: ship, discount: { kind: 'versandfrei', value: 0, categoryIds: [], minOrder: null }, tax: at });
		expect(t.shipping).toBe(0);
		expect(t.freeShippingByCode).toBe(true);
	});

	it('Gutscheine bezahlen bis zur Summe, Rest bleibt offen', () => {
		const t = computeTotals({ lines: [line()], shipping: ship, discount: null, tax: at, giftCardBalances: [5000, 10000] });
		expect(t.giftCards).toEqual([5000, 7690]);
		expect(t.amountDue).toBe(0);
		const partial = computeTotals({ lines: [line()], shipping: ship, discount: null, tax: at, giftCardBalances: [2500] });
		expect(partial.amountDue).toBe(10190);
	});
});

describe('dealerUnitPrice', () => {
	it('Prozent-Rabatt auf Preis und Aufpreise', () => {
		expect(dealerUnitPrice({ price: 10000, dealerPrice: null }, 2000, 20)).toBe(9600);
	});
	it('eigener Händlerpreis hat Vorrang', () => {
		expect(dealerUnitPrice({ price: 10000, dealerPrice: 7000 }, 1000, 10)).toBe(7900);
	});
});
