import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { formatDate, formatMoney } from '$lib/i18n.svelte';
import type { InvoiceData, InvoiceLine, Locale, TaxCase } from '$lib/shop-types';
import { db } from '../db';
import { invoices, orderItems, orders, type DekorJob, type Invoice, type Order, type OrderItem, type Payment } from '../db/schema';
import { nextInvoiceNumber } from '../counters';
import { getSettings, type ShopSettings } from '../settings';
import { shopBase } from '../urls';
import { netOf } from './pricing';
import { paymentLabel } from './orders';

/**
 * Rechnungen nach § 11 UStG. Der Inhalt wird beim Ausstellen vollständig
 * gespeichert (InvoiceData); das PDF entsteht bei jedem Abruf daraus neu.
 * Nummern laufen je Jahr lückenlos: RE-2026-0001, RE-2026-0002 …
 */

const L = (locale: Locale, de: string, en: string) => (locale === 'en' ? en : de);

function companyOf(s: ShopSettings): InvoiceData['company'] {
	const c = s.company;
	return {
		name: c.name,
		street: c.street,
		zip: c.zip,
		city: c.city,
		country: c.country,
		email: c.email,
		phone: c.phone,
		uid: c.uid,
		fn: c.fn,
		court: c.court,
		iban: c.iban,
		bic: c.bic,
		bank: c.bank,
		web: shopBase().replace(/^https?:\/\//, '')
	};
}

function itemDetail(i: OrderItem): string {
	return [
		i.variantTitle,
		...(i.config.upgrades ?? []).map((u) => `${u.group}: ${u.option}`),
		// Lange Freitexte (Designwunsch) nur angerissen – die Rechnung ist kein Auftragsblatt
		...(i.config.fields ?? []).map((f) => `${f.label.replace(/\?$/, '')}: ${f.value.length > 60 ? `${f.value.slice(0, 57).trim()}…` : f.value}`),
		i.config.bike ? `${i.config.bike.brand} ${i.config.bike.model} ${i.config.bike.year}` : '',
		...(i.config.bundle ?? []).map((b) => `${b.quantity}× ${b.title}${b.variantTitle ? ` (${b.variantTitle})` : ''}`),
		i.sku ? `Art.-Nr. ${i.sku}` : ''
	]
		.filter(Boolean)
		.join(' · ')
		.slice(0, 400);
}

function taxNotes(taxCase: TaxCase, order: Pick<Order, 'vatId'>, locale: Locale, s: ShopSettings): string[] {
	switch (taxCase) {
		case 'kleinunternehmer':
			return [L(locale, 'Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG.', 'VAT exempt under the Austrian small business regulation (§ 6 (1) 27 UStG).')];
		case 'reverse_charge':
			return [
				L(locale, 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).', 'Reverse charge: VAT to be accounted for by the recipient (Art. 196 VAT Directive).'),
				`${L(locale, 'UID Leistungsempfänger', 'Recipient VAT ID')}: ${order.vatId} · ${L(locale, 'UID Leistender', 'Supplier VAT ID')}: ${s.company.uid}`
			];
		case 'export':
			return [L(locale, 'Steuerfreie Ausfuhrlieferung gemäß § 7 UStG.', 'VAT-free export delivery (§ 7 UStG).')];
		default:
			return [];
	}
}

function servicePeriod(d: Date, locale: Locale): string {
	const month = d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-AT', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' });
	return L(locale, `Liefer-/Leistungszeitraum: ${month}`, `Delivery/service period: ${month}`);
}

function breakdown(taxCase: TaxCase, rate: number, taxableGross: number, untaxed: number, tax: number): InvoiceData['taxBreakdown'] {
	const out: InvoiceData['taxBreakdown'] = [];
	if (taxableGross) out.push(taxCase === 'normal' ? { rate, net: taxableGross - tax, tax } : { rate: 0, net: taxableGross, tax: 0 });
	if (untaxed) out.push({ rate: 0, net: untaxed, tax: 0 });
	return out;
}

