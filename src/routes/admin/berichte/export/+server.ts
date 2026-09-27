import { error } from '@sveltejs/kit';
import { and, asc, gte, lt } from 'drizzle-orm';
import { INVOICE_KIND_LABEL, TAX_CASE_LABEL } from '$lib/admin-labels';
import { db } from '$lib/server/db';
import { invoices } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { paymentLabel } from '$lib/server/shop/orders';
import { renderInvoicePdf } from '$lib/server/shop/invoices';
import { zip } from '$lib/server/zip';
import type { RequestHandler } from './$types';

const eur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const cell = (v: string | number) => {
	const s = String(v ?? '');
	return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const day = (d: Date) => d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' });

/** Rechnungen eines Zeitraums als CSV (für BMD, RZL, Excel) oder als ZIP mit allen PDFs */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, 'finance.view');
	const von = url.searchParams.get('von') ?? '';
	const bis = url.searchParams.get('bis') ?? '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) error(400, 'Zeitraum fehlt');
	const from = new Date(`${von}T00:00:00`);
	const to = new Date(new Date(`${bis}T00:00:00`).getTime() + 86_400_000);
	const rows = await db
		.select()
		.from(invoices)
		.where(and(gte(invoices.issuedAt, from), lt(invoices.issuedAt, to)))
		.orderBy(asc(invoices.issuedAt), asc(invoices.id))
		.all();
	const name = `rechnungen_${von}_${bis}`;

	if (url.searchParams.get('format') === 'pdf') {
		const files = [];
		for (const inv of rows) files.push({ name: `${inv.number}.pdf`, data: await renderInvoicePdf(inv), date: inv.issuedAt });
		return new Response(new Uint8Array(zip(files)), {
			headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name}.zip"`, 'Cache-Control': 'no-store' }
		});
	}

	const head = ['Rechnungsnummer', 'Art', 'Datum', 'Bestellnummer', 'Kunde', 'Firma', 'UID Kunde', 'Land', 'Steuerfall', 'Steuersatz %', 'Netto', 'USt', 'Brutto', 'Zahlungsart', 'Bezug'];
	const lines = rows.map((inv) => {
		const d = inv.data;
		const rate = d.taxBreakdown.find((b) => b.tax !== 0)?.rate ?? 0;
		return [
			inv.number,
			INVOICE_KIND_LABEL[inv.kind],
			day(inv.issuedAt),
			d.orderNumber,
			`${d.customer.firstName} ${d.customer.lastName}`.trim(),
			d.customer.company,
			d.customer.vatId,
			d.customer.country,
			TAX_CASE_LABEL[d.taxCase],
			(rate / 100).toString().replace('.', ','),
			eur(inv.net),
			eur(inv.tax),
			eur(inv.total),
			paymentLabel(d.paymentMethod),
			d.refNumber ?? ''
		]
			.map(cell)
			.join(';');
	});
	const csv = `﻿${[head.join(';'), ...lines].join('\r\n')}\r\n`;
	return new Response(csv, {
		headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"`, 'Cache-Control': 'no-store' }
	});
};
