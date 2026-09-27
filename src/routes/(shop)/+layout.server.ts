import { asc, ne } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import { db } from '$lib/server/db';
import { pages } from '$lib/server/db/schema';
import { getSettings, telHref, waHref } from '$lib/server/settings';
import { bikeFromCookie, categoryTree } from '$lib/server/shop/catalog';
import { cartIdFrom, loadCart } from '$lib/server/shop/cart';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const locale = locals.locale;
	const s = await getSettings();
	const cartId = await cartIdFrom(cookies, false);
	const [menu, cart, footerPages, bike] = await Promise.all([
		categoryTree(locale, true),
		loadCart(cartId, { customer: locals.customer, locale, settings: s }),
		db.select({ slug: pages.slug, title: pages.title, titleEn: pages.titleEn, group: pages.group }).from(pages).where(ne(pages.group, 'keine')).orderBy(asc(pages.sortOrder)).all(),
		bikeFromCookie(cookies.get('byb_bike'))
	]);
	const c = s.company;
	return {
		locale,
		customer: locals.customer ? { firstName: locals.customer.firstName, dealer: locals.customer.dealerStatus === 'freigegeben' } : null,
		menu,
		cart: {
			count: cart.count,
			total: cart.totals.subtotal - cart.totals.discount,
			lines: cart.lines.map((l) => ({ id: l.id, slug: l.slug, title: l.title, variantTitle: l.variantTitle, image: l.image, quantity: l.quantity, lineTotal: l.lineTotal, isDeposit: l.isDeposit }))
		},
		company: {
			brand: c.brand,
			name: c.name,
			email: c.email,
			phone: c.phone,
			phoneHref: c.phone ? telHref(c.phone) : '',
			whatsappHref: c.whatsapp ? waHref(c.whatsapp) : '',
			instagram: c.instagram,
			facebook: c.facebook,
			tiktok: c.tiktok,
			youtube: c.youtube
		},
		taxMode: s.tax.mode,
		notice: pick(locale, s.home.notice, s.home.noticeEn),
		footerPages: footerPages.map((p) => ({ slug: p.slug, title: pick(locale, p.title, p.titleEn), group: p.group })),
		bike: bike ? { label: `${bike.brand} ${bike.model}${bike.year ? ` ${bike.year}` : ''}`, modelId: bike.modelId, year: bike.year } : null
	};
};