function paidNote(order: Order, payment: Payment | null, s: ShopSettings, locale: Locale, paid: boolean): string {
	if (paid) {
		const when = formatDate(payment?.paidAt ?? order.paidAt ?? new Date(), locale);
		const how = payment ? paymentLabel(payment.method, locale) : paymentLabel('gutschein', locale);
		return L(locale, `Bezahlt am ${when} per ${how}. Vielen Dank!`, `Paid on ${when} by ${how}. Thank you!`);
	}
	return L(
		locale,
		`Zahlbar innerhalb von ${s.orders.transferDays} Tagen ohne Abzug auf ${s.company.iban} (Verwendungszweck: Bestellung ${order.number}).`,
		`Payable within ${s.orders.transferDays} days to ${s.company.iban} (reference: order ${order.number}).`
	);
}

/* ================================================================ Ausstellen */

/** Rechnung bzw. Anzahlungsrechnung für die Bestellung */
export async function createInvoice(order: Order, kind: 'rechnung' | 'anzahlung', payment: Payment | null): Promise<Invoice> {
	const existing = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.orderId, order.id), inArray(invoices.kind, ['rechnung', 'anzahlung'])))
		.get();
	if (existing) return existing;
	const s = await getSettings();
	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)).all();
	const locale = order.locale;
	const lines: InvoiceLine[] = items.map((i) => ({
		title: i.isDeposit ? `${L(locale, 'Anzahlung', 'Deposit')}: ${i.title}` : i.title,
		detail: itemDetail(i),
		quantity: i.quantity,
		unitPrice: i.unitPrice,
		total: i.lineTotal,
		taxRate: i.kind === 'gutschein' ? 0 : order.taxRate
	}));
	if (order.shippingMethod === 'versand' && order.shippingTotal > 0) {
		lines.push({ title: L(locale, 'Versand', 'Shipping'), detail: order.shippingCountry ?? '', quantity: 1, unitPrice: order.shippingTotal, total: order.shippingTotal, taxRate: order.taxRate });
	}
	const deductions = order.discountTotal ? [{ label: `${L(locale, 'Rabatt', 'Discount')}${order.discountCode ? ` (${order.discountCode})` : ''}`, amount: -order.discountTotal }] : [];
	const untaxed = items.filter((i) => i.kind === 'gutschein').reduce((a, i) => a + i.lineTotal - i.discountShare, 0);
	const notes = [
		servicePeriod(order.createdAt, locale),
		...taxNotes(order.taxCase, order, locale, s),
		...(untaxed ? [L(locale, 'Gutscheine sind Mehrzweckgutscheine und nicht umsatzsteuerbar; die Umsatzsteuer entsteht bei Einlösung.', 'Gift cards are multi-purpose vouchers and not subject to VAT at purchase.')] : []),
		...(kind === 'anzahlung' || items.some((i) => i.isDeposit)
			? [L(locale, 'Die Anzahlung wird mit der Schlussrechnung verrechnet.', 'The deposit will be credited on the final invoice.')]
			: []),
		...(order.giftCardTotal ? [L(locale, `Davon mit Gutschein bezahlt: ${formatMoney(order.giftCardTotal, locale)}.`, `Paid by gift card: ${formatMoney(order.giftCardTotal, locale)}.`)] : []),
		paidNote(order, payment, s, locale, order.paymentStatus === 'bezahlt' || !!payment?.paidAt || order.amountDue === 0)
	];
	const data: InvoiceData = {
		company: companyOf(s),
		customer: { ...order.billingAddress, email: order.email, vatId: order.vatId },
		orderNumber: order.number,
		orderDate: order.createdAt.toISOString(),
		paymentMethod: payment?.method ?? order.paymentMethod,
		paid: true,
		lines,
		deductions,
		net: order.total - order.taxTotal,
		tax: order.taxTotal,
		total: order.total,
		taxBreakdown: breakdown(order.taxCase, order.taxRate, order.total - untaxed, untaxed, order.taxTotal),
		taxCase: order.taxCase,
		notes,
		title: kind === 'anzahlung' ? L(locale, 'Anzahlungsrechnung', 'Deposit invoice') : L(locale, 'Rechnung', 'Invoice'),
		locale
	};
	return issue(order.id, payment?.id ?? null, kind, data, null, s);
}

