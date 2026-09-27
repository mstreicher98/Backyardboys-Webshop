import type { RequestHandler } from './$types';

const PRIVATE = ['/admin', '/konto', '/kasse', '/warenkorb', '/bestellung', '/zahlung', '/datei', '/en/account', '/en/checkout', '/en/cart', '/en/order', '/en/payment'];

export const GET: RequestHandler = ({ url }) =>
	new Response(`User-agent: *\n${PRIVATE.map((p) => `Disallow: ${p}`).join('\n')}\n\nSitemap: ${url.origin}/sitemap.xml\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
