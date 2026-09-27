import { productListing } from '$lib/server/shop/listing';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	return productListing({ url, cookies, locale: locals.locale, customer: locals.customer });
};
