import { error } from '@sveltejs/kit';
import { invoiceForOrder, renderInvoicePdf } from '$lib/server/shop/invoices';
import { orderByToken } from '$lib/server/shop/order-view';
import type { RequestHandler } from './$types';

/** Rechnung als PDF – nur mit dem Schlüssel der Bestellung */
export const GET: RequestHandler = async ({ params }) => {
	const order = await orderByToken(params.token);
	if (!order) error(404, 'Nicht gefunden');
	const inv = await invoiceForOrder(order.id, Number(params.id));
	if (!inv) error(404, 'Nicht gefunden');
	const pdf = await renderInvoicePdf(inv);
	return new Response(new Uint8Array(pdf), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${inv.number}.pdf"`,
			'Cache-Control': 'private, no-store',
			'X-Robots-Tag': 'noindex'
		}
	});
};
