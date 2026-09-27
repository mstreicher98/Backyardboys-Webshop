import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoices } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { renderInvoicePdf } from '$lib/server/shop/invoices';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	requirePermission(locals, 'shop.manage');
	const inv = await db.select().from(invoices).where(eq(invoices.id, Number(params.id))).get();
	if (!inv) error(404, 'Rechnung nicht gefunden');
	const pdf = await renderInvoicePdf(inv);
	return new Response(new Uint8Array(pdf), {
		headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.number}.pdf"`, 'Cache-Control': 'no-store' }
	});
};