/** Schlussrechnung für ein Full-Custom-Dekor nach der Restzahlung */
export async function createFinalInvoice(order: Order, job: DekorJob, payment: Payment): Promise<Invoice> {
	const existing = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.orderId, order.id), eq(invoices.paymentId, payment.id)))
		.get();
	if (existing) return existing;
	const s = await getSettings();
	const locale = order.locale;
	const net = order.taxCase === 'reverse_charge' || order.taxCase === 'export';
	const conv = (g: number) => (net ? netOf(g, s.tax.standardRate) : g);
	const final = conv(job.finalPrice ?? 0);
	const shipping = conv(job.shippingAmount ?? 0);
	// Details der Bestellzeile (Base, Finish, Bike …) – die Upgrades bestimmen den Endpreis mit
	const item = await db.select().from(orderItems).where(eq(orderItems.id, job.orderItemId)).get();
	const detail = item ? itemDetail(item) : job.bike ? `${job.bike.brand} ${job.bike.model} ${job.bike.year}` : '';
	const lines: InvoiceLine[] = [{ title: job.title, detail, quantity: 1, unitPrice: final, total: final, taxRate: order.taxRate }];
	if (shipping) lines.push({ title: L(locale, 'Versand', 'Shipping'), detail: '', quantity: 1, unitPrice: shipping, total: shipping, taxRate: order.taxRate });
	const gross = final + shipping;
	const taxAll = order.taxCase === 'normal' ? gross - netOf(gross, order.taxRate) : 0;
	const depositTax = order.taxCase === 'normal' ? job.depositAmount - netOf(job.depositAmount, order.taxRate) : 0;
	const depositInvoice = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.orderId, order.id), inArray(invoices.kind, ['anzahlung', 'rechnung'])))
		.get();
	const total = gross - job.depositAmount;
	const tax = taxAll - depositTax;
	const data: InvoiceData = {
		company: companyOf(s),
		customer: { ...order.billingAddress, email: order.email, vatId: order.vatId },
		orderNumber: order.number,
		orderDate: order.createdAt.toISOString(),
		paymentMethod: payment.method,
		paid: true,
		lines,
		deductions: [
			{
				label: `${L(locale, 'abzüglich Anzahlung', 'less deposit')}${depositInvoice ? ` (${L(locale, 'Rechnung', 'invoice')} ${depositInvoice.number})` : ''}`,
				amount: -job.depositAmount
			}
		],
		net: total - tax,
		tax,
		total,
		taxBreakdown: breakdown(order.taxCase, order.taxRate, gross, 0, taxAll),
		taxCase: order.taxCase,
		notes: [
			servicePeriod(new Date(), locale),
			...taxNotes(order.taxCase, order, locale, s),
			...(order.taxCase === 'normal'
				? [L(locale, `In der Anzahlung enthaltene USt.: ${formatMoney(depositTax, locale)}.`, `VAT included in the deposit: ${formatMoney(depositTax, locale)}.`)]
				: []),
			paidNote(order, payment, s, locale, true)
		],
		title: L(locale, 'Schlussrechnung', 'Final invoice'),
		refNumber: depositInvoice?.number,
		locale
	};
	return issue(order.id, payment.id, 'schluss', data, null, s);
}

/** Zu jeder Rechnung der Bestellung eine Stornorechnung (negativ) */
export async function createStornoInvoices(orderId: number) {
	const all = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).orderBy(asc(invoices.id)).all();
	const s = await getSettings();
	for (const inv of all.filter((i) => i.kind !== 'storno')) {
		if (all.some((x) => x.kind === 'storno' && x.refInvoiceId === inv.id)) continue;
		const d = inv.data;
		const neg = (n: number) => -n;
		const data: InvoiceData = {
			...d,
			lines: d.lines.map((l) => ({ ...l, unitPrice: neg(l.unitPrice), total: neg(l.total) })),
			deductions: d.deductions.map((x) => ({ ...x, amount: neg(x.amount) })),
			net: neg(d.net),
			tax: neg(d.tax),
			total: neg(d.total),
			taxBreakdown: d.taxBreakdown.map((b) => ({ ...b, net: neg(b.net), tax: neg(b.tax) })),
			notes: [L(d.locale, `Storno der Rechnung ${inv.number} vom ${formatDate(inv.issuedAt, 'de')}.`, `Cancellation of invoice ${inv.number} dated ${formatDate(inv.issuedAt, 'en')}.`), ...d.notes.filter((n) => !/^(Bezahlt|Paid|Zahlbar|Payable)/.test(n))],
			title: L(d.locale, 'Stornorechnung', 'Credit note'),
			refNumber: inv.number
		};
		await issue(orderId, inv.paymentId, 'storno', data, inv.id, s);
	}
}

