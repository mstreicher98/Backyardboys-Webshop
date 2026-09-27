import type { Cookies } from '@sveltejs/kit';
import type { SessionCustomer } from '../customer-auth';
import { getSettings } from '../settings';
import { dealerDiscountOf } from './cart';
import { bikeFromCookie, findProductIds, productCards, type SortKey } from './catalog';
import type { Locale } from '$lib/shop-types';

const SORTS: SortKey[] = ['empfohlen', 'neu', 'preis_auf', 'preis_ab'];
const PAGE_SIZE = 24;

/** Gemeinsame Logik für Produktliste, Suche und Kategorie */
export async function productListing(opts: { url: URL; cookies: Cookies; locale: Locale; customer: SessionCustomer | null; categoryIds?: number[] }) {
	const { url } = opts;
	const s = await getSettings();
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const sortParam = url.searchParams.get('sortierung') as SortKey | null;
	const sort: SortKey = sortParam && SORTS.includes(sortParam) ? sortParam : 'empfohlen';
	const page = Math.max(1, Number(url.searchParams.get('seite')) || 1);
	const bike = await bikeFromCookie(opts.cookies.get('byb_bike'));
	// Filter aufs gespeicherte Bike lässt sich mit ?alle=1 abschalten
	const useBike = !!bike && url.searchParams.get('alle') !== '1';
	const ids = await findProductIds({
		categoryIds: opts.categoryIds,
		search: q || undefined,
		sort,
		bike: useBike ? { modelId: bike!.modelId, year: bike!.year } : null
	});
	const pages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
	const slice = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	const products = await productCards(slice, { dealerDiscount: dealerDiscountOf(opts.customer, s), locale: opts.locale });
	return {
		products,
		total: ids.length,
		page,
		pages,
		q,
		sort,
		bikeFilter: useBike ? `${bike!.brand} ${bike!.model}${bike!.year ? ` ${bike!.year}` : ''}` : null,
		hasBike: !!bike
	};
}