async function issue(orderId: number, paymentId: number | null, kind: Invoice['kind'], data: InvoiceData, refInvoiceId: number | null, s: ShopSettings): Promise<Invoice> {
	return db.transaction(async (tx) => {
		const now = new Date();
		const number = await nextInvoiceNumber(tx, s.orders.invoicePrefix, now);
		return tx
			.insert(invoices)
			.values({ number, orderId, paymentId, kind, refInvoiceId, issuedAt: now, net: data.net, tax: data.tax, total: data.total, data })
			.returning()
			.get();
	});
}

export async function invoiceForOrder(orderId: number, invoiceId: number) {
	return db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.orderId, orderId)))
		.get();
}

export async function orderOfInvoice(inv: Invoice) {
	return db.select().from(orders).where(eq(orders.id, inv.orderId)).get();
}

/* ================================================================ PDF */

const LOGO = path.resolve('static/bilder/logo-dunkel.png');

export function renderInvoicePdf(inv: Invoice): Promise<Buffer> {
	const d = inv.data;
	const loc = d.locale;
	const T = (de: string, en: string) => L(loc, de, en);
	const money = (n: number) => formatMoney(n, loc).replace(/ /g, ' ');
	const doc = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: 50, bottom: 60, left: 56, right: 56 }, info: { Title: `${d.title} ${inv.number}`, Author: d.company.name } });
	const chunks: Buffer[] = [];
	doc.on('data', (c: Buffer) => chunks.push(c));
	const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

	const left = 56;
	const right = doc.page.width - 56;
	const width = right - left;
	const grey = '#6b6b73';

	// Kopf: Logo rechts, Absender klein über der Anschrift
	if (fs.existsSync(LOGO)) doc.image(LOGO, right - 130, 42, { width: 130 });
	const sender = [d.company.name, d.company.street, `${d.company.zip} ${d.company.city}`.trim()].filter(Boolean).join(' · ');
	doc.font('Helvetica').fontSize(7.5).fillColor(grey).text(sender, left, 130, { width: 260 });
	const c = d.customer;
	const addr = [c.company, `${c.firstName} ${c.lastName}`.trim(), c.street, `${c.zip} ${c.city}`.trim(), c.country !== 'AT' ? c.country : '', c.vatId ? `UID: ${c.vatId}` : ''].filter(Boolean);
	doc.fontSize(10.5).fillColor('#000').text(addr.join('\n'), left, 146, { width: 260, lineGap: 1.5 });

	// Rechnungsdaten rechts
	const meta: [string, string][] = [
		[T('Rechnungsnummer', 'Invoice no.'), inv.number],
		[T('Rechnungsdatum', 'Invoice date'), formatDate(inv.issuedAt, loc)],
		[T('Bestellnummer', 'Order no.'), String(d.orderNumber)],
		[T('Bestelldatum', 'Order date'), formatDate(d.orderDate, loc)]
	];
	if (d.refNumber) meta.push([T('Bezug', 'Reference'), d.refNumber]);
	let my = 146;
	for (const [k, v] of meta) {
		doc.fontSize(8.5).fillColor(grey).text(k, 340, my, { width: 100 });
		doc.fontSize(9.5).fillColor('#000').text(v, 440, my - 0.5, { width: right - 440, align: 'right' });
		my += 15;
	}

	// Titel
	let y = Math.max(doc.y, my) + 34;
	doc.font('Helvetica-Bold').fontSize(18).fillColor('#000').text(`${d.title} ${inv.number}`, left, y);
	y = doc.y + 16;

	// Tabelle
	const cols = { pos: left, title: left + 22, qty: right - 190, unit: right - 130, total: right - 60 };
	const head = () => {
		doc.font('Helvetica-Bold').fontSize(8.5).fillColor(grey);
		doc.text('#', cols.pos, y);
		doc.text(T('Bezeichnung', 'Description'), cols.title, y);
		doc.text(T('Menge', 'Qty'), cols.qty, y, { width: 40, align: 'right' });
		doc.text(T('Einzelpreis', 'Unit price'), cols.unit, y, { width: 64, align: 'right' });
		doc.text(T('Gesamt', 'Total'), cols.total - 10, y, { width: 70, align: 'right' });
		y += 14;
		doc.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor('#000').stroke();
		y += 8;
	};
	head();
	d.lines.forEach((l, i) => {
		const titleWidth = cols.qty - cols.title - 12;
		doc.font('Helvetica-Bold').fontSize(9.5);
		const hTitle = doc.heightOfString(l.title, { width: titleWidth });
		doc.font('Helvetica').fontSize(8);
		const hDetail = l.detail ? doc.heightOfString(l.detail, { width: titleWidth }) + 2 : 0;
		if (y + hTitle + hDetail > doc.page.height - 150) {
			doc.addPage();
			y = 60;
			head();
		}
		doc.font('Helvetica').fontSize(9.5).fillColor('#000').text(String(i + 1), cols.pos, y);
		doc.font('Helvetica-Bold').text(l.title, cols.title, y, { width: titleWidth });
		if (l.detail) doc.font('Helvetica').fontSize(8).fillColor(grey).text(l.detail, cols.title, y + hTitle + 2, { width: titleWidth });
		doc.font('Helvetica').fontSize(9.5).fillColor('#000');
		doc.text(String(l.quantity), cols.qty, y, { width: 40, align: 'right' });
		doc.text(money(l.unitPrice), cols.unit, y, { width: 64, align: 'right' });
		doc.text(money(l.total), cols.total - 10, y, { width: 70, align: 'right' });
		y += hTitle + hDetail + 10;
		doc.moveTo(left, y - 5).lineTo(right, y - 5).lineWidth(0.3).strokeColor('#d4d4d8').stroke();
	});

	// Summen
	y += 6;
	const sumRow = (label: string, value: number, bold = false) => {
		doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor('#000');
		// Lange Bezeichnungen (z. B. Abzug der Anzahlung) dürfen umbrechen – die nächste Zeile rückt entsprechend nach
		const h = doc.heightOfString(label, { width: 230 });
		doc.text(label, right - 310, y, { width: 230, align: 'right' });
		doc.text(money(value), right - 80, y, { width: 80, align: 'right' });
		y += Math.max(h, bold ? 13 : 11) + (bold ? 5 : 3);
	};
	const gross = d.lines.reduce((a, l) => a + l.total, 0);
	if (d.deductions.length) {
		sumRow(T('Summe', 'Sum'), gross);
		for (const x of d.deductions) sumRow(x.label, x.amount);
	}
	if (d.taxCase === 'normal') {
		sumRow(T('Nettobetrag', 'Net amount'), d.net);
		for (const b of d.taxBreakdown.filter((b) => b.tax !== 0)) sumRow(`${T('USt.', 'VAT')} ${(b.rate / 100).toLocaleString(loc === 'en' ? 'en-GB' : 'de-AT')} %`, d.tax);
	}
	doc.moveTo(right - 310, y).lineTo(right, y).lineWidth(0.8).strokeColor('#000').stroke();
	y += 6;
	sumRow(inv.kind === 'schluss' ? T('Restbetrag', 'Amount due') : T('Gesamtbetrag', 'Total'), d.total, true);

	// Hinweise
	y += 12;
	doc.font('Helvetica').fontSize(8.5).fillColor('#000');
	for (const n of d.notes) {
		doc.text(n, left, y, { width });
		y = doc.y + 4;
	}

	// Fußzeile auf jeder Seite
	const footer = [
		[d.company.name, d.company.street, `${d.company.zip} ${d.company.city}`.trim()].filter(Boolean).join(' · '),
		[d.company.fn ? `${d.company.fn}${d.company.court ? `, ${d.company.court}` : ''}` : '', d.company.uid ? `UID ${d.company.uid}` : ''].filter(Boolean).join(' · '),
		[d.company.bank, d.company.iban ? `IBAN ${d.company.iban}` : '', d.company.bic ? `BIC ${d.company.bic}` : ''].filter(Boolean).join(' · '),
		[d.company.email, d.company.phone, d.company.web].filter(Boolean).join(' · ')
	].filter(Boolean);
	const range = doc.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		// Die Fußzeile liegt im unteren Rand – sonst würde pdfkit eine neue Seite beginnen
		doc.page.margins.bottom = 0;
		doc.font('Helvetica').fontSize(7).fillColor(grey);
		doc.text(footer.join('\n'), left, doc.page.height - 58, { width, align: 'center', lineGap: 1, lineBreak: true, height: 50 });
	}
	doc.end();
	return done;
}
